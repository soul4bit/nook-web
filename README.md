# Контур знаний

<p align="center">
  <img src="docs/images/logo-mark.svg" alt="Kontur Znaniy logo" width="120" />
</p>

<p align="center">
  <img src="docs/images/hero.png" alt="Kontur Znaniy hero" width="100%" />
</p>

Self-hosted DevOps wiki для внутренней команды: структурированные разделы, статьи в Markdown, ролевой доступ, модерация регистрации, рейтинг активности и админ-панель.

## Возможности

- Авторизация:
  - вход/выход с сессионными cookie
  - регистрация с модерацией через Telegram
  - подтверждение email перед активацией аккаунта
- Роли:
  - `viewer` (только просмотр)
  - `editor` (создание/редактирование/удаление статей)
  - `admin` (полный доступ и управление пользователями)
- Статьи:
  - Markdown-редактор с toolbar и превью
  - автосохранение черновиков для создания/редактирования
  - загрузка изображений (S3-совместимое хранилище)
  - комментарии с проверкой прав на удаление
  - лайки статей (с защитой от лайка собственной статьи)
- Рейтинг и ранги:
  - XP за создание статьи и за лайк статьи
  - ранги пользователя с прогрессом до следующего звания
  - настраиваемые XP и пороги рангов через `.env`
- Админ-панель (`/app/admin/users`):
  - одобрение/отклонение заявок на регистрацию
  - смена ролей пользователей
  - изменение рейтинга пользователей
  - блокировка/разблокировка пользователей
  - удаление пользователей
  - журнал действий администратора с пагинацией (7 записей на страницу)
- Безопасность:
  - CSRF-защита для изменяющих действий
  - rate limiting для login/register
  - хеширование паролей через bcrypt

## Стек

- Go (`net/http`, `html/template`)
- PostgreSQL (`database/sql`, `pgx`)
- Vanilla CSS + JavaScript
- Telegram Bot API (модерация регистрации)
- SMTP (подтверждение email)
- S3-совместимое объектное хранилище (медиа)

## Требования

- Go 1.23+ (или совместимый современный Go toolchain)
- PostgreSQL 14+
- SMTP-аккаунт
- Telegram bot token и admin chat ID
- Опционально: S3-совместимый bucket для загрузки медиа

## Быстрый старт

1. Скопируйте env-файл:

```bash
cp .env.example .env
```

2. Заполните обязательные переменные в `.env`:

- `DATABASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
- опционально для медиа:
  - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_BASE_URL`
- опционально для рейтинга:
  - `DEFAULT_USER_RATING`
  - `ARTICLE_CREATE_RATING_XP`, `ARTICLE_LIKE_RATING_XP`
  - `RANK_APPRENTICE_MIN_RATING`, `RANK_EXPERT_MIN_RATING`, `RANK_MASTER_MIN_RATING`

3. Запуск:

```bash
go mod download
go run ./cmd/server
```

4. Откройте:

`http://localhost:8080`


## Как назначить первого администратора

Если в системе ещё нет администратора, назначьте роль вручную:

```sql
update users
set role = 'admin'
where email = 'you@example.com';
```

## Тесты

```bash
go test ./...
```

## Деплой

- workflow GitHub Actions: `.github/workflows/deploy.yml`
- пример service unit: `deploy/kontur-znaniy.service`

## Интерфейс

<p align="center">
  <img src="docs/images/dashboard.png" alt="Dashboard preview" width="100%" />
</p>
