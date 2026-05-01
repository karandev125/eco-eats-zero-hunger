import { useEffect, useState } from 'react';
import '../index.css';
import { api } from '../api';
import {
  CATEGORY_OPTIONS,
  formatDateTime,
  formatDuration,
  formatDistance,
  formatFreshnessScore,
  formatShelfLife,
  freshnessClass,
  freshnessLabel,
  routeRiskClass
} from '../utils/foodDisplay';

function defaultExpiryLocal() {
  const value = new Date(Date.now() + 8 * 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

const initialSensor = {
  category: 'prepared-meals',
  expiryDate: defaultExpiryLocal(),
  temperatureC: 4,
  humidityPct: 60,
  gasLevel: 20,
  foodItemId: '',
  deviceId: ''
};

const initialCenter = {
  name: '',
  address: '',
  mealNeed: 100,
  capacityMeals: 150,
  urgency: 'high',
  acceptedCategoriesText: 'prepared-meals, produce, general',
  operatingHours: '',
  contactPhone: ''
};

const SliderField = ({ label, value, min, max, step, unit, onChange }) => (
  <label className="slider-field">
    <span>{label}<strong>{value}{unit}</strong></span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </label>
);

const FreshnessLab = () => {
  const [sensor, setSensor] = useState(initialSensor);
  const [freshness, setFreshness] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [telemetryStatus, setTelemetryStatus] = useState('');
  const [centerData, setCenterData] = useState(initialCenter);
  const [centerStatus, setCenterStatus] = useState('');
  const [matchFoodItemId, setMatchFoodItemId] = useState('');
  const [matches, setMatches] = useState([]);
  const [matchStatus, setMatchStatus] = useState('');

  const updateSensor = (field, value) => {
    setSensor((current) => ({ ...current, [field]: value }));
  };

  const updateCenter = (field, value) => {
    setCenterData((current) => ({ ...current, [field]: value }));
  };

  const { category, expiryDate, temperatureC, humidityPct, gasLevel } = sensor;

  useEffect(() => {
    const previewPayload = { category, expiryDate, temperatureC, humidityPct, gasLevel };
    const previewFreshness = async () => {
      setPreviewStatus('Calculating freshness...');

      try {
        const res = await api.post('/iot/freshness-preview', previewPayload);
        setFreshness(res.data);
        setPreviewStatus('Freshness preview updated.');
      } catch (err) {
        console.error('Freshness preview failed:', err);
        setPreviewStatus('Could not preview freshness. Check that the backend is running.');
      }
    };

    const timer = window.setTimeout(previewFreshness, 250);
    return () => window.clearTimeout(timer);
  }, [category, expiryDate, temperatureC, humidityPct, gasLevel]);

  const sendTelemetry = async () => {
    if (!sensor.foodItemId && !sensor.deviceId) {
      setTelemetryStatus('Enter a food item ID or linked device ID first.');
      return;
    }

    setTelemetryStatus('Sending telemetry...');

    try {
      const res = await api.post('/iot/telemetry', {
        ...sensor,
        readingAt: new Date().toISOString()
      });
      setFreshness(res.data.freshness);
      setTelemetryStatus(`Telemetry attached to ${res.data.foodItemId}.`);
    } catch (err) {
      console.error('Telemetry failed:', err);
      setTelemetryStatus(err.response?.data?.message || 'Could not send telemetry.');
    }
  };

  const createDemandCenter = async (e) => {
    e.preventDefault();
    setCenterStatus('Saving demand center...');

    try {
      await api.post('/demand-centers', {
        ...centerData,
        acceptedCategories: centerData.acceptedCategoriesText
          .split(',')
          .map((category) => category.trim())
          .filter(Boolean)
      });
      setCenterData(initialCenter);
      setCenterStatus('Demand center saved.');
    } catch (err) {
      console.error('Demand center save failed:', err);
      setCenterStatus(err.response?.data?.message || 'Could not save demand center.');
    }
  };

  const rankMatches = async () => {
    if (!matchFoodItemId.trim()) {
      setMatchStatus('Enter a food item ID first.');
      return;
    }

    setMatchStatus('Ranking routes...');
    setMatches([]);

    try {
      const res = await api.get(`/demand-centers/matches/${matchFoodItemId.trim()}`);
      setMatches(res.data);
      setMatchStatus(res.data.length ? 'Best routes ranked.' : 'No demand centers could receive this food.');
    } catch (err) {
      console.error('Demand match failed:', err);
      setMatchStatus(err.response?.data?.message || 'Could not rank demand centers.');
    }
  };

  return (
    <main className="ops-page">
      <section className="ops-hero compact-hero">
        <div>
          <p className="eyebrow">Freshness lab</p>
          <h1>Simulate the hardware signal and route by live shelf life.</h1>
          <p>
            Move temperature, humidity, and gas values to see the delivery deadline shift, then attach
            telemetry to a listing or rank demand centers for a food item.
          </p>
        </div>
      </section>

      <section className="ops-layout freshness-lab-grid">
        <article className="ops-panel simulator-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Hardware simulator</p>
              <h2>Sensor readings</h2>
            </div>
            {freshness && (
              <span className={`status-pill ${freshnessClass(freshness.state)}`}>
                {freshnessLabel(freshness.state)}
              </span>
            )}
          </div>

          <label>
            Category
            <select value={sensor.category} onChange={(e) => updateSensor('category', e.target.value)}>
              {CATEGORY_OPTIONS.filter((option) => option.value).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Static expiry
            <input type="datetime-local" value={sensor.expiryDate} onChange={(e) => updateSensor('expiryDate', e.target.value)} />
          </label>

          <SliderField label="Temperature" value={sensor.temperatureC} min={-5} max={45} step={0.5} unit=" C" onChange={(value) => updateSensor('temperatureC', value)} />
          <SliderField label="Humidity" value={sensor.humidityPct} min={10} max={100} step={1} unit="%" onChange={(value) => updateSensor('humidityPct', value)} />
          <SliderField label="Gas level" value={sensor.gasLevel} min={0} max={100} step={1} unit="" onChange={(value) => updateSensor('gasLevel', value)} />

          {freshness && (
            <div className="route-summary-box freshness-summary">
              <div className="food-metrics-grid compact-metrics">
                <span><strong>{formatFreshnessScore(freshness)}</strong><small>Freshness score</small></span>
                <span><strong>{formatShelfLife(freshness.remainingShelfLifeMinutes)}</strong><small>Fresh window</small></span>
                <span><strong>{formatDateTime(freshness.effectiveExpiryDate)}</strong><small>Delivery deadline</small></span>
                <span><strong>{Math.round((freshness.confidence || 0) * 100)}%</strong><small>Confidence</small></span>
              </div>
              <ul className="signal-list">
                {(freshness.signals || []).map((signal) => <li key={signal}>{signal}</li>)}
              </ul>
            </div>
          )}

          {previewStatus && <div className="notice">{previewStatus}</div>}

          <div className="telemetry-box">
            <label>Food item ID<input value={sensor.foodItemId} onChange={(e) => updateSensor('foodItemId', e.target.value)} placeholder="Mongo food _id" /></label>
            <label>Device ID<input value={sensor.deviceId} onChange={(e) => updateSensor('deviceId', e.target.value)} placeholder="eco-device-001" /></label>
            <button className="btn-primary" type="button" onClick={sendTelemetry}>Send telemetry</button>
            {telemetryStatus && <p className="helper-text">{telemetryStatus}</p>}
          </div>
        </article>

        <article className="ops-card lab-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Demand center</p>
              <h2>Add receiver need</h2>
            </div>
          </div>
          <form className="add-food-form" onSubmit={createDemandCenter}>
            <label>Name<input value={centerData.name} onChange={(e) => updateCenter('name', e.target.value)} required /></label>
            <label>Address<input value={centerData.address} onChange={(e) => updateCenter('address', e.target.value)} required /></label>
            <label>Meal need<input type="number" value={centerData.mealNeed} onChange={(e) => updateCenter('mealNeed', e.target.value)} /></label>
            <label>Capacity<input type="number" value={centerData.capacityMeals} onChange={(e) => updateCenter('capacityMeals', e.target.value)} /></label>
            <label>
              Urgency
              <select value={centerData.urgency} onChange={(e) => updateCenter('urgency', e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>Accepted categories<input value={centerData.acceptedCategoriesText} onChange={(e) => updateCenter('acceptedCategoriesText', e.target.value)} /></label>
            <label>Operating hours<input value={centerData.operatingHours} onChange={(e) => updateCenter('operatingHours', e.target.value)} /></label>
            <label>Phone<input value={centerData.contactPhone} onChange={(e) => updateCenter('contactPhone', e.target.value)} /></label>
            <button className="btn-primary" type="submit">Save demand center</button>
            {centerStatus && <p className="helper-text">{centerStatus}</p>}
          </form>
        </article>

        <article className="ops-card lab-card matches-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Allocation ranking</p>
              <h2>Best destinations</h2>
            </div>
          </div>
          <div className="match-controls">
            <label>Food item ID<input value={matchFoodItemId} onChange={(e) => setMatchFoodItemId(e.target.value)} placeholder="Food item to route" /></label>
            <button className="btn-primary" type="button" onClick={rankMatches}>Rank demand centers</button>
          </div>
          {matchStatus && <div className="notice">{matchStatus}</div>}

          <div className="match-list">
            {matches.map((match) => (
              <article className="queue-row match-row" key={match.demandCenter._id}>
                <div>
                  <h3>{match.demandCenter.name}</h3>
                  <p>{match.demandCenter.address}</p>
                  <small>{match.demandCenter.mealNeed || 0} meals needed</small>
                </div>
                <div className="queue-meta">
                  <span className={`status-pill ${routeRiskClass(match.expiry?.riskLevel)}`}>{match.expiry?.riskLevel || 'unknown'}</span>
                  <strong>{match.allocation?.score ?? 0}</strong>
                  <small>{formatDistance(match.route.distanceMeters / 1000)}</small>
                  <small>{formatDuration(match.route.durationSeconds)}</small>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
};

export default FreshnessLab;
