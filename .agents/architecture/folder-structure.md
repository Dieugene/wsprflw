# Folder Structure: Проектный Ассистент

**Дата:** 2024-11-06
**Версия:** 1.0.0
**Автор:** Architect
**Статус:** Draft

---

## 1. Общая структура

> **📌 ВАЖНО О КОДЕ В ДОКУМЕНТЕ:** Весь код, представленный в этом документе, является **ПСЕВДОКОДОМ / СПРАВОЧНЫМ МАТЕРИАЛОМ**. Он служит для ориентира и демонстрации подходов, но **НЕ ПРЕДНАЗНАЧЕН для прямого копирования** в реализацию. При этом код учитывает особенности и решения из предыдущей реализации, которые являются ответом на конкретные проблемы и сложности.

```
kak-dela-dialog-bot/
├── functions/                    # Serverless functions (точки входа)
│   ├── telegram-handler/         # Main function для Telegram webhook
│   ├── ai-processor/             # Function для AI batch processing
│   └── timer-scheduler/          # Function для периодических задач
│
├── src/                          # Основной исходный код
│   ├── core/                     # Core системы
│   ├── modules/                  # Бизнес-логика модулей
│   ├── handlers/                 # Handlers для разных источников
│   ├── dao/                      # Database Access Objects
│   └── utils/                    # Вспомогательные функции
│
├── tests/                        # Тесты
│   ├── unit/                     # Unit-тесты модулей
│   ├── integration/              # Integration тесты
│   └── mocks/                    # Моки для тестов
│
├── config/                       # Конфигурация
│   ├── yandex-cloud/             # Yandex Cloud конфиги
│   └── environment/              # Environment variables
│
├── docs/                         # Документация
│   ├── api/                      # API документация
│   └── deployment/               # Deployment инструкции
│
├── legacy/                       # Старый код (reference)
│
├── .agents/                      # Agent-based development
│   ├── roles/                    # Роли агентов
│   ├── workflow/                 # Процессы разработки
│   ├── architecture/             # Архитектурные документы
│   └── specs/                    # Спецификации модулей
│
├── project assistant description/ # Требования
│
├── package.json                  # NPM dependencies
├── package-lock.json
├── .gitignore
└── README.md
```

---

## 2. Serverless Functions (`functions/`)

### 2.1 `functions/telegram-handler/`

**Назначение:** Main function для обработки Telegram webhook

**Структура:**
```
functions/telegram-handler/
├── index.js                      # Entry point (экспортирует process())
├── package.json                  # Dependencies для этой функции
└── README.md                     # Описание функции
```

**index.js:**
```javascript
// Минимальные импорты для fast cold start
const { Router } = require('../../src/core/router');

module.exports.process = async function(inputData) {
    const router = new Router(inputData);
    return await router.route();
};
```

**package.json (специфичный для функции):**
```json
{
  "name": "telegram-handler",
  "dependencies": {
    "telegraf": "^4.16.3",
    "@dieugene/utils": "^1.16.3"
  }
}
```

---

### 2.2 `functions/ai-processor/`

**Назначение:** Function для AI batch processing (структуризация отчетов, генерация сводок)

**Структура:**
```
functions/ai-processor/
├── index.js                      # Entry point
├── package.json                  # Dependencies (включая AI libs)
└── README.md
```

**index.js:**
```javascript
const { AIProcessor } = require('../../src/handlers/ai-processor');

module.exports.process = async function(inputData) {
    return await AIProcessor.process(inputData);
};
```

**package.json:**
```json
{
  "name": "ai-processor",
  "dependencies": {
    "@langchain/core": "^0.3.61",
    "@dialogai/dialog-class": "^2.1.8",
    "@dieugene/utils": "^1.16.3",
    "@dieugene/ydb-serverless": "^1.0.0"
  }
}
```

---

### 2.3 `functions/timer-scheduler/`

**Назначение:** Function для периодических задач (cron)

**Структура:**
```
functions/timer-scheduler/
├── index.js                      # Entry point
├── package.json
└── README.md
```

**index.js:**
```javascript
const { TimerHandler } = require('../../src/modules/timer-handler');

module.exports.process = async function(inputData) {
    return await TimerHandler.invoke(inputData);
};
```

---

## 3. Source Code (`src/`)

### 3.1 `src/core/` - Core системы

**Назначение:** Базовые компоненты, используемые везде

**Структура:**
```
src/core/
├── router.js                     # Router для определения источника запроса
├── session-manager.js            # Session management (locking)
├── auth.js                       # Authentication/Authorization
└── config.js                     # Configuration loader
```

**router.js:**
```javascript
/**
 * Router для определения источника запроса и направления в handler
 */
class Router {
    constructor(inputData) { ... }
    async route() { ... }
    isTelegramWebhook() { ... }
    isMessageQueue() { ... }
    isTimerTrigger() { ... }
}

module.exports = { Router };
```

---

### 3.2 `src/modules/` - Бизнес-логика модулей

**Назначение:** Основные модули системы (по одному файлу на модуль)

**Структура:**
```
src/modules/
├── reports-bus.js                # ReportsBus (Priority 1)
├── dialog-system.js              # DialogSystem (Priority 1)
├── timer-handler.js              # TimerHandler (Priority 1)
├── workspace-manager.js          # WorkspaceManager (Priority 1)
├── summary-generator.js          # SummaryGenerator (Priority 2)
├── notification-router.js        # NotificationRouter (Priority 2)
├── initiatives-tracker.js        # InitiativesTracker (Priority 2)
├── dependency-detector.js        # DependencyDetector (Priority 2)
├── yougile-sync.js               # YouGileSync (Priority 3)
├── jira-sync.js                  # JiraSync (Priority 3)
├── dashboard-generator.js        # DashboardGenerator (Priority 4)
└── ai-insights.js                # AIInsights (Priority 4)
```

**Пример структуры модуля (`reports-bus.js`):**
```javascript
/**
 * ReportsBus - централизованная шина для обработки отчетов
 * @module ReportsBus
 */

const I = require("@dieugene/utils");
const { YdbDao } = require("../dao/ydb-dao");

/**
 * Добавляет raw отчет в шину
 * @param {string} workspace_id
 * @param {string} user_uuid
 * @param {Object} report_data
 * @returns {Promise<boolean>}
 */
async function addRawReport(workspace_id, user_uuid, report_data) {
    // Implementation
}

/**
 * Получает raw отчеты после указанной даты
 * @param {string} workspace_id
 * @param {number} after_timestamp
 * @returns {Promise<Array>}
 */
async function getRawReports(workspace_id, after_timestamp) {
    // Implementation
}

module.exports = {
    addRawReport,
    getRawReports,
    // ... other exports
};
```

---

### 3.3 `src/handlers/` - Handlers для разных источников

**Назначение:** Обработчики для различных источников запросов

**Структура:**
```
src/handlers/
├── telegram-handler.js           # Обработка Telegram webhook
├── queue-handler.js              # Обработка сообщений из очереди
├── ai-processor.js               # AI batch processing handler
└── admin-handler.js              # Admin API handler
```

**telegram-handler.js:**
```javascript
/**
 * TelegramHandler - обработка Telegram webhook
 */
const { Telegraf } = require('telegraf');
const { ReportsBus } = require('../modules/reports-bus');
const { DialogSystem } = require('../modules/dialog-system');

class TelegramHandler {

    static async process(inputData) {
        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

        // Setup handlers
        bot.on('text', async (ctx) => {
            // Lazy load модули только когда нужно
            await this.handleText(ctx);
        });

        bot.on('voice', async (ctx) => {
            await this.handleVoice(ctx);
        });

        await bot.handleUpdate(inputData.data.object);
    }

    static async handleText(ctx) {
        // Lazy import
        const { ReportsBus } = require('../modules/reports-bus');
        // Handle text message
    }
}

module.exports = { TelegramHandler };
```

---

### 3.4 `src/dao/` - Database Access Objects

**Назначение:** Абстракция работы с базой данных

**Структура:**
```
src/dao/
├── ydb-dao.js                    # YDB Data Access Object
├── reports-dao.js                # DAO для таблицы reports
├── summaries-dao.js              # DAO для таблицы summaries
├── initiatives-dao.js            # DAO для таблицы initiatives
└── workspaces-dao.js             # DAO для таблицы workspaces
```

**ydb-dao.js (base):**
```javascript
/**
 * YDB базовый DAO
 */
const ydb_serverless = require("@dieugene/ydb-serverless");

class YdbDao {
    constructor() {
        this.ydb = null;
    }

    init(database_url) {
        if (!this.ydb) {
            this.ydb = ydb_serverless.init(database_url);
        }
    }

    async execute(query, params) {
        return await this.ydb.execute(query, params);
    }
}

module.exports = { YdbDao };
```

**reports-dao.js:**
```javascript
/**
 * DAO для таблицы reports
 */
const { YdbDao } = require('./ydb-dao');

class ReportsDao extends YdbDao {

    async insertRawReport(workspace_id, user_uuid, data) {
        const query = `
            DECLARE $workspace_id as Utf8;
            DECLARE $user_uuid as Utf8;
            DECLARE $created_at as Uint64;
            DECLARE $data as Json;
            DECLARE $type as Utf8;

            UPSERT INTO reports (workspace_id, user_uuid, created_at, data, type)
            VALUES ($workspace_id, $user_uuid, $created_at, $data, $type);
        `;

        return await this.execute(query, {
            '$workspace_id': workspace_id,
            '$user_uuid': user_uuid,
            '$created_at': Date.now() / 1000,
            '$data': JSON.stringify(data),
            '$type': 'raw'
        });
    }

    async getRawReports(workspace_id, after_timestamp) {
        const query = `
            DECLARE $workspace_id as Utf8;
            DECLARE $after_timestamp as Uint64;
            DECLARE $type as Utf8;

            SELECT * FROM reports
            WHERE workspace_id = $workspace_id
              AND created_at > $after_timestamp
              AND type = $type
            ORDER BY created_at ASC;
        `;

        return await this.execute(query, {
            '$workspace_id': workspace_id,
            '$after_timestamp': after_timestamp,
            '$type': 'raw'
        });
    }
}

module.exports = { ReportsDao };
```

---

### 3.5 `src/utils/` - Вспомогательные функции

**Назначение:** Shared утилиты, используемые в разных модулях

**Структура:**
```
src/utils/
├── telegram-utils.js             # Telegram специфичные утилиты
├── ai-utils.js                   # AI/LangChain утилиты
├── queue-utils.js                # Message Queue утилиты
└── validation-utils.js           # Валидация данных
```

---

## 4. Tests (`tests/`)

### 4.1 `tests/unit/` - Unit-тесты

**Структура:** Зеркало `src/modules/`

```
tests/unit/
├── reports-bus.test.js           # Тесты для ReportsBus
├── dialog-system.test.js         # Тесты для DialogSystem
├── timer-handler.test.js         # Тесты для TimerHandler
├── workspace-manager.test.js     # Тесты для WorkspaceManager
└── ...
```

**Пример (`reports-bus.test.js`):**
```javascript
const { addRawReport } = require('../../src/modules/reports-bus');
const { ReportsDao } = require('../../src/dao/reports-dao');

jest.mock('../../src/dao/reports-dao');

describe('ReportsBus', () => {
    describe('addRawReport', () => {
        test('should add raw report successfully', async () => {
            // Arrange
            const workspace_id = 'ws_123';
            const user_uuid = 'user_456';
            const report_data = { message: 'Test report' };

            ReportsDao.prototype.insertRawReport.mockResolvedValue(true);

            // Act
            const result = await addRawReport(workspace_id, user_uuid, report_data);

            // Assert
            expect(result).toBe(true);
        });
    });
});
```

---

### 4.2 `tests/integration/` - Integration тесты

**Структура:**

```
tests/integration/
├── report-to-summary-flow.test.js    # End-to-end: отчет → сводка
├── decision-to-notification.test.js  # End-to-end: решение → уведомления
├── timer-batch-processing.test.js    # Timer → batch processing
└── ...
```

---

### 4.3 `tests/mocks/` - Моки

**Структура:**

```
tests/mocks/
├── telegram-mock.js              # Mock для Telegram API
├── ydb-mock.js                   # Mock для YDB
├── ai-mock.js                    # Mock для AI/LangChain
└── queue-mock.js                 # Mock для Message Queue
```

---

## 5. Config (`config/`)

### 5.1 `config/yandex-cloud/`

**Назначение:** Конфигурация для Yandex Cloud Functions

**Структура:**
```
config/yandex-cloud/
├── telegram-handler.yaml         # Config для telegram-handler function
├── ai-processor.yaml             # Config для ai-processor function
├── timer-scheduler.yaml          # Config для timer-scheduler function
└── triggers/
    └── daily-summary-trigger.yaml # Cron trigger config
```

**Пример (`telegram-handler.yaml`):**
```yaml
name: telegram-handler
runtime: nodejs18
entrypoint: index.process
memory: 256
timeout: 30s
environment:
  TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
  YDB_ENDPOINT: ${YDB_ENDPOINT}
  YDB_DATABASE: ${YDB_DATABASE}
```

---

### 5.2 `config/environment/`

**Назначение:** Environment variables для разных окружений

**Структура:**
```
config/environment/
├── .env.development              # Development environment
├── .env.staging                  # Staging environment
└── .env.production               # Production environment (template)
```

---

## 6. Docs (`docs/`)

**Структура:**
```
docs/
├── api/
│   ├── reports-bus-api.md        # API документация ReportsBus
│   ├── dialog-system-api.md
│   └── ...
│
└── deployment/
    ├── yandex-cloud-setup.md     # Инструкции по setup Yandex Cloud
    ├── database-migrations.md    # YDB migrations
    └── ci-cd-setup.md            # CI/CD pipeline setup
```

---

## 7. Правила организации кода

### 7.1 Именование файлов

- **Модули:** `kebab-case` (например: `reports-bus.js`)
- **Классы:** `PascalCase` внутри файлов (например: `class ReportsDao`)
- **Тесты:** Имя модуля + `.test.js` (например: `reports-bus.test.js`)

### 7.2 Экспорты

**Модули экспортируют функции:**
```javascript
// ✅ Хорошо
module.exports = {
    addRawReport,
    getRawReports
};

// ❌ Плохо
module.exports = ReportsBus; // класс вместо функций
```

**DAO экспортируют классы:**
```javascript
// ✅ Хорошо
module.exports = { ReportsDao };
```

### 7.3 Импорты

**В serverless functions (минимальные):**
```javascript
// Только critical imports
const { Router } = require('../../src/core/router');
```

**В handlers (lazy imports):**
```javascript
// Импортируем только когда нужно
async function handleReport(ctx) {
    const { ReportsBus } = require('../modules/reports-bus');
    // use ReportsBus
}
```

**В модулях (обычные imports):**
```javascript
// Импортируем в начале файла
const { ReportsDao } = require('../dao/reports-dao');
const I = require("@dieugene/utils");
```

---

## 8. Dependencies management

### 8.1 Root `package.json`

**Назначение:** Dev dependencies и общие dependencies

```json
{
  "name": "reference-project",
  "version": "1.0.0",
  "devDependencies": {
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  },
  "dependencies": {
    "@dieugene/utils": "^1.16.3",
    "@dieugene/ydb-serverless": "^1.0.0",
    "telegraf": "^4.16.3"
  }
}
```

### 8.2 Function-specific `package.json`

Каждая serverless function имеет свой `package.json` с минимальными dependencies для оптимизации bundle size.

---

## 9. Git structure

### 9.1 Branches

```
main                              # Production
├─ staging                        # Staging environment
├─ develop                        # Development branch
└─ feature/module-name            # Feature branches
```

### 9.2 .gitignore

```
node_modules/
.env
.env.production
*.log
.DS_Store
dist/
coverage/
```

---

## 10. Пример полной структуры (expandable)

```
kak-dela-dialog-bot/
│
├── functions/
│   ├── telegram-handler/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── ai-processor/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── timer-scheduler/
│       ├── index.js
│       ├── package.json
│       └── README.md
│
├── src/
│   ├── core/
│   │   ├── router.js
│   │   ├── session-manager.js
│   │   ├── auth.js
│   │   └── config.js
│   │
│   ├── modules/
│   │   ├── reports-bus.js
│   │   ├── dialog-system.js
│   │   ├── timer-handler.js
│   │   ├── workspace-manager.js
│   │   ├── summary-generator.js
│   │   ├── notification-router.js
│   │   ├── initiatives-tracker.js
│   │   ├── dependency-detector.js
│   │   ├── yougile-sync.js
│   │   ├── jira-sync.js
│   │   ├── dashboard-generator.js
│   │   └── ai-insights.js
│   │
│   ├── handlers/
│   │   ├── telegram-handler.js
│   │   ├── queue-handler.js
│   │   ├── ai-processor.js
│   │   └── admin-handler.js
│   │
│   ├── dao/
│   │   ├── ydb-dao.js
│   │   ├── reports-dao.js
│   │   ├── summaries-dao.js
│   │   ├── initiatives-dao.js
│   │   └── workspaces-dao.js
│   │
│   └── utils/
│       ├── telegram-utils.js
│       ├── ai-utils.js
│       ├── queue-utils.js
│       └── validation-utils.js
│
├── tests/
│   ├── unit/
│   │   ├── reports-bus.test.js
│   │   ├── dialog-system.test.js
│   │   └── ...
│   │
│   ├── integration/
│   │   ├── report-to-summary-flow.test.js
│   │   └── ...
│   │
│   └── mocks/
│       ├── telegram-mock.js
│       ├── ydb-mock.js
│       └── ai-mock.js
│
├── config/
│   ├── yandex-cloud/
│   │   ├── telegram-handler.yaml
│   │   ├── ai-processor.yaml
│   │   ├── timer-scheduler.yaml
│   │   └── triggers/
│   │       └── daily-summary-trigger.yaml
│   │
│   └── environment/
│       ├── .env.development
│       ├── .env.staging
│       └── .env.production
│
├── docs/
│   ├── api/
│   └── deployment/
│
├── legacy/                       # Старый код (reference)
│
├── .agents/                      # Agent-based development
│   ├── roles/
│   ├── workflow/
│   ├── architecture/
│   └── specs/
│
├── project assistant description/
│
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

**Status:** ✅ Ready for review
**Next step:** Create `data-flow.md`
