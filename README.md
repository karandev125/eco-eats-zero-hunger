<p align="center">
  <img src="docs/assets/hardware-ai-pipeline.svg" alt="Eco Eats hardware AI pipeline" width="100%">
</p>

<h1 align="center">Eco Eats</h1>

<p align="center">
  <strong>Hardware AI for surplus food rescue.</strong><br>
  IoT telemetry, freshness scoring, and route optimization for dispatching perishable food before it becomes waste.
</p>

<p align="center">
  <a href="#hardware-ai-decision-engine"><strong>Hardware AI</strong></a> |
  <a href="#product-experience"><strong>Product</strong></a> |
  <a href="#technical-architecture"><strong>Architecture</strong></a> |
  <a href="#quick-start"><strong>Run Locally</strong></a>
</p>

---

## Project Overview

Eco Eats is a hardware AI logistics platform for rescuing surplus food. An MCU-based prototype sends **MQ gas** and **DHT temperature/humidity** readings through Google Sheets or direct API ingestion. The backend turns those readings into freshness state, sensor-adjusted expiry, route feasibility, and dispatch priority.

Most food donation apps answer: **what food is available?**

Eco Eats answers the operational question: **can this food still be delivered safely, and where should it go first?**

## Why This Matters

Perishable food rescue is a timing problem. A listing can look useful while the actual food condition is drifting because temperature rose, humidity moved outside the quality band, or spoilage gas increased. Eco Eats connects hardware telemetry with route and demand data so coordinators can make a better dispatch decision before a claim is locked.

| Without Eco Eats | With Eco Eats |
| --- | --- |
| Static food listings | Sensor-aware food condition |
| Expiry timestamp only | Effective expiry adjusted by telemetry |
| Manual route judgment | Route feasibility before claiming |
| First-come, first-served pickup | Demand-center allocation score |
| Hidden freshness risk | Explainable recommendation and risk state |

## Hardware AI Decision Engine

Eco Eats does not overclaim a trained ML model in v1. The intelligence layer is an **AI decision engine**: deterministic, explainable, and built from sensor signals, food-safety logic, routing constraints, and demand scoring.

| Input | Decision Role |
| --- | --- |
| MQ gas readings | Spoilage risk signal and unsafe threshold detection |
| DHT temperature | Q10-style freshness acceleration and safety window caps |
| DHT humidity | Category-specific quality stress |
| Sensor age | Confidence penalty when readings are stale |
| Static expiry | Baseline donor-provided deadline |
| Route duration | Checks whether delivery can beat the effective expiry |
| Demand-center profile | Urgency, meal need, category fit, and destination suitability |

The output is a dispatch recommendation: freshness score, state, effective delivery deadline, risk label, route feasibility, allocation score, and a reason the route should or should not be executed.

## Product Experience

| Surface | What It Shows |
| --- | --- |
| **Donor Dashboard** | Create surplus listings with pickup address, expiry, quantity, category, and optional device telemetry |
| **Receiver Dashboard** | Browse food ranked by urgency, freshness, and route feasibility |
| **Freshness Lab** | Simulate MQ/DHT readings, preview freshness decisions, import Google Sheets telemetry, and rank demand-center matches |
| **Route Analyzer** | Compare pickup/dropoff addresses against travel time and effective expiry |
| **Dispatch Queue** | Prioritize food-to-center routes using freshness, meals, demand, distance, and expiry risk |

## System Flow

<p align="center">
  <img src="docs/assets/system-flow.svg" alt="Eco Eats system flow from hardware telemetry to dispatch queue" width="100%">
</p>

## Technical Architecture

![Eco Eats backend logistics flow](docs/backend-logistics-flow.svg)

| Layer | Stack |
| --- | --- |
| Frontend | React 19, Vite, React Router, Axios, Leaflet |
| Backend | Node.js, Express 5, MongoDB, Mongoose, JWT auth |
| Hardware/Data | MQ gas readings, DHT temperature/humidity readings, MCU telemetry flow, Google Sheets API |
| Routing/Maps | Nominatim geocoding, OSRM routing, OpenStreetMap tiles |
| Testing | Node.js test runner, backend service/API tests, ESLint, Vite build |

## Core Features

- Hardware telemetry ingestion through direct API calls and Google Sheets import.
- Freshness model using Q10 time-temperature logic, gas stress, humidity stress, stale-reading penalty, and category profiles.
- Sensor-adjusted `effectiveExpiryDate` used by routing and allocation.
- Food listing, auth, donor dashboard, receiver dashboard, and order claim flow.
- Demand-center creation and matching by urgency, capacity, accepted categories, and route feasibility.
- Dispatch queue ranking available food against active demand centers.
- Health endpoint and degraded startup mode when MongoDB credentials are missing.
- Seed data for a clear local demo.

## Quick Start

Install dependencies:

```powershell
cd eco-eats-backend
npm.cmd install

cd ..\eco-eats-frontend
npm.cmd install
```

Create environment files:

```powershell
Copy-Item eco-eats-backend\.env.example eco-eats-backend\.env
Copy-Item eco-eats-frontend\.env.example eco-eats-frontend\.env
```

Minimum backend configuration:

```env
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/eco-eats?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

Frontend configuration:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Run the backend and frontend in separate terminals:

```powershell
cd eco-eats-backend
npm.cmd run dev
```

```powershell
cd eco-eats-frontend
npm.cmd run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Demo Data

After MongoDB is configured:

```powershell
cd eco-eats-backend
npm.cmd run seed
```

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Donor | `donor@ecoeats.demo` | `demo1234` |
| Receiver | `receiver@ecoeats.demo` | `demo1234` |

## API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend mode, database status, and missing environment values |
| `POST` | `/api/auth/register` | Create donor or receiver account |
| `POST` | `/api/auth/login` | Authenticate user |
| `GET` | `/api/food` | Search and rank available food |
| `POST` | `/api/food/add` | Create a donor food listing |
| `POST` | `/api/routes/analyze` | Calculate route feasibility and expiry risk |
| `POST` | `/api/iot/freshness-preview` | Preview sensor-based freshness without storing telemetry |
| `POST` | `/api/iot/telemetry` | Attach MQ/DHT telemetry to a food listing |
| `GET` | `/api/iot/sheets/status` | Check Google Sheets telemetry configuration |
| `POST` | `/api/iot/sheets/import` | Import hardware telemetry rows from Google Sheets |
| `GET` | `/api/demand-centers/allocations` | Build the prioritized dispatch queue |

## Verification

```powershell
cd eco-eats-backend
npm.cmd test

cd ..\eco-eats-frontend
npm.cmd run lint
npm.cmd run build
```

## Roadmap

- Train an ML spoilage prediction model using historical telemetry and confirmed outcomes.
- Add notifications when freshness windows tighten.
- Support multi-stop volunteer or fleet routing.
- Add production deployment, role authorization hardening, and richer food safety audit trails.

## Supporting Docs

- [Local development](docs/local-development.md)
- [MongoDB setup and demo seed](docs/simple-mongo-integration.md)
- [Freshness-aware routing](docs/freshness-aware-routing.md)
- [Frontend product roadmap](docs/frontend-vision-and-roadmap.md)
