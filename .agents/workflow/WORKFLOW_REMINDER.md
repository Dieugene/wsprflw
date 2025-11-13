# WORKFLOW REMINDER - Quick Reference

⚠️ **ВСЕГДА ЧИТАЙ ЭТОТ ФАЙЛ ПЕРЕД НАЧАЛОМ РАБОТЫ**

## Текущий workflow

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: ARCHITECTURE (Architect)                         │
│  → system-design.md, folder-structure.md, data-flow.md     │
│  → tech-stack.md                                           │
│  → Определить список модулей                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2-5: MODULE DEVELOPMENT (Iterative)                 │
│                                                             │
│  Для каждого модуля:                                       │
│                                                             │
│  1. Architect → Пишет спецификацию модуля                  │
│     Output: .agents/specs/modules/{module}.md              │
│             .agents/specs/api-contracts/{module}-api.md    │
│                                                             │
│  2. Developer → Реализует модуль                           │
│     Output: src/{path}/{module}.js                         │
│             tests/{module}.test.js                         │
│                                                             │
│  3. Reviewer → Code review                                 │
│     Output: ✅ ОДОБРЕНО → next step                        │
│             ❌ ДОРАБОТКА → return to Developer             │
│                                                             │
│  4. Tester → Integration тесты                             │
│     Output: tests/integration/{module}-integration.test.js │
│             ✅ PASS → next step                            │
│             ❌ FAIL → return to Developer                  │
│                                                             │
│  5. Architect → Приемка модуля                             │
│     Output: Обновить module-status.md                      │
│             Выбрать следующий модуль                       │
│             Вернуться к шагу 1                             │
└─────────────────────────────────────────────────────────────┘
```

## Текущий статус проекта

**Этап:** Phase 1 (Architecture) - Не начат

**Следующий шаг:** Architect создает архитектурные документы

**Отслеживание:** `.agents/workflow/module-status.md`

## Быстрый checklist для каждой роли

### Architect (сейчас):
1. [ ] Прочитать `.agents/roles/architect.md`
2. [ ] Прочитать `project assistant description/FUNCTIONAL_REQUIREMENTS.md`
3. [ ] Прочитать `project assistant description/PRODUCT_STRATEGY.md`
4. [ ] Учесть serverless специфику (см. ниже)
5. [ ] Создать 4 архитектурных документа
6. [ ] Обновить module-status.md

### Developer:
1. [ ] Прочитать `.agents/roles/developer.md`
2. [ ] Прочитать спецификацию модуля
3. [ ] Прочитать API контракт
4. [ ] Реализовать модуль
5. [ ] Написать unit-тесты
6. [ ] Передать Reviewer

### Reviewer:
1. [ ] Прочитать `.agents/roles/reviewer.md`
2. [ ] Прочитать код и тесты
3. [ ] Прочитать спецификацию
4. [ ] Проверить по чеклисту
5. [ ] Вынести вердикт (ОДОБРЕНО/ДОРАБОТКА)

### Tester:
1. [ ] Прочитать `.agents/roles/tester.md`
2. [ ] Прочитать спецификацию
3. [ ] Написать integration тесты
4. [ ] Запустить тесты
5. [ ] Вынести вердикт (PASS/FAIL)

## Критичные ограничения для Architect

### ⚠️ Serverless специфика (Yandex Cloud Functions)

**ВАЖНО:** Система работает на Yandex Cloud Serverless Functions с холодными стартами.

#### 1. Точка входа (Entry Point)
- **Файл:** `index.js` (корневой)
- **Экспорт:** `module.exports.process = async function(inputData) { ... }`
- **Входные данные:** `inputData` содержит `action`, `context`, `data`
- **Роутер:** Использует роутер для анализа источника запроса

#### 2. Источники запросов
```javascript
Источник → Роутер → Обработчик

1. Telegram Webhook  → router → bot_handler
2. Message Queue     → router → queue_handler
3. Timer Trigger     → router → timer_handler
4. Admin API         → router → admin_handler
```

#### 3. Cold Start оптимизация

**Проблема:** Большая функция с множеством импортов = медленный старт

**Решение (на выбор Architect):**

**Вариант A: Одна функция + Lazy imports**
```javascript
// ❌ Плохо: импорт всегда
const ReportsBus = require('./reports-bus');
const SummaryGenerator = require('./summary-generator');

// ✅ Хорошо: ленивый импорт
async function handleReport() {
    const { ReportsBus } = await import('./reports-bus.js');
    // use ReportsBus
}
```

**Вариант B: Несколько специализированных функций**
```
function-telegram-webhook/    # Только обработка Telegram
  ├─ index.js
  └─ dependencies: telegram, dialog

function-timer/               # Только таймеры
  ├─ index.js
  └─ dependencies: reports-bus, summary

function-queue/               # Только очередь
  ├─ index.js
  └─ dependencies: ai-processing
```

**Рекомендация Architect:** Выбери один из вариантов и обоснуй в `tech-stack.md`

#### 4. Роутер (из legacy)

**Референс:** `legacy/index.js` строки 317-349

```javascript
module.exports.reg_dispatcher_handlers = function ({ Timers, Queues, Webs, Admins }) {

    // Timer handler
    if (typeof Timers.reg === 'function') {
        Timers.reg(async function(input) {
            // Обработка таймеров
        })
    }

    // Queue handler
    if (typeof Queues.reg === 'function') {
        Queues.reg(async function(input) {
            // Обработка очереди
        })
    }

    // Admin API handler
    if (typeof Admins.reg === 'function') {
        Admins.reg(async function(input) {
            // Обработка admin запросов
        })
    }
}
```

**Architect должен спроектировать:**
- Структуру точек входа
- Routing логику
- Lazy loading strategy
- Разделение на функции (если нужно)

## Напоминания

### Для Architect:
- НЕ пиши реализацию - только спецификации и интерфейсы
- Учитывай serverless ограничения (stateless, cold start, timeout)
- Batch processing для AI операций (экономия токенов)
- Документируй ВСЕ архитектурные решения

### Для Developer:
- Следуй спецификации на 100%
- НЕ меняй API без согласования с Architect
- Все публичные функции должны быть покрыты тестами

### Для Reviewer:
- Проверяй соответствие спецификации
- НЕ придирайся к стилю - только к сути
- Критические замечания блокируют одобрение

### Для Tester:
- Integration тесты для критичных сценариев
- Используй моки для внешних зависимостей
- НЕ пиши реальные тесты с Telegram

## Порядок приоритета модулей (ориентировочно)

### Priority 1 (Core):
1. ReportsBus
2. DialogSystem
3. TimerHandler
4. WorkspaceManager

### Priority 2 (Features):
5. SummaryGenerator
6. NotificationRouter
7. InitiativesTracker
8. DependencyDetector

### Priority 3 (Integration):
9. YouGileSync
10. JiraSync

### Priority 4 (Analytics):
11. DashboardGenerator
12. AIInsights

## Коммуникация между ролями

**Передача контекста:**
- Architect → Developer: "Реализуй модуль X согласно спецификации в .agents/specs/modules/X.md"
- Developer → Reviewer: "Проверь код модуля X: src/modules/X.js"
- Reviewer → Tester: "Код модуля X одобрен, протестируй интеграцию"
- Tester → Architect: "Модуль X прошел тесты, готов к приемке"

## Файлы для отслеживания

- **Workflow:** `.agents/workflow/WORKFLOW_REMINDER.md` (этот файл)
- **Статус:** `.agents/workflow/module-status.md`
- **Процесс:** `.agents/workflow/development-process.md` (детальный)

---

_Last updated: 2024-11-06_

**⚠️ ПЕРЕЧИТЫВАЙ ЭТОТ ФАЙЛ ПЕРЕД КАЖДЫМ ЭТАПОМ РАБОТЫ**
