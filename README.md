# 🎬 SyncWatch - Платформа для синхронизированного просмотра видео

> Дипломный проект: Веб-приложение для совместного просмотра видео с синхронизацией в реальном времени

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## 📋 Описание

SyncWatch - это полнофункциональная веб-платформа, которая позволяет группам людей смотреть видео вместе в режиме реального времени, независимо от их географического местоположения. Проект включает в себя синхронизацию видео, текстовый чат, систему комнат и управление пользователями.

### ✨ Основные возможности

- 🎯 **Виртуальные комнаты** - Создание публичных и приватных комнат для просмотра
- ⚡ **Real-time синхронизация** - Мгновенная синхронизация видеоплеера между всеми участниками
- 💬 **Текстовый чат** - Общение в реальном времени с системными уведомлениями
- 🔐 **Безопасная аутентификация** - JWT-based система входа и регистрации
- 📹 **Поддержка YouTube** - Воспроизведение видео прямо с YouTube
- 📤 **Загрузка видео** - Возможность загружать собственные видеофайлы (MP4, WebM)
- 📋 **Очередь видео** - Создание плейлиста для последовательного просмотра
- 👥 **Система модераторов** - Управление воспроизведением и участниками
- 👤 **Профили пользователей** - Персонализация с аватарами и настройками

## 🚀 Быстрый старт

### Способ 1: Docker (Рекомендуется) 🐳

```powershell
# Клонируйте или перейдите в директорию проекта
cd c:\Users\sor6s\Desktop\syncApp

# Запустите все сервисы одной командой
docker-compose up -d

# Проверьте статус
docker-compose ps
```

**Готово!** Откройте http://localhost:3000 в браузере

### Способ 2: Локальная разработка 💻

#### Backend
```powershell
cd backend
npm install
copy .env.example .env
npm run dev
```

#### Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm start
```

## 🛠️ Технологический стек

### Backend
| Технология | Назначение |
|------------|-----------|
| Node.js + Express | Серверная платформа |
| TypeScript | Типизированный JavaScript |
| Socket.io | WebSocket для real-time |
| PostgreSQL | Реляционная база данных |
| Redis | Кэширование и pub/sub |
| JWT | Аутентификация |
| Multer | Загрузка файлов |
| Winston | Логирование |
| Joi | Валидация данных |

### Frontend
| Технология | Назначение |
|------------|-----------|
| React 18 | UI библиотека |
| TypeScript | Типизация |
| Redux Toolkit | State management |
| Material-UI | Компоненты UI |
| Socket.io-client | WebSocket клиент |
| Video.js | Видеоплеер |
| Axios | HTTP клиент |
| React Router | Маршрутизация |

### Infrastructure
| Технология | Назначение |
|------------|-----------|
| Docker | Контейнеризация |
| Docker Compose | Оркестрация |
| Nginx | Веб-сервер |

## 📁 Структура проекта

```
syncApp/
├── backend/                    # Backend приложение
│   ├── src/
│   │   ├── config/            # Конфигурации (БД, Redis)
│   │   ├── controllers/       # Контроллеры API
│   │   ├── middleware/        # Middleware (auth, validation, errors)
│   │   ├── routes/            # API маршруты
│   │   ├── socket/            # WebSocket обработчики
│   │   ├── utils/             # Утилиты (logger)
│   │   ├── validators/        # Схемы валидации
│   │   └── server.ts          # Точка входа
│   ├── uploads/               # Загруженные файлы
│   ├── logs/                  # Логи приложения
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Frontend приложение
│   ├── src/
│   │   ├── components/        # React компоненты
│   │   │   ├── Chat.tsx       # Компонент чата
│   │   │   ├── VideoPlayer.tsx # Видеоплеер
│   │   │   ├── UserList.tsx   # Список участников
│   │   │   └── VideoQueue.tsx # Очередь видео
│   │   ├── pages/             # Страницы
│   │   │   ├── Login.tsx      # Страница входа
│   │   │   ├── Register.tsx   # Регистрация
│   │   │   ├── Dashboard.tsx  # Главная
│   │   │   ├── Room.tsx       # Комната просмотра
│   │   │   └── Profile.tsx    # Профиль
│   │   ├── services/          # API и WebSocket сервисы
│   │   ├── store/             # Redux store и slices
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml          # Docker Compose конфигурация
├── .gitignore
├── README.md                   # Этот файл
├── SETUP.md                    # Детальная инструкция по установке
├── TECHNICAL.md                # Техническая документация
└── COMMANDS.md                 # Полезные команды
```

## 🔌 API Endpoints

### Аутентификация
```
POST   /api/auth/register     - Регистрация пользователя
POST   /api/auth/login        - Вход в систему
POST   /api/auth/refresh      - Обновление токена
POST   /api/auth/logout       - Выход
```

### Пользователи
```
GET    /api/user/profile      - Получить профиль
PUT    /api/user/profile      - Обновить профиль
POST   /api/user/avatar       - Загрузить аватар
GET    /api/user/history      - История комнат
```

### Комнаты
```
POST   /api/rooms             - Создать комнату
GET    /api/rooms             - Список публичных комнат
GET    /api/rooms/:id         - Информация о комнате
POST   /api/rooms/:id/join    - Присоединиться к комнате
DELETE /api/rooms/:id         - Удалить комнату
POST   /api/rooms/:id/transfer-moderator - Передать права модератора
DELETE /api/rooms/:id/users/:userId - Удалить участника
```

### Видео
```
POST   /api/videos/upload     - Загрузить видео
GET    /api/videos/:id        - Получить видео
DELETE /api/videos/:id        - Удалить видео
```

## 🔄 WebSocket Events

### Client → Server
- `join-room` - Присоединиться к комнате
- `leave-room` - Покинуть комнату
- `player-action` - Управление плеером (play/pause/seek)
- `chat-message` - Отправить сообщение
- `add-to-queue` - Добавить видео в очередь
- `play-next` - Следующее видео

### Server → Client
- `user-joined` - Пользователь присоединился
- `user-left` - Пользователь вышел
- `room-state` - Текущее состояние комнаты
- `player-sync` - Синхронизация плеера
- `new-message` - Новое сообщение в чате
- `system-message` - Системное уведомление
- `queue-updated` - Обновление очереди
- `video-changed` - Смена видео

## 📚 Документация

- **[SETUP.md](SETUP.md)** - Подробная инструкция по установке и настройке
- **[TECHNICAL.md](TECHNICAL.md)** - Техническое описание архитектуры
- **[COMMANDS.md](COMMANDS.md)** - Полезные команды для разработки

## 🧪 Тестирование

1. Зарегистрируйте двух пользователей
2. Создайте комнату от имени первого пользователя
3. Присоединитесь к комнате от имени второго пользователя
4. Протестируйте:
   - Синхронизацию воспроизведения (play/pause)
   - Отправку сообщений в чат
   - Добавление видео в очередь
   - Переключение между видео

## 🔒 Безопасность

- ✅ Пароли хешируются с bcrypt
- ✅ JWT токены с истечением
- ✅ HTTPS (в production)
- ✅ CORS защита
- ✅ Rate limiting
- ✅ Input валидация
- ✅ XSS и SQL injection защита
- ✅ Helmet.js security headers

## 📊 База данных

Схема включает 6 таблиц:
- **users** - Пользователи
- **rooms** - Комнаты просмотра
- **room_users** - Участники комнат
- **messages** - Сообщения чата
- **videos** - Загруженные видео
- **video_queue** - Очередь видео

Все таблицы создаются автоматически при первом запуске.

## 🚢 Production Deployment

### Чеклист перед деплоем:
- [ ] Изменить JWT_SECRET
- [ ] Настроить production базу данных
- [ ] Настроить HTTPS
- [ ] Настроить CORS для production домена
- [ ] Настроить резервное копирование БД
- [ ] Настроить мониторинг
- [ ] Настроить CDN для статики
- [ ] Настроить логирование

### Рекомендуемые ресурсы сервера:
- CPU: 4+ cores
- RAM: 8+ GB
- Storage: 200+ GB SSD
- Bandwidth: 1 Gbps

## 🤝 Вклад в проект

Проект создан в качестве дипломной работы. Если вы хотите внести свой вклад:

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📝 Лицензия

Distributed under the MIT License. See `LICENSE` for more information.

## 📧 Контакты

Для вопросов и предложений создайте Issue в репозитории проекта.

---

**Сделано с ❤️ для дипломного проекта**
