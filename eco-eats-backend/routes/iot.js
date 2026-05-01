const mongoose = require('mongoose');
const router = require('express').Router();
const {
    buildFreshnessSnapshot
} = require('../services/freshnessService');
const { TelemetryError, attachTelemetryToFood } = require('../services/telemetryService');
const {
    getSheetsStatus,
    importTelemetryFromSheets
} = require('../services/sheetsTelemetryService');

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

function requireSyncToken(req, res) {
    if (!process.env.SHEETS_SYNC_TOKEN) {
        res.status(503).json({ message: 'SHEETS_SYNC_TOKEN is required before Google Sheets sync can run.' });
        return false;
    }

    const token = req.get('x-sync-token');
    if (token === process.env.SHEETS_SYNC_TOKEN) return true;

    res.status(401).json({ message: 'Invalid Google Sheets sync token.' });
    return false;
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

        const { foodItem, freshness } = await attachTelemetryToFood(req.body);

        return res.status(200).json({
            message: 'Telemetry received.',
            foodItemId: foodItem._id,
            deviceId: foodItem.deviceId,
            freshness
        });
    } catch (err) {
        if (err instanceof TelemetryError) {
            return res.status(err.statusCode).json({ message: err.message });
        }

        return res.status(500).json({ message: 'Failed to process telemetry.', error: err.message });
    }
});

router.get('/sheets/status', (req, res) => {
    if (!requireSyncToken(req, res)) return null;

    return res.status(200).json({
        ...getSheetsStatus(),
        databaseReady: databaseReady()
    });
});

router.post('/sheets/import', async (req, res) => {
    try {
        if (!requireSyncToken(req, res)) return null;

        if (!databaseReady()) {
            return res.status(503).json({ message: 'Database is unavailable. Google Sheets telemetry cannot be imported yet.' });
        }

        const summary = await importTelemetryFromSheets();
        return res.status(200).json(summary);
    } catch (err) {
        return res.status(500).json({ message: 'Failed to import Google Sheets telemetry.', error: err.message });
    }
});

module.exports = router;
