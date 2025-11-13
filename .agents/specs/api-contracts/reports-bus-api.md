# API Contract: ReportsBus Module

**Модуль:** ReportsBus (ContentBus v2.0)
**Файл:** `src/modules/reports-bus.js`
**Версия:** 2.0.0
**Статус:** 📝 Draft

---

## Обзор

ReportsBus предоставляет два уровня API:

1. **High-level API** - для использования другими модулями (TimerHandler, DialogSystem)
2. **Low-level API (Dao)** - для внутреннего использования модулем

---

## Table of Contents

1. [High-level API](#high-level-api)
   - [process_dialog_completion](#process_dialog_completion)
   - [collect_content_for_users](#collect_content_for_users)
   - [batch_analyze_content](#batch_analyze_content)
   - [accumulate_batch_results](#accumulate_batch_results)
   - [collect_all_user_news](#collect_all_user_news)
   - [move_all_news_to_history](#move_all_news_to_history)
   - [check_and_create_missing_raw_record](#check_and_create_missing_raw_record)

2. [Low-level API (Dao)](#low-level-api-dao)
   - [init](#dao-init)
   - [add_raw_record](#dao-add_raw_record)
   - [get_raw_records_after_date](#dao-get_raw_records_after_date)
   - [get_processed_record](#dao-get_processed_record)
   - [add_processed_record](#dao-add_processed_record)
   - [delete_processed_record](#dao-delete_processed_record)
   - [get_user_last_raw_record](#dao-get_user_last_raw_record)

3. [Типы данных](#типы-данных)
4. [Коды ошибок](#коды-ошибок)

---

## High-level API

### process_dialog_completion

Сохранение raw записи после завершения диалога с пользователем.

#### Сигнатура

```javascript
async function process_dialog_completion(workspace_id, user_uuid, dialog)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |
| `dialog` | Dialog | ✅ | Экземпляр @dialogai/dialog-class |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `false` при ошибке

#### Описание

1. Получает буферную историю из dialog
2. Если история пуста → возвращает `true` (не ошибка)
3. Формирует `dialog_text` через `getBufferHistoryText()`
4. Получает данные пользователя (имя)
5. Сохраняет raw запись в YDB
6. Очищает buffer: `dialog.clearBuffer()`
7. Emit событие `'raw_saved'`

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');
const { get_dialog } = require('./dialog-system');

// В DialogSystem после завершения диалога
async function handleDialogEnd(workspace_id, user_uuid) {
    const dialog = await get_dialog(user_uuid);

    const success = await ReportsBus.process_dialog_completion(
        workspace_id,
        user_uuid,
        dialog
    );

    if (success) {
        console.log('✅ Dialog saved to ReportsBus');
    } else {
        console.error('❌ Failed to save dialog');
    }
}
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `BUFFER_EMPTY` | Буферная история пуста | Возвращает `true` (не ошибка) |
| `USER_NOT_FOUND` | Пользователь не найден | Логирует warning, возвращает `false` |
| `DB_ERROR` | Ошибка записи в YDB | Логирует error, возвращает `false` |

---

### collect_content_for_users

Сбор всех новых raw записей для batch AI-обработки.

#### Сигнатура

```javascript
async function collect_content_for_users(workspace_id, users_batch)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `users_batch` | Array<User> | ✅ | Массив пользователей (до 50) |

#### Возвращает

```javascript
Promise<{
    all_content_data: Array<ContentData>,
    user_mapping: Map<user_uuid, Array<source_uuid>>
}>
```

**ContentData:**
```javascript
{
    source_user_uuid: String,
    source_user_name: String,
    previous_notifications: Array<String>,
    new_raw_records: Array<{
        session_date: String,      // YYYY-MM-DD
        dialog_text: String,
        created_at: Number
    }>,
    last_processed_date: Number
}
```

#### Описание

1. Для каждого пользователя в `users_batch`:
   - Получает всех участников workspace
   - Для каждого участника (source):
     - Получает processed record
     - Получает новые raw records после `last_processed_date`
     - Если новых записей нет → пропускает
2. Формирует `user_mapping` для обратного применения результатов
3. Возвращает объединенный массив данных

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');
const users = require('@dieugene/users-controller');

// В TimerHandler
async function processBatch(workspace_id) {
    // Получаем пользователей workspace (до 50)
    const users_batch = await users.get_workspace_users(workspace_id, { limit: 50 });

    const { all_content_data, user_mapping } = await ReportsBus.collect_content_for_users(
        workspace_id,
        users_batch
    );

    console.log(`Собрано ${all_content_data.length} новых записей для обработки`);

    if (all_content_data.length === 0) {
        console.log('Нет новых данных для обработки');
        return;
    }

    // Продолжаем с batch_analyze_content...
}
```

---

### batch_analyze_content

Batch AI-обработка через Schema-Guided Reasoning.

#### Сигнатура

```javascript
async function batch_analyze_content(all_content_data)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `all_content_data` | Array<ContentData> | ✅ | Массив контента для анализа |

#### Возвращает

```javascript
Promise<Array<AnalysisResult>>
```

**AnalysisResult:**
```javascript
{
    source_user_uuid: String,
    target_users: Array<String>,          // [uuid1, uuid2, ...]
    message: String,                      // Сформированное сообщение
    classification: {
        activity_type: String,            // 'progress_update' | 'blocker' | 'question' | 'decision' | 'announcement'
        urgency: String,                  // 'low' | 'medium' | 'high'
        summary: String
    },
    entities: {
        mentioned_people: Array<String>,
        topics: Array<String>,
        dependencies: Array<String>
    }
}
```

#### Описание

Выполняет каскадную SGR-обработку в 4 этапа:

1. **Классификация** (gpt-5-mini) - определение типа активности и срочности
2. **Извлечение сущностей** (gpt-5-mini) - упоминания людей, темы, зависимости
3. **Определение релевантности** (gpt-5) - для кого релевантна информация
4. **Формирование сообщений** (gpt-5) - персонализированные тексты

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

async function processContent(all_content_data) {
    try {
        const ai_results = await ReportsBus.batch_analyze_content(all_content_data);

        console.log(`AI обработал ${ai_results.length} записей`);

        for (const result of ai_results) {
            console.log(`От: ${result.source_user_uuid}`);
            console.log(`Кому: ${result.target_users.join(', ')}`);
            console.log(`Тип: ${result.classification.activity_type}`);
            console.log(`Сообщение: ${result.message}`);
        }

        return ai_results;
    } catch (error) {
        console.error('AI обработка failed:', error);
        // Обработка ошибки (см. спецификацию edge cases)
        throw error;
    }
}
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `LLM_TIMEOUT` | Timeout при вызове LLM API | Retry 2 раза, затем установить `processing_failed: true` |
| `LLM_RATE_LIMIT` | Rate limit от OpenAI | Retry с exponential backoff |
| `INVALID_JSON` | LLM вернул невалидный JSON | Retry 1 раз, затем skip сообщение |
| `LLM_SERVICE_ERROR` | LLM API unavailable | Логировать error, установить флаг `processing_failed: true` |

---

### accumulate_batch_results

Применение результатов AI-анализа к processed records.

#### Сигнатура

```javascript
async function accumulate_batch_results(workspace_id, users_batch, user_mapping, ai_results)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `users_batch` | Array<User> | ✅ | Массив пользователей |
| `user_mapping` | Map | ✅ | Mapping user → sources |
| `ai_results` | Array<AnalysisResult> | ✅ | Результаты AI анализа |

#### Возвращает

`Promise<void>`

#### Описание

1. Для каждого пользователя в `users_batch`:
   - Получает список источников из `user_mapping`
   - Для каждого источника:
     - Находит соответствующий AI result
     - Получает текущий processed record
     - Добавляет новую новость в `news[]` array
     - Обновляет `last_processed_date` (watermark)
     - Сохраняет через Dao
2. Emit событие: `'batch_processed'`

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

async function applyResults(workspace_id, users_batch, user_mapping, ai_results) {
    await ReportsBus.accumulate_batch_results(
        workspace_id,
        users_batch,
        user_mapping,
        ai_results
    );

    console.log('✅ Результаты AI накоплены в processed records');
}
```

---

### collect_all_user_news

Сбор всех накопленных новостей пользователя (для проверки порога N).

#### Сигнатура

```javascript
async function collect_all_user_news(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<Array<String>>` - массив текстов новостей

#### Описание

1. Получает всех участников workspace
2. Для каждого участника:
   - Получает processed record
   - Извлекает `news[]` array
   - Добавляет в общий массив
3. Возвращает объединенный массив всех новостей

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

const THRESHOLD = 5; // Порог для отправки

async function checkThreshold(workspace_id, user_uuid) {
    const all_news = await ReportsBus.collect_all_user_news(workspace_id, user_uuid);

    console.log(`У пользователя ${user_uuid} накоплено ${all_news.length} новостей`);

    if (all_news.length >= THRESHOLD) {
        console.log('📬 Порог достигнут, отправляем новости пользователю');
        // NotificationRouter.send_news(user_uuid, all_news);
        await ReportsBus.move_all_news_to_history(workspace_id, user_uuid);
    } else {
        console.log('⏳ Накопление продолжается...');
    }
}
```

---

### move_all_news_to_history

Перенос всех накопленных новостей в notification_history после отправки.

#### Сигнатура

```javascript
async function move_all_news_to_history(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<void>`

#### Описание

1. Получает всех участников workspace
2. Для каждого участника:
   - Получает processed record
   - Переносит `news[]` → `notification_history[]`
   - Очищает `news[]`
   - Ограничивает `notification_history` (последние 10 записей)
   - Обновляет запись

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

async function sendNewsAndClean(workspace_id, user_uuid, all_news) {
    // 1. Отправляем новости
    await NotificationRouter.send_news(user_uuid, all_news);

    // 2. Переносим в историю
    await ReportsBus.move_all_news_to_history(workspace_id, user_uuid);

    console.log('✅ Новости отправлены и перенесены в историю');
}
```

---

### check_and_create_missing_raw_record

Проверка и создание "missing" raw записи при обнаружении "дыр".

#### Сигнатура

```javascript
async function check_and_create_missing_raw_record(workspace_id, user)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user` | User | ✅ | Объект пользователя с полями uuid, ping_info, telegram_id |

#### Возвращает

`Promise<void>`

#### Описание

1. Проверяет: `user.ping_info.last_shared_about_self > last_raw_created_at`?
2. Если ДА (есть "дыра"):
   - Получает dialog через `get_dialog(user_uuid)`
   - Вызывает `process_dialog_completion()`
   - Создает missing raw запись
3. Иначе: пропускает

**Зачем:** Иногда пользователь общается с ботом, но raw запись не создается (например, диалог не завершился корректно). Эта функция восстанавливает пропущенные записи.

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

// В TimerHandler перед batch обработкой
async function ensureNoMissingRecords(workspace_id, users_batch) {
    for (const user of users_batch) {
        await ReportsBus.check_and_create_missing_raw_record(workspace_id, user);
    }

    console.log('✅ Проверка missing records завершена');
}
```

---

## Low-level API (Dao)

### Dao.init

Инициализация подключения к YDB.

#### Сигнатура

```javascript
function init(database_url)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `database_url` | String | ❌ | URL базы данных (по умолчанию из env) |

#### Возвращает

`void`

#### Пример использования

```javascript
const { ReportsBus } = require('./modules/reports-bus');

// При старте функции
ReportsBus.init(process.env.GLOBAL_DB_ADDRESS);
```

---

### Dao.add_raw_record

Добавление raw записи в базу данных.

#### Сигнатура

```javascript
async function add_raw_record(workspace_id, user_uuid, data, created_at)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |
| `data` | Object | ✅ | Raw data (будет сериализован в JSON) |
| `created_at` | Number | ❌ | Timestamp (по умолчанию текущее время) |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

#### Data структура

```javascript
{
    type: 'raw',
    user_uuid: String,
    created_at: Number,
    dialog_text: String,
    user_name: String,
    session_date: String,        // YYYY-MM-DD
    workspace_id: String
}
```

#### Пример использования

```javascript
const I = require("@dieugene/utils");

const raw_data = {
    type: 'raw',
    user_uuid: user_uuid,
    created_at: I.get_seconds_now(),
    dialog_text: "Завершил работу над проектом X...",
    user_name: "Иван Петров",
    session_date: I.getDateISO().date,
    workspace_id: workspace_id
};

const success = await Dao.add_raw_record(
    workspace_id,
    user_uuid,
    raw_data,
    I.get_seconds_now()
);
```

---

### Dao.get_raw_records_after_date

Получение raw записей после указанной даты.

#### Сигнатура

```javascript
async function get_raw_records_after_date(workspace_id, user_uuid, after_date)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя (источника) |
| `after_date` | Number | ✅ | Timestamp в секундах |

#### Возвращает

`Promise<Array<RawRecord>>` - массив raw записей (отсортирован по created_at ASC)

#### Пример использования

```javascript
const last_processed = 1699999998;

const new_records = await Dao.get_raw_records_after_date(
    workspace_id,
    source_user_uuid,
    last_processed
);

console.log(`Найдено ${new_records.length} новых записей`);

for (const record of new_records) {
    console.log(`${record.data.session_date}: ${record.data.dialog_text}`);
}
```

---

### Dao.get_processed_record

Получение processed записи для пары (target, source).

#### Сигнатура

```javascript
async function get_processed_record(workspace_id, user_uuid_target, user_uuid_source)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid_target` | String | ✅ | UUID получателя |
| `user_uuid_source` | String | ✅ | UUID источника |

#### Возвращает

`Promise<Array<ProcessedRecord>>` - массив processed записей (обычно 0-1 запись)

#### Пример использования

```javascript
const records = await Dao.get_processed_record(
    workspace_id,
    user_uuid,         // кому
    source_uuid        // от кого
);

if (records.length > 0) {
    const latest = records[0];
    const news = latest.data.news || [];
    const history = latest.data.notification_history || [];
    const watermark = latest.data.last_processed_date || 0;

    console.log(`Накоплено новостей: ${news.length}`);
    console.log(`История: ${history.length}`);
    console.log(`Watermark: ${watermark}`);
}
```

---

### Dao.add_processed_record

Добавление/обновление processed записи.

#### Сигнатура

```javascript
async function add_processed_record(workspace_id, user_uuid_target, user_uuid_source, data)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid_target` | String | ✅ | UUID получателя |
| `user_uuid_source` | String | ✅ | UUID источника |
| `data` | Object | ✅ | Processed data (будет сериализован в JSON) |

#### Data структура

```javascript
{
    notification_history: Array<String>,   // Последние 10
    news: Array<String>,                   // Накопленные новости
    last_processed_date: Number,           // Watermark
    processing_version: String,            // "v2.0"
    workspace_id: String
}
```

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

#### Пример использования

```javascript
const I = require("@dieugene/utils");

const processed_data = {
    notification_history: ["Иван завершил проект X", "Мария начала тестирование"],
    news: ["Сергей столкнулся с проблемой API"],
    last_processed_date: I.get_seconds_now(),
    processing_version: "v2.0",
    workspace_id: workspace_id
};

await Dao.add_processed_record(
    workspace_id,
    user_uuid,      // кому
    source_uuid,    // от кого
    processed_data
);
```

---

### Dao.delete_processed_record

Удаление processed записи для пары (target, source).

#### Сигнатура

```javascript
async function delete_processed_record(workspace_id, user_uuid_target, user_uuid_source)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid_target` | String | ✅ | UUID получателя |
| `user_uuid_source` | String | ✅ | UUID источника |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

#### Пример использования

```javascript
// Обычно вызывается перед add_processed_record для обновления
await Dao.delete_processed_record(workspace_id, user_uuid, source_uuid);
await Dao.add_processed_record(workspace_id, user_uuid, source_uuid, new_data);
```

---

### Dao.get_user_last_raw_record

Получение последней raw записи пользователя.

#### Сигнатура

```javascript
async function get_user_last_raw_record(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<RawRecord | null>` - последняя raw запись или `null`

#### Пример использования

```javascript
const last_raw = await Dao.get_user_last_raw_record(workspace_id, user_uuid);

if (last_raw) {
    console.log(`Последняя активность: ${last_raw.data.session_date}`);
    console.log(`Created at: ${last_raw.created_at}`);
} else {
    console.log('У пользователя еще нет raw записей');
}
```

---

## Типы данных

### User

```typescript
interface User {
    uuid: string;
    telegram_id: number;
    ping_info?: {
        last_shared_about_self: number;  // timestamp
    };
    // ... другие поля из @dieugene/users-controller
}
```

### Dialog

```typescript
interface Dialog {
    getBufferHistory(): Promise<Array<Message>>;
    getBufferHistoryText(options: {
        ai_alias: string;
        user_alias: string;
    }): Promise<string>;
    clearBuffer(): Promise<void>;
    // ... другие методы из @dialogai/dialog-class
}
```

### ContentData

```typescript
interface ContentData {
    source_user_uuid: string;
    source_user_name: string;
    previous_notifications: string[];
    new_raw_records: Array<{
        session_date: string;     // YYYY-MM-DD
        dialog_text: string;
        created_at: number;
    }>;
    last_processed_date: number;
}
```

### AnalysisResult

```typescript
interface AnalysisResult {
    source_user_uuid: string;
    target_users: string[];
    message: string;
    classification: {
        activity_type: 'progress_update' | 'blocker' | 'question' | 'decision' | 'announcement';
        urgency: 'low' | 'medium' | 'high';
        summary: string;
    };
    entities: {
        mentioned_people: string[];
        topics: string[];
        dependencies: string[];
    };
}
```

### RawRecord

```typescript
interface RawRecord {
    workspace_id: string;
    user_uuid_source: string;
    created_at: number;
    type: 'raw';
    data: {
        type: 'raw';
        user_uuid: string;
        created_at: number;
        dialog_text: string;
        user_name: string;
        session_date: string;  // YYYY-MM-DD
        workspace_id: string;
    };
}
```

### ProcessedRecord

```typescript
interface ProcessedRecord {
    workspace_id: string;
    user_uuid_source: string;
    user_uuid_target: string;
    created_at: number;
    type: 'processed';
    data: {
        notification_history: string[];   // max 10
        news: string[];                   // накопленные
        last_processed_date: number;
        processing_version: string;       // "v2.0"
        workspace_id: string;
        processing_failed?: boolean;      // optional flag
    };
}
```

---

## Коды ошибок

### High-level API errors

| Код | HTTP эквивалент | Описание |
|-----|-----------------|----------|
| `BUFFER_EMPTY` | 200 OK | Буфер пуст (не ошибка, но информация) |
| `USER_NOT_FOUND` | 404 Not Found | Пользователь не найден |
| `WORKSPACE_NOT_FOUND` | 404 Not Found | Workspace не найден |
| `LLM_TIMEOUT` | 504 Gateway Timeout | Timeout при вызове LLM |
| `LLM_RATE_LIMIT` | 429 Too Many Requests | Rate limit от OpenAI |
| `LLM_SERVICE_ERROR` | 503 Service Unavailable | LLM API недоступен |
| `INVALID_JSON` | 422 Unprocessable Entity | LLM вернул невалидный JSON |

### Low-level API (Dao) errors

| Код | Описание |
|-----|----------|
| `DB_NOT_INIT` | YDB не инициализирован |
| `DB_QUERY_ERROR` | Ошибка выполнения запроса |
| `DB_PARSE_ERROR` | Ошибка парсинга JSON из базы |

---

## События (Events)

ReportsBus emit'ит следующие события:

### 'raw_saved'

Emit после успешного сохранения raw записи.

```javascript
{
    workspace_id: string,
    user_uuid: string,
    created_at: number
}
```

### 'batch_processed'

Emit после успешной batch обработки.

```javascript
{
    workspace_id: string,
    processed_count: number
}
```

### 'threshold_reached'

Emit когда накоплено достаточно новостей для отправки.

```javascript
{
    workspace_id: string,
    user_uuid: string,
    news_count: number
}
```

---

## Примеры полного workflow

### Пример 1: Сохранение диалога

```javascript
const { ReportsBus } = require('./modules/reports-bus');
const { get_dialog } = require('./dialog-system');

async function saveUserDialog(workspace_id, user_uuid) {
    // 1. Получаем dialog
    const dialog = await get_dialog(user_uuid);

    // 2. Сохраняем в ReportsBus
    const success = await ReportsBus.process_dialog_completion(
        workspace_id,
        user_uuid,
        dialog
    );

    return success;
}
```

### Пример 2: Batch обработка (Timer)

```javascript
const { ReportsBus } = require('./modules/reports-bus');
const users = require('@dieugene/users-controller');

async function dailyBatchProcessing(workspace_id) {
    // 1. Получаем пользователей
    const users_batch = await users.get_workspace_users(workspace_id, { limit: 50 });

    // 2. Проверяем missing records
    for (const user of users_batch) {
        await ReportsBus.check_and_create_missing_raw_record(workspace_id, user);
    }

    // 3. Собираем новый контент
    const { all_content_data, user_mapping } = await ReportsBus.collect_content_for_users(
        workspace_id,
        users_batch
    );

    if (all_content_data.length === 0) {
        console.log('Нет новых данных');
        return;
    }

    // 4. AI обработка
    const ai_results = await ReportsBus.batch_analyze_content(all_content_data);

    // 5. Накапливаем результаты
    await ReportsBus.accumulate_batch_results(
        workspace_id,
        users_batch,
        user_mapping,
        ai_results
    );

    // 6. Проверяем пороги и отправляем
    for (const user of users_batch) {
        const all_news = await ReportsBus.collect_all_user_news(workspace_id, user.uuid);

        if (all_news.length >= 5) {  // Порог
            // Отправляем через NotificationRouter
            await NotificationRouter.send_news(user.uuid, all_news);

            // Переносим в историю
            await ReportsBus.move_all_news_to_history(workspace_id, user.uuid);
        }
    }
}
```

---

**Status:** 📝 Draft - готов для review
**Next Step:** Developer реализует модуль согласно этому контракту
