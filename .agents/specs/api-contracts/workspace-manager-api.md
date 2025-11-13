# API Contract: WorkspaceManager Module

**Модуль:** WorkspaceManager
**Файл:** `src/modules/workspace-manager.js`
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## Обзор

WorkspaceManager предоставляет два уровня API:

1. **High-level API** - для использования другими модулями (TelegramHandler, ReportsBus, TimerHandler)
2. **Low-level API (Dao)** - для внутреннего использования модулем

---

## Table of Contents

1. [High-level API](#high-level-api)
   - [create_workspace](#create_workspace)
   - [delete_workspace](#delete_workspace)
   - [get_workspace_info](#get_workspace_info)
   - [add_user_to_workspace](#add_user_to_workspace)
   - [remove_user_from_workspace](#remove_user_from_workspace)
   - [get_all_workspace_members](#get_all_workspace_members)
   - [get_workspace_leads](#get_workspace_leads)
   - [is_user_lead](#is_user_lead)
   - [set_user_as_lead](#set_user_as_lead)
   - [remove_user_lead_role](#remove_user_lead_role)
   - [get_user_workspace_list](#get_user_workspace_list)

2. [Low-level API (Dao)](#low-level-api-dao)
   - [init](#dao-init)
   - [create_workspace_record](#dao-create_workspace_record)
   - [get_workspace_record](#dao-get_workspace_record)
   - [delete_workspace_record](#dao-delete_workspace_record)
   - [add_member_to_workspace](#dao-add_member_to_workspace)
   - [remove_member_from_workspace](#dao-remove_member_from_workspace)
   - [update_member_role](#dao-update_member_role)
   - [get_workspace_members](#dao-get_workspace_members)

3. [Типы данных](#типы-данных)
4. [Коды ошибок](#коды-ошибок)

---

## High-level API

### create_workspace

Создание нового workspace с начальным составом участников.

#### Сигнатура

```javascript
async function create_workspace(name, organization_id, created_by_user_uuid, initial_members)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `name` | String | ✅ | Название workspace |
| `organization_id` | String | ❌ | ID организации (для Phase 3+) |
| `created_by_user_uuid` | String | ✅ | UUID создателя (станет lead) |
| `initial_members` | Array<{user_uuid, role}> | ❌ | Начальный список участников |

#### Возвращает

`Promise<String>` - `workspace_id` нового workspace

#### Описание

1. Генерирует уникальный workspace_id (префикс `ws-` + UUID)
2. Создает запись workspace в YDB
3. Добавляет created_by как первый lead
4. Добавляет initial_members (если указаны)
5. Обновляет users.workspaces[] для каждого участника
6. Возвращает workspace_id

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Создание workspace
const workspace_id = await WorkspaceManager.create_workspace(
    "Команда разработки проекта X",
    null,  // organization_id (опционально)
    "user-creator-uuid",
    [
        { user_uuid: "user-123", role: "participant" },
        { user_uuid: "user-456", role: "participant" }
    ]
);

console.log(`✅ Workspace создан: ${workspace_id}`);
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `EMPTY_NAME` | Название workspace пустое | Throw error |
| `USER_NOT_FOUND` | created_by_user_uuid не существует | Throw error |
| `MEMBER_NOT_FOUND` | Участник из initial_members не существует | Skip с warning |
| `DB_ERROR` | Ошибка записи в YDB | Throw error |

---

### get_all_workspace_members

Получение списка всех участников workspace (используется ReportsBus, TimerHandler).

#### Сигнатура

```javascript
async function get_all_workspace_members(workspace_id)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |

#### Возвращает

`Promise<Array<Member>>` - массив объектов участников

**Member structure:**
```javascript
{
    user_uuid: String,
    role: "lead" | "participant",
    joined_at: Number,
    telegram_id: Number,
    name: String
}
```

#### Описание

1. Получает workspace record из YDB
2. Извлекает members объект
3. Преобразует в массив Member объектов
4. Возвращает массив

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// В ReportsBus или TimerHandler
async function processBatch(workspace_id) {
    const members = await WorkspaceManager.get_all_workspace_members(workspace_id);

    console.log(`📊 Workspace ${workspace_id} имеет ${members.length} участников`);

    for (const member of members) {
        console.log(`- ${member.name} (${member.role})`);
    }

    // Использование в ReportsBus
    const { all_content_data } = await ReportsBus.collect_content_for_users(
        workspace_id,
        members  // передаем список участников
    );
}
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `WORKSPACE_NOT_FOUND` | Workspace не существует | Return [] |
| `DB_ERROR` | Ошибка чтения из YDB | Return [] |

---

### add_user_to_workspace

Добавление пользователя в workspace.

#### Сигнатура

```javascript
async function add_user_to_workspace(workspace_id, user_uuid, role = 'participant')
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |
| `role` | String | ❌ | `'lead'` или `'participant'` (по умолчанию `'participant'`) |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `false` при ошибке

#### Описание

1. Проверяет существование workspace
2. Проверяет существование пользователя через users-controller
3. Проверяет, не является ли пользователь уже участником
4. Добавляет пользователя в workspace.members объект
5. Обновляет workspace record в YDB
6. Обновляет user.workspaces[] через users-controller
7. Возвращает true

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Добавление участника
const success = await WorkspaceManager.add_user_to_workspace(
    "ws-abc123",
    "user-new-member-uuid",
    "participant"
);

if (success) {
    console.log('✅ Участник добавлен в workspace');
} else {
    console.error('❌ Не удалось добавить участника');
}

// Добавление lead
await WorkspaceManager.add_user_to_workspace(
    "ws-abc123",
    "user-new-lead-uuid",
    "lead"
);
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `WORKSPACE_NOT_FOUND` | Workspace не существует | Return false |
| `USER_NOT_FOUND` | Пользователь не существует | Return false |
| `WORKSPACE_FULL` | Превышен лимит 100 участников | Return false |
| `ALREADY_MEMBER` | Пользователь уже участник | Update role, return true |
| `DB_ERROR` | Ошибка записи в YDB | Return false |

---

### remove_user_from_workspace

Удаление пользователя из workspace.

#### Сигнатура

```javascript
async function remove_user_from_workspace(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `false` при ошибке

#### Описание

1. Проверяет существование workspace
2. Удаляет пользователя из workspace.members объект
3. Обновляет workspace record в YDB
4. Удаляет workspace_id из user.workspaces[] через users-controller
5. Если удален последний lead → автоматически назначает нового lead (первый participant)
6. Если удален последний участник → помечает workspace.is_active = false
7. Возвращает true

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Удаление участника
const success = await WorkspaceManager.remove_user_from_workspace(
    "ws-abc123",
    "user-to-remove-uuid"
);

if (success) {
    console.log('✅ Участник удален из workspace');
} else {
    console.error('❌ Не удалось удалить участника');
}
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `WORKSPACE_NOT_FOUND` | Workspace не существует | Return false |
| `NOT_MEMBER` | Пользователь не участник | Return true (идемпотентность) |
| `DB_ERROR` | Ошибка записи в YDB | Return false |

#### Особенности

**Авто-назначение lead при удалении последнего lead:**
```javascript
// Если удаляется последний lead
if (removed_user_role === 'lead' && no_other_leads) {
    // Найти первого participant
    const first_participant = members.find(m => m.role === 'participant');
    if (first_participant) {
        // Назначить как lead
        await update_member_role(workspace_id, first_participant.user_uuid, 'lead');
        console.log(`⚠️ Auto-assigned new lead: ${first_participant.name}`);
    }
}
```

---

### get_workspace_leads

Получение списка всех lead'ов workspace (используется SummaryGenerator).

#### Сигнатура

```javascript
async function get_workspace_leads(workspace_id)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |

#### Возвращает

`Promise<Array<Member>>` - массив lead'ов

#### Описание

1. Получает все members через get_all_workspace_members()
2. Фильтрует только с role === 'lead'
3. Возвращает массив

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// В SummaryGenerator
async function sendSummariesToLeads(workspace_id, summary_text) {
    const leads = await WorkspaceManager.get_workspace_leads(workspace_id);

    if (leads.length === 0) {
        console.warn(`⚠️ Workspace ${workspace_id} has no leads!`);
        return;
    }

    for (const lead of leads) {
        console.log(`📤 Отправка сводки lead'у: ${lead.name}`);
        await NotificationRouter.send_message(lead.telegram_id, summary_text);
    }
}
```

#### Возможные ошибки

| Код | Описание | Действие |
|-----|----------|----------|
| `WORKSPACE_NOT_FOUND` | Workspace не существует | Return [] |
| `NO_LEADS` | Нет lead'ов (warning, не ошибка) | Return [] |

---

### is_user_lead

Проверка, является ли пользователь lead'ом workspace.

#### Сигнатура

```javascript
async function is_user_lead(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<boolean>` - `true` если lead, `false` иначе

#### Описание

1. Получает workspace record
2. Проверяет workspace.members[user_uuid].role === 'lead'
3. Возвращает результат

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Проверка роли перед отправкой сводки
async function sendContent(workspace_id, user_uuid, content) {
    const is_lead = await WorkspaceManager.is_user_lead(workspace_id, user_uuid);

    if (is_lead) {
        // Отправить полную сводку
        await sendFullSummary(user_uuid, content);
    } else {
        // Отправить только релевантные новости
        await sendRelevantNews(user_uuid, content);
    }
}
```

---

### set_user_as_lead

Назначение пользователя как lead (изменение роли на 'lead').

#### Сигнатура

```javascript
async function set_user_as_lead(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `false` при ошибке

#### Описание

1. Проверяет, что пользователь является участником workspace
2. Обновляет role на 'lead' через update_member_role()
3. Возвращает true

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Назначение нового lead
const success = await WorkspaceManager.set_user_as_lead(
    "ws-abc123",
    "user-new-lead-uuid"
);

if (success) {
    console.log('✅ Пользователь назначен lead');
}
```

---

### remove_user_lead_role

Снятие роли lead (изменение роли на 'participant').

#### Сигнатура

```javascript
async function remove_user_lead_role(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `false` при ошибке

#### Описание

1. Проверяет, что пользователь является lead'ом
2. Обновляет role на 'participant' через update_member_role()
3. **НЕ вызывает авто-назначение** (в отличие от remove_user_from_workspace)
4. Возвращает true

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Снятие роли lead (пользователь остается участником)
const success = await WorkspaceManager.remove_user_lead_role(
    "ws-abc123",
    "user-old-lead-uuid"
);

if (success) {
    console.log('✅ Роль lead снята, пользователь теперь participant');
}
```

---

### get_user_workspace_list

Получение списка всех workspace пользователя.

#### Сигнатура

```javascript
async function get_user_workspace_list(user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<Array<WorkspaceInfo>>` - массив workspace

**WorkspaceInfo structure:**
```javascript
{
    workspace_id: String,
    name: String,
    role: "lead" | "participant",
    members_count: Number
}
```

#### Описание

1. Получает user.workspaces[] через users-controller
2. Для каждого workspace_id:
   - Получает workspace record
   - Определяет роль пользователя
   - Формирует WorkspaceInfo объект
3. Возвращает массив

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// Получение списка workspace пользователя
async function showUserWorkspaces(user_uuid) {
    const workspaces = await WorkspaceManager.get_user_workspace_list(user_uuid);

    console.log(`📊 Пользователь участвует в ${workspaces.length} workspace:`);

    for (const ws of workspaces) {
        console.log(`- ${ws.name} (${ws.role}) - ${ws.members_count} участников`);
    }
}
```

---

## Low-level API (Dao)

### Dao.init

Инициализация подключения к YDB.

#### Сигнатура

```javascript
function init(database_url)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `database_url` | String | ❌ | URL базы данных (по умолчанию из env) |

#### Возвращает

`void`

#### Пример использования

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

// При старте функции
WorkspaceManager.init(process.env.GLOBAL_DB_ADDRESS);
```

---

### Dao.create_workspace_record

Создание записи workspace в YDB.

#### Сигнатура

```javascript
async function create_workspace_record(workspace_id, name, organization_id, created_by)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `name` | String | ✅ | Название workspace |
| `organization_id` | String | ❌ | ID организации |
| `created_by` | String | ✅ | UUID создателя |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

#### Пример использования

```javascript
const I = require("@dieugene/utils");

const workspace_id = `ws-${I.generate_uuid()}`;
const created_at = I.get_seconds_now();

await Dao.create_workspace_record(
    workspace_id,
    "Команда разработки",
    null,  // organization_id
    "user-creator-uuid"
);
```

---

### Dao.get_workspace_record

Получение записи workspace из YDB.

#### Сигнатура

```javascript
async function get_workspace_record(workspace_id)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |

#### Возвращает

`Promise<WorkspaceRecord | null>` - запись workspace или `null`

**WorkspaceRecord structure:**
```javascript
{
    workspace_id: String,
    name: String,
    organization_id: String | null,
    created_at: Number,
    created_by: String,
    members: Object,  // { user_uuid: { role, joined_at, ... } }
    is_active: Boolean
}
```

#### Пример использования

```javascript
const workspace = await Dao.get_workspace_record("ws-abc123");

if (workspace) {
    console.log(`Workspace: ${workspace.name}`);
    console.log(`Участников: ${Object.keys(workspace.members).length}`);
} else {
    console.log('Workspace не найден');
}
```

---

### Dao.add_member_to_workspace

Добавление участника в workspace.members объект.

#### Сигнатура

```javascript
async function add_member_to_workspace(workspace_id, user_uuid, role, user_info)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |
| `role` | String | ✅ | `'lead'` или `'participant'` |
| `user_info` | Object | ✅ | { telegram_id, name } |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

#### Пример использования

```javascript
const user_data = await users.get_user_data(user_uuid);

await Dao.add_member_to_workspace(
    workspace_id,
    user_uuid,
    "participant",
    {
        telegram_id: user_data.telegram_id,
        name: user_data.first_name
    }
);
```

---

### Dao.remove_member_from_workspace

Удаление участника из workspace.members объект.

#### Сигнатура

```javascript
async function remove_member_from_workspace(workspace_id, user_uuid)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

---

### Dao.update_member_role

Обновление роли участника.

#### Сигнатура

```javascript
async function update_member_role(workspace_id, user_uuid, new_role)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `workspace_id` | String | ✅ | ID workspace |
| `user_uuid` | String | ✅ | UUID пользователя |
| `new_role` | String | ✅ | `'lead'` или `'participant'` |

#### Возвращает

`Promise<boolean>` - `true` если успешно, `null` при ошибке

---

## Типы данных

### WorkspaceRecord

```typescript
interface WorkspaceRecord {
    workspace_id: string;
    name: string;
    organization_id: string | null;
    created_at: number;
    created_by: string;
    members: {
        [user_uuid: string]: MemberInfo
    };
    is_active: boolean;
}
```

### MemberInfo

```typescript
interface MemberInfo {
    role: "lead" | "participant";
    joined_at: number;
    telegram_id: number;
    name: string;
}
```

### Member

```typescript
interface Member {
    user_uuid: string;
    role: "lead" | "participant";
    joined_at: number;
    telegram_id: number;
    name: string;
}
```

### WorkspaceInfo

```typescript
interface WorkspaceInfo {
    workspace_id: string;
    name: string;
    role: "lead" | "participant";
    members_count: number;
}
```

---

## Коды ошибок

### High-level API errors

| Код | HTTP эквивалент | Описание |
|-----|-----------------|----------|
| `EMPTY_NAME` | 400 Bad Request | Название workspace пустое |
| `USER_NOT_FOUND` | 404 Not Found | Пользователь не найден |
| `WORKSPACE_NOT_FOUND` | 404 Not Found | Workspace не найден |
| `WORKSPACE_FULL` | 429 Too Many Requests | Превышен лимит 100 участников |
| `ALREADY_MEMBER` | 200 OK | Пользователь уже участник (идемпотентность) |
| `NOT_MEMBER` | 404 Not Found | Пользователь не является участником |
| `NO_LEADS` | 200 OK | Нет lead'ов (warning, не ошибка) |

### Low-level API (Dao) errors

| Код | Описание |
|-----|----------|
| `DB_NOT_INIT` | YDB не инициализирован |
| `DB_QUERY_ERROR` | Ошибка выполнения запроса |
| `DB_PARSE_ERROR` | Ошибка парсинга JSON из базы |

---

## Примеры полного workflow

### Пример 1: Создание workspace с участниками

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

async function createTeamWorkspace(creator_uuid, team_members) {
    // 1. Создать workspace
    const workspace_id = await WorkspaceManager.create_workspace(
        "Команда разработки проекта X",
        null,  // organization_id
        creator_uuid,
        team_members.map(tm => ({
            user_uuid: tm.uuid,
            role: tm.is_lead ? 'lead' : 'participant'
        }))
    );

    console.log(`✅ Workspace создан: ${workspace_id}`);

    // 2. Получить список участников
    const members = await WorkspaceManager.get_all_workspace_members(workspace_id);
    console.log(`📊 Всего участников: ${members.length}`);

    // 3. Получить lead'ов
    const leads = await WorkspaceManager.get_workspace_leads(workspace_id);
    console.log(`👔 Lead'ов: ${leads.length}`);

    return workspace_id;
}
```

### Пример 2: Управление ролями

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');

async function promoteToLead(workspace_id, user_uuid) {
    // Проверить текущую роль
    const is_lead = await WorkspaceManager.is_user_lead(workspace_id, user_uuid);

    if (is_lead) {
        console.log('Пользователь уже является lead');
        return;
    }

    // Назначить как lead
    const success = await WorkspaceManager.set_user_as_lead(workspace_id, user_uuid);

    if (success) {
        console.log('✅ Пользователь назначен lead');
    }
}

async function demoteFromLead(workspace_id, user_uuid) {
    // Снять роль lead
    const success = await WorkspaceManager.remove_user_lead_role(workspace_id, user_uuid);

    if (success) {
        console.log('✅ Роль lead снята');
    }
}
```

### Пример 3: Интеграция с ReportsBus

```javascript
const { WorkspaceManager } = require('./modules/workspace-manager');
const { ReportsBus } = require('./modules/reports-bus');

async function processDailyBatch(workspace_id) {
    // 1. Получить всех участников workspace
    const members = await WorkspaceManager.get_all_workspace_members(workspace_id);

    if (members.length === 0) {
        console.log('⚠️ Workspace пуст');
        return;
    }

    // 2. Собрать новый контент
    const { all_content_data, user_mapping } = await ReportsBus.collect_content_for_users(
        workspace_id,
        members  // передаем список участников
    );

    // 3. AI обработка
    const ai_results = await ReportsBus.batch_analyze_content(all_content_data);

    // 4. Накопление результатов
    await ReportsBus.accumulate_batch_results(
        workspace_id,
        members,
        user_mapping,
        ai_results
    );

    console.log('✅ Batch обработка завершена');
}
```

---

**Status:** 📝 Draft - готов для review
**Next Step:** Developer реализует модуль согласно этому контракту
