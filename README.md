# Контур Знаний

![Логотип](./public/branding/logo-lockup.svg)

Приватная командная DevOps-вики на `Next.js + PostgreSQL + Better Auth`.

- Пишете статьи в редакторе (Tiptap)
- Храните знания в `markdown + html + json`
- Ищете по базе через PostgreSQL FTS
- Связываете статьи wiki-ссылками `[[slug-статьи]]`

![Обложка проекта](./public/readme/hero.svg)

## Возможности

- Авторизация/регистрация на `Better Auth`
- Ручная модерация регистрации через Telegram (approve/reject)
- Подтверждение email и восстановление пароля
- Anti-spam guard для auth-эндпоинтов (rate limit + журнал причин в PostgreSQL)
- Личный кабинет: аватар, смена пароля, ограничение смены пароля по времени
- Единая приватная база статей для всех авторизованных пользователей
- CRUD статей
- Категории и темы: Linux, Docker, Сети, Ansible, K8S, Terraform, CI/CD
- Хранение статьи в трех видах: `content_markdown`, `content_html`, `content_json`
- Загрузка картинок в статьи
- Подсветка кода + кнопка «Копировать»
- Wiki-ссылки между статьями
- Полнотекстовый поиск

## Архитектура

![Схема архитектуры](./public/readme/architecture.svg)

## Технологии

- `Next.js 16` (App Router)
- `React 19`
- `TypeScript`
- `Tailwind CSS + shadcn/ui`
- `Tiptap`
- `PostgreSQL (pg)`
- `Better Auth`
- `Nodemailer`
- `highlight.js`

## Структура проекта

```text
src/app
  /auth                 страницы входа/регистрации/сброса
  /app                  основной интерфейс вики
  /api/auth             Better Auth handler
  /api/auth-guard       защищенные auth-роуты
  /api/articles         API статей
  /api/account          API профиля (аватар/пароль)

src/lib
  /auth                 конфиг Better Auth + guard + сообщения
  /articles             работа со статьями в БД
  /account              логика профиля
  /mail                 SMTP

scripts
  миграции auth/guard/articles/account + создание админа
```

## Требования

- Node.js `22+`
- PostgreSQL `14+` (рекомендуется)
- SMTP-ящик для писем подтверждения и сброса пароля

## Быстрый старт (локально)

1. Установите зависимости:
   ```bash
   npm ci
   ```
2. Скопируйте переменные окружения:
   ```bash
   cp .env.example .env.local
   ```
3. Заполните `.env.local`.
4. Выполните миграции:
   ```bash
   npm run auth:migrate
   npm run auth:guard:migrate
   npm run registration:migrate
   npm run articles:migrate
   npm run account:migrate
   ```
5. (Опционально) создайте администратора:
   ```bash
   npm run admin:create -- --email=admin@example.com --password=CHANGE_ME --name="Admin"
   ```
6. Запустите проект:
   ```bash
   npm run dev
   ```
7. Откройте `http://localhost:3000`.

## Переменные окружения

Пример: [`.env.example`](./.env.example)

```env
DATABASE_URL=postgres://nook:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/nook
BETTER_AUTH_SECRET=CHANGE_ME_LONG_RANDOM_SECRET
BETTER_AUTH_URL=http://localhost:3000
SMTP_HOST=CHANGE_ME
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=nook@example.com
SMTP_PASSWORD=CHANGE_ME_MAIL_PASSWORD
MAIL_FROM="Nook <nook@example.com>"
TELEGRAM_BOT_TOKEN=CHANGE_ME_TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID=123456789
```

Комментарии:

- `DATABASE_URL`: подключение к PostgreSQL
- `BETTER_AUTH_SECRET`: длинный случайный секрет для сессий/токенов
- `BETTER_AUTH_URL`: внешний URL приложения (обязательно поменять на проде)
- `SMTP_*` и `MAIL_FROM`: отправка писем подтверждения и сброса пароля
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ADMIN_CHAT_ID`: модерация новых регистраций через Telegram

## PostgreSQL: минимальная инициализация

```sql
CREATE USER nook WITH ENCRYPTED PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE nook OWNER nook;
GRANT ALL PRIVILEGES ON DATABASE nook TO nook;
```

## Полезные npm-скрипты

```bash
npm run dev
npm run build
npm run start
npm run lint

npm run auth:sql
npm run auth:migrate
npm run auth:guard:migrate
npm run registration:migrate
npm run articles:migrate
npm run account:migrate

npm run admin:create -- --email=admin@example.com --password=CHANGE_ME --name="Admin"
```

## Деплой

### Вручную на VPS

```bash
cd /var/www/nook
git pull --ff-only origin main
npm ci
npm run auth:migrate
npm run auth:guard:migrate
npm run registration:migrate
npm run account:migrate
npm run articles:migrate
npm run build
sudo systemctl restart nook
sudo systemctl status nook --no-pager
```

### Автодеплой через GitHub Actions

В проекте есть workflow: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

Нужные secrets в GitHub:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KEY`

Pipeline делает:

- `git pull`
- `npm ci`
- миграции
- `npm run build`
- `systemctl restart nook`

## Частые проблемы

### `Better Auth env vars missing: DATABASE_URL and BETTER_AUTH_SECRET`

Не заполнены переменные в `.env.local`.

### `password authentication failed for user "nook"`

Неверный пароль в `DATABASE_URL` или пароль пользователя PostgreSQL.

### `Слишком много попыток входа...`

Сработал rate limit в `auth_guard_events`. Можно очистить счетчики в БД для нужного email/IP.

### `Форма устарела` / `Слишком быстрый запрос`

Обновите страницу и повторите ввод.

### `NXDOMAIN` при выпуске сертификата

Домен еще не резолвится в DNS или неверный punycode.

## Планы

- История версий статей и diff
- Экспорт/импорт базы (`markdown + assets`)
- Backlinks и граф связей
- Роли/ACL для командной работы

---

Проект приватный, для личной базы знаний и небольших команд.
