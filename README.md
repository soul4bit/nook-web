# Контур знаний

<p align="center">
  <img src="docs/images/hero.svg" alt="Kontur Znaniy hero" width="100%" />
</p>

Личная DevOps-вики: быстрые разделы, заметки по делу, регистрация через модерацию и удобная рабочая панель.

## Что внутри

- Авторизация и регистрация с модерацией заявок через Telegram.
- Подтверждение почты после одобрения заявки.
- Дашборд `/app` с быстрым доступом к разделам.
- Разделы и подразделы для Linux, Docker, сети, K8s, CI/CD и общего.
- Создание, просмотр и редактирование статей.
- Хранение данных в PostgreSQL.

## Интерфейс

<p align="center">
  <img src="docs/images/dashboard.svg" alt="Dashboard preview" width="100%" />
</p>

<p align="center">
  <img src="docs/images/article.svg" alt="Article view preview" width="100%" />
</p>

## Стек

- Go (`net/http`, `html/template`)
- PostgreSQL (`database/sql`, `pgx`)
- Vanilla CSS + JS
- SMTP + Telegram Bot API для регистрационного флоу

## Быстрый старт

```bash
go mod download
go run ./cmd/server
```

После запуска приложение доступно на `http://localhost:8080`.

## Основные страницы

- `/auth/login` — вход
- `/auth/register` — регистрация
- `/app` — дашборд
- `/app/section?slug=linux` — раздел
- `/app/article?id=<id>` — просмотр статьи
- `/app/article/new?section=linux` — новая статья

## Деплой

Проект уже готов под деплой через GitHub Actions:

- workflow: `.github/workflows/deploy.yml`
- target path на сервере: `/var/www/kontur-znaniy`

## Идея проекта

Контур знаний — это не блог и не CMS. Это рабочая база решений, чтобы в 03:00 не вспоминать команды по памяти, а открывать заметку и делать.
