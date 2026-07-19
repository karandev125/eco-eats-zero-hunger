# Eco Eats Frontend

React/Vite frontend for the Eco Eats hardware AI food rescue platform.

## Product Screens

- `Home` - hardware AI product entry point and role-specific calls to action.
- `Dashboard` - donor and receiver operations workspace with metrics, listing/order history, live route options, and map views.
- `ListItems` - receiver-facing food discovery ranked by urgency, freshness, and allocation score.
- `OrderPage` - route check and claim confirmation before food is locked.
- `RouteAnalyzer` - standalone pickup/dropoff feasibility analysis.
- `FreshnessLab` - MQ/DHT sensor simulator, freshness scoring, Google Sheets telemetry import, demand-center ranking, and dispatch queue.

## Local Setup

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Default environment:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```

The backend should be running on `http://localhost:5000` for network-backed pages. The app can render many shell screens without seeded data, but login, listings, demand centers, route allocation, and telemetry persistence require the MongoDB-backed API.
