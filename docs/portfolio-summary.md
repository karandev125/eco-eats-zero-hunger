# Portfolio Summary

Use this file as source material for GitHub profile copy, resume bullets, application answers, and interview prep.

## One-Line Pitch

Eco Eats is a hardware AI food rescue platform that uses MQ/DHT sensor telemetry, freshness scoring, and route optimization to dispatch surplus food before it becomes waste.

## Short Project Description

Built a full-stack hardware AI logistics prototype for surplus food rescue. An MCU-based sensor flow sends MQ gas and DHT temperature/humidity readings through Google Sheets or API ingestion. The backend converts those readings into freshness state, effective expiry, route feasibility, and demand-center allocation scores. The React frontend presents the result through dashboards, a Freshness Lab, route analysis, maps, and a prioritized dispatch queue.

## Resume Bullets

- Built a hardware AI food rescue platform with React, Vite, Express, MongoDB, Mongoose, MQ/DHT telemetry, and Google Sheets ingestion.
- Implemented an explainable freshness decision engine that converts gas, temperature, and humidity readings into freshness score, safety state, confidence, and sensor-adjusted delivery deadlines.
- Integrated geocoding and road-route analysis to evaluate whether a pickup can be delivered before the effective freshness deadline.
- Designed operations surfaces for donors, receivers, and coordinators, including dashboards, route analyzer, Freshness Lab, demand-center matching, and dispatch queue.
- Added backend tests for allocation scoring, freshness modeling, telemetry handling, Sheets ingestion, location services, and food-route behavior.

## Interview Talking Points

- **Hardware AI framing:** The physical sensor layer captures food-condition telemetry; the software layer turns it into explainable routing decisions.
- **Problem framing:** Perishable food rescue fails when teams only know inventory, not freshness risk or route feasibility.
- **Decision engine:** v1 uses deterministic, auditable intelligence rather than claiming a black-box ML model.
- **System design:** Routes, telemetry, freshness, allocation, food, auth, and demand-center workflows are split into focused services and APIs.
- **Practical integration:** Google Sheets support makes the hardware telemetry path demo-friendly and easy to inspect.
- **Future work:** ML spoilage prediction, notification workflows, multi-stop routing, production deployment, and richer food safety auditing.

## Suggested GitHub Description

Hardware AI food rescue platform using MQ/DHT telemetry, freshness scoring, route feasibility, and demand-center dispatch for surplus food.

## Suggested Topics

`hardware-ai`, `iot`, `mq-sensor`, `dht-sensor`, `react`, `vite`, `nodejs`, `express`, `mongodb`, `mongoose`, `leaflet`, `food-rescue`, `zero-hunger`, `routing`, `sustainability`, `portfolio-project`
