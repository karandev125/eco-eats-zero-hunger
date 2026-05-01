const DEFAULT_SENSOR_STALE_MINUTES = Number(process.env.SENSOR_STALE_MINUTES || 60);

const CATEGORY_PROFILES = {
    general: { humidityMin: 35, humidityMax: 75, tempSoftMax: 8, tempHardMax: 30 },
    'prepared-meals': { humidityMin: 35, humidityMax: 75, tempSoftMax: 8, tempHardMax: 30 },
    produce: { humidityMin: 50, humidityMax: 95, tempSoftMax: 10, tempHardMax: 32 },
    bakery: { humidityMin: 25, humidityMax: 65, tempSoftMax: 25, tempHardMax: 36 },
    dairy: { humidityMin: 35, humidityMax: 75, tempSoftMax: 5, tempHardMax: 25 },
    packaged: { humidityMin: 20, humidityMax: 70, tempSoftMax: 28, tempHardMax: 40 }
};

function toNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hasSensorValues(reading = {}) {
    return ['temperatureC', 'humidityPct', 'gasLevel'].some((field) => reading[field] !== undefined && reading[field] !== null && reading[field] !== '');
}

function normalizeGasIndex(gasLevel) {
    const gas = toNumber(gasLevel);
    if (gas === null) return null;

    if (gas <= 100) return clamp(gas, 0, 100);
    return clamp((gas / 1000) * 100, 0, 100);
}

function normalizeSensorReading(reading = {}) {
    const observedAt = reading.readingAt || reading.observedAt || reading.lastSensorAt || new Date();
    const observedDate = new Date(observedAt);

    return {
        temperatureC: toNumber(reading.temperatureC ?? reading.temperature),
        humidityPct: toNumber(reading.humidityPct ?? reading.humidity),
        gasLevel: toNumber(reading.gasLevel ?? reading.gas),
        gasIndex: normalizeGasIndex(reading.gasLevel ?? reading.gas),
        observedAt: Number.isNaN(observedDate.getTime()) ? new Date() : observedDate,
        source: reading.source || 'sensor'
    };
}

function temperaturePenalty(temperatureC, profile, signals) {
    if (temperatureC === null) return 0;

    if (temperatureC > profile.tempHardMax) {
        signals.push('Temperature is above the safe operating band.');
        return 48;
    }

    if (temperatureC > profile.tempSoftMax) {
        signals.push('Temperature is accelerating freshness loss.');
        return clamp((temperatureC - profile.tempSoftMax) * 2.6, 8, 36);
    }

    if (temperatureC < -2) {
        signals.push('Temperature is below the expected chilled range.');
        return 8;
    }

    return 0;
}

function humidityPenalty(humidityPct, profile, signals) {
    if (humidityPct === null) return 0;

    if (humidityPct < profile.humidityMin) {
        signals.push('Humidity is low for this food category.');
        return clamp((profile.humidityMin - humidityPct) * 0.4, 4, 18);
    }

    if (humidityPct > profile.humidityMax) {
        signals.push('Humidity is high for this food category.');
        return clamp((humidityPct - profile.humidityMax) * 0.45, 4, 20);
    }

    return 0;
}

function gasPenalty(gasIndex, signals) {
    if (gasIndex === null) return 0;

    if (gasIndex >= 90) signals.push('Gas sensor reading indicates unsafe spoilage risk.');
    else if (gasIndex >= 75) signals.push('Gas sensor reading is critical.');
    else if (gasIndex >= 55) signals.push('Gas sensor reading needs attention.');

    return clamp(gasIndex * 0.35, 0, 35);
}

function stalenessPenalty(observedAt, now, signals) {
    const ageMinutes = (now.getTime() - observedAt.getTime()) / (1000 * 60);

    if (ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES) return 0;

    signals.push('Sensor reading is stale.');
    if (ageMinutes > DEFAULT_SENSOR_STALE_MINUTES * 4) return 22;
    return 10;
}

function stateFromScore(score, reading, profile) {
    if (reading.gasIndex !== null && reading.gasIndex >= 90) return 'unsafe';
    if (reading.temperatureC !== null && reading.temperatureC > profile.tempHardMax + 8) return 'unsafe';
    if (score < 20) return 'unsafe';
    if (score < 45 || (reading.gasIndex !== null && reading.gasIndex >= 75)) return 'critical';
    if (score < 65 || (reading.gasIndex !== null && reading.gasIndex >= 55)) return 'watch';
    if (score < 85) return 'good';
    return 'excellent';
}

function shelfLifeMultiplier(state) {
    const map = {
        excellent: 1.05,
        good: 0.9,
        watch: 0.55,
        critical: 0.25,
        unsafe: 0,
        unknown: 1
    };

    return map[state] ?? 1;
}

function calculateEffectiveExpiry(expiryDate, state, now) {
    const expiry = expiryDate ? new Date(expiryDate) : null;

    if (!expiry || Number.isNaN(expiry.getTime())) return null;
    if (state === 'unsafe') return now;

    const remainingMs = Math.max(0, expiry.getTime() - now.getTime());
    const adjustedMs = remainingMs * shelfLifeMultiplier(state);
    const effectiveExpiry = new Date(now.getTime() + adjustedMs);

    return effectiveExpiry < expiry ? effectiveExpiry : expiry;
}

function confidenceFor(reading, now) {
    const availableSignals = ['temperatureC', 'humidityPct', 'gasLevel']
        .filter((field) => reading[field] !== null).length;
    const ageMinutes = (now.getTime() - reading.observedAt.getTime()) / (1000 * 60);
    const completeness = availableSignals / 3;
    const freshness = ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES ? 1 : 0.65;

    return Number(clamp(completeness * freshness, 0, 1).toFixed(2));
}

function buildFreshnessSnapshot(reading = {}, options = {}) {
    const now = options.now || new Date();
    const expiryDate = options.expiryDate || options.expiryTimestamp;
    const category = options.category || 'general';
    const profile = CATEGORY_PROFILES[category] || CATEGORY_PROFILES.general;

    if (!hasSensorValues(reading)) {
        return {
            score: null,
            state: 'unknown',
            temperatureC: null,
            humidityPct: null,
            gasLevel: null,
            gasIndex: null,
            lastSensorAt: null,
            effectiveExpiryDate: expiryDate ? new Date(expiryDate) : null,
            remainingShelfLifeMinutes: null,
            confidence: 0,
            signals: ['No sensor telemetry yet.']
        };
    }

    const normalized = normalizeSensorReading(reading);
    const signals = [];
    const penalties = [
        temperaturePenalty(normalized.temperatureC, profile, signals),
        humidityPenalty(normalized.humidityPct, profile, signals),
        gasPenalty(normalized.gasIndex, signals),
        stalenessPenalty(normalized.observedAt, now, signals)
    ];
    const score = Math.round(clamp(100 - penalties.reduce((sum, value) => sum + value, 0), 0, 100));
    const state = stateFromScore(score, normalized, profile);
    const effectiveExpiryDate = calculateEffectiveExpiry(expiryDate, state, now);
    const remainingShelfLifeMinutes = effectiveExpiryDate
        ? Math.max(0, Math.round((effectiveExpiryDate.getTime() - now.getTime()) / (1000 * 60)))
        : null;

    if (signals.length === 0) signals.push('Sensor readings are within the expected range.');

    return {
        score,
        state,
        temperatureC: normalized.temperatureC,
        humidityPct: normalized.humidityPct,
        gasLevel: normalized.gasLevel,
        gasIndex: normalized.gasIndex,
        lastSensorAt: normalized.observedAt,
        effectiveExpiryDate,
        remainingShelfLifeMinutes,
        confidence: confidenceFor(normalized, now),
        signals
    };
}

module.exports = {
    CATEGORY_PROFILES,
    buildFreshnessSnapshot,
    normalizeGasIndex,
    normalizeSensorReading
};
