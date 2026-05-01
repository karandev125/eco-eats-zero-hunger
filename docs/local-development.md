# Local Development

## One-Time Setup

Install dependencies from each app folder:

```powershell
cd eco-eats-backend
npm.cmd install

cd ..\eco-eats-frontend
npm.cmd install
```

PowerShell may block the normal `npm` shim on this machine, so use `npm.cmd`.

## Environment

Create `eco-eats-backend\.env` from `eco-eats-backend\.env.example` and set:

- `MONGO_URI`: MongoDB Atlas connection string.
- `JWT_SECRET`: long random secret.
- `PORT`: usually `5000`.
- `CORS_ORIGIN`: usually `http://localhost:5173`.
- `SENSOR_STALE_MINUTES`: defaults to `60`.
- `MAX_SENSOR_READINGS_PER_ITEM`: defaults to `50`.
- `IOT_DEVICE_TOKEN`: optional token required by `/api/iot/telemetry`.
- `GOOGLE_SHEETS_SPREADSHEET_ID`: spreadsheet used as the IoT telemetry queue.
- `GOOGLE_SHEETS_URL` or `GOOGLE_SHEETS_PUBLIC_CSV_URL`: optional public Sheet source when service-account credentials are not used.
- `GOOGLE_SHEETS_PUBLIC_GID`: tab gid for public CSV export; defaults to `0`.
- `GOOGLE_SHEETS_TELEMETRY_RANGE`: defaults to `Telemetry!A2:H`.
- `GOOGLE_SHEETS_HAS_HEADER`: set `true` when importing a public CSV with a header row.
- `GOOGLE_SHEETS_DEFAULT_DEVICE_ID`: fallback device ID for hardware sheets without a device column.
- `GOOGLE_SHEETS_IMPORT_MAX_ROWS`: latest live rows to import per run; defaults to `150`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`: service-account credentials with read access to the Sheet.
- `SHEETS_SYNC_TOKEN`: token required by `/api/iot/sheets/status` and `/api/iot/sheets/import`.
- `SHEETS_POLL_INTERVAL_MS`: optional background polling interval; set `0` to disable.

Create `eco-eats-frontend\.env` from `eco-eats-frontend\.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Run

Start the backend:

```powershell
cd eco-eats-backend
npm.cmd run dev
```

Start the frontend:

```powershell
cd eco-eats-frontend
npm.cmd run dev
```

Open the Vite URL, usually `http://localhost:5173`.

The hardware simulator is available at:

```text
http://localhost:5173/freshness-lab
```

If port `5173` is already in use, Vite will print the alternate port in `eco-eats-frontend\frontend.dev.log`.

## Verify

```powershell
cd eco-eats-backend
npm.cmd test

cd ..\eco-eats-frontend
npm.cmd run lint
npm.cmd run build
```

Health check:

```text
GET http://localhost:5000/api/health
```

Google Sheets telemetry sync:

```text
GET  http://localhost:5000/api/iot/sheets/status
POST http://localhost:5000/api/iot/sheets/import
Header: x-sync-token: SHEETS_SYNC_TOKEN
```
