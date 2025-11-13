# API Contract: SummaryGenerator Module v1.0.0

**Module:** SummaryGenerator
**Version:** 1.0.0
**Phase:** Phase 3 - Priority 2
**Created:** 2025-11-09

---

## Table of Contents

1. [Overview](#overview)
2. [Module Exports](#module-exports)
3. [Main API Functions](#main-api-functions)
4. [Helper Functions](#helper-functions)
5. [Data Types](#data-types)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)
8. [LLM Integration](#llm-integration)

---

## 1. Overview

SummaryGenerator предоставляет API для генерации AI-driven сводок о состоянии workspace для руководителей. Модуль использует данные из ReportsBus и WorkspaceManager, обрабатывает их через LLM (gpt-4o) и возвращает структурированные summary объекты.

**Основные возможности:**
- Ежедневные сводки (daily summary)
- Недельные обзоры (weekly summary)
- Анализ настроения команды (mood analysis)
- Определение рисков и блокеров
- Рекомендации для руководителей

---

## 2. Module Exports

```javascript
module.exports = {
    // Main API
    generate_daily_summary,
    generate_weekly_summary,
    generate_initiatives_summary,
    generate_mood_summary,
    generate_custom_summary,

    // Helper Functions (for testing)
    collect_workspace_activity,
    analyze_team_mood,
    detect_risks,
    format_summary_output
};
```

---

## 3. Main API Functions

### 3.1 generate_daily_summary()

**Назначение:** Генерация ежедневной сводки о состоянии команды

**Сигнатура:**
```javascript
async function generate_daily_summary(workspace_id, date = null)
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `date` (String, optional, default=today) — дата в формате 'YYYY-MM-DD'

**Возвращает:** `Promise<DailySummary>`

**DailySummary Type:**
```typescript
interface DailySummary {
    type: 'daily';
    workspace_id: string;
    workspace_name: string;
    date: string;              // YYYY-MM-DD
    summary_text: string;      // AI-generated summary
    highlights: string[];      // Top achievements/updates
    risks: string[];           // Detected risks
    mood: 'positive' | 'neutral' | 'negative';
    members_active: number;    // Count of active members
    members_total: number;     // Total members
    activity_score: number;    // 0.0 - 1.0
    generated_at: number;      // timestamp seconds
}
```

**Алгоритм:**
1. Получение workspace info через WorkspaceManager
2. Сбор активности за дату через collect_workspace_activity()
3. Формирование prompt для LLM
4. AI генерация сводки через ChatOpenAI
5. Структурирование output
6. Возврат DailySummary объекта

**Throws:**
- `Error('Workspace not found')` — workspace_id не существует
- `Error('LLM generation failed')` — ошибка OpenAI API

**Примеры:**

```javascript
// Сводка за сегодня
const summary = await generate_daily_summary('ws-123');
console.log(summary.summary_text);
// "Сегодня команда показала высокую активность..."

// Сводка за конкретную дату
const summary = await generate_daily_summary('ws-123', '2025-11-08');
```

**Edge Cases:**
- Если date = будущая дата → Error
- Если нет активности за дату → summary_text = "Нет активности", highlights = []
- Если LLM недоступен → fallback на template-based summary

---

### 3.2 generate_weekly_summary()

**Назначение:** Генерация недельной сводки с трендами и достижениями

**Сигнатура:**
```javascript
async function generate_weekly_summary(workspace_id, week_start = null)
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `week_start` (String, optional, default=this Monday) — начало недели 'YYYY-MM-DD'

**Возвращает:** `Promise<WeeklySummary>`

**WeeklySummary Type:**
```typescript
interface WeeklySummary {
    type: 'weekly';
    workspace_id: string;
    workspace_name: string;
    week_start: string;        // YYYY-MM-DD (Monday)
    week_end: string;          // YYYY-MM-DD (Sunday)
    summary_text: string;      // AI-generated summary
    top_achievements: string[]; // Top 3-5 achievements
    concerns: string[];        // Issues, blockers
    trends: {
        mood: 'improving' | 'stable' | 'declining';
        activity: 'high' | 'medium' | 'low';
        collaboration: 'increasing' | 'stable' | 'decreasing';
    };
    most_active: string[];     // Top 3 user_uuids
    inactive: string[];        // Inactive user_uuids (>3 days)
    recommendations: string[]; // Action items
    generated_at: number;
}
```

**Алгоритм:**
1. Определение week_start (Monday) и week_end (Sunday)
2. Сбор активности за неделю
3. Анализ трендов (сравнение с предыдущей неделей)
4. Определение most active / inactive members
5. AI генерация через LLM
6. Формирование recommendations
7. Возврат WeeklySummary

**Throws:**
- `Error('Workspace not found')`
- `Error('LLM generation failed')`

**Примеры:**

```javascript
// Сводка за текущую неделю
const summary = await generate_weekly_summary('ws-123');

console.log(summary.top_achievements);
// ["Завершено 5 проектов", "Проведена презентация"]

console.log(summary.trends.mood);
// "improving"

console.log(summary.recommendations);
// ["1-on-1 с неактивными участниками", "Уточнить блокеры по проекту Y"]
```

**Edge Cases:**
- Если week_start не понедельник → автоматически сдвинуть на понедельник
- Если нет данных за неделю → trends = 'stable', achievements = []

---

### 3.3 generate_initiatives_summary()

**Назначение:** Сводка по инициативам и проектам

**Сигнатура:**
```javascript
async function generate_initiatives_summary(workspace_id)
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace

**Возвращает:** `Promise<InitiativesSummary>`

**InitiativesSummary Type:**
```typescript
interface Initiative {
    name: string;
    status: 'on_track' | 'delayed' | 'blocked';
    contributors: string[];    // user_uuids
    last_update: string;       // Latest news/update
    blockers: string[];        // Issues blocking progress
}

interface InitiativesSummary {
    type: 'initiatives';
    workspace_id: string;
    workspace_name: string;
    summary_text: string;
    initiatives: Initiative[];
    priorities: string[];      // Top 3-5 initiative names
    recommendations: string[];
    generated_at: number;
}
```

**Алгоритм:**
1. Сбор всех processed records за последние 30 дней
2. Извлечение инициатив/проектов из текста (keyword-based)
   - Future: интеграция с InitiativesTracker
3. Группировка по инициативам
4. Определение статуса (on_track, delayed, blocked)
5. AI генерация сводки
6. Формирование recommendations

**Throws:**
- `Error('Workspace not found')`
- `Error('LLM generation failed')`

**Примеры:**

```javascript
const summary = await generate_initiatives_summary('ws-123');

console.log(summary.initiatives);
// [
//   {
//     name: "Проект X",
//     status: "on_track",
//     contributors: ["user-1", "user-2"],
//     last_update: "Завершена интеграция",
//     blockers: []
//   },
//   {
//     name: "Проект Y",
//     status: "delayed",
//     contributors: ["user-3"],
//     last_update: "Ожидание ресурсов",
//     blockers: ["Нет доступа к API"]
//   }
// ]

console.log(summary.priorities);
// ["Проект X", "Проект Y"]
```

**Edge Cases:**
- Если нет инициатив → initiatives = [], summary_text = "Нет активных инициатив"
- Если InitiativesTracker недоступен → fallback на keyword extraction

---

### 3.4 generate_mood_summary()

**Назначение:** Анализ настроения команды с выявлением at-risk участников

**Сигнатура:**
```javascript
async function generate_mood_summary(workspace_id, period = '7d')
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `period` (String, optional, default='7d') — период анализа: '1d', '7d', '30d'

**Возвращает:** `Promise<MoodSummary>`

**MoodSummary Type:**
```typescript
interface AtRiskMember {
    user_uuid: string;
    name: string;
    mood_score: number;        // -1.0 to 1.0
    activity_level: 'high' | 'medium' | 'low';
    last_shared: number;       // days ago
}

interface MoodSummary {
    type: 'mood';
    workspace_id: string;
    workspace_name: string;
    period: string;            // '7d', '30d'
    summary_text: string;
    overall_mood: 'positive' | 'neutral' | 'negative';
    mood_distribution: {
        positive: number;      // 0.0 - 1.0
        neutral: number;
        negative: number;
    };
    mood_trend: 'improving' | 'stable' | 'declining';
    at_risk_members: AtRiskMember[];
    burnout_indicators: string[];
    recommendations: string[];
    generated_at: number;
}
```

**Алгоритм:**
1. Сбор активности за period
2. Для каждого участника:
   - Расчет mood_score (sentiment analysis keyword-based)
   - Определение activity_level
   - Подсчет days since last_shared
3. Агрегация в overall_mood
4. Определение mood_trend (сравнение с предыдущим периодом)
5. Выявление at_risk_members (low mood + low activity)
6. Определение burnout indicators
7. AI генерация recommendations

**Mood Score Calculation:**
```javascript
// Keyword-based sentiment (v1.0.0)
positive_keywords = ['завершил', 'успешно', 'отлично', 'прогресс', 'достижение'];
negative_keywords = ['блокер', 'проблема', 'задержка', 'сложность', 'не получается'];

mood_score = (positive_count - negative_count) / total_updates;
// Нормализация: -1.0 (very negative) to 1.0 (very positive)
```

**Throws:**
- `Error('Workspace not found')`
- `Error('Invalid period format')`

**Примеры:**

```javascript
// Анализ настроения за неделю
const summary = await generate_mood_summary('ws-123', '7d');

console.log(summary.overall_mood);
// "positive"

console.log(summary.mood_distribution);
// { positive: 0.60, neutral: 0.30, negative: 0.10 }

console.log(summary.at_risk_members);
// [
//   {
//     user_uuid: "user-10",
//     name: "Петр",
//     mood_score: -0.5,
//     activity_level: "low",
//     last_shared: 5
//   }
// ]

console.log(summary.recommendations);
// ["1-on-1 с Петром для выяснения проблем"]
```

**Edge Cases:**
- Если period невалидный → Error
- Если нет данных → overall_mood = 'neutral', at_risk = []
- Если все участники at-risk → critical alert в recommendations

---

### 3.5 generate_custom_summary()

**Назначение:** Генерация кастомной сводки с заданными параметрами

**Сигнатура:**
```javascript
async function generate_custom_summary(workspace_id, options)
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `options` (Object, required) — параметры сводки

**Options Type:**
```typescript
interface CustomSummaryOptions {
    type?: string;             // Тип сводки или 'custom'
    date_range?: {
        start: string;         // YYYY-MM-DD
        end: string;           // YYYY-MM-DD
    };
    focus?: string[];          // ['activity', 'mood', 'initiatives', 'risks']
    include_risks?: boolean;   // default: true
    include_recommendations?: boolean; // default: true
    format?: 'html' | 'markdown' | 'text'; // default: 'text'
}
```

**Возвращает:** `Promise<CustomSummary>`

**CustomSummary Type:**
```typescript
interface CustomSummary {
    type: string;
    workspace_id: string;
    workspace_name: string;
    date_range: {
        start: string;
        end: string;
    };
    summary_text: string;
    sections: {
        [key: string]: any;    // Dynamic sections based on focus
    };
    generated_at: number;
}
```

**Примеры:**

```javascript
// Custom сводка за конкретный период с фокусом на риски
const summary = await generate_custom_summary('ws-123', {
    date_range: {
        start: '2025-11-01',
        end: '2025-11-08'
    },
    focus: ['risks', 'mood'],
    include_recommendations: true,
    format: 'html'
});
```

**Edge Cases:**
- Если date_range невалидный → Error
- Если focus пустой → использовать все разделы
- Если format неподдерживаемый → fallback на 'text'

---

## 4. Helper Functions

### 4.1 collect_workspace_activity()

**Назначение:** Сбор активности workspace за заданный период

**Сигнатура:**
```javascript
async function collect_workspace_activity(workspace_id, date_range)
```

**Параметры:**
- `workspace_id` (String, required)
- `date_range` (Object, required) — { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }

**Возвращает:** `Promise<WorkspaceActivity>`

**WorkspaceActivity Type:**
```typescript
interface MemberActivity {
    user_uuid: string;
    name: string;
    role: 'lead' | 'participant';
    updates_count: number;
    last_shared: number;       // timestamp seconds
    news: string[];            // Recent news
    mood_score: number;        // -1.0 to 1.0
}

interface WorkspaceActivity {
    workspace_id: string;
    date_range: {
        start: string;
        end: string;
    };
    members: MemberActivity[];
    total_updates: number;
    active_members_count: number;
    inactive_members_count: number;
}
```

**Алгоритм:**
1. WorkspaceManager.get_all_workspace_members()
2. Для каждого участника:
   - ReportsBus получение processed records за период
   - Подсчет updates
   - Извлечение news
   - Расчет mood_score (keyword-based)
3. Агрегация в WorkspaceActivity

**Примеры:**

```javascript
const activity = await collect_workspace_activity('ws-123', {
    start: '2025-11-01',
    end: '2025-11-08'
});

console.log(activity.members.length);
// 20

console.log(activity.active_members_count);
// 15
```

---

### 4.2 analyze_team_mood()

**Назначение:** Анализ настроения команды на основе activity data

**Сигнатура:**
```javascript
function analyze_team_mood(members_activity, previous_period_data = null)
```

**Параметры:**
- `members_activity` (Array<MemberActivity>, required)
- `previous_period_data` (Array<MemberActivity>, optional) — для trend analysis

**Возвращает:** `Object` — Mood analysis result

**Return Type:**
```typescript
interface MoodAnalysis {
    overall_mood: 'positive' | 'neutral' | 'negative';
    mood_distribution: {
        positive: number;
        neutral: number;
        negative: number;
    };
    mood_trend: 'improving' | 'stable' | 'declining' | null;
    at_risk_members: AtRiskMember[];
    burnout_indicators: string[];
}
```

**Алгоритм:**
1. Для каждого участника определение mood category:
   - mood_score > 0.3 → positive
   - mood_score < -0.3 → negative
   - otherwise → neutral
2. Подсчет распределения (positive %, neutral %, negative %)
3. Определение overall_mood (majority)
4. Если есть previous_period_data:
   - Сравнение average mood_score
   - Определение trend
5. Выявление at_risk: (mood_score < -0.3 AND activity_level = 'low')
6. Burnout indicators: (activity 7 days без перерыва OR mood declining for 2+ weeks)

**Примеры:**

```javascript
const mood_analysis = analyze_team_mood(activity.members);

console.log(mood_analysis.overall_mood);
// "positive"

console.log(mood_analysis.at_risk_members.length);
// 2
```

---

### 4.3 detect_risks()

**Назначение:** Определение рисков и блокеров в команде

**Сигнатура:**
```javascript
function detect_risks(members_activity)
```

**Параметры:**
- `members_activity` (Array<MemberActivity>, required)

**Возвращает:** `Array<String>` — Список рисков

**Risk Detection Logic:**
```javascript
// 1. Inactive Members (> 3 days без sharing)
if (days_since_last_shared > 3) {
    risks.push(`${member.name} не делился ${days_since_last_shared} дней`);
}

// 2. Blockers (keyword detection в news)
blocker_keywords = ['блокер', 'задержка', 'проблема', 'не могу', 'застрял'];
if (news contains blocker_keywords) {
    risks.push(`${member.name}: обнаружен блокер - "${news_text}"`);
}

// 3. Overwork (7+ days подряд с updates)
if (consecutive_days_with_updates >= 7) {
    risks.push(`${member.name} работает ${consecutive_days} дней без перерыва - риск burnout`);
}

// 4. Team Inactivity (> 50% inactive)
if (inactive_members_count / total_members > 0.5) {
    risks.push(`Критическая неактивность: ${inactive_percent}% команды неактивны`);
}
```

**Примеры:**

```javascript
const risks = detect_risks(activity.members);

console.log(risks);
// [
//   "Петр не делился 5 дней",
//   "Иван: обнаружен блокер - 'Нет доступа к API'",
//   "Мария работает 10 дней без перерыва - риск burnout"
// ]
```

---

### 4.4 format_summary_output()

**Назначение:** Форматирование summary в HTML/Markdown/Text

**Сигнатура:**
```javascript
function format_summary_output(summary_data, format = 'text')
```

**Параметры:**
- `summary_data` (Object, required) — любой summary object
- `format` (String, optional) — 'html' | 'markdown' | 'text'

**Возвращает:** `String` — formatted output

**Примеры:**

```javascript
// HTML format
const html = format_summary_output(daily_summary, 'html');
// "<h1>Daily Summary: 2025-11-09</h1><p>...</p>"

// Markdown format
const md = format_summary_output(daily_summary, 'markdown');
// "# Daily Summary: 2025-11-09\n\n..."

// Plain text (default)
const text = format_summary_output(daily_summary);
// "Daily Summary: 2025-11-09\n\n..."
```

---

## 5. Data Types

### 5.1 Common Types

```typescript
type MoodType = 'positive' | 'neutral' | 'negative';
type TrendType = 'improving' | 'stable' | 'declining';
type ActivityLevel = 'high' | 'medium' | 'low';
type InitiativeStatus = 'on_track' | 'delayed' | 'blocked';
type Period = '1d' | '7d' | '30d';
```

### 5.2 Summary Base

```typescript
interface SummaryBase {
    type: string;
    workspace_id: string;
    workspace_name: string;
    generated_at: number;      // timestamp seconds
}
```

---

## 6. Error Handling

### 6.1 Error Types

```javascript
// Workspace errors
throw new Error('Workspace not found');
throw new Error('Workspace has no members');

// Date errors
throw new Error('Invalid date format (expected YYYY-MM-DD)');
throw new Error('Invalid date range (start > end)');
throw new Error('Future date not allowed');

// LLM errors
throw new Error('LLM generation failed: ' + error.message);
throw new Error('OpenAI API rate limit exceeded');

// Data errors
throw new Error('No activity data available for period');
```

### 6.2 Error Handling Strategy

```javascript
async function generate_daily_summary(workspace_id, date) {
    try {
        // Main logic

    } catch (error) {
        I.log_error(error, `generate_daily_summary workspace:${workspace_id}`);

        // Fallback для LLM errors
        if (error.message.includes('LLM')) {
            return generate_fallback_daily_summary(workspace_id, date);
        }

        throw error;
    }
}
```

### 6.3 Fallback Strategy

Если LLM недоступен, использовать template-based generation:

```javascript
function generate_fallback_daily_summary(workspace_id, date) {
    return {
        type: 'daily',
        workspace_id,
        date,
        summary_text: `За ${date}: ${members_active}/${members_total} участников активны. ` +
                     `Зафиксировано ${total_updates} обновлений.`,
        highlights: top_news.slice(0, 3),
        risks: detected_risks,
        mood: 'neutral',
        members_active,
        members_total,
        activity_score: members_active / members_total,
        generated_at: I.get_seconds_now()
    };
}
```

---

## 7. Usage Examples

### 7.1 Daily Summary для руководителя

```javascript
const SummaryGenerator = require('./modules/summary-generator');

// Утром руководитель получает сводку
async function send_daily_summary_to_lead(workspace_id, lead_user_uuid) {
    try {
        // Генерация сводки
        const summary = await SummaryGenerator.generate_daily_summary(workspace_id);

        // Форматирование в HTML
        const html = SummaryGenerator.format_summary_output(summary, 'html');

        // Отправка через NotificationRouter
        // await NotificationRouter.send_to_user(lead_user_uuid, html);

        console.log('Daily summary sent to lead');

    } catch (error) {
        console.error('Failed to send daily summary:', error);
    }
}
```

### 7.2 Weekly Review в конце недели

```javascript
// В пятницу вечером
async function generate_week_review(workspace_id) {
    const weekly = await SummaryGenerator.generate_weekly_summary(workspace_id);

    console.log('=== Weekly Summary ===');
    console.log(weekly.summary_text);
    console.log('\n🏆 Top Achievements:');
    weekly.top_achievements.forEach(a => console.log(`  - ${a}`));
    console.log('\n⚠️ Concerns:');
    weekly.concerns.forEach(c => console.log(`  - ${c}`));
    console.log('\n📊 Trends:');
    console.log(`  Mood: ${weekly.trends.mood}`);
    console.log(`  Activity: ${weekly.trends.activity}`);
    console.log('\n💡 Recommendations:');
    weekly.recommendations.forEach(r => console.log(`  - ${r}`));
}
```

### 7.3 Mood Monitoring для HR

```javascript
// Еженедельный mood анализ
async function monitor_team_mood(workspace_id) {
    const mood = await SummaryGenerator.generate_mood_summary(workspace_id, '7d');

    // Alert если overall mood negative
    if (mood.overall_mood === 'negative') {
        console.log('🚨 ALERT: Team mood is negative!');
        console.log('At-risk members:', mood.at_risk_members.length);

        // Автоматические действия
        for (const member of mood.at_risk_members) {
            console.log(`Schedule 1-on-1 with ${member.name}`);
        }
    }

    // Burnout indicators
    if (mood.burnout_indicators.length > 0) {
        console.log('⚠️ Burnout Indicators:');
        mood.burnout_indicators.forEach(i => console.log(`  - ${i}`));
    }
}
```

### 7.4 Initiatives Tracking для Project Manager

```javascript
// Статус встреча по проектам
async function initiatives_status_meeting(workspace_id) {
    const initiatives = await SummaryGenerator.generate_initiatives_summary(workspace_id);

    console.log('=== Initiatives Status ===');

    // On Track
    const on_track = initiatives.initiatives.filter(i => i.status === 'on_track');
    console.log(`\n✅ On Track (${on_track.length}):`);
    on_track.forEach(i => console.log(`  - ${i.name}: ${i.last_update}`));

    // Delayed
    const delayed = initiatives.initiatives.filter(i => i.status === 'delayed');
    console.log(`\n⏰ Delayed (${delayed.length}):`);
    delayed.forEach(i => console.log(`  - ${i.name}: ${i.last_update}`));

    // Blocked
    const blocked = initiatives.initiatives.filter(i => i.status === 'blocked');
    console.log(`\n🚫 Blocked (${blocked.length}):`);
    blocked.forEach(i => {
        console.log(`  - ${i.name}`);
        i.blockers.forEach(b => console.log(`    Blocker: ${b}`));
    });
}
```

---

## 8. LLM Integration

### 8.1 Prompt Templates

#### Daily Summary Prompt:

```javascript
const daily_prompt = `
Ты - AI ассистент для руководителей. Сгенерируй краткую ежедневную сводку.

Workspace: ${workspace_name}
Дата: ${date}
Участников активно: ${members_active}/${members_total}

Активность за день:
${members.map(m => `- ${m.name}: ${m.updates_count} обновлений`).join('\n')}

Новости:
${all_news.join('\n')}

Создай сводку в следующем формате:
1. Краткий summary (2-3 предложения)
2. Highlights (топ 3 достижения)
3. Risks (если есть)
4. Общее настроение команды (positive/neutral/negative)

Формат ответа: JSON
{
  "summary_text": "...",
  "highlights": ["...", "..."],
  "risks": ["..."],
  "mood": "positive"
}
`;
```

#### Weekly Summary Prompt:

```javascript
const weekly_prompt = `
Сгенерируй недельную сводку для руководителя.

Workspace: ${workspace_name}
Период: ${week_start} - ${week_end}

Активность по дням:
${daily_activity_summary}

Участники:
- Самые активные: ${most_active.join(', ')}
- Неактивные (> 3 дней): ${inactive.join(', ')}

Тренды:
- Предыдущая неделя: ${prev_week_stats}
- Текущая неделя: ${current_week_stats}

Создай сводку:
1. Итоги недели (3-4 предложения)
2. Топ достижения (3-5)
3. Concerns и блокеры
4. Тренды (mood, activity, collaboration)
5. Рекомендации

Формат ответа: JSON
{
  "summary_text": "...",
  "top_achievements": ["..."],
  "concerns": ["..."],
  "trends": {"mood": "...", "activity": "...", "collaboration": "..."},
  "recommendations": ["..."]
}
`;
```

### 8.2 LLM Configuration

```javascript
const { ChatOpenAI } = require('@langchain/openai');

const llm = new ChatOpenAI({
    modelName: process.env.SUMMARY_MODEL || 'gpt-4o',
    temperature: parseFloat(process.env.SUMMARY_TEMPERATURE) || 0.3,
    maxTokens: parseInt(process.env.SUMMARY_MAX_TOKENS) || 2000,
    openAIApiKey: process.env.OPENAI_API_KEY
});
```

### 8.3 Structured Output with Zod

```javascript
const { z } = require('zod');

const DailySummarySchema = z.object({
    summary_text: z.string(),
    highlights: z.array(z.string()).max(5),
    risks: z.array(z.string()),
    mood: z.enum(['positive', 'neutral', 'negative'])
});

// LLM call with structured output
const structured_llm = llm.withStructuredOutput(DailySummarySchema);
const result = await structured_llm.invoke(prompt);
```

---

## 9. Performance Specifications

### 9.1 Performance Targets

| Метрика | Target | Примечания |
|---------|--------|------------|
| generate_daily_summary | < 5s | Для workspace до 100 members |
| generate_weekly_summary | < 10s | Для workspace до 100 members |
| collect_workspace_activity | < 3s | Batch queries через ReportsBus |
| LLM generation | < 3s | gpt-4o average |

### 9.2 Optimization Strategies

- Параллельные запросы к ReportsBus для разных members
- Caching workspace info (5 min TTL)
- Limit на количество processed records (последние 100)
- Temperature = 0.3 (более предсказуемый, быстрее)

---

## 10. Testing Requirements

### 10.1 Unit Tests

```javascript
describe('SummaryGenerator', () => {
    describe('generate_daily_summary()', () => {
        it('should generate summary for active workspace');
        it('should handle empty activity');
        it('should fallback when LLM fails');
    });

    describe('analyze_team_mood()', () => {
        it('should detect positive mood');
        it('should detect negative mood');
        it('should identify at-risk members');
    });

    describe('detect_risks()', () => {
        it('should detect inactive members (>3 days)');
        it('should detect blockers from keywords');
        it('should detect burnout (7+ days)');
    });
});
```

### 10.2 Integration Tests

```javascript
describe('SummaryGenerator Integration', () => {
    it('should generate daily summary with real workspace data');
    it('should call LLM and return structured output');
    it('should handle workspace with no activity');
});
```

---

## 11. Configuration

### 11.1 Environment Variables

```javascript
{
    OPENAI_API_KEY: String,         // Required
    SUMMARY_MODEL: String,          // Default: 'gpt-4o'
    SUMMARY_TEMPERATURE: Number,    // Default: 0.3
    SUMMARY_MAX_TOKENS: Number      // Default: 2000
}
```

---

**Status:** ✅ Complete API Contract
**Next Step:** Implementation (Developer phase)
**Version:** 1.0.0
**Created:** 2025-11-09
