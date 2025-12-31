# Техническое описание проекта SyncWatch

## Обзор архитектуры

SyncWatch - это полнофункциональная веб-платформа для синхронизированного просмотра видео в реальном времени. Проект реализует микросервисную архитектуру с разделением на frontend и backend компоненты.

## Технологический стек

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 14+
- **Cache/PubSub**: Redis 7+
- **Real-time**: Socket.io
- **Authentication**: JWT
- **File Upload**: Multer
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, bcrypt, CORS

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **UI Framework**: Material-UI (MUI)
- **Real-time**: Socket.io-client
- **HTTP Client**: Axios
- **Routing**: React Router v6
- **Video Player**: Video.js

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (для фронтенда)
- **Process Manager**: PM2 (опционально)

## Основные модули

### 1. Аутентификация и авторизация
- Регистрация пользователей с валидацией
- JWT-based аутентификация
- Refresh токены для продления сессий
- Middleware для защиты роутов

### 2. Управление пользователями
- Профиль пользователя
- Загрузка и хранение аватаров
- История посещенных комнат

### 3. Видеокомнаты
- Создание публичных/приватных комнат
- Защита паролем
- Система модераторов
- Автоматическое истечение комнат (24 часа)
- Список участников онлайн

### 4. Синхронизация видео
- Real-time синхронизация через WebSocket
- Поддержка YouTube видео
- Поддержка загруженных видео (MP4, WebM)
- Синхронизация действий: play, pause, seek
- Автоматическая синхронизация при входе

### 5. Система чата
- Текстовый чат в реальном времени
- Системные уведомления
- Отображение аватаров и имен
- Временные метки сообщений

### 6. Очередь видео
- Добавление видео в очередь
- Управление очередью (только модератор)
- Автоматический переход к следующему видео
- История просмотренных видео

## Схема базы данных

### Users (Пользователи)
```sql
- id: UUID (PK)
- email: VARCHAR(255) UNIQUE
- username: VARCHAR(100)
- password_hash: VARCHAR(255)
- avatar_url: VARCHAR(500)
- created_at: TIMESTAMP
- last_seen: TIMESTAMP
```

### Rooms (Комнаты)
```sql
- id: UUID (PK)
- name: VARCHAR(255)
- creator_id: UUID (FK → users)
- is_public: BOOLEAN
- password_hash: VARCHAR(255)
- current_video_url: VARCHAR(1000)
- current_video_time: FLOAT
- player_state: VARCHAR(20)
- created_at: TIMESTAMP
- expires_at: TIMESTAMP
```

### RoomUsers (Участники комнат)
```sql
- room_id: UUID (FK → rooms)
- user_id: UUID (FK → users)
- joined_at: TIMESTAMP
- is_moderator: BOOLEAN
PRIMARY KEY (room_id, user_id)
```

### Messages (Сообщения)
```sql
- id: UUID (PK)
- room_id: UUID (FK → rooms)
- user_id: UUID (FK → users)
- text: TEXT
- created_at: TIMESTAMP
```

### Videos (Загруженные видео)
```sql
- id: UUID (PK)
- original_name: VARCHAR(500)
- stored_name: VARCHAR(500)
- path: VARCHAR(1000)
- size: BIGINT
- duration: FLOAT
- room_id: UUID (FK → rooms)
- uploaded_by: UUID (FK → users)
- uploaded_at: TIMESTAMP
- expires_at: TIMESTAMP
```

### VideoQueue (Очередь видео)
```sql
- id: UUID (PK)
- room_id: UUID (FK → rooms)
- video_url: VARCHAR(1000)
- video_title: VARCHAR(500)
- added_by: UUID (FK → users)
- queue_position: INTEGER
- is_played: BOOLEAN
- added_at: TIMESTAMP
```

## WebSocket архитектура

### Подключение
1. Клиент подключается с JWT токеном в auth параметре
2. Сервер валидирует токен через middleware
3. Socket привязывается к userId

### События комнаты

**join-room**
- Клиент присоединяется к Socket.io room
- Сохранение в Redis (socket:id → roomId)
- Добавление в множество участников (room:id:users)
- Отправка текущего состояния комнаты
- Уведомление других участников

**player-action**
- Проверка прав модератора
- Обновление состояния в БД
- Broadcast всем участникам комнаты
- Синхронизация времени с timestamp

**chat-message**
- Сохранение в БД
- Broadcast с данными отправителя
- Поддержка системных сообщений

## Безопасность

### Аутентификация
- Пароли хешируются с bcrypt (salt rounds: 10)
- JWT токены с expiration
- Refresh токены для продления сессии
- HTTP-only cookies (опционально)

### API Security
- Helmet.js для HTTP заголовков
- CORS с whitelist origin
- Rate limiting (100 запросов/15 минут)
- Input validation с Joi
- SQL injection защита (параметризованные запросы)
- XSS защита (санитизация входных данных)

### File Upload
- Ограничение размера (200 МБ)
- MIME-type валидация
- Уникальные имена файлов (UUID)
- Автоматическое удаление через 24 часа

## Производительность

### Оптимизации
- Database indexes на часто используемые поля
- Redis для кэширования и pub/sub
- Connection pooling для PostgreSQL
- Gzip compression для статических файлов
- CDN для видео (в production)

### Масштабирование
- Stateless backend (можно масштабировать горизонтально)
- Redis для распределенного состояния WebSocket
- Load balancer (Nginx) для распределения нагрузки
- Separate video storage (S3)

## Мониторинг и логирование

### Winston Logger
- Уровни: error, warn, info, debug
- Файловое логирование (error.log, combined.log)
- Console output для разработки
- Structured logging

### Метрики
- API response time
- WebSocket connections count
- Active rooms count
- Database query performance

## Развертывание

### Development
```bash
docker-compose up
```

### Production
1. Обновить environment variables
2. Настроить HTTPS (Let's Encrypt)
3. Настроить reverse proxy (Nginx)
4. Настроить backup для БД
5. Настроить мониторинг
6. Настроить CDN для статики

## Будущие улучшения

### Планируемые функции
1. Голосовой/видео чат (WebRTC)
2. Реакции на видео (эмодзи)
3. Плейлисты
4. Рекомендательная система
5. Интеграция с другими платформами (Twitch, Vimeo)
6. Мобильное приложение
7. Темная/светлая тема
8. Internationalization (i18n)
9. Screen sharing
10. Записи сессий

### Технические улучшения
1. Переход на PostgreSQL pub/sub для WebSocket
2. GraphQL API
3. Server-side rendering (Next.js)
4. Progressive Web App (PWA)
5. Kubernetes deployment
6. Microservices разделение
7. Event sourcing для истории
8. Machine learning для модерации контента

## Тестирование

### Backend Tests
- Unit tests (Jest)
- Integration tests
- API endpoint tests
- WebSocket tests

### Frontend Tests
- Component tests (React Testing Library)
- Integration tests
- E2E tests (Cypress)

## Производственные требования

### Минимальные требования сервера
- CPU: 2 cores
- RAM: 4 GB
- Storage: 50 GB SSD
- Bandwidth: 100 Mbps

### Рекомендуемые для production
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 200+ GB SSD
- Bandwidth: 1 Gbps
- Backup storage

## Соответствие ТЗ

✅ Система аутентификации и авторизации
✅ Создание/присоединение к комнатам
✅ Синхронизация видеоплеера
✅ Текстовый чат в реальном времени
✅ Загрузка видеофайлов
✅ Административный интерфейс (профиль, управление комнатами)
✅ Docker развертывание
✅ REST API + WebSocket
✅ PostgreSQL + Redis
✅ React + TypeScript
✅ Material-UI
✅ JWT аутентификация
✅ Безопасность и валидация

## Контакты и поддержка

Для вопросов по проекту обращайтесь к документации или создайте issue в репозитории.
