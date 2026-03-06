# Kontur Znaniy

<p align="center">
  <img src="docs/images/logo-mark.svg" alt="Kontur Znaniy logo" width="120" />
</p>

<p align="center">
  <img src="docs/images/hero.png" alt="Kontur Znaniy hero" width="100%" />
</p>

Self-hosted DevOps wiki for internal teams: structured sections, Markdown articles, role-based access, moderation flow, and admin controls.

## Key Features

- Auth:
  - login/logout with session cookies
  - registration flow with moderation in Telegram
  - email verification before account activation
- Roles:
  - `viewer` (read-only)
  - `editor` (create/edit/delete articles)
  - `admin` (full access and user management)
- Articles:
  - Markdown editor with toolbar and preview
  - autosave drafts for new/edit article forms
  - image upload support (S3-compatible storage)
  - comments with delete permission checks
- Admin panel (`/app/admin/users`):
  - approve/reject registration requests
  - change user roles
  - block/unblock users
  - delete users
  - admin action audit log
- Security:
  - CSRF protection for state-changing actions
  - rate limiting for login/register flows
  - password hashing with bcrypt

## Stack

- Go (`net/http`, `html/template`)
- PostgreSQL (`database/sql`, `pgx`)
- Vanilla CSS + JavaScript
- Telegram Bot API (registration moderation)
- SMTP (email verification)
- S3-compatible object storage (media)

## Requirements

- Go 1.22+ (or compatible modern Go toolchain)
- PostgreSQL 14+
- SMTP account
- Telegram bot token and admin chat ID
- Optional: S3-compatible bucket for media uploads

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Fill required variables in `.env`:

- `DATABASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
- optional media upload:
  - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_BASE_URL`

3. Run:

```bash
go mod download
go run ./cmd/server
```

4. Open:

`http://localhost:8080`

## Main Routes

- `/auth/login`
- `/auth/register`
- `/auth/verify-email?token=...`
- `/app`
- `/app/section?slug=linux`
- `/app/article?id=<id>`
- `/app/article/new?section=linux`
- `/app/admin/users`

## Bootstrap First Admin

If there is no admin in the system yet, promote one user manually:

```sql
update users
set role = 'admin'
where email = 'you@example.com';
```

## Tests

```bash
go test ./...
```

## Deploy Notes

- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Example service unit: `deploy/kontur-znaniy.service`

## Interface Preview

<p align="center">
  <img src="docs/images/dashboard.png" alt="Dashboard preview" width="100%" />
</p>

## First Release (v1.0.0)

This repository is ready for the first public release tag.

1. Commit current changes:

```bash
git add -A
git commit -m "release: v1.0.0"
```

2. Create tag:

```bash
git tag -a v1.0.0 -m "First stable release"
```

3. Push branch and tag:

```bash
git push origin main
git push origin v1.0.0
```

4. Publish GitHub Release:

- open `https://github.com/soul4bit/kontur-znaniy/releases/new`
- select tag `v1.0.0`
- use notes from `CHANGELOG.md`
- publish release

