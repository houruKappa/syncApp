# Команды для запуска проекта SyncWatch

## 🚀 Быстрый старт (рекомендуется)

### Запуск с Docker Compose

```powershell
# Перейдите в директорию проекта
cd c:\Users\sor6s\Desktop\syncApp

# Запустите все сервисы
docker-compose up -d

# Проверьте статус
docker-compose ps

# Просмотр логов
docker-compose logs -f

# Остановка сервисов
docker-compose down
```

После запуска откройте:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health check**: http://localhost:5000/health

---

## 💻 Локальная разработка

### 1. Установка зависимостей Backend

```powershell
cd backend

# Установка пакетов
npm install

# Создание .env файла
copy .env.example .env

# Откройте .env и настройте параметры подключения
```

### 2. Запуск Backend

```powershell
# В режиме разработки (hot reload)
npm run dev

# Или production build
npm run build
npm start
```

### 3. Установка зависимостей Frontend

```powershell
cd ..\frontend

# Установка пакетов
npm install

# Создание .env файла
copy .env.example .env
```

### 4. Запуск Frontend

```powershell
# В режиме разработки
npm start

# Production build
npm run build
```

---

## 🗄️ Настройка базы данных (без Docker)

### PostgreSQL

```powershell
# Подключитесь к PostgreSQL
psql -U postgres

# Создайте базу данных
CREATE DATABASE syncwatch;

# Выйдите
\q
```

Таблицы создадутся автоматически при первом запуске backend.

### Redis

```powershell
# Запустите Redis server
redis-server

# Или установите как Windows Service
```

---

## 🧪 Тестирование приложения

### 1. Регистрация пользователей

Откройте http://localhost:3000 и создайте двух пользователей:

**Пользователь 1:**
- Email: user1@test.com
- Username: User One
- Password: password123

**Пользователь 2:**
- Email: user2@test.com
- Username: User Two
- Password: password123

### 2. Создание комнаты

Войдите как User One:
1. Нажмите "Создать комнату"
2. Название: "Тестовая комната"
3. YouTube URL: https://www.youtube.com/watch?v=jNQXAC9IVRw
4. Публичная: ✓
5. Создать

### 3. Присоединение к комнате

В другом окне (или инкогнито):
1. Войдите как User Two
2. Найдите "Тестовую комнату"
3. Нажмите "Присоединиться"

### 4. Тестирование функций

**Синхронизация видео (User One - модератор):**
- Нажмите Play - видео начнется у обоих
- Нажмите Pause - видео остановится у обоих

**Чат:**
- Отправьте сообщения от обоих пользователей
- Проверьте, что они видны в реальном времени

**Очередь видео:**
- Добавьте видео в очередь
- User One может переключаться между видео

---

## 🛠️ Полезные команды

### Docker

```powershell
# Пересоздать контейнеры
docker-compose up -d --build

# Просмотр логов конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Зайти в контейнер
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres syncwatch

# Очистить все (включая volumes)
docker-compose down -v

# Перезапустить конкретный сервис
docker-compose restart backend
```

### Backend

```powershell
cd backend

# Линтинг
npm run lint

# Форматирование
npm run format

# Тестирование
npm test

# Сборка
npm run build
```

### Frontend

```powershell
cd frontend

# Линтинг
npm run lint

# Тестирование
npm test

# Production build
npm run build
```

### База данных

```powershell
# Подключение к PostgreSQL в Docker
docker-compose exec postgres psql -U postgres syncwatch

# Просмотр таблиц
\dt

# Просмотр пользователей
SELECT id, email, username FROM users;

# Просмотр комнат
SELECT id, name, creator_id, is_public FROM rooms;

# Выход
\q
```

### Redis

```powershell
# Подключение к Redis в Docker
docker-compose exec redis redis-cli

# Просмотр всех ключей
KEYS *

# Просмотр участников комнаты
SMEMBERS room:ROOM_ID:users

# Выход
exit
```

---

## 🔍 Отладка

### Проверка портов

```powershell
# Проверить, какой процесс использует порт
netstat -ano | findstr :3000
netstat -ano | findstr :5000
netstat -ano | findstr :5432
```

### Просмотр логов

```powershell
# Backend логи
cd backend
Get-Content logs\combined.log -Tail 50 -Wait

# Docker логи
docker-compose logs -f --tail=50
```

### Очистка

```powershell
# Удалить node_modules и переустановить
cd backend
Remove-Item -Recurse -Force node_modules
npm install

cd ..\frontend
Remove-Item -Recurse -Force node_modules
npm install
```

---

## 📝 Переменные окружения

### backend\.env

```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=syncwatch
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=change-this-secret-key-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=change-this-refresh-key
JWT_REFRESH_EXPIRES_IN=30d
CORS_ORIGIN=http://localhost:3000
MAX_FILE_SIZE=209715200
```

### frontend\.env

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=http://localhost:5000
```

---

## 🚨 Решение проблем

### Порт уже используется

```powershell
# Найти процесс
netstat -ano | findstr :5000

# Остановить процесс (замените PID)
taskkill /PID [PID] /F
```

### Docker проблемы

```powershell
# Полная очистка Docker
docker-compose down -v
docker system prune -a

# Пересоздание
docker-compose up -d --build
```

### База данных не создается

```powershell
# Проверьте логи PostgreSQL
docker-compose logs postgres

# Пересоздайте volume
docker-compose down -v
docker-compose up -d
```

---

## 📚 Дополнительная документация

- [SETUP.md](SETUP.md) - Подробная инструкция по установке
- [TECHNICAL.md](TECHNICAL.md) - Техническое описание проекта
- [README.md](README.md) - Общая информация о проекте

---

## ✅ Чеклист перед деплоем

- [ ] Изменить JWT_SECRET и JWT_REFRESH_SECRET
- [ ] Настроить production DATABASE_URL
- [ ] Настроить production REDIS_URL
- [ ] Установить CORS_ORIGIN на production домен
- [ ] Настроить HTTPS
- [ ] Настроить резервное копирование БД
- [ ] Настроить мониторинг и логирование
- [ ] Протестировать все функции
- [ ] Настроить CDN для статических файлов
- [ ] Настроить rate limiting

---

**Удачи с проектом SyncWatch! 🎉**
