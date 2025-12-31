# Инструкция по установке и запуску SyncWatch

## Предварительные требования

- Node.js 18+ (для локальной разработки)
- Docker и Docker Compose (для контейнеризации)
- PostgreSQL 14+ (если запускаете локально без Docker)
- Redis 7+ (если запускаете локально без Docker)

## Быстрый старт с Docker (Рекомендуется)

### 1. Запуск всего проекта

```bash
# Клонируйте проект (если еще не клонирован)
cd syncApp

# Запустите все сервисы с Docker Compose
docker-compose up -d

# Проверьте статус контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs -f
```

Приложение будет доступно:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 2. Остановка сервисов

```bash
# Остановить все сервисы
docker-compose down

# Остановить и удалить volumes (БД будет очищена)
docker-compose down -v
```

## Локальная разработка (без Docker)

### Backend

```bash
cd backend

# Установите зависимости
npm install

# Создайте файл .env на основе .env.example
copy .env.example .env

# Отредактируйте .env и укажите параметры подключения к БД и Redis

# Запустите в режиме разработки
npm run dev

# Или соберите и запустите production версию
npm run build
npm start
```

Backend будет доступен на http://localhost:5000

### Frontend

```bash
cd frontend

# Установите зависимости
npm install

# Создайте файл .env на основе .env.example
copy .env.example .env

# Запустите в режиме разработки
npm start

# Или соберите production версию
npm run build
```

Frontend будет доступен на http://localhost:3000

## Настройка базы данных

### С Docker
База данных создается автоматически при первом запуске.

### Без Docker
1. Создайте базу данных PostgreSQL:
```sql
CREATE DATABASE syncwatch;
```

2. Таблицы создаются автоматически при первом запуске backend

## Переменные окружения

### Backend (.env)

```env
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=syncwatch
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=http://localhost:5000
```

## Тестирование

### Регистрация первого пользователя

1. Откройте http://localhost:3000
2. Перейдите на страницу регистрации
3. Заполните форму:
   - Email: test@example.com
   - Имя пользователя: testuser
   - Пароль: password123

### Создание комнаты

1. После входа нажмите "Создать комнату"
2. Заполните:
   - Название: "Тестовая комната"
   - URL видео (YouTube): https://www.youtube.com/watch?v=dQw4w9WgXcQ
   - Публичная комната: ✓

### Присоединение к комнате

1. Откройте второе окно браузера (инкогнито)
2. Зарегистрируйте другого пользователя
3. На главной странице увидите созданную комнату
4. Нажмите "Присоединиться"

## Возможные проблемы и решения

### Порты заняты

Если порты 3000, 5000, 5432 или 6379 заняты:

1. Измените порты в docker-compose.yml:
```yaml
ports:
  - "3001:80"  # Frontend
  - "5001:5000"  # Backend
```

2. Обновите .env файлы соответственно

### Ошибка подключения к БД

Проверьте, что PostgreSQL запущен:
```bash
docker-compose ps postgres
```

Посмотрите логи:
```bash
docker-compose logs postgres
```

### WebSocket не подключается

1. Убедитесь, что backend запущен
2. Проверьте CORS настройки в backend/.env
3. Проверьте REACT_APP_WS_URL в frontend/.env

### Видео не воспроизводится

1. Для YouTube видео:
   - Убедитесь, что URL корректный
   - Некоторые видео могут быть заблокированы для встраивания

2. Для загруженных видео:
   - Проверьте формат (MP4, WebM, OGG)
   - Максимальный размер: 200 МБ

## Структура проекта

```
syncApp/
├── backend/                 # Backend приложение (Node.js)
│   ├── src/
│   │   ├── config/         # Конфигурации (БД, Redis)
│   │   ├── controllers/    # Контроллеры API
│   │   ├── middleware/     # Middleware (auth, validation)
│   │   ├── routes/         # API маршруты
│   │   ├── socket/         # WebSocket обработчики
│   │   ├── utils/          # Утилиты (logger)
│   │   ├── validators/     # Валидаторы данных
│   │   └── server.ts       # Точка входа
│   ├── uploads/            # Загруженные файлы
│   ├── logs/               # Логи приложения
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/               # Frontend приложение (React)
│   ├── public/
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── services/      # API и WebSocket сервисы
│   │   ├── store/         # Redux store и slices
│   │   ├── App.tsx        # Главный компонент
│   │   └── index.tsx      # Точка входа
│   ├── package.json
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml      # Docker Compose конфигурация
├── .gitignore
└── README.md
```

## API Endpoints

### Аутентификация
- POST /api/auth/register - Регистрация
- POST /api/auth/login - Вход
- POST /api/auth/refresh - Обновление токена
- POST /api/auth/logout - Выход

### Пользователи
- GET /api/user/profile - Получить профиль
- PUT /api/user/profile - Обновить профиль
- POST /api/user/avatar - Загрузить аватар
- GET /api/user/history - История комнат

### Комнаты
- POST /api/rooms - Создать комнату
- GET /api/rooms - Список публичных комнат
- GET /api/rooms/:id - Информация о комнате
- POST /api/rooms/:id/join - Присоединиться к комнате
- DELETE /api/rooms/:id - Удалить комнату

### Видео
- POST /api/videos/upload - Загрузить видео
- GET /api/videos/:id - Получить видео
- DELETE /api/videos/:id - Удалить видео

## WebSocket Events

### Client → Server
- join-room - Присоединиться к комнате
- leave-room - Покинуть комнату
- player-action - Действие с плеером (play/pause/seek)
- chat-message - Отправить сообщение в чат
- add-to-queue - Добавить видео в очередь
- play-next - Воспроизвести следующее видео

### Server → Client
- user-joined - Пользователь присоединился
- user-left - Пользователь вышел
- room-state - Состояние комнаты
- player-sync - Синхронизация плеера
- new-message - Новое сообщение
- system-message - Системное сообщение
- queue-updated - Очередь обновлена
- video-changed - Видео изменено

## Производительность и масштабирование

### Рекомендации для production:

1. **Безопасность**:
   - Смените JWT_SECRET на уникальный ключ
   - Используйте HTTPS
   - Настройте firewall

2. **База данных**:
   - Настройте резервное копирование
   - Оптимизируйте индексы
   - Мониторинг производительности

3. **Redis**:
   - Настройте persistence
   - Установите максимальный размер памяти

4. **File Storage**:
   - Используйте S3 или аналог для загруженных видео
   - Настройте CDN

5. **Мониторинг**:
   - Логирование (Winston)
   - Метрики (Prometheus)
   - Алерты

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Убедитесь в правильности .env файлов
3. Проверьте версии Node.js и Docker

## Лицензия

MIT
