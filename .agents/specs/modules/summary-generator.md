# Спецификация модуля: SummaryGenerator

**Роль:** Architect
**Фаза:** Phase 3 - Priority 2 (Feature Modules)
**Приоритет:** Priority 2 (Important - основной функционал)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**SummaryGenerator** — модуль для генерации сводок о состоянии команды/проекта для руководителей workspace. Модуль собирает structured отчеты из ReportsBus, анализирует активность участников и формирует краткие, информативные сводки с помощью AI.

### Ключевые концепции:

**Summary Types** — различные типы сводок (daily, weekly, initiatives, mood).

**Structured Reports** — использование processed records из ReportsBus для формирования контекста.

**AI Summarization** — использование LLM (gpt-4o) для генерации человекочитаемых сводок.

**Workspace-centric** — сводки генерируются для workspace, учитывая всех участников.

### Назначение модуля:

- Генерация ежедневных сводок для руководителей
- Генерация еженедельных обзоров
- Сводки по инициативам и проектам
- Анализ настроения команды (mood analysis)
- Определение рисков и блокеров

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ SummaryGenerator:

✅ **Summary generation:**
- Сбор processed records из ReportsBus
- Агрегация данных по workspace
- AI генерация сводок (через LLM)
- Форматирование в human-readable формат

✅ **Summary types:**
- Daily summary (ежедневная активность)
- Weekly summary (недельный обзор)
- Initiatives summary (прогресс по инициативам)
- Mood summary (настроение команды)

✅ **Context enrichment:**
- Получение workspace info (название, участники)
- Определение lead/participants
- Временные рамки (today, this week, etc.)

✅ **Risk detection:**
- Выявление блокеров
- Определение неактивных участников
- Зависимости между задачами

### Что НЕ ДЕЛАЕТ SummaryGenerator:

❌ Прямое взаимодействие с пользователями (это NotificationRouter)
❌ Хранение отчетов (это ReportsBus)
❌ Управление workspace (это WorkspaceManager)
❌ Отправка уведомлений (это NotificationRouter)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты
  "@langchain/core": "^0.3.0",            // LangChain core
  "@langchain/openai": "^0.3.0",          // OpenAI integration
  "zod": "^3.22.0"                        // Schema validation
}
```

### Внутренние модули:

- **ReportsBus** — получение processed records, notification_history
- **WorkspaceManager** — получение workspace info, members, roles
- **InitiativesTracker** (Future) — прогресс по инициативам

### Infrastructure:

- **OpenAI API** — LLM для генерации сводок (gpt-4o)
- **YDB** (через ReportsBus) — хранилище данных

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/summary-generator.js
├─ SummaryGenerator (Main Logic)
│  ├─ generate_daily_summary(workspace_id, date) - ежедневная сводка
│  ├─ generate_weekly_summary(workspace_id, week_start) - недельная сводка
│  ├─ generate_initiatives_summary(workspace_id) - сводка по инициативам
│  ├─ generate_mood_summary(workspace_id, period) - анализ настроения
│  └─ generate_custom_summary(workspace_id, options) - кастомная сводка
│
└─ Helpers
   ├─ collect_workspace_activity(workspace_id, date_range) - сбор активности
   ├─ analyze_team_mood(members_activity) - анализ настроения
   ├─ detect_risks(members_activity) - определение рисков
   └─ format_summary_output(summary_data) - форматирование output
```

---

## 5. Алгоритмы и процессы

### 5.1 Процесс: Daily Summary Generation

```
[generate_daily_summary(workspace_id, date)]
         │
         ├─> ЭТАП 1: Сбор данных
         │    ├─> WorkspaceManager.get_workspace_info(workspace_id)
         │    ├─> WorkspaceManager.get_all_workspace_members(workspace_id)
         │    ├─> collect_workspace_activity(workspace_id, {start: today, end: today})
         │    └─> Получение processed records за сегодня
         │
         ├─> ЭТАП 2: Подготовка контекста для LLM
         │    ├─> Workspace info (название, участники)
         │    ├─> Activity data (кто что сделал)
         │    ├─> News и updates (из processed.news)
         │    └─> Notification history (контекст)
         │
         ├─> ЭТАП 3: AI генерация сводки
         │    ├─> Формирование prompt для LLM
         │    ├─> Вызов ChatOpenAI (gpt-4o)
         │    ├─> Structured output через Zod schema
         │    └─> Extraction: summary_text, highlights, risks, mood
         │
         ├─> ЭТАП 4: Форматирование output
         │    ├─> HTML форматирование
         │    ├─> Добавление metadata (date, workspace)
         │    └─> Формирование финального текста
         │
         └─> return summary_object
```

### 5.2 Процесс: Weekly Summary Generation

```
[generate_weekly_summary(workspace_id, week_start)]
         │
         ├─> ЭТАП 1: Определение временного диапазона
         │    ├─> week_start = Monday of current week
         │    ├─> week_end = Sunday of current week
         │    └─> day_range = [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
         │
         ├─> ЭТАП 2: Сбор данных за неделю
         │    ├─> collect_workspace_activity(workspace_id, {start: week_start, end: week_end})
         │    ├─> Агрегация по дням
         │    └─> Получение всех processed records за неделю
         │
         ├─> ЭТАП 3: Анализ трендов
         │    ├─> analyze_team_mood() - динамика настроения
         │    ├─> detect_risks() - появление блокеров
         │    ├─> Определение most active members
         │    └─> Определение inactive members
         │
         ├─> ЭТАП 4: AI генерация недельной сводки
         │    ├─> Prompt с weekly context
         │    ├─> LLM summarization
         │    ├─> Extraction: week_summary, trends, top_achievements, concerns
         │    └─> Recommendations для следующей недели
         │
         └─> return weekly_summary_object
```

### 5.3 Процесс: Initiatives Summary Generation

```
[generate_initiatives_summary(workspace_id)]
         │
         ├─> ЭТАП 1: Получение инициатив
         │    ├─> InitiativesTracker.get_all_initiatives(workspace_id) (Future)
         │    ├─> Временная заглушка: extract initiatives from processed records
         │    └─> Group by initiative/project
         │
         ├─> ЭТАП 2: Агрегация прогресса по инициативам
         │    ├─> Для каждой инициативы:
         │    │    ├─> Кто работает (contributors)
         │    │    ├─> Последние updates
         │    │    ├─> Статус (on track, delayed, blocked)
         │    │    └─> Dependencies
         │    └─> Формирование initiatives_context
         │
         ├─> ЭТАП 3: AI анализ
         │    ├─> Prompt с initiatives data
         │    ├─> LLM summarization
         │    ├─> Extraction: initiatives_progress, blockers, recommendations
         │    └─> Priority initiatives (top 3-5)
         │
         └─> return initiatives_summary_object
```

### 5.4 Процесс: Mood Analysis

```
[generate_mood_summary(workspace_id, period = '7d')]
         │
         ├─> ЭТАП 1: Сбор данных о настроении
         │    ├─> collect_workspace_activity(workspace_id, period)
         │    ├─> Извлечение sentiment из notification_history
         │    └─> Определение mood indicators:
         │         ├─> Positive: achievements, progress, celebrations
         │         ├─> Negative: blockers, delays, frustrations
         │         └─> Neutral: regular updates
         │
         ├─> ЭТАП 2: Анализ по участникам
         │    ├─> Для каждого участника:
         │    │    ├─> Mood score (positive/neutral/negative ratio)
         │    │    ├─> Activity level (high/medium/low)
         │    │    └─> Engagement (sharing frequency)
         │    └─> Определение at-risk members (low mood + low activity)
         │
         ├─> ЭТАП 3: Team mood aggregation
         │    ├─> Overall team mood (average score)
         │    ├─> Mood distribution (% positive, neutral, negative)
         │    ├─> Mood trend (improving, stable, declining)
         │    └─> Burnout risk indicators
         │
         ├─> ЭТАП 4: AI interpretation
         │    ├─> Prompt с mood data
         │    ├─> LLM analysis
         │    ├─> Extraction: mood_summary, concerns, recommendations
         │    └─> Action items для руководителя
         │
         └─> return mood_summary_object
```

---

## 6. API спецификация

> **Детальный API contract** будет в `.agents/specs/api-contracts/summary-generator-api.md`

### 6.1 generate_daily_summary()

**Назначение:** Генерация ежедневной сводки о состоянии команды

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `date` (String, optional, default=today) — дата в формате YYYY-MM-DD

**Возвращает:** `Promise<Object>` — Daily summary object

**Структура возврата:**
```javascript
{
    type: 'daily',
    workspace_id: 'ws-123',
    workspace_name: 'Команда разработки',
    date: '2025-11-09',
    summary_text: 'Краткая сводка дня...',
    highlights: [
        'Иван завершил проект X',
        'Мария провела презентацию'
    ],
    risks: [
        'Петр не делился 3 дня - возможный блокер'
    ],
    mood: 'positive', // 'positive' | 'neutral' | 'negative'
    members_active: 15,
    members_total: 20,
    activity_score: 0.75,
    generated_at: 1699999999
}
```

---

### 6.2 generate_weekly_summary()

**Назначение:** Генерация недельной сводки с трендами и достижениями

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `week_start` (String, optional, default=this Monday) — начало недели YYYY-MM-DD

**Возвращает:** `Promise<Object>` — Weekly summary object

**Структура возврата:**
```javascript
{
    type: 'weekly',
    workspace_id: 'ws-123',
    workspace_name: 'Команда разработки',
    week_start: '2025-11-04',
    week_end: '2025-11-10',
    summary_text: 'Итоги недели...',
    top_achievements: [
        'Завершено 5 проектов',
        'Проведена успешная презентация'
    ],
    concerns: [
        '2 участника неактивны всю неделю',
        'Проект Y задерживается'
    ],
    trends: {
        mood: 'improving',        // 'improving' | 'stable' | 'declining'
        activity: 'high',         // 'high' | 'medium' | 'low'
        collaboration: 'increasing' // 'increasing' | 'stable' | 'decreasing'
    },
    most_active: ['user-1', 'user-2', 'user-3'],
    inactive: ['user-10', 'user-11'],
    recommendations: [
        'Провести 1-on-1 с неактивными участниками',
        'Уточнить блокеры по проекту Y'
    ],
    generated_at: 1699999999
}
```

---

### 6.3 generate_initiatives_summary()

**Назначение:** Сводка по инициативам и проектам

**Параметры:**
- `workspace_id` (String, required) — ID workspace

**Возвращает:** `Promise<Object>` — Initiatives summary object

**Структура возврата:**
```javascript
{
    type: 'initiatives',
    workspace_id: 'ws-123',
    workspace_name: 'Команда разработки',
    summary_text: 'Прогресс по инициативам...',
    initiatives: [
        {
            name: 'Проект X',
            status: 'on_track',    // 'on_track' | 'delayed' | 'blocked'
            contributors: ['user-1', 'user-2'],
            last_update: 'Завершена интеграция',
            blockers: []
        },
        {
            name: 'Проект Y',
            status: 'delayed',
            contributors: ['user-3'],
            last_update: 'Ожидание ресурсов',
            blockers: ['Нет доступа к API']
        }
    ],
    priorities: ['Проект X', 'Проект Y'],  // Top 3-5
    recommendations: [
        'Проект Y: выделить дополнительные ресурсы',
        'Проект X: ready for review'
    ],
    generated_at: 1699999999
}
```

---

### 6.4 generate_mood_summary()

**Назначение:** Анализ настроения команды

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `period` (String, optional, default='7d') — период анализа ('1d', '7d', '30d')

**Возвращает:** `Promise<Object>` — Mood summary object

**Структура возврата:**
```javascript
{
    type: 'mood',
    workspace_id: 'ws-123',
    workspace_name: 'Команда разработки',
    period: '7d',
    summary_text: 'Общее настроение команды...',
    overall_mood: 'positive',   // 'positive' | 'neutral' | 'negative'
    mood_distribution: {
        positive: 0.60,  // 60%
        neutral: 0.30,   // 30%
        negative: 0.10   // 10%
    },
    mood_trend: 'stable',       // 'improving' | 'stable' | 'declining'
    at_risk_members: [
        {
            user_uuid: 'user-10',
            name: 'Петр',
            mood_score: -0.5,    // -1 to 1
            activity_level: 'low',
            last_shared: 5        // дней назад
        }
    ],
    burnout_indicators: [
        'Петр не делился 5 дней',
        'Мария работает 7 дней без перерыва'
    ],
    recommendations: [
        '1-on-1 с Петром',
        'Предложить Марии взять выходной'
    ],
    generated_at: 1699999999
}
```

---

### 6.5 generate_custom_summary()

**Назначение:** Генерация кастомной сводки с заданными параметрами

**Параметры:**
- `workspace_id` (String, required) — ID workspace
- `options` (Object, required) — параметры сводки
  - `options.type` (String) — тип сводки или custom
  - `options.date_range` (Object) — временной диапазон
  - `options.focus` (Array<String>) — фокусные области
  - `options.include_risks` (Boolean) — включать ли риски
  - `options.include_recommendations` (Boolean) — включать ли рекомендации

**Возвращает:** `Promise<Object>` — Custom summary object

---

## 7. Helper Functions

### 7.1 collect_workspace_activity()

**Назначение:** Сбор активности workspace за заданный период

**Параметры:**
- `workspace_id` (String) — ID workspace
- `date_range` (Object) — {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}

**Возвращает:** `Promise<Object>` — Activity data

**Алгоритм:**
1. Получение всех членов workspace
2. Для каждого участника:
   - Получение processed records за период
   - Получение notification_history
   - Подсчет активности (количество updates)
3. Агрегация данных по workspace

---

### 7.2 analyze_team_mood()

**Назначение:** Анализ настроения команды на основе activity data

**Параметры:**
- `members_activity` (Array<Object>) — данные активности участников

**Возвращает:** `Object` — Mood analysis

**Алгоритм:**
1. Для каждого участника определение mood score
2. Агрегация в overall mood
3. Определение trend (сравнение с предыдущим периодом)
4. Выявление at-risk members

---

### 7.3 detect_risks()

**Назначение:** Определение рисков и блокеров

**Параметры:**
- `members_activity` (Array<Object>) — данные активности

**Возвращает:** `Array<String>` — Список рисков

**Алгоритм:**
1. Inactive members (> 3 days без sharing)
2. Blockers (упоминания "блокер", "задержка", "проблема")
3. Dependencies (зависимости между задачами)
4. Overwork (работа 7 дней без перерыва)

---

### 7.4 format_summary_output()

**Назначение:** Форматирование summary в HTML/Markdown

**Параметры:**
- `summary_data` (Object) — raw summary data

**Возвращает:** `String` — formatted text (HTML or Markdown)

---

## 8. Configuration

### 8.1 Environment Variables

```javascript
{
    OPENAI_API_KEY: String,         // OpenAI API key
    SUMMARY_MODEL: String,          // Model name (default: 'gpt-4o')
    SUMMARY_TEMPERATURE: Number,    // Temperature (default: 0.3)
    SUMMARY_MAX_TOKENS: Number      // Max tokens (default: 2000)
}
```

### 8.2 Constants

```javascript
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'gpt-4o';
const SUMMARY_TEMPERATURE = parseFloat(process.env.SUMMARY_TEMPERATURE) || 0.3;
const SUMMARY_MAX_TOKENS = parseInt(process.env.SUMMARY_MAX_TOKENS) || 2000;

const MOOD_THRESHOLDS = {
    POSITIVE: 0.3,      // > 0.3 = positive
    NEGATIVE: -0.3      // < -0.3 = negative
};

const RISK_THRESHOLDS = {
    INACTIVE_DAYS: 3,           // > 3 days = at risk
    BURNOUT_CONSECUTIVE_DAYS: 7 // 7 days without break
};
```

---

## 9. Edge Cases и Error Handling

### 9.1 Edge Case: Нет данных за период

**Ситуация:** collect_workspace_activity() вернул пустой массив

**Решение:**
- Логировать: "No activity data for workspace {id} in period {range}"
- Вернуть summary с пустыми highlights/achievements
- Summary text: "За указанный период не зафиксировано активности"

### 9.2 Edge Case: LLM недоступен

**Ситуация:** ChatOpenAI выбросил ошибку (rate limit, timeout)

**Решение:**
- Try-catch вокруг LLM calls
- Fallback: генерация простой сводки без AI (шаблонная)
- Логировать ошибку
- Вернуть базовый summary_object с template text

### 9.3 Edge Case: Workspace не найден

**Ситуация:** WorkspaceManager.get_workspace_info() вернул null

**Решение:**
- Выбросить ошибку: "Workspace not found"
- Логировать
- Вернуть null

### 9.4 Edge Case: Все участники неактивны

**Ситуация:** members_active = 0

**Решение:**
- Summary text: "Вся команда неактивна за период"
- Риски: "Критическая неактивность - требуется внимание"
- Mood: 'negative'

---

## 10. Performance Considerations

### 10.1 LLM Optimization

**Проблема:** Дорогие LLM вызовы (gpt-4o)

**Решение:**
- Ограничение max_tokens (2000)
- Temperature = 0.3 (более предсказуемый output)
- Caching частых prompts (Future)

### 10.2 Data Collection

**Проблема:** Сбор данных для больших workspace (> 100 members)

**Решение:**
- Batch processing через ReportsBus API
- Параллельные запросы где возможно
- Limit на количество processed records (последние 100)

---

## 11. Testing Requirements

### 11.1 Unit Tests

**Обязательные тесты:**
- generate_daily_summary() - различные сценарии (0 activity, high activity, risks)
- generate_weekly_summary() - trends, top achievements
- analyze_team_mood() - positive, neutral, negative scenarios
- detect_risks() - inactive members, blockers, burnout
- format_summary_output() - HTML/Markdown formatting

**Mocks:**
- ReportsBus methods
- WorkspaceManager methods
- ChatOpenAI (LLM)

### 11.2 Integration Tests

**Обязательные тесты:**
- End-to-end: collect data → AI generation → formatted summary
- LLM integration (real API call)
- Edge cases (no data, LLM error)

---

## 12. Migration from Legacy

**Legacy implementation:** НЕТ (новый модуль)

**Новая функциональность:**
- Генерация сводок для руководителей
- AI-driven summarization
- Mood analysis
- Risk detection

---

## 13. Acceptance Criteria

### Критерии приемки модуля:

- ✅ generate_daily_summary() работает корректно
- ✅ generate_weekly_summary() с трендами
- ✅ generate_mood_summary() с at-risk detection
- ✅ LLM integration (ChatOpenAI) работает
- ✅ Structured output через Zod schema
- ✅ Error handling для edge cases
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests с ReportsBus и WorkspaceManager
- ✅ HTML/Markdown форматирование

---

## 14. Future Enhancements (v2.0.0)

- Integration с InitiativesTracker (initiatives summary)
- Sentiment analysis через ML models (вместо keyword-based)
- Автоматическое определение critical updates
- Персонализация сводок для разных руководителей
- Export в PDF/Slack/Email
- Dashboard integration (визуализация)

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/summary-generator-api.md`
