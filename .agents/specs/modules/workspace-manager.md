# Спецификация модуля: WorkspaceManager

**Роль:** Architect
**Фаза:** Phase 2 - Module Specification
**Приоритет:** Priority 1 (Critical)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## 1. Обзор и назначение

**WorkspaceManager** — модуль для управления workspace (командами/проектами) и их участниками. Модуль обеспечивает создание workspace, управление составом участников, назначение ролей (lead/participant) и предоставление информации о workspace для других модулей.

### Ключевые концепции:

**Workspace** — это изолированная группа пользователей, работающих вместе над проектом или задачей. Каждый workspace имеет:
- Уникальный идентификатор (workspace_id)
- Название
- Список участников
- Одного или нескольких руководителей (lead)

**Multi-tenancy:** Один пользователь может участвовать в нескольких workspace одновременно. Связь многие-ко-многим: один пользователь → много workspace, один workspace → много пользователей.

**Роли:**
- **lead** — руководитель workspace, получает сводки от всех участников
- **participant** — обычный участник, получает релевантную информацию от коллег

### Назначение модуля:

- Создание и удаление workspace
- Управление составом участников (добавление/удаление)
- Управление ролями (назначение/изменение lead/participant)
- Предоставление информации о workspace (список участников, lead'ы)
- Workspace isolation на уровне данных

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ WorkspaceManager:

✅ **Управление workspace:**
- Создание новых workspace
- Удаление workspace
- Получение информации о workspace (название, участники, дата создания)

✅ **Управление участниками:**
- Добавление пользователя в workspace
- Удаление пользователя из workspace
- Получение списка всех участников workspace
- Получение списка workspace пользователя

✅ **Управление ролями:**
- Назначение пользователя как lead
- Снятие роли lead
- Проверка роли пользователя (is_lead)
- Получение списка всех lead'ов workspace

✅ **Интеграция:**
- Lazy loading для оптимизации cold start
- Кеширование workspace members (опционально)

### Что НЕ ДЕЛАЕТ WorkspaceManager:

❌ Управление диалогами (это DialogSystem)
❌ Обработка контента (это ReportsBus)
❌ Отправка уведомлений (это NotificationRouter)
❌ Управление пользователями (это @dieugene/users-controller)
❌ Бизнес-логика обработки информации

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dieugene/utils": "^1.16.3",           // Утилиты, логирование
  "@dieugene/ydb-serverless": "^1.0.0",   // YDB connector
  "@dieugene/users-controller": "^1.0.0"  // User management
}
```

### Внутренние модули:

- **UsersController** (@dieugene/users-controller) — получение данных пользователя, обновление списка workspace у пользователя

### Infrastructure:

- **YDB** — хранение workspace и связей workspace-user
- Таблицы: `workspaces`, индексы для быстрого поиска

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/workspace-manager.js
├─ Dao (Data Access Object)
│  ├─ init(database_url)
│  ├─ create_workspace_record(workspace_id, name, organization_id, created_by)
│  ├─ get_workspace_record(workspace_id)
│  ├─ delete_workspace_record(workspace_id)
│  ├─ add_member_to_workspace(workspace_id, user_uuid, role)
│  ├─ remove_member_from_workspace(workspace_id, user_uuid)
│  ├─ get_workspace_members(workspace_id)
│  ├─ update_member_role(workspace_id, user_uuid, role)
│  └─ get_user_workspaces(user_uuid)
│
└─ WorkspaceManager (High-level API)
   ├─ create_workspace(name, organization_id, created_by_user_uuid, initial_members)
   ├─ delete_workspace(workspace_id)
   ├─ get_workspace_info(workspace_id)
   ├─ add_user_to_workspace(workspace_id, user_uuid, role)
   ├─ remove_user_from_workspace(workspace_id, user_uuid)
   ├─ get_all_workspace_members(workspace_id)
   ├─ get_workspace_leads(workspace_id)
   ├─ is_user_lead(workspace_id, user_uuid)
   ├─ set_user_as_lead(workspace_id, user_uuid)
   ├─ remove_user_lead_role(workspace_id, user_uuid)
   └─ get_user_workspace_list(user_uuid)
```

---

## 5. Схема данных (YDB)

### 5.1 Таблица: `workspaces`

```javascript
Table: workspaces

Columns:
- workspace_id (String, Partition Key) - уникальный ID workspace
- name (String) - название workspace
- organization_id (String, optional) - ID организации (для будущего)
- created_at (Uint64) - timestamp создания
- created_by (String) - user_uuid создателя
- members (JsonDocument) - структура участников с ролями
- is_active (Bool) - активен ли workspace

Indexes:
1. Primary: workspace_id (Partition Key)
2. organization_index (опционально для Phase 3+)
   - organization_id
   - created_at
```

### 5.2 Структура данных: Workspace record

```javascript
{
  "workspace_id": "ws-abc123",
  "name": "Команда разработки проекта X",
  "organization_id": "org-789",  // optional
  "created_at": 1699999999,
  "created_by": "user-creator-uuid",
  "members": {
    "user-uuid-1": {
      "role": "lead",
      "joined_at": 1699999999,
      "telegram_id": 123456789,
      "name": "Иван Петров"
    },
    "user-uuid-2": {
      "role": "participant",
      "joined_at": 1700000000,
      "telegram_id": 987654321,
      "name": "Мария Сидорова"
    }
  },
  "is_active": true
}
```

**Обоснование структуры members:**
- JsonDocument вместо отдельной таблицы для быстрого доступа
- Денормализация для performance (избегаем JOIN'ов)
- Ограничение: до 100 участников на workspace (достаточно для большинства команд)

### 5.3 Связь с users таблицей

**users таблица** (@dieugene/users-controller) содержит:
```javascript
{
  "user_uuid": "user-456",
  "workspaces": ["ws-abc123", "ws-def456"],  // Массив workspace_id
  "telegram_id": 123456789,
  "first_name": "Иван",
  // ... другие поля
}
```

**Важно:** WorkspaceManager НЕ управляет users таблицей напрямую, но обновляет поле `workspaces[]` через users-controller при добавлении/удалении участников.

---

## 6. API спецификация (High-level)

> **Детальный API contract** будет в отдельном файле `.agents/specs/api-contracts/workspace-manager-api.md`

### 6.1 Основные функции

#### `create_workspace(name, organization_id, created_by_user_uuid, initial_members)`

**Назначение:** Создание нового workspace с начальным составом участников

**Параметры:**
- `name` (String) — название workspace
- `organization_id` (String, optional) — ID организации
- `created_by_user_uuid` (String) — UUID создателя (автоматически становится lead)
- `initial_members` (Array<{user_uuid, role}>, optional) — начальный список участников

**Возвращает:** `Promise<String>` — workspace_id нового workspace

**Алгоритм:**
1. Генерировать уникальный workspace_id (префикс `ws-` + UUID)
2. Создать запись workspace в YDB с created_by как первый lead
3. Добавить initial_members (если указаны)
4. Для каждого участника: обновить users.workspaces[] через users-controller
5. Вернуть workspace_id

**Edge cases:**
- Если name пустое → ошибка
- Если created_by_user_uuid не существует → ошибка
- Если initial_members содержит несуществующих пользователей → пропустить их с warning

---

#### `get_all_workspace_members(workspace_id)`

**Назначение:** Получение списка всех участников workspace (используется ReportsBus, TimerHandler)

**Параметры:**
- `workspace_id` (String) — ID workspace

**Возвращает:** `Promise<Array<User>>` — массив объектов участников

**Структура User:**
```javascript
{
  "user_uuid": "user-123",
  "role": "lead" | "participant",
  "joined_at": 1699999999,
  "telegram_id": 123456789,
  "name": "Иван Петров"
}
```

**Алгоритм:**
1. Получить workspace record из YDB
2. Извлечь members объект
3. Преобразовать в массив User объектов
4. Вернуть массив

**Edge cases:**
- Если workspace не существует → return []
- Если members пусто → return []

---

#### `add_user_to_workspace(workspace_id, user_uuid, role)`

**Назначение:** Добавление пользователя в workspace

**Параметры:**
- `workspace_id` (String) — ID workspace
- `user_uuid` (String) — UUID пользователя
- `role` (String) — `'lead'` или `'participant'` (по умолчанию `'participant'`)

**Возвращает:** `Promise<boolean>` — успешность операции

**Алгоритм:**
1. Проверить существование workspace
2. Проверить существование пользователя через users-controller
3. Проверить, не является ли пользователь уже участником
4. Добавить пользователя в workspace.members объект
5. Обновить workspace record в YDB
6. Обновить user.workspaces[] через users-controller
7. Вернуть true

**Edge cases:**
- Если workspace не существует → return false
- Если пользователь уже участник → update роль, return true
- Если user_uuid не существует → return false
- Если достигнут лимит участников (100) → return false, логировать warning

---

#### `remove_user_from_workspace(workspace_id, user_uuid)`

**Назначение:** Удаление пользователя из workspace

**Параметры:**
- `workspace_id` (String) — ID workspace
- `user_uuid` (String) — UUID пользователя

**Возвращает:** `Promise<boolean>` — успешность операции

**Алгоритм:**
1. Проверить существование workspace
2. Удалить пользователя из workspace.members объект
3. Обновить workspace record в YDB
4. Удалить workspace_id из user.workspaces[] через users-controller
5. Проверить: если это был последний lead → назначить нового lead автоматически (первый participant)
6. Вернуть true

**Edge cases:**
- Если workspace не существует → return false
- Если пользователь не участник → return true (идемпотентность)
- Если удаляется последний участник → пометить workspace как inactive

---

#### `get_workspace_leads(workspace_id)`

**Назначение:** Получение списка всех lead'ов workspace (используется SummaryGenerator)

**Параметры:**
- `workspace_id` (String) — ID workspace

**Возвращает:** `Promise<Array<User>>` — массив lead'ов

**Алгоритм:**
1. Получить все members через get_all_workspace_members()
2. Отфильтровать только с role === 'lead'
3. Вернуть массив

**Edge cases:**
- Если нет lead'ов → return [] (это проблема, но не ошибка)

---

#### `is_user_lead(workspace_id, user_uuid)`

**Назначение:** Проверка, является ли пользователь lead'ом workspace

**Параметры:**
- `workspace_id` (String) — ID workspace
- `user_uuid` (String) — UUID пользователя

**Возвращает:** `Promise<boolean>` — true если lead, false иначе

**Алгоритм:**
1. Получить workspace record
2. Проверить workspace.members[user_uuid].role === 'lead'
3. Вернуть результат

---

## 7. Алгоритмы и процессы

### 7.1 Процесс: Создание workspace

```
[Пользователь создает workspace через Telegram]
         │
         ▼
[TelegramHandler вызывает create_workspace]
         │
         ▼
[WorkspaceManager.create_workspace(name, org_id, creator_uuid, initial_members)]
         │
         ├─> Генерировать workspace_id (ws-{UUID})
         ├─> Dao.create_workspace_record(workspace_id, name, org_id, creator_uuid)
         ├─> Dao.add_member_to_workspace(workspace_id, creator_uuid, 'lead')
         ├─> Для каждого initial_member:
         │    └─> Dao.add_member_to_workspace(workspace_id, member.user_uuid, member.role)
         ├─> Обновить users.workspaces[] через users-controller
         └─> Вернуть workspace_id
```

### 7.2 Процесс: Добавление участника

```
[Admin добавляет участника в workspace]
         │
         ▼
[WorkspaceManager.add_user_to_workspace(workspace_id, user_uuid, role)]
         │
         ├─> Dao.get_workspace_record(workspace_id)
         ├─> users.get_user_data(user_uuid)  // проверка существования
         ├─> Проверить: пользователь уже участник?
         │    └─> Если ДА: обновить роль
         │    └─> Если НЕТ: добавить в members
         ├─> Dao.add_member_to_workspace(workspace_id, user_uuid, role)
         ├─> users.update_user_workspaces(user_uuid, add: [workspace_id])
         └─> Вернуть true
```

### 7.3 Процесс: Удаление участника (с авто-назначением lead)

```
[Admin удаляет участника из workspace]
         │
         ▼
[WorkspaceManager.remove_user_from_workspace(workspace_id, user_uuid)]
         │
         ├─> Dao.get_workspace_record(workspace_id)
         ├─> Проверить роль удаляемого пользователя
         ├─> Dao.remove_member_from_workspace(workspace_id, user_uuid)
         ├─> users.update_user_workspaces(user_uuid, remove: [workspace_id])
         ├─> Если удаленный был lead:
         │    ├─> Получить всех оставшихся participants
         │    └─> Если есть participants:
         │         └─> Назначить первого participant как lead
         │         └─> Dao.update_member_role(workspace_id, new_lead_uuid, 'lead')
         ├─> Если удален последний участник:
         │    └─> Пометить workspace.is_active = false
         └─> Вернуть true
```

---

## 8. Edge Cases и Error Handling

### 8.1 Edge Case: Создание workspace с несуществующими пользователями

**Ситуация:** initial_members содержит user_uuid, который не существует в системе

**Решение:**
- Проверять каждого пользователя через users-controller.get_user_data()
- Если пользователь не найден → пропустить с warning
- Логировать список пропущенных пользователей
- Workspace создается с валидными пользователями

### 8.2 Edge Case: Удаление последнего lead

**Ситуация:** Удаляется последний (или единственный) lead workspace

**Решение:**
- Автоматически назначить нового lead из participants
- Выбор: первый participant по joined_at (самый старый участник)
- Если нет participants → оставить workspace без lead, пометить в логах
- Логировать warning: "Workspace {workspace_id} has no leads"

### 8.3 Edge Case: Workspace isolation нарушена

**Ситуация:** Пользователь пытается получить доступ к workspace, в котором не участвует

**Решение:**
- В каждой функции проверять: user_uuid входит в workspace.members?
- Если НЕТ → return null или throw PermissionError
- Логировать попытку несанкционированного доступа

### 8.4 Edge Case: Превышен лимит участников

**Ситуация:** Попытка добавить 101-го участника (лимит 100)

**Решение:**
- Проверка в add_user_to_workspace(): members count >= 100?
- Если ДА → return false
- Логировать warning с workspace_id
- Отправить сообщение admin: "Workspace full, upgrade required"

### 8.5 Edge Case: Одновременное добавление одного пользователя

**Ситуация:** Два запроса одновременно добавляют одного пользователя в workspace

**Решение:**
- YDB UPSERT обеспечивает идемпотентность
- Проверка "уже участник" в начале функции
- Возвращать true в обоих случаях (идемпотентность)

### 8.6 Edge Case: Удаление workspace с активными пользователями

**Ситуация:** delete_workspace() вызван, но есть активные участники

**Решение:**
- Soft delete: установить is_active = false вместо реального удаления
- Опционально: удалить workspace_id из users.workspaces[] для всех участников
- Логировать список участников для audit trail

---

## 9. Performance Considerations

### 9.1 Кеширование workspace members

**Проблема:** get_workspace_members() вызывается часто (из ReportsBus, TimerHandler)

**Решение:**
- Использовать in-memory кеш с TTL 5 минут
- Инвалидация кеша при изменении members
- Только для serverless функций с warm state

**Реализация:**
```javascript
const workspace_cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

async function get_workspace_members(workspace_id) {
    const cached = workspace_cache.get(workspace_id);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.members;
    }

    const members = await Dao.get_workspace_members(workspace_id);
    workspace_cache.set(workspace_id, { members, timestamp: Date.now() });
    return members;
}
```

### 9.2 Денормализация данных

**Решение:** Хранить members как JsonDocument вместо отдельной таблицы
- Плюсы: один запрос вместо JOIN, быстрее
- Минусы: дублирование данных (name, telegram_id)
- Приемлемо для команд до 100 человек

### 9.3 Batch operations

**Проблема:** Добавление нескольких пользователей одновременно

**Решение:**
- Создать batch функцию: add_users_batch(workspace_id, users_array)
- Один YDB запрос вместо N запросов
- Использовать YDB batch upsert (если доступен в SDK)

---

## 10. Testing Requirements

### 10.1 Unit Tests

**Обязательные тесты:**
- `create_workspace()` - с valid/invalid параметрами
- `add_user_to_workspace()` - новый пользователь, уже существующий, несуществующий
- `remove_user_from_workspace()` - обычный user, lead, последний участник
- `get_workspace_members()` - пустой workspace, полный workspace
- `get_workspace_leads()` - нет lead'ов, один lead, несколько lead'ов
- `is_user_lead()` - lead, participant, несуществующий user

**Mocks:**
- YDB (через `tests/mocks/ydb-mock.js`)
- users-controller (через `tests/mocks/users-mock.js`)

### 10.2 Integration Tests

**Обязательные тесты:**
- End-to-end: создание workspace → добавление участников → получение списка
- Проверка синхронизации с users.workspaces[]
- Проверка автоматического назначения lead при удалении

### 10.3 Edge Case Tests

**Обязательные тесты:**
- Удаление последнего lead → авто-назначение
- Превышение лимита 100 участников
- Одновременное добавление одного пользователя (race condition)
- Workspace isolation (доступ к чужому workspace)

---

## 11. Migration from Legacy

**Legacy status:** НЕТ legacy реализации WorkspaceManager

Это полностью новый модуль для Phase 2. В legacy версии workspace не было — был один "общий контекст" для всех пользователей.

**Migration strategy:** НЕ ТРЕБУЕТСЯ

---

## 12. Future Enhancements (Phase 3+)

### 12.1 Organization-level management

**Идея:** Группировка workspace по организациям

**Детали:**
- Таблица `organizations` с полями: org_id, name, billing_info
- workspace.organization_id → FK на organizations
- Биллинг на уровне организации (не workspace)

### 12.2 Advanced roles

**Идея:** Более гранулярные роли: admin, lead, participant, observer

**Детали:**
- admin: может добавлять/удалять участников
- lead: получает сводки
- participant: обычный участник
- observer: read-only доступ к сводкам

### 12.3 Workspace templates

**Идея:** Создание workspace по шаблонам

**Детали:**
- Шаблоны: "Development Team", "Marketing Team", "Sales Team"
- Предзаполненные роли и настройки

### 12.4 Workspace settings

**Идея:** Настройки workspace (частота уведомлений, threshold N, формат сводок)

**Детали:**
- workspace.settings объект с кастомными настройками
- Переопределение глобальных настроек на уровне workspace

---

## 13. Acceptance Criteria

### Критерии приемки модуля:

- ✅ Все функции API реализованы и протестированы
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests проходят успешно
- ✅ Workspace isolation работает корректно (многие-ко-многим)
- ✅ Авто-назначение lead при удалении работает
- ✅ Синхронизация с users.workspaces[] корректна
- ✅ Error handling для всех edge cases
- ✅ Документация API контракта готова
- ✅ Code review пройден без критических замечаний
- ✅ Интеграция с ReportsBus протестирована (get_workspace_members)

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/workspace-manager-api.md`
