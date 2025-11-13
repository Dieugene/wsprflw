# Спецификация модуля: ReportsBus (ContentBus v2.0)

**Роль:** Architect
**Фаза:** Phase 2 - Module Specification
**Приоритет:** Priority 1 (Critical)
**Версия:** 2.0.0
**Статус:** 📝 Draft

---

> **🔴 ВАЖНО ДЛЯ РАЗРАБОТЧИКОВ:**
>
> Большинство используемых модулей являются **ПРИВАТНЫМИ** npm пакетами:
> - `@dieugene/utils`
> - `@dieugene/ydb-serverless`
> - `@dieugene/users-controller`
> - `@dialogai/dialog-class`
>
> **Документация этих пакетов недоступна на npm.**
>
> Для понимания правил работы с этими модулями **ОБЯЗАТЕЛЬНО изучайте legacy код** в папке `legacy/`:
> - `legacy/utils/content-utils.js` - работа с ContentBus (прототип ReportsBus)
> - `legacy/bot_utils.js` - работа с users-controller
> - `legacy/dialog.js` - работа с dialog-class
> - `legacy/timer-handler.js` - примеры batch обработки
>
> **Legacy код является справочным материалом** для понимания API и паттернов использования приватных модулей.

---

## 1. Обзор и назначение

**ReportsBus** — централизованная шина для управления информационным потоком в системе Project Assistant. Модуль обеспечивает сбор, хранение, обработку и маршрутизацию информации от участников команды.

### Ключевые отличия от legacy ContentBus:

1. **Workspace isolation** — строгая изоляция данных по workspace_id
2. **Schema-Guided Reasoning** — многоэтапная каскадная AI-обработка вместо одного промпта
3. **Two-level context** — разделение Dialog Context и Data Bus Context
4. **Typed events** — событийная архитектура вместо прямых вызовов

### Назначение модуля:

- Сохранение "сырых" диалогов участников (raw records)
- Batch AI-обработка накопленных диалогов с использованием SGR
- Накопление обработанной информации (processed records)
- Пороговая отправка уведомлений (threshold-based delivery)
- Watermark tracking для предотвращения дублирования

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ ReportsBus:

✅ **Сбор данных:**
- Сохранение raw записей после завершения диалога
- Автоматическое создание missing records при обнаружении "дыр"

✅ **Обработка данных:**
- Batch AI-анализ через Schema-Guided Reasoning
- Классификация активности (progress_update, blocker, question, etc.)
- Извлечение сущностей (mentioned_people, topics, dependencies)
- Определение релевантности для каждого получателя

✅ **Накопление и маршрутизация:**
- Накопление обработанных новостей в processed records
- Проверка порога N (threshold) для отправки
- Watermark tracking (last_processed_date)

✅ **Интеграция:**
- Событийная модель (`emit('raw_saved')`, `emit('batch_processed')`)
- Lazy loading для оптимизации cold start

### Что НЕ ДЕЛАЕТ ReportsBus:

❌ Генерация сводок для руководителя (это SummaryGenerator)
❌ Отправка уведомлений в Telegram (это NotificationRouter)
❌ Управление workspace и пользователями (это WorkspaceManager)
❌ Диалоги с пользователями (это DialogSystem)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты, логирование
  "@dieugene/ydb-serverless": "^1.0.0",   // YDB connector
  "@dialogai/dialog-class": "^2.1.8",     // Dialog class для буферной истории
  "langchain": "^0.1.0",                  // LangChain для SGR
  "openai": "^4.20.0"                     // OpenAI API для gpt-5/gpt-5-mini
}
```

### Внутренние модули:

- **WorkspaceManager** — получение списка участников workspace
- **DialogSystem** — получение buffer history, clearBuffer()
- **UsersController** (@dieugene/users-controller) — user data

### Infrastructure:

- **YDB** — хранение raw/processed records
- Индексы: `workspace_source_type_time_index`, `workspace_source_target_type_index`

### 3.1 Справочник по приватным модулям (legacy examples)

> **⚠️ ОБЯЗАТЕЛЬНО ИЗУЧИТЬ ПЕРЕД РЕАЛИЗАЦИЕЙ**

#### @dieugene/utils

**Legacy reference:** `legacy/utils/content-utils.js:1-6`, `legacy/bot_utils.js`

**Основные функции:**
```javascript
const I = require("@dieugene/utils");

// Время
I.get_seconds_now()           // Текущее время в секундах (Unix timestamp)
I.getDateISO().date            // Дата в формате YYYY-MM-DD

// Логирование
I.log_error(error, context)    // Логирование ошибок
I.log_if('FLAG', message)      // Условное логирование по флагу

// Примеры использования см. в legacy/utils/content-utils.js:237-261
```

#### @dieugene/ydb-serverless

**Legacy reference:** `legacy/utils/content-utils.js:8-223` (Dao модуль)

**Основные паттерны:**
```javascript
const ydb_serverless = require("@dieugene/ydb-serverless");

// Инициализация
let ydb = ydb_serverless.init(database_url);

// Запросы с параметрами
const query = `
DECLARE $param1 as Utf8;
DECLARE $param2 as Uint64;

SELECT * FROM table WHERE field = $param1 AND timestamp > $param2;
`;

// Выполнение
const result = await ydb.execute(query, {
    '$param1': value1,
    '$param2': value2
});

// Upsert
await ydb.apply(upsert_query, params);

// Примеры ВСЕХ типов запросов см. в legacy/utils/content-utils.js:33-220
```

**ВАЖНО:**
- Параметры передаются с префиксом `$`
- Используйте `execute()` для SELECT, `apply()` для UPSERT/INSERT/DELETE
- JSON данные хранятся как строки, требуется `JSON.parse()` при чтении (см. legacy:86, 117)
- **Изучить batch upsert методы** в SDK для оптимизации

#### @dialogai/dialog-class

**Legacy reference:** `legacy/dialog.js`, `legacy/utils/content-utils.js:271-296`

**Основные методы:**
```javascript
const { Dialog } = require("@dialogai/dialog-class");

// Получение буферной истории
const bufferHistory = await dialog.getBufferHistory();

// Получение текста диалога
const dialog_text = await dialog.getBufferHistoryText({
    ai_alias: 'Бот',
    user_alias: 'Пользователь'
});

// Очистка буфера после обработки
await dialog.clearBuffer();

// Примеры см. в legacy/utils/content-utils.js:271-295
```

#### @dieugene/users-controller

**Legacy reference:** `legacy/bot_utils.js`

**Основные функции:**
```javascript
const users = require("@dieugene/users-controller");

// Получение данных пользователя
const user_data = await users.get_user_data(user_uuid);

// Структура user_data:
// {
//   uuid: "...",
//   telegram_id: ...,
//   ping_info: { last_shared_about_self: timestamp },
//   // ... другие поля
// }

// Примеры использования см. в legacy/bot_utils.js
```

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/reports-bus.js
├─ Dao (Data Access Object)
│  ├─ init(database_url)
│  ├─ add_raw_record(workspace_id, user_uuid, data, created_at)
│  ├─ get_raw_records_after_date(workspace_id, user_uuid, after_date)
│  ├─ get_processed_record(workspace_id, user_uuid_target, user_uuid_source)
│  ├─ add_processed_record(workspace_id, user_uuid_target, user_uuid_source, data)
│  ├─ delete_processed_record(workspace_id, user_uuid_target, user_uuid_source)
│  └─ get_user_last_raw_record(workspace_id, user_uuid)
│
├─ ReportsBus (High-level API)
│  ├─ process_dialog_completion(workspace_id, user_uuid, dialog)
│  ├─ collect_content_for_users(workspace_id, users_batch)
│  ├─ batch_analyze_content(all_content_data)  // SGR-based
│  ├─ accumulate_batch_results(workspace_id, users_batch, user_mapping, ai_results)
│  ├─ collect_all_user_news(workspace_id, user_uuid)
│  ├─ move_all_news_to_history(workspace_id, user_uuid)
│  └─ check_and_create_missing_raw_record(workspace_id, user)
│
└─ SGR Processors (Schema-Guided Reasoning)
   ├─ classify_activity_sgr(activity)
   ├─ extract_entities_sgr(activity)
   ├─ determine_relevance_sgr(activity, classification, entities, workspace_context)
   └─ format_message_sgr(activity, target_uuid, classification, entities)
```

### 4.2 Event-driven architecture

ReportsBus использует событийную модель для слабого связывания:

```javascript
// События, которые EMIT'ит ReportsBus:
ReportsBus.emit('raw_saved', { workspace_id, user_uuid, created_at });
ReportsBus.emit('batch_processed', { workspace_id, processed_count });
ReportsBus.emit('threshold_reached', { workspace_id, user_uuid, news_count });

// События, на которые SUBSCRIBE ReportsBus:
// (пока нет, в будущем может подписаться на workspace events)
```

---

## 5. Схема данных (YDB)

### 5.1 Таблица: `content_bus`

```javascript
Table: content_bus

Columns:
- workspace_id (String, Partition Key) - workspace isolation
- user_uuid_source (String) - от кого
- user_uuid_target (String, optional) - кому (только для processed)
- created_at (Uint64, Sort Key) - timestamp в секундах
- type (String) - 'raw' или 'processed'
- data (JsonDocument) - содержимое
- id (String) - UUID записи для UPDATE/DELETE

Indexes:
1. workspace_source_type_time_index
   - workspace_id (Partition)
   - user_uuid_source
   - type
   - created_at

2. workspace_source_target_type_index
   - workspace_id (Partition)
   - user_uuid_source
   - user_uuid_target
   - type
```

### 5.2 Структура данных: Raw record

```javascript
{
  "type": "raw",
  "user_uuid": "user-456",
  "created_at": 1699999999,
  "dialog_text": "Сегодня завершили первый этап проекта X. Начали работу над модулем Y...",
  "user_name": "Иван Петров",
  "session_date": "2024-11-07",  // YYYY-MM-DD
  "workspace_id": "ws-123"
}
```

### 5.3 Структура данных: Processed record

> **⚠️ ИЗМЕНЕНО ПО СРАВНЕНИЮ С LEGACY:**
> - Добавлен `workspace_id`
> - Структура `news[]` может меняться в процессе детализации SGR

```javascript
{
  "notification_history": [
    "Иван завершил первый этап проекта X",
    "Мария начала тестирование модуля авторизации"
  ],  // История ОТПРАВЛЕННЫХ уведомлений

  "news": [
    "Сергей столкнулся с проблемой интеграции API",
    "Команда запланировала встречу на завтра"
  ],  // НАКОПЛЕННЫЕ новости (еще не отправлены)

  "last_processed_date": 1699999999,  // Watermark
  "processing_version": "v2.0",       // Версия обработки
  "workspace_id": "ws-123"
}
```

---

## 6. API спецификация (High-level)

> **Детальный API contract** будет в отдельном файле `.agents/specs/api-contracts/reports-bus-api.md`

### 6.1 Основные функции

#### `process_dialog_completion(workspace_id, user_uuid, dialog)`

**Назначение:** Сохранение raw записи после завершения диалога с пользователем

**Параметры:**
- `workspace_id` (String) - ID workspace
- `user_uuid` (String) - UUID пользователя
- `dialog` (Dialog) - экземпляр Dialog class

**Возвращает:** `Promise<boolean>` - успешность сохранения

**Алгоритм:**
1. Получить `bufferHistory` из dialog
2. Если история пуста → пропустить
3. Сформировать `dialog_text` через `getBufferHistoryText()`
4. Получить `user_name` из users-controller
5. Сохранить raw запись в YDB через `Dao.add_raw_record()`
6. Очистить buffer: `dialog.clearBuffer()`
7. Emit событие: `'raw_saved'`

**Edge cases:**
- Если buffer пуст → не создавать запись
- Если YDB недоступна → логировать, возвращать false
- Если clearBuffer() failed → warning, но считать успехом

---

#### `collect_content_for_users(workspace_id, users_batch)`

**Назначение:** Сбор всех новых raw записей для batch AI-обработки

**Параметры:**
- `workspace_id` (String) - ID workspace
- `users_batch` (Array<User>) - массив пользователей workspace (до 50)

**Возвращает:**
```javascript
{
  all_content_data: [
    {
      source_user_uuid: "user-456",
      source_user_name: "Иван",
      previous_notifications: [...],
      new_raw_records: [
        { session_date: "2024-11-07", dialog_text: "...", created_at: 1699999999 }
      ],
      last_processed_date: 1699999998
    },
    ...
  ],
  user_mapping: Map<user_uuid, [source_uuids]>  // Для обратного применения
}
```

**Алгоритм:**
1. Для каждого пользователя в `users_batch`:
   - Получить всех участников workspace (через WorkspaceManager)
   - Для каждого участника (source):
     - Получить processed record: `Dao.get_processed_record(workspace_id, user_uuid, source_uuid)`
     - Извлечь `last_processed_date` и `notification_history`
     - Получить новые raw records: `Dao.get_raw_records_after_date(workspace_id, source_uuid, last_processed_date)`
     - Если новых записей нет → пропустить
     - Добавить в `all_content_data`
2. Сформировать `user_mapping` для обратного применения результатов
3. Вернуть `{ all_content_data, user_mapping }`

---

#### `batch_analyze_content(all_content_data)`

**Назначение:** Batch AI-обработка через Schema-Guided Reasoning

**Параметры:**
- `all_content_data` (Array) - массив структур контента

**Возвращает:**
```javascript
[
  {
    source_user_uuid: "user-456",
    target_users: ["user-1", "user-2"],
    message: "Иван завершил первый этап проекта X",
    classification: { activity_type: "progress_update", urgency: "low" },
    entities: { mentioned_people: [], topics: ["проект X"], dependencies: [] }
  },
  ...
]
```

**Алгоритм (SGR-based):**

См. system-design.md раздел 6.3 для детального описания SGR. Высокоуровневый процесс:

1. **ЭТАП 1: Классификация** (для каждого сообщения)
   - Модель: `gpt-5-mini`
   - Output schema: `{ activity_type, urgency, summary }`

2. **ЭТАП 2: Извлечение сущностей**
   - Модель: `gpt-5-mini`
   - Output schema: `{ mentioned_people[], topics[], dependencies[] }`

3. **ЭТАП 3: Определение релевантности**
   - Модель: `gpt-5` (более сложная задача)
   - Input: activity + classification + entities + workspace_context
   - Output schema: `{ relevant_for_lead: boolean, relevant_for_users: [uuid], reason: string }`

4. **ЭТАП 4: Формирование сообщений**
   - Модель: `gpt-5`
   - Для каждого получателя отдельно
   - Output: персонализированный текст сообщения

**Error handling:**
- Если LLM недоступен → fallback на простую обработку (plain text)
- Если JSON invalid → retry 1 раз, затем skip
- Логировать все ошибки для мониторинга

---

#### `accumulate_batch_results(workspace_id, users_batch, user_mapping, ai_results)`

**Назначение:** Применение результатов AI-анализа к processed records

**Алгоритм:**
1. Для каждого пользователя в `users_batch`:
   - Получить список источников из `user_mapping`
   - Для каждого источника:
     - Найти соответствующий AI result
     - Получить текущий processed record
     - Добавить новую новость в `news[]` array
     - Обновить `last_processed_date` (watermark)
     - Сохранить через `Dao.add_processed_record()`

2. Emit событие: `'batch_processed'`

---

#### `collect_all_user_news(workspace_id, user_uuid)`

**Назначение:** Сбор всех накопленных новостей пользователя (для проверки порога N)

**Возвращает:** `Array<String>` - массив текстов новостей

**Алгоритм:**
1. Получить всех участников workspace
2. Для каждого участника:
   - Получить processed record
   - Извлечь `news[]` array
   - Добавить в общий массив
3. Вернуть объединенный массив

---

#### `move_all_news_to_history(workspace_id, user_uuid)`

**Назначение:** Перенос всех накопленных новостей в notification_history после отправки

**Алгоритм:**
1. Получить всех участников workspace
2. Для каждого участника:
   - Получить processed record
   - Переместить `news[]` → `notification_history[]`
   - Очистить `news[]`
   - Обновить запись через `Dao.add_processed_record()`

---

## 7. Алгоритмы и процессы

### 7.1 Процесс: Сохранение raw записи после диалога

```
[User завершил диалог с ботом]
         │
         ▼
[DialogSystem вызывает process_dialog_completion]
         │
         ▼
[ReportsBus.process_dialog_completion(workspace_id, user_uuid, dialog)]
         │
         ├─> dialog.getBufferHistory()
         ├─> dialog.getBufferHistoryText()
         ├─> Dao.add_raw_record(workspace_id, user_uuid, raw_data)
         ├─> dialog.clearBuffer()
         └─> emit('raw_saved')
```

### 7.2 Процесс: Batch AI-обработка (Timer trigger)

```
[Timer вызывает TimerHandler каждый день]
         │
         ▼
[TimerHandler.process_users_batch(limit=50)]
         │
         ├─> ReportsBus.collect_content_for_users(workspace_id, users_batch)
         │        │
         │        └─> Для каждого пользователя:
         │             └─> Собрать новые raw records от всех участников
         │
         ├─> ReportsBus.batch_analyze_content(all_content_data)  // SGR
         │        │
         │        └─> ЭТАП 1: Классификация (gpt-5-mini)
         │        └─> ЭТАП 2: Извлечение сущностей (gpt-5-mini)
         │        └─> ЭТАП 3: Определение релевантности (gpt-5)
         │        └─> ЭТАП 4: Формирование сообщений (gpt-5)
         │
         ├─> ReportsBus.accumulate_batch_results(workspace_id, users_batch, mapping, results)
         │        │
         │        └─> Обновить processed records с новыми новостями
         │
         └─> Для каждого пользователя:
              ├─> ReportsBus.collect_all_user_news(workspace_id, user_uuid)
              ├─> Если news.length >= N (threshold):
              │    ├─> NotificationRouter.send_news(user_uuid, news)
              │    └─> ReportsBus.move_all_news_to_history(workspace_id, user_uuid)
              └─> Иначе: накопление продолжается
```

### 7.3 Процесс: Автокоррекция "missing records"

```
[Timer проверяет пользователей перед batch обработкой]
         │
         ▼
[check_and_create_missing_raw_record(workspace_id, user)]
         │
         ├─> Проверить: last_shared_about_self > last_raw_created_at ?
         ├─> Если ДА (есть "дыра"):
         │    ├─> get_dialog(user_uuid)
         │    └─> process_dialog_completion(workspace_id, user_uuid, dialog)
         └─> Иначе: пропустить
```

---

## 8. Edge Cases и Error Handling

### 8.1 Edge Case: Dialog buffer пуст

**Ситуация:** Пользователь завершил диалог, но буферная история пуста

**Решение:**
- Проверка в начале `process_dialog_completion()`
- Если `bufferHistory.length === 0` → return true (не ошибка)
- Не создавать raw запись

### 8.2 Edge Case: LLM API error

**Ситуация:** OpenAI API timeout, rate limit, или другая ошибка

**Решение:**
- Retry 2 раза для transient errors
- Если все retry failed:
  - Логировать critical error
  - Установить флаг `processing_failed: true` в processed record
  - Попытаться обработать при следующем batch run (следующий день)
  - НЕ прерывать весь batch (продолжить со следующим пользователем)

### 8.3 Edge Case: Invalid JSON от LLM

**Ситуация:** LLM вернул невалидный JSON в SGR этапе

**Решение:**
- Retry 1 раз с уточненным промптом
- Если retry failed → skip это сообщение
- Логировать error с оригинальным response для debugging

### 8.4 Edge Case: Workspace был удален между сбором и обработкой

**Ситуация:** Workspace удален администратором во время batch обработки

**Решение:**
- Проверка существования workspace перед обработкой каждого user
- Если workspace не существует → skip всех пользователей этого workspace
- Логировать warning

### 8.5 Edge Case: Дубликаты raw записей

**Ситуация:** По какой-то причине создано две raw записи с одинаковым содержимым

**Решение:**
- Проверка по `session_date` + `user_uuid` + хеш `dialog_text`
- Если дубликат обнаружен → не создавать новую запись
- Возвращать true (считаем успешным)

---

## 9. Performance Considerations

### 9.1 Batch Size Optimization

**Проблема:** Слишком большой batch → функция timeout (10 min limit)

**Решение:**
- Limit batch size: максимум 50 пользователей за раз
- Если больше → разбить на несколько batch
- Использовать Message Queue для следующего batch

### 9.2 Cold Start Optimization

**Проблема:** Serverless cold start ~3-5 секунд

**Решение:**
- Lazy loading всех зависимостей
- Инициализация YDB connection только при первом вызове
- Кешировать connection между вызовами (если возможно)

### 9.3 LLM Token Optimization

**Проблема:** Большие batch → высокая стоимость токенов

**Решение:**
- Использовать `gpt-5-mini` для простых этапов (классификация, извлечение)
- Использовать `gpt-5` только для сложных этапов (релевантность, формирование)
- Оптимизировать промпты для минимизации output tokens
- Мониторинг и анализ стоимости для оптимизации подходов

### 9.4 YDB Query Optimization

**Проблема:** Много запросов к YDB → медленная обработка

**Решение:**
- Использовать indexes для всех запросов
- Использовать batch upsert для множественных вставок (YDB поддерживает batch operations)
- Минимизировать количество queries через кеширование processed records
- Изучить оптимальный SDK метод для batch операций в @dieugene/ydb-serverless

---

## 10. Testing Requirements

### 10.1 Unit Tests

**Цель:** Покрытие всех функций модуля

**Обязательные тесты:**
- `process_dialog_completion()` - с пустым/непустым buffer
- `collect_content_for_users()` - с разными комбинациями users/sources
- `batch_analyze_content()` - мокируем LLM responses
- `accumulate_batch_results()` - проверка watermark и news accumulation
- `collect_all_user_news()` - проверка агрегации
- `move_all_news_to_history()` - проверка переноса

**Mocks:**
- YDB (через `tests/mocks/ydb-mock.js`)
- LLM (через `tests/mocks/ai-mock.js`)
- Dialog class

### 10.2 Integration Tests

**Цель:** Проверка взаимодействия с другими модулями

**Обязательные тесты:**
- End-to-end: диалог → raw record → batch обработка → processed record
- Проверка workspace isolation (два workspace не должны пересекаться)
- Проверка событийной модели (emit/subscribe)

### 10.3 Performance Tests

**Цель:** Убедиться, что batch обработка укладывается в timeout

**Обязательные тесты:**
- Batch 50 пользователей с реальным YDB
- Измерение времени каждого этапа
- Проверка, что общее время < 5 минут

---

## 11. Migration from Legacy

### 11.1 Изменения в схеме данных

**Legacy table:** `kak_dela_content_bus`
**New table:** `content_bus`

**Изменения:**
- ➕ Добавлен `workspace_id` (Partition Key)
- ➕ Добавлен `id` (UUID) для UPDATE/DELETE
- ➕ Новые indexes с `workspace_id`
- ⚠️ Структура `processed` record немного изменена

**Migration script:**
```javascript
// НЕ ТРЕБУЕТСЯ для Phase 2
// Legacy данные остаются в старой таблице
// Новая система начинает с чистого листа
```

### 11.2 Изменения в API

**Legacy ContentBus** → **New ReportsBus**

| Legacy Function | New Function | Изменения |
|----------------|--------------|-----------|
| `process_friends_content(user_uuid)` | `collect_content_for_users(workspace_id, users_batch)` | Batch вместо single user, добавлен workspace_id |
| `batch_analyze_friends_data(data)` | `batch_analyze_content(data)` | SGR вместо одного промпта |
| `collect_all_user_news(user_uuid)` | `collect_all_user_news(workspace_id, user_uuid)` | Добавлен workspace_id |

---

## 12. Future Enhancements (Phase 3+)

### 12.1 Vector Search для Dependencies

**Идея:** Использовать embeddings для поиска похожих тем/проектов

**Детали:** См. system-design.md раздел 5 (DependencyDetector)

### 12.2 Real-time Processing

**Идея:** Обрабатывать критичные сообщения немедленно (без batch)

**Критерий:** Если SGR определил `urgency: 'high'` → немедленная отправка

### 12.3 Multi-language Support

**Идея:** Поддержка нескольких языков в одном workspace

**Детали:** Определение языка через user settings или auto-detect

---

## 13. Acceptance Criteria

### Критерии приемки модуля:

- ✅ Все функции API реализованы и протестированы
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests проходят успешно
- ✅ Batch обработка 50 пользователей < 5 минут
- ✅ Workspace isolation работает корректно
- ✅ SGR pipeline работает корректно (4 этапа)
- ✅ Error handling для всех edge cases
- ✅ Документация API контракта готова
- ✅ Code review пройден без критических замечаний

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/reports-bus-api.md`
