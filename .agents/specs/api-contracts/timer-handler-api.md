# API Contract: TimerHandler Module v1.0.0

**Module:** TimerHandler
**Version:** 1.0.0
**Phase:** Phase 2 - Priority 1
**Created:** 2025-11-09

---

## Table of Contents

1. [Overview](#overview)
2. [Module Exports](#module-exports)
3. [Queues API](#queues-api)
4. [TimerHandler API](#timerhandler-api)
5. [Helper Functions](#helper-functions)
6. [Data Types](#data-types)
7. [Error Handling](#error-handling)
8. [Usage Examples](#usage-examples)

---

## 1. Overview

TimerHandler модуль обеспечивает периодическую batch обработку пользователей через Yandex Message Queue. Модуль интегрируется с ReportsBus, DialogSystem и WorkspaceManager для автоматической обработки, отправки новостей и проактивной инициации диалогов.

**Основные концепции:**
- Queue Pattern (Yandex Message Queue)
- Batch Processing (до 50 пользователей)
- Threshold-based Delivery (отправка при N новостей)
- Proactive Dialog Initiation

---

## 2. Module Exports

```javascript
module.exports = {
    // Queue Management
    Queues,

    // TimerHandler Core
    TimerHandler
};
```

---

## 3. Queues API

### 3.1 Queues Object Structure

```javascript
const Queues = {
    post: async function(action, ...data),
    accept: async function(item),
    add_handler: function(action, handler),
    is_relevant_queue: function(input)
};
```

---

### 3.2 Queues.post()

**Назначение:** Отправка сообщения в Yandex Message Queue для асинхронной обработки

**Сигнатура:**
```javascript
async function post(action, ...data)
```

**Параметры:**
- `action` (String, required) — имя действия ('process_users')
- `...data` (Any, optional) — дополнительные параметры для handler

**Возвращает:** `Promise<void>`

**Алгоритм:**
1. Формирование payload: `{ action, data }`
2. Использование `queuer.post()` для отправки в queue
3. Логирование отправки

**Throws:**
- `Error` — если queue недоступен

**Примеры:**

```javascript
// Отправка следующего batch для обработки
await Queues.post('process_users', 50);
```

**Поведение:**
- Автоматический retry (3 попытки) при ошибке
- Exponential backoff: 1s, 2s, 4s

---

### 3.3 Queues.accept()

**Назначение:** Обработка входящего сообщения из Message Queue

**Сигнатура:**
```javascript
async function accept(item)
```

**Параметры:**
- `item` (Object, required) — сообщение из queue
  - `item.body` (String) — JSON string с payload
  - `item.MessageId` (String) — ID сообщения

**Возвращает:** `Promise<Object>`
- `{ success: true, result: Any }` — успешная обработка
- `{ success: false, error: String }` — ошибка

**Алгоритм:**
1. Проверка источника: `is_relevant_queue(item)`
2. Parse item.body → JSON
3. Поиск handler по action
4. Вызов handler с data
5. Возврат результата

**Throws:**
- НЕ выбрасывает (обработка внутри)

**Примеры:**

```javascript
// Обработка сообщения из queue
const item = {
    body: JSON.stringify({ action: 'process_users', data: [50] }),
    MessageId: 'msg-12345'
};

const result = await Queues.accept(item);
// result = { success: true, result: "User batch processing is finished" }
```

**Поведение:**
- Если action не найден → возврат `{ success: false, error: 'Unknown action' }`
- Если handler выбросил ошибку → возврат `{ success: false, error: error.message }`

---

### 3.4 Queues.add_handler()

**Назначение:** Регистрация handler для определенного action

**Сигнатура:**
```javascript
function add_handler(action, handler)
```

**Параметры:**
- `action` (String, required) — имя действия
- `handler` (Function, required) — async функция-обработчик

**Возвращает:** `void`

**Примеры:**

```javascript
// Регистрация handler для process_users
Queues.add_handler('process_users', async (limit) => {
    return await TimerHandler.process_users(limit);
});
```

**Поведение:**
- Handlers хранятся в Map
- При повторной регистрации — перезапись

---

### 3.5 Queues.is_relevant_queue()

**Назначение:** Проверка, что сообщение из корректного queue источника

**Сигнатура:**
```javascript
function is_relevant_queue(input)
```

**Параметры:**
- `input` (Object, required) — входящий item

**Возвращает:** `Boolean`
- `true` — источник корректный
- `false` — источник некорректный

**Примеры:**

```javascript
const is_valid = Queues.is_relevant_queue(item);
if (!is_valid) {
    console.log('Message from unknown queue');
}
```

**Поведение:**
- Проверка через `queuer.is_relevant_queue(input)`
- Используется в `accept()` для валидации

---

## 4. TimerHandler API

### 4.1 TimerHandler Object Structure

```javascript
const TimerHandler = {
    invoke: async function(),
    process_users: async function(limit = 50)
};
```

---

### 4.2 TimerHandler.invoke()

**Назначение:** Entry point для таймерного триггера (Yandex Cloud Functions Timer)

**Сигнатура:**
```javascript
async function invoke()
```

**Параметры:** Нет

**Возвращает:** `Promise<String>` — "Timer handler is invoked"

**Алгоритм:**
1. Инициализация processing: `users.processing.init()`
2. Сброс флагов обработки: `users.tg.start_user_processing()`
3. Отправка в queue: `Queues.post('process_users', 50)`
4. Возврат success message

**Throws:**
- `Error` — если queue недоступен

**Примеры:**

```javascript
// Cloud Functions handler
export async function handler(event, context) {
    const result = await TimerHandler.invoke();
    return { statusCode: 200, body: result };
}
```

**Поведение:**
- Вызывается по таймеру (ежедневно в 09:00)
- Запускает цепочку batch обработки через queue
- Не блокируется на обработку — делегирует в queue

**Integration Points:**
- `users.processing.init()` — инициализация Redis storage
- `users.tg.start_user_processing()` — сброс `is_being_processed` флагов
- `Queues.post('process_users', 50)` — старт обработки

---

### 4.3 TimerHandler.process_users()

**Назначение:** Batch обработка пользователей — сбор, AI обработка, отправка новостей, проактивные диалоги

**Сигнатура:**
```javascript
async function process_users(limit = 50)
```

**Параметры:**
- `limit` (Number, optional, default=50) — максимальный размер batch

**Возвращает:** `Promise<String>`
- "User batch processing is finished" — batch обработан, следующий batch в queue
- "All users are processed" — все пользователи обработаны

**Алгоритм:**

**ЭТАП 1: Получение batch**
```javascript
const uuid_batch = await users.tg.get_next_batch(limit);
if (!uuid_batch || uuid_batch.length === 0) {
    return "All users are processed";
}
const users_batch = await users.get_user_data_list(uuid_batch);
```

**ЭТАП 2: Автокоррекция missing raw records**
```javascript
for (const user of users_batch) {
    await ReportsBus.check_and_create_missing_raw_record(workspace_id, user);
}
```

**ЭТАП 3: Сбор контента для batch AI**
```javascript
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
const { all_content_data, user_mapping } =
    await ReportsBus.collect_content_for_users(workspace_id, users_batch, members);
```

**ЭТАП 4: Batch AI обработка**
```javascript
const ai_results = await ReportsBus.batch_analyze_content(all_content_data);
```

**ЭТАП 5: Применение результатов**
```javascript
await ReportsBus.accumulate_batch_results(
    workspace_id,
    users_batch,
    user_mapping,
    ai_results
);
```

**ЭТАП 6: Threshold check и отправка новостей**
```javascript
for (const user of users_batch) {
    const all_news = await ReportsBus.collect_all_user_news(workspace_id, user.uuid);

    if (all_news.length >= NEWS_THRESHOLD) {
        await send_news_to_user(user, all_news);
        await ReportsBus.move_all_news_to_history(workspace_id, user.uuid);
    }

    await check_and_initiate_dialog(user);
}
```

**ЭТАП 7: Cleanup и следующий batch**
```javascript
await users.processing.del(uuid_batch);
await users.set_user_data_list(users_batch);
await Queues.post('process_users', limit);
```

**Throws:**
- НЕ выбрасывает — все ошибки логируются, процесс продолжается

**Примеры:**

```javascript
// Обработка 50 пользователей
await TimerHandler.process_users(50);

// Обработка 10 пользователей (для тестирования)
await TimerHandler.process_users(10);
```

**Error Handling:**
- Если batch AI failed → пропустить ЭТАП 5, продолжить с ЭТАП 6
- Если send_news failed → логировать, продолжить с другими users
- Если queue post failed → retry 3 раза, затем завершить (следующий timer запуск попробует)

**Performance:**
- Batch size: до 50 users
- Timeout delay: 100ms между users
- Расчетное время: ~5-10 секунд на batch (зависит от AI)

**Integration Points:**
- `users.tg.get_next_batch(limit)` — получение UUID batch
- `users.get_user_data_list(uuids)` — загрузка user data
- `ReportsBus.*` — все методы batch AI
- `WorkspaceManager.get_all_workspace_members()` — получение контекста
- `DialogSystem.get_dialog()` — создание диалогов
- `users.set_user_data_list()` — сохранение изменений

---

## 5. Helper Functions

### 5.1 send_news_to_user()

**Назначение:** Отправка накопленных новостей пользователю через LLM диалог и Telegram

**Сигнатура:**
```javascript
async function send_news_to_user(user, news_array)
```

**Параметры:**
- `user` (Object, required) — объект пользователя
  - `user.uuid` (String) — UUID пользователя
  - `user.telegram_id` (Number) — Telegram ID
  - `user.workspace_id` (String) — workspace ID
- `news_array` (Array<String>, required) — массив новостей

**Возвращает:** `Promise<void>`

**Алгоритм:**
1. Получение диалога: `DialogSystem.get_dialog(user_uuid, workspace_id)`
2. Формирование news_message:
   ```
   У меня есть свежие новости о твоих друзьях:
   {news[0]}
   {news[1]}
   ...
   Если у вас есть свои новости, не стесняйтесь делиться.
   ```
3. Создание instruction для LLM
4. Вызов: `dialog.invoke_with_instruction(instruction)`
5. Отправка через Telegram: `Bot.replyWithHTML(message, user.telegram_id)`
6. Обновление: `user.ping_info.last_received_news = now`

**Throws:**
- НЕ выбрасывает — все ошибки логируются

**Примеры:**

```javascript
const news = [
    "Иван рассказал о новом проекте",
    "Мария получила повышение"
];
await send_news_to_user(user, news);
```

**Error Handling:**
- Если Telegram API failed → НЕ обновлять last_received_news (попытка в следующий раз)
- Если dialog failed → логировать, продолжить

---

### 5.2 check_and_initiate_dialog()

**Назначение:** Проверка необходимости проактивного диалога на основе активности пользователя

**Сигнатура:**
```javascript
async function check_and_initiate_dialog(user)
```

**Параметры:**
- `user` (Object, required) — объект пользователя
  - `user.ping_info.last_notification` (Number) — timestamp последнего уведомления
  - `user.ping_info.last_shared_about_self` (Number) — timestamp последнего sharing
  - `user.ping_info.missed_notifications` (Number) — счетчик пропущенных

**Возвращает:** `Promise<void>`

**Алгоритм:**

**Инициализация:**
```javascript
if (!user.ping_info) user.ping_info = {};
const last_notification = user.ping_info.last_notification || 0;
const last_shared = user.ping_info.last_shared_about_self || 0;
const missed = user.ping_info.missed_notifications || 0;
const now = I.get_seconds_now();
```

**СЛУЧАЙ 1: Было уведомление вчера, не было ответа**
```javascript
const wasNotified = !!last_notification;
const wasAnswered = last_shared > last_notification;

if (wasNotified && !wasAnswered) {
    if (missed < MAX_MISSED_NOTIFICATIONS) {
        user.ping_info.missed_notifications++;
        await initiate_user_dialog(user);
    }
    // Если missed >= 2 → НЕ беспокоить
    return;
}
```

**СЛУЧАЙ 2: Пользователь ответил**
```javascript
if (wasNotified && wasAnswered) {
    user.ping_info.missed_notifications = 0;
    return;
}
```

**СЛУЧАЙ 3: Проверка недельного интервала**
```javascript
const time_since_last_shared = now - last_shared;
if (time_since_last_shared >= WEEK_INTERVAL) {
    await initiate_user_dialog(user);
}
```

**Throws:**
- НЕ выбрасывает — все ошибки логируются

**Примеры:**

```javascript
// Проверка и инициация для пользователя
await check_and_initiate_dialog(user);
```

**Constants:**
```javascript
const WEEK_INTERVAL = 7 * 24 * 60 * 60;  // 7 дней в секундах
const MAX_MISSED_NOTIFICATIONS = 2;
```

**Edge Cases:**
- Первое уведомление (last_notification = 0) → check недельного интервала
- Пользователь достиг MAX_MISSED → НЕ отправлять повторно
- last_shared после last_notification → сбросить missed counter

---

### 5.3 initiate_user_dialog()

**Назначение:** Инициация проактивного диалога с пользователем

**Сигнатура:**
```javascript
async function initiate_user_dialog(user)
```

**Параметры:**
- `user` (Object, required) — объект пользователя

**Возвращает:** `Promise<void>`

**Алгоритм:**
1. Проверка профиля: `check_profile_completeness(user)`
2. Формирование дополнительного контекста (если профиль неполный)
3. Получение диалога: `DialogSystem.get_dialog(user.uuid, workspace_id)`
4. Формирование instruction:
   ```
   Инициируй разговор с пользователем. Поинтересуйся, как дела.
   {additional_context}
   ```
5. Вызов: `dialog.invoke_with_instruction(instruction)`
6. Отправка через Telegram: `Bot.replyWithHTML(message, user.telegram_id)`
7. Обновление: `user.ping_info.last_notification = now`

**Throws:**
- НЕ выбрасывает — все ошибки логируются

**Примеры:**

```javascript
// Инициация проактивного диалога
await initiate_user_dialog(user);
```

**Additional Context (если профиль неполный):**
```javascript
const additional_context =
    "Также уточни у пользователя недостающую информацию: " +
    missing_fields.join(', ');
```

**Error Handling:**
- Если Telegram failed → НЕ обновлять last_notification
- Если dialog failed → логировать, продолжить

---

### 5.4 check_profile_completeness()

**Назначение:** Проверка полноты профиля пользователя

**Сигнатура:**
```javascript
function check_profile_completeness(user)
```

**Параметры:**
- `user` (Object, required) — объект пользователя

**Возвращает:** `Object`
```javascript
{
    is_complete: Boolean,
    missing_fields: Array<String>
}
```

**Алгоритм:**
1. Проверка обязательных полей: `name`, `occupation`
2. Формирование списка missing fields
3. Возврат результата

**Примеры:**

```javascript
const { is_complete, missing_fields } = check_profile_completeness(user);
if (!is_complete) {
    console.log(`Missing: ${missing_fields.join(', ')}`);
}
```

---

## 6. Data Types

### 6.1 User Object

```typescript
interface User {
    uuid: string;
    telegram_id: number;
    workspace_id: string;
    name?: string;
    occupation?: string;
    ping_info?: {
        last_notification?: number;        // timestamp секунды
        last_shared_about_self?: number;   // timestamp секунды
        last_received_news?: number;       // timestamp секунды
        missed_notifications?: number;     // счетчик 0-2
    };
}
```

### 6.2 Queue Message

```typescript
interface QueueMessage {
    action: string;          // 'process_users'
    data: any[];            // параметры для handler
}
```

### 6.3 Queue Item

```typescript
interface QueueItem {
    body: string;           // JSON string с QueueMessage
    MessageId: string;      // ID сообщения
    ReceiptHandle?: string; // Handle для удаления
}
```

---

## 7. Error Handling

### 7.1 Error Handling Strategy

**Принципы:**
- **НЕ прерывать batch обработку** при ошибках отдельных users
- Логировать все ошибки через `I.log_error()`
- Retry для критичных операций (queue post)
- Graceful degradation (пропустить AI, но продолжить с dialogs)

### 7.2 Error Scenarios

**Сценарий 1: Queue недоступен**
```javascript
try {
    await Queues.post('process_users', 50);
} catch (error) {
    I.log_error(error, 'Failed to post to queue');
    // Retry 3 раза с exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
        await I.delay(1000 * Math.pow(2, attempt - 1));
        try {
            await Queues.post('process_users', 50);
            break;
        } catch (retry_error) {
            if (attempt === 3) throw retry_error;
        }
    }
}
```

**Сценарий 2: Batch AI failed**
```javascript
try {
    const ai_results = await ReportsBus.batch_analyze_content(all_content_data);
    await ReportsBus.accumulate_batch_results(...);
} catch (error) {
    I.log_error(error, 'Batch AI failed');
    // Пропустить ЭТАП 5, продолжить с ЭТАП 6 (threshold check)
}
```

**Сценарий 3: Telegram send failed**
```javascript
try {
    await Bot.replyWithHTML(message, user.telegram_id);
    user.ping_info.last_received_news = I.get_seconds_now();
} catch (error) {
    I.log_error(error, `Failed to send news to user ${user.uuid}`);
    // НЕ обновлять last_received_news → попытка в следующий раз
}
```

---

## 8. Usage Examples

### 8.1 Complete Flow Example

```javascript
// Cloud Functions Timer Trigger Handler
export async function handler(event, context) {
    try {
        // Entry point
        const result = await TimerHandler.invoke();

        return {
            statusCode: 200,
            body: result
        };
    } catch (error) {
        I.log_error(error, 'Timer handler failed');
        return {
            statusCode: 500,
            body: 'Timer handler error'
        };
    }
}
```

### 8.2 Queue Handler Setup

```javascript
// Регистрация handler для process_users
Queues.add_handler('process_users', async (limit) => {
    return await TimerHandler.process_users(limit);
});

// Cloud Functions Queue Trigger Handler
export async function queue_handler(event, context) {
    try {
        // Обработка из queue
        const result = await Queues.accept(event.messages[0]);

        return {
            statusCode: result.success ? 200 : 500,
            body: result.result || result.error
        };
    } catch (error) {
        I.log_error(error, 'Queue handler failed');
        return {
            statusCode: 500,
            body: 'Queue handler error'
        };
    }
}
```

### 8.3 Manual Trigger Example (Testing)

```javascript
// Тестирование manual запуска
async function test_timer() {
    // Инициализация
    await TimerHandler.invoke();

    // Ожидание queue обработки (или manual вызов)
    await TimerHandler.process_users(10); // малый batch для теста
}

test_timer().catch(console.error);
```

### 8.4 Integration Example

```javascript
// Интеграция с другими модулями
const { TimerHandler, Queues } = require('./modules/timer-handler');
const ReportsBus = require('./modules/reports-bus');
const WorkspaceManager = require('./modules/workspace-manager');
const DialogSystem = require('./modules/dialog-system');

// Setup handlers
Queues.add_handler('process_users', async (limit) => {
    return await TimerHandler.process_users(limit);
});

// Timer trigger
await TimerHandler.invoke();
```

---

## 9. Performance Specifications

### 9.1 Performance Targets

| Метрика | Target | Примечания |
|---------|--------|------------|
| Batch processing time | < 2 min | Для 50 users |
| Queue throughput | > 100 msg/min | Message Queue |
| AI processing time | < 1 min | Для batch 50 users |
| Timeout delay | 100ms | Между users |

### 9.2 Scalability

**Batch Size:**
- Min: 10 users (для малых workspace)
- Max: 50 users (для оптимизации AI cost)
- Default: 50

**Concurrent Processing:**
- Queue pattern позволяет параллельную обработку
- Каждый batch независим
- До 10 concurrent functions (Yandex Cloud limit)

---

## 10. Integration Points

### 10.1 ReportsBus Integration

```javascript
// ЭТАП 2
await ReportsBus.check_and_create_missing_raw_record(workspace_id, user);

// ЭТАП 3
const { all_content_data, user_mapping } =
    await ReportsBus.collect_content_for_users(workspace_id, users_batch, members);

// ЭТАП 4
const ai_results = await ReportsBus.batch_analyze_content(all_content_data);

// ЭТАП 5
await ReportsBus.accumulate_batch_results(workspace_id, users_batch, user_mapping, ai_results);

// ЭТАП 6
const all_news = await ReportsBus.collect_all_user_news(workspace_id, user.uuid);
await ReportsBus.move_all_news_to_history(workspace_id, user.uuid);
```

### 10.2 WorkspaceManager Integration

```javascript
// Получение всех членов workspace для контекста
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
```

### 10.3 DialogSystem Integration

```javascript
// Создание диалога
const dialog = await DialogSystem.get_dialog(user.uuid, workspace_id);

// Отправка через LLM
const message = await dialog.invoke_with_instruction(instruction);
```

### 10.4 UsersController Integration

```javascript
// Инициализация processing
await users.processing.init();

// Старт обработки batch
await users.tg.start_user_processing();

// Получение batch
const uuid_batch = await users.tg.get_next_batch(limit);

// Загрузка user data
const users_batch = await users.get_user_data_list(uuid_batch);

// Cleanup
await users.processing.del(uuid_batch);

// Сохранение изменений
await users.set_user_data_list(users_batch);
```

---

## 11. Configuration

### 11.1 Environment Variables

```javascript
{
    // Queue Configuration
    QUEUE_URL: String,              // Yandex Message Queue URL
    BOT_NAME: String,               // Имя бота для queuer

    // Processing Configuration
    PROCESSING_BATCH_SIZE: Number,  // Размер batch (default: 50)
    PROCESSING_TIMEOUT_MS: Number,  // Delay между users (default: 100ms)

    // Business Logic
    NEWS_THRESHOLD: Number,         // Порог отправки новостей (default: 1)
    WEEK_INTERVAL_DAYS: Number,     // Интервал проактивных диалогов (default: 7)
    MAX_MISSED_NOTIFS: Number,      // Макс пропущенных уведомлений (default: 2)

    // Telegram
    TELEGRAM_BOT_TOKEN: String      // Bot token
}
```

### 11.2 Constants

```javascript
const BATCH_SIZE = process.env.PROCESSING_BATCH_SIZE || 50;
const TIMEOUT_DELAY = process.env.PROCESSING_TIMEOUT_MS || 100;
const NEWS_THRESHOLD = process.env.NEWS_THRESHOLD || 1;
const WEEK_INTERVAL = (process.env.WEEK_INTERVAL_DAYS || 7) * 24 * 60 * 60;
const MAX_MISSED_NOTIFICATIONS = process.env.MAX_MISSED_NOTIFS || 2;
```

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Обязательные тесты:**

```javascript
describe('TimerHandler', () => {
    describe('invoke()', () => {
        it('should initialize processing and post to queue');
        it('should handle queue post errors');
    });

    describe('process_users()', () => {
        it('should process batch of 50 users');
        it('should handle empty batch');
        it('should continue on AI errors');
        it('should post next batch');
    });
});

describe('Queues', () => {
    describe('post()', () => {
        it('should post message to queue');
        it('should retry on errors');
    });

    describe('accept()', () => {
        it('should accept and route to handler');
        it('should reject unknown actions');
    });
});

describe('Helper Functions', () => {
    describe('send_news_to_user()', () => {
        it('should send news via Telegram');
        it('should update last_received_news');
        it('should handle Telegram errors');
    });

    describe('check_and_initiate_dialog()', () => {
        it('should initiate on week interval');
        it('should increment missed counter');
        it('should reset missed on answer');
        it('should not initiate when missed >= 2');
    });
});
```

### 12.2 Integration Tests

```javascript
describe('TimerHandler Integration', () => {
    it('should complete full batch processing flow');
    it('should send news when threshold reached');
    it('should initiate proactive dialogs');
    it('should handle queue message chain');
});
```

---

## 13. Migration Notes

### 13.1 Legacy Comparison

| Аспект | Legacy | v1.0.0 | Изменения |
|--------|--------|---------|-----------|
| Module name | timer-handler.js | timer-handler.js | Без изменений |
| Queue library | @dieugene/queuer | @dieugene/queuer | Без изменений |
| Batch size | 50 | 50 | Без изменений |
| ContentBus | ✅ | ReportsBus | Новый модуль |
| Workspace isolation | ❌ | ✅ workspace_id | Добавлено |

### 13.2 Breaking Changes

**НЕТ breaking changes** — TimerHandler v1.0.0 полностью совместим с legacy логикой, только интегрируется с новыми модулями (ReportsBus, WorkspaceManager, DialogSystem).

---

## 14. Acceptance Criteria

### 14.1 Functional Criteria

- ✅ invoke() запускается по таймеру и post в queue
- ✅ process_users() обрабатывает batch до 50 users
- ✅ Batch AI через ReportsBus работает корректно
- ✅ Threshold check и отправка новостей
- ✅ Proactive dialog initiation при неактивности
- ✅ Missed notifications logic (0-2)
- ✅ Queue pattern работает (post → accept → handler)

### 14.2 Non-Functional Criteria

- ✅ Performance: batch 50 users < 2 min
- ✅ Error handling для всех edge cases
- ✅ Graceful degradation (продолжать при ошибках)
- ✅ Retry logic для queue operations
- ✅ Logging для всех критичных операций

### 14.3 Integration Criteria

- ✅ ReportsBus integration работает
- ✅ WorkspaceManager integration работает
- ✅ DialogSystem integration работает
- ✅ UsersController integration работает
- ✅ Telegram Bot API integration работает

---

**Status:** ✅ Complete API Contract
**Next Step:** Implementation (Developer phase)
**Version:** 1.0.0
**Created:** 2025-11-09
