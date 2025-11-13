# Agent-Based Development Structure

Эта директория содержит инфраструктуру для agent-based разработки "Проектного Ассистента".

## Структура

```
.agents/
├── roles/                  # Описание ролей агентов
│   ├── architect.md        # Роль архитектора
│   ├── developer.md        # Роль разработчика
│   ├── reviewer.md         # Роль ревьюера
│   └── tester.md          # Роль тестировщика
│
├── workflow/              # Процессы и tracking
│   ├── development-process.md  # Процесс разработки
│   └── module-status.md       # Статус модулей
│
├── architecture/          # Архитектурные документы
│   ├── system-design.md       # Общая архитектура (создаст Architect)
│   ├── folder-structure.md    # Структура папок (создаст Architect)
│   ├── data-flow.md          # Диаграммы потоков данных (создаст Architect)
│   └── tech-stack.md         # Технологический стек (создаст Architect)
│
└── specs/                 # Спецификации модулей
    ├── modules/           # Спецификации отдельных модулей (создаст Architect)
    │   └── [module-name].md
    └── api-contracts/     # API контракты (создаст Architect)
        └── [module-name]-api.md
```

## Роли агентов

### 1. Architect (Архитектор)
**Ответственность:**
- Проектирование архитектуры системы
- Написание спецификаций модулей
- Определение API контрактов
- Приемка завершенных модулей

**Файл роли:** `.agents/roles/architect.md`

### 2. Developer (Разработчик)
**Ответственность:**
- Реализация модулей согласно спецификациям
- Написание unit-тестов
- Документирование кода

**Файл роли:** `.agents/roles/developer.md`

### 3. Reviewer (Ревьюер)
**Ответственность:**
- Code review
- Проверка соответствия спецификациям
- Проверка качества кода и тестов

**Файл роли:** `.agents/roles/reviewer.md`

### 4. Tester (Тестировщик)
**Ответственность:**
- Integration тестирование
- Проверка интеграции модулей
- QA end-to-end сценариев

**Файл роли:** `.agents/roles/tester.md`

## Workflow (Процесс разработки)

```
Architect → Developer → Reviewer → Tester → Architect
   ↓           ↓           ↓           ↓        ↓
  Spec       Code      Review      Tests    Accept
                         ↓
                     (если ошибки)
                         ↓
                    Developer
```

Подробнее: `.agents/workflow/development-process.md`

## Tracking прогресса

Статус всех модулей отслеживается в `.agents/workflow/module-status.md`

Формат:
- 🟢 Completed
- 🟡 In Progress
- 🔴 Blocked
- ⚪ Not Started

## Как использовать

### Запуск Architect для Phase 1 (Architecture):

1. Прочитать:
   - `project assistant description/FUNCTIONAL_REQUIREMENTS.md`
   - `project assistant description/PRODUCT_STRATEGY.md`
   - `.agents/roles/architect.md`

2. Создать:
   - `.agents/architecture/system-design.md`
   - `.agents/architecture/folder-structure.md`
   - `.agents/architecture/data-flow.md`
   - `.agents/architecture/tech-stack.md`

3. Обновить:
   - `.agents/workflow/module-status.md` (Phase 1 статус)

### Запуск Developer для модуля:

1. Прочитать:
   - `.agents/specs/modules/{module-name}.md`
   - `.agents/specs/api-contracts/{module-name}-api.md`
   - `.agents/roles/developer.md`

2. Реализовать:
   - `src/{module-path}/{module-name}.js`
   - `tests/{module-name}.test.js`

3. Передать Reviewer

### Запуск Reviewer:

1. Прочитать:
   - `src/{module-path}/{module-name}.js`
   - `tests/{module-name}.test.js`
   - `.agents/specs/modules/{module-name}.md`
   - `.agents/roles/reviewer.md`

2. Проверить и вынести вердикт:
   - ✅ ОДОБРЕНО → передать Tester
   - ❌ ТРЕБУЕТ ДОРАБОТКИ → вернуть Developer

### Запуск Tester:

1. Прочитать:
   - Одобренный код модуля
   - `.agents/specs/modules/{module-name}.md`
   - `.agents/roles/tester.md`

2. Создать integration тесты:
   - `tests/integration/{module-name}-integration.test.js`

3. Вынести вердикт:
   - ✅ ГОТОВО → передать Architect для приемки
   - ❌ ТРЕБУЕТСЯ ДОРАБОТКА → вернуть Developer

## Текущий статус

**Phase:** Preparation (Completed ✅)

**Next step:**
1. Запустить **Architect** агента для Phase 1 (Architecture)
2. Architect создаст архитектурные документы
3. После Phase 1 → начать разработку core модулей

## Важные принципы

1. **Одна роль = один контекст**
   - Не смешивай роли в одной сессии
   - Каждый агент фокусируется на своей задаче

2. **Четкие handoff**
   - Явная передача контекста между агентами
   - Документируй что сделано и что нужно дальше

3. **Следуй процессу**
   - Не пропускай этапы (spec → dev → review → test)
   - Качество важнее скорости

4. **Документируй все**
   - Каждое решение должно быть зафиксировано
   - Обновляй module-status.md

## Технический стек

**Платформа:** Yandex Cloud Serverless Functions
**База данных:** YDB (Yandex Database)
**Очереди:** Yandex Message Queue
**Язык:** JavaScript (Node.js)
**Bot Framework:** Telegraf (Telegram Bot API)
**AI/LLM:** LangChain + Claude/GPT

**Ключевые паттерны из legacy:**
- Event Bus Architecture (ContentBus → ReportsBus)
- Batch AI Processing
- Timer + Queue System
- LangChain Tools
- Dialog Observers

## Контакты и вопросы

Если агент не понимает спецификацию или нужны уточнения:
1. Документируй вопросы
2. Architect уточняет спецификацию
3. Продолжай работу после уточнений

---

_Last updated: 2024-11-06_
