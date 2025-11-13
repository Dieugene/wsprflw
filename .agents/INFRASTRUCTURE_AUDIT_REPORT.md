# Архитектурный отчет: Аудит инфраструктуры
**Роль:** Architect
**Дата:** 2025-11-09
**Статус:** 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ ОБНАРУЖЕНЫ

---

## 📋 Executive Summary

После сравнения текущей реализации с reference-project (mir-zdorovia-dialog-bot) обнаружены **КРИТИЧЕСКИЕ** недостатки в инфраструктуре, которые блокируют production deployment.

**Основные проблемы:**
1. ❌ Отсутствие управления сессиями
2. ❌ Отсутствие системы очередей для обработки сообщений
3. ❌ Отсутствие кэширования сообщений
4. ❌ Неправильные версии пакетов
5. ❌ Отсутствие обработки зависших сессий при ошибках

**Риск:** Высокий - при запуске в production бот будет работать нестабильно, терять сообщения пользователей, зависать при параллельных запросах.

---

## 🔍 Детальный анализ

### 1. 🚨 КРИТИЧНО: Отсутствие управления сессиями

**Местоположение:** `index.js:294-314` (обработчик `bot.on('text')`)

**Текущая реализация:**
```javascript
bot.on('text', async (ctx) => {
    const user_uuid = await users.tg.get_user_uuid(ctx);
    const workspace_id = 'ws-default';

    // Сразу обрабатывает сообщение БЕЗ проверки сессии
    const dialog = DialogSystem.create_dialog(user_uuid, workspace_id);
    const response = await dialog.process_user_message(ctx.message.text);
    await ctx.reply(response);
});
```

**Правильная реализация (из reference-project, index.js:249-283):**
```javascript
async function process_user_message(ctx, data = {}, bot_token) {
    if (!queuer.is_from_queue(input)) {
        // Проверка сессии ПЕРЕД обработкой
        let user_uuid = await users.tg.get_user_uuid(ctx);
        let session_in_progress = !(await sessions.is_finished(user_uuid));

        if (session_in_progress) {
            // Если сессия активна - показать "подождите"
            return await ctx.editMessageText(
                'Пожалуйста, подождите. Обрабатываю предыдущий запрос',
                {message_id: placeholder_message_id, parse_mode: 'HTML'}
            );
        }

        // Запускаем сессию и отправляем в очередь
        await sessions.start(user_uuid);
        return await queuer.send_to_queue(input, bot_token, process.env.QUEUE_URL, bot_domain);
    }

    // Обработка из очереди
    // ... dialog processing ...
}
```

**Последствия текущей реализации:**
- ⚠️ Если пользователь отправляет 2-3 сообщения подряд, они обрабатываются параллельно
- ⚠️ DialogSystem может создать конфликты в истории диалога
- ⚠️ Возможны race conditions в базе данных
- ⚠️ Пользователь получит несколько ответов вперемешку

**Уровень критичности:** 🔴 БЛОКЕР для production

---

### 2. 🚨 КРИТИЧНО: Отсутствие системы очередей

**Проблема:** Текущая реализация обрабатывает сообщения **синхронно** в webhook handler.

**Текущая реализация:**
- Telegram webhook → `bot.handleUpdate()` → `bot.on('text')` → **сразу обработка** → ответ
- Время обработки: 5-30 секунд (AI dialog processing)
- Yandex Cloud Functions webhook timeout: **15 секунд**

**Правильная реализация:**
- Telegram webhook → `bot.handleUpdate()` → `bot.on('text')` → **отправка в Queue** → быстрый ответ
- Queue → отдельный handler → обработка → ответ через `bot.telegram.sendMessage()`
- Нет timeout проблем

**Последствия:**
- ⚠️ Telegram webhook timeouts при долгой обработке
- ⚠️ Повторные доставки сообщений от Telegram
- ⚠️ Дублирование ответов

**Уровень критичности:** 🔴 БЛОКЕР для production

---

### 3. 🚨 КРИТИЧНО: Отсутствие кэширования сообщений

**Проблема:** Если пользователь отправляет несколько сообщений быстро, часть может быть потеряна.

**Текущая реализация:** НЕТ кэширования

**Правильная реализация (reference-project):**
```javascript
// При получении сообщения НЕ из очереди
let placeholder_message_id = await tg_cache.put_placeholder(ctx);
await tg_cache.cache_and_show_progress(ctx, data);
await sessions.start(user_uuid);
await queuer.send_to_queue(input, bot_token, process.env.QUEUE_URL, bot_domain);

// При обработке из очереди
let cache = await tg_cache.get(ctx);
await tg_cache.del(ctx);
await processDialog(ctx, tg_cache.exclude_placeholder(cache), placeholder_message_id);
```

**Функционал:**
- Накапливает сообщения пока они в очереди
- Показывает progress indicator пользователю
- Передает все накопленные сообщения в dialog разом

**Последствия отсутствия:**
- ⚠️ Потеря сообщений при быстрой отправке
- ⚠️ Плохой UX - нет индикации обработки

**Уровень критичности:** 🟡 HIGH

---

### 4. 🚨 КРИТИЧНО: Неправильные версии пакетов

**Текущий `package.json`:**
```json
{
  "dependencies": {
    "@dieugene/queuer": "^1.0.0",          // ❌ Устаревшая
    "@dieugene/users-controller": "^1.0.0", // ❌ Устаревшая
    "@dieugene/utils": "^1.16.3",          // ❌ Неправильная версия
    "telegraf": "^4.12.0",                 // ❌ Устаревшая
    // ❌ ОТСУТСТВУЮТ критичные пакеты:
    // "@dieugene/sessions": "^2.0.0",
    // "@dieugene/tg-messages-cache": "^2.0.0"
  }
}
```

**Правильный `package.json` (из reference-project):**
```json
{
  "dependencies": {
    "@dieugene/queuer": "^2.0.0",          // ✅
    "@dieugene/sessions": "^2.0.0",        // ✅
    "@dieugene/tg-messages-cache": "^2.0.0", // ✅
    "@dieugene/users-controller": "^1.0.26", // ✅
    "@dieugene/utils": "^1.14.0",          // ✅
    "telegraf": "^4.15.3"                  // ✅
  }
}
```

**Критичные отсутствующие пакеты:**

1. **`@dieugene/sessions@^2.0.0`** - управление сессиями пользователей
   - API: `sessions.start(uuid)`, `sessions.is_finished(uuid)`, `sessions.finish(uuid)`

2. **`@dieugene/tg-messages-cache@^2.0.0`** - кэширование сообщений
   - API: `tg_cache.put_placeholder()`, `tg_cache.cache_and_show_progress()`, `tg_cache.get()`, `tg_cache.del()`

**Уровень критичности:** 🔴 БЛОКЕР для production

---

### 5. 🚨 КРИТИЧНО: Отсутствие sessions.finish() в error handler

**Текущая реализация (`index.js:362-386`):**
```javascript
try {
    await bot.handleUpdate(inputData.data.object);
} catch (e) {
    const user_uuid = await users.tg.get_user_uuid(bot_id, user_id);
    logger.critical('FATAL ERROR', { message: e.message, stack: e.stack }, inputData);
    // ❌ НЕТ: await sessions.finish(user_uuid);

    // Try to notify user
    // ...
}
```

**Правильная реализация (reference-project, index.js:189-201):**
```javascript
try {
    await bot.handleUpdate(inputData.data.object);
} catch (e) {
    let user_uuid = await users.tg.get_user_uuid(bot_id, user_id);
    await sessions.finish(user_uuid); // ✅ ОБЯЗАТЕЛЬНО!
    logger.critical('FATAL ERROR', {message: e.message, stack: e.stack}, inputData);
    // ...
}
```

**Последствия:**
- ⚠️ При ошибке сессия остается "зависшей"
- ⚠️ Пользователь не сможет отправлять новые сообщения
- ⚠️ Требуется ручное вмешательство или restart бота

**Уровень критичности:** 🔴 БЛОКЕР для production

---

### 6. 🟡 Отсутствие QUEUE_URL environment variable

**Проблема:** Reference-project использует `process.env.QUEUE_URL` для отправки в очередь.

**Текущая реализация:** Не использует

**Требуется добавить:**
```bash
QUEUE_URL=https://message-queue.api.cloud.yandex.net/...
```

**Уровень критичности:** 🟡 HIGH

---

## 📊 Сводная таблица проблем

| # | Проблема | Текущий статус | Критичность | Файл |
|---|----------|----------------|-------------|------|
| 1 | Управление сессиями | ❌ Отсутствует | 🔴 БЛОКЕР | `index.js:294-314` |
| 2 | Система очередей | ❌ Отсутствует | 🔴 БЛОКЕР | `index.js:294-314` |
| 3 | Кэширование сообщений | ❌ Отсутствует | 🟡 HIGH | `index.js:294-314` |
| 4 | Версии пакетов | ❌ Неправильные | 🔴 БЛОКЕР | `package.json` |
| 5 | sessions.finish() в catch | ❌ Отсутствует | 🔴 БЛОКЕР | `index.js:362-386` |
| 6 | QUEUE_URL env var | ❌ Отсутствует | 🟡 HIGH | Environment |

---

## 🎯 Рекомендации Architect

### Немедленные действия (MUST FIX):

1. **Обновить `package.json`** - добавить недостающие пакеты с правильными версиями
2. **Реализовать управление сессиями** - внедрить `@dieugene/sessions`
3. **Реализовать систему очередей** - рефакторинг `bot.on('text')` с использованием `@dieugene/queuer`
4. **Добавить кэширование** - внедрить `@dieugene/tg-messages-cache`
5. **Исправить error handling** - добавить `sessions.finish()` в catch блок

### Архитектурный паттерн (из reference-project):

```
┌─────────────────────────────────────────────────────────────┐
│  Telegram Webhook                                           │
│  ↓                                                           │
│  bot.handleUpdate(input)                                    │
│  ↓                                                           │
│  bot.on('text')                                             │
│  ↓                                                           │
│  process_user_message(ctx)                                  │
│  ├─ if (!queuer.is_from_queue(input))                      │
│  │  ├─ sessions.is_finished() ? → "Подождите"             │
│  │  ├─ tg_cache.put_placeholder()                          │
│  │  ├─ tg_cache.cache_and_show_progress()                 │
│  │  ├─ sessions.start()                                    │
│  │  └─ queuer.send_to_queue() → Yandex Message Queue      │
│  │                                                          │
│  └─ if (queuer.is_from_queue(input))                       │
│     ├─ cache = tg_cache.get()                              │
│     ├─ tg_cache.del()                                       │
│     ├─ dialog.invoke(cache)                                │
│     ├─ send_dialog_results()                               │
│     └─ sessions.finish() ← ВАЖНО!                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Следующие шаги

### Phase: Infrastructure Fixes

**Architect задачи:**
1. ✅ Создать детальный отчет (этот документ)
2. 🔄 Создать спецификацию для Infrastructure Fix
3. ⏳ Передать Developer для реализации

**Developer задачи:**
1. Обновить `package.json`
2. Реализовать `process_user_message()` функцию
3. Интегрировать sessions management
4. Интегрировать queue processing
5. Интегрировать message caching
6. Исправить error handling

**Reviewer задачи:**
1. Проверить соответствие reference-project паттернам
2. Проверить все 6 проблем исправлены

**Tester задачи:**
1. Тест: быстрая отправка нескольких сообщений
2. Тест: обработка ошибок не ломает сессии
3. Тест: кэширование работает корректно

---

## ⚠️ ПРЕДУПРЕЖДЕНИЕ

**НЕ ДЕПЛОИТЬ** текущую версию в production без исправления этих проблем.

**Estimated time to fix:** 4-6 часов разработки + 2-3 часа тестирования

---

**Architect:** Claude
**Review Status:** Готово к передаче Developer
**Priority:** 🔴 КРИТИЧЕСКИЙ
