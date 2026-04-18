# Hotelv2

LuxeStay is now a GitHub-hostable static hotel booking app that preserves the original UI and core flows from the old localhost PHP version.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Tailwind via CDN
- Browser `localStorage` for session/data persistence

## What Changed

- Removed the PHP/MySQL/localhost dependency
- Moved seeded app data into `data/seed-state.json`
- Added a browser runtime in `static/github-runtime.js` that replaces the old backend APIs
- Added page wiring in `static/github-pages.js` for login, rewards, my-unit, and protected routes
- Kept the original LuxeStay interface in static `.html` pages

## Pages

- `index.html`
- `login.html`
- `signup.html`
- `admin.html`
- `employees.html`
- `transactions.html`
- `rewards.html`
- `my-unit.html`

## Demo Accounts

- Admin: `jayrpf` / `admin`
- User: `guest` / `guest`
- Superadmin code: `0000`

## Local Preview

Run any static file server from the project root.

Example with Python:

```powershell
python -m http.server 8002
```

Then open `http://127.0.0.1:8002/index.html`.

## GitHub Pages

1. Push this repository to GitHub.
2. In repository settings, enable GitHub Pages.
3. Use the root of the default branch as the publish source.
4. Open the published `index.html`.

## Notes

- App changes persist in the browser through `localStorage`.
- The seeded data resets if you clear browser storage.
- Discount proof uploads are simulated in browser storage instead of writing server files.
