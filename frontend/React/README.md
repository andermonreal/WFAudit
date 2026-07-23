# WFAudit — React Frontend

The primary web UI for **WFAudit**, the WiFi security auditing platform. Built with React 19 + Vite. It talks to the FastAPI backend at `http://localhost:8000`.

> You normally **don't run this directly** — use the project control script from the repo root, which starts the backend and both interfaces together:
>
> ```bash
> sudo ./wfaudit start        # → http://localhost:5173
> ```
>
> See the [main README](../../README.md) for full setup and usage.

## Running standalone (development)

```bash
npm install
npm run dev -- --host      # dev server on http://localhost:5173
```

The backend must be running on port 8000 for the UI to work. The backend base URL is defined at the top of [`src/App.jsx`](src/App.jsx).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Production build into `dist/`. |
| `npm run preview` | Preview the production build. |
| `npm run lint` | Run ESLint. |
