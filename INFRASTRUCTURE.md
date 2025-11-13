# Требования к инфраструктуре WhisperFlow

## Обзор

Этот документ содержит детальные требования к серверу и инструкции по развертыванию бэкэнда WhisperFlow.

## Требования к серверу

### MVP (Минимальные требования)

#### VPS Сервер

**Рекомендуемые характеристики:**
- **CPU**: 2 vCPU cores (x86_64)
- **RAM**: 4 GB
- **Storage**: 50 GB SSD
- **Network**: 100 Mbps
- **OS**: Ubuntu 22.04 LTS (рекомендуется)

**Альтернативные ОС:**
- Ubuntu 20.04 LTS
- Debian 11/12
- CentOS Stream 9

#### Оценка нагрузки для MVP

- **Одновременные пользователи**: до 10
- **Транскрипция**: ~1-2 минуты на 10 минут аудио
- **Форматирование**: ~5-10 секунд на текст
- **Storage per user**: ~100 MB на час аудио (сжатое)
- **Bandwidth**: ~50-100 GB в месяц

### Production (Рекомендуемые требования)

**Для 50-100 активных пользователей:**
- **CPU**: 4 vCPU cores
- **RAM**: 8 GB
- **Storage**: 100-200 GB SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS

**Для масштабирования (100+ пользователей):**
- **CPU**: 8+ vCPU cores
- **RAM**: 16+ GB
- **Storage**: 500+ GB SSD / NAS
- **Network**: 1-10 Gbps
- **Load Balancer**: Nginx/HAProxy
- **Multiple backend instances**

## Рекомендуемые VPS провайдеры

### 1. Hetzner (Рекомендуется для MVP)

**Преимущества:**
- Отличное соотношение цена/качество
- Европейские дата-центры (низкая латентность для России)
- Высокая производительность SSD
- Простая панель управления

**Тарифы:**

| План | vCPU | RAM | SSD | Цена/мес |
|------|------|-----|-----|----------|
| CPX21 | 3 | 4 GB | 80 GB | €7.49 (~₽750) |
| CPX31 | 4 | 8 GB | 160 GB | €13.49 (~₽1350) |
| CPX41 | 8 | 16 GB | 240 GB | €25.49 (~₽2550) |

**Подходит для:** MVP и small-scale production

**Ссылка:** https://www.hetzner.com/cloud

### 2. DigitalOcean

**Преимущества:**
- Хорошая документация
- Managed PostgreSQL доступен
- Простой API для автоматизации
- Глобальная инфраструктура

**Тарифы:**

| План | vCPU | RAM | SSD | Bandwidth | Цена/мес |
|------|------|-----|-----|-----------|----------|
| Basic | 2 | 2 GB | 50 GB | 2 TB | $12 (~₽1200) |
| Basic | 2 | 4 GB | 80 GB | 4 TB | $24 (~₽2400) |
| Basic | 4 | 8 GB | 160 GB | 5 TB | $48 (~₽4800) |

**Подходит для:** MVP, production, масштабирование

**Ссылка:** https://www.digitalocean.com/pricing

### 3. Linode (Akamai)

**Преимущества:**
- Похож на DigitalOcean
- Хорошая производительность
- Managed Kubernetes доступен

**Тарифы:**

| План | vCPU | RAM | SSD | Bandwidth | Цена/мес |
|------|------|-----|-----|-----------|----------|
| Linode 4GB | 2 | 4 GB | 80 GB | 4 TB | $24 (~₽2400) |
| Linode 8GB | 4 | 8 GB | 160 GB | 5 TB | $48 (~₽4800) |

**Подходит для:** MVP, production

**Ссылка:** https://www.linode.com/pricing

### 4. Contabo (Бюджетный вариант)

**Преимущества:**
- Очень низкая цена
- Высокие характеристики за деньги

**Недостатки:**
- Средняя производительность
- Техподдержка может быть медленной

**Тарифы:**

| План | vCPU | RAM | SSD | Цена/мес |
|------|------|-----|-----|----------|
| Cloud VPS M | 4 | 8 GB | 200 GB | €6.99 (~₽700) |
| Cloud VPS L | 6 | 16 GB | 400 GB | €11.99 (~₽1200) |

**Подходит для:** Бюджетный MVP, development

**Ссылка:** https://contabo.com/en/vps/

### Рекомендация

**Для MVP**: Hetzner CPX21 (€7.49/мес) - лучший баланс цены и качества

**Для Production**: DigitalOcean или Hetzner CPX31+

## Необходимое ПО

### Установка на Ubuntu 22.04

```bash
# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить основные пакеты
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установить Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установить Nginx (reverse proxy)
sudo apt install -y nginx

# Установить Certbot (для SSL)
sudo apt install -y certbot python3-certbot-nginx

# Перезагрузить для применения изменений группы
newgrp docker
```

## Развертывание бэкэнда

### Шаг 1: Подготовка сервера

```bash
# Создать пользователя для приложения (опционально)
sudo adduser whisperflow
sudo usermod -aG docker whisperflow
sudo su - whisperflow

# Создать директории
mkdir -p ~/whisperflow
cd ~/whisperflow
```

### Шаг 2: Клонирование репозитория

```bash
# Клонировать репозиторий (замените URL на ваш)
git clone https://github.com/yourusername/whisperflow.git
cd whisperflow

# Или использовать HTTPS с токеном
git clone https://<TOKEN>@github.com/yourusername/whisperflow.git
```

### Шаг 3: Настройка переменных окружения

```bash
# Создать .env файл
cp backend/.env.example .env

# Отредактировать .env файл
nano .env
```

**Обязательные переменные:**

```env
# OpenAI API (ОБЯЗАТЕЛЬНО!)
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_ORG_ID=org-your-org-id  # опционально

# Database
DATABASE_URL=postgresql+asyncpg://whisperflow:STRONG_PASSWORD_HERE@postgres:5432/whisperflow

# Security (сгенерируйте надежные ключи!)
SECRET_KEY=your-very-strong-secret-key-here
JWT_SECRET=your-very-strong-jwt-secret-here

# CORS (добавьте ваш домен)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Environment
ENVIRONMENT=production
DEBUG=false
```

**Генерация секретных ключей:**

```bash
# Сгенерировать SECRET_KEY и JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Шаг 4: Запуск с Docker Compose

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f

# Применить миграции БД
docker-compose exec api alembic upgrade head
```

### Шаг 5: Настройка Nginx (Reverse Proxy)

```bash
# Создать конфигурацию Nginx
sudo nano /etc/nginx/sites-available/whisperflow
```

**Содержимое файла:**

```nginx
upstream whisperflow_backend {
    server localhost:8000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Increase client body size for file uploads
    client_max_body_size 26M;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://whisperflow_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket support
    location /api/v1/ws {
        proxy_pass http://whisperflow_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

**Активировать конфигурацию:**

```bash
# Создать симлинк
sudo ln -s /etc/nginx/sites-available/whisperflow /etc/nginx/sites-enabled/

# Удалить дефолтную конфигурацию
sudo rm /etc/nginx/sites-enabled/default

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

### Шаг 6: Настройка SSL (Let's Encrypt)

```bash
# Получить SSL сертификат
sudo certbot --nginx -d api.yourdomain.com

# Certbot автоматически обновит конфигурацию Nginx
# и добавит HTTPS

# Проверить автообновление сертификата
sudo certbot renew --dry-run
```

### Шаг 7: Настройка Firewall

```bash
# Установить UFW
sudo apt install -y ufw

# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

## Мониторинг и логи

### Просмотр логов

```bash
# Логи Docker контейнеров
docker-compose logs -f api
docker-compose logs -f celery-worker

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
sudo journalctl -u docker -f
```

### Настройка мониторинга (опционально)

#### Prometheus + Grafana

```bash
# Добавить в docker-compose.yml
# См. примеры в документации
```

#### Uptime monitoring

Использовать сервисы:
- UptimeRobot (бесплатно до 50 мониторов)
- Uptime Kuma (self-hosted)

## Резервное копирование

### База данных

```bash
# Создать backup PostgreSQL
docker-compose exec postgres pg_dump -U whisperflow whisperflow > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
docker-compose exec -T postgres psql -U whisperflow whisperflow < backup_20240101_120000.sql
```

### Автоматический backup (cron)

```bash
# Создать скрипт backup
nano ~/backup.sh
```

**Содержимое скрипта:**

```bash
#!/bin/bash
BACKUP_DIR="/home/whisperflow/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T postgres pg_dump -U whisperflow whisperflow > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Добавить в cron:**

```bash
chmod +x ~/backup.sh

# Открыть crontab
crontab -e

# Добавить строку (backup каждый день в 2:00 AM)
0 2 * * * /home/whisperflow/backup.sh >> /home/whisperflow/backup.log 2>&1
```

## Обновление приложения

```bash
# Перейти в директорию
cd ~/whisperflow

# Получить последние изменения
git pull origin main

# Пересобрать и перезапустить
docker-compose down
docker-compose up -d --build

# Применить миграции
docker-compose exec api alembic upgrade head
```

## Оценка стоимости

### Сервер (MVP)

- **VPS**: €7-15 в месяц (~₽700-1500)
- **Domain**: €10-15 в год (~₽100 в месяц)
- **SSL**: Бесплатно (Let's Encrypt)

**Итого**: ~₽800-1600 в месяц

### OpenAI API

См. ARCHITECTURE.md для детальной оценки.

**Примерная стоимость на 1 пользователя** (активное использование):
- 10 часов аудио = $3.60
- 100 форматирований = $0.20
- **Итого**: ~$4 в месяц (~₽400)

### Общая оценка для MVP (10 активных пользователей)

- **Сервер**: ₽1000/мес
- **OpenAI API**: ₽4000/мес (10 пользователей × ₽400)
- **Домен**: ₽100/мес
- **Резерв**: ₽500/мес

**Итого**: ~₽5600/месяц (~$56)

## Проблемы и решения

### Проблема: Недостаточно памяти

**Решение:**
```bash
# Добавить swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Проблема: Docker контейнеры падают

**Решение:**
```bash
# Проверить ресурсы
docker stats

# Увеличить лимиты памяти в docker-compose.yml
services:
  api:
    mem_limit: 2g
```

### Проблема: Медленная транскрипция

**Причины:**
- Низкая скорость интернета к OpenAI API
- Недостаточно ресурсов CPU/RAM

**Решения:**
- Увеличить ресурсы сервера
- Использовать CDN или proxy ближе к OpenAI
- Оптимизировать размер аудио файлов

## Контрольный чек-лист развертывания

- [ ] Сервер арендован и настроен
- [ ] Docker и Docker Compose установлены
- [ ] Репозиторий склонирован
- [ ] .env файл настроен с API ключами
- [ ] docker-compose up успешно запущен
- [ ] Миграции БД применены
- [ ] Nginx настроен как reverse proxy
- [ ] SSL сертификат установлен
- [ ] Firewall настроен
- [ ] Backup скрипт создан и настроен cron
- [ ] Мониторинг настроен
- [ ] Тестирование API endpoints выполнено
- [ ] Desktop приложение может подключиться

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Проверьте системные ресурсы: `htop`, `df -h`
4. Проверьте настройки Nginx: `sudo nginx -t`
5. Проверьте firewall: `sudo ufw status`

## Дополнительные ресурсы

- [Docker Documentation](https://docs.docker.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
