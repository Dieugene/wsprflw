# Архитектура приложения WhisperFlow

## Обзор

WhisperFlow - это десктопное приложение для Windows с бэкэнд-сервисом, предназначенное для захвата аудио, транскрипции речи в текст и форматирования результатов.

## Архитектура системы

```
┌─────────────────────────────────────────┐
│      Windows Desktop Application        │
│  (Electron/Tauri + React + TypeScript)  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  UI Layer (React Components)      │  │
│  │  - Главное окно                   │  │
│  │  - Управление записью             │  │
│  │  - Отображение результатов        │  │
│  │  - Настройки                      │  │
│  └───────────────────────────────────┘  │
│                ▲                         │
│                │                         │
│  ┌─────────────▼─────────────────────┐  │
│  │  State Management (Zustand/Redux) │  │
│  └───────────────────────────────────┘  │
│                ▲                         │
│                │                         │
│  ┌─────────────▼─────────────────────┐  │
│  │  Services Layer                   │  │
│  │  - AudioService (запись)          │  │
│  │  - APIService (связь с бэкэндом)  │  │
│  │  - StorageService (локальное)     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                   │
                   │ HTTPS/WSS
                   ▼
┌─────────────────────────────────────────┐
│         Backend API Service             │
│      (Python + FastAPI + uvicorn)       │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  API Endpoints                    │  │
│  │  - POST /api/transcribe           │  │
│  │  - POST /api/format               │  │
│  │  - GET /api/status                │  │
│  │  - WS /api/ws (real-time)         │  │
│  └───────────────────────────────────┘  │
│                ▲                         │
│                │                         │
│  ┌─────────────▼─────────────────────┐  │
│  │  Business Logic                   │  │
│  │  - TranscriptionService           │  │
│  │  - FormattingService              │  │
│  │  - QueueManager                   │  │
│  └───────────────────────────────────┘  │
│                ▲                         │
│                │                         │
│  ┌─────────────▼─────────────────────┐  │
│  │  External Services Integration    │  │
│  │  - OpenAI Whisper API             │  │
│  │  - OpenAI GPT API (formatting)    │  │
│  └───────────────────────────────────┘  │
│                ▲                         │
│                │                         │
│  ┌─────────────▼─────────────────────┐  │
│  │  Database (PostgreSQL/SQLite)     │  │
│  │  - История транскрипций           │  │
│  │  - Метаданные                     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Компоненты

### 1. Desktop Application (Frontend)

#### Технологии:
- **Framework**: Electron или Tauri
  - Electron: Более зрелый, богатая экосистема
  - Tauri: Меньше размер, лучше производительность
- **UI Framework**: React 18+
- **Язык**: TypeScript
- **State Management**: Zustand (легковесный) или Redux Toolkit
- **Styling**: Tailwind CSS + shadcn/ui
- **Audio Recording**: Web Audio API / MediaRecorder API

#### Основные модули:

**AudioService**
- Захват системного аудио (через Electron/Tauri native APIs)
- Управление микрофоном
- Форматирование аудио (конвертация в нужный формат)
- Временные метки

**APIService**
- HTTP клиент для взаимодействия с бэкэндом
- WebSocket для real-time обновлений
- Обработка ошибок и retry логика
- Кэширование

**StorageService**
- Сохранение локальных настроек
- Кэш транскрипций
- История записей

**UI Components**
- MainWindow: главное окно приложения
- RecordingPanel: панель управления записью (старт/стоп/пауза)
- TranscriptionView: отображение транскрипции в реальном времени
- FormattingPanel: выбор формата и настройки
- SettingsDialog: настройки приложения
- HistoryPanel: история транскрипций

### 2. Backend Service

#### Технологии:
- **Framework**: FastAPI (Python 3.11+)
- **Web Server**: Uvicorn
- **Task Queue**: Celery + Redis (для асинхронной обработки)
- **Database**: PostgreSQL (или SQLite для простоты в MVP)
- **API Client**: OpenAI Python SDK
- **Caching**: Redis

#### Основные модули:

**TranscriptionService**
```python
class TranscriptionService:
    """Сервис транскрипции аудио через Whisper API"""

    async def transcribe_audio(
        self,
        audio_file: bytes,
        language: str = "ru",
        model: str = "whisper-1"
    ) -> TranscriptionResult
```

**FormattingService**
```python
class FormattingService:
    """Сервис форматирования текста через GPT API"""

    async def format_text(
        self,
        text: str,
        format_type: FormatType,
        custom_prompt: Optional[str] = None
    ) -> FormattedResult
```

**QueueManager**
- Управление очередью задач
- Приоритизация
- Retry логика для failed tasks

#### API Endpoints:

```
POST /api/v1/transcribe
- Загрузка аудио файла
- Параметры: language, model, timestamps
- Response: job_id для отслеживания

GET /api/v1/transcribe/{job_id}
- Получение статуса транскрипции
- Response: status, progress, result

POST /api/v1/format
- Форматирование текста
- Параметры: text, format_type, custom_prompt
- Response: formatted_text

WebSocket /api/v1/ws
- Real-time обновления статуса
- Потоковая транскрипция (если поддерживается)

GET /api/v1/history
- История транскрипций пользователя

POST /api/v1/settings
- Сохранение настроек пользователя
```

### 3. Database Schema

```sql
-- Таблица пользователей (для будущего расширения)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    settings JSONB
);

-- Таблица транскрипций
CREATE TABLE transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    audio_duration FLOAT,
    audio_size_bytes BIGINT,
    language VARCHAR(10),
    model VARCHAR(50),
    status VARCHAR(20), -- pending, processing, completed, failed
    transcription_text TEXT,
    formatted_text TEXT,
    format_type VARCHAR(50),
    metadata JSONB
);

-- Индексы для производительности
CREATE INDEX idx_transcriptions_user_created
    ON transcriptions(user_id, created_at DESC);
CREATE INDEX idx_transcriptions_status
    ON transcriptions(status);
```

## Потоки данных

### 1. Процесс транскрипции

```
1. Пользователь нажимает "Записать"
   └─> Desktop App: AudioService начинает запись

2. Пользователь нажимает "Стоп"
   └─> Desktop App: Сохраняет аудио во временный файл
   └─> Desktop App: APIService отправляет файл на бэкэнд
   └─> Backend: Создает job, отправляет в очередь
   └─> Backend: TranscriptionService вызывает Whisper API
   └─> OpenAI: Обрабатывает аудио
   └─> Backend: Сохраняет результат в БД
   └─> Backend: Отправляет WebSocket уведомление
   └─> Desktop App: Обновляет UI с результатом

3. (Опционально) Автоматическое форматирование
   └─> Backend: FormattingService вызывает GPT API
   └─> Backend: Сохраняет отформатированный текст
   └─> Desktop App: Показывает финальный результат
```

### 2. Обработка ошибок

```
Desktop App:
- Network errors: Retry с exponential backoff
- Audio errors: Уведомление пользователя
- Storage errors: Fallback на memory

Backend:
- OpenAI API errors: Retry до 3 раз
- Database errors: Логирование, уведомление пользователя
- Queue errors: Dead letter queue для ручной обработки
```

## Модели OpenAI

### Whisper API
- **Модель**: `whisper-1`
- **Поддерживаемые форматы**: mp3, mp4, mpeg, mpga, m4a, wav, webm
- **Максимальный размер файла**: 25 MB
- **Языки**: Поддержка русского языка
- **Параметры**:
  - `language`: "ru" (русский)
  - `response_format`: "json" или "verbose_json" (с timestamps)
  - `temperature`: 0 (для детерминированности)

### GPT API для форматирования
- **Модель**: `gpt-4-turbo-preview` или `gpt-3.5-turbo`
- **Выбор зависит от**:
  - Качества форматирования (GPT-4 лучше)
  - Стоимости (GPT-3.5 дешевле)
  - Скорости (GPT-3.5 быстрее)

**Рекомендация для MVP**: `gpt-3.5-turbo` (оптимальный баланс)

## Безопасность

### Desktop Application
- Безопасное хранение API ключей (не в коде!)
- Шифрование локальных данных
- HTTPS для всех запросов

### Backend
- API ключи в переменных окружения
- Rate limiting (против abuse)
- Аутентификация (для будущих версий)
- Валидация входных данных
- CORS настройки
- HTTPS обязательно

## Масштабируемость

### MVP (Фаза 1)
- Один backend сервер
- SQLite для простоты
- Синхронная обработка

### Будущее расширение
- Горизонтальное масштабирование (несколько backend серверов)
- PostgreSQL + Redis
- Celery worker pool для параллельной обработки
- CDN для статических ресурсов
- Load balancer

## Мониторинг и логирование

- **Desktop App**:
  - Sentry для error tracking
  - Локальные логи (rotating file handler)

- **Backend**:
  - Structured logging (JSON format)
  - Application logs (Python logging)
  - Access logs (uvicorn)
  - Metrics (Prometheus + Grafana)
  - Health check endpoint

## Развертывание

### Desktop Application
- **Packaging**: electron-builder или Tauri bundler
- **Installer**: NSIS для Windows
- **Auto-update**: electron-updater или Tauri updater

### Backend
- **Containerization**: Docker
- **Orchestration**: Docker Compose (MVP) или Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Hosting**: VPS (Hetzner, DigitalOcean) или Cloud (AWS, GCP)

## Требования к серверу (MVP)

### Минимальные требования:
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 50 GB SSD
- **Network**: 100 Mbps
- **OS**: Ubuntu 22.04 LTS

### Рекомендуемые требования:
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS

### Оценка нагрузки (MVP):
- Транскрипция: ~1-2 минуты на 10 минут аудио
- Форматирование: ~5-10 секунд на текст
- Concurrent users: до 10 одновременных пользователей
- Storage: ~100 MB на час аудио (сжатое)

## Стоимость OpenAI API (оценка)

### Whisper API
- $0.006 за минуту аудио
- Пример: 100 минут аудио = $0.60

### GPT-3.5-Turbo
- Input: $0.0005 за 1K tokens
- Output: $0.0015 за 1K tokens
- Пример: форматирование 1000 слов (~1300 tokens) ≈ $0.002

**Месячная оценка для 1 пользователя** (активное использование):
- 10 часов аудио = $3.60
- 100 форматирований = $0.20
- **Итого: ~$4 в месяц**

## Следующие шаги

1. ✅ Определить архитектуру
2. ⏳ Выбрать финальный технологический стек
3. ⏳ Создать структуру проектов
4. ⏳ Настроить development окружение
5. ⏳ Разработать MVP функционал
