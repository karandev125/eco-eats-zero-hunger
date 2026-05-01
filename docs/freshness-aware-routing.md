# Freshness-Aware Routing

Eco Eats now treats hardware freshness as an allocation signal. The device sends temperature,
humidity, and gas readings. The backend converts those readings into a freshness score, a safety
state, and an effective delivery deadline. Route feasibility and match ranking use that effective
deadline instead of only the donor's static expiry time.

## Hardware Telemetry

Send telemetry to:

```text
POST /api/iot/telemetry
```

Example payload:

```json
{
  "foodItemId": "MONGO_FOOD_ITEM_ID",
  "deviceId": "eco-device-001",
  "temperatureC": 7.4,
  "humidityPct": 62,
  "gasLevel": 28,
  "readingAt": "2026-05-01T10:30:00.000Z"
}
```

Use either `foodItemId` or a `deviceId` linked to an active food listing. If `IOT_DEVICE_TOKEN`
is set in backend `.env`, include it as:

```text
x-device-token: YOUR_TOKEN
```

## Freshness Preview

The simulator uses:

```text
POST /api/iot/freshness-preview
```

This endpoint does not need MongoDB. It returns:

- `score`: freshness from 0 to 100.
- `state`: `excellent`, `good`, `watch`, `critical`, `unsafe`, or `unknown`.
- `effectiveExpiryDate`: sensor-adjusted delivery deadline.
- `remainingShelfLifeMinutes`: live route window.
- `signals`: human-readable reasons behind the score.

## Demand Matching

Create demand centers:

```text
POST /api/demand-centers
```

Rank destinations for one food listing:

```text
GET /api/demand-centers/matches/:foodItemId
```

The match score considers:

- current freshness state and effective expiry;
- route duration and distance;
- meals available;
- demand urgency and meal need;
- accepted food categories;
- unsafe food exclusion.

## Demo Flow

1. Start backend and frontend.
2. Open `/freshness-lab`.
3. Move the temperature, humidity, and gas sliders.
4. Watch freshness score and delivery deadline update.
5. Attach telemetry to a real food item when MongoDB is configured.
6. Add demand centers, then rank best destinations for a food item.
