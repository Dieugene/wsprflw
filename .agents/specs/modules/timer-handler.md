# Спецификация модуля: TimerHandler

**Роль:** Architect
**Фаза:** Phase 2 - Module Specification
**Приоритет:** Priority 1 (Critical)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**TimerHandler** — модуль для периодической batch обработки пользователей workspace. Модуль запускается по таймеру (Yandex Cloud Functions Triggers), выполняет batch AI обработку через ReportsBus, отправляет накопленные новости пользователям и инициирует проактивные диалоги при неактивности.

### Ключевые концепции:

**Queue Pattern** — использование Yandex Message Queue (@dieugene/queuer) для асинхронной обработки пользователей по батчам, чтобы избежать timeout (10 минут) serverless функций.

**Batch Processing** — обработка пользователей группами (до 50 за раз) для оптимизации AI запросов и распределения нагрузки.

**Threshold-based Delivery** — отправка новостей только когда накоплено >= N новостей (порог).

**Proactive Dialogs** — автоматическая инициация диалогов с пользователями при длительной неактивности.

### Назначение модуля:

- Периодический запуск batch обработки (ежедневно)
- Batch AI обработка через ReportsBus
- Отправка накопленных новостей пользователям
- Проактивная инициация диалогов при неактивности
- Автокоррекция missing raw records
- Управление missed notifications

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ TimerHandler:

✅ **Batch обработка:**
- Получение batch пользователей (до 50)
- Автокоррекция missing raw records
- Вызов ReportsBus для batch AI обработки
- Применение результатов к processed records

✅ **Delivery управление:**
- Проверка threshold N для каждого пользователя
- Отправка новостей если накоплено >= N
- Перенос новостей в history после отправки

✅ **Proactive dialogs:**
- Проверка last_shared_about_self
- Инициация диалога при длительной неактивности
- Управление missed_notifications counter

✅ **Queue управление:**
- Post в Message Queue для следующего batch
- Accept messages из Queue
- Handler registration

### Что НЕ ДЕЛАЕТ TimerHandler:

❌ AI обработка контента (это ReportsBus)
❌ Управление workspace (это WorkspaceManager)
❌ Управление диалогами (это DialogSystem)
❌ Прямая отправка в Telegram (это TelegramHandler/Bot)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/queuer": "^1.0.0",           // Message Queue
  "@dieugene/utils": "^1.16.3",           // Утилиты
  "@dieugene/users-controller": "^1.0.0", // User management
  "telegraf": "^4.0.0"                     // Telegram Bot (для отправки)
}
```

### Внутренние модули:

- **ReportsBus** — batch AI обработка, сбор новостей
- **WorkspaceManager** — получение workspace members
- **DialogSystem** — создание и управление диалогами
- **UsersController** — users.tg.get_next_batch(), users.processing

### Infrastructure:

- **Yandex Cloud Functions Triggers** — таймерный триггер (cron)
- **Yandex Message Queue** — асинхронная обработка batch
- **Telegram Bot API** — отправка проактивных сообщений

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/timer-handler.js
├─ Queues (Queue Management)
│  ├─ post(action, ...data) - отправка в queue
│  ├─ accept(item) - обработка из queue
│  ├─ add_handler(action, handler) - регистрация handler
│  └─ is_relevant_queue(input) - проверка источника
│
└─ TimerHandler (Main Logic)
   ├─ invoke() - entry point (timer trigger)
   ├─ process_users(limit) - batch обработка пользователей
   ├─ send_news_to_user(user, news) - отправка новостей
   ├─ check_and_initiate_dialog(user) - проверка неактивности
   └─ initiate_user_dialog(user) - проактивный диалог
```

---

## 5. Алгоритмы и процессы

### 5.1 Процесс: Timer Trigger Entry Point

```
[Yandex Cloud Functions Timer Trigger - ежедневно в 09:00]
         │
         ▼
[TimerHandler.invoke()]
         │
         ├─> users.processing.init() - инициализация обработки
         ├─> users.tg.start_user_processing() - сброс флагов обработки
         ├─> Queues.post('process_users', 50) - отправка в queue
         │
         └─> return 'Timer handler is invoked'
```

### 5.2 Процесс: Batch обработка пользователей

```
[Message Queue вызывает Queues.accept()]
         │
         ▼
[TimerHandler.process_users(limit=50)]
         │
         ├─> ЭТАП 1: Получение batch пользователей
         │    ├─> users.tg.get_next_batch(50) - получение UUID batch
         │    ├─> users.get_user_data_list(uuid_batch) - загрузка user data
         │    └─> Если batch пуст → "All users processed"
         │
         ├─> ЭТАП 2: Автокоррекция missing raw records
         │    └─> Для каждого user:
         │         └─> ReportsBus.check_and_create_missing_raw_record(workspace_id, user)
         │
         ├─> ЭТАП 3: Сбор контента для batch AI обработки
         │    ├─> WorkspaceManager.get_all_workspace_members(workspace_id)
         │    └─> ReportsBus.collect_content_for_users(workspace_id, users_batch)
         │
         ├─> ЭТАП 4: Batch AI обработка
         │    └─> ReportsBus.batch_analyze_content(all_content_data)
         │
         ├─> ЭТАП 5: Применение результатов
         │    └─> ReportsBus.accumulate_batch_results(workspace_id, users_batch, mapping, results)
         │
         ├─> ЭТАП 6: Проверка threshold и отправка новостей
         │    └─> Для каждого user:
         │         ├─> ReportsBus.collect_all_user_news(workspace_id, user_uuid)
         │         ├─> Если news.length >= N (threshold):
         │         │    ├─> send_news_to_user(user, all_news)
         │         │    └─> ReportsBus.move_all_news_to_history(workspace_id, user_uuid)
         │         └─> check_and_initiate_dialog(user)
         │
         ├─> ЭТАП 7: Cleanup и следующий batch
         │    ├─> users.processing.del(uuid_batch) - удаление из обработки
         │    ├─> users.set_user_data_list(users_batch) - сохранение изменений
         │    └─> Queues.post('process_users', 50) - следующий batch
         │
         └─> return 'User batch processing is finished'
```

### 5.3 Процесс: Отправка новостей пользователю

```
[send_news_to_user(user, news_array)]
         │
         ├─> DialogSystem.get_dialog(user_uuid, workspace_id)
         │
         ├─> Формирование news_message:
         │    "У меня есть свежие новости о твоих друзьях:
         │     {news[0]}
         │     {news[1]}
         │     ...
         │     Если у вас есть свои новости, не стесняйтесь делиться."
         │
         ├─> dialog.invoke_with_instruction(instruction) - отправка через LLM
         │
         ├─> Bot.replyWithHTML(message, user.telegram_id) - отправка в Telegram
         │
         ├─> user_data.ping_info.last_received_news = now - обновление времени
         │
         └─> return
```

### 5.4 Процесс: Проверка и инициация диалога

```
[check_and_initiate_dialog(user)]
         │
         ├─> Получение timestamps:
         │    ├─> last_notification = user.ping_info.last_notification
         │    ├─> last_shared = user.ping_info.last_shared_about_self
         │    └─> missed = user.ping_info.missed_notifications
         │
         ├─> Определение состояния:
         │    ├─> wasNotified = !!last_notification
         │    └─> wasAnswered = last_shared > last_notification
         │
         ├─> СЛУЧАЙ 1: Было уведомление вчера, не было ответа
         │    ├─> Если missed < 2:
         │    │    ├─> missed_notifications++ - увеличить counter
         │    │    └─> initiate_user_dialog(user) - повторное уведомление
         │    └─> Если missed >= 2:
         │         └─> Пропустить (не беспокоить)
         │
         ├─> СЛУЧАЙ 2: Пользователь ответил
         │    └─> missed_notifications = 0 - сбросить counter
         │
         ├─> СЛУЧАЙ 3: Проверка недельного интервала
         │    ├─> time_since_last_shared = now - last_shared
         │    ├─> Если time_since_last_shared >= 7 дней:
         │    │    └─> initiate_user_dialog(user)
         │    └─> Иначе: пропустить
         │
         └─> return
```

### 5.5 Процесс: Инициация проактивного диалога

```
[initiate_user_dialog(user)]
         │
         ├─> Проверка профиля:
         │    ├─> check_profile_completeness(user)
         │    └─> Если неполный → additional_context для уточнения
         │
         ├─> DialogSystem.get_dialog(user_uuid, workspace_id)
         │
         ├─> Формирование instruction:
         │    "Инициируй разговор с пользователем. Поинтересуйся, как дела.
         │     {additional_context если профиль неполный}"
         │
         ├─> dialog.invoke_with_instruction(instruction)
         │
         ├─> Bot.replyWithHTML(message, user.telegram_id) - отправка в Telegram
         │
         ├─> user_data.ping_info.last_notification = now - обновление времени
         │
         └─> return
```

---

## 6. API спецификация

> **Детальный API contract** будет в `.agents/specs/api-contracts/timer-handler-api.md`

### 6.1 TimerHandler.invoke()

**Назначение:** Entry point для таймерного триггера

**Параметры:** Нет

**Возвращает:** `Promise<String>` - "Timer handler is invoked"

**Алгоритм:**
1. Инициализация users.processing
2. Сброс флагов обработки users.tg.start_user_processing()
3. Post в queue: Queues.post('process_users', 50)

---

### 6.2 TimerHandler.process_users(limit)

**Назначение:** Batch обработка пользователей

**Параметры:**
- `limit` (Number, default=50) — размер batch

**Возвращает:** `Promise<String>`

**Алгоритм:** См. процесс 5.2

---

### 6.3 send_news_to_user(user, news_array)

**Назначение:** Отправка новостей пользователю

**Параметры:**
- `user` (Object) — объект пользователя
- `news_array` (Array<String>) — массив новостей

**Возвращает:** `Promise<void>`

---

### 6.4 check_and_initiate_dialog(user)

**Назначение:** Проверка необходимости проактивного диалога

**Параметры:**
- `user` (Object) — объект пользователя

**Возвращает:** `Promise<void>`

---

### 6.5 initiate_user_dialog(user)

**Назначение:** Инициация проактивного диалога

**Параметры:**
- `user` (Object) — объект пользователя

**Возвращает:** `Promise<void>`

---

## 7. Configuration

### 7.1 Environment Variables

```javascript
{
    QUEUE_URL: String,              // Yandex Message Queue URL
    PROCESSING_BATCH_SIZE: Number,  // Размер batch (default: 50)
    PROCESSING_TIMEOUT_MS: Number,  // Delay между users (default: 100ms)
    NEWS_THRESHOLD: Number,         // Порог для отправки новостей (default: 1)
    TELEGRAM_BOT_TOKEN: String,     // Telegram Bot token
    BOT_NAME: String                // Имя бота для queuer
}
```

### 7.2 Constants

```javascript
const BATCH_SIZE = 50;              // Максимум пользователей за batch
const TIMEOUT_DELAY = 100;          // Delay между обработкой users (ms)
const NEWS_THRESHOLD = 1;           // Минимум новостей для отправки
const WEEK_INTERVAL = 7 * 24 * 60 * 60;  // Недельный интервал (секунды)
const MAX_MISSED_NOTIFICATIONS = 2;  // Максимум пропущенных уведомлений
```

---

## 8. Edge Cases и Error Handling

### 8.1 Edge Case: Batch пуст (все пользователи обработаны)

**Ситуация:** users.tg.get_next_batch() вернул пустой массив

**Решение:**
- Логировать: "All users are processed"
- Возвращать успешный статус
- НЕ post следующий batch в queue

### 8.2 Edge Case: ReportsBus вернул ошибку

**Ситуация:** batch_analyze_content() выбросил ошибку

**Решение:**
- Try-catch вокруг batch processing
- Логировать ошибку
- Продолжить с threshold check и dialog initiation
- Post следующий batch (не прерывать процесс)

### 8.3 Edge Case: Пользователь достиг MAX_MISSED (2)

**Ситуация:** missed_notifications >= 2

**Решение:**
- НЕ отправлять повторные уведомления
- Дождаться ответа пользователя
- При ответе: сбросить counter

### 8.4 Edge Case: Telegram API недоступен

**Ситуация:** Bot.replyWithHTML() выбросил ошибку

**Решение:**
- Try-catch вокруг отправки
- Логировать ошибку
- НЕ update last_received_news (попытаться отправить в следующий раз)
- Продолжить обработку других users

### 8.5 Edge Case: Queue недоступен

**Ситуация:** Queues.post() выбросил ошибку

**Решение:**
- Логировать critical error
- Retry 3 раза с exponential backoff
- Если все retry failed → завершить с ошибкой (следующий timer запуск попробует снова)

---

## 9. Performance Considerations

### 9.1 Batch Size Optimization

**Проблема:** Слишком большой batch → timeout

**Решение:**
- Limit: 50 пользователей
- Timeout между users: 100ms
- Расчетное время: 50 users * 100ms = 5 секунд (+ AI processing)

### 9.2 Queue Pattern

**Проблема:** Serverless timeout 10 минут

**Решение:**
- Разбивка на небольшие batch через Message Queue
- Каждый batch post следующий в queue
- Если batch пуст → завершение цепочки

### 9.3 AI Batch Processing

**Проблема:** Batch AI обработка дорогая

**Решение:**
- Один AI запрос для всего batch (через ReportsBus)
- Использование gpt-5-mini для простых этапов (в v2.0 SGR)

---

## 10. Testing Requirements

### 10.1 Unit Tests

**Обязательные тесты:**
- invoke() - инициализация и post в queue
- process_users() - полный flow (mock dependencies)
- send_news_to_user() - формирование message и отправка
- check_and_initiate_dialog() - все случаи (wasNotified, wasAnswered, missed)
- initiate_user_dialog() - формирование instruction

**Mocks:**
- users.tg.get_next_batch()
- ReportsBus methods
- Bot.replyWithHTML()
- Queues.post()

### 10.2 Integration Tests

**Обязательные тесты:**
- End-to-end: timer → process_users → batch AI → send news
- Queue integration: post → accept → handler
- Missed notifications logic

### 10.3 Performance Tests

**Обязательные тесты:**
- Batch 50 пользователей < 2 минуты
- Queue throughput

---

## 11. Migration from Legacy

**Legacy implementation:** `legacy/timer-handler.js`

### 11.1 Изменения

| Legacy | New (v1.0.0) | Изменения |
|--------|--------------|-----------|
| ContentBus | ReportsBus | Новый модуль |
| Нет workspace_id | workspace_id обязателен | Workspace isolation |
| get_dialog() global | DialogSystem.get_dialog() | Модульная архитектура |
| ContentBus.collect_friends_data | ReportsBus.collect_content_for_users | Новый API |

### 11.2 Сохранено

- ✅ Queue pattern (@dieugene/queuer)
- ✅ Batch processing logic
- ✅ Missed notifications logic
- ✅ Proactive dialog initiation

---

## 12. Acceptance Criteria

### Критерии приемки модуля:

- ✅ invoke() запускается по таймеру
- ✅ process_users() обрабатывает batch до 50
- ✅ Batch AI через ReportsBus работает
- ✅ Threshold check и отправка новостей
- ✅ Proactive dialog initiation работает
- ✅ Missed notifications logic корректна
- ✅ Queue pattern работает
- ✅ Error handling для edge cases
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests проходят
- ✅ Performance: batch 50 users < 2 мин

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/timer-handler-api.md`
