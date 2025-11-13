# Спецификация модуля: NotificationRouter

**Роль:** Architect
**Фаза:** Phase 3 - Priority 2 (Feature Modules)
**Приоритет:** Priority 2 (Important - коммуникация)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**NotificationRouter** — модуль для маршрутизации уведомлений и сводок руководителям workspace. Модуль отправляет daily/weekly summaries из SummaryGenerator через Telegram, управляет расписанием уведомлений и персонализирует сообщения.

### Ключевые концепции:

**Notification Routing** — определение кому и когда отправлять сводки (leads workspace).

**Schedule Management** — расписание отправки (daily at 9AM, weekly on Monday).

**Message Personalization** — опциональная персонализация через LLM.

**Telegram Delivery** — отправка через Telegraf (Telegram Bot API).

### Назначение модуля:

- Отправка daily summaries руководителям утром
- Отправка weekly summaries в конце недели
- Отправка mood alerts при критических ситуациях
- Управление расписанием уведомлений
- Персонализация сообщений для каждого lead

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ NotificationRouter:

✅ **Notification Delivery:**
- Отправка summaries через Telegram Bot
- Форматирование messages (HTML/Markdown)
- Управление отправкой по расписанию

✅ **Routing Logic:**
- Определение leads workspace (через WorkspaceManager)
- Фильтрация: кому отправлять
- Приоритизация уведомлений (critical, important, info)

✅ **Schedule Management:**
- Daily summaries (default: 9AM каждый день)
- Weekly summaries (default: Monday 10AM)
- Mood alerts (on-demand при critical mood)

✅ **Message Personalization:**
- Опциональная персонализация через LLM
- Адаптация тона сообщения под пользователя

### Что НЕ ДЕЛАЕТ NotificationRouter:

❌ Генерация summaries (это SummaryGenerator)
❌ Анализ данных команды (это SummaryGenerator)
❌ Управление workspace (это WorkspaceManager)
❌ Прямая работа с user data (это UsersController)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты
  "telegraf": "^4.0.0",                    // Telegram Bot API
  "node-schedule": "^2.1.0"                // Scheduling (optional)
}
```

### Внутренние модули:

- **SummaryGenerator** — генерация summaries
- **WorkspaceManager** — получение workspace leads
- **DialogSystem** (optional) — персонализация через LLM

### Infrastructure:

- **Telegram Bot API** — отправка сообщений
- **Yandex Cloud Functions Triggers** (optional) — scheduled invocations

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/notification-router.js
├─ NotificationRouter (Main Logic)
│  ├─ send_daily_summary(workspace_id, leads) - отправка daily summary
│  ├─ send_weekly_summary(workspace_id, leads) - отправка weekly summary
│  ├─ send_mood_alert(workspace_id, leads, mood_summary) - alert при critical mood
│  ├─ send_notification(user, message_data) - low-level отправка
│  └─ schedule_daily_summaries() - setup расписания (optional)
│
└─ Helpers
   ├─ get_workspace_leads(workspace_id) - получение leads
   ├─ format_message(summary, format) - форматирование
   ├─ personalize_message(message, user) - персонализация (optional)
   └─ prioritize_notifications(notifications) - приоритизация
```

---

## 5. Алгоритмы и процессы

### 5.1 Процесс: Daily Summary Delivery

```
[send_daily_summary(workspace_id, leads)]
         │
         ├─> ЭТАП 1: Генерация summary
         │    └─> SummaryGenerator.generate_daily_summary(workspace_id)
         │
         ├─> ЭТАП 2: Получение leads
         │    └─> get_workspace_leads(workspace_id)
         │         └─> WorkspaceManager.get_all_workspace_members(workspace_id)
         │              └─> Filter by role = 'lead'
         │
         ├─> ЭТАП 3: Форматирование message
         │    └─> format_message(summary, 'html')
         │         └─> SummaryGenerator.format_summary_output(summary, 'html')
         │
         ├─> ЭТАП 4: Отправка каждому lead
         │    └─> For each lead:
         │         ├─> Optional: personalize_message(message, lead)
         │         └─> send_notification(lead, message_data)
         │              └─> Bot.telegram.sendMessage(lead.telegram_id, message)
         │
         └─> return {sent_count, failed_count}
```

### 5.2 Процесс: Weekly Summary Delivery

```
[send_weekly_summary(workspace_id, leads)]
         │
         ├─> ЭТАП 1: Генерация weekly summary
         │    └─> SummaryGenerator.generate_weekly_summary(workspace_id)
         │
         ├─> ЭТАП 2: Получение leads
         │    └─> get_workspace_leads(workspace_id)
         │
         ├─> ЭТАП 3: Форматирование (rich HTML)
         │    └─> format_message(summary, 'html')
         │         └─> Include: summary_text, top_achievements, concerns, trends, recommendations
         │
         ├─> ЭТАП 4: Отправка
         │    └─> For each lead:
         │         └─> send_notification(lead, weekly_message)
         │
         └─> return {sent_count, failed_count}
```

### 5.3 Процесс: Mood Alert (Critical)

```
[send_mood_alert(workspace_id, leads, mood_summary)]
         │
         ├─> ЭТАП 1: Проверка критичности
         │    ├─> If mood_summary.overall_mood !== 'negative' → skip
         │    └─> If at_risk_members.length === 0 → skip
         │
         ├─> ЭТАП 2: Формирование alert message
         │    └─> "🚨 ALERT: Team mood is negative!"
         │         "At-risk members: ..."
         │         "Burnout indicators: ..."
         │         "Recommendations: ..."
         │
         ├─> ЭТАП 3: Отправка URGENT notification
         │    └─> For each lead:
         │         └─> send_notification(lead, alert_message, priority='urgent')
         │
         └─> return {sent_count}
```

### 5.4 Процесс: Scheduled Daily Summaries (optional)

```
[schedule_daily_summaries()]
         │
         ├─> Setup cron schedule (9AM daily)
         │    └─> node-schedule.scheduleJob('0 9 * * *', async () => {
         │         └─> For each workspace:
         │              └─> send_daily_summary(workspace_id)
         │         })
         │
         └─> Log: "Daily summaries scheduled at 9AM"
```

---

## 6. API спецификация

> **Детальный API contract** будет в `.agents/specs/api-contracts/notification-router-api.md`

### 6.1 send_daily_summary()

**Назначение:** Отправка daily summary всем leads workspace

**Сигнатура:**
```javascript
async function send_daily_summary(workspace_id, date = null)
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `date` (String, optional, default=today) — дата YYYY-MM-DD

**Возвращает:** `Promise<Object>` — {sent_count, failed_count, errors}

**Алгоритм:**
1. Generate daily summary через SummaryGenerator
2. Get workspace leads
3. Format message (HTML)
4. Send to each lead
5. Return stats

---

### 6.2 send_weekly_summary()

**Назначение:** Отправка weekly summary всем leads

**Сигнатура:**
```javascript
async function send_weekly_summary(workspace_id, week_start = null)
```

**Параметры:**
- `workspace_id` (String, required)
- `week_start` (String, optional, default=this Monday)

**Возвращает:** `Promise<Object>` — {sent_count, failed_count, errors}

---

### 6.3 send_mood_alert()

**Назначение:** Отправка alert при critical mood

**Сигнатура:**
```javascript
async function send_mood_alert(workspace_id, mood_summary = null)
```

**Параметры:**
- `workspace_id` (String, required)
- `mood_summary` (Object, optional) — если null, генерируется автоматически

**Возвращает:** `Promise<Object>` — {sent_count, skipped, reason}

---

### 6.4 send_notification()

**Назначение:** Low-level отправка notification пользователю

**Сигнатура:**
```javascript
async function send_notification(user, message_data, options = {})
```

**Параметры:**
- `user` (Object, required) — объект пользователя с telegram_id
- `message_data` (Object, required) — {text, format, priority}
- `options` (Object, optional) — {parse_mode, disable_notification}

**Возвращает:** `Promise<Boolean>` — true если успешно

---

## 7. Helper Functions

### 7.1 get_workspace_leads()

**Назначение:** Получение всех leads workspace

**Сигнатура:**
```javascript
async function get_workspace_leads(workspace_id)
```

**Параметры:**
- `workspace_id` (String, required)

**Возвращает:** `Promise<Array<Object>>` — массив lead objects

**Алгоритм:**
```javascript
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
const leads = members.filter(m => m.role === 'lead');
return leads;
```

---

### 7.2 format_message()

**Назначение:** Форматирование summary в Telegram-friendly HTML

**Сигнатура:**
```javascript
function format_message(summary, format = 'html')
```

**Параметры:**
- `summary` (Object, required) — summary object
- `format` (String, optional) — 'html' | 'markdown' | 'text'

**Возвращает:** `String` — formatted message

**Использует:** `SummaryGenerator.format_summary_output()`

---

### 7.3 personalize_message() (optional)

**Назначение:** Персонализация сообщения для конкретного lead (optional)

**Сигнатура:**
```javascript
async function personalize_message(message, user)
```

**Параметры:**
- `message` (String, required) — base message
- `user` (Object, required) — lead user object

**Возвращает:** `Promise<String>` — personalized message

**Алгоритм:**
- Опционально: вызов LLM для адаптации тона
- Добавление имени lead: "Привет, {name}!"
- Адаптация под предпочтения (если есть)

---

## 8. Configuration

### 8.1 Environment Variables

```javascript
{
    TELEGRAM_BOT_TOKEN: String,     // Required
    NOTIFICATION_TIMEZONE: String,  // Default: 'Europe/Moscow'
    DAILY_SUMMARY_TIME: String,     // Default: '09:00'
    WEEKLY_SUMMARY_DAY: String,     // Default: 'Monday'
    WEEKLY_SUMMARY_TIME: String,    // Default: '10:00'
}
```

### 8.2 Constants

```javascript
const DAILY_SUMMARY_TIME = process.env.DAILY_SUMMARY_TIME || '09:00';
const WEEKLY_SUMMARY_DAY = process.env.WEEKLY_SUMMARY_DAY || 'Monday';
const WEEKLY_SUMMARY_TIME = process.env.WEEKLY_SUMMARY_TIME || '10:00';
const NOTIFICATION_TIMEZONE = process.env.NOTIFICATION_TIMEZONE || 'Europe/Moscow';
```

---

## 9. Edge Cases и Error Handling

### 9.1 Edge Case: Нет leads в workspace

**Ситуация:** get_workspace_leads() вернул []

**Решение:**
- Логировать: "No leads found in workspace {id}"
- Return {sent_count: 0, skipped: true, reason: 'No leads'}

### 9.2 Edge Case: Telegram API недоступен

**Ситуация:** sendMessage() выбросил ошибку (rate limit, network)

**Решение:**
- Try-catch на каждую отправку
- Логировать failed sends
- Return {sent_count: X, failed_count: Y, errors: [...]}
- НЕ прерывать отправку другим leads

### 9.3 Edge Case: Summary generation failed

**Ситуация:** SummaryGenerator.generate_daily_summary() выбросил ошибку

**Решение:**
- Логировать ошибку
- Fallback: отправить simple notification "Summary недоступен сегодня"
- Или skip отправку (зависит от critical ли это)

---

## 10. Performance Considerations

### 10.1 Batch Sending

**Проблема:** Отправка 10+ leads = долго

**Решение:**
- Параллельная отправка (Promise.all)
- Timeout между отправками (100ms) для rate limiting

### 10.2 Caching

**Проблема:** Генерация summary для каждого workspace дорого

**Решение:**
- Генерировать summary один раз
- Кешировать результат (5 min TTL)
- Переиспользовать для всех leads

---

## 11. Testing Requirements

### 11.1 Unit Tests

**Обязательные тесты:**
- send_daily_summary() - success, no leads, summary failed
- send_notification() - success, Telegram error
- get_workspace_leads() - exists, empty, workspace not found
- format_message() - HTML, Markdown, Text

**Mocks:**
- SummaryGenerator methods
- WorkspaceManager.get_all_workspace_members()
- Bot.telegram.sendMessage()

### 11.2 Integration Tests

**Обязательные тесты:**
- End-to-end: generate summary → send to lead
- Telegram API real calls (test environment)
- Scheduled sending (if implemented)

---

## 12. Migration from Legacy

**Legacy implementation:** НЕТ (новый модуль)

**Новая функциональность:**
- Centralized notification routing
- Schedule management
- Message personalization

---

## 13. Acceptance Criteria

### Критерии приемки модуля:

- ✅ send_daily_summary() работает корректно
- ✅ send_weekly_summary() с rich formatting
- ✅ send_mood_alert() при critical situations
- ✅ get_workspace_leads() returns correct leads
- ✅ Telegram integration работает
- ✅ Error handling для edge cases
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests с Telegram
- ✅ HTML/Markdown formatting

---

## 14. Future Enhancements (v2.0.0)

- Персонализация через LLM (adapt tone)
- Email delivery (в addition to Telegram)
- Slack integration
- User preferences (частота уведомлений)
- Notification history (отправленные сообщения)
- A/B testing для форматов сообщений

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/notification-router-api.md`
