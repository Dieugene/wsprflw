# Технологический стек (Tech Stack)

**Роль:** Architect
**Фаза:** Phase 1 - Architecture
**Версия:** 1.0
**Статус:** ✅ Ready for review

---

## 1. Обзор

> **📌 ВАЖНО О КОДЕ В ДОКУМЕНТЕ:** Весь код, представленный в этом документе, является **ПСЕВДОКОДОМ / СПРАВОЧНЫМ МАТЕРИАЛОМ**. Он служит для ориентира и демонстрации подходов, но **НЕ ПРЕДНАЗНАЧЕН для прямого копирования** в реализацию. При этом код учитывает особенности и решения из предыдущей реализации, которые являются ответом на конкретные проблемы и сложности.

Этот документ описывает выбранные технологии для Project Assistant бота с обоснованием выбора каждой.

**Ключевые критерии выбора:**
- Совместимость с Yandex Cloud Serverless Functions
- Минимизация cold start времени
- Поддержка TypeScript/JavaScript (Node.js runtime)
- Простота интеграции и поддержки
- Cost-эффективность для SaaS модели

---

## 2. Runtime & Core

### 2.1 Node.js 18.x

**Что:** JavaScript runtime для serverless функций

**Почему:**
- Официально поддерживается Yandex Cloud Functions
- Async/await из коробки для асинхронных операций
- Богатая экосистема npm пакетов
- Легкий и быстрый для cold start (по сравнению с JVM/Python с тяжелыми зависимостями)

**Альтернативы:**
- Python 3.11: медленнее на cold start, но проще для AI/ML
- Go: быстрее, но менее гибкий для быстрой разработки

**Решение:** Node.js 18.x как баланс скорости и гибкости

### 2.2 JavaScript (не TypeScript)

**Что:** Язык разработки

**Почему:**
- Нет необходимости в build step (TypeScript → JavaScript)
- Быстрее cold start (не нужна транспиляция)
- Проще CI/CD (прямой deploy без сборки)
- Достаточно JSDoc для type hints в IDE

**Компромисс:**
- Меньше type safety → компенсируем тщательным тестированием
- Используем JSDoc для документации типов:

```javascript
/**
 * @param {Object} params
 * @param {string} params.workspaceId - Workspace ID
 * @param {string} params.userId - User ID
 * @param {string} params.text - Report text
 * @returns {Promise<string>} Report ID
 */
async function createReport({ workspaceId, userId, text }) {
    // ...
}
```

---

## 3. Yandex Cloud Services

### 3.1 Yandex Cloud Functions

**Что:** Serverless compute платформа

**Конфигурация:**
- **Memory:** 512 MB (telegram-handler), 1024 MB (ai-processor)
- **Timeout:** 30 sec (telegram-handler), 300 sec (ai-processor)
- **Concurrency:** 10 simultaneous executions per function

**Entry point pattern:**
```javascript
module.exports.process = async function(event, context) {
    // event: входные данные (webhook, queue message, timer)
    // context: metadata (requestId, token, etc.)
    return { statusCode: 200, body: JSON.stringify(result) };
};
```

### 3.2 Yandex Database (YDB)

**Что:** Serverless NoSQL database

**Почему:**
- Автоматический scaling (от 0 до infinity)
- Оплата только за фактическое использование (on-demand режим)
- Поддержка транзакций и secondary indexes
- Встроенная multi-tenant изоляция через partition keys

**Режим:** Serverless (on-demand)

**Схема таблиц:**

```javascript
// Пример: таблица reports
{
    TableName: 'reports',
    PartitionKey: 'workspace_id',  // Multi-tenant isolation
    SortKey: 'report_id',
    Attributes: {
        workspace_id: 'String',
        report_id: 'String',
        user_id: 'String',
        text: 'String',
        structured_data: 'JsonDocument',
        status: 'String',  // 'raw', 'structured'
        created_at: 'Uint64',
        idempotency_key: 'String'
    },
    GlobalSecondaryIndexes: [
        {
            IndexName: 'by_user_and_date',
            PartitionKey: 'user_id',
            SortKey: 'created_at'
        }
    ]
}
```

**Основные таблицы:**
1. `workspaces` - организации и workspace'ы
2. `users` - пользователи и их роли
3. `reports` - отчеты участников
4. `initiatives` - инициативы лидов
5. `dependencies` - связи между инициативами/отчетами
6. `timers` - запланированные задачи
7. `sessions` - состояния диалогов (short TTL)

### 3.3 Yandex Message Queue (YMQ)

**Что:** Serverless очередь сообщений (аналог AWS SQS)

**Использование:**
- `ai-processing-queue` - батч обработка отчетов AI
- `notifications-queue` - массовые уведомления
- `dlq` (Dead Letter Queue) - неуспешные сообщения

**Конфигурация:**
```javascript
{
    QueueName: 'ai-processing-queue',
    VisibilityTimeout: 300,  // 5 минут
    MessageRetentionPeriod: 86400,  // 1 день
    ReceiveMessageWaitTimeSeconds: 20,  // Long polling
    DeadLetterQueue: {
        QueueName: 'dlq',
        maxReceiveCount: 3  // После 3 неудачных попыток → DLQ
    }
}
```

### 3.4 Yandex Cloud Triggers

**Что:** Event-driven запуск функций

**Типы:**
1. **Timer Trigger** - Cron-подобные задачи
   ```yaml
   trigger:
     type: timer
     schedule: "0 18 * * *"  # Каждый день в 18:00
     function: timer-scheduler
   ```

2. **Message Queue Trigger** - Обработка сообщений из YMQ
   ```yaml
   trigger:
     type: message-queue
     queue: ai-processing-queue
     batch-size: 10
     function: ai-processor
   ```

3. **HTTP Trigger** - Webhook для Telegram
   ```yaml
   trigger:
     type: http
     function: telegram-handler
   ```

### 3.5 Yandex Lockbox (Secrets)

**Что:** Хранение секретов

**Secrets:**
- `TELEGRAM_BOT_TOKEN` - токен бота
- `YDB_ENDPOINT` - endpoint YDB
- `YDB_DATABASE` - путь к базе данных
- `AI_API_KEY` - ключ для AI сервиса
- `YMQ_ACCESS_KEY_ID` - доступ к очереди
- `YMQ_SECRET_ACCESS_KEY` - секрет очереди

**Доступ в коде:**
```javascript
const { LockboxClient } = require('@yandex-cloud/nodejs-sdk');

async function getSecret(secretId) {
    const client = new LockboxClient();
    const secret = await client.get(secretId);
    return secret.entries.find(e => e.key === 'value').textValue;
}
```

---

## 4. AI & LangChain

### 4.1 LangChain.js

**Что:** Framework для AI-powered приложений

**Почему:**
- Унифицированный интерфейс для разных LLM провайдеров
- Встроенные инструменты (Tools) для function calling
- Chain-based композиция для сложных сценариев
- Активное комьюнити и частые обновления

**Версия:** `^0.1.0` (latest stable)

**Основные модули:**
```javascript
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { PromptTemplate } = require('langchain/prompts');
const { LLMChain } = require('langchain/chains');
const { DynamicTool } = require('langchain/tools');
```

### 4.2 AI Provider: YandexGPT или OpenAI

**Опция 1: YandexGPT** (рекомендуется для production)
- **Плюсы:** Локальный провайдер, низкая latency, интеграция с Yandex Cloud
- **Минусы:** Меньше функциональности чем OpenAI

**Опция 2: OpenAI GPT-5**
- **Плюсы:** Лучшее качество, function calling, больше возможностей
- **Минусы:** Выше latency, нужен прокси для РФ, дороже

**Решение для MVP:** OpenAI GPT-5 (качество важнее latency для сложных задач)

**Интеграция:**
```javascript
const { ChatOpenAI } = require('langchain/chat_models/openai');

class AIService {
    constructor() {
        // Lazy initialization
        this.llm = null;
    }

    getLLM() {
        if (!this.llm) {
            this.llm = new ChatOpenAI({
                modelName: 'gpt-5',
                temperature: 0.3,  // Более детерминированные ответы
                maxTokens: 2000,
                timeout: 30000
            });
        }
        return this.llm;
    }

    async structureReports(reports) {
        const llm = this.getLLM();
        const prompt = PromptTemplate.fromTemplate(`
            Структурируй следующие отчеты участников:
            {reports}

            Извлеки: тип активности, статус, блокеры, следующие шаги.
            Верни JSON массив.
        `);

        const chain = new LLMChain({ llm, prompt });
        const result = await chain.call({ reports: JSON.stringify(reports) });
        return JSON.parse(result.text);
    }
}
```

### 4.3 Vector Search (опционально для Phase 2)

**Что:** Similarity search для зависимостей

**Технология:** YDB + embeddings или отдельный сервис

**Для MVP:** Keyword-based search (достаточно для начала)

**Для Scale:** Добавить vector embeddings
```javascript
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');

async function findSimilarInitiatives(text) {
    const embeddings = new OpenAIEmbeddings();
    const vector = await embeddings.embedQuery(text);

    // Поиск в YDB или Pinecone/Weaviate
    return await vectorDB.search(vector, topK: 10);
}
```

---

## 5. Telegram Integration

### 5.1 Telegraf.js

**Что:** Modern Telegram Bot Framework для Node.js

**Почему:**
- Serverless-friendly (не требует long polling)
- Поддержка webhook mode из коробки
- Middleware architecture для расширяемости
- Session management built-in

**Версия:** `^4.15.0`

**Пример интеграции:**
```javascript
const { Telegraf } = require('telegraf');

class TelegramHandler {
    constructor() {
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

        // Middleware: session lock
        this.bot.use(async (ctx, next) => {
            const lock = await sessionManager.acquire(ctx.from.id);
            try {
                await next();
            } finally {
                await lock.release();
            }
        });

        // Commands
        this.bot.command('start', async (ctx) => {
            await ctx.reply('Привет! Я Project Assistant.');
        });

        this.bot.on('text', async (ctx) => {
            // Lazy load DialogSystem
            const { DialogSystem } = require('../modules/dialog-system');
            const dialog = new DialogSystem();
            await dialog.processMessage(ctx.message);
        });
    }

    async handle(update) {
        // Вызывается из entry point
        await this.bot.handleUpdate(update);
    }
}
```

**Webhook Setup:**
```javascript
// Одноразовая настройка
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
await bot.telegram.setWebhook('https://functions.yandexcloud.net/d4e...');
```

---

## 6. Utilities & Libraries

### 6.1 Обязательные зависимости

```json
{
  "dependencies": {
    "telegraf": "^4.15.0",
    "langchain": "^0.1.0",
    "openai": "^4.20.0",
    "@yandex-cloud/nodejs-sdk": "^2.5.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0"
  }
}
```

### 6.2 Logging: Winston

**Что:** Structured logging

**Конфигурация:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()  // Structured logs для Yandex Cloud Logging
    ),
    transports: [
        new winston.transports.Console()
    ]
});

// Использование
logger.info('Report created', {
    workspaceId: 'ws-123',
    reportId: 'rep-456',
    userId: 'user-789'
});
```

### 6.3 Validation: Joi (optional)

**Что:** Schema validation для входных данных

**Пример:**
```javascript
const Joi = require('joi');

const reportSchema = Joi.object({
    workspaceId: Joi.string().required(),
    userId: Joi.string().required(),
    text: Joi.string().min(10).max(5000).required()
});

async function createReport(data) {
    const { error, value } = reportSchema.validate(data);
    if (error) {
        throw new ValidationError(error.message);
    }
    // ... proceed with validated data
}
```

### 6.4 Testing: Jest

**Что:** Testing framework

**Конфигурация:**
```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    }
  }
}
```

**Mocks:**
- `tests/mocks/telegram-mock.js` - мок Telegram API
- `tests/mocks/ydb-mock.js` - мок YDB
- `tests/mocks/ai-mock.js` - мок AI сервиса

---

## 7. Data Access Layer

### 7.1 YDB SDK

**Что:** Official Yandex Database SDK

**Package:** `@yandex-cloud/nodejs-sdk`

**Пример DAO:**
```javascript
const { Driver, getLogger } = require('ydb-sdk');

class BaseDAO {
    constructor() {
        this.driver = null;
    }

    async getDriver() {
        if (!this.driver) {
            this.driver = new Driver({
                endpoint: process.env.YDB_ENDPOINT,
                database: process.env.YDB_DATABASE,
                authService: new MetadataAuthService()  // IAM auth
            });
            await this.driver.ready(10000);
        }
        return this.driver;
    }

    async executeQuery(query, params) {
        const driver = await this.getDriver();
        return await driver.tableClient.withSession(async (session) => {
            return await session.executeQuery(query, params);
        });
    }
}

class ReportsDAO extends BaseDAO {
    async create({ workspace_id, report_id, user_id, text, status, created_at }) {
        const query = `
            DECLARE $workspace_id AS Utf8;
            DECLARE $report_id AS Utf8;
            DECLARE $user_id AS Utf8;
            DECLARE $text AS Utf8;
            DECLARE $status AS Utf8;
            DECLARE $created_at AS Uint64;

            INSERT INTO reports (workspace_id, report_id, user_id, text, status, created_at)
            VALUES ($workspace_id, $report_id, $user_id, $text, $status, $created_at);
        `;

        await this.executeQuery(query, {
            $workspace_id: workspace_id,
            $report_id: report_id,
            $user_id: user_id,
            $text: text,
            $status: status,
            $created_at: created_at
        });

        return report_id;
    }

    async findByWorkspace(workspace_id, limit = 50) {
        const query = `
            DECLARE $workspace_id AS Utf8;
            DECLARE $limit AS Uint32;

            SELECT * FROM reports
            WHERE workspace_id = $workspace_id
            ORDER BY created_at DESC
            LIMIT $limit;
        `;

        const result = await this.executeQuery(query, {
            $workspace_id: workspace_id,
            $limit: limit
        });

        return result.resultSets[0].rows;
    }
}
```

---

## 8. Environment Variables

**Все секреты хранятся в Yandex Lockbox**, но для локальной разработки:

```bash
# .env.example
NODE_ENV=development

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# YDB
YDB_ENDPOINT=grpcs://ydb.serverless.yandexcloud.net:2135
YDB_DATABASE=/ru-central1/b1g.../etn...

# AI
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-5

# YMQ
YMQ_ENDPOINT=https://message-queue.api.cloud.yandex.net
YMQ_ACCESS_KEY_ID=...
YMQ_SECRET_ACCESS_KEY=...

# Logging
LOG_LEVEL=info
```

**В production:** используем Yandex Cloud Functions Environment Variables + Lockbox integration.

---

## 9. Deployment & CI/CD

### 9.1 Yandex Cloud CLI

**Что:** Инструмент для deploy функций

**Установка:**
```bash
curl https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
yc init
```

**Deploy скрипт:**
```bash
#!/bin/bash
# deploy.sh

FUNCTION_NAME="telegram-handler"
RUNTIME="nodejs18"
ENTRYPOINT="index.process"
MEMORY="512m"
TIMEOUT="30s"

cd functions/$FUNCTION_NAME

# Установка зависимостей
npm ci --production

# Создание архива
zip -r function.zip .

# Deploy
yc serverless function version create \
  --function-name=$FUNCTION_NAME \
  --runtime=$RUNTIME \
  --entrypoint=$ENTRYPOINT \
  --memory=$MEMORY \
  --execution-timeout=$TIMEOUT \
  --source-path=./function.zip \
  --environment LOG_LEVEL=info

echo "Deployed $FUNCTION_NAME"
```

### 9.2 GitHub Actions (опционально)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Yandex Cloud

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Yandex Cloud CLI
        run: |
          curl https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
          echo "${{ secrets.YC_SA_KEY }}" > key.json
          yc config profile create sa-profile
          yc config set service-account-key key.json

      - name: Deploy telegram-handler
        run: ./scripts/deploy.sh telegram-handler

      - name: Deploy ai-processor
        run: ./scripts/deploy.sh ai-processor

      - name: Deploy timer-scheduler
        run: ./scripts/deploy.sh timer-scheduler
```

---

## 10. Cost Estimation (для SaaS)

### 10.1 Yandex Cloud Functions

**Pricing:**
- Первые 1M запросов/месяц - бесплатно
- $0.043 за 1M запросов
- $1.36 за 1M GB*sec (memory * execution time)

**Пример для 1000 активных пользователей:**
- 10,000 сообщений/день = 300,000/месяц
- Средний execution time: 200ms
- Memory: 512 MB
- **Cost:** ~$5/месяц

### 10.2 YDB

**Pricing:**
- On-Demand: $0.50 за 1M Read Units, $2.50 за 1M Write Units
- 1 RU = 4 KB read, 1 WU = 1 KB write

**Пример:**
- 300,000 writes/месяц (сообщения)
- 900,000 reads/месяц (диалоги, запросы)
- **Cost:** ~$2/месяц

### 10.3 YMQ

**Pricing:**
- Первые 1M запросов/месяц - бесплатно
- $0.40 за 1M запросов

**Cost:** <$1/месяц

### 10.4 OpenAI

**Pricing (GPT-5):**
- Pricing будет уточняться согласно актуальным тарифам OpenAI
- Ориентировочно сопоставимо с GPT-4 Turbo или оптимизировано

**Пример (оценочный):**
- 10,000 AI обработок/месяц (батч по 5 отчетов)
- Среднее: 500 input tokens, 300 output tokens per batch
- **Cost:** ~$14/месяц (будет уточнено)

**Total для 1000 пользователей: ~$22/месяц**

**Revenue model:** $5-10/user/месяц → прибыльно уже с 10-20 активных workspace'ов

---

## 11. Alternatives Considered

| Технология | Рассмотренная альтернатива | Почему выбрали текущую |
|------------|---------------------------|------------------------|
| **Runtime** | Python | Node.js быстрее на cold start |
| **Language** | TypeScript | JS проще для serverless (no build) |
| **Database** | PostgreSQL (Managed) | YDB дешевле для serverless (pay-per-use) |
| **AI Framework** | LlamaIndex | LangChain более зрелый и популярный |
| **Telegram SDK** | node-telegram-bot-api | Telegraf современнее, лучше для serverless |
| **Queue** | Kafka / RabbitMQ | YMQ managed, не нужно управлять инфрой |
| **Secrets** | Hashicorp Vault | Lockbox нативная интеграция с Yandex Cloud |

---

## 12. Чеклист для Developer

При выборе новой библиотеки проверьте:

- [ ] **Bundle size**: Влияет на cold start (используйте `bundlephobia.com`)
- [ ] **Dependencies**: Меньше зависимостей = меньше vulnerabilities
- [ ] **Maintenance**: Последний commit < 6 месяцев назад
- [ ] **License**: MIT/Apache/BSD (не GPL для коммерческого продукта)
- [ ] **Serverless compatibility**: Работает без file system / long-running processes
- [ ] **Yandex Cloud support**: Проверить совместимость с Node.js 18 runtime

---

**Status:** ✅ Ready for review
**Next step:** Phase 1 завершена! Переход к Phase 2 (Module Specifications)

## Phase 1 Summary

Созданы 4 архитектурных документа:

1. ✅ `system-design.md` - общая архитектура системы
2. ✅ `folder-structure.md` - структура проекта
3. ✅ `data-flow.md` - потоки данных
4. ✅ `tech-stack.md` - технологический стек

**Готово для передачи Developer на Phase 2: Module Specifications**
