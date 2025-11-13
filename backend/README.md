# WhisperFlow Backend

Backend API для WhisperFlow - сервис транскрипции и форматирования аудио с помощью OpenAI.

## Технологии

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM для работы с БД
- **PostgreSQL** - Основная БД
- **Redis** - Кэш и очередь задач
- **Celery** - Асинхронная обработка задач
- **OpenAI API** - Whisper для транскрипции, GPT для форматирования

## Требования

- Python 3.11+
- PostgreSQL 16+ (или SQLite для разработки)
- Redis 7+

## Установка

### Локальная установка (без Docker)

```bash
# Создать виртуальное окружение
python -m venv venv

# Активировать виртуальное окружение
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Установить зависимости
pip install -r requirements-dev.txt

# Скопировать .env файл
cp .env.example .env

# Отредактировать .env файл и добавить OPENAI_API_KEY
```

### Docker установка (рекомендуется)

```bash
# Создать .env файл в корне проекта
cp backend/.env.example .env

# Добавить ваш OpenAI API ключ в .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Запустить все сервисы
docker-compose up -d

# Посмотреть логи
docker-compose logs -f api
```

## Разработка

### Без Docker

```bash
# Запустить PostgreSQL и Redis локально или через Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16
docker run -d -p 6379:6379 redis:7-alpine

# Применить миграции БД
alembic upgrade head

# Запустить сервер разработки
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# В другом терминале запустить Celery worker
celery -A app.tasks.celery_app worker --loglevel=info
```

### С Docker

```bash
# Запустить все сервисы
docker-compose up

# Пересобрать после изменений в Dockerfile
docker-compose up --build

# Применить миграции
docker-compose exec api alembic upgrade head

# Посмотреть логи конкретного сервиса
docker-compose logs -f api
docker-compose logs -f celery-worker

# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes (БД будет очищена!)
docker-compose down -v
```

## Линтинг и форматирование

```bash
# Форматирование с Black
black app/

# Линтинг с Ruff
ruff check app/

# Type checking с mypy
mypy app/
```

## Тестирование

```bash
# Запустить все тесты
pytest

# Запустить с coverage
pytest --cov=app --cov-report=html

# Запустить конкретный тест
pytest tests/test_transcription.py -v
```

## Миграции БД

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "Description of changes"

# Применить миграции
alembic upgrade head

# Откатить последнюю миграцию
alembic downgrade -1

# Посмотреть историю миграций
alembic history
```

## API Документация

После запуска сервера документация доступна по адресам:

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **OpenAPI JSON**: http://localhost:8000/api/openapi.json

## Структура проекта

```
backend/
├── app/
│   ├── api/              # API endpoints
│   │   └── v1/           # API version 1
│   ├── core/             # Core configuration
│   │   ├── config.py     # Settings
│   │   └── logging_config.py
│   ├── db/               # Database
│   │   └── database.py   # DB session
│   ├── models/           # SQLAlchemy models
│   │   └── transcription.py
│   ├── schemas/          # Pydantic schemas
│   │   └── transcription.py
│   ├── services/         # Business logic
│   │   └── openai_service.py
│   └── main.py           # FastAPI app
├── tests/                # Tests
├── alembic/              # Database migrations
├── Dockerfile            # Docker configuration
├── requirements.txt      # Production dependencies
├── requirements-dev.txt  # Development dependencies
└── pyproject.toml        # Python project configuration
```

## Endpoints (планируемые)

### Транскрипция

- `POST /api/v1/transcribe` - Загрузить аудио для транскрипции
- `GET /api/v1/transcribe/{job_id}` - Получить статус транскрипции
- `GET /api/v1/transcribe/{job_id}/result` - Получить результат транскрипции

### Форматирование

- `POST /api/v1/format` - Форматировать текст
- `GET /api/v1/format/{id}` - Получить результат форматирования

### История

- `GET /api/v1/history` - Получить историю транскрипций
- `GET /api/v1/history/{id}` - Получить конкретную транскрипцию
- `DELETE /api/v1/history/{id}` - Удалить транскрипцию

### Система

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics (production)

### WebSocket

- `WS /api/v1/ws` - WebSocket для real-time обновлений

## Переменные окружения

См. `.env.example` для полного списка переменных окружения.

Основные переменные:

```env
# OpenAI API (обязательно!)
OPENAI_API_KEY=sk-your-api-key-here

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/whisperflow

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

## Мониторинг

### Celery Flower

Flower предоставляет веб-интерфейс для мониторинга Celery задач:

```bash
# Доступен после запуска docker-compose
http://localhost:5555
```

### Логи

Логи в JSON формате для production, человеко-читаемые для development.

```bash
# Посмотреть логи в Docker
docker-compose logs -f api

# Фильтровать по уровню
docker-compose logs api | grep ERROR
```

## Производительность

### Оптимизация

- Async/await для всех I/O операций
- Connection pooling для БД
- Redis кэширование часто запрашиваемых данных
- Celery для тяжелых задач (транскрипция)
- Gzip compression для API ответов

### Лимиты

- Максимальный размер файла: 25 MB (настраивается)
- Rate limiting: 60 запросов в минуту (настраивается)
- Timeout для транскрипции: 10 минут

## Безопасность

- API ключи хранятся в переменных окружения
- CORS настроен для разрешенных origins
- Input validation через Pydantic
- SQL injection защита через SQLAlchemy ORM
- Rate limiting для защиты от abuse

## Troubleshooting

### Проблема: Ошибка подключения к БД

```bash
# Проверить что PostgreSQL запущен
docker-compose ps postgres

# Проверить логи
docker-compose logs postgres

# Пересоздать БД
docker-compose down -v
docker-compose up -d postgres
```

### Проблема: Celery задачи не выполняются

```bash
# Проверить Redis
docker-compose ps redis

# Проверить Celery worker
docker-compose logs celery-worker

# Перезапустить worker
docker-compose restart celery-worker
```

### Проблема: OpenAI API ошибки

```bash
# Проверить API ключ
echo $OPENAI_API_KEY

# Проверить квоту и биллинг на platform.openai.com
# Проверить логи для деталей ошибки
docker-compose logs api | grep OpenAI
```

## Лицензия

MIT
