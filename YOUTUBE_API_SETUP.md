# Настройка YouTube Data API v3

## Получение API ключа

1. **Перейдите в Google Cloud Console**
   - Откройте https://console.cloud.google.com/

2. **Создайте проект (если нет)**
   - Нажмите на выпадающий список проектов вверху страницы
   - Нажмите "NEW PROJECT"
   - Введите название проекта (например, "SyncApp YouTube")
   - Нажмите "CREATE"

3. **Включите YouTube Data API v3**
   - Перейдите в раздел "APIs & Services" → "Library"
   - Найдите "YouTube Data API v3"
   - Нажмите на API и нажмите "ENABLE"

4. **Создайте API ключ**
   - Перейдите в "APIs & Services" → "Credentials"
   - Нажмите "CREATE CREDENTIALS" → "API key"
   - Ключ будет создан автоматически
   - **Важно**: Скопируйте созданный ключ

5. **Настройте ограничения (опционально, но рекомендуется)**
   - Нажмите на созданный ключ
   - В разделе "API restrictions" выберите "Restrict key"
   - Выберите "YouTube Data API v3"
   - В разделе "Application restrictions" можете:
     - Оставить "None" для разработки
     - Выбрать "HTTP referrers" и добавить домены для production
   - Нажмите "SAVE"

6. **Добавьте ключ в проект**
   - Откройте файл `frontend/.env`
   - Добавьте строку:
     ```
     REACT_APP_YOUTUBE_API_KEY=ваш_ключ_здесь
     ```
   - Сохраните файл

7. **Перезапустите фронтенд**
   ```bash
   docker-compose restart frontend
   ```
   или если разрабатываете локально:
   ```bash
   cd frontend
   npm start
   ```

## Квоты YouTube API

### Дневная квота: 10,000 единиц

**Стоимость операций:**
- Поиск видео (`search.list`): **100 единиц** за запрос
- Детали видео (`videos.list`): **1 единица** за видео

**Пример расчета для одного поиска:**
- Поиск 12 видео: 100 единиц
- Получение длительности 12 видео: 12 единиц
- **Итого**: 112 единиц за один поисковый запрос

**Примерное количество поисков в день:**
- 10,000 / 112 ≈ **89 поисковых запросов**

### Рекомендации по экономии квоты:

1. **Кэширование результатов** (TODO в будущем)
   - Сохранять популярные запросы в Redis
   - TTL: 1 час для актуальности

2. **Ограничение количества результатов**
   - Текущее: 12 видео за запрос
   - Можно уменьшить до 6-9 для экономии

3. **Мониторинг квоты**
   - Проверяйте использование в Google Cloud Console
   - "APIs & Services" → "Dashboard" → "YouTube Data API v3"

4. **Запрос увеличения квоты** (если нужно)
   - Перейдите в "IAM & Admin" → "Quotas"
   - Найдите "YouTube Data API v3"
   - Нажмите "EDIT QUOTAS" и запросите увеличение
   - Обоснуйте необходимость увеличения

## Альтернативы (если квоты не хватает)

### 1. YouTube IFrame Player API (без квоты)
- Не требует API ключа
- Только встраивание и управление плеером
- Нет поиска видео

### 2. Платный YouTube API
- Можно запросить увеличение квоты
- Обычно бесплатно увеличивают до 50,000-1,000,000 единиц

### 3. Альтернативные сервисы
- Invidious API (бесплатный прокси YouTube)
- NewPipe Extractor (open source)
- ⚠️ Нестабильны, могут нарушать ToS YouTube

## Безопасность API ключа

### ⚠️ Важно для production:

1. **Не коммитьте .env файл в Git**
   - `.env` уже в `.gitignore`
   - Используйте `.env.example` как шаблон

2. **Используйте ограничения по доменам**
   - В Google Cloud Console → Credentials
   - Добавьте HTTP referrers: `https://yourdomain.com/*`

3. **Используйте backend proxy (рекомендуется)**
   - Перенесите API ключ на backend
   - Frontend делает запросы к вашему API
   - Backend проксирует запросы к YouTube
   - Защита от кражи ключа через DevTools

### Пример backend прокси (для будущего):

```typescript
// backend/src/controllers/youtube.controller.ts
import axios from 'axios';

export const searchYouTube = async (req: Request, res: Response) => {
  const { query } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY; // Ключ на backend

  try {
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/search',
      {
        params: { part: 'snippet', q: query, type: 'video', maxResults: 12, key: apiKey }
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: 'YouTube API error' });
  }
};
```

## Troubleshooting

### "API key not valid" ошибка
- Проверьте, что ключ скопирован полностью
- Убедитесь, что YouTube Data API v3 включен
- Проверьте ограничения ключа в Google Cloud Console

### "Quota exceeded" ошибка
- Проверьте использование в Google Cloud Console
- Подождите до полуночи по Pacific Time (reset квоты)
- Запросите увеличение квоты

### Поиск не работает после добавления ключа
- Перезапустите фронтенд приложение
- Проверьте console.log в браузере (F12)
- Убедитесь, что нет пробелов до/после ключа в .env

### CORS ошибки
- YouTube API должен работать напрямую из браузера
- Если есть CORS ошибки - используйте backend proxy
- Проверьте настройки HTTP referrers в ключе

## Использование в приложении

После настройки ключа:

1. Откройте любую комнату
2. Нажмите "Добавить" в очереди видео
3. Откроется диалог с тремя вкладками:
   - **"Поиск YouTube"** - новая вкладка с поиском
   - "URL видео" - ручной ввод ссылки
   - "Загрузить с ПК" - загрузка файла

4. Введите поисковый запрос
5. Выберите видео из результатов
6. Видео добавится в очередь со всеми данными (название, автор)

## Полезные ссылки

- [Google Cloud Console](https://console.cloud.google.com/)
- [YouTube Data API Docs](https://developers.google.com/youtube/v3)
- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
