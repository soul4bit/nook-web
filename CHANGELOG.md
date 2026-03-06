# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-06

First public release.

### Added

- Auth flow with moderation and email verification:
  - registration request via Telegram moderation
  - email verification link activation
  - session-based login/logout
- Role model:
  - `viewer`, `editor`, `admin`
- Wiki core:
  - section/subsection navigation
  - article create/edit/delete
  - article comments
- Markdown UX:
  - editor toolbar
  - live preview rendering
  - autosave drafts
- Media upload:
  - S3-compatible storage integration
  - media links for Markdown content
- Admin panel:
  - user role changes
  - block/unblock users
  - user deletion
  - registration approvals/rejections
  - admin audit entries
- Security and reliability:
  - CSRF protection
  - login/register rate limiting
  - password hashing with bcrypt
  - gzip response compression
  - static asset versioning for cache busting

### Changed

- Interface refresh with improved layout, typography, and article workflows.
- Header and navigation layout refined for desktop and mobile.

### Fixed

- Corrected article creation flow fallback when section parameter is missing.
- Fixed corrupted success text in article delete redirect.
- Removed decorative top-header divider that caused visual noise.

