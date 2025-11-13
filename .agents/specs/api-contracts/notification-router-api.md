# API Contract: NotificationRouter Module v1.0.0

**Module:** NotificationRouter
**Version:** 1.0.0
**Phase:** Phase 3 - Priority 2
**Created:** 2025-11-09

---

## 1. Overview

NotificationRouter обеспечивает доставку AI-generated summaries руководителям workspace через Telegram Bot API. Модуль управляет routing логикой, форматированием и error handling.

---

## 2. Module Exports

```javascript
module.exports = {
    // Main API
    send_daily_summary,
    send_weekly_summary,
    send_mood_alert,
    send_notification,

    // Helper Functions
    get_workspace_leads,
    format_message
};
```

---

## 3. Main API Functions

### 3.1 send_daily_summary()

**Сигнатура:**
```javascript
async function send_daily_summary(workspace_id, date = null)
```

**Параметры:**
- `workspace_id` (String, required)
- `date` (String, optional, default=today) - YYYY-MM-DD

**Возвращает:** `Promise<Object>`
```typescript
{
    sent_count: number;
    failed_count: number;
    errors: Array<{user_uuid: string, error: string}>;
}
```

**Алгоритм:**
1. Generate daily summary через SummaryGenerator
2. Get workspace leads
3. Format message (HTML)
4. Send to each lead via Telegram
5. Return stats

**Примеры:**
```javascript
const result = await send_daily_summary('ws-123');
// {sent_count: 3, failed_count: 0, errors: []}
```

---

### 3.2 send_weekly_summary()

**Сигнатура:**
```javascript
async function send_weekly_summary(workspace_id, week_start = null)
```

**Параметры:**
- `workspace_id` (String, required)
- `week_start` (String, optional, default=this Monday)

**Возвращает:** `Promise<Object>` - same as send_daily_summary

**Примеры:**
```javascript
const result = await send_weekly_summary('ws-123');
// {sent_count: 3, failed_count: 0, errors: []}
```

---

### 3.3 send_mood_alert()

**Сигнатура:**
```javascript
async function send_mood_alert(workspace_id, mood_summary = null)
```

**Параметры:**
- `workspace_id` (String, required)
- `mood_summary` (Object, optional) - if null, generates automatically

**Возвращает:** `Promise<Object>`
```typescript
{
    sent_count: number;
    skipped: boolean;
    reason?: string;  // if skipped
}
```

**Logic:**
- If mood is not 'negative' → skip
- If no at_risk_members → skip
- Otherwise → send alert to all leads

**Примеры:**
```javascript
const result = await send_mood_alert('ws-123');
// {sent_count: 3, skipped: false} OR {sent_count: 0, skipped: true, reason: 'Mood is positive'}
```

---

### 3.4 send_notification()

**Сигнатура:**
```javascript
async function send_notification(user, message_data, options = {})
```

**Параметры:**
- `user` (Object, required) - {telegram_id, name, user_uuid}
- `message_data` (Object, required) - {text, format?, priority?}
- `options` (Object, optional) - {parse_mode?, disable_notification?}

**Возвращает:** `Promise<Boolean>` - true if sent successfully

**Примеры:**
```javascript
const success = await send_notification(
    {telegram_id: 123456, name: 'Иван'},
    {text: '<b>Daily Summary</b>...', format: 'html'},
    {parse_mode: 'HTML'}
);
// true
```

---

## 4. Helper Functions

### 4.1 get_workspace_leads()

**Сигнатура:**
```javascript
async function get_workspace_leads(workspace_id)
```

**Возвращает:** `Promise<Array<Object>>`
```typescript
Array<{
    user_uuid: string;
    telegram_id: number;
    name: string;
    role: 'lead';
}>
```

**Алгоритм:**
```javascript
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
return members.filter(m => m.role === 'lead');
```

---

### 4.2 format_message()

**Сигнатура:**
```javascript
function format_message(summary, format = 'html')
```

**Параметры:**
- `summary` (Object, required) - summary object from SummaryGenerator
- `format` (String, optional) - 'html' | 'markdown' | 'text'

**Возвращает:** `String` - formatted message ready for Telegram

**Делегирует:**
```javascript
return SummaryGenerator.format_summary_output(summary, format);
```

---

## 5. Data Types

```typescript
interface SendResult {
    sent_count: number;
    failed_count: number;
    errors: Array<{
        user_uuid: string;
        error: string;
    }>;
}

interface MoodAlertResult {
    sent_count: number;
    skipped: boolean;
    reason?: string;
}

interface User {
    user_uuid: string;
    telegram_id: number;
    name: string;
    role: 'lead' | 'participant';
}

interface MessageData {
    text: string;
    format?: 'html' | 'markdown' | 'text';
    priority?: 'urgent' | 'normal' | 'low';
}
```

---

## 6. Error Handling

### 6.1 Telegram Send Errors

```javascript
async function send_notification(user, message_data) {
    try {
        await bot.telegram.sendMessage(
            user.telegram_id,
            message_data.text,
            {parse_mode: 'HTML'}
        );
        return true;
    } catch (error) {
        I.log_error(error, `send_notification user:${user.user_uuid}`);
        return false;
    }
}
```

**Не прерывать** отправку другим leads при ошибке одного.

### 6.2 Summary Generation Errors

```javascript
try {
    const summary = await SummaryGenerator.generate_daily_summary(workspace_id);
} catch (error) {
    I.log_error(error, `generate_daily_summary failed for ${workspace_id}`);
    // Fallback: skip or send simple notification
    return {sent_count: 0, failed_count: 0, errors: []};
}
```

---

## 7. Usage Examples

### 7.1 Daily Summary Cron Job

```javascript
// Cloud Functions Timer Trigger (daily at 9AM)
export async function daily_summary_handler() {
    const workspaces = await get_all_workspaces(); // hypothetical

    for (const ws of workspaces) {
        const result = await NotificationRouter.send_daily_summary(ws.workspace_id);
        console.log(`Sent daily summary to ${ws.name}: ${result.sent_count} leads`);
    }
}
```

### 7.2 Weekly Summary Cron Job

```javascript
// Cloud Functions Timer Trigger (Monday at 10AM)
export async function weekly_summary_handler() {
    const workspaces = await get_all_workspaces();

    for (const ws of workspaces) {
        await NotificationRouter.send_weekly_summary(ws.workspace_id);
    }
}
```

### 7.3 Mood Alert (On-Demand)

```javascript
// Triggered by TimerHandler after mood analysis
async function check_mood_and_alert(workspace_id) {
    const mood = await SummaryGenerator.generate_mood_summary(workspace_id);

    if (mood.overall_mood === 'negative') {
        await NotificationRouter.send_mood_alert(workspace_id, mood);
    }
}
```

---

## 8. Integration Points

### 8.1 SummaryGenerator Integration

```javascript
// Daily
const summary = await SummaryGenerator.generate_daily_summary(workspace_id);

// Weekly
const summary = await SummaryGenerator.generate_weekly_summary(workspace_id);

// Mood
const summary = await SummaryGenerator.generate_mood_summary(workspace_id);

// Format
const html = SummaryGenerator.format_summary_output(summary, 'html');
```

### 8.2 WorkspaceManager Integration

```javascript
const leads = await get_workspace_leads(workspace_id);
// Uses: WorkspaceManager.get_all_workspace_members() + filter by role='lead'
```

### 8.3 Telegram Bot Integration

```javascript
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

await bot.telegram.sendMessage(telegram_id, text, {parse_mode: 'HTML'});
```

---

## 9. Configuration

```javascript
{
    TELEGRAM_BOT_TOKEN: String,     // Required
    NOTIFICATION_TIMEZONE: String,  // Default: 'Europe/Moscow'
    DAILY_SUMMARY_TIME: String,     // Default: '09:00'
    WEEKLY_SUMMARY_TIME: String,    // Default: 'Monday 10:00'
}
```

---

## 10. Testing Requirements

**Unit Tests:**
```javascript
describe('NotificationRouter', () => {
    it('should send daily summary to all leads');
    it('should handle Telegram errors gracefully');
    it('should skip mood alert if mood is positive');
    it('should format messages correctly');
});
```

**Integration Tests:**
```javascript
describe('NotificationRouter Integration', () => {
    it('should send real message via Telegram API');
    it('should integrate with SummaryGenerator');
});
```

---

**Status:** ✅ Complete API Contract
**Next Step:** Implementation
**Version:** 1.0.0
**Created:** 2025-11-09
