# Development Process: Проектный Ассистент

## Общий workflow

```
┌──────────────┐
│  Architect   │
│  (Agent 1)   │
└──────┬───────┘
       │
       ├─> Создает system-design.md
       ├─> Создает folder-structure.md
       ├─> Пишет спецификацию модуля X
       │
       v
┌──────────────┐
│  Developer   │
│  (Agent 2)   │
└──────┬───────┘
       │
       ├─> Реализует модуль X
       ├─> Пишет unit-тесты
       │
       v
┌──────────────┐
│   Reviewer   │
│  (Agent 3)   │
└──────┬───────┘
       │
       ├─> Проверяет код
       ├─> Находит проблемы?
       │
       ├─> ❌ ДА → возврат Developer
       │
       └─> ✅ НЕТ
              │
              v
       ┌──────────────┐
       │   Tester     │
       │  (Agent 4)   │
       └──────┬───────┘
              │
              ├─> Integration тесты
              ├─> Находит проблемы?
              │
              ├─> ❌ ДА → возврат Developer
              │
              └─> ✅ НЕТ
                     │
                     v
              ┌──────────────┐
              │  Architect   │
              │   (приемка)  │
              └──────┬───────┘
                     │
                     ├─> Одобряет модуль X
                     ├─> Пишет спецификацию модуля Y
                     │
                     v
              [Цикл повторяется для модуля Y]
```

## Фазы разработки

### Phase 0: Подготовка (сделано)
✅ Перенос legacy кода в `legacy/`
✅ Создание структуры `.agents/`
✅ Написание ролей (architect, developer, reviewer, tester)
✅ Написание workflow документов

### Phase 1: Архитектура
**Агент:** Architect

**Задачи:**
1. Создать `system-design.md` (общая архитектура)
2. Создать `folder-structure.md` (структура папок и файлов)
3. Создать `data-flow.md` (диаграммы потоков данных)
4. Создать `tech-stack.md` (технологический стек)
5. Определить список модулей и их приоритет

**Выход:**
- `.agents/architecture/system-design.md`
- `.agents/architecture/folder-structure.md`
- `.agents/architecture/data-flow.md`
- `.agents/architecture/tech-stack.md`
- `.agents/workflow/module-status.md` (список модулей)

**Критерии завершения:**
- Архитектура понятна и документирована
- Модули определены и приоритизированы
- Структура папок спроектирована
- Нет циклических зависимостей

### Phase 2: Разработка модулей (итеративно)

Для каждого модуля выполняется цикл:

#### Iteration N.1: Спецификация модуля
**Агент:** Architect

**Задачи:**
1. Выбрать следующий модуль из списка (по приоритету)
2. Написать детальную спецификацию модуля
3. Написать API контракт

**Выход:**
- `.agents/specs/modules/{module-name}.md`
- `.agents/specs/api-contracts/{module-name}-api.md`

**Критерии завершения:**
- Спецификация полная и однозначная
- API контракт четко определен
- Зависимости перечислены
- Границы ответственности понятны

#### Iteration N.2: Реализация модуля
**Агент:** Developer

**Задачи:**
1. Прочитать спецификацию и API контракт
2. Реализовать модуль согласно спецификации
3. Написать unit-тесты
4. Документировать публичные функции (JSDoc)

**Выход:**
- `src/{module-path}/{module-name}.js`
- `tests/{module-name}.test.js`

**Критерии завершения:**
- Код соответствует спецификации
- Все публичные функции покрыты тестами
- Тесты проходят
- Код документирован

#### Iteration N.3: Code Review
**Агент:** Reviewer

**Задачи:**
1. Проверить соответствие спецификации
2. Проверить качество кода
3. Проверить тесты
4. Проверить документацию
5. Вынести вердикт

**Выход:**
- Если **ОДОБРЕНО** → переход к Iteration N.4
- Если **ТРЕБУЕТ ДОРАБОТКИ** → возврат к Iteration N.2 (Developer исправляет)

**Критерии завершения:**
- Все замечания исправлены
- Код соответствует спецификации
- Качество кода приемлемо

#### Iteration N.4: Integration Testing
**Агент:** Tester

**Задачи:**
1. Написать integration тесты для модуля
2. Проверить интеграцию с другими модулями
3. Проверить error handling на стыках
4. Вынести вердикт

**Выход:**
- `tests/integration/{module-name}-integration.test.js`
- Отчет о тестировании

**Критерии завершения:**
- Integration тесты проходят
- Нет критических проблем

#### Iteration N.5: Приемка
**Агент:** Architect

**Задачи:**
1. Принять модуль
2. Обновить статус модуля в `.agents/workflow/module-status.md`
3. Выбрать следующий модуль для разработки

**Критерии завершения:**
- Модуль одобрен и готов к интеграции
- Статус обновлен
- Следующий модуль выбран

### Phase 3: Интеграция системы
**Агент:** Architect + Tester

**Задачи:**
1. Интегрировать все модули
2. Проверить end-to-end flow
3. Запустить полный набор integration тестов
4. Проверить работу системы в целом

**Выход:**
- Полностью интегрированная система
- Отчет о полном тестировании

**Критерии завершения:**
- Все модули интегрированы
- End-to-end тесты проходят
- Система готова к развертыванию

### Phase 4: Deployment
**Агент:** Architect

**Задачи:**
1. Подготовить конфигурацию для Yandex Cloud
2. Создать deployment скрипты
3. Документировать процесс развертывания

**Выход:**
- Deployment конфигурация
- Инструкции по развертыванию

## Передача контекста между агентами

### От Architect к Developer:
**Формат:** Markdown файлы
**Содержание:**
- Спецификация модуля (`.agents/specs/modules/{module-name}.md`)
- API контракт (`.agents/specs/api-contracts/{module-name}-api.md`)
- Системная архитектура для контекста (`.agents/architecture/system-design.md`)

**Команда:**
```
Прочитай следующие документы:
1. .agents/specs/modules/{module-name}.md
2. .agents/specs/api-contracts/{module-name}-api.md
3. .agents/roles/developer.md

Реализуй модуль согласно спецификации.
```

### От Developer к Reviewer:
**Формат:** Markdown файлы + Код
**Содержание:**
- Реализованный модуль (`src/{module-path}/{module-name}.js`)
- Unit-тесты (`tests/{module-name}.test.js`)
- Спецификация (для сверки)

**Команда:**
```
Проверь код модуля:
1. src/{module-path}/{module-name}.js
2. tests/{module-name}.test.js

Согласно спецификации:
1. .agents/specs/modules/{module-name}.md

Используй чеклист из:
1. .agents/roles/reviewer.md
```

### От Reviewer к Developer (если доработка):
**Формат:** Review report
**Содержание:**
- Список замечаний (критические и некритические)
- Четкие инструкции что исправить

**Команда:**
```
Исправь следующие замечания:
[Список замечаний из review report]

Модуль: src/{module-path}/{module-name}.js
```

### От Reviewer к Tester (если одобрено):
**Формат:** Approval + Код
**Содержание:**
- Одобренный модуль
- Спецификация
- API контракт

**Команда:**
```
Проведи integration тестирование модуля:
1. src/{module-path}/{module-name}.js

Согласно спецификации:
1. .agents/specs/modules/{module-name}.md

Используй чеклист из:
1. .agents/roles/tester.md
```

### От Tester к Architect:
**Формат:** Test report
**Содержание:**
- Результаты integration тестов
- Найденные проблемы (если есть)
- Вердикт

**Команда:**
```
Оцени результаты integration тестирования:
[Test report]

Принять модуль или вернуть на доработку?
```

## Tracking прогресса

### Файл: `.agents/workflow/module-status.md`

```markdown
# Module Status Tracker

## Legend
- 🟢 Completed
- 🟡 In Progress
- 🔴 Blocked
- ⚪ Not Started

## Core Modules (Priority 1)

| Module | Spec | Dev | Review | Test | Status |
|--------|------|-----|--------|------|--------|
| ReportsBus | 🟢 | 🟡 | ⚪ | ⚪ | 🟡 In Progress |
| DialogSystem | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |
| TimerHandler | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |

## Feature Modules (Priority 2)

| Module | Spec | Dev | Review | Test | Status |
|--------|------|-----|--------|------|--------|
| SummaryGenerator | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |
| NotificationRouter | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |

## Integration Modules (Priority 3)

| Module | Spec | Dev | Review | Test | Status |
|--------|------|-----|--------|------|--------|
| YouGileSync | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |
| JiraSync | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ Not Started |
```

## Работа с ошибками и блокерами

### Если Developer не понимает спецификацию:
1. Developer документирует вопросы
2. Architect уточняет спецификацию
3. Обновляется `.agents/specs/modules/{module-name}.md`
4. Developer продолжает реализацию

### Если Reviewer находит критические проблемы:
1. Reviewer документирует проблемы
2. Architect оценивает: проблема в коде или в спецификации?
3. Если в коде → Developer исправляет
4. Если в спецификации → Architect обновляет спецификацию, Developer переписывает

### Если Tester находит проблемы интеграции:
1. Tester документирует проблемы
2. Architect анализирует: проблема в модуле или в интеграции?
3. Если в модуле → возврат Developer
4. Если в интеграции → Architect обновляет архитектуру, затем возврат Developer

## Коммуникация и handoff

### Четкие handoff точки:
1. **Architect → Developer:** Спецификация готова, можно начинать реализацию
2. **Developer → Reviewer:** Код готов, нужен code review
3. **Reviewer → Tester:** Код одобрен, можно тестировать интеграцию
4. **Tester → Architect:** Тесты пройдены, готово к приемке
5. **Architect → следующий модуль:** Модуль принят, начинаем следующий

### Формат handoff сообщения:
```
From: [Role]
To: [Role]
Subject: [Module Name] ready for [Next Stage]

Context:
[Что было сделано]

Artifacts:
[Список файлов для проверки]

Next Steps:
[Что нужно сделать дальше]

Questions/Notes:
[Если есть вопросы или важные замечания]
```

## Итерации и версии

### Versioning модулей:
- **v0.1.0** - Initial implementation (после Developer)
- **v0.2.0** - After code review fixes
- **v0.3.0** - After integration testing fixes
- **v1.0.0** - Production ready (после приемки Architect)

### Tracking изменений:
Каждый модуль имеет changelog в начале файла:
```javascript
/**
 * @module ReportsBus
 * @version 1.0.0
 *
 * @changelog
 * v1.0.0 (2024-11-06) - Production ready, approved by Architect
 * v0.3.0 (2024-11-05) - Fixed integration issues with DialogSystem
 * v0.2.0 (2024-11-04) - Fixed code review issues (error handling)
 * v0.1.0 (2024-11-03) - Initial implementation
 */
```

## Инструменты и автоматизация

### Git workflow:
```bash
# Каждый модуль разрабатывается в отдельной ветке
git checkout -b module/{module-name}

# После приемки - merge в main
git checkout main
git merge module/{module-name}
```

### Commit messages:
```
[Architect] Add specification for ReportsBus module
[Developer] Implement ReportsBus module
[Developer] Add unit tests for ReportsBus
[Reviewer] Approve ReportsBus module
[Tester] Add integration tests for ReportsBus
[Architect] Accept ReportsBus module v1.0.0
```

## Важные принципы

1. **Одна роль = один контекст:** Не смешивай роли в одной сессии
2. **Четкие handoff:** Явная передача контекста между агентами
3. **Документируй все:** Каждое решение должно быть зафиксировано
4. **Следуй процессу:** Не пропускай этапы (spec → dev → review → test)
5. **Качество важнее скорости:** Лучше вернуть на доработку, чем получить баг в production
