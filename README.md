# Hotelv2

LuxeStay is a PHP hotel booking and admin portal with room browsing, reservations, loyalty rewards, employee management, and a small concierge chat experience.

## Stack

- PHP
- MySQL / MariaDB via `mysqli`
- Tailwind via CDN
- File-based runtime storage for sessions and uploaded discount proofs

## What is safe to commit

This repository is prepared so GitHub only receives source code and starter files.

Ignored local/runtime items:

- `.env`
- `cc.txt`
- `storage/state.json`
- `storage/php-server.pid`
- `storage/sessions/*`
- `storage/discount-proofs/*`

## Local setup

1. Copy `.env.example` to `.env`.
2. Update the database values in `.env` if your MySQL credentials differ.
3. Make sure PHP has the `mysqli` extension enabled.
4. Start MySQL.
5. Run the PHP server from the project root.

Example with XAMPP on Windows:

```powershell
C:\xampp\php\php.exe -S localhost:8000
```

Then open `http://localhost:8000`.

## Database behavior

The app creates the configured database automatically if it does not exist and seeds starter data on first run.

Default sample accounts:

- Admin: `jayrpf` / `admin`
- User: `guest` / `guest`

Superadmin actions use the `SUPERADMIN_CODE` value from `.env`.

## Folder notes

- `index.php` handles routing.
- `php/bootstrap.php` contains bootstrapping, seeding, and persistence helpers.
- `views/` contains page templates.
- `static/` contains CSS and client-side JavaScript.
- `storage/` is for runtime-only files and should stay mostly untracked.

## Publishing to GitHub

1. Initialize git if needed: `git init`
2. Review ignored files with `git status`
3. Add the project: `git add .`
4. Commit: `git commit -m "Prepare Hotelv2 for GitHub"`
5. Create a GitHub repo and push your branch

## Deployment note

For shared hosting or a VPS, point the web root at this project directory, provide the `.env` file on the server, and ensure PHP can write to `storage/sessions` and `storage/discount-proofs`.
