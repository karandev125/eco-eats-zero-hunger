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
