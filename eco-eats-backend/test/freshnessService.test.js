const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildFreshnessSnapshot,
    normalizeGasIndex
} = require('../services/freshnessService');

test('normalizeGasIndex accepts percentage and raw ppm-style values', () => {
    assert.equal(normalizeGasIndex(42), 42);
    assert.equal(normalizeGasIndex(650), 65);
    assert.equal(normalizeGasIndex(1200), 100);
});

test('buildFreshnessSnapshot keeps healthy sensor readings shippable', () => {
    const now = new Date('2026-05-01T10:00:00.000Z');
    const expiryDate = new Date('2026-05-01T18:00:00.000Z');
    const snapshot = buildFreshnessSnapshot({
        temperatureC: 4,
        humidityPct: 58,
        gasLevel: 18,
        readingAt: now
    }, { now, expiryDate, category: 'prepared-meals' });

    assert.equal(snapshot.state, 'excellent');
    assert.ok(snapshot.score >= 85);
    assert.equal(snapshot.effectiveExpiryDate.toISOString(), expiryDate.toISOString());
});

test('buildFreshnessSnapshot shortens shelf life for risky sensor readings', () => {
    const now = new Date('2026-05-01T10:00:00.000Z');
    const expiryDate = new Date('2026-05-01T18:00:00.000Z');
    const snapshot = buildFreshnessSnapshot({
        temperatureC: 22,
        humidityPct: 82,
        gasLevel: 72,
        readingAt: now
    }, { now, expiryDate, category: 'prepared-meals' });

    assert.equal(snapshot.state, 'critical');
    assert.ok(snapshot.effectiveExpiryDate < expiryDate);
    assert.ok(snapshot.remainingShelfLifeMinutes < 8 * 60);
});

test('buildFreshnessSnapshot marks very high gas readings unsafe', () => {
    const now = new Date('2026-05-01T10:00:00.000Z');
    const snapshot = buildFreshnessSnapshot({
        temperatureC: 12,
        humidityPct: 60,
        gasLevel: 95,
        readingAt: now
    }, { now, expiryDate: new Date('2026-05-01T18:00:00.000Z') });

    assert.equal(snapshot.state, 'unsafe');
    assert.equal(snapshot.remainingShelfLifeMinutes, 0);
});
