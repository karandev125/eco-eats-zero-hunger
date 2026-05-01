const DEFAULT_SENSOR_STALE_MINUTES = Number(process.env.SENSOR_STALE_MINUTES || 60);

const CATEGORY_PROFILES = {
    general: {
        label: 'General perishables',
        tcs: true,
        idealTempC: 4,
        coldSafeMaxC: 5,
        hotHoldingMinC: null,
        dangerMaxC: 60,
        q10: 2.2,
        humidityMin: 35,
        humidityMax: 75,
        idealHumidityPct: 60,
        gasWatch: 45,
        gasCritical: 70,
        gasUnsafe: 90
    },
    'prepared-meals': {
        label: 'Prepared meals',
        tcs: true,
        idealTempC: 4,
        coldSafeMaxC: 5,
        hotHoldingMinC: 57,
        dangerMaxC: 60,
        q10: 2.4,
        humidityMin: 35,
        humidityMax: 75,
        idealHumidityPct: 60,
        gasWatch: 42,
        gasCritical: 68,
        gasUnsafe: 88
    },
    produce: {
        label: 'Fresh produce',
        tcs: false,
        idealTempC: 8,
        coldSafeMaxC: 12,
        hotHoldingMinC: null,
        dangerMaxC: 35,
        q10: 2,
        humidityMin: 55,
        humidityMax: 95,
        idealHumidityPct: 85,
        gasWatch: 50,
        gasCritical: 75,
        gasUnsafe: 92
    },
    bakery: {
        label: 'Bakery',
        tcs: false,
        idealTempC: 22,
        coldSafeMaxC: 28,
        hotHoldingMinC: null,
        dangerMaxC: 38,
        q10: 1.7,
        humidityMin: 25,
        humidityMax: 65,
        idealHumidityPct: 45,
        gasWatch: 55,
        gasCritical: 78,
        gasUnsafe: 94
    },
    dairy: {
        label: 'Dairy',
        tcs: true,
        idealTempC: 3,
        coldSafeMaxC: 5,
        hotHoldingMinC: null,
        dangerMaxC: 60,
        q10: 2.8,
        humidityMin: 35,
        humidityMax: 75,
        idealHumidityPct: 55,
        gasWatch: 38,
        gasCritical: 62,
        gasUnsafe: 85
    },
    packaged: {
        label: 'Packaged shelf-stable',
        tcs: false,
        idealTempC: 24,
        coldSafeMaxC: 32,
        hotHoldingMinC: null,
        dangerMaxC: 45,
        q10: 1.5,
        humidityMin: 20,
        humidityMax: 70,
        idealHumidityPct: 45,
        gasWatch: 65,
        gasCritical: 82,
        gasUnsafe: 95
    }
};

function toNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hasSensorValues(reading = {}) {
    return ['temperatureC', 'humidityPct', 'gasLevel', 'temperature', 'humidity', 'gas']
        .some((field) => reading[field] !== undefined && reading[field] !== null && reading[field] !== '');
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

function isHotHeld(temperatureC, profile) {
    return profile.hotHoldingMinC !== null && temperatureC !== null && temperatureC >= profile.hotHoldingMinC;
}

function temperatureBand(temperatureC, profile) {
    if (temperatureC === null) return 'unknown';
    if (profile.tcs && isHotHeld(temperatureC, profile)) return 'hot_holding';
    if (temperatureC <= profile.coldSafeMaxC) return 'safe_cold';
    if (temperatureC < profile.dangerMaxC) return profile.tcs ? 'danger_zone' : 'quality_risk';
    return 'extreme';
}

function q10Rate(temperatureC, profile) {
    if (temperatureC === null || isHotHeld(temperatureC, profile)) return 1;

    const deltaC = Math.max(0, temperatureC - profile.idealTempC);
    return Number(Math.pow(profile.q10, deltaC / 10).toFixed(2));
}

function gasStress(gasIndex, profile) {
    if (gasIndex === null) return 0;
    if (gasIndex <= profile.gasWatch) return clamp(gasIndex / profile.gasWatch * 10, 0, 10);
    if (gasIndex <= profile.gasCritical) {
        return 10 + ((gasIndex - profile.gasWatch) / (profile.gasCritical - profile.gasWatch)) * 25;
    }
    if (gasIndex <= profile.gasUnsafe) {
        return 35 + ((gasIndex - profile.gasCritical) / (profile.gasUnsafe - profile.gasCritical)) * 35;
    }
    return 90;
}

function humidityStress(humidityPct, profile) {
    if (humidityPct === null) return 0;
    if (humidityPct >= profile.humidityMin && humidityPct <= profile.humidityMax) {
        return Math.abs(humidityPct - profile.idealHumidityPct) * 0.08;
    }

    if (humidityPct < profile.humidityMin) {
        return clamp((profile.humidityMin - humidityPct) * 0.45, 4, 18);
    }

    return clamp((humidityPct - profile.humidityMax) * 0.5, 4, 22);
}

function staleStress(observedAt, now) {
    const ageMinutes = Math.max(0, (now.getTime() - observedAt.getTime()) / (1000 * 60));
    if (ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES) return 0;
    if (ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES * 2) return 8;
    if (ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES * 4) return 16;
    return 26;
}

function safetyCapMinutes(temperatureC, gasIndex, profile) {
    const band = temperatureBand(temperatureC, profile);

    if (gasIndex !== null && gasIndex >= profile.gasUnsafe) return 0;
    if (band === 'extreme') return profile.tcs ? 0 : 45;
    if (band === 'hot_holding') return null;
    if (!profile.tcs) return null;
    if (band === 'danger_zone') return temperatureC >= 32 ? 60 : 120;
    return null;
}

function buildSignals({ band, rate, gasIndex, humidityPct, profile, stalePenalty, safetyCap }) {
    const signals = [];

    if (band === 'safe_cold') {
        signals.push('Temperature is inside the recommended cold holding range for this category.');
    } else if (band === 'hot_holding') {
        signals.push('Temperature is high enough for hot holding of prepared food.');
    } else if (band === 'danger_zone') {
        signals.push('Temperature is in the time-temperature danger zone; delivery time is capped.');
    } else if (band === 'quality_risk') {
        signals.push('Temperature is above the ideal range and accelerates quality loss.');
    } else if (band === 'extreme') {
        signals.push('Temperature is outside the operating band for redistribution.');
    }

    if (rate > 1.15) {
        signals.push(`Q10 model estimates freshness loss is ${rate}x faster than ideal storage.`);
    }

    if (gasIndex !== null) {
        if (gasIndex >= profile.gasUnsafe) signals.push('Gas reading is above the unsafe spoilage threshold.');
        else if (gasIndex >= profile.gasCritical) signals.push('Gas reading is critical and indicates rapid spoilage risk.');
        else if (gasIndex >= profile.gasWatch) signals.push('Gas reading is elevated and should be prioritized.');
        else signals.push('Gas reading is within the expected range.');
    }

    if (humidityPct !== null && (humidityPct < profile.humidityMin || humidityPct > profile.humidityMax)) {
        signals.push('Humidity is outside the quality band for this food category.');
    }

    if (stalePenalty > 0) {
        signals.push('Sensor reading is stale; confidence is reduced.');
    }

    if (safetyCap === 0) {
        signals.push('Safety cap is zero: do not distribute without manual inspection.');
    } else if (safetyCap) {
        signals.push(`Food-code safety cap limits the route window to ${safetyCap} minutes.`);
    }

    return signals.length ? signals : ['Sensor readings are within the expected operating range.'];
}

function calculateEffectiveExpiry(expiryDate, model, now) {
    const expiry = expiryDate ? new Date(expiryDate) : null;
    if (!expiry || Number.isNaN(expiry.getTime())) return null;

    if (model.safetyCapMinutes === 0) return now;

    const staticRemainingMs = Math.max(0, expiry.getTime() - now.getTime());
    const qualityAdjustedMs = staticRemainingMs / model.qualityLossRate;
    const safetyCapMs = model.safetyCapMinutes === null
        ? Number.POSITIVE_INFINITY
        : model.safetyCapMinutes * 60 * 1000;
    const adjustedMs = Math.min(staticRemainingMs, qualityAdjustedMs, safetyCapMs);

    return new Date(now.getTime() + Math.max(0, adjustedMs));
}

function confidenceFor(reading, now) {
    const availableSignals = ['temperatureC', 'humidityPct', 'gasLevel']
        .filter((field) => reading[field] !== null).length;
    const ageMinutes = (now.getTime() - reading.observedAt.getTime()) / (1000 * 60);
    const completeness = availableSignals / 3;
    const freshness = ageMinutes <= DEFAULT_SENSOR_STALE_MINUTES ? 1 : 0.65;

    return Number(clamp(completeness * freshness, 0, 1).toFixed(2));
}

function stateFromModel(score, model, reading, profile) {
    if (model.safetyCapMinutes === 0) return 'unsafe';
    if (reading.gasIndex !== null && reading.gasIndex >= profile.gasUnsafe) return 'unsafe';
    if (score < 20 && model.temperatureBand === 'extreme') return 'unsafe';
    if (score < 50 || model.temperatureBand === 'danger_zone' || (reading.gasIndex !== null && reading.gasIndex >= profile.gasCritical)) {
        return 'critical';
    }
    if (score < 72 || model.qualityLossRate >= 1.8 || (reading.gasIndex !== null && reading.gasIndex >= profile.gasWatch)) {
        return 'watch';
    }
    if (score < 88) return 'good';
    return 'excellent';
}

function recommendationFromState(state, model) {
    if (state === 'unsafe') return 'Do not distribute. Hold for manual inspection or disposal workflow.';
    if (state === 'critical') return 'Dispatch only to the nearest high-need center that can receive immediately.';
    if (state === 'watch') return 'Prioritize this item before stable listings and keep route time short.';
    if (model.temperatureBand === 'hot_holding') return 'Maintain hot holding during pickup and delivery.';
    return 'Safe to route using normal allocation priority.';
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
            recommendation: 'Attach a sensor reading before relying on freshness-aware routing.',
            model: {
                name: 'Q10 time-temperature + gas spoilage index',
                categoryProfile: profile.label,
                temperatureBand: 'unknown',
                qualityLossRate: 1,
                safetyCapMinutes: null,
                gasStress: 0,
                humidityStress: 0,
                staleStress: 0,
                totalStress: 0
            },
            signals: ['No sensor telemetry yet.']
        };
    }

    const normalized = normalizeSensorReading(reading);
    const band = temperatureBand(normalized.temperatureC, profile);
    const qualityLossRate = q10Rate(normalized.temperatureC, profile);
    const gasPenalty = gasStress(normalized.gasIndex, profile);
    const humidityPenalty = humidityStress(normalized.humidityPct, profile);
    const stalePenalty = staleStress(normalized.observedAt, now);
    const thermalPenalty = band === 'hot_holding'
        ? 2
        : clamp((qualityLossRate - 1) * 18, 0, 45) + (band === 'danger_zone' ? 18 : band === 'extreme' ? 45 : 0);
    const safetyCap = safetyCapMinutes(normalized.temperatureC, normalized.gasIndex, profile);
    const totalStress = clamp(thermalPenalty + gasPenalty + humidityPenalty + stalePenalty, 0, 100);
    const score = Math.round(clamp(100 - totalStress, 0, 100));
    const model = {
        name: 'Q10 time-temperature + gas spoilage index',
        categoryProfile: profile.label,
        temperatureBand: band,
        qualityLossRate,
        safetyCapMinutes: safetyCap,
        gasStress: Number(gasPenalty.toFixed(1)),
        humidityStress: Number(humidityPenalty.toFixed(1)),
        thermalStress: Number(thermalPenalty.toFixed(1)),
        staleStress: Number(stalePenalty.toFixed(1)),
        totalStress: Number(totalStress.toFixed(1))
    };
    const state = stateFromModel(score, model, normalized, profile);
    const effectiveExpiryDate = calculateEffectiveExpiry(expiryDate, model, now);
    const remainingShelfLifeMinutes = effectiveExpiryDate
        ? Math.max(0, Math.round((effectiveExpiryDate.getTime() - now.getTime()) / (1000 * 60)))
        : null;

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
        recommendation: recommendationFromState(state, model),
        model,
        signals: buildSignals({
            band,
            rate: qualityLossRate,
            gasIndex: normalized.gasIndex,
            humidityPct: normalized.humidityPct,
            profile,
            stalePenalty,
            safetyCap
        })
    };
}

module.exports = {
    CATEGORY_PROFILES,
    buildFreshnessSnapshot,
    normalizeGasIndex,
    normalizeSensorReading,
    q10Rate,
    temperatureBand
};
