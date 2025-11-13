# Системный дизайн (System Design)

**Роль:** Architect
**Фаза:** Phase 1 - Architecture
**Версия:** 2.0 (исправлено после изучения legacy)
**Статус:** ⏳ Требует review

---

## 1. Обзор

Project Assistant - это Telegram-бот для стратегического управления командами, построенный на **принципах информационных потоков**, а не жесткой типизации данных.

### Ключевые принципы:

1. **Общий информационный поток**, а не типизированные сущности (отчеты/задачи/инициативы)
2. **LLM решает** кому какую информацию направлять на основе контекста
3. **Контекстно-зависимая маршрутизация**: руководитель фиксирован, но информационные потоки определяются контекстом
4. **Batch обработка** для повышения скорости обработки и возможной финансовой экономии (за счет скидок на batch API)
5. **Накопление + порог** вместо немедленной отправки
6. **Context tracking** для избежания дублирования информации
7. **Serverless-first** с учетом cold start и timeout ограничений
8. **Queue pattern** для избежания Telegram timeout (1 минута)

---

## 2. Архитектурные слои

```
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM USERS                          │
│            (Participants & Leads)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │      Yandex Cloud HTTP Trigger         │
    │    (webhook для Telegram)              │
    └────────────────┬───────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │      Dispatcher (УЖЕ СУЩЕСТВУЕТ)       │
    │   • Определяет источник вызова         │
    │   • isTelegramWebhook()                │
    │   • isQueue()                          │
    │   • isTimer()                          │
    │   • isAdmin()                          │
    └────────────────┬───────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  module.exports  │    │  reg_dispatcher_ │
│    .process      │    │    handlers      │
│                  │    │                  │
│  (webhook entry) │    │  (register Timer/│
│                  │    │   Queue/Admin)   │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       │
┌──────────────────┐             │
│  Telegram        │             │
│  Handlers        │             │
│  • bot.command() │             │
│  • bot.on('text')│             │
│  • bot.on('voice│             │
│  • bot.action()  │             │
└────────┬─────────┘             │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────┐
│         Business Logic               │
│  • ContentBus (raw/processed)        │
│  • DialogSystem (LLM + Tools)        │
│  • TimerHandler (batch processing)   │
│  • WorkspaceManager                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│      Infrastructure Layer            │
│  • @dieugene/queuer (YMQ)            │
│  • @dieugene/sessions (YDB)          │
│  • @dieugene/users-controller (YDB)  │
│  • @dieugene/tg-messages-cache (YDB) │
│  • @dialogai/dialog-class (LangChain)│
└─────────────────────────────────────┘
```

---

## 3. Entry Point (УЖЕ СУЩЕСТВУЕТ - НЕ РАЗРАБАТЫВАЕТСЯ)

> **📌 ВАЖНО О КОДЕ В ДОКУМЕНТЕ:** Весь код, представленный в этом документе, является **ПСЕВДОКОДОМ / СПРАВОЧНЫМ МАТЕРИАЛОМ**. Он служит для ориентира и демонстрации подходов, но **НЕ ПРЕДНАЗНАЧЕН для прямого копирования** в реализацию. При этом код учитывает особенности и решения из предыдущей реализации, которые являются ответом на конкретные проблемы и сложности.

### 3.1 Структура entry point

Dispatcher УЖЕ сформирован в архитектуре (@dieugene пакеты). Нам нужно только:

#### A. Webhook handler

```javascript
/**
 * Entry point для Telegram webhook
 * Вызывается при: HTTP trigger от Telegram
 */
module.exports.process = async function(inputData) {
    const bot = initBot();
    try {
        await bot.handleUpdate(inputData.data.object);
    } catch (e) {
        // Error handling
        await bot.telegram.sendMessage(chat_id, 'Возникла ошибка...');
    }
    return { statusCode: 200, body: '' };
};
```

#### B. Event handlers registration

```javascript
/**
 * Регистрация обработчиков для различных источников вызова
 * Вызывается при: инициализации функции
 */
module.exports.reg_dispatcher_handlers = function({ Timers, Queues, Webs, Admins }) {

    // Обработчик вызова по таймеру
    if (typeof Timers.reg === 'function') {
        Timers.reg(async function(input) {
            return await TimerHandler.invoke(input);
        });
    }

    // Обработчик вызова из очереди
    if (typeof Queues.reg === 'function') {
        Queues.reg(async function(input) {
            if (TimerQueues.is_relevant_queue(input)) {
                await TimerQueues.accept(input);
                return true;
            }
            return false;
        });
    }

    // Обработчик админских вызовов
    if (typeof Admins.reg === 'function') {
        Admins.reg(async function(input) {
            return await AdminHandler.invoke(input);
        });
    }

    // JSON-based admin commands
    Admins.reg.json(async function(input) {
        return await Utils.execute_from_json(input.data.object);
    });
};
```

**ВАЖНО:** Dispatcher определяет источник вызова (webhook/queue/timer/admin) и маршрутизирует на соответствующий обработчик. Мы НЕ разрабатываем Router - он уже существует.

---

## 4. Telegram Handlers Layer

### 4.1 Задача Telegram Handlers

**Определить ТИП входящего сообщения:**

- Команда (`/start`, `/help`, `/news`, `/mycontacts`)
- Callback query (нажатие кнопки)
- Текстовое сообщение
- Голосовое сообщение (распознать → текст)
- Файл
- Контакт

### 4.2 Структура обработчиков

```javascript
function initBot() {
    const bot = new Telegraf(bot_token, {
        handlerTimeout: Number.POSITIVE_INFINITY // НЕ ПРЕРЫВАТЬ обработку
    });

    // Команды
    bot.start(async (ctx) => { /* онбординг */ });
    bot.command('help', async (ctx) => { /* справка */ });
    bot.command('news', async (ctx) => {
        // Запрос новостей о команде
        const dialog = await get_dialog(ctx);
        await dialog.invoke_with_instruction('Покажи новости о команде');
        await send_dialog_results(ctx, dialog);
    });
    bot.command('mycontacts', async (ctx) => { /* список участников */ });

    // Callback queries (кнопки)
    bot.on('callback_query', async (ctx) => {
        const callbackId = ctx.update.callback_query.data;
        await execute_callback(ctx, callbackId, bot_token);
    });

    // Текстовые сообщения → ОСНОВНОЙ ПОТОК
    bot.on('text', async (ctx) => {
        await process_user_message(ctx, input, undefined, bot_token);
    });

    // Голосовые сообщения
    bot.on('voice', async (ctx) => {
        await process_voice_message(ctx, input);
    });

    return bot;
}
```

### 4.3 Queue Pattern (КРИТИЧНО для избежания timeout)

**Проблема:** Telegram webhook ждет ответ 1 минуту. AI обработка может занять 30-60+ секунд.

**Решение (УЖЕ РЕАЛИЗОВАНО в @dieugene/queuer):**

```javascript
async function process_user_message(ctx, input, data = {}, bot_token) {
    if (!queuer.is_from_queue(input)) {
        // ШАГ 1: Вызов из Telegram webhook

        // Показываем placeholder
        let placeholder_message_id = await tg_cache.put_placeholder(ctx);

        // Проверяем session lock (один запрос на пользователя)
        let user_uuid = await users.tg.get_user_uuid(ctx);
        let session_in_progress = !(await sessions.is_finished(user_uuid));
        if (session_in_progress) {
            return await ctx.editMessageText(
                'Пожалуйста, подождите. Обрабатываю предыдущий запрос',
                { message_id: placeholder_message_id }
            );
        }

        // Кешируем данные (в YDB через @dieugene/tg-messages-cache)
        await tg_cache.cache_and_show_progress(ctx, data);
        await sessions.start(user_uuid);

        // ШАГ 2: ОТПРАВЛЯЕМ В ОЧЕРЕДЬ и СРАЗУ ВОЗВРАЩАЕМ 200 OK
        return await queuer.send_to_queue(input, bot_token, process.env.QUEUE_URL);
    }

    // ШАГ 3: Вызов из Queue (trigger YMQ → функция)
    let cache = await tg_cache.get(ctx);
    let placeholder_message_id = await tg_cache.get_placeholder_message_id(ctx, cache);
    await tg_cache.del(ctx);

    // ШАГ 4: Обрабатываем (может быть долго)
    await processDialog(ctx, tg_cache.exclude_placeholder(cache), placeholder_message_id);
}

async function processDialog(ctx, cache, placeholder_message_id) {
    const dialog = await get_dialog(ctx);
    await dialog.invoke(cache); // LLM обработка
    await send_dialog_results(ctx, dialog, placeholder_message_id);
    await summarize_dialog(dialog); // Сохранение в ContentBus
}
```

**Диаграмма Queue Pattern:**

```
[Telegram] → [Webhook] → [Telegram Handler]
                                 │
                                 ├─ placeholder: "Думаю..."
                                 ├─ cache data → YDB
                                 ├─ send to Queue (YMQ)
                                 └─ return 200 OK ← БЕЗ ОЖИДАНИЯ AI

[YMQ] → [Queue Trigger] → [Telegram Handler снова]
                                 │
                                 ├─ read cache from YDB
                                 ├─ AI processing (долго)
                                 ├─ send result to user
                                 └─ finish session
```

---

## 5. ContentBus: Информационный поток

### 5.1 Принцип работы

**НЕТ жесткой типизации** (report/initiative/task).

**ЕСТЬ:**
- **Raw type** - сырые диалоги, как они пришли от пользователей
- **Processed type** - обработанные результаты

> **⚠️ ТРЕБУЕТ УТОЧНЕНИЯ:** Подход к обработке данных (этапность, каскадность) будет детализирован в процессе разработки. Не следует считать, что обработка выполняется сразу под конкретных получателей - возможна многоэтапная/каскадная обработка.

### 5.2 Схема YDB таблицы

```javascript
Table: content_bus

Columns:
- workspace_id (String) - идентификатор workspace (partition key)
- user_uuid_source (String) - от кого
- user_uuid_target (String, optional) - кому (только для processed)
- type (String) - 'raw' или 'processed'
- data (JsonDocument) - содержимое
- created_at (Uint64) - timestamp

Indexes:
- workspace_source_type_time_index (workspace_id, user_uuid_source, type, created_at)
- workspace_source_target_type_index (workspace_id, user_uuid_source, user_uuid_target, type)
```

### 5.3 Raw запись

**Когда создается:** После завершения диалога

> **⚠️ ТЕХНОЛОГИЧЕСКИЙ ВЫЗОВ:** Определение момента завершения диалога является одной из существенных проблем предыдущей реализации. Требуется разработка надежного механизма определения завершения диалога.

```javascript
async function process_dialog_completion(user_uuid, dialog) {
    // Получаем buffer history из Dialog
    const bufferHistory = await dialog.getBufferHistory();
    const dialog_text = await dialog.getBufferHistoryText({
        ai_alias: 'Бот',
        user_alias: 'Пользователь'
    });

    // Сохраняем RAW запись в ContentBus
    const raw_data = {
        type: 'raw',
        user_uuid: user_uuid,
        created_at: created_at,
        dialog_text: dialog_text,
        user_name: user_name,
        session_date: session_date // YYYY-MM-DD
    };

    await Dao.add_raw_update(user_uuid, raw_data, created_at);

    // Очищаем buffer после сохранения
    await dialog.clearBuffer();
}
```

### 5.4 Processed запись

> **⚠️ ВРЕМЕННАЯ СТРУКТУРА:** Данная структура взята из предыдущей реализации и работала не вполне удовлетворительно. Эта схема требует уточнения и доработки в процессе разработки. НЕ СЧИТАТЬ высеченной в граните.

**Структура (предварительная):**

```javascript
{
    notification_history: [
        "Иван начал работу над новым модулем",
        "Мария завершила тестирование"
    ], // Что УЖЕ отправили этому пользователю

    news: [
        "Сергей столкнулся с проблемой в API",
        "Команда запланировала встречу на завтра"
    ], // Что НАКОПЛЕНО, но еще НЕ отправлено

    last_processed_date: 1699999999, // Watermark: до какой даты обработаны raw записи
    processing_version: "v1.2"
}
```

---

## 6. Batch AI Processing

### 6.1 Триггеры обработки (3 уровня)

#### Уровень 1: Количество сообщений
```
IF накопилось ≥ M сообщений (напр. 20)
THEN инициировать batch обработку
```

#### Уровень 2: Временной интервал
```
IF прошло ≥ T времени с последней обработки (напр. 1 день)
THEN инициировать batch обработку
```

#### Уровень 3: Контекст (срочность)
```
IF LLM определил сообщение как СРОЧНОЕ
THEN инициировать batch обработку НЕМЕДЛЕННО
```

### 6.2 Процесс batch обработки

```javascript
async function process_users_batch(limit = 50) {
    // 1. Получить batch пользователей (50 человек)
    let uuid_batch = await users.tg.get_next_batch(limit);
    let users_batch = await users.get_user_data_list(uuid_batch);

    // 2. ЭТАП: Подготовка данных
    // Для каждого пользователя в workspace:
    // - Автокоррекция raw-записей (если диалог был, но raw не создана)
    // - Сбор новых raw записей от участников workspace
    for (const user of users_batch) {
        await ContentBus.check_and_create_missing_raw_record(user);
    }

    const { all_content_data, user_mapping } =
        await ContentBus.collect_content_for_users(users_batch);

    // all_content_data = [
    //   { source_user, workspace_id, previous_notifications, new_raw_records },
    //   ...
    // ]

    // 3. ЭТАП: Batch AI обработка (ОДИН ЗАПРОС для всех!)
    const ai_results = await ContentBus.batch_analyze_content(all_content_data);

    // ai_results = [
    //   { target_users: [uuid1, uuid2], message: "Иван начал..." },
    //   { target_users: [uuid1], message: "Сергей столкнулся..." },
    //   ...
    // ]

    // 4. ЭТАП: Применение результатов
    await ContentBus.accumulate_batch_results(users_batch, user_mapping, ai_results);

    // 5. ЭТАП: Проверка порога N
    for (let user of users_batch) {
        const all_user_news = await ContentBus.collect_all_user_news(user.uuid);

        const N = 3; // Порог (настраивается)

        if (all_user_news.length >= N) {
            // Отправляем накопленные новости
            await send_news_to_user(user, all_user_news);
            // Переносим в history
            await ContentBus.move_all_news_to_history(user.uuid);
        }
    }

    // 6. ЭТАП: Пост следующего batch в очередь
    await Queues.post('process_users', limit);
}
```

### 6.3 AI обработка: Schema-Guided Reasoning (SGR)

> **⚠️ КРИТИЧНОЕ ИЗМЕНЕНИЕ:** Предыдущий подход с одним промптом "все на все" оказался неудачным - он смешивает в кучу все сообщения и интересы всех участников, создавая мешанину.

**Новый подход: Schema-Guided Reasoning с каскадной обработкой**

Вместо одного большого запроса используем **каскадную фокусную обработку** - одна и та же последовательность сообщений многократно направляется в LLM для извлечения специфичной информации на каждом этапе.

**Преимущества:**
- Более фокусная обработка (каждый запрос решает одну задачу)
- Возможность использования более дешевых моделей (например, gpt-5-mini)
- Структурированное извлечение данных через схемы
- Лучшая валидация на каждом этапе

**Ссылка:** [Schema-Guided Reasoning by Rinat Abdullin](https://abdullin.com/schema-guided-reasoning)

#### 6.3.1 Этапы каскадной обработки (примерная схема)

```javascript
async function batch_analyze_content_sgr(all_content_data) {
    const results = [];

    // ЭТАП 1: Классификация активности (для каждого сообщения)
    for (const activity of all_content_data) {
        const classification = await classify_activity_sgr(activity);
        // Схема: { type: 'progress'|'blocker'|'question'|'decision', urgency: 'low'|'medium'|'high' }

        // ЭТАП 2: Извлечение сущностей (для каждого сообщения)
        const entities = await extract_entities_sgr(activity);
        // Схема: { mentioned_people: [], topics: [], dependencies: [] }

        // ЭТАП 3: Определение релевантности (фокусный запрос)
        const relevance = await determine_relevance_sgr(activity, classification, entities, workspace_context);
        // Схема: { relevant_for_lead: boolean, relevant_for_users: [uuid], reason: string }

        // ЭТАП 4: Формирование сообщений (для каждого получателя отдельно!)
        if (relevance.relevant_for_lead) {
            const message_for_lead = await format_message_for_lead_sgr(activity, classification, entities);
            results.push({ target_user: lead_uuid, message: message_for_lead });
        }

        for (const target_uuid of relevance.relevant_for_users) {
            const message = await format_message_for_participant_sgr(activity, target_uuid, classification, entities);
            results.push({ target_user: target_uuid, message });
        }
    }

    return results;
}
```

#### 6.3.2 Пример SGR-функции с JSON Schema

```javascript
async function classify_activity_sgr(activity) {
    const schema = {
        type: 'object',
        properties: {
            activity_type: {
                type: 'string',
                enum: ['progress_update', 'blocker', 'question', 'decision', 'announcement'],
                description: 'Тип активности участника'
            },
            urgency: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Уровень срочности'
            },
            summary: {
                type: 'string',
                description: 'Краткое резюме (1 предложение)'
            }
        },
        required: ['activity_type', 'urgency', 'summary']
    };

    const prompt = `
Проанализируй активность участника и классифицируй её.

Активность:
Пользователь: ${activity.user_name}
Текст диалога: ${activity.dialog_text}

Определи тип активности и уровень срочности.
`;

    // Используем structured output (OpenAI, Anthropic и др. поддерживают)
    const response = await llm.generate_structured(prompt, schema);
    return response; // { activity_type: 'progress_update', urgency: 'low', summary: '...' }
}
```

#### 6.3.3 Выбор модели

**Для каскадной обработки:**
- **gpt-5-mini** - дешевая и быстрая модель для этапов классификации и извлечения
- **gpt-5** или **claude-3.5-sonnet** - для сложных этапов (определение релевантности, формирование сообщений)

**Стоимость:** При каскадной обработке общее количество запросов увеличивается, но использование более дешевых моделей компенсирует это, а качество результатов повышается.

> **📌 ТРЕБУЕТ ДЕТАЛИЗАЦИИ:** Конкретные схемы для каждого этапа, точная последовательность обработки и выбор моделей будут уточнены в процессе разработки.

---

## 7. LLM-Driven Routing (вместо жесткой типизации)

### 7.1 Принцип

**НЕТ:**
- Классификация "это отчет" / "это задача" / "это инициатива"
- Фиксированные правила "отчеты идут лиду"
- Статичные подписки "участник А получает инфу от Б и В"

**ЕСТЬ:**
- LLM анализирует КОНТЕКСТ каждого сообщения
- LLM определяет РЕЛЕВАНТНОСТЬ для каждого участника
- LLM формулирует ПЕРСОНАЛИЗИРОВАННОЕ сообщение для каждого

### 7.2 Контекст для LLM

```javascript
{
    workspace: {
        id: "ws-123",
        name: "Команда разработки",
        lead_uuid: "user-1", // Руководитель фиксирован
        members: [
            { uuid: "user-1", name: "Иван" },
            { uuid: "user-2", name: "Мария" },
            { uuid: "user-3", name: "Сергей" }
        ]
    },

    // ⚠️ ТРЕБУЕТ УТОЧНЕНИЯ: структура и использование recent_activity
    recent_activity: [
        {
            source: { uuid: "user-2", name: "Мария" },
            dialog_text: "Сегодня завершила тестирование модуля авторизации. Все тесты проходят.",
            timestamp: 1699999999
        },
        {
            source: { uuid: "user-3", name: "Сергей" },
            dialog_text: "Начал работу над дизайном новой страницы. Нужна обратная связь от Марии по UX.",
            timestamp: 1699999998
        }
    ],

    // Для КАЖДОГО участника - свой контекст
    user_contexts: {
        "user-1": {
            uuid: "user-1",
            name: "Иван",
            is_lead: true, // Базово две роли: руководитель или участник
            previous_notifications: [
                "Мария начала тестирование",
                "Сергей начал работу над дизайном"
            ]
        },
        "user-2": {
            uuid: "user-2",
            name: "Мария",
            is_lead: false,
            previous_notifications: []
        }
    }
}
```

### 7.3 LLM решение

Для Ивана (lead):
```
"📊 Сводка команды:
• Мария завершила тестирование модуля авторизации - все в порядке
• Сергей работает над дизайном новой страницы, ожидает обратную связь от Марии"
```

Для Марии (developer):
```
"💬 Сергей просит вашей обратной связи по UX для новой страницы"
```

Для Сергея:
```
null (ничего не отправляем, он сам автор активности)
```

### 7.4 Двухуровневая архитектура контекста

**Ключевое понимание:** В системе работают **два параллельных уровня контекста**.

#### Уровень 1: Контекст диалога (Dialog Context)
- Хранится непосредственно в модуле диалога (@dialogai/dialog-class)
- Управляется стандартными механиками:
  - История сообщений пользователя с ботом
  - Обрезка истории при превышении лимита токенов
  - Резюмирование предыдущих сообщений
- **Это текущий операционный контекст для взаимодействия с конкретным пользователем**

#### Уровень 2: Контекст шины данных (Data Bus Context)
- Формируется поверх ContentBus
- Включает:
  - Обработанные уведомления от других участников workspace
  - Накопленные новости (news)
  - История отправленных уведомлений (notification_history)
- **Это стратегический контекст команды**

#### Взаимодействие уровней

```
┌──────────────────────────────────────────────────────────┐
│         Data Bus Context (стратегический)                │
│  • Обработанная информация от команды                    │
│  • Накопленные новости для пользователя                  │
│  • История отправленных уведомлений                      │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Потенциальное сообщение
                     ▼
┌──────────────────────────────────────────────────────────┐
│         Dialog Context (операционный)                     │
│  • Текущая история диалога с пользователем               │
│  • Резюмированные предыдущие сообщения                   │
│  • ФИНАЛЬНАЯ ВАЛИДАЦИЯ перед отправкой                   │
└────────────────────┬─────────────────────────────────────┘
                     │
                     │ Валидированное сообщение
                     ▼
                 [Пользователь]
```

#### Роль финальной валидации

Контекст диалога выполняет **заключительную валидацию** перед отправкой:

1. **На промежуточных этапах** (batch обработка, SGR) формируется **потенциальное сообщение**
2. **Перед отправкой** сообщение проходит через LLM с контекстом диалога
3. **LLM проверяет** релевантность сообщения в текущем контексте диалога
4. **LLM адаптирует** формулировку под текущий контекст
5. **Только после этого** сообщение отправляется пользователю

**Преимущества:**
- Избежание дублирования (если информация уже была в диалоге)
- Адаптация формулировки под текущий тон/состояние диалога
- Контекстная релевантность (учет того, о чем пользователь говорил недавно)

> **📌 ТРЕБУЕТ ДЕТАЛИЗАЦИИ:** Механизм передачи потенциальных сообщений из Data Bus Context в Dialog Context и алгоритм финальной валидации будут детализированы при проектировании компонентов.

---

## 8. Workspace Isolation

### 8.1 Multi-tenant на уровне YDB

> **📌 ВАЖНО О ПОЛЬЗОВАТЕЛЯХ И WORKSPACE:** Один пользователь может входить в несколько workspace. Пользователь получает свой уникальный идентификатор (user_uuid) при первой регистрации в боте, и затем присутствует во всех своих workspace под этим же идентификатором. Таким образом, связь многие-ко-многим: один пользователь → много workspace, один workspace → много пользователей.

**Каждая таблица использует `workspace_id` как partition key:**

```javascript
// content_bus
{
    workspace_id: "ws-123",  // Partition key
    user_uuid_source: "user-456",
    created_at: 1699999999,
    type: "raw",
    data: { ... }
}

// workspaces
{
    workspace_id: "ws-123",  // Partition key
    name: "Команда разработки",
    organization_id: "org-789",
    members: ["user-1", "user-2", "user-3"],
    created_at: 1699999999
}

// users
{
    user_uuid: "user-456",  // Partition key
    workspaces: ["ws-123", "ws-456"],
    telegram_id: 123456789,
    name: "Иван"
}
```

### 8.2 Batch обработка по workspace

```javascript
// Вариант 1: Отдельные batch для каждого workspace
for (const workspace of workspaces) {
    const members = await get_workspace_members(workspace.workspace_id);
    const content = await collect_content_for_workspace(workspace.workspace_id);
    const results = await batch_analyze_content(content);
    await distribute_results(members, results);
}

// Вариант 2: Общий batch, но с изоляцией результатов
// (можно, если LLM правильно обрабатывает workspace_id)
const all_content = await collect_content_for_all_workspaces();
const results = await batch_analyze_content(all_content); // Один AI запрос
// results содержат workspace_id → распределяем обратно
await distribute_results_by_workspace(results);
```

**Решение:** Вариант 2 (общий batch) - экономия AI токенов, но требует тщательной проверки изоляции результатов.

---

## 9. Модули (ориентировочно, может уточняться)

### Core Modules

#### ContentBus
- **Назначение:** Управление информационным потоком (raw/processed)
- **Функции:**
  - `save_raw_dialog_record()` - сохранение сырого диалога
  - `collect_content_for_users()` - сбор новых raw записей
  - `batch_analyze_content()` - AI обработка batch
  - `accumulate_batch_results()` - распределение результатов
  - `collect_all_user_news()` - сбор накопленных новостей
  - `move_all_news_to_history()` - перенос после отправки

#### DialogSystem
- **Назначение:** LLM-powered диалоги с инструментами
- **Функции:**
  - `invoke()` - обработка сообщения пользователя
  - `invoke_with_instruction()` - обработка с заданной инструкцией
  - `getBufferHistory()` - получение истории диалога
  - `clearBuffer()` - очистка buffer после сохранения в ContentBus

#### WorkspaceManager
- **Назначение:** Управление workspace и участниками
- **Функции:**
  - `create_workspace()` - создание workspace
  - `add_member()` - добавление участника
  - `get_members()` - список участников
  - `update_member_role()` - обновление роли (lead/participant)

#### TimerHandler
- **Назначение:** Периодические задачи и batch обработка
- **Функции:**
  - `invoke()` - запуск по таймеру
  - `process_users_batch()` - batch обработка пользователей
  - `check_and_initiate_dialog()` - инициация диалога при неактивности

### Supporting Modules (могут уточняться)

- **NotificationSender** - отправка уведомлений участникам
- **AnalyticsCollector** - сбор метрик активности
- **OnboardingFlow** - онбординг новых пользователей

---

## 10. Чеклист для Developer

При реализации проверьте:

- [ ] **НЕ создавать Router** - он уже существует в dispatcher
- [ ] **Entry points:** только `process` и `reg_dispatcher_handlers`
- [ ] **Queue pattern:** всегда через @dieugene/queuer для AI обработки
- [ ] **Session lock:** через @dieugene/sessions (один запрос на пользователя)
- [ ] **ContentBus:** raw/processed типы, НЕ жесткая типизация
- [ ] **Batch AI:** один запрос для многих пользователей
- [ ] **Context tracking:** previous_notifications для избежания дублирования
- [ ] **Watermark:** last_processed_date для пропуска уже обработанного
- [ ] **Workspace isolation:** workspace_id как partition key в YDB
- [ ] **@dieugene пакеты:** использовать везде, где возможно

---

**Status:** ⏳ Требует review после изучения legacy
**Next step:** Переписать data-flow.md с учетом LLM-driven routing
