# WhisperFlow

> Приложение для транскрипции и форматирования аудио с помощью AI

WhisperFlow - это desktop приложение для Windows с бэкэнд-сервисом, которое позволяет:
- 🎤 Записывать аудио с микрофона и системного звука
- ✍️ Транскрибировать речь в текст через OpenAI Whisper
- 📝 Форматировать текст в различные форматы через GPT
- 💾 Сохранять историю транскрипций
- 📤 Экспортировать результаты

## Статус проекта

✅ **MVP готов к тестированию!**

См. [GETTING_STARTED.md](GETTING_STARTED.md) для инструкций по запуску.

## Архитектура

WhisperFlow состоит из двух основных компонентов:

1. **Desktop App** (Electron + React + TypeScript) - Windows приложение
2. **Backend API** (FastAPI + Python) - Серверная часть с интеграцией OpenAI

```
┌─────────────────────┐
│   Desktop App       │
│   (Windows)         │
└──────────┬──────────┘
           │ HTTPS/WSS
           ▼
┌─────────────────────┐      ┌──────────────┐
│   Backend API       │─────▶│  OpenAI API  │
│   (FastAPI)         │      │  Whisper+GPT │
└──────────┬──────────┘      └──────────────┘
           │
           ▼
┌─────────────────────┐
│   PostgreSQL        │
│   + Redis           │
└─────────────────────┘
```

## Быстрый старт

### Desktop приложение

```bash
cd desktop
pnpm install
pnpm dev
```

Подробнее: [desktop/README.md](desktop/README.md)

### Backend сервис

```bash
# С Docker (рекомендуется)
docker-compose up -d

# Без Docker
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Подробнее: [backend/README.md](backend/README.md)

## Документация

### Основная документация

- 📖 [**ARCHITECTURE.md**](ARCHITECTURE.md) - Детальная архитектура системы
- 🛠 [**TECH_STACK.md**](TECH_STACK.md) - Технологический стек и библиотеки
- 🖥 [**INFRASTRUCTURE.md**](INFRASTRUCTURE.md) - Требования к серверу и развертывание

### Компонентная документация

- [Desktop App README](desktop/README.md) - Разработка desktop приложения
- [Backend README](backend/README.md) - Разработка backend API

## Требования

### Desktop приложение

- Windows 10/11
- Node.js 18+
- pnpm 8+

### Backend сервис

- Python 3.11+
- PostgreSQL 16+ (или SQLite для разработки)
- Redis 7+
- OpenAI API ключ

### Для развертывания

- VPS сервер (рекомендуется Hetzner CPX21: 3 vCPU, 4GB RAM)
- Ubuntu 22.04 LTS
- Docker и Docker Compose
- Домен с SSL сертификатом

Подробности в [INFRASTRUCTURE.md](INFRASTRUCTURE.md)

## MVP Функционал

### ✅ Desktop приложение

- [x] Запись аудио с микрофона
- [x] Запись системного звука
- [x] Загрузка аудио файлов
- [x] Отправка на транскрипцию
- [x] Отображение результатов в реальном времени
- [x] Форматирование текста (5 базовых форматов)
- [x] Экспорт результатов (TXT через скачивание)
- [ ] История транскрипций в UI (есть в backend)
- [ ] Экспорт в MD, DOCX (планируется)
- [ ] Настройки приложения (планируется)

### ✅ Backend API

- [x] Endpoint для загрузки аудио
- [x] Интеграция с Whisper API
- [x] Интеграция с GPT API
- [x] WebSocket для real-time обновлений
- [x] История транскрипций
- [x] Логирование и мониторинг
- [ ] Асинхронная обработка через Celery (планируется)
- [ ] Rate limiting (планируется)

## Технологический стек

### Frontend (Desktop)

- **Electron** 28+ - Desktop framework
- **React** 18+ - UI library
- **TypeScript** 5+ - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management

### Backend

- **FastAPI** - Python web framework
- **SQLAlchemy** - ORM
- **PostgreSQL** - Database
- **Redis** - Cache & queue
- **Celery** - Task queue
- **OpenAI SDK** - API integration

Полный список в [TECH_STACK.md](TECH_STACK.md)

## Структура проекта

```
wsprflw/
├── desktop/                 # Electron desktop app
│   ├── src/
│   │   ├── main/           # Electron main process
│   │   ├── renderer/       # React app
│   │   └── preload/        # Preload scripts
│   ├── package.json
│   └── README.md
│
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Configuration
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── services/       # Business logic
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
│
├── docs/                   # Additional documentation
├── docker-compose.yml      # Docker orchestration
├── ARCHITECTURE.md         # System architecture
├── TECH_STACK.md          # Technology stack details
├── INFRASTRUCTURE.md      # Deployment guide
└── README.md              # This file
```

## Разработка

### Установка зависимостей

```bash
# Desktop app
cd desktop
pnpm install

# Backend
cd backend
pip install -r requirements-dev.txt
```

### Локальный запуск

```bash
# Запустить backend (в одном терминале)
cd backend
docker-compose up  # или python -m uvicorn app.main:app --reload

# Запустить desktop app (в другом терминале)
cd desktop
pnpm dev
```

### Тестирование

```bash
# Desktop app
cd desktop
pnpm test
pnpm lint

# Backend
cd backend
pytest
pytest --cov=app
```

## Развертывание

### Backend на VPS

Подробная инструкция в [INFRASTRUCTURE.md](INFRASTRUCTURE.md)

Краткая версия:

```bash
# На сервере
git clone <repo-url>
cd wsprflw

# Настроить .env
cp backend/.env.example .env
nano .env  # добавить OPENAI_API_KEY

# Запустить с Docker
docker-compose up -d

# Настроить Nginx + SSL
sudo certbot --nginx -d api.yourdomain.com
```

### Desktop приложение

```bash
cd desktop
pnpm build:win
```

Установщик будет в `desktop/release/{version}/`

## Оценка стоимости

### Разработка (уже сделано)

- ✅ Архитектура и планирование
- ✅ Структура проектов
- ⏳ Разработка MVP (~40-80 часов работы)

### Эксплуатация (ежемесячно)

**Для MVP (10 активных пользователей):**

- Сервер (Hetzner CPX21): €7.49 (~₽750)
- OpenAI API (10 пользователей × 10 часов аудио): ~$36 (~₽3600)
- Домен: ~₽100
- **Итого**: ~₽4500/месяц

Подробная оценка в [ARCHITECTURE.md](ARCHITECTURE.md)

## Roadmap

### Фаза 1: MVP (Текущая)

- [x] Архитектура и планирование
- [x] Структура проектов
- [ ] Базовая функциональность desktop app
- [ ] Backend API с OpenAI интеграцией
- [ ] Развертывание на тестовом сервере

### Фаза 2: Улучшения

- [ ] Улучшенный UI/UX
- [ ] Дополнительные форматы экспорта
- [ ] Темная/светлая тема
- [ ] Горячие клавиши
- [ ] Автообновление приложения

### Фаза 3: Расширенные функции

- [ ] Кастомные промпты для форматирования
- [ ] Поддержка множества языков
- [ ] Пакетная обработка файлов
- [ ] Интеграция с облачными хранилищами
- [ ] Аутентификация и мультипользовательский режим

### Фаза 4: Платформы

- [ ] macOS версия
- [ ] Linux версия
- [ ] Web версия (опционально)
- [ ] Mobile версия (опционально)

## Вклад в проект

Пока проект в стадии MVP разработки, но в будущем планируется:

1. Fork репозитория
2. Создать feature branch
3. Commit изменения
4. Push в branch
5. Открыть Pull Request

## Лицензия

MIT License

## Благодарности

- [OpenAI](https://openai.com/) - Whisper и GPT API
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Electron](https://www.electronjs.org/) - Desktop app framework
- [React](https://react.dev/) - UI library

---

**Сделано с ❤️ для упрощения работы с аудио транскрипцией**
