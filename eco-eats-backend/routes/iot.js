const mongoose = require('mongoose');
const router = require('express').Router();
const FoodItem = require('../models/FoodItem');
const {
    buildFreshnessSnapshot,
    normalizeSensorReading
} = require('../services/freshnessService');

const MAX_SENSOR_READINGS = Number(process.env.MAX_SENSOR_READINGS_PER_ITEM || 50);

function databaseReady() {
    return mongoose.connection.readyState === 1;
}

function requireDeviceToken(req, res) {
    if (!process.env.IOT_DEVICE_TOKEN) return true;

    const token = req.get('x-device-token');
    if (token === process.env.IOT_DEVICE_TOKEN) return true;

    res.status(401).json({ message: 'Invalid IoT device token.' });
    return false;
}

function findFoodQuery(body) {
    if (body.foodItemId) return { _id: body.foodItemId };
    if (body.deviceId) {
        return {
            deviceId: body.deviceId,
            $or: [{ status: 'available' }, { status: { $exists: false } }]
        };
    }

    return null;
}

router.post('/freshness-preview', (req, res) => {
    const freshness = buildFreshnessSnapshot(req.body, {
        expiryDate: req.body.expiryDate,
        category: req.body.category,
        now: req.body.now ? new Date(req.body.now) : new Date()
    });

    return res.status(200).json(freshness);
});

router.post('/telemetry', async (req, res) => {
    try {
        if (!requireDeviceToken(req, res)) return null;

        if (!databaseReady()) {
            return res.status(503).json({ message: 'Database is unavailable. Telemetry cannot be attached yet.' });
        }

        const query = findFoodQuery(req.body);
        if (!query) {
            return res.status(400).json({ message: 'foodItemId or deviceId is required.' });
        }

        const foodItem = await FoodItem.findOne(query).sort({ createdAt: -1 });
        if (!foodItem) {
            return res.status(404).json({ message: 'No active food item found for this telemetry.' });
        }

        const reading = normalizeSensorReading(req.body);
        const freshness = buildFreshnessSnapshot({
            ...reading,
            readingAt: reading.observedAt
        }, {
            expiryDate: foodItem.expiryDate,
            category: foodItem.category
        });

        if (req.body.deviceId && !foodItem.deviceId) {
            foodItem.deviceId = req.body.deviceId;
        }

        foodItem.sensorReadings.push({
            temperatureC: reading.temperatureC,
            humidityPct: reading.humidityPct,
            gasLevel: reading.gasLevel,
            gasIndex: reading.gasIndex,
            observedAt: reading.observedAt,
            receivedAt: new Date(),
            source: reading.source
        });

        if (foodItem.sensorReadings.length > MAX_SENSOR_READINGS) {
            foodItem.sensorReadings.splice(0, foodItem.sensorReadings.length - MAX_SENSOR_READINGS);
        }

        foodItem.freshness = freshness;
        await foodItem.save();

        return res.status(200).json({
            message: 'Telemetry received.',
            foodItemId: foodItem._id,
            deviceId: foodItem.deviceId,
            freshness
        });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to process telemetry.', error: err.message });
    }
});

module.exports = router;
