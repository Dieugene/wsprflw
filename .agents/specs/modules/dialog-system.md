# Спецификация модуля: DialogSystem

**Роль:** Architect
**Фаза:** Phase 2 - Module Specification
**Приоритет:** Priority 1 (Critical)
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

> **🔴 ВАЖНО:**
>
> Это baseline спецификация для v1.0.0 БЕЗ SGR (Schema-Guided Reasoning). SGR будет добавлен в v2.0.0.
> Текущая версия фокусируется на core функциональности: буферизация диалогов, tools integration, observers.

---

## 1. Обзор и назначение

**DialogSystem** — модуль для управления LLM-powered диалогами с пользователями. Модуль обеспечивает буферизацию истории диалога, интеграцию с LangChain Tools, observers для анализа сообщений и интеграцию с ReportsBus для сохранения диалогов.

### Ключевые концепции:

**BufferedDialog** — расширение @dialogai/dialog-class с автоматической буферизацией истории диалога в YDB. Buffer история используется для передачи в ReportsBus после завершения диалога.

**LangChain Tools** — инструменты, доступные LLM во время диалога:
- Отслеживание активности пользователя (sharing tracking)
- Получение новостей о друзьях
- Обработка завершения диалога
- Управление профилем пользователя

**DialogObserver** — паттерн для pre-check анализа входящих сообщений перед основной обработкой LLM.

### Назначение модуля:

- Управление диалогами с пользователями через LLM
- Автоматическая буферизация истории диалога
- Предоставление tools для LLM (tracking, news, completion)
- Observers для анализа сообщений
- Интеграция с ReportsBus (process_dialog_completion)
- Интеграция с WorkspaceManager (context о workspace)

---

## 2. Ответственность модуля

### Что ДЕЛАЕТ DialogSystem:

✅ **Управление диалогами:**
- Обработка входящих сообщений пользователя
- Генерация ответов через LLM
- Автоматическая буферизация истории

✅ **Буферизация:**
- Сохранение истории в отдельную YDB сессию (_BUFFER_*)
- Получение buffer history для передачи в ReportsBus
- Очистка buffer после обработки

✅ **Tools integration:**
- track_user_sharing_tool - фиксация активности
- get_friends_news_tool - получение новостей
- process_dialog_completion_tool - обработка завершения
- set_user_name_tool, set_user_description_tool - профиль

✅ **Observers:**
- Pre-check анализ сообщений через DialogObserver
- UserSharingObserver - определение sharing активности

✅ **Интеграция:**
- ReportsBus.process_dialog_completion() при завершении
- WorkspaceManager для получения workspace context
- users-controller для user data

### Что НЕ ДЕЛАЕТ DialogSystem:

❌ Batch AI обработка (это ReportsBus)
❌ Управление workspace (это WorkspaceManager)
❌ Отправка уведомлений (это NotificationRouter)
❌ Таймерные задачи (это TimerHandler)

---

## 3. Зависимости

### Внешние пакеты:

```javascript
{
  "@dialogai/dialog-class": "^2.1.8",      // Base Dialog class
  "@dialogai/ydb-chat-history": "^1.0.0",  // YDB chat history
  "@langchain/core": "^0.1.0",             // LangChain tools, messages
  "@dieugene/utils": "^1.16.3",            // Утилиты
  "@dieugene/users-controller": "^1.0.0",  // User management
  "zod": "^3.22.0"                         // Schema validation для tools
}
```

### Внутренние модули:

- **ReportsBus** — process_dialog_completion(), collect_all_user_news(), move_all_news_to_history()
- **WorkspaceManager** — get_all_workspace_members(), get_workspace_info()
- **UsersController** (@dieugene/users-controller) — get_user_data(), set_user_data()

### Infrastructure:

- **YDB** — хранение buffer history через @dialogai/ydb-chat-history
- **LLM** — OpenAI gpt-5/gpt-5-mini для dialog generation

---

## 4. Архитектура и компоненты

### 4.1 Модульная структура

```
src/modules/dialog-system.js
├─ BufferedDialog (class, extends Dialog)
│  ├─ constructor(options)
│  ├─ invoke(message, options) - override с buffer capture
│  ├─ getBufferHistoryInstance() - lazy init buffer
│  ├─ captureUserMessage(message)
│  ├─ captureAIResponse()
│  ├─ getBufferHistory() - получение buffer истории
│  ├─ getBufferHistoryText(options) - текстовое представление
│  └─ clearBuffer() - очистка buffer после обработки
│
├─ Tools Factory Functions
│  ├─ getTrackUserSharingTool(dialog)
│  ├─ getFriendsNewsTool(dialog)
│  ├─ getProcessDialogCompletionTool(dialog)
│  ├─ setUserNameTool(dialog)
│  └─ setUserDescriptionTool(dialog)
│
├─ DialogObserver (class)
│  ├─ constructor(host)
│  ├─ pre_check(human_msg, messages) - abstract
│  └─ format(template, ...args) - helper
│
├─ UserSharingObserver (class, extends DialogObserver)
│  └─ pre_check(human_msg, messages) - implementation
│
└─ DialogSystem (High-level API)
   ├─ create_dialog(user_uuid, workspace_id, options)
   ├─ get_dialog(user_uuid) - получение существующего dialog
   └─ invoke_dialog(user_uuid, message, workspace_id)
```

---

## 5. Схема данных (YDB)

### 5.1 Buffer History Storage

**Использует:** @dialogai/ydb-chat-history

**Session ID format:** `_BUFFER_{user_uuid}`

**Структура:**
```javascript
Table: chat_message_history (из @dialogai/ydb-chat-history)

Columns:
- session_id (String, Partition Key) - _BUFFER_{user_uuid}
- timestamp (Uint64, Sort Key) - timestamp сообщения
- type (String) - 'human' или 'ai'
- content (String) - текст сообщения
- metadata (JsonDocument) - дополнительные данные
```

### 5.2 User Data (через users-controller)

**Обновляемые поля:**
```javascript
{
  user_uuid: "user-456",
  ping_info: {
    last_shared_about_self: 1699999999,  // Обновляется track_user_sharing_tool
    last_received_news: 1699999999       // Обновляется get_friends_news_tool
  },
  first_name: "Иван",                    // Обновляется set_user_name_tool
  last_name: "Петров",                   // Обновляется set_user_name_tool
  occupation: "Backend Developer",        // Обновляется set_user_description_tool
  description: "Работаю над проектом X"  // Обновляется set_user_description_tool
}
```

---

## 6. API спецификация (High-level)

> **Детальный API contract** будет в отдельном файле `.agents/specs/api-contracts/dialog-system-api.md`

### 6.1 Основные функции

#### `create_dialog(user_uuid, workspace_id, options)`

**Назначение:** Создание нового BufferedDialog экземпляра для пользователя

**Параметры:**
- `user_uuid` (String) — UUID пользователя
- `workspace_id` (String) — ID workspace пользователя
- `options` (Object, optional) — дополнительные настройки

**Возвращает:** `BufferedDialog` — экземпляр dialog

**Алгоритм:**
1. Создать BufferedDialog с session_id = user_uuid
2. Инициализировать tools:
   - track_user_sharing_tool
   - get_friends_news_tool
   - process_dialog_completion_tool
   - set_user_name_tool
   - set_user_description_tool
3. Инициализировать observers:
   - UserSharingObserver
4. Добавить workspace context в system message
5. Вернуть dialog instance

---

#### `invoke_dialog(user_uuid, message, workspace_id)`

**Назначение:** Обработка сообщения пользователя (высокоуровневая обертка)

**Параметры:**
- `user_uuid` (String) — UUID пользователя
- `message` (String) — текст сообщения
- `workspace_id` (String) — ID workspace

**Возвращает:**
```javascript
Promise<{
    message: String,           // Текст ответа
    post_messages: Array,      // Дополнительные сообщения
    message_buttons: Array     // Кнопки (если есть)
}>
```

**Алгоритм:**
1. Получить или создать dialog через create_dialog()
2. Вызвать dialog.invoke(message)
3. Buffer автоматически захватывает user message и AI response
4. Вернуть dialog.response

---

### 6.2 BufferedDialog Methods

#### `getBufferHistory()`

**Назначение:** Получение всей buffer истории диалога

**Возвращает:** `Promise<Array<Message>>` — массив HumanMessage и AIMessage

**Используется:** ReportsBus.process_dialog_completion()

---

#### `getBufferHistoryText(options)`

**Назначение:** Получение текстового представления buffer истории

**Параметры:**
```javascript
{
    ai_alias: 'Бот',          // Префикс для AI сообщений
    user_alias: 'Пользователь' // Префикс для user сообщений
}
```

**Возвращает:** `Promise<String>` — текстовое представление истории

**Формат:**
```
Пользователь: Привет! Как дела?
Бот: Здравствуйте! У меня все отлично. А как у вас дела?
Пользователь: Завершил проект X сегодня.
Бот: Поздравляю с завершением проекта! Расскажите подробнее.
```

**Используется:** ReportsBus.process_dialog_completion()

---

#### `clearBuffer()`

**Назначение:** Очистка buffer истории после обработки

**Возвращает:** `Promise<void>`

**Используется:** ReportsBus.process_dialog_completion() после сохранения raw record

---

## 7. Tools Specification

### 7.1 track_user_sharing_tool

**Назначение:** Фиксация активности пользователя (когда рассказывает о себе)

**Schema:**
```javascript
{
    sharing_context: z.string()
        .describe('Краткое описание о чем рассказал пользователь')
}
```

**Поведение:**
1. Обновляет `user_data.ping_info.last_shared_about_self` = I.get_seconds_now()
2. Сохраняет через users.set_user_data()
3. Возвращает: "Активность пользователя зафиксирована"

**Когда вызывается LLM:**
- Пользователь рассказывает о делах/проектах/работе
- НЕ вызывается при простых ответах "да/нет"
- НЕ вызывается при вопросах пользователя

---

### 7.2 get_friends_news_tool

**Назначение:** Получение новостей о друзьях из workspace

**Schema:**
```javascript
{
    request_context: z.string().optional()
        .describe('Контекст запроса - почему решил получить новости')
}
```

**Поведение:**
1. Вызывает ReportsBus.collect_all_user_news(workspace_id, user_uuid)
2. Если нет новостей → возвращает "Новых новостей нет"
3. Если есть новости:
   - Обновляет user_data.ping_info.last_received_news
   - Вызывает ReportsBus.move_all_news_to_history(workspace_id, user_uuid)
   - Возвращает текст с новостями

**Когда вызывается LLM:**
- Пользователь прямо спрашивает о новостях друзей
- Основной диалог завершен и уместно предложить новости

---

### 7.3 process_dialog_completion_tool

**Назначение:** Обработка завершения диалога (сохранение в ReportsBus)

**Schema:**
```javascript
{
    completion_reason: z.string()
        .describe('Причина завершения диалога')
}
```

**Поведение:**
1. Вызывает ReportsBus.process_dialog_completion(workspace_id, user_uuid, dialog)
2. ReportsBus:
   - Получает buffer history через dialog.getBufferHistory()
   - Формирует text через dialog.getBufferHistoryText()
   - Сохраняет raw record в YDB
   - Очищает buffer через dialog.clearBuffer()
3. Возвращает: "Диалог успешно обработан и сохранен"

**Когда вызывается LLM:**
- Диалог получил логическое завершение
- Фразы типа "Удачи в работе!", "Если что понадобится" в ответе
- Уровень неопределенности = 0 (если отслеживается)

---

### 7.4 set_user_name_tool

**Назначение:** Установка имени пользователя

**Schema:**
```javascript
{
    first_name: z.string().describe('Имя пользователя'),
    last_name: z.string().optional().describe('Фамилия пользователя')
}
```

**Поведение:**
1. Обновляет user_data.first_name, user_data.last_name
2. Сохраняет через users.set_user_data()
3. Возвращает: "Приятно познакомиться, {first_name}!"

---

### 7.5 set_user_description_tool

**Назначение:** Установка описания пользователя (профессия, проекты)

**Schema:**
```javascript
{
    occupation: z.string().optional().describe('Профессия'),
    description: z.string().optional().describe('Дополнительное описание'),
    update_mode: z.enum(['replace', 'append']).default('append')
}
```

**Поведение:**
1. Обновляет user_data.occupation, user_data.description
2. Режим 'append' дополняет существующие данные
3. Режим 'replace' заменяет существующие данные
4. Сохраняет через users.set_user_data()

---

## 8. DialogObserver Pattern

### 8.1 UserSharingObserver

**Назначение:** Pre-check анализ сообщения - определяет, рассказывает ли пользователь о себе

**Алгоритм:**
1. Проверка: если сообщение - instruction → skip
2. LLM анализ с structured output:
   ```javascript
   {
       is_sharing: boolean  // true если рассказывает о делах
   }
   ```
3. Если is_sharing === true:
   - Обновляет user_data.ping_info.last_shared_about_self
   - Возвращает: "Активность зафиксирована"

**Prompt:**
```
Ниже в блоке тебе представлено сообщение от пользователя.
Твоя задача - оценить, рассказывает ли пользователь о своих делах,
проектах, работе или личных новостях.

{user_message}

Ответь в формате JSON:
{ "is_sharing": true/false }
```

**Когда срабатывает:**
- Перед основной обработкой dialog.invoke()
- Дублирует функциональность track_user_sharing_tool (для резервирования)

---

## 9. Алгоритмы и процессы

### 9.1 Процесс: Обработка сообщения пользователя

```
[Telegram webhook → message от пользователя]
         │
         ▼
[TelegramHandler вызывает DialogSystem.invoke_dialog(user_uuid, message, workspace_id)]
         │
         ▼
[DialogSystem.create_dialog() или get_dialog()]
         │
         ├─> Инициализация BufferedDialog
         ├─> Добавление tools (5 tools)
         ├─> Добавление observers (UserSharingObserver)
         ├─> Формирование workspace context
         │
         ▼
[dialog.invoke(message)]
         │
         ├─> UserSharingObserver.pre_check(message) - анализ sharing
         ├─> Buffer захватывает HumanMessage
         ├─> LLM обрабатывает сообщение
         ├─> LLM может вызвать tools:
         │    ├─> track_user_sharing_tool (если sharing)
         │    ├─> get_friends_news_tool (если запрос новостей)
         │    ├─> process_dialog_completion_tool (если завершение)
         │    ├─> set_user_name_tool (если называет имя)
         │    └─> set_user_description_tool (если рассказывает о работе)
         ├─> Buffer захватывает AIMessage response
         │
         ▼
[Возврат dialog.response в TelegramHandler]
         │
         ▼
[TelegramHandler отправляет ответ пользователю]
```

### 9.2 Процесс: Завершение диалога и сохранение в ReportsBus

```
[LLM определяет завершение диалога]
         │
         ▼
[LLM вызывает process_dialog_completion_tool]
         │
         ▼
[Tool вызывает ReportsBus.process_dialog_completion(workspace_id, user_uuid, dialog)]
         │
         ├─> dialog.getBufferHistory() - получение buffer истории
         ├─> dialog.getBufferHistoryText() - формирование текста
         ├─> ReportsBus.Dao.add_raw_record() - сохранение raw record
         ├─> dialog.clearBuffer() - очистка buffer
         │
         ▼
[Диалог сохранен в ReportsBus для batch AI обработки]
```

---

## 10. Edge Cases и Error Handling

### 10.1 Edge Case: Buffer history пуст

**Ситуация:** Вызван process_dialog_completion, но buffer history пуст

**Решение:**
- ReportsBus проверяет bufferHistory.length === 0
- Не создает raw record
- Не очищает buffer
- Возвращает true (не ошибка)

### 10.2 Edge Case: LLM tool call failed

**Ситуация:** Tool (например, track_user_sharing) выбросил ошибку

**Решение:**
- Try-catch внутри каждого tool
- Логирование через I.log_error()
- Возвращаем user-friendly сообщение: "Произошла ошибка"
- Dialog продолжается (не прерывается)

### 10.3 Edge Case: YDB buffer unavailable

**Ситуация:** YDB недоступна, не можем сохранить buffer history

**Решение:**
- BufferedDialog.captureUserMessage() обрабатывает ошибку через try-catch
- Логирует ошибку
- Продолжает работу БЕЗ буферизации (bufferEnabled остается true, но операции skip)
- Dialog все равно работает (основная история в основной сессии)

### 10.4 Edge Case: Несколько dialog instances для одного user

**Ситуация:** Одновременные запросы создают несколько BufferedDialog для одного user_uuid

**Решение:**
- Каждый instance использует один и тот же session_id = user_uuid
- Каждый instance использует один и тот же buffer session_id = _BUFFER_{user_uuid}
- YDB обеспечивает consistency для buffer history
- Это допустимое поведение (одна сессия, несколько экземпляров)

### 10.5 Edge Case: process_dialog_completion вызван дважды

**Ситуация:** LLM ошибочно вызывает process_dialog_completion_tool дважды

**Решение:**
- Первый вызов: обрабатывает buffer, очищает его
- Второй вызов: buffer пуст → ReportsBus возвращает true, ничего не создает
- Идемпотентность обеспечена

---

## 11. Performance Considerations

### 11.1 Lazy initialization buffer history

**Решение:** Buffer history инициализируется только при первом вызове getBufferHistoryInstance()

**Плюсы:**
- Не создаем buffer session если dialog не используется
- Оптимизация cold start

### 11.2 Tools overhead

**Проблема:** 5 tools добавляют overhead к каждому LLM запросу

**Решение:**
- Использовать tool descriptions для guidance (LLM сам выбирает когда вызывать)
- В будущем (v2.0) можно добавить dynamic tools (подгружать только нужные)

### 11.3 Observer LLM calls

**Проблема:** UserSharingObserver делает дополнительный LLM вызов перед основным

**Решение:**
- Использовать gpt-5-mini для observers (дешевле, быстрее)
- Caching результатов для одинаковых сообщений (опционально)

---

## 12. Testing Requirements

### 12.1 Unit Tests

**Обязательные тесты:**
- BufferedDialog.invoke() - захват user message и AI response
- BufferedDialog.getBufferHistory() - получение истории
- BufferedDialog.clearBuffer() - очистка
- create_dialog() - инициализация с tools и observers
- Каждый tool отдельно (mock dependencies)
- UserSharingObserver.pre_check()

**Mocks:**
- YDB (@dialogai/ydb-chat-history)
- LLM (для dialog и observer)
- ReportsBus, WorkspaceManager, users-controller

### 12.2 Integration Tests

**Обязательные тесты:**
- End-to-end: message → dialog.invoke → buffer → process_completion → ReportsBus
- Tools integration: track_sharing → users.set_user_data
- Tools integration: get_news → ReportsBus.collect_all_user_news

### 12.3 Edge Case Tests

**Обязательные тесты:**
- Пустой buffer при process_completion
- Tool call error handling
- YDB unavailable (buffer disabled)
- Двойной вызов process_completion

---

## 13. Migration from Legacy

**Legacy implementation:** `legacy/dialog.js`, `legacy/dialog-class.js`

### 13.1 Изменения

| Legacy | New (v1.0.0) | Изменения |
|--------|--------------|-----------|
| BotDialog module | DialogSystem module | Переименование |
| ContentBus.process_dialog_completion | ReportsBus.process_dialog_completion | Новый модуль |
| ContentBus.collect_all_user_news | ReportsBus.collect_all_user_news | Новый модуль |
| Нет workspace_id | workspace_id обязателен | Workspace isolation |

### 13.2 Tools Changes

**Удалены legacy tools:**
- ❌ invite_friend_tool - убран из scope Phase 2

**Сохранены tools:**
- ✅ track_user_sharing_tool
- ✅ get_friends_news_tool
- ✅ process_dialog_completion_tool
- ✅ set_user_name_tool
- ✅ set_user_description_tool

### 13.3 Migration Strategy

**НЕ ТРЕБУЕТСЯ migration** - это новая реализация для Phase 2

Legacy dialog продолжит работать параллельно до полного перехода.

---

## 14. Future Enhancements (v2.0+)

### 14.1 SGR Integration (v2.0)

**Идея:** Каскадная AI обработка диалогов через Schema-Guided Reasoning

**Детали:** См. ReportsBus specification section 6.3

### 14.2 Dynamic Tools Loading

**Идея:** Подгружать только нужные tools для конкретного context

**Пример:**
```javascript
const tools = [];
if (user_needs_onboarding) tools.push(onboarding_tool);
if (user_has_friends) tools.push(get_news_tool);
```

### 14.3 Multi-workspace Context

**Идея:** Поддержка нескольких workspace в одном диалоге

**Детали:** Пользователь может переключаться между workspace во время диалога

### 14.4 Voice Support

**Идея:** Поддержка голосовых сообщений

**Детали:** Интеграция с speech-to-text и text-to-speech

---

## 15. Acceptance Criteria

### Критерии приемки модуля:

- ✅ BufferedDialog class полностью реализован
- ✅ Все 5 tools работают корректно
- ✅ UserSharingObserver работает
- ✅ Buffer history захватывает HumanMessage и AIMessage
- ✅ getBufferHistoryText() форматирует корректно
- ✅ clearBuffer() очищает buffer
- ✅ Интеграция с ReportsBus работает (process_completion)
- ✅ Интеграция с WorkspaceManager работает (context)
- ✅ Unit tests покрытие ≥ 80%
- ✅ Integration tests проходят
- ✅ Error handling для всех edge cases
- ✅ Code review пройден

---

**Status:** 📝 Draft - готова для review
**Next Step:** Создать API контракт `.agents/specs/api-contracts/dialog-system-api.md`
