# Спецификация модуля: DashboardGenerator

**Роль:** Architect
**Фаза:** Phase 5 - Priority 4 (Dashboard & Analytics)
**Приоритет:** Priority 4 (Enhancement - аналитика)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**DashboardGenerator** — модуль для генерации интерактивных dashboard для руководителей workspace. Модуль агрегирует данные из ReportsBus и SummaryGenerator, визуализирует key metrics (активность, настроение, тренды) и предоставляет insights для принятия решений.

### Ключевые концепции:

**Dashboard** — интерактивное представление key metrics workspace за период.

**Metrics Aggregation** — сбор и агрегация данных из multiple sources (ReportsBus, SummaryGenerator).

**Visualization** — представление данных в виде charts, graphs, tables.

**Insights** — AI-generated выводы и рекомендации.

### Назначение модуля:

- Генерация dashboard для руководителей (daily/weekly/monthly)
- Визуализация активности команды
- Отображение mood trends
- Identification at-risk members
- AI insights и recommendations
- Export dashboard в различные форматы (HTML, JSON, Telegram)

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ DashboardGenerator:

✅ **Dashboard Generation:**
- Генерация dashboard для заданного периода
- Агрегация данных из ReportsBus и SummaryGenerator
- Визуализация key metrics

✅ **Metrics Collection:**
- Activity metrics (total updates, active members)
- Mood metrics (overall mood, at-risk members)
- Trend analysis (week-over-week, month-over-month)
- Member-level metrics (individual activity, mood)

✅ **Visualization:**
- HTML rendering (для web)
- Telegram-friendly formatting (для bot)
- JSON export (для external tools)

✅ **AI Insights:**
- AI-generated highlights
- Risk detection
- Recommendations для руководителя

### Что НЕ ДЕЛАЕТ DashboardGenerator:

❌ Генерация summaries (это SummaryGenerator)
❌ Отправка уведомлений (это NotificationRouter)
❌ Анализ sentiment (это AIInsights - будущий модуль)
❌ Хранение данных (это ReportsBus)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты
  "date-fns": "^2.30.0"                    // Date manipulation
}
```

### Внутренние модули:

- **ReportsBus** — получение raw и processed records
- **SummaryGenerator** — получение summaries
- **WorkspaceManager** — получение workspace context

### Infrastructure:

- **Yandex YDB** (через ReportsBus)

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/dashboard-generator.js
├─ DashboardGenerator (Main Logic)
│  ├─ generate_dashboard(workspace_id, period) - main API
│  ├─ generate_daily_dashboard(workspace_id, date) - daily dashboard
│  ├─ generate_weekly_dashboard(workspace_id, week_start) - weekly dashboard
│  └─ generate_monthly_dashboard(workspace_id, month) - monthly dashboard
│
├─ Metrics Collection
│  ├─ collect_activity_metrics(workspace_id, period) - activity data
│  ├─ collect_mood_metrics(workspace_id, period) - mood data
│  ├─ collect_member_metrics(workspace_id, period) - member-level data
│  └─ calculate_trends(current, previous) - trend calculation
│
├─ Visualization
│  ├─ render_html_dashboard(dashboard_data) - HTML output
│  ├─ render_telegram_dashboard(dashboard_data) - Telegram output
│  └─ render_json_dashboard(dashboard_data) - JSON export
│
└─ Helpers
   ├─ get_period_bounds(period) - start/end timestamps
   ├─ format_percentage(value) - formatting
   └─ calculate_growth_rate(current, previous) - growth %
```

---

## 5. Алгоритмы и процессы

### 5.1 Процесс: Generate Dashboard

```
[generate_dashboard(workspace_id, period)]
         │
         ├─> ЭТАП 1: Определение периода
         │    └─> get_period_bounds(period)
         │         └─> return {start_date, end_date, previous_start, previous_end}
         │
         ├─> ЭТАП 2: Сбор metrics
         │    ├─> collect_activity_metrics(workspace_id, period)
         │    │    └─> ReportsBus.Dao.get_raw_records_after_date(...)
         │    │         └─> Aggregate: total_updates, active_members, updates_per_day
         │    │
         │    ├─> collect_mood_metrics(workspace_id, period)
         │    │    └─> SummaryGenerator.generate_mood_summary(workspace_id)
         │    │         └─> overall_mood, at_risk_members
         │    │
         │    └─> collect_member_metrics(workspace_id, period)
         │         └─> For each member: {name, updates_count, last_active, mood}
         │
         ├─> ЭТАП 3: Trend analysis
         │    └─> calculate_trends(current_metrics, previous_metrics)
         │         └─> growth_rate = (current - previous) / previous * 100
         │
         ├─> ЭТАП 4: AI insights (optional)
         │    └─> generate_ai_insights(dashboard_data)
         │         └─> LLM: analyze dashboard and provide recommendations
         │
         ├─> ЭТАП 5: Visualization
         │    └─> render_telegram_dashboard(dashboard_data)
         │         └─> Format для Telegram (HTML with emojis)
         │
         └─> return {dashboard_data, rendered_output}
```

---

## 6. API спецификация

> **Детальный API contract** будет в `.agents/specs/api-contracts/dashboard-generator-api.md`

### 6.1 generate_dashboard()

**Назначение:** Генерация dashboard для произвольного периода

**Сигнатура:**
```javascript
async function generate_dashboard(workspace_id, period_config, options = {})
```

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `period_config` (Object, required) — {type: 'daily'|'weekly'|'monthly', date: '...'}
- `options` (Object, optional) — {format: 'html'|'telegram'|'json', include_ai_insights: true}

**Возвращает:** `Promise<Object>` — {dashboard_data, rendered_output}

**Пример:**
```javascript
const dashboard = await DashboardGenerator.generate_dashboard(
    'ws-123',
    {type: 'weekly', date: '2025-11-04'},
    {format: 'telegram', include_ai_insights: true}
);
```

---

### 6.2 generate_daily_dashboard()

**Назначение:** Генерация dashboard за день

**Сигнатура:**
```javascript
async function generate_daily_dashboard(workspace_id, date = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `date` (String, optional, default=today) — YYYY-MM-DD
- `options` (Object, optional) — {format: 'telegram'}

**Возвращает:** `Promise<Object>` — dashboard object

---

### 6.3 generate_weekly_dashboard()

**Назначение:** Генерация dashboard за неделю

**Сигнатура:**
```javascript
async function generate_weekly_dashboard(workspace_id, week_start = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `week_start` (String, optional, default=this Monday)
- `options` (Object, optional)

**Возвращает:** `Promise<Object>` — dashboard object

---

### 6.4 generate_monthly_dashboard()

**Назначение:** Генерация dashboard за месяц

**Сигнатура:**
```javascript
async function generate_monthly_dashboard(workspace_id, month = null, options = {})
```

**Параметры:**
- `workspace_id` (String, required)
- `month` (String, optional, default=current month) — YYYY-MM

**Возвращает:** `Promise<Object>` — dashboard object

---

## 7. Data Types

### 7.1 Dashboard Data Structure

```typescript
interface Dashboard {
    type: 'daily' | 'weekly' | 'monthly';
    workspace_id: string;
    period: {
        start_date: string;
        end_date: string;
    };

    activity_metrics: ActivityMetrics;
    mood_metrics: MoodMetrics;
    member_metrics: Array<MemberMetric>;
    trends: TrendData;
    ai_insights?: AIInsights;

    generated_at: string;
}

interface ActivityMetrics {
    total_updates: number;
    active_members_count: number;
    total_members_count: number;
    activity_rate: number;  // active / total
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
    last_active: string;
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

## 8. Helper Functions

### 8.1 collect_activity_metrics()

**Назначение:** Сбор activity metrics за период

**Сигнатура:**
```javascript
async function collect_activity_metrics(workspace_id, start_date, end_date)
```

**Возвращает:** `Promise<ActivityMetrics>`

**Алгоритм:**
```javascript
// 1. Get all members
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);

// 2. Collect raw records for period
const raw_records = await ReportsBus.Dao.get_raw_records_after_date(
    workspace_id, user_uuid, start_timestamp
);

// 3. Aggregate
const total_updates = raw_records.length;
const active_members = [...new Set(raw_records.map(r => r.user_uuid))];
const activity_rate = active_members.length / members.length;

return {total_updates, active_members_count, activity_rate, ...};
```

---

### 8.2 collect_mood_metrics()

**Назначение:** Сбор mood metrics

**Сигнатура:**
```javascript
async function collect_mood_metrics(workspace_id)
```

**Возвращает:** `Promise<MoodMetrics>`

**Алгоритм:**
```javascript
const mood_summary = await SummaryGenerator.generate_mood_summary(workspace_id);

return {
    overall_mood: mood_summary.overall_mood,
    mood_score: mood_summary.mood_score,
    at_risk_members: mood_summary.at_risk_members,
    burnout_indicators: mood_summary.burnout_indicators
};
```

---

### 8.3 calculate_trends()

**Назначение:** Расчет trends (week-over-week, month-over-month)

**Сигнатура:**
```javascript
function calculate_trends(current_metrics, previous_metrics)
```

**Возвращает:** `TrendData`

**Алгоритм:**
```javascript
const activity_growth = calculate_growth_rate(
    current_metrics.total_updates,
    previous_metrics.total_updates
);

const mood_change = current_metrics.mood_score - previous_metrics.mood_score;

const engagement_trend = activity_growth > 10 ? 'increasing' :
                        activity_growth < -10 ? 'decreasing' : 'stable';

return {activity_growth, mood_change, engagement_trend};
```

---

### 8.4 render_telegram_dashboard()

**Назначение:** Рендеринг dashboard для Telegram

**Сигнатура:**
```javascript
function render_telegram_dashboard(dashboard_data)
```

**Возвращает:** `String` (HTML)

**Пример:**
```javascript
const output = `
<b>📊 ${workspace_name} Dashboard</b>
<b>Period:</b> ${period.start_date} - ${period.end_date}

<b>📈 Activity Metrics:</b>
  • Total Updates: ${total_updates}
  • Active Members: ${active_members_count}/${total_members_count} (${activity_rate}%)
  • Trend: ${activity_growth > 0 ? '📈' : '📉'} ${activity_growth}%

<b>😊 Mood Metrics:</b>
  • Overall Mood: ${overall_mood_emoji} ${overall_mood}
  • At-Risk Members: ${at_risk_members.length}
  ${at_risk_members.length > 0 ? `  ⚠️ ${at_risk_names}` : ''}

<b>🏆 Top Contributors:</b>
  ${most_active_members.map(m => `  • ${m.name}: ${m.updates} updates`).join('\n')}

${ai_insights ? `<b>💡 AI Insights:</b>\n${ai_insights.recommendations.join('\n')}` : ''}
`;

return output;
```

---

## 9. Configuration

### 9.1 Constants

```javascript
const DEFAULT_DASHBOARD_FORMAT = 'telegram';
const TOP_CONTRIBUTORS_LIMIT = 5;
const TREND_THRESHOLD = 10; // % change для significant trend
```

---

## 10. Edge Cases и Error Handling

### 10.1 Edge Case: Нет данных за период

**Ситуация:** collect_activity_metrics() вернул total_updates = 0

**Решение:**
- Генерировать dashboard с empty metrics
- Указать "No activity for this period"
- Не вызывать AI insights (нечего анализировать)

### 10.2 Edge Case: Workspace not found

**Ситуация:** WorkspaceManager.get_all_workspace_members() вернул ошибку

**Решение:**
- Throw error "Workspace not found"
- Логировать

### 10.3 Edge Case: SummaryGenerator failed

**Ситуация:** generate_mood_summary() выбросил ошибку

**Решение:**
- Fallback: mood_metrics = {overall_mood: 'neutral', at_risk_members: []}
- Продолжить генерацию dashboard без mood data

---

## 11. Performance Considerations

### 11.1 Data Aggregation

**Проблема:** Запросы к YDB для каждого member дорого

**Решение:**
- Batch queries где возможно
- Кеширование workspace members (5 min TTL)

### 11.2 AI Insights (optional)

**Проблема:** LLM call медленный

**Решение:**
- Сделать AI insights опциональным (options.include_ai_insights)
- Default: false (для daily dashboards), true (для weekly/monthly)

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Обязательные тесты:**
- generate_daily_dashboard() - success, no data, workspace not found
- collect_activity_metrics() - various periods
- calculate_trends() - positive/negative growth
- render_telegram_dashboard() - formatting

**Mocks:**
- ReportsBus.Dao methods
- SummaryGenerator.generate_mood_summary()
- WorkspaceManager methods

### 12.2 Integration Tests

**Обязательные тесты:**
- End-to-end: generate dashboard with real data
- Integration с ReportsBus и SummaryGenerator
- Rendering в different formats

---

## 13. Migration from Legacy

**Legacy implementation:** НЕТ (новый модуль)

**Новая функциональность:**
- Dashboard generation для руководителей
- Metrics aggregation
- Visualization

---

## 14. Acceptance Criteria

### Критерии приемки модуля:

- ✅ generate_dashboard() работает корректно
- ✅ Activity metrics собираются правильно
- ✅ Mood metrics интегрируются с SummaryGenerator
- ✅ Trend calculation корректный
- ✅ Telegram rendering работает
- ✅ Edge cases обработаны
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests

---

## 15. Future Enhancements (v2.0.0)

- Web dashboard (HTML + CSS + charts)
- Export to PDF
- Interactive charts (через Chart.js)
- Historical comparison (compare multiple periods)
- Member drill-down (детальная информация по каждому member)
- Custom metrics (пользовательские KPI)

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/dashboard-generator-api.md`
