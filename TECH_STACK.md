# Технологический стек WhisperFlow

## Desktop Application (Frontend)

### Основной стек

#### Application Framework: **Electron**

**Почему Electron:**
- ✅ Зрелая экосистема и большое сообщество
- ✅ Отличная документация
- ✅ Нативный доступ к системному аудио
- ✅ Простая интеграция с Node.js
- ✅ Встроенная система автообновлений
- ❌ Больший размер приложения (~150MB)
- ❌ Выше потребление памяти

**Альтернатива: Tauri** (можно рассмотреть позже)
- Меньший размер
- Лучше производительность
- Но менее зрелый для Windows аудио работы

**Версия:** Electron 28+ (latest stable)

#### UI Framework: **React**
- **Версия:** React 18.2+
- **TypeScript:** 5.3+
- **Почему:**
  - Огромная экосистема
  - Отличная TypeScript поддержка
  - Множество готовых компонентов

#### State Management: **Zustand**
- **Версия:** 4.5+
- **Почему:**
  - Легковесный (1KB)
  - Простой API
  - TypeScript first
  - Нет boilerplate кода как в Redux
  - Отлично для desktop приложений

#### UI Components: **shadcn/ui + Radix UI**
- **Почему:**
  - Современные, доступные компоненты
  - Полная кастомизация
  - TypeScript поддержка
  - Темная/светлая темы из коробки

#### Styling: **Tailwind CSS**
- **Версия:** 3.4+
- **Плагины:**
  - `@tailwindcss/typography`
  - `tailwindcss-animate`

#### Build Tool: **Vite**
- **Версия:** 5.0+
- **Почему:**
  - Быстрый HMR
  - Отличная TypeScript поддержка
  - Легкая настройка для Electron

#### Package Manager: **pnpm**
- **Версия:** 8.15+
- **Почему:**
  - Быстрее npm/yarn
  - Экономит дисковое пространство
  - Строгий режим зависимостей

### Дополнительные библиотеки

#### Аудио обработка
```json
{
  "lamejs": "^1.2.1",           // MP3 encoding
  "recordrtc": "^5.6.2",         // Recording management
  "audiobuffer-to-wav": "^1.0.0" // WAV conversion
}
```

#### HTTP клиент
```json
{
  "axios": "^1.6.5",             // HTTP requests
  "axios-retry": "^4.0.0"        // Retry logic
}
```

#### WebSocket
```json
{
  "socket.io-client": "^4.7.4"   // Real-time communication
}
```

#### Форматирование даты/времени
```json
{
  "date-fns": "^3.2.0"           // Date utilities
}
```

#### Иконки
```json
{
  "lucide-react": "^0.312.0"     // Modern icon set
}
```

#### Формы и валидация
```json
{
  "react-hook-form": "^7.49.3",  // Form management
  "zod": "^3.22.4"                // Schema validation
}
```

#### Toast уведомления
```json
{
  "sonner": "^1.3.1"             // Toast notifications
}
```

#### Markdown рендеринг
```json
{
  "react-markdown": "^9.0.1",    // Markdown rendering
  "remark-gfm": "^4.0.0"          // GitHub flavored markdown
}
```

#### Error tracking
```json
{
  "@sentry/electron": "^4.19.0"  // Error monitoring
}
```

### Development Dependencies

```json
{
  "@types/node": "^20.11.5",
  "@types/react": "^18.2.48",
  "@types/react-dom": "^18.2.18",
  "@typescript-eslint/eslint-plugin": "^6.19.0",
  "@typescript-eslint/parser": "^6.19.0",
  "electron": "^28.1.4",
  "electron-builder": "^24.9.1",
  "eslint": "^8.56.0",
  "eslint-plugin-react-hooks": "^4.6.0",
  "prettier": "^3.2.4",
  "vite": "^5.0.12",
  "vite-plugin-electron": "^0.28.2",
  "vite-plugin-electron-renderer": "^0.14.5"
}
```

## Backend Service

### Основной стек

#### Framework: **FastAPI**
- **Версия:** Python 3.11+ с FastAPI 0.109+
- **Почему:**
  - Высокая производительность (на уровне с Node.js/Go)
  - Автоматическая OpenAPI документация
  - Async/await поддержка
  - Отличная валидация через Pydantic
  - Type hints первого класса

#### Web Server: **Uvicorn**
- **Версия:** 0.27+
- **С дополнением:** uvloop для лучшей производительности

#### Database: **PostgreSQL** (production) / **SQLite** (development)
- **PostgreSQL:** 16+
- **SQLite:** 3.41+
- **ORM:** SQLAlchemy 2.0+ с Alembic для миграций

#### Async Database Driver
```
asyncpg==0.29.0        # PostgreSQL async driver
aiosqlite==0.19.0      # SQLite async driver
```

#### Task Queue: **Celery + Redis**
- **Celery:** 5.3+
- **Redis:** 7.2+
- **Почему:**
  - Асинхронная обработка тяжелых задач
  - Retry логика из коробки
  - Мониторинг через Flower

#### Caching: **Redis**
- Кэш для часто запрашиваемых данных
- Session storage

### Python Dependencies

```txt
# Web framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6        # File uploads

# Database
sqlalchemy==2.0.25
alembic==1.13.1
asyncpg==0.29.0                # PostgreSQL async
aiosqlite==0.19.0              # SQLite async

# OpenAI
openai==1.10.0                 # Official OpenAI SDK

# Task queue
celery==5.3.6
redis==5.0.1

# Validation
pydantic==2.5.3
pydantic-settings==2.1.0       # Settings management

# HTTP client
httpx==0.26.0                  # Async HTTP client

# WebSocket
python-socketio==5.11.0
python-socketio[asyncio]

# Authentication (для будущего)
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Monitoring
prometheus-client==0.19.0

# Utilities
python-dotenv==1.0.1           # Environment variables
python-json-logger==2.0.7      # Structured logging
tenacity==8.2.3                # Retry logic
```

### Development Dependencies

```txt
# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
httpx==0.26.0                  # Test client

# Code quality
black==24.1.1                  # Code formatter
ruff==0.1.14                   # Fast linter
mypy==1.8.0                    # Type checker

# Development
ipython==8.20.0
```

## DevOps & Infrastructure

### Containerization

#### Docker
```dockerfile
# Python base image
FROM python:3.11-slim

# Multi-stage build для оптимизации размера
```

#### Docker Compose
- Для локальной разработки
- Orchestration сервисов (API, Redis, PostgreSQL)

### CI/CD

#### GitHub Actions
```yaml
# Workflow для:
- Lint & test на каждый PR
- Build desktop app
- Build & push Docker image
- Deploy на staging/production
```

### Hosting (рекомендации)

#### VPS провайдеры (MVP):
1. **Hetzner** (рекомендуется)
   - €5-10/месяц за сервер CPX21 (2 vCPU, 4GB RAM)
   - Европейские дата-центры
   - Отличная производительность/цена

2. **DigitalOcean**
   - $12/месяц за Droplet (2 vCPU, 4GB RAM)
   - Хорошая документация
   - Managed PostgreSQL available

3. **Linode (Akamai)**
   - $12/месяц за Linode (2 vCPU, 4GB RAM)

#### Cloud провайдеры (для масштабирования):
- **AWS**: EC2 + RDS + S3
- **Google Cloud**: Compute Engine + Cloud SQL
- **Azure**: VM + Azure Database for PostgreSQL

### Reverse Proxy & SSL

#### Nginx
- Reverse proxy для FastAPI
- SSL termination (Let's Encrypt)
- Rate limiting
- Gzip compression

#### Certbot
- Автоматические SSL сертификаты
- Auto-renewal

### Мониторинг

#### Логи
- **Loki + Promtail** (легковесная альтернатива ELK)
- Structured JSON логи

#### Метрики
- **Prometheus** - сбор метрик
- **Grafana** - визуализация

#### Error tracking
- **Sentry** (или self-hosted Glitchtip)

#### Uptime monitoring
- **Uptime Kuma** (self-hosted)
- Или UptimeRobot (SaaS)

## Development Tools

### IDE
- **VS Code** (рекомендуется)
  - Расширения:
    - ESLint
    - Prettier
    - Python
    - Pylance
    - Docker
    - GitLens

### API Testing
- **Thunder Client** (VS Code extension)
- **Postman** или **Insomnia**

### Database Management
- **DBeaver** (универсальный)
- **pgAdmin** (для PostgreSQL)

### Git
- **Conventional Commits** для сообщений коммитов
- **Husky** для pre-commit hooks

## Версионирование

### Semantic Versioning
```
MAJOR.MINOR.PATCH

Example: 1.0.0
- 1.x.x - Breaking changes
- x.1.x - New features
- x.x.1 - Bug fixes
```

### Релизы
- Desktop app: через GitHub Releases + auto-updater
- Backend: Docker images с тегами версий

## Environment Variables

### Desktop App
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_SENTRY_DSN=...
```

### Backend
```env
# Server
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/whisperflow

# Redis
REDIS_URL=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# Secrets
SECRET_KEY=...
JWT_SECRET=...

# Monitoring
SENTRY_DSN=...
```

## Оценка размеров

### Desktop Application
- Установщик: ~150-200 MB
- Установленный: ~250-300 MB
- Memory usage: ~150-300 MB (idle)

### Backend
- Docker image: ~500 MB
- Memory usage: ~200-400 MB (под нагрузкой)

## Структура проектов

```
wsprflw/
├── desktop/              # Electron desktop app
│   ├── src/
│   │   ├── main/        # Electron main process
│   │   ├── renderer/    # React app
│   │   └── preload/     # Preload scripts
│   ├── package.json
│   └── electron-builder.yml
│
├── backend/             # FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── core/        # Config, security
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── main.py      # App entry
│   ├── tests/
│   ├── alembic/         # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml   # Local development
└── docs/                # Documentation
```

## Следующие шаги

1. ✅ Определена архитектура
2. ✅ Выбран технологический стек
3. ⏳ Создать начальные проекты
4. ⏳ Настроить development окружение
5. ⏳ Начать разработку MVP
