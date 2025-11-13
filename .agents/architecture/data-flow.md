# Потоки данных (Data Flow)

**Роль:** Architect
**Фаза:** Phase 1 - Architecture
**Версия:** 1.0
**Статус:** ✅ Ready for review

---

## 1. Обзор

> **📌 ВАЖНО О КОДЕ В ДОКУМЕНТЕ:** Весь код, представленный в этом документе, является **ПСЕВДОКОДОМ / СПРАВОЧНЫМ МАТЕРИАЛОМ**. Он служит для ориентира и демонстрации подходов, но **НЕ ПРЕДНАЗНАЧЕН для прямого копирования** в реализацию. При этом код учитывает особенности и решения из предыдущей реализации, которые являются ответом на конкретные проблемы и сложности.

Этот документ детализирует потоки данных через систему Project Assistant, включая:
- Восходящую коммуникацию (участники → лиды)
- Нисходящую коммуникацию (лиды → участники)
- Обработку таймеров и периодических задач
- Обнаружение зависимостей между инициативами
- Обработку ошибок и edge cases

Все потоки оптимизированы для serverless окружения с учетом cold start и stateless природы функций.

---

## 2. Восходящая коммуникация (Upward Flow)

### 2.1 Поток: Участник отправляет отчет

```
┌─────────────┐
│ Participant │ Отправляет текстовое сообщение в Telegram
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ telegram-handler function   │ Entry point: module.exports.process
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Router.route()              │ Определяет: isTelegramWebhook() = true
└──────┬──────────────────────┘
       │
       ▼ (lazy load)
┌─────────────────────────────┐
│ TelegramHandler.handle()    │ Парсит message, определяет intent
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ DialogSystem.processMessage │ Определяет: это отчет или команда?
└──────┬──────────────────────┘
       │ (если отчет)
       ▼ (lazy load)
┌─────────────────────────────┐
│ ReportsBus.addRawReport()   │ Сохраняет raw отчет в YDB
│                             │ Table: reports, status: 'raw'
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ QueueClient.enqueue()       │ Публикует событие в YMQ
│                             │ Queue: ai-processing-queue
│                             │ Body: { reportIds: [...] }
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Response to Telegram        │ ctx.reply("✅ Отчет принят")
│ (быстрый ответ < 3 сек)     │
└─────────────────────────────┘
       │
       │ (асинхронная обработка)
       ▼
┌─────────────────────────────┐
│ ai-processor function       │ Triggered by YMQ
│ Entry point via Router      │
└──────┬──────────────────────┘
       │
       ▼ (lazy load)
┌─────────────────────────────┐
│ QueueHandler.handle()       │ Читает reportIds из очереди
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ReportsBus.processRawBatch()│ Batch обработка (до 20 отчетов)
│                             │ 1. Читает raw reports из YDB
│                             │ 2. Вызывает AI для структурирования
│                             │ 3. Сохраняет structured reports
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ReportsBus.emit('structured')│ Event: новые структурированные отчеты
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ SummaryGenerator.listen()   │ Подписан на 'structured' events
│                             │ Генерирует summary для лида
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ReportsBus.emit('summary')  │ Event: summary готов для отправки
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ NotificationRouter.listen() │ Подписан на 'summary' events
│                             │ Определяет кому отправить (лид)
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ TelegramBot.sendMessage()   │ Отправляет summary лиду
│                             │ "📊 Новые отчеты от команды..."
└─────────────────────────────┘
```

### 2.2 Пример кода потока

**telegram-handler/index.js** (entry point):
```javascript
const { Router } = require('../src/core/router');

module.exports.process = async function(event, context) {
    const router = new Router(event, context);
    return await router.route();
};
```

**src/handlers/telegram-handler.js**:
```javascript
class TelegramHandler {
    async handle(update) {
        const message = update.message;

        // Lazy load DialogSystem только когда нужно
        const { DialogSystem } = require('../modules/dialog-system');
        const dialogSystem = new DialogSystem();

        const result = await dialogSystem.processMessage(message);

        if (result.type === 'report') {
            // Lazy load ReportsBus
            const { ReportsBus } = require('../modules/reports-bus');
            const reportsBus = new ReportsBus();

            await reportsBus.addRawReport({
                workspaceId: result.workspaceId,
                userId: message.from.id,
                text: message.text,
                timestamp: Date.now()
            });

            return { reply: "✅ Отчет принят и будет обработан" };
        }

        // Другие типы сообщений...
    }
}
```

**src/modules/reports-bus.js**:
```javascript
class ReportsBus {
    async addRawReport({ workspaceId, userId, text, timestamp }) {
        // 1. Save to YDB
        const { ReportsDAO } = require('../dao/reports-dao');
        const reportsDAO = new ReportsDAO();

        const reportId = await reportsDAO.create({
            workspace_id: workspaceId, // partition key
            report_id: generateId(),
            user_id: userId,
            text: text,
            status: 'raw',
            created_at: timestamp
        });

        // 2. Enqueue for AI processing
        const { QueueClient } = require('../utils/queue-client');
        const queue = new QueueClient();

        await queue.enqueue('ai-processing-queue', {
            reportIds: [reportId],
            workspaceId: workspaceId
        });

        return reportId;
    }

    async processRawBatch(reportIds, workspaceId) {
        // 1. Fetch raw reports
        const { ReportsDAO } = require('../dao/reports-dao');
        const reportsDAO = new ReportsDAO();
        const reports = await reportsDAO.findByIds(reportIds, workspaceId);

        // 2. AI processing (batch)
        const { AIService } = require('../utils/ai-service');
        const ai = new AIService();
        const structured = await ai.structureReports(reports);

        // 3. Save structured
        await reportsDAO.updateBatch(structured.map(r => ({
            ...r,
            status: 'structured'
        })));

        // 4. Emit event
        this.emit('structured', { reportIds, workspaceId });
    }
}
```

### 2.3 Edge Cases

**2.3.1 AI обработка не удалась**
```javascript
try {
    await ai.structureReports(reports);
} catch (error) {
    // Fallback: сохраняем как plain text
    await reportsDAO.updateBatch(reports.map(r => ({
        ...r,
        status: 'structured',
        structured_data: { text: r.text, type: 'plain' },
        processing_error: error.message
    })));
}
```

**2.3.2 Очередь переполнена (throttling)**
```javascript
async addRawReport(...) {
    try {
        await queue.enqueue('ai-processing-queue', ...);
    } catch (error) {
        if (error.code === 'QueueThrottled') {
            // Retry with exponential backoff
            await retryWithBackoff(() => queue.enqueue(...), 3);
        }
    }
}
```

**2.3.3 Дубликаты сообщений (idempotency)**
```javascript
async addRawReport({ workspaceId, userId, text, timestamp }) {
    // Используем hash текста + timestamp как idempotency key
    const idempotencyKey = hash(text + timestamp);

    const existing = await reportsDAO.findByIdempotencyKey(idempotencyKey);
    if (existing) {
        return existing.report_id; // Уже обработан
    }

    // Сохраняем с idempotency_key
    return await reportsDAO.create({
        ...,
        idempotency_key: idempotencyKey
    });
}
```

---

## 3. Нисходящая коммуникация (Downward Flow)

### 3.1 Поток: Лид создает инициативу

```
┌─────────────┐
│    Lead     │ Отправляет команду /initiative "Запустить новый модуль"
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ telegram-handler function   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Router → TelegramHandler    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ DialogSystem.processMessage │ Распознает команду /initiative
└──────┬──────────────────────┘
       │
       ▼ (lazy load)
┌─────────────────────────────┐
│ InitiativeManager           │ Создает новую инициативу
│  .createInitiative()        │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ AI анализ зависимостей      │ Находит связанные инициативы/отчеты
│ DependencyDetector.analyze()│
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Сохранение в YDB            │ Table: initiatives
│ InitiativesDAO.create()     │ + dependencies в отдельную таблицу
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Формирование уведомлений    │ Определяет целевую аудиторию
│ NotificationRouter          │ (все участники workspace или фильтр)
│  .notifyAboutInitiative()   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Batch отправка через        │ Отправка всем участникам
│ TelegramBot.sendBatch()     │ "📋 Новая инициатива: ..."
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Установка таймера           │ Напоминание через N дней
│ TimerHandler.schedule()     │ для сбора feedback
└─────────────────────────────┘
```

### 3.2 Пример кода потока

**src/modules/initiative-manager.js**:
```javascript
class InitiativeManager {
    async createInitiative({ workspaceId, leadId, title, description, targetParticipants }) {
        // 1. AI анализ зависимостей
        const { DependencyDetector } = require('./dependency-detector');
        const detector = new DependencyDetector();

        const dependencies = await detector.analyze({
            workspaceId,
            text: title + ' ' + description
        });

        // 2. Сохранение инициативы
        const { InitiativesDAO } = require('../dao/initiatives-dao');
        const dao = new InitiativesDAO();

        const initiativeId = await dao.create({
            workspace_id: workspaceId,
            initiative_id: generateId(),
            lead_id: leadId,
            title: title,
            description: description,
            status: 'active',
            created_at: Date.now()
        });

        // 3. Сохранение зависимостей
        if (dependencies.length > 0) {
            await dao.saveDependencies(initiativeId, dependencies);
        }

        // 4. Уведомления участникам
        const { NotificationRouter } = require('./notification-router');
        const router = new NotificationRouter();

        await router.notifyAboutInitiative({
            workspaceId,
            initiativeId,
            targetParticipants, // или null = всем
            message: this.formatInitiativeMessage({ title, description, dependencies })
        });

        // 5. Установка таймера для feedback
        const { TimerHandler } = require('./timer-handler');
        const timer = new TimerHandler();

        await timer.schedule({
            type: 'initiative_feedback',
            executeAt: Date.now() + 3 * 24 * 60 * 60 * 1000, // +3 дня
            payload: { initiativeId, workspaceId }
        });

        return initiativeId;
    }

    formatInitiativeMessage({ title, description, dependencies }) {
        let msg = `📋 *Новая инициатива*\n\n`;
        msg += `${title}\n\n`;
        msg += `${description}\n\n`;

        if (dependencies.length > 0) {
            msg += `🔗 *Связанные инициативы/отчеты:*\n`;
            dependencies.forEach(dep => {
                msg += `- ${dep.title}\n`;
            });
        }

        return msg;
    }
}
```

### 3.3 Edge Cases

**3.3.1 Участник не в workspace**
```javascript
async notifyAboutInitiative({ workspaceId, targetParticipants, message }) {
    const { WorkspaceDAO } = require('../dao/workspace-dao');
    const dao = new WorkspaceDAO();

    // Проверяем membership
    const validParticipants = await dao.filterValidMembers(workspaceId, targetParticipants);

    // Отправляем только валидным
    await this.sendBatch(validParticipants, message);
}
```

**3.3.2 AI не нашел зависимости**
```javascript
const dependencies = await detector.analyze(...);
// dependencies может быть []
if (dependencies.length === 0) {
    // Это нормально, продолжаем без зависимостей
}
```

**3.3.3 Ошибка при отправке уведомления одному участнику**
```javascript
async sendBatch(participants, message) {
    const results = await Promise.allSettled(
        participants.map(p => this.telegram.sendMessage(p.chat_id, message))
    );

    // Логируем failed, но не прерываем весь batch
    results.forEach((result, idx) => {
        if (result.status === 'rejected') {
            logger.warn(`Failed to notify user ${participants[idx].user_id}: ${result.reason}`);
        }
    });
}
```

---

## 4. Обработка таймеров (Timer Processing Flow)

### 4.1 Поток: Периодический сбор отчетов

```
┌─────────────────────────────┐
│ Yandex Cloud Triggers       │ Cron: каждый день в 18:00
│ (Timer trigger)             │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ timer-scheduler function    │ Entry point: module.exports.process
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Router.route()              │ Определяет: isTimerTrigger() = true
└──────┬──────────────────────┘
       │
       ▼ (lazy load)
┌─────────────────────────────┐
│ TimerHandler.handle()       │ Читает тип задачи из payload
└──────┬──────────────────────┘
       │ (если type = 'daily_report_request')
       ▼ (lazy load)
┌─────────────────────────────┐
│ ReportCollector             │ Запрашивает отчеты у всех участников
│  .requestDailyReports()     │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ WorkspaceDAO.findAll()      │ Получает список всех активных workspaces
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Для каждого workspace:      │
│ WorkspaceDAO.getParticipants│ Получает участников
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ NotificationRouter          │ Отправляет запросы на отчеты
│  .sendReportRequest()       │ "⏰ Время ежедневного отчета!"
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ TimerHandler.schedule()     │ Устанавливает таймер на reminder
│                             │ Если нет ответа через 2 часа
└─────────────────────────────┘
```

### 4.2 Пример кода потока

**timer-scheduler/index.js** (entry point):
```javascript
const { Router } = require('../src/core/router');

module.exports.process = async function(event, context) {
    const router = new Router(event, context);
    return await router.route();
};
```

**src/modules/timer-handler.js**:
```javascript
class TimerHandler {
    async handle(event) {
        const { type, payload } = event;

        switch (type) {
            case 'daily_report_request':
                await this.handleDailyReportRequest();
                break;
            case 'report_reminder':
                await this.handleReportReminder(payload);
                break;
            case 'initiative_feedback':
                await this.handleInitiativeFeedback(payload);
                break;
            default:
                logger.warn(`Unknown timer type: ${type}`);
        }
    }

    async handleDailyReportRequest() {
        const { WorkspaceDAO } = require('../dao/workspace-dao');
        const dao = new WorkspaceDAO();

        // Получаем все активные workspaces
        const workspaces = await dao.findAllActive();

        for (const workspace of workspaces) {
            // Получаем участников
            const participants = await dao.getParticipants(workspace.workspace_id);

            // Отправляем запросы
            const { NotificationRouter } = require('./notification-router');
            const router = new NotificationRouter();

            await router.sendReportRequest({
                workspaceId: workspace.workspace_id,
                participants: participants,
                message: "⏰ Время ежедневного отчета! Как дела по проекту?"
            });

            // Устанавливаем reminder через 2 часа
            await this.schedule({
                type: 'report_reminder',
                executeAt: Date.now() + 2 * 60 * 60 * 1000,
                payload: {
                    workspaceId: workspace.workspace_id,
                    requestedAt: Date.now()
                }
            });
        }
    }

    async schedule({ type, executeAt, payload }) {
        const { TimersDAO } = require('../dao/timers-dao');
        const dao = new TimersDAO();

        await dao.create({
            timer_id: generateId(),
            type: type,
            execute_at: executeAt,
            payload: payload,
            status: 'scheduled'
        });

        // Также создаем Yandex Cloud Trigger для одноразового запуска
        // (или используем polling в timer-scheduler function)
    }
}
```

### 4.3 Edge Cases

**4.3.1 Workspace был удален между schedule и execute**
```javascript
async handleDailyReportRequest() {
    const workspaces = await dao.findAllActive();

    for (const workspace of workspaces) {
        try {
            // Проверяем что workspace все еще существует
            const exists = await dao.exists(workspace.workspace_id);
            if (!exists) continue;

            await router.sendReportRequest(...);
        } catch (error) {
            logger.error(`Failed for workspace ${workspace.workspace_id}:`, error);
            // Продолжаем со следующим workspace
        }
    }
}
```

**4.3.2 Таймер выполнился дважды (идемпотентность)**
```javascript
async handle(event) {
    const { timer_id } = event;

    // Проверяем статус таймера
    const timer = await dao.findById(timer_id);
    if (timer.status === 'executed') {
        logger.info(`Timer ${timer_id} already executed, skipping`);
        return;
    }

    // Выполняем задачу
    await this.executeTask(timer);

    // Отмечаем как выполненный
    await dao.updateStatus(timer_id, 'executed');
}
```

---

## 5. Обнаружение зависимостей (Dependency Detection Flow)

### 5.1 Поток: AI анализ связей

```
┌─────────────────────────────┐
│ InitiativeManager           │ Создание новой инициативы
│  .createInitiative()        │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ DependencyDetector          │ AI анализ текста инициативы
│  .analyze()                 │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ 1. Поиск похожих инициатив  │
│ InitiativesDAO              │ Vector search или keyword search
│  .findSimilar()             │ по workspace_id
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ 2. Поиск релевантных отчетов│
│ ReportsDAO.findByKeywords() │ Ищем отчеты с похожими темами
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ 3. AI классификация связей  │ Определяет тип зависимости:
│ AIService.classifyDeps()    │ - blocks / blocked_by
│                             │ - relates_to
│                             │ - based_on (отчет → инициатива)
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ 4. Фильтрация по confidence │ Порог: confidence > 0.7
│                             │ Отбрасываем слабые связи
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Return dependencies[]       │ Список зависимостей с метаданными
└─────────────────────────────┘
```

### 5.2 Пример кода потока

**src/modules/dependency-detector.js**:
```javascript
class DependencyDetector {
    async analyze({ workspaceId, text }) {
        // 1. Поиск похожих инициатив
        const { InitiativesDAO } = require('../dao/initiatives-dao');
        const initiativesDAO = new InitiativesDAO();

        const similarInitiatives = await initiativesDAO.findSimilar({
            workspace_id: workspaceId,
            query: text,
            limit: 10
        });

        // 2. Поиск релевантных отчетов
        const { ReportsDAO } = require('../dao/reports-dao');
        const reportsDAO = new ReportsDAO();

        const relevantReports = await reportsDAO.findByKeywords({
            workspace_id: workspaceId,
            keywords: this.extractKeywords(text),
            limit: 20
        });

        // 3. AI классификация
        const { AIService } = require('../utils/ai-service');
        const ai = new AIService();

        const dependencies = await ai.classifyDependencies({
            currentText: text,
            candidates: [
                ...similarInitiatives.map(i => ({ type: 'initiative', ...i })),
                ...relevantReports.map(r => ({ type: 'report', ...r }))
            ]
        });

        // 4. Фильтрация по confidence
        const filtered = dependencies.filter(dep => dep.confidence > 0.7);

        return filtered;
    }

    extractKeywords(text) {
        // Простая экстракция ключевых слов (можно улучшить)
        const stopWords = ['и', 'в', 'на', 'с', 'для', 'по'];
        return text
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word));
    }
}
```

**src/utils/ai-service.js** (пример AI prompt):
```javascript
async classifyDependencies({ currentText, candidates }) {
    const prompt = `
Текст новой инициативы:
"${currentText}"

Кандидаты на зависимости:
${candidates.map((c, i) => `${i+1}. [${c.type}] ${c.title || c.text}`).join('\n')}

Определи какие из кандидатов связаны с новой инициативой.
Для каждой связи укажи:
- id кандидата
- тип связи: blocks (блокирует), blocked_by (заблокирована), relates_to (связана), based_on (основана на отчете)
- confidence (0-1)
- explanation (краткое пояснение)

Верни JSON массив.
`;

    const response = await this.llm.generate(prompt);
    return JSON.parse(response);
}
```

### 5.3 Edge Cases

**5.3.1 AI вернул невалидный JSON**
```javascript
try {
    const dependencies = JSON.parse(response);
} catch (error) {
    logger.error('AI returned invalid JSON:', response);
    return []; // Fallback: без зависимостей
}
```

**5.3.2 Нет похожих инициатив/отчетов**
```javascript
const similarInitiatives = await initiativesDAO.findSimilar(...);
const relevantReports = await reportsDAO.findByKeywords(...);

if (similarInitiatives.length === 0 && relevantReports.length === 0) {
    return []; // Нет кандидатов для анализа
}
```

**5.3.3 AI слишком оптимистичен (все confidence > 0.9)**
```javascript
// Дополнительная валидация: не более N зависимостей
const MAX_DEPENDENCIES = 5;
const sorted = filtered.sort((a, b) => b.confidence - a.confidence);
return sorted.slice(0, MAX_DEPENDENCIES);
```

---

## 6. Обработка ошибок (Error Handling Flow)

### 6.1 Стратегия обработки ошибок

| Тип ошибки | Стратегия | Fallback |
|------------|-----------|----------|
| **Network timeout** (Telegram API) | Retry 3 раза с exp backoff | Сохранить в queue для повтора |
| **AI API error** | Retry 2 раза | Fallback на упрощенную логику |
| **YDB throttling** | Exponential backoff | Отложить в queue |
| **Invalid user input** | Валидация + человеко-понятное сообщение | Просьба повторить |
| **Function timeout** (10 мин) | Разбить на batch + queue | Частичный результат + продолжить позже |

### 6.2 Пример: Graceful degradation при AI ошибке

```javascript
async processRawBatch(reportIds, workspaceId) {
    try {
        // Попытка AI обработки
        const structured = await ai.structureReports(reports);
        await reportsDAO.updateBatch(structured);
    } catch (error) {
        if (error.code === 'AI_API_ERROR') {
            logger.warn('AI failed, using fallback plain text structure');

            // Fallback: сохраняем как plain text
            const fallback = reports.map(r => ({
                report_id: r.report_id,
                structured_data: {
                    type: 'plain',
                    text: r.text,
                    fallback: true
                },
                status: 'structured'
            }));

            await reportsDAO.updateBatch(fallback);

            // Все равно отправляем summary лиду (просто менее структурированный)
            this.emit('structured', { reportIds, workspaceId });
        } else {
            throw error; // Неизвестная ошибка - пробрасываем
        }
    }
}
```

### 6.3 Мониторинг и алерты

```javascript
// В каждом критическом месте логируем метрики
class MetricsLogger {
    static logError(errorType, context) {
        console.error(JSON.stringify({
            level: 'error',
            type: errorType,
            timestamp: Date.now(),
            ...context
        }));

        // Yandex Cloud Logging автоматически парсит JSON
        // Можно настроить алерты на частоту ошибок
    }
}

// Пример использования
try {
    await ai.structureReports(reports);
} catch (error) {
    MetricsLogger.logError('AI_PROCESSING_FAILED', {
        workspaceId,
        reportCount: reports.length,
        error: error.message
    });
    // ... fallback logic
}
```

---

## 7. Диаграмма всех потоков (Overview)

```
┌──────────────────────────────────────────────────────────────────┐
│                      TELEGRAM USERS                              │
│  (Participants & Leads)                                          │
└────────┬──────────────────────────────────────────┬──────────────┘
         │                                          │
         │ Webhooks                                 │ Bot sends
         ▼                                          ▼
┌─────────────────────┐                   ┌─────────────────────┐
│ telegram-handler    │◄──────────────────┤  NotificationRouter │
│ (serverless func)   │   lazy loads      └──────────▲──────────┘
└──────────┬──────────┘                              │
           │                                         │
           ▼                                         │
     ┌─────────┐                                     │
     │ Router  │                                     │
     └────┬────┘                                     │
          │                                          │
          ├─────► TelegramHandler ──► DialogSystem  │
          │                               │          │
          │                               ▼          │
          │                          ReportsBus      │
          │                               │          │
          │                               ▼          │
          │                        ┌──────────────┐  │
          │                        │ YMQ Queue    │  │
          │                        └──────┬───────┘  │
          │                               │          │
          ▼                               ▼          │
┌─────────────────────┐         ┌─────────────────────┐
│ timer-scheduler     │         │ ai-processor        │
│ (serverless func)   │         │ (serverless func)   │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           ▼                               ▼
     TimerHandler                   QueueHandler
           │                               │
           │                               ▼
           │                         ReportsBus
           │                         .processRawBatch()
           │                               │
           │                               ▼
           │                         ┌──────────────┐
           │                         │ AI Service   │
           │                         │ (LangChain)  │
           │                         └──────┬───────┘
           │                                │
           │                                ▼
           │                         SummaryGenerator ─────┘
           │                                │
           ▼                                ▼
    ReportCollector              DependencyDetector
           │                                │
           │                                ▼
           └─────────────────►  InitiativeManager
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │     YDB      │
                                    │ (serverless) │
                                    └──────────────┘
                                     - workspaces
                                     - users
                                     - reports
                                     - initiatives
                                     - dependencies
                                     - timers
```

---

## 8. Чеклист для Developer

При реализации потоков данных проверьте:

- [ ] **Idempotency**: Повторный вызов функции с теми же параметрами не создает дубликатов
- [ ] **Lazy loading**: Модули загружаются только когда нужны (оптимизация cold start)
- [ ] **Partition keys**: Все запросы к YDB используют `workspace_id` как partition key
- [ ] **Error handling**: Каждый внешний вызов (AI, Telegram, YDB) обернут в try/catch
- [ ] **Graceful degradation**: Есть fallback при сбое AI или внешних сервисов
- [ ] **Retry logic**: Network errors retry с exponential backoff
- [ ] **Timeouts**: Все async операции имеют timeout (не превышают лимит функции)
- [ ] **Logging**: Критические точки логируют метрики в structured format
- [ ] **Batch processing**: Операции группируются для эффективности (AI, notifications)
- [ ] **Event-driven**: Используется ReportsBus для асинхронной обработки

---

**Status:** ✅ Ready for review
**Next step:** Create `tech-stack.md` (последний файл Phase 1)
