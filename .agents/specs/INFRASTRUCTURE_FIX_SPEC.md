# Спецификация: Infrastructure Fix - Sessions, Queues, Cache

**Роль:** Architect
**Модуль:** Core Infrastructure (Entry Point)
**Версия:** 2.1.0
**Приоритет:** 🔴 КРИТИЧЕСКИЙ
**Estimated time:** 4-6 часов разработки

---

## 📋 Назначение

Исправить критические недостатки инфраструктуры текущего проекта путем внедрения:
1. Управления сессиями пользователей
2. Системы очередей для асинхронной обработки
3. Кэширования сообщений
4. Правильных версий пакетов

**Референс:** `reference-project/index.js` (mir-zdorovia-dialog-bot)

---

## 🎯 Цели

### Функциональные цели:
- ✅ Предотвратить параллельную обработку сообщений от одного пользователя
- ✅ Избежать Telegram webhook timeouts при долгой обработке
- ✅ Сохранить все сообщения пользователя, отправленные быстро подряд
- ✅ Обеспечить корректное завершение сессий при ошибках

### Нефункциональные цели:
- ✅ Соответствие проверенным паттернам из reference-project
- ✅ Готовность к production deployment
- ✅ Стабильная работа при высокой нагрузке

---

## 📦 Изменения в package.json

### Файл: `package.json`

**Добавить зависимости:**

```json
{
  "dependencies": {
    "@dieugene/sessions": "^2.0.0",
    "@dieugene/tg-messages-cache": "^2.0.0",
    "@dieugene/logger": "^1.0.3"
  }
}
```

**Обновить существующие зависимости:**

```json
{
  "dependencies": {
    "@dieugene/queuer": "^2.0.0",         // было: ^1.0.0
    "@dieugene/users-controller": "^1.0.26", // было: ^1.0.0
    "@dieugene/utils": "^1.14.0",         // было: ^1.16.3
    "telegraf": "^4.15.3"                 // было: ^4.12.0
  }
}
```

**Итоговый `package.json`:**

```json
{
  "name": "kak-dela-dialog-bot",
  "version": "2.1.0",
  "description": "AI-powered dialog bot for team monitoring and reporting",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "keywords": [
    "telegram",
    "bot",
    "ai",
    "monitoring",
    "team"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@dieugene/logger": "^1.0.3",
    "@dieugene/queuer": "^2.0.0",
    "@dieugene/sessions": "^2.0.0",
    "@dieugene/tg-messages-cache": "^2.0.0",
    "@dieugene/users-controller": "^1.0.26",
    "@dieugene/utils": "^1.14.0",
    "@langchain/openai": "latest",
    "date-fns": "^2.30.0",
    "telegraf": "^4.15.3",
    "ydb-sdk": "^5.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "jest": "^29.7.0"
  }
}
```

---

## 🔧 Изменения в index.js

### 1. Добавить импорты (в начало файла, после существующих)

**Местоположение:** После строки 11 (`const I = require("@dieugene/utils");`)

```javascript
const sessions = require('@dieugene/sessions');
const tg_cache = require("@dieugene/tg-messages-cache");
const queuer = require("@dieugene/queuer")();
```

**Обновить существующий импорт logger:**

```javascript
// Было:
// const logger = require("@dieugene/logger")(bot_domain);

// Стало:
const logger = require("@dieugene/logger")(bot_domain);
```

### 2. Инициализация модулей

**Местоположение:** После строки 33 (`users.init();`)

```javascript
users.init();
// Добавить:
I.updateStringPrototype(); // если еще нет
```

### 3. Создать функцию process_user_message()

**Местоположение:** Перед `module.exports.process` (вставить ~строка 340)

```javascript
/**
 * Process user message with session management and queue
 *
 * @param {Context} ctx - Telegraf context
 * @param {Object} data - Additional data
 * @param {string} bot_token - Bot token
 */
async function process_user_message(ctx, data = {}, bot_token) {
    // Проверяем, пришло ли сообщение из очереди
    if (!queuer.is_from_queue(input)) {
        // НЕ ИЗ ОЧЕРЕДИ - отправляем в очередь

        // 1. Создаем placeholder для индикации обработки
        let placeholder_message_id = await tg_cache.put_placeholder(ctx);
        console.log('[PROCESS_MESSAGE] NOT FROM QUEUE :: Checking session');

        // 2. Проверяем, активна ли сессия пользователя
        let user_uuid = await users.tg.get_user_uuid(ctx);
        let session_in_progress = !(await sessions.is_finished(user_uuid));

        if (session_in_progress) {
            // Сессия активна - показываем "подождите"
            console.log('[PROCESS_MESSAGE] Session in progress, showing wait message');
            try {
                return await ctx.editMessageText(
                    '⏳ Пожалуйста, подождите. Обрабатываю предыдущий запрос...',
                    { message_id: placeholder_message_id, parse_mode: 'HTML' }
                );
            } catch (e) {
                I.log_error(e, 'process_user_message.ctx.editMessageText');
                return await ctx.replyWithHTML('⏳ Пожалуйста, подождите. Обрабатываю предыдущий запрос...');
            }
        }

        // 3. Запускаем новую сессию
        console.log('[PROCESS_MESSAGE] Starting new session');
        data.placeholder_message_id = placeholder_message_id;
        await tg_cache.cache_and_show_progress(ctx, data);
        await sessions.start(user_uuid);

        // 4. Отправляем в очередь для обработки
        console.log('[PROCESS_MESSAGE] Sending to queue');
        I.tg.is_typing(ctx, 10);
        return await queuer.send_to_queue(input, bot_token, process.env.QUEUE_URL, bot_domain);
    }

    // ИЗ ОЧЕРЕДИ - обрабатываем сообщение
    console.log('[PROCESS_MESSAGE] Processing from queue');

    // 1. Получаем накопленный кэш сообщений
    let cache = await tg_cache.get(ctx);
    console.log('[PROCESS_MESSAGE] Cache retrieved:', JSON.stringify(cache));

    if (I.arr.isEmpty(cache)) {
        logger.critical('CACHE IS EMPTY', { ctx: I.tg.get.ctx_copy(ctx) });
    }

    // 2. Получаем placeholder message ID
    let placeholder_message_id = await tg_cache.get_placeholder_message_id(ctx, cache);

    // 3. Удаляем кэш
    await tg_cache.del(ctx);

    // 4. Обрабатываем диалог
    await processDialog(ctx, tg_cache.exclude_placeholder(cache), placeholder_message_id);
}

/**
 * Process dialog with user message(s)
 *
 * @param {Context} ctx - Telegraf context
 * @param {Array|string} cache - Cached messages or single message
 * @param {number} placeholder_message_id - Placeholder message to edit
 */
async function processDialog(ctx, cache, placeholder_message_id) {
    I.tg.is_typing(ctx, 10);

    try {
        const user_uuid = await users.tg.get_user_uuid(ctx);
        const workspace_id = 'ws-default'; // TODO: Get active workspace

        // Если кэш - массив, объединяем в одно сообщение
        let message_text = cache;
        if (Array.isArray(cache)) {
            message_text = cache.map(c => c.text || c).join('\n');
        }

        console.log('[PROCESS_DIALOG] Creating dialog for user:', user_uuid);

        // Create or get dialog
        const dialog = DialogSystem.create_dialog(user_uuid, workspace_id);

        console.log('[PROCESS_DIALOG] Processing message:', message_text);

        // Process message
        const response = await dialog.process_user_message(message_text);

        console.log('[PROCESS_DIALOG] Got response, sending to user');

        // Send response
        if (placeholder_message_id) {
            // Edit placeholder if exists
            try {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    placeholder_message_id,
                    null,
                    response,
                    { parse_mode: 'HTML' }
                );
            } catch (e) {
                // If edit fails, send new message
                I.log_error(e, 'processDialog.editMessageText');
                await ctx.reply(response);
            }
        } else {
            await ctx.reply(response);
        }

        // Завершаем сессию ОБЯЗАТЕЛЬНО
        await sessions.finish(user_uuid);
        console.log('[PROCESS_DIALOG] Session finished successfully');

    } catch (e) {
        I.log_error(e, 'processDialog');

        // Завершаем сессию даже при ошибке
        const user_uuid = await users.tg.get_user_uuid(ctx);
        await sessions.finish(user_uuid);

        await ctx.reply('❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.');
    }
}
```

### 4. Изменить обработчик bot.on('text')

**Местоположение:** Строки 294-314

**Было:**
```javascript
bot.on('text', async (ctx) => {
    console.log('[BOT] TEXT:', ctx.message.text);

    try {
        const user_uuid = await users.tg.get_user_uuid(ctx);
        const workspace_id = 'ws-default'; // TODO: Get active workspace

        // Create or get dialog
        const dialog = DialogSystem.create_dialog(user_uuid, workspace_id);

        // Process message
        const response = await dialog.process_user_message(ctx.message.text);

        // Send response
        await ctx.reply(response);

    } catch (e) {
        I.log_error(e, 'text message handler');
        await ctx.reply('Произошла ошибка при обработке сообщения.');
    }
});
```

**Стало:**
```javascript
bot.on('text', async (ctx) => {
    console.log('[BOT] TEXT:', ctx.message.text);

    if (process.env.ENV === 'STOPPED') {
        return await ctx.reply('Бот временно остановлен для обновления.');
    }

    try {
        await process_user_message(ctx, {}, bot_token);
    } catch (e) {
        I.log_error(e, 'text message handler');

        // Ensure session is finished on error
        try {
            const user_uuid = await users.tg.get_user_uuid(ctx);
            await sessions.finish(user_uuid);
        } catch (sessionError) {
            I.log_error(sessionError, 'Failed to finish session on error');
        }

        await ctx.reply('❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.');
    }
});
```

### 5. Изменить обработчик bot.on('voice')

**Местоположение:** Строки 316-338

**Заменить весь блок на:**
```javascript
/**
 * Voice messages - Placeholder for voice-to-text processing
 */
bot.on('voice', async (ctx) => {
    console.log('[BOT] VOICE message received');

    if (process.env.ENV === 'STOPPED') {
        return await ctx.reply('Бот временно остановлен для обновления.');
    }

    // Check if from queue to avoid duplicate processing
    if (!queuer.is_from_queue(input)) {
        await ctx.reply('🎤 Голосовые сообщения пока не поддерживаются. Пожалуйста, отправьте текстовое сообщение.');
        return;
    }

    // TODO: Implement voice-to-text processing with @dieugene/voicer
    // For now, just reply with placeholder
    await ctx.reply('🎤 Распознавание голосовых сообщений будет добавлено в следующей версии.');
});
```

### 6. Исправить error handler в module.exports.process

**Местоположение:** Строки 362-386

**Было:**
```javascript
try {
    await bot.handleUpdate(inputData.data.object);

} catch (e) {
    const user_uuid = await users.tg.get_user_uuid(bot_id, user_id);
    logger.critical('FATAL ERROR', { message: e.message, stack: e.stack }, inputData);
    I.log_error(e, bot_domain + ':: FATAL');

    // Try to notify user
    const chatData = I.findObjectElement(inputData.data.object, 'chat');
    if (chatData) {
        // ...
    }
}
```

**Стало:**
```javascript
try {
    await bot.handleUpdate(inputData.data.object);

} catch (e) {
    const user_uuid = await users.tg.get_user_uuid(bot_id, user_id);

    // КРИТИЧНО: Завершить сессию при ошибке
    try {
        await sessions.finish(user_uuid);
        console.log('[PROCESS] Session finished after error for user:', user_uuid);
    } catch (sessionError) {
        I.log_error(sessionError, 'Failed to finish session on fatal error');
    }

    logger.critical('FATAL ERROR', { message: e.message, stack: e.stack }, inputData);
    I.log_error(e, bot_domain + ':: FATAL');

    // Try to notify user
    const chatData = I.findObjectElement(inputData.data.object, 'chat');
    if (chatData) {
        try {
            await bot.telegram.sendMessage(
                chatData.id,
                `⚠️ Возникла ошибка при обработке запроса.\n\n` +
                `Информация направлена разработчикам.\n` +
                `Попробуйте другой запрос или повторите позже.`,
                { parse_mode: 'HTML' }
            );
        } catch (notifyError) {
            console.error('[PROCESS] Failed to notify user:', notifyError);
        }
    }
}
```

---

## 🌍 Environment Variables

**Добавить в Yandex Cloud Functions environment:**

```bash
# Existing
TELEGRAM_BOT_TOKEN=<bot-token>
BOT_NAME=kak-dela-bot
YDB_ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135
YDB_DATABASE=/ru-central1/.../...
OPENAI_API_KEY=<openai-key>
ENV=production

# NEW - Required for queue processing
QUEUE_URL=https://message-queue.api.cloud.yandex.net/b1g.../dj6.../kak-dela-queue
```

**Где получить QUEUE_URL:**
1. Yandex Cloud Console → Message Queue
2. Создать очередь `kak-dela-queue`
3. Скопировать URL очереди

---

## 🔄 Data Flow (после исправлений)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Telegram webhook → module.exports.process(inputData)     │
│    ↓                                                          │
│ 2. bot.handleUpdate(inputData.data.object)                   │
│    ↓                                                          │
│ 3. bot.on('text') → process_user_message(ctx)               │
│    ↓                                                          │
│ 4. queuer.is_from_queue(input)?                             │
│    │                                                          │
│    ├─ FALSE (не из очереди):                                │
│    │  ├─ sessions.is_finished(uuid)?                        │
│    │  │  ├─ FALSE → "Подождите..."                          │
│    │  │  └─ TRUE:                                            │
│    │  │     ├─ tg_cache.put_placeholder()                   │
│    │  │     ├─ tg_cache.cache_and_show_progress()           │
│    │  │     ├─ sessions.start(uuid)                         │
│    │  │     └─ queuer.send_to_queue() → Message Queue       │
│    │  └─ return (webhook завершается быстро)                │
│    │                                                          │
│    └─ TRUE (из очереди):                                    │
│       ├─ cache = tg_cache.get(ctx)                          │
│       ├─ placeholder_id = tg_cache.get_placeholder_id()     │
│       ├─ tg_cache.del(ctx)                                   │
│       ├─ processDialog(ctx, cache, placeholder_id):         │
│       │  ├─ dialog = DialogSystem.create_dialog()           │
│       │  ├─ response = dialog.process_user_message(cache)   │
│       │  ├─ ctx.telegram.editMessageText(placeholder_id)    │
│       │  └─ sessions.finish(uuid) ← ОБЯЗАТЕЛЬНО!            │
│       └─ return                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 Требования к тестам

### Unit-тесты (Developer должен написать):

1. **Test: Session management**
   - Проверить: если сессия активна, пользователь получает "подождите"
   - Проверить: сессия завершается после обработки
   - Проверить: сессия завершается при ошибке

2. **Test: Queue processing**
   - Проверить: сообщение не из очереди отправляется в очередь
   - Проверить: сообщение из очереди обрабатывается

3. **Test: Message caching**
   - Проверить: несколько сообщений кэшируются
   - Проверить: кэш удаляется после обработки

4. **Test: Error handling**
   - Проверить: sessions.finish() вызывается при ошибке
   - Проверить: пользователь получает сообщение об ошибке

### Integration тесты (Tester должен написать):

1. **Test: Rapid messages**
   - Отправить 3 сообщения подряд быстро
   - Проверить: первое обрабатывается, остальные ждут
   - Проверить: все обрабатываются по порядку

2. **Test: Error recovery**
   - Вызвать ошибку в processDialog
   - Проверить: сессия завершается
   - Проверить: следующее сообщение обрабатывается нормально

3. **Test: Long processing**
   - Отправить сообщение, которое обрабатывается долго (>15 сек)
   - Проверить: webhook не timeout
   - Проверить: ответ приходит через Message Queue

---

## ⚠️ Границы ответственности

### Этот модуль отвечает за:
- ✅ Управление сессиями пользователей
- ✅ Отправку сообщений в Message Queue
- ✅ Обработку сообщений из Message Queue
- ✅ Кэширование сообщений
- ✅ Корректное завершение сессий

### Этот модуль НЕ отвечает за:
- ❌ Обработку бизнес-логики (это делает DialogSystem)
- ❌ Хранение данных (это делает ReportsBus, WorkspaceManager)
- ❌ AI processing (это делает DialogSystem)

---

## 📝 Примечания для Developer

### Важные моменты:

1. **ВСЕГДА** вызывать `sessions.finish(user_uuid)`:
   - После успешной обработки
   - В catch блоках при ошибках
   - Это критично для предотвращения зависших сессий

2. **НЕ** обрабатывать сообщения синхронно в webhook:
   - Всегда проверять `queuer.is_from_queue(input)`
   - Если не из очереди → отправить в очередь
   - Если из очереди → обработать

3. **Использовать** placeholder для UX:
   - `tg_cache.put_placeholder()` сразу после получения сообщения
   - Редактировать placeholder после обработки
   - Если редактирование не удалось → отправить новое сообщение

4. **Референс код:**
   - `reference-project/index.js` строки 249-296
   - Следовать той же структуре и логике

---

## 🎯 Acceptance Criteria (Architect приемка)

### Функциональные критерии:

- [ ] Установлены правильные версии всех пакетов
- [ ] Реализована функция `process_user_message()`
- [ ] Реализована функция `processDialog()`
- [ ] Изменен обработчик `bot.on('text')`
- [ ] Исправлен error handler с `sessions.finish()`
- [ ] Добавлены все необходимые импорты
- [ ] Обработчик `bot.on('voice')` адаптирован

### Нефункциональные критерии:

- [ ] Код соответствует стилю reference-project
- [ ] Нет дублирования логики
- [ ] Все console.log сообщения информативны
- [ ] Error handling comprehensive

### Тестовые критерии:

- [ ] Все unit-тесты написаны и проходят
- [ ] Rapid messages test проходит
- [ ] Error recovery test проходит
- [ ] Long processing test проходит

---

## 📚 Референсы

### Основной референс:
- **Файл:** `reference-project/index.js`
- **Функции:**
  - `process_user_message()` (строки 249-283)
  - `processDialog()` (строки 285-295)
  - `module.exports.process` (строки 182-207)

### API Documentation:

**@dieugene/sessions:**
```javascript
await sessions.start(user_uuid);      // Начать сессию
await sessions.is_finished(user_uuid); // Проверить завершена ли сессия (returns Promise<boolean>)
await sessions.finish(user_uuid);     // Завершить сессию
```

**@dieugene/tg-messages-cache:**
```javascript
let msg_id = await tg_cache.put_placeholder(ctx);        // Создать placeholder
await tg_cache.cache_and_show_progress(ctx, data);       // Кэшировать и показать прогресс
let cache = await tg_cache.get(ctx);                     // Получить кэш
let placeholder_id = await tg_cache.get_placeholder_message_id(ctx, cache); // Получить placeholder ID
await tg_cache.del(ctx);                                 // Удалить кэш
let messages = tg_cache.exclude_placeholder(cache);      // Исключить placeholder из кэша
```

**@dieugene/queuer:**
```javascript
let is_from_queue = queuer.is_from_queue(input);         // Проверить, пришло ли из очереди
await queuer.send_to_queue(input, bot_token, queue_url, bot_domain); // Отправить в очередь
```

---

**Architect:** Claude
**Status:** ✅ Готово к передаче Developer
**Next Step:** Developer реализует спецификацию
**Review Required:** Yes (Reviewer)
**Test Required:** Yes (Tester)
