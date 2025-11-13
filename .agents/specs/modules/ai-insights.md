# Спецификация модуля: AIInsights

**Роль:** Architect
**Фаза:** Phase 5 - Priority 4 (Dashboard & Analytics)
**Приоритет:** Priority 4 (Enhancement - AI insights)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**AIInsights** — модуль для AI-driven анализа диалогов и активности участников workspace. Модуль использует LLM (gpt-4o) для sentiment analysis, burnout detection, trend analysis и risk identification.

### Ключевые концепции:

**Sentiment Analysis** — анализ эмоциональной окраски диалогов (positive, neutral, negative).

**Burnout Detection** — выявление признаков выгорания участников (переработка, стресс, demotivation).

**Trend Analysis** — анализ изменений настроения и активности во времени.

**Risk Detection** — выявление at-risk members (риск выгорания, снижение engagement).

### Назначение модуля:

- Sentiment analysis диалогов участников
- Burnout detection через LLM
- Trend analysis (изменения во времени)
- Risk detection и early warnings
- Recommendations для руководителей

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ AIInsights:

✅ **Sentiment Analysis:**
- Анализ sentiment отдельных диалогов
- Агрегация sentiment по участнику
- Временной анализ (sentiment trends)

✅ **Burnout Detection:**
- Выявление признаков burnout через LLM
- Индикаторы: переработка, стресс, demotivation
- Risk scoring (0-100)

✅ **Trend Analysis:**
- Изменение sentiment во времени
- Изменение активности
- Early warning signals

✅ **Risk Detection:**
- Identification at-risk members
- Risk categories (burnout, disengagement, conflict)
- Recommendations для intervention

### Что НЕ ДЕЛАЕТ AIInsights:

❌ Генерация summaries (это SummaryGenerator)
❌ Dashboard generation (это DashboardGenerator)
❌ Отправка уведомлений (это NotificationRouter)
❌ Хранение данных (это ReportsBus)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты
  "@langchain/openai": "latest",          // LLM integration
  "zod": "^3.22.0"                        // Structured output
}
```

### Внутренние модули:

- **ReportsBus** — получение raw dialogs
- **WorkspaceManager** — workspace context

### Infrastructure:

- **OpenAI API** (gpt-4o) — AI analysis

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/ai-insights.js
├─ AIInsights (Main Logic)
│  ├─ analyze_user_sentiment(workspace_id, user_uuid, period) - sentiment analysis
│  ├─ detect_burnout_risk(workspace_id, user_uuid) - burnout detection
│  ├─ analyze_workspace_trends(workspace_id, period) - trend analysis
│  └─ identify_at_risk_members(workspace_id) - risk detection
│
├─ LLM Integration
│  ├─ analyze_sentiment_with_llm(dialog_text) - LLM sentiment
│  ├─ detect_burnout_with_llm(dialog_history) - LLM burnout
│  └─ analyze_trends_with_llm(time_series_data) - LLM trends
│
├─ Keyword-based Fallback
│  ├─ calculate_sentiment_keywords(text) - keyword fallback
│  └─ detect_burnout_keywords(text) - keyword fallback
│
└─ Helpers
   ├─ aggregate_sentiment(sentiment_array) - aggregation
   ├─ calculate_risk_score(indicators) - risk scoring
   └─ generate_recommendations(risk_profile) - recommendations
```

---

## 5. Алгоритмы и процессы

### 5.1 Процесс: Sentiment Analysis

```
[analyze_user_sentiment(workspace_id, user_uuid, period)]
         │
         ├─> ЭТАП 1: Collect dialogs
         │    └─> ReportsBus.Dao.get_raw_records_after_date(...)
         │         └─> Extract dialog_text from raw records
         │
         ├─> ЭТАП 2: LLM sentiment analysis
         │    └─> For each dialog:
         │         └─> analyze_sentiment_with_llm(dialog_text)
         │              └─> LLM prompt: "Analyze sentiment (positive/neutral/negative)"
         │              └─> return {sentiment, confidence}
         │
         ├─> ЭТАП 3: Aggregation
         │    └─> aggregate_sentiment(sentiment_array)
         │         └─> Calculate: overall_sentiment, sentiment_distribution
         │
         ├─> ЭТАП 4: Trend analysis (optional)
         │    └─> Compare with previous period
         │         └─> sentiment_change = current - previous
         │
         └─> return {user_uuid, overall_sentiment, distribution, trend}
```

### 5.2 Процесс: Burnout Detection

```
[detect_burnout_risk(workspace_id, user_uuid)]
         │
         ├─> ЭТАП 1: Collect dialog history (last 30 days)
         │    └─> ReportsBus.Dao.get_raw_records_after_date(...)
         │
         ├─> ЭТАП 2: LLM burnout analysis
         │    └─> detect_burnout_with_llm(dialog_history)
         │         └─> LLM prompt: "Analyze burnout indicators"
         │              ├─> Overwork signals
         │              ├─> Stress keywords
         │              ├─> Demotivation mentions
         │              └─> Negativity patterns
         │         └─> return {burnout_indicators, risk_score}
         │
         ├─> ЭТАП 3: Risk scoring
         │    └─> calculate_risk_score(burnout_indicators)
         │         └─> 0-30: low, 31-70: medium, 71-100: high
         │
         ├─> ЭТАП 4: Recommendations
         │    └─> generate_recommendations(risk_profile)
         │         └─> Based on risk level
         │
         └─> return {user_uuid, risk_level, indicators, recommendations}
```

### 5.3 Процесс: Trend Analysis

```
[analyze_workspace_trends(workspace_id, period)]
         │
         ├─> ЭТАП 1: Collect time-series data
         │    └─> For each week in period:
         │         └─> collect_activity_metrics(workspace_id, week_start, week_end)
         │              └─> {total_updates, sentiment_avg}
         │
         ├─> ЭТАП 2: LLM trend analysis
         │    └─> analyze_trends_with_llm(time_series_data)
         │         └─> LLM prompt: "Identify patterns and trends"
         │              ├─> Activity trends
         │              ├─> Sentiment trends
         │              ├─> Anomalies
         │              └─> Predictions
         │
         └─> return {trends, anomalies, predictions, concerns}
```

### 5.4 Процесс: Risk Detection

```
[identify_at_risk_members(workspace_id)]
         │
         ├─> ЭТАП 1: Get all members
         │    └─> WorkspaceManager.get_all_workspace_members(workspace_id)
         │
         ├─> ЭТАП 2: Analyze each member
         │    └─> For each member:
         │         ├─> analyze_user_sentiment(workspace_id, user_uuid)
         │         ├─> detect_burnout_risk(workspace_id, user_uuid)
         │         └─> Calculate overall risk_score
         │
         ├─> ЭТАП 3: Filter at-risk members
         │    └─> Filter members with risk_score > 30 (medium+)
         │
         ├─> ЭТАП 4: Prioritization
         │    └─> Sort by risk_score (highest first)
         │
         └─> return {at_risk_members, summary, recommendations}
```

---

## 6. API спецификация

> **Детальный API contract** будет в `.agents/specs/api-contracts/ai-insights-api.md`

### 6.1 analyze_user_sentiment()

**Назначение:** Sentiment analysis для одного участника

**Сигнатура:**
```javascript
async function analyze_user_sentiment(workspace_id, user_uuid, period_days = 30)
```

**Параметры:**
- `workspace_id` (String, required)
- `user_uuid` (String, required)
- `period_days` (Number, optional, default=30)

**Возвращает:** `Promise<Object>` — SentimentAnalysis

---

### 6.2 detect_burnout_risk()

**Назначение:** Burnout detection для участника

**Сигнатура:**
```javascript
async function detect_burnout_risk(workspace_id, user_uuid)
```

**Параметры:**
- `workspace_id` (String, required)
- `user_uuid` (String, required)

**Возвращает:** `Promise<Object>` — BurnoutRiskProfile

---

### 6.3 analyze_workspace_trends()

**Назначение:** Trend analysis для всего workspace

**Сигнатура:**
```javascript
async function analyze_workspace_trends(workspace_id, period_days = 90)
```

**Параметры:**
- `workspace_id` (String, required)
- `period_days` (Number, optional, default=90)

**Возвращает:** `Promise<Object>` — TrendAnalysis

---

### 6.4 identify_at_risk_members()

**Назначение:** Identification всех at-risk members

**Сигнатура:**
```javascript
async function identify_at_risk_members(workspace_id)
```

**Параметры:**
- `workspace_id` (String, required)

**Возвращает:** `Promise<Object>` — AtRiskMembersReport

---

## 7. Data Types

### 7.1 Sentiment Analysis

```typescript
interface SentimentAnalysis {
    user_uuid: string;
    period_days: number;
    overall_sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;  // -1.0 to 1.0
    sentiment_distribution: {
        positive: number;  // % of positive dialogs
        neutral: number;
        negative: number;
    };
    trend?: {
        direction: 'improving' | 'stable' | 'declining';
        change: number;  // sentiment_score change
    };
    analyzed_at: string;
}
```

### 7.2 Burnout Risk Profile

```typescript
interface BurnoutRiskProfile {
    user_uuid: string;
    risk_level: 'low' | 'medium' | 'high';
    risk_score: number;  // 0-100
    burnout_indicators: Array<{
        type: 'overwork' | 'stress' | 'demotivation' | 'negativity';
        description: string;
        severity: 'low' | 'medium' | 'high';
    }>;
    recommendations: Array<string>;
    analyzed_at: string;
}
```

### 7.3 Trend Analysis

```typescript
interface TrendAnalysis {
    workspace_id: string;
    period_days: number;
    activity_trend: {
        direction: 'increasing' | 'stable' | 'decreasing';
        weekly_avg: number;
        change_percent: number;
    };
    sentiment_trend: {
        direction: 'improving' | 'stable' | 'declining';
        weekly_avg_score: number;
    };
    anomalies: Array<{
        date: string;
        type: 'activity_spike' | 'activity_drop' | 'sentiment_drop';
        description: string;
    }>;
    predictions?: Array<string>;
    concerns: Array<string>;
}
```

### 7.4 At-Risk Members Report

```typescript
interface AtRiskMembersReport {
    workspace_id: string;
    at_risk_members: Array<{
        user_uuid: string;
        name: string;
        risk_level: 'medium' | 'high';
        risk_score: number;
        primary_concern: string;
    }>;
    summary: {
        total_members: number;
        at_risk_count: number;
        high_risk_count: number;
    };
    recommendations: Array<string>;
    analyzed_at: string;
}
```

---

## 8. LLM Integration

### 8.1 Sentiment Analysis Prompt

```javascript
const prompt = `
You are an AI assistant analyzing team member sentiment.

Dialog text:
${dialog_text}

Analyze the sentiment of this dialog. Consider:
- Emotional tone (positive, neutral, negative)
- Energy level (high, medium, low)
- Engagement (engaged, neutral, disengaged)

Provide:
1. Overall sentiment (positive/neutral/negative)
2. Confidence (0.0-1.0)
3. Brief reasoning
`;

const schema = z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
});

const llm = new ChatOpenAI({model: 'gpt-4o'}).withStructuredOutput(schema);
const result = await llm.invoke(prompt);
```

### 8.2 Burnout Detection Prompt

```javascript
const prompt = `
You are an AI assistant analyzing burnout risk.

User dialog history (last 30 days):
${dialog_history}

Analyze for burnout indicators:
1. Overwork signals (mentions of long hours, weekends work, exhaustion)
2. Stress keywords (stress, pressure, overwhelmed, deadline)
3. Demotivation (lack of enthusiasm, questioning purpose)
4. Negativity patterns (consistent complaints, frustration)

Provide:
- Burnout indicators (array)
- Risk score (0-100)
- Recommendations
`;

const schema = z.object({
    burnout_indicators: z.array(z.object({
        type: z.enum(['overwork', 'stress', 'demotivation', 'negativity']),
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high'])
    })),
    risk_score: z.number().min(0).max(100),
    recommendations: z.array(z.string())
});
```

---

## 9. Keyword-based Fallback

### 9.1 Sentiment Keywords

```javascript
const SENTIMENT_KEYWORDS = {
    positive: [
        'завершил', 'успешно', 'отлично', 'хорошо', 'прогресс',
        'достижение', 'готово', 'решили', 'улучшение'
    ],
    negative: [
        'блокер', 'проблема', 'задержка', 'стресс', 'сложно',
        'перегрузка', 'не успеваю', 'не получается', 'кризис'
    ],
    burnout: [
        'устал', 'выгорание', 'переработка', 'выходные работал',
        'нет сил', 'не хватает времени', 'deadline каждый день'
    ]
};
```

### 9.2 Fallback Strategy

```javascript
async function analyze_sentiment_with_llm(text) {
    try {
        // Try LLM
        const llm_result = await llm.invoke(prompt);
        return llm_result;
    } catch (error) {
        // Fallback to keywords
        return calculate_sentiment_keywords(text);
    }
}

function calculate_sentiment_keywords(text) {
    const positive_count = count_keywords(text, SENTIMENT_KEYWORDS.positive);
    const negative_count = count_keywords(text, SENTIMENT_KEYWORDS.negative);

    const sentiment = positive_count > negative_count ? 'positive' :
                     negative_count > positive_count ? 'negative' : 'neutral';

    return {sentiment, confidence: 0.5, reasoning: 'Keyword-based fallback'};
}
```

---

## 10. Edge Cases и Error Handling

### 10.1 Edge Case: Нет диалогов за период

**Ситуация:** get_raw_records_after_date() вернул []

**Решение:**
- Return {overall_sentiment: 'neutral', sentiment_distribution: {positive: 0, neutral: 0, negative: 0}}
- Логировать: "No dialogs found for user {uuid}"

### 10.2 Edge Case: LLM недоступен

**Ситуация:** OpenAI API вернул ошибку

**Решение:**
- Fallback к keyword-based analysis
- Логировать warning
- Confidence = 0.5 (lower confidence для keyword-based)

### 10.3 Edge Case: Workspace not found

**Ситуация:** WorkspaceManager.get_all_workspace_members() failed

**Решение:**
- Throw error "Workspace not found"
- Логировать

---

## 11. Performance Considerations

### 11.1 LLM Calls

**Проблема:** Анализ 10+ members = дорого и медленно

**Решение:**
- Batch LLM calls где возможно
- Кеширование результатов (1 hour TTL)
- Rate limiting для OpenAI API

### 11.2 Data Volume

**Проблема:** Анализ 30 days dialogs для каждого member

**Решение:**
- Limit dialog count (max 100 dialogs per analysis)
- Sampling стратегия (analyze every 3rd dialog)

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Обязательные тесты:**
- analyze_user_sentiment() - success, no dialogs, LLM error
- detect_burnout_risk() - low/medium/high risk
- calculate_sentiment_keywords() - keyword fallback
- aggregate_sentiment() - aggregation logic

**Mocks:**
- OpenAI API calls
- ReportsBus.Dao methods
- WorkspaceManager methods

### 12.2 Integration Tests

**Обязательные тесты:**
- End-to-end: sentiment analysis with real LLM
- Integration с ReportsBus
- Fallback scenario (LLM unavailable)

---

## 13. Migration from Legacy

**Legacy implementation:** НЕТ (новый модуль)

**Новая функциональность:**
- AI-driven sentiment analysis
- Burnout detection
- Trend analysis
- Risk detection

---

## 14. Acceptance Criteria

### Критерии приемки модуля:

- ✅ analyze_user_sentiment() работает корректно
- ✅ detect_burnout_risk() выявляет признаки burnout
- ✅ LLM integration (gpt-4o) работает
- ✅ Keyword-based fallback работает
- ✅ identify_at_risk_members() returns correct list
- ✅ Edge cases обработаны
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests

---

## 15. Future Enhancements (v2.0.0)

- ML-based sentiment analysis (без LLM)
- Real-time monitoring (continuous analysis)
- Custom risk thresholds (настраиваемые пороги)
- Historical comparison (trend over 6+ months)
- Team dynamics analysis (interaction patterns)

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/ai-insights-api.md`
