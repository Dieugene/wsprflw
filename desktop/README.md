# WhisperFlow Desktop

Desktop приложение WhisperFlow для Windows - транскрипция и форматирование аудио с помощью AI.

## Технологии

- **Electron** 28+ - Desktop framework
- **React** 18+ - UI библиотека
- **TypeScript** 5+ - Типизация
- **Vite** - Сборщик
- **Tailwind CSS** - Стили
- **Zustand** - State management

## Требования

- Node.js 18+
- pnpm 8+

## Установка

```bash
# Установить зависимости
pnpm install
```

## Разработка

```bash
# Запустить в режиме разработки
pnpm dev

# Проверить типы
pnpm type-check

# Линтинг
pnpm lint

# Форматирование
pnpm format
```

## Сборка

```bash
# Собрать для Windows
pnpm build:win

# Собрать без упаковки (для тестирования)
pnpm build:unpack
```

## Структура проекта

```
desktop/
├── src/
│   ├── main/              # Electron main process
│   │   └── index.ts       # Точка входа main process
│   ├── preload/           # Preload scripts
│   │   └── index.ts       # Preload script
│   └── renderer/          # React приложение
│       ├── components/    # React компоненты
│       ├── features/      # Feature modules
│       ├── hooks/         # Custom hooks
│       ├── services/      # API и сервисы
│       ├── store/         # Zustand stores
│       ├── styles/        # Глобальные стили
│       ├── types/         # TypeScript типы
│       ├── utils/         # Утилиты
│       ├── App.tsx        # Главный компонент
│       └── main.tsx       # Точка входа renderer
├── index.html             # HTML template
├── package.json           # Зависимости и скрипты
├── tsconfig.json          # TypeScript конфигурация
├── vite.config.ts         # Vite конфигурация
└── electron-builder.yml   # Electron Builder конфигурация
```

## Особенности разработки

### Electron Main Process

Главный процесс отвечает за:
- Создание окон приложения
- Системные API (файловая система, уведомления)
- IPC коммуникация с renderer процессом

### Preload Script

Preload script обеспечивает безопасный мост между main и renderer процессами:
- Экспортирует только нужные API через `contextBridge`
- Обеспечивает безопасность через context isolation

### Renderer Process (React)

React приложение работает как обычное веб-приложение:
- Использует Electron API через preload script
- Управляет UI и пользовательским взаимодействием
- Взаимодействует с бэкэндом через HTTP/WebSocket

## Переменные окружения

Создайте `.env.local` файл:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## Линтинг и форматирование

Проект использует:
- **ESLint** для линтинга TypeScript/React кода
- **Prettier** для автоматического форматирования

## Сборка для продакшена

```bash
# Полная сборка с упаковкой
pnpm build:win
```

Результат будет в папке `release/{version}/`:
- `WhisperFlow-{version}-Setup.exe` - установщик NSIS

## Автообновление

Приложение поддерживает автоматические обновления через `electron-updater`.
Обновления публикуются через GitHub Releases.

## Отладка

### Chrome DevTools

В режиме разработки DevTools открываются автоматически.

### Логи

- Renderer logs: Chrome DevTools Console
- Main process logs: Terminal где запущен `pnpm dev`

## Проблемы и решения

### Проблема: Не запускается в режиме разработки

Решение: Убедитесь что порт 5173 свободен и перезапустите dev server.

### Проблема: Ошибки TypeScript

Решение: Запустите `pnpm type-check` для проверки всех ошибок.

### Проблема: Ошибки сборки

Решение: Очистите кэш и пересоберите:
```bash
rm -rf node_modules dist dist-electron release
pnpm install
pnpm build:win
```

## Лицензия

MIT
