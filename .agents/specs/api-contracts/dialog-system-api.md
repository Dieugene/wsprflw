# API Contract: DialogSystem Module

**Модуль:** DialogSystem
**Файл:** `src/modules/dialog-system.js`
**Версия:** 1.0.0
**Статус:** 📝 Draft

---

## Обзор

DialogSystem предоставляет три уровня API:

1. **High-level API** - для использования другими модулями (TelegramHandler)
2. **BufferedDialog Class** - core класс для управления диалогами
3. **Tools API** - инструменты для LLM

---

## Table of Contents

1. [High-level API](#high-level-api)
   - [create_dialog](#create_dialog)
   - [invoke_dialog](#invoke_dialog)

2. [BufferedDialog Class API](#buffered dialog-class-api)
   - [constructor](#constructor)
   - [invoke](#invoke)
   - [getBufferHistory](#getbufferhistory)
   - [getBufferHistoryText](#getbufferhistorytext)
   - [clearBuffer](#clearbuffer)

3. [Tools API](#tools-api)
   - [track_user_sharing_tool](#track_user_sharing_tool)
   - [get_friends_news_tool](#get_friends_news_tool)
   - [process_dialog_completion_tool](#process_dialog_completion_tool)
   - [set_user_name_tool](#set_user_name_tool)
   - [set_user_description_tool](#set_user_description_tool)

4. [DialogObserver API](#dialogobserver-api)
   - [UserSharingObserver](#usersharingobserver)

---

## High-level API

### create_dialog

Создание нового BufferedDialog экземпляра для пользователя.

#### Сигнатура

```javascript
function create_dialog(user_uuid, workspace_id, options = {})
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_uuid` | String | ✅ | UUID пользователя |
| `workspace_id` | String | ✅ | ID workspace пользователя |
| `options` | Object | ❌ | Дополнительные настройки dialog |

#### Возвращает

`BufferedDialog` - экземпляр dialog с tools и observers

#### Описание

1. Создает новый BufferedDialog с session_id = user_uuid
2. Инициализирует 5 tools:
   - track_user_sharing_tool
   - get_friends_news_tool
   - process_dialog_completion_tool
   - set_user_name_tool
   - set_user_description_tool
3. Добавляет UserSharingObserver
4. Формирует workspace context (список участников)
5. Возвращает готовый dialog instance

#### Пример использования

```javascript
const { DialogSystem } = require('./modules/dialog-system');

// Создание dialog для пользователя
const dialog = DialogSystem.create_dialog(
    "user-uuid-123",
    "ws-abc123",
    { bufferEnabled: true }
);

// Использование dialog
const response = await dialog.invoke("Привет! Как дела?");
console.log(response.message);
```

---

### invoke_dialog

Обработка сообщения пользователя (высокоуровневая обертка).

#### Сигнатура

```javascript
async function invoke_dialog(user_uuid, message, workspace_id)
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_uuid` | String | ✅ | UUID пользователя |
| `message` | String | ✅ | Текст сообщения от пользователя |
| `workspace_id` | String | ✅ | ID workspace |

#### Возвращает

```javascript
Promise<{
    message: String,           // Текст ответа от AI
    post_messages: Array,      // Дополнительные сообщения
    message_buttons: Array     // Кнопки (если есть)
}>
```

#### Описание

1. Получает или создает dialog через create_dialog()
2. Вызывает dialog.invoke(message)
3. Buffer автоматически захватывает user message и AI response
4. Возвращает dialog.response

#### Пример использования

```javascript
const { DialogSystem } = require('./modules/dialog-system');

// В TelegramHandler
async function handleUserMessage(user_uuid, workspace_id, text) {
    const response = await DialogSystem.invoke_dialog(
        user_uuid,
        text,
        workspace_id
    );

    // Отправить ответ
    await bot.sendMessage(user_telegram_id, response.message);

    // Отправить дополнительные сообщения
    if (response.post_messages) {
        for (const msg of response.post_messages) {
            await bot.sendMessage(user_telegram_id, msg.text);
        }
    }

    // Показать кнопки
    if (response.message_buttons) {
        await bot.sendMessage(user_telegram_id, "Выберите действие:", {
            reply_markup: {
                inline_keyboard: response.message_buttons.map(btn => [{
                    text: btn.split('::')[0],
                    callback_data: btn.split('::')[1]
                }])
            }
        });
    }
}
```

---

## BufferedDialog Class API

### constructor

Создание экземпляра BufferedDialog.

#### Сигнатура

```javascript
constructor(options = {})
```

#### Параметры

```javascript
{
    sessionId: String,         // UUID пользователя
    bufferEnabled: Boolean,    // Включить buffer (по умолчанию true)
    tools: Array,              // LangChain tools
    observers: Array,          // DialogObserver instances
    systemMessage: String,     // System message с workspace context
    ...otherDialogOptions      // Другие опции из @dialogai/dialog-class
}
```

#### Пример использования

```javascript
const { BufferedDialog } = require('./modules/dialog-system');
const { getTrackUserSharingTool } = require('./modules/dialog-system/tools');

const dialog = new BufferedDialog({
    sessionId: "user-uuid-123",
    bufferEnabled: true,
    tools: [getTrackUserSharingTool(dialog)],
    systemMessage: "Ты помощник для команды разработчиков..."
});
```

---

### invoke

Обработка сообщения пользователя (override от base Dialog).

#### Сигнатура

```javascript
async invoke(message, options = {})
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `message` | String | ✅ | Текст сообщения от пользователя |
| `options` | Object | ❌ | Дополнительные опции |

#### Возвращает

`Promise<Response>` - response объект с message, post_messages, buttons

#### Описание

1. Захватывает user message в buffer (captureUserMessage)
2. Вызывает super.invoke(message, options) - base Dialog processing
3. LLM обрабатывает сообщение, может вызывать tools
4. Захватывает AI response в buffer (captureAIResponse) через callback
5. Возвращает dialog.response

---

### getBufferHistory

Получение всей buffer истории диалога.

#### Сигнатура

```javascript
async getBufferHistory()
```

#### Возвращает

`Promise<Array<Message>>` - массив HumanMessage и AIMessage из @langchain/core/messages

**Message structure:**
```javascript
{
    constructor: { name: "HumanMessage" | "AIMessage" },
    content: String,
    timestamp: Number
}
```

#### Пример использования

```javascript
const bufferHistory = await dialog.getBufferHistory();

for (const msg of bufferHistory) {
    const role = msg.constructor.name === 'HumanMessage' ? 'User' : 'AI';
    console.log(`${role}: ${msg.content}`);
}
```

**Используется:** ReportsBus.process_dialog_completion()

---

### getBufferHistoryText

Получение текстового представления buffer истории.

#### Сигнатура

```javascript
async getBufferHistoryText(options = {})
```

#### Параметры

```javascript
{
    ai_alias: String,    // Префикс для AI сообщений (по умолчанию "Бот")
    user_alias: String   // Префикс для user сообщений (по умолчанию "Пользователь")
}
```

#### Возвращает

`Promise<String>` - текстовое представление истории

**Формат:**
```
Пользователь: Привет! Как дела?
Бот: Здравствуйте! У меня все отлично. А как у вас дела?
Пользователь: Завершил проект X сегодня.
Бот: Поздравляю с завершением проекта!
```

#### Пример использования

```javascript
const dialog_text = await dialog.getBufferHistoryText({
    ai_alias: 'Assistant',
    user_alias: 'User'
});

console.log(dialog_text);
// User: Hello!
// Assistant: Hi there! How can I help you?
```

**Используется:** ReportsBus.process_dialog_completion() для формирования raw record

---

### clearBuffer

Очистка buffer истории после обработки.

#### Сигнатура

```javascript
async clearBuffer()
```

#### Возвращает

`Promise<void>`

#### Описание

1. Получает buffer history instance
2. Вызывает history.clear() (из @dialogai/ydb-chat-history)
3. Очищает все сообщения из _BUFFER_{user_uuid} session

#### Пример использования

```javascript
// После сохранения в ReportsBus
await ReportsBus.process_dialog_completion(workspace_id, user_uuid, dialog);

// Buffer автоматически очищается внутри process_dialog_completion
// Но можно вызвать вручную:
await dialog.clearBuffer();
```

**Используется:** ReportsBus.process_dialog_completion() после сохранения raw record

---

## Tools API

### track_user_sharing_tool

Фиксация активности пользователя (когда рассказывает о делах).

#### Schema

```javascript
{
    sharing_context: z.string()
        .describe('Краткое описание о чем рассказал пользователь (проект, работа, событие)')
}
```

#### Поведение

1. Получает user_uuid из dialog.get_initial_session_id()
2. Загружает user_data через users.get_user_data(user_uuid)
3. Обновляет user_data.ping_info.last_shared_about_self = I.get_seconds_now()
4. Сохраняет через users.set_user_data(user_uuid, user_data)
5. Логирует событие
6. Возвращает: "Активность пользователя зафиксирована для системы уведомлений"

#### Когда вызывается LLM

✅ **Вызывать:**
- Пользователь рассказывает о делах, проектах, работе
- Пользователь делится личными новостями
- Даже если информация недостаточно детализирована

❌ **НЕ вызывать:**
- Простые ответы "да/нет"
- Общие фразы без контекста
- Пользователь задает вопросы

#### Пример

**User:** "Сегодня завершил работу над модулем авторизации"

**LLM action:** Вызвать track_user_sharing_tool({ sharing_context: "завершение модуля авторизации" })

**Tool response:** "Активность пользователя зафиксирована для системы уведомлений"

---

### get_friends_news_tool

Получение новостей о друзьях из workspace.

#### Schema

```javascript
{
    request_context: z.string().optional()
        .describe('Контекст запроса - почему решил получить новости сейчас')
}
```

#### Поведение

1. Получает user_uuid и workspace_id
2. Вызывает ReportsBus.collect_all_user_news(workspace_id, user_uuid)
3. Если news.length === 0:
   - Возвращает: "Пока что новых новостей о друзьях нет"
4. Если есть новости:
   - Обновляет user_data.ping_info.last_received_news = I.get_seconds_now()
   - Вызывает ReportsBus.move_all_news_to_history(workspace_id, user_uuid)
   - Формирует текст с новостями
   - Возвращает: "У меня есть свежие новости о твоих друзьях: {news}"

#### Когда вызывается LLM

✅ **Вызывать:**
- Пользователь прямо спрашивает о новостях друзей
- Основной диалог о его делах завершен, уместно предложить новости

❌ **НЕ вызывать:**
- В начале разговора
- Когда пользователь активно рассказывает о себе

#### Пример

**User:** "А что нового у ребят?"

**LLM action:** Вызвать get_friends_news_tool({ request_context: "пользователь спросил о новостях команды" })

**Tool response:** "У меня есть свежие новости о твоих друзьях:\n\n- Иван завершил проект X\n- Мария начала работу над модулем Y"

---

### process_dialog_completion_tool

Обработка завершения диалога (сохранение в ReportsBus).

#### Schema

```javascript
{
    completion_reason: z.string()
        .describe('Причина завершения диалога - почему считаешь что диалог завершен')
}
```

#### Поведение

1. Получает user_uuid, workspace_id из dialog
2. Вызывает ReportsBus.process_dialog_completion(workspace_id, user_uuid, dialog)
3. ReportsBus внутри:
   - Получает buffer history через dialog.getBufferHistory()
   - Формирует text через dialog.getBufferHistoryText()
   - Если buffer пуст → пропускает
   - Сохраняет raw record в YDB
   - Очищает buffer через dialog.clearBuffer()
4. Если успешно:
   - Возвращает: "Диалог успешно обработан и сохранен"
5. Если ошибка:
   - Возвращает: "Произошла ошибка при обработке диалога"

#### Когда вызывается LLM

✅ **Вызывать:**
- Диалог получил логическое завершение
- Узнал о текущих делах пользователя и готов завершить
- Поделился новостями о друзьях
- Фразы типа "Удачи в работе!", "Если что понадобится"
- Уровень неопределенности = 0 (если отслеживается в Meta-Data)

❌ **НЕ вызывать:**
- В середине активного разговора
- Пользователь продолжает рассказывать

#### Пример

**AI:** "Отлично! Удачи с завершением проекта X! Если понадобится помощь, обращайтесь."

**LLM action:** Вызвать process_dialog_completion_tool({ completion_reason: "диалог завершен, пожелал удачи" })

**Tool response:** "Диалог успешно обработан и сохранен. Информация добавлена в шину новостей для друзей."

---

### set_user_name_tool

Установка имени пользователя.

#### Schema

```javascript
{
    first_name: z.string().describe('Имя пользователя'),
    last_name: z.string().optional().describe('Фамилия пользователя (если указана)')
}
```

#### Поведение

1. Обновляет user_data.first_name = first_name
2. Обновляет user_data.last_name = last_name (если указано)
3. Сохраняет через users.set_user_data()
4. Возвращает: "Приятно познакомиться, {first_name}! Имя сохранено."

#### Когда вызывается LLM

✅ **Вызывать:**
- Пользователь впервые называет своё имя
- Приоритетная информация (обычно не меняется)

---

### set_user_description_tool

Установка описания пользователя (профессия, проекты).

#### Schema

```javascript
{
    occupation: z.string().optional().describe('Профессия или род деятельности'),
    description: z.string().optional().describe('Дополнительное описание пользователя'),
    update_mode: z.enum(['replace', 'append']).default('append')
        .describe('replace - заменить, append - дополнить')
}
```

#### Поведение

1. Режим 'append' (по умолчанию):
   - Дополняет существующие occupation и description
2. Режим 'replace':
   - Заменяет существующие данные
3. Сохраняет через users.set_user_data()
4. Возвращает: "Информация о профессии сохранена"

#### Когда вызывается LLM

✅ **Вызывать:**
- Пользователь рассказывает о работе, проектах, деятельности
- Может вызываться многократно для дополнения информации

---

## DialogObserver API

### UserSharingObserver

Pre-check анализ сообщения - определяет, рассказывает ли пользователь о себе.

#### Методы

##### pre_check

```javascript
async pre_check(human_msg = "", messages = [])
```

**Параметры:**
- `human_msg` (String) - текущее сообщение пользователя
- `messages` (Array) - история сообщений (не используется в текущей версии)

**Возвращает:**
- `Promise<String>` - "Активность зафиксирована" или skip message

**Алгоритм:**
1. Проверка: если message - instruction → skip
2. LLM анализ через gpt-5-mini:
   ```javascript
   { is_sharing: boolean }
   ```
3. Если is_sharing === true:
   - Обновляет user_data.ping_info.last_shared_about_self
   - Возвращает: "Активность пользователя зафиксирована"
4. Иначе → skip

**Prompt:**
```
Ты наблюдаешь за диалогом и определяешь, чему посвящены сообщения пользователя.

Ниже в блоке, ограниченном символами "==============", тебе представлено сообщение от пользователя.
Твоя задача - оценить, рассказывает ли пользователь о своих делах, проектах, работе или личных новостях.
==============
{human_msg}
==============

Ответь, рассказывает ли пользователь о своих делах.
Если сообщения не содержат надлежащей информации, отвечай отрицательно.
Ответ представь в формате JSON по представленной схеме.
```

**Пример использования:**

```javascript
const observer = new UserSharingObserver(dialog);

const result = await observer.pre_check("Сегодня завершил проект X");
// result: "Активность пользователя зафиксирована"

const result2 = await observer.pre_check("Да");
// result2: undefined (skip)
```

---

## Примеры полного workflow

### Пример 1: Обработка сообщения с sharing tracking

```javascript
const { DialogSystem } = require('./modules/dialog-system');

async function handleMessage(user_uuid, workspace_id, text) {
    // Создание или получение dialog
    const response = await DialogSystem.invoke_dialog(
        user_uuid,
        text,
        workspace_id
    );

    console.log('AI Response:', response.message);

    // Автоматически:
    // 1. UserSharingObserver проанализировал message
    // 2. Если is_sharing === true → обновил last_shared_about_self
    // 3. Buffer захватил HumanMessage
    // 4. LLM обработал и возможно вызвал track_user_sharing_tool
    // 5. Buffer захватил AIMessage response

    return response;
}
```

### Пример 2: Завершение диалога и сохранение

```javascript
const { DialogSystem } = require('./modules/dialog-system');

// User говорит о делах
await DialogSystem.invoke_dialog(user_uuid, "Завершил проект X", workspace_id);

// AI решает завершить диалог
const response = await DialogSystem.invoke_dialog(
    user_uuid,
    "Что нового?",
    workspace_id
);

// AI response: "Отлично! Удачи с завершением! Если понадобится помощь, обращайтесь."
// AI вызывает process_dialog_completion_tool автоматически

// Внутри tool:
// 1. ReportsBus.process_dialog_completion() вызван
// 2. dialog.getBufferHistory() - получена история
// 3. dialog.getBufferHistoryText() - сформирован текст
// 4. Raw record сохранен в YDB
// 5. dialog.clearBuffer() - buffer очищен

console.log('Dialog completed and saved to ReportsBus');
```

### Пример 3: Получение новостей

```javascript
const { DialogSystem } = require('./modules/dialog-system');

// User спрашивает о новостях
const response = await DialogSystem.invoke_dialog(
    user_uuid,
    "Что нового у ребят?",
    workspace_id
);

// LLM вызывает get_friends_news_tool
// Tool собирает новости из ReportsBus
// AI response содержит новости:

console.log(response.message);
// "У меня есть свежие новости о твоих друзьях:
//
// - Иван завершил работу над модулем авторизации
// - Мария начала тестирование API
//
// Если у вас есть свои новости, не стесняйтесь делиться."
```

---

## Типы данных

### Response

```typescript
interface Response {
    message: string;                  // Текст ответа от AI
    post_messages?: Array<{          // Дополнительные сообщения
        text: string;
    }>;
    message_buttons?: Array<string>; // Кнопки в формате "Text::callback_data"
}
```

### BufferedDialogOptions

```typescript
interface BufferedDialogOptions {
    sessionId: string;               // UUID пользователя
    bufferEnabled?: boolean;         // Включить buffer (default: true)
    tools?: Array<DynamicStructuredTool>;
    observers?: Array<DialogObserver>;
    systemMessage?: string;
    // ... другие опции из @dialogai/dialog-class
}
```

### Message

```typescript
interface Message {
    constructor: { name: "HumanMessage" | "AIMessage" };
    content: string;
    timestamp?: number;
}
```

---

## Коды ошибок

### High-level API errors

| Код | Описание |
|-----|----------|
| `USER_NOT_FOUND` | Пользователь не найден в users-controller |
| `WORKSPACE_NOT_FOUND` | Workspace не существует |
| `BUFFER_INIT_ERROR` | Ошибка инициализации buffer history |
| `TOOL_EXECUTION_ERROR` | Ошибка выполнения tool |

### Tools errors

| Код | Описание |
|-----|----------|
| `REPORTS_BUS_ERROR` | Ошибка при вызове ReportsBus |
| `USER_DATA_UPDATE_ERROR` | Ошибка обновления user data |

---

**Status:** 📝 Draft - готов для review
**Next Step:** Developer реализует модуль согласно этому контракту
