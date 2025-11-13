# API Contract: DashboardGenerator Module v1.0.0

**Module:** DashboardGenerator
**Version:** 1.0.0
**Phase:** Phase 5 - Priority 4
**Created:** 2025-11-09

---

## 1. Overview

DashboardGenerator генерирует интерактивные dashboard для руководителей workspace. Модуль агрегирует данные из ReportsBus и SummaryGenerator, визуализирует key metrics и предоставляет AI insights.

---

## 2. Module Exports

```javascript
module.exports = {
    // Main API
    generate_dashboard,
    generate_daily_dashboard,
    generate_weekly_dashboard,
    generate_monthly_dashboard,

    // Helper Functions
    collect_activity_metrics,
    collect_mood_metrics,
    collect_member_metrics,
    calculate_trends,

    // Rendering
    render_telegram_dashboard,
    render_html_dashboard,
    render_json_dashboard
};
```

---

## 3. Main API Functions

### 3.1 generate_dashboard()

**Сигнатура:**
```javascript
async function generate_dashboard(workspace_id, period_config, options = {})
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `period_config` (Object, required) — период конфигурация
- `options` (Object, optional) — опции генерации

**period_config:**
```typescript
{
    type: 'daily' | 'weekly' | 'monthly';
    date: string;  // YYYY-MM-DD or YYYY-MM
}
```

**options:**
```typescript
{
    format?: 'telegram' | 'html' | 'json';  // default: 'telegram'
    include_ai_insights?: boolean;          // default: false
    compare_with_previous?: boolean;        // default: true
}
```

**Возвращает:** `Promise<Object>`
```typescript
{
    dashboard_data: DashboardData;
    rendered_output: string;  // formatted based on format option
}
```

**Примеры:**
```javascript
// Daily dashboard for Telegram
const result = await generate_dashboard(
    'ws-123',
    {type: 'daily', date: '2025-11-09'},
    {format: 'telegram', include_ai_insights: false}
);

// Weekly dashboard with AI insights
const result = await generate_dashboard(
    'ws-123',
    {type: 'weekly', date: '2025-11-04'},
    {format: 'telegram', include_ai_insights: true}
);
```

---

### 3.2 generate_daily_dashboard()

**Сигнатура:**
```javascript
async function generate_daily_dashboard(workspace_id, date = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `date` (String, optional, default=today) — YYYY-MM-DD
- `options` (Object, optional) — {format: 'telegram'}

**Возвращает:** `Promise<Object>` — {dashboard_data, rendered_output}

**Алгоритм:**
1. Определить period: start_date = date, end_date = date
2. Собрать activity metrics за день
3. Собрать mood metrics
4. Рассчитать trends (compare with previous day)
5. Render в заданном формате

**Примеры:**
```javascript
const dashboard = await generate_daily_dashboard('ws-123', '2025-11-09');
// {
//     dashboard_data: {...},
//     rendered_output: '<b>📊 Daily Dashboard...</b>'
// }
```

---

### 3.3 generate_weekly_dashboard()

**Сигнатура:**
```javascript
async function generate_weekly_dashboard(workspace_id, week_start = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `week_start` (String, optional, default=this Monday)
- `options` (Object, optional)

**Возвращает:** `Promise<Object>` — {dashboard_data, rendered_output}

**Алгоритм:**
1. Определить period: week_start → week_end (Sunday)
2. Собрать activity metrics за неделю
3. Собрать mood metrics
4. Рассчитать trends (week-over-week)
5. Опционально: AI insights (default: true для weekly)

**Примеры:**
```javascript
const dashboard = await generate_weekly_dashboard('ws-123', '2025-11-04');
```

---

### 3.4 generate_monthly_dashboard()

**Сигнатура:**
```javascript
async function generate_monthly_dashboard(workspace_id, month = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `month` (String, optional, default=current month) — YYYY-MM

**Возвращает:** `Promise<Object>` — {dashboard_data, rendered_output}

**Алгоритм:**
1. Определить period: month start → month end
2. Собрать activity metrics за месяц
3. Собрать mood metrics
4. Рассчитать trends (month-over-month)
5. AI insights (recommended для monthly)

---

## 4. Helper Functions

### 4.1 collect_activity_metrics()

**Сигнатура:**
```javascript
async function collect_activity_metrics(workspace_id, start_date, end_date)
```

**Параметры:**
- `workspace_id` (String, required)
- `start_date` (String, required) — YYYY-MM-DD
- `end_date` (String, required) — YYYY-MM-DD

**Возвращает:** `Promise<ActivityMetrics>`
```typescript
{
    total_updates: number;
    active_members_count: number;
    total_members_count: number;
    activity_rate: number;  // 0.0 - 1.0
    updates_per_day_avg: number;
    most_active_members: Array<{name: string, updates: number}>;
}
```

**Алгоритм:**
```javascript
// 1. Get workspace members
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
const total_members_count = members.length;

// 2. Collect raw records for period
const start_timestamp = new Date(start_date).getTime();
const end_timestamp = new Date(end_date).getTime() + 86400000; // +1 day

let total_updates = 0;
const active_members_set = new Set();
const member_updates_map = {};

for (const member of members) {
    const raw_records = await ReportsBus.Dao.get_raw_records_after_date(
        workspace_id,
        member.user_uuid,
        start_timestamp
    );

    const filtered_records = raw_records.filter(r =>
        r.created_at >= start_timestamp && r.created_at < end_timestamp
    );

    if (filtered_records.length > 0) {
        active_members_set.add(member.user_uuid);
        member_updates_map[member.user_uuid] = {
            name: member.name,
            updates: filtered_records.length
        };
        total_updates += filtered_records.length;
    }
}

// 3. Calculate metrics
const active_members_count = active_members_set.size;
const activity_rate = active_members_count / total_members_count;

const days_count = Math.ceil((end_timestamp - start_timestamp) / 86400000);
const updates_per_day_avg = total_updates / days_count;

// 4. Top contributors
const most_active_members = Object.values(member_updates_map)
    .sort((a, b) => b.updates - a.updates)
    .slice(0, 5);

return {
    total_updates,
    active_members_count,
    total_members_count,
    activity_rate,
    updates_per_day_avg,
    most_active_members
};
```

---

### 4.2 collect_mood_metrics()

**Сигнатура:**
```javascript
async function collect_mood_metrics(workspace_id)
```

**Параметры:**
- `workspace_id` (String, required)

**Возвращает:** `Promise<MoodMetrics>`
```typescript
{
    overall_mood: 'positive' | 'neutral' | 'negative';
    mood_score: number;  // -1.0 to 1.0
    at_risk_members: Array<{name: string, reason: string}>;
    burnout_indicators: Array<string>;
}
```

**Алгоритм:**
```javascript
try {
    const mood_summary = await SummaryGenerator.generate_mood_summary(workspace_id);

    return {
        overall_mood: mood_summary.overall_mood,
        mood_score: mood_summary.mood_score,
        at_risk_members: mood_summary.at_risk_members,
        burnout_indicators: mood_summary.burnout_indicators
    };
} catch (error) {
    // Fallback if mood generation fails
    return {
        overall_mood: 'neutral',
        mood_score: 0.0,
        at_risk_members: [],
        burnout_indicators: []
    };
}
```

---

### 4.3 collect_member_metrics()

**Сигнатура:**
```javascript
async function collect_member_metrics(workspace_id, start_date, end_date)
```

**Параметры:**
- `workspace_id` (String, required)
- `start_date` (String, required)
- `end_date` (String, required)

**Возвращает:** `Promise<Array<MemberMetric>>`
```typescript
Array<{
    user_uuid: string;
    name: string;
    updates_count: number;
    last_active: string;  // YYYY-MM-DD
    mood: 'positive' | 'neutral' | 'negative';
}>
```

**Алгоритм:**
```javascript
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
const start_timestamp = new Date(start_date).getTime();
const end_timestamp = new Date(end_date).getTime() + 86400000;

const member_metrics = [];

for (const member of members) {
    const raw_records = await ReportsBus.Dao.get_raw_records_after_date(
        workspace_id,
        member.user_uuid,
        start_timestamp
    );

    const filtered_records = raw_records.filter(r =>
        r.created_at >= start_timestamp && r.created_at < end_timestamp
    );

    const updates_count = filtered_records.length;

    // Last active
    const last_active = filtered_records.length > 0
        ? new Date(Math.max(...filtered_records.map(r => r.created_at)))
            .toISOString().split('T')[0]
        : null;

    // Mood (placeholder - в будущем через AIInsights)
    const mood = 'neutral';

    member_metrics.push({
        user_uuid: member.user_uuid,
        name: member.name,
        updates_count,
        last_active,
        mood
    });
}

return member_metrics;
```

---

### 4.4 calculate_trends()

**Сигнатура:**
```javascript
function calculate_trends(current_metrics, previous_metrics)
```

**Параметры:**
- `current_metrics` (ActivityMetrics, required)
- `previous_metrics` (ActivityMetrics, required)

**Возвращает:** `TrendData`
```typescript
{
    activity_growth: number;  // % change (-100 to +∞)
    mood_change: number;      // change in mood_score
    engagement_trend: 'increasing' | 'stable' | 'decreasing';
}
```

**Алгоритм:**
```javascript
function calculate_growth_rate(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
}

const activity_growth = calculate_growth_rate(
    current_metrics.total_updates,
    previous_metrics.total_updates
);

const mood_change = current_metrics.mood_score - previous_metrics.mood_score;

const engagement_trend =
    activity_growth > 10 ? 'increasing' :
    activity_growth < -10 ? 'decreasing' : 'stable';

return {activity_growth, mood_change, engagement_trend};
```

---

### 4.5 render_telegram_dashboard()

**Сигнатура:**
```javascript
function render_telegram_dashboard(dashboard_data)
```

**Параметры:**
- `dashboard_data` (DashboardData, required)

**Возвращает:** `String` (HTML formatted for Telegram)

**Алгоритм:**
```javascript
const {
    workspace_name,
    period,
    activity_metrics,
    mood_metrics,
    trends,
    ai_insights
} = dashboard_data;

// Format period
const period_label = dashboard_data.type === 'daily'
    ? period.start_date
    : `${period.start_date} - ${period.end_date}`;

// Activity section
const activity_trend_emoji = trends.activity_growth > 0 ? '📈' : trends.activity_growth < 0 ? '📉' : '➡️';
const activity_section = `
<b>📈 Activity Metrics:</b>
  • Total Updates: ${activity_metrics.total_updates}
  • Active Members: ${activity_metrics.active_members_count}/${activity_metrics.total_members_count} (${Math.round(activity_metrics.activity_rate * 100)}%)
  • Avg Updates/Day: ${Math.round(activity_metrics.updates_per_day_avg)}
  • Trend: ${activity_trend_emoji} ${trends.activity_growth > 0 ? '+' : ''}${Math.round(trends.activity_growth)}%
`;

// Mood section
const mood_emoji = mood_metrics.overall_mood === 'positive' ? '😊' :
                  mood_metrics.overall_mood === 'negative' ? '😟' : '😐';
const at_risk_text = mood_metrics.at_risk_members.length > 0
    ? `\n  ⚠️ At-Risk: ${mood_metrics.at_risk_members.map(m => m.name).join(', ')}`
    : '';

const mood_section = `
<b>😊 Mood Metrics:</b>
  • Overall Mood: ${mood_emoji} ${mood_metrics.overall_mood}
  • At-Risk Members: ${mood_metrics.at_risk_members.length}${at_risk_text}
`;

// Top contributors
const top_contributors_section = activity_metrics.most_active_members.length > 0
    ? `\n<b>🏆 Top Contributors:</b>\n${activity_metrics.most_active_members.map(m => `  • ${m.name}: ${m.updates} updates`).join('\n')}`
    : '';

// AI insights (optional)
const ai_section = ai_insights
    ? `\n<b>💡 AI Insights:</b>\n${ai_insights.recommendations.map(r => `  • ${r}`).join('\n')}`
    : '';

// Combine
const output = `
<b>📊 ${workspace_name} Dashboard</b>
<b>Period:</b> ${period_label}

${activity_section}
${mood_section}${top_contributors_section}${ai_section}
`;

return output.trim();
```

---

### 4.6 render_json_dashboard()

**Сигнатура:**
```javascript
function render_json_dashboard(dashboard_data)
```

**Параметры:**
- `dashboard_data` (DashboardData, required)

**Возвращает:** `String` (JSON)

**Алгоритм:**
```javascript
return JSON.stringify(dashboard_data, null, 2);
```

---

## 5. Data Types

```typescript
interface DashboardData {
    type: 'daily' | 'weekly' | 'monthly';
    workspace_id: string;
    workspace_name: string;
    period: {
        start_date: string;
        end_date: string;
    };

    activity_metrics: ActivityMetrics;
    mood_metrics: MoodMetrics;
    member_metrics?: Array<MemberMetric>;
    trends: TrendData;
    ai_insights?: AIInsights;

    generated_at: string;  // ISO timestamp
}

interface ActivityMetrics {
    total_updates: number;
    active_members_count: number;
    total_members_count: number;
    activity_rate: number;  // 0.0 - 1.0
    updates_per_day_avg: number;
    most_active_members: Array<{name: string, updates: number}>;
}

interface MoodMetrics {
    overall_mood: 'positive' | 'neutral' | 'negative';
    mood_score: number;  // -1.0 to 1.0
    at_risk_members: Array<{name: string, reason: string}>;
    burnout_indicators: Array<string>;
}

interface MemberMetric {
    user_uuid: string;
    name: string;
    updates_count: number;
    last_active: string;  // YYYY-MM-DD or null
    mood: 'positive' | 'neutral' | 'negative';
}

interface TrendData {
    activity_growth: number;  // % change
    mood_change: number;
    engagement_trend: 'increasing' | 'stable' | 'decreasing';
}

interface AIInsights {
    highlights: Array<string>;
    concerns: Array<string>;
    recommendations: Array<string>;
}
```

---

## 6. Error Handling

### 6.1 Workspace Not Found

```javascript
async function generate_dashboard(workspace_id, ...) {
    const workspace_info = await WorkspaceManager.get_workspace_info(workspace_id);

    if (!workspace_info) {
        throw new Error(`Workspace ${workspace_id} not found`);
    }
    // ...
}
```

### 6.2 No Data for Period

```javascript
const activity_metrics = await collect_activity_metrics(workspace_id, start, end);

if (activity_metrics.total_updates === 0) {
    return {
        dashboard_data: {
            type: 'daily',
            workspace_id,
            workspace_name,
            period: {start_date, end_date},
            activity_metrics: {
                total_updates: 0,
                active_members_count: 0,
                total_members_count: activity_metrics.total_members_count,
                activity_rate: 0,
                updates_per_day_avg: 0,
                most_active_members: []
            },
            mood_metrics: {overall_mood: 'neutral', mood_score: 0, at_risk_members: [], burnout_indicators: []},
            trends: {activity_growth: 0, mood_change: 0, engagement_trend: 'stable'},
            generated_at: new Date().toISOString()
        },
        rendered_output: render_telegram_dashboard({...})
    };
}
```

### 6.3 SummaryGenerator Failure

```javascript
async function collect_mood_metrics(workspace_id) {
    try {
        const mood_summary = await SummaryGenerator.generate_mood_summary(workspace_id);
        return {...mood_summary};
    } catch (error) {
        I.log_error(error, 'collect_mood_metrics fallback');
        // Fallback
        return {
            overall_mood: 'neutral',
            mood_score: 0.0,
            at_risk_members: [],
            burnout_indicators: []
        };
    }
}
```

---

## 7. Usage Examples

### 7.1 Daily Dashboard for Lead

```javascript
// Lead requests daily dashboard via bot command
const dashboard = await DashboardGenerator.generate_daily_dashboard(
    'ws-123',
    '2025-11-09',
    {format: 'telegram'}
);

// Send to lead
await bot.telegram.sendMessage(lead_telegram_id, dashboard.rendered_output, {parse_mode: 'HTML'});
```

### 7.2 Weekly Dashboard with AI Insights

```javascript
// Scheduled weekly dashboard (Monday morning)
const dashboard = await DashboardGenerator.generate_weekly_dashboard(
    'ws-123',
    '2025-11-04',  // Monday
    {format: 'telegram', include_ai_insights: true}
);

// Send via NotificationRouter
await NotificationRouter.send_notification(
    lead,
    {text: dashboard.rendered_output, format: 'html'},
    {parse_mode: 'HTML'}
);
```

### 7.3 Monthly Dashboard Export

```javascript
// Lead requests monthly dashboard export
const dashboard = await DashboardGenerator.generate_monthly_dashboard(
    'ws-123',
    '2025-11',
    {format: 'json'}
);

// Save to file or send as attachment
const json_output = dashboard.rendered_output;
// ...
```

---

## 8. Integration Points

### 8.1 ReportsBus Integration

```javascript
// Get raw records
const raw_records = await ReportsBus.Dao.get_raw_records_after_date(
    workspace_id,
    user_uuid,
    start_timestamp
);
```

### 8.2 SummaryGenerator Integration

```javascript
// Get mood summary
const mood_summary = await SummaryGenerator.generate_mood_summary(workspace_id);
```

### 8.3 WorkspaceManager Integration

```javascript
// Get workspace members
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);

// Get workspace info
const workspace_info = await WorkspaceManager.get_workspace_info(workspace_id);
```

---

## 9. Configuration

```javascript
const DEFAULT_FORMAT = 'telegram';
const TOP_CONTRIBUTORS_LIMIT = 5;
const TREND_THRESHOLD = 10;  // % change для significant trend
const INCLUDE_AI_INSIGHTS_BY_DEFAULT = false;
```

---

## 10. Testing Requirements

**Unit Tests:**
```javascript
describe('DashboardGenerator', () => {
    it('should generate daily dashboard with correct metrics');
    it('should handle workspace with no activity');
    it('should calculate trends correctly');
    it('should render Telegram dashboard with proper formatting');
    it('should fallback gracefully if SummaryGenerator fails');
});
```

**Integration Tests:**
```javascript
describe('DashboardGenerator Integration', () => {
    it('should integrate with ReportsBus for activity data');
    it('should integrate with SummaryGenerator for mood data');
    it('should integrate with WorkspaceManager for workspace context');
});
```

---

**Status:** ✅ Complete API Contract
**Next Step:** Implementation
**Version:** 1.0.0
**Created:** 2025-11-09
