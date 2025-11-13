# API Contract: AIInsights Module v1.0.0

**Module:** AIInsights
**Version:** 1.0.0
**Phase:** Phase 5 - Priority 4
**Created:** 2025-11-09

---

## 1. Overview

AIInsights предоставляет AI-driven анализ диалогов и активности участников: sentiment analysis, burnout detection, trend analysis, risk identification.

---

## 2. Module Exports

```javascript
module.exports = {
    // Main API
    analyze_user_sentiment,
    detect_burnout_risk,
    analyze_workspace_trends,
    identify_at_risk_members,

    // Helper Functions
    calculate_sentiment_keywords,  // fallback
    aggregate_sentiment,
    calculate_risk_score
};
```

---

## 3. Main API Functions

### 3.1 analyze_user_sentiment()

**Сигнатура:**
```javascript
async function analyze_user_sentiment(workspace_id, user_uuid, period_days = 30)
```

**Параметры:**
- `workspace_id` (String, required)
- `user_uuid` (String, required)
- `period_days` (Number, optional, default=30) — анализируемый период

**Возвращает:** `Promise<SentimentAnalysis>`
```typescript
{
    user_uuid: string;
    period_days: number;
    overall_sentiment: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;  // -1.0 to 1.0
    sentiment_distribution: {
        positive: number;  // % dialogs
        neutral: number;
        negative: number;
    };
    trend?: {
        direction: 'improving' | 'stable' | 'declining';
        change: number;
    };
    analyzed_at: string;
}
```

**Алгоритм:**
1. Collect dialogs за period_days
2. Analyze sentiment каждого dialog через LLM
3. Aggregate results
4. Optional: compare с previous period для trend
5. Return SentimentAnalysis

**Примеры:**
```javascript
const sentiment = await analyze_user_sentiment('ws-123', 'user-456', 30);
// {
//     user_uuid: 'user-456',
//     period_days: 30,
//     overall_sentiment: 'positive',
//     sentiment_score: 0.6,
//     sentiment_distribution: {positive: 70, neutral: 20, negative: 10},
//     trend: {direction: 'improving', change: 0.2},
//     analyzed_at: '2025-11-09T12:00:00Z'
// }
```

---

### 3.2 detect_burnout_risk()

**Сигнатура:**
```javascript
async function detect_burnout_risk(workspace_id, user_uuid)
```

**Параметры:**
- `workspace_id` (String, required)
- `user_uuid` (String, required)

**Возвращает:** `Promise<BurnoutRiskProfile>`
```typescript
{
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

**Алгоритм:**
1. Collect dialog history (last 30 days)
2. Analyze burnout indicators через LLM
3. Calculate risk_score (0-100)
4. Determine risk_level: 0-30=low, 31-70=medium, 71-100=high
5. Generate recommendations based on risk_level

**Примеры:**
```javascript
const burnout = await detect_burnout_risk('ws-123', 'user-456');
// {
//     user_uuid: 'user-456',
//     risk_level: 'medium',
//     risk_score: 55,
//     burnout_indicators: [
//         {type: 'overwork', description: 'Mentions working on weekends', severity: 'medium'},
//         {type: 'stress', description: 'Frequent deadline pressure', severity: 'high'}
//     ],
//     recommendations: ['Schedule 1-on-1 meeting', 'Review workload distribution'],
//     analyzed_at: '2025-11-09T12:00:00Z'
// }
```

---

### 3.3 analyze_workspace_trends()

**Сигнатура:**
```javascript
async function analyze_workspace_trends(workspace_id, period_days = 90)
```

**Параметры:**
- `workspace_id` (String, required)
- `period_days` (Number, optional, default=90)

**Возвращает:** `Promise<TrendAnalysis>`
```typescript
{
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

**Алгоритм:**
1. Split period на weeks
2. For each week: collect activity и sentiment metrics
3. Analyze trends через LLM
4. Identify anomalies
5. Generate predictions и concerns

**Примеры:**
```javascript
const trends = await analyze_workspace_trends('ws-123', 90);
// {
//     workspace_id: 'ws-123',
//     period_days: 90,
//     activity_trend: {
//         direction: 'increasing',
//         weekly_avg: 45,
//         change_percent: 15
//     },
//     sentiment_trend: {
//         direction: 'stable',
//         weekly_avg_score: 0.5
//     },
//     anomalies: [
//         {date: '2025-10-15', type: 'activity_drop', description: 'Activity dropped 40%'}
//     ],
//     concerns: ['Some members showing burnout signs']
// }
```

---

### 3.4 identify_at_risk_members()

**Сигнатура:**
```javascript
async function identify_at_risk_members(workspace_id)
```

**Параметры:**
- `workspace_id` (String, required)

**Возвращает:** `Promise<AtRiskMembersReport>`
```typescript
{
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

**Алгоритм:**
1. Get all workspace members
2. For each member: detect_burnout_risk()
3. Filter members с risk_score > 30 (medium+)
4. Sort by risk_score (descending)
5. Generate summary и recommendations

**Примеры:**
```javascript
const at_risk = await identify_at_risk_members('ws-123');
// {
//     workspace_id: 'ws-123',
//     at_risk_members: [
//         {user_uuid: 'user-456', name: 'Иван', risk_level: 'high', risk_score: 75, primary_concern: 'Burnout signs'},
//         {user_uuid: 'user-789', name: 'Мария', risk_level: 'medium', risk_score: 50, primary_concern: 'Low engagement'}
//     ],
//     summary: {
//         total_members: 10,
//         at_risk_count: 2,
//         high_risk_count: 1
//     },
//     recommendations: ['Schedule 1-on-1 with Иван', 'Review workload for at-risk members'],
//     analyzed_at: '2025-11-09T12:00:00Z'
// }
```

---

## 4. Helper Functions

### 4.1 calculate_sentiment_keywords()

**Сигнатура:**
```javascript
function calculate_sentiment_keywords(text)
```

**Параметры:**
- `text` (String, required) — dialog text

**Возвращает:** `Object` — {sentiment, confidence, reasoning}

**Алгоритм:**
```javascript
const POSITIVE_KEYWORDS = ['завершил', 'успешно', 'отлично', 'хорошо', 'прогресс'];
const NEGATIVE_KEYWORDS = ['блокер', 'проблема', 'задержка', 'стресс', 'сложно'];

const positive_count = count_keywords(text.toLowerCase(), POSITIVE_KEYWORDS);
const negative_count = count_keywords(text.toLowerCase(), NEGATIVE_KEYWORDS);

const sentiment = positive_count > negative_count ? 'positive' :
                 negative_count > positive_count ? 'negative' : 'neutral';

return {
    sentiment,
    confidence: 0.5,  // Lower confidence для keyword-based
    reasoning: 'Keyword-based fallback'
};
```

**Примеры:**
```javascript
const result = calculate_sentiment_keywords('Успешно завершил задачу, всё отлично!');
// {sentiment: 'positive', confidence: 0.5, reasoning: 'Keyword-based fallback'}
```

---

### 4.2 aggregate_sentiment()

**Сигнатура:**
```javascript
function aggregate_sentiment(sentiment_array)
```

**Параметры:**
- `sentiment_array` (Array, required) — массив sentiment results

**Возвращает:** `Object` — {overall_sentiment, sentiment_score, distribution}

**Алгоритм:**
```javascript
const sentiment_counts = {positive: 0, neutral: 0, negative: 0};
let total_score = 0;

for (const item of sentiment_array) {
    sentiment_counts[item.sentiment]++;

    // Convert sentiment to score
    const score = item.sentiment === 'positive' ? 1.0 :
                 item.sentiment === 'negative' ? -1.0 : 0.0;
    total_score += score;
}

const total = sentiment_array.length;
const sentiment_score = total > 0 ? total_score / total : 0.0;

const overall_sentiment = sentiment_score > 0.3 ? 'positive' :
                         sentiment_score < -0.3 ? 'negative' : 'neutral';

const distribution = {
    positive: Math.round((sentiment_counts.positive / total) * 100),
    neutral: Math.round((sentiment_counts.neutral / total) * 100),
    negative: Math.round((sentiment_counts.negative / total) * 100)
};

return {overall_sentiment, sentiment_score, distribution};
```

---

### 4.3 calculate_risk_score()

**Сигнатура:**
```javascript
function calculate_risk_score(burnout_indicators)
```

**Параметры:**
- `burnout_indicators` (Array, required) — массив burnout indicators

**Возвращает:** `Number` — risk score (0-100)

**Алгоритм:**
```javascript
const SEVERITY_WEIGHTS = {low: 10, medium: 25, high: 40};

let total_score = 0;

for (const indicator of burnout_indicators) {
    total_score += SEVERITY_WEIGHTS[indicator.severity];
}

// Cap at 100
return Math.min(100, total_score);
```

---

## 5. LLM Integration Details

### 5.1 Sentiment Analysis LLM

**Prompt Template:**
```javascript
const prompt = `
You are an AI assistant analyzing team member sentiment.

Dialog text:
"${dialog_text}"

Analyze the sentiment of this dialog. Consider:
- Emotional tone (positive, neutral, negative)
- Energy level (high, medium, low)
- Engagement (engaged, neutral, disengaged)

Provide:
1. Overall sentiment (positive/neutral/negative)
2. Confidence (0.0-1.0)
3. Brief reasoning (max 50 words)
`;

const SentimentSchema = z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
});

const llm = new ChatOpenAI({model: 'gpt-4o', temperature: 0.3})
    .withStructuredOutput(SentimentSchema);

const result = await llm.invoke(prompt);
```

---

### 5.2 Burnout Detection LLM

**Prompt Template:**
```javascript
const prompt = `
You are an AI assistant analyzing burnout risk for team members.

User dialog history (last 30 days):
${dialog_history}

Analyze for burnout indicators:
1. Overwork signals (long hours, weekend work, exhaustion mentions)
2. Stress keywords (stress, pressure, overwhelmed, tight deadlines)
3. Demotivation (lack of enthusiasm, questioning purpose, frustration)
4. Negativity patterns (consistent complaints, cynicism)

Provide:
- Array of burnout indicators found
- Risk score (0-100)
  - 0-30: Low risk
  - 31-70: Medium risk
  - 71-100: High risk
- Recommendations for manager
`;

const BurnoutSchema = z.object({
    burnout_indicators: z.array(z.object({
        type: z.enum(['overwork', 'stress', 'demotivation', 'negativity']),
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high'])
    })),
    risk_score: z.number().min(0).max(100),
    recommendations: z.array(z.string())
});

const llm = new ChatOpenAI({model: 'gpt-4o', temperature: 0.3})
    .withStructuredOutput(BurnoutSchema);

const result = await llm.invoke(prompt);
```

---

## 6. Error Handling

### 6.1 No Dialogs Found

```javascript
async function analyze_user_sentiment(workspace_id, user_uuid, period_days) {
    const dialogs = await collect_dialogs(workspace_id, user_uuid, period_days);

    if (dialogs.length === 0) {
        return {
            user_uuid,
            period_days,
            overall_sentiment: 'neutral',
            sentiment_score: 0.0,
            sentiment_distribution: {positive: 0, neutral: 0, negative: 0},
            analyzed_at: new Date().toISOString()
        };
    }
    // ...
}
```

### 6.2 LLM API Failure

```javascript
async function analyze_sentiment_with_llm(text) {
    try {
        const result = await llm.invoke(prompt);
        return result;
    } catch (error) {
        I.log_error(error, 'LLM sentiment analysis failed - using keyword fallback');
        return calculate_sentiment_keywords(text);
    }
}
```

### 6.3 Workspace Not Found

```javascript
async function identify_at_risk_members(workspace_id) {
    const members = await WorkspaceManager.get_all_workspace_members(workspace_id);

    if (!members || members.length === 0) {
        throw new Error(`Workspace ${workspace_id} not found or has no members`);
    }
    // ...
}
```

---

## 7. Usage Examples

### 7.1 Sentiment Analysis для Lead

```javascript
// Lead requests sentiment analysis для конкретного member
const sentiment = await AIInsights.analyze_user_sentiment('ws-123', 'user-456', 30);

console.log(`Sentiment: ${sentiment.overall_sentiment} (score: ${sentiment.sentiment_score})`);

if (sentiment.overall_sentiment === 'negative') {
    // Alert lead
    console.log('⚠️ Member has negative sentiment - consider 1-on-1');
}
```

### 7.2 Burnout Detection (Daily Check)

```javascript
// Daily cron: check all members for burnout risk
const at_risk = await AIInsights.identify_at_risk_members('ws-123');

if (at_risk.high_risk_count > 0) {
    // Send mood alert через NotificationRouter
    await NotificationRouter.send_mood_alert('ws-123', {
        at_risk_members: at_risk.at_risk_members.filter(m => m.risk_level === 'high'),
        overall_mood: 'negative'
    });
}
```

### 7.3 Trend Analysis (Weekly Report)

```javascript
// Weekly dashboard: include trend analysis
const trends = await AIInsights.analyze_workspace_trends('ws-123', 90);

console.log(`Activity trend: ${trends.activity_trend.direction}`);
console.log(`Sentiment trend: ${trends.sentiment_trend.direction}`);

if (trends.anomalies.length > 0) {
    console.log('⚠️ Anomalies detected:', trends.anomalies);
}
```

---

## 8. Integration Points

### 8.1 ReportsBus Integration

```javascript
// Collect dialogs
const raw_records = await ReportsBus.Dao.get_raw_records_after_date(
    workspace_id,
    user_uuid,
    start_timestamp
);

const dialogs = raw_records.map(r => r.data?.dialog_text || '').filter(t => t.length > 0);
```

### 8.2 WorkspaceManager Integration

```javascript
// Get all members for at-risk detection
const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
```

### 8.3 OpenAI Integration

```javascript
const { ChatOpenAI } = require('@langchain/openai');

const llm = new ChatOpenAI({
    modelName: 'gpt-4o',
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY
});

const structured_llm = llm.withStructuredOutput(schema);
const result = await structured_llm.invoke(prompt);
```

---

## 9. Configuration

```javascript
const AI_INSIGHTS_CONFIG = {
    LLM_MODEL: 'gpt-4o',
    LLM_TEMPERATURE: 0.3,
    SENTIMENT_PERIOD_DAYS: 30,
    BURNOUT_PERIOD_DAYS: 30,
    TREND_PERIOD_DAYS: 90,
    RISK_THRESHOLDS: {
        LOW: 30,
        MEDIUM: 70
    },
    SENTIMENT_THRESHOLDS: {
        POSITIVE: 0.3,
        NEGATIVE: -0.3
    }
};
```

---

## 10. Testing Requirements

**Unit Tests:**
```javascript
describe('AIInsights', () => {
    it('should analyze sentiment correctly');
    it('should detect burnout risk');
    it('should fallback to keywords when LLM fails');
    it('should aggregate sentiment correctly');
    it('should identify at-risk members');
    it('should handle no dialogs edge case');
});
```

**Integration Tests:**
```javascript
describe('AIInsights Integration', () => {
    it('should integrate with ReportsBus for dialogs');
    it('should integrate with OpenAI for LLM analysis');
    it('should work end-to-end for sentiment analysis');
});
```

---

**Status:** ✅ Complete API Contract
**Next Step:** Implementation
**Version:** 1.0.0
**Created:** 2025-11-09
