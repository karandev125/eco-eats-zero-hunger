import { useEffect, useMemo, useState } from 'react';
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

function defaultExpiryLocal(hours = 8) {
  const value = new Date(Date.now() + hours * 60 * 60 * 1000);
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
  deviceId: 'eco-device-001'
};

const presets = [
  {
    name: 'Chilled meal',
    description: 'Cold held cooked food with low gas signal.',
    values: { category: 'prepared-meals', expiryDate: defaultExpiryLocal(8), temperatureC: 4, humidityPct: 60, gasLevel: 18 }
  },
  {
    name: 'Danger zone',
    description: 'Cooked food warming up, route window capped.',
    values: { category: 'prepared-meals', expiryDate: defaultExpiryLocal(8), temperatureC: 24, humidityPct: 78, gasLevel: 52 }
  },
  {
    name: 'Gas spike',
    description: 'Spoilage gas has crossed the unsafe threshold.',
    values: { category: 'dairy', expiryDate: defaultExpiryLocal(6), temperatureC: 9, humidityPct: 68, gasLevel: 88 }
  },
  {
    name: 'Produce stress',
    description: 'Produce is warm with high humidity and rising gas.',
    values: { category: 'produce', expiryDate: defaultExpiryLocal(20), temperatureC: 18, humidityPct: 96, gasLevel: 58 }
  },
  {
    name: 'Packaged stable',
    description: 'Shelf-stable food with low sensor stress.',
    values: { category: 'packaged', expiryDate: defaultExpiryLocal(72), temperatureC: 27, humidityPct: 44, gasLevel: 8 }
  }
];

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

const SliderField = ({ label, value, min, max, step, unit, hint, onChange }) => (
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
    {hint && <small>{hint}</small>}
  </label>
);

const InlineFreshnessScore = ({ freshness }) => {
  const score = freshness?.score ?? '--';
  const state = freshnessLabel(freshness?.state);
  const routeWindow = freshness ? formatShelfLife(freshness.remainingShelfLifeMinutes) : '--';

  return (
    <aside className={`inline-freshness-score ${freshnessClass(freshness?.state)}`}>
      <p className="eyebrow">Live score</p>
      <div className="inline-score-value">
        <strong>{score}</strong>
        <span>/100</span>
      </div>
      <div className="inline-score-meta">
        <span><strong>{state}</strong><small>State</small></span>
        <span><strong>{routeWindow}</strong><small>Route window</small></span>
      </div>
    </aside>
  );
};

const DecisionPanel = ({ freshness }) => {
  if (!freshness) {
    return (
      <section className="freshness-decision empty-state compact-empty">
        <h3>Waiting for sensor preview</h3>
        <p>Move a slider or choose a preset to calculate the live delivery window.</p>
      </section>
    );
  }

  return (
    <section className={`freshness-decision ${freshnessClass(freshness.state)}`}>
      <div>
        <p className="eyebrow">Routing decision</p>
        <h2>{freshness.recommendation || 'Freshness model ready.'}</h2>
      </div>
      <div className="freshness-score-ring">
        <strong>{freshness.score ?? '--'}</strong>
        <small>score</small>
      </div>
      <div className="food-metrics-grid compact-metrics">
        <span><strong>{freshnessLabel(freshness.state)}</strong><small>Freshness state</small></span>
        <span><strong>{formatShelfLife(freshness.remainingShelfLifeMinutes)}</strong><small>Route window</small></span>
        <span><strong>{formatDateTime(freshness.effectiveExpiryDate)}</strong><small>Delivery deadline</small></span>
        <span><strong>{Math.round((freshness.confidence || 0) * 100)}%</strong><small>Confidence</small></span>
      </div>
    </section>
  );
};

const ModelBreakdown = ({ freshness }) => {
  if (!freshness?.model) return null;

  const model = freshness.model;
  const rows = [
    ['Temperature band', model.temperatureBand],
    ['Q10 loss rate', `${model.qualityLossRate}x`],
    ['Safety cap', model.safetyCapMinutes === null ? 'No cap' : `${model.safetyCapMinutes} min`],
    ['Thermal stress', model.thermalStress],
    ['Gas stress', model.gasStress],
    ['Humidity stress', model.humidityStress],
    ['Total stress', model.totalStress]
  ];

  return (
    <section className="ops-card lab-card model-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Scientific model</p>
          <h2>{model.name}</h2>
        </div>
        <span className={`status-pill ${freshnessClass(freshness.state)}`}>{freshnessLabel(freshness.state)}</span>
      </div>
      <div className="model-grid">
        {rows.map(([label, value]) => (
          <span key={label}>
            <strong>{value ?? '-'}</strong>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <ul className="signal-list">
        {(freshness.signals || []).map((signal) => <li key={signal}>{signal}</li>)}
      </ul>
      <p className="model-footnote">
        This is a routing risk model, not a legal food-safety certification. It combines time-temperature control,
        Q10 quality acceleration, gas spoilage signal, humidity stress, and sensor freshness.
      </p>
    </section>
  );
};

const FreshnessLab = () => {
  const [sensor, setSensor] = useState(initialSensor);
  const [freshness, setFreshness] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('Live model ready.');
  const [telemetryStatus, setTelemetryStatus] = useState('');
  const [centerData, setCenterData] = useState(initialCenter);
  const [centerStatus, setCenterStatus] = useState('');
  const [foods, setFoods] = useState([]);
  const [centers, setCenters] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchStatus, setMatchStatus] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(true);

  const selectedFood = useMemo(
    () => foods.find((item) => item._id === sensor.foodItemId),
    [foods, sensor.foodItemId]
  );

  const updateSensor = (field, value) => {
    setSensor((current) => ({ ...current, [field]: value }));
  };

  const updateCenter = (field, value) => {
    setCenterData((current) => ({ ...current, [field]: value }));
  };

  const applyPreset = (preset) => {
    setSensor((current) => ({
      ...current,
      ...preset.values
    }));
    setPreviewStatus(`${preset.name} preset applied.`);
  };

  useEffect(() => {
    const loadRecords = async () => {
      setLoadingRecords(true);

      try {
        const [foodRes, centerRes] = await Promise.all([
          api.get('/food', { params: { sort: 'bestmatch', radiusKm: undefined } }),
          api.get('/demand-centers')
        ]);
        setFoods(foodRes.data);
        setCenters(centerRes.data);

        if (foodRes.data[0]) {
          setSensor((current) => ({
            ...current,
            foodItemId: current.foodItemId || foodRes.data[0]._id,
            deviceId: current.deviceId || foodRes.data[0].deviceId || '',
            category: foodRes.data[0].category || current.category,
            expiryDate: current.expiryDate || defaultExpiryLocal()
          }));
        }
      } catch (err) {
        console.error('Freshness lab records failed:', err);
        setPreviewStatus('Could not load live food records.');
      } finally {
        setLoadingRecords(false);
      }
    };

    loadRecords();
  }, []);

  useEffect(() => {
    if (!selectedFood) return;

    setSensor((current) => ({
      ...current,
      deviceId: selectedFood.deviceId || current.deviceId,
      category: selectedFood.category || current.category,
      expiryDate: selectedFood.expiryDate
        ? new Date(new Date(selectedFood.expiryDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : current.expiryDate
    }));
  }, [selectedFood]);

  const { category, expiryDate, temperatureC, humidityPct, gasLevel } = sensor;

  useEffect(() => {
    const previewPayload = { category, expiryDate, temperatureC, humidityPct, gasLevel };
    const previewFreshness = async () => {
      try {
        const res = await api.post('/iot/freshness-preview', previewPayload);
        setFreshness(res.data);
        setPreviewStatus('Live preview updated.');
      } catch (err) {
        console.error('Freshness preview failed:', err);
        setPreviewStatus('Could not preview freshness. Check that the backend is running.');
      }
    };

    const timer = window.setTimeout(previewFreshness, 180);
    return () => window.clearTimeout(timer);
  }, [category, expiryDate, temperatureC, humidityPct, gasLevel]);

  const sendTelemetry = async () => {
    if (!sensor.foodItemId && !sensor.deviceId) {
      setTelemetryStatus('Select a food item or enter a linked device ID first.');
      return;
    }

    setTelemetryStatus('Sending telemetry...');

    try {
      const res = await api.post('/iot/telemetry', {
        ...sensor,
        readingAt: new Date().toISOString()
      });
      setFreshness(res.data.freshness);
      setTelemetryStatus(`Telemetry attached to ${selectedFood?.title || res.data.foodItemId}.`);
    } catch (err) {
      console.error('Telemetry failed:', err);
      setTelemetryStatus(err.response?.data?.message || 'Could not send telemetry.');
    }
  };

  const createDemandCenter = async (e) => {
    e.preventDefault();
    setCenterStatus('Saving demand center...');

    try {
      const res = await api.post('/demand-centers', {
        ...centerData,
        acceptedCategories: centerData.acceptedCategoriesText
          .split(',')
          .map((category) => category.trim())
          .filter(Boolean)
      });
      setCenters((current) => [res.data, ...current.filter((center) => center._id !== res.data._id)]);
      setCenterData(initialCenter);
      setCenterStatus('Demand center saved.');
    } catch (err) {
      console.error('Demand center save failed:', err);
      setCenterStatus(err.response?.data?.message || 'Could not save demand center.');
    }
  };

  const rankMatches = async () => {
    if (!sensor.foodItemId.trim()) {
      setMatchStatus('Select a food item first.');
      return;
    }

    setMatchStatus('Ranking routes...');
    setMatches([]);

    try {
      const res = await api.get(`/demand-centers/matches/${sensor.foodItemId.trim()}`);
      setMatches(res.data);
      setMatchStatus(res.data.length ? 'Best routes ranked with freshness-aware deadlines.' : 'No demand centers could receive this food.');
    } catch (err) {
      console.error('Demand match failed:', err);
      setMatchStatus(err.response?.data?.message || 'Could not rank demand centers.');
    }
  };

  return (
    <main className="ops-page">
      <section className="ops-hero compact-hero freshness-hero">
        <div>
          <p className="eyebrow">Freshness lab</p>
          <h1>Model food safety risk before routing.</h1>
          <p>
            Simulate temperature, humidity, and gas telemetry with a Q10 time-temperature model,
            then attach the reading to a real listing or rank demand centers.
          </p>
        </div>
        <div className="lab-live-strip">
          <span><strong>{foods.length}</strong><small>Food records</small></span>
          <span><strong>{centers.length}</strong><small>Demand centers</small></span>
          <span><strong>{freshness ? formatFreshnessScore(freshness) : '--'}</strong><small>Live score</small></span>
        </div>
      </section>

      <section className="ops-layout freshness-lab-grid polished-lab-grid">
        <article className="ops-panel simulator-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">Sensor input</p>
              <h2>Hardware simulator</h2>
            </div>
            {freshness && (
              <span className={`status-pill ${freshnessClass(freshness.state)}`}>
                {freshnessLabel(freshness.state)}
              </span>
            )}
          </div>

          <div className="preset-grid">
            {presets.map((preset) => (
              <button className="preset-button" type="button" key={preset.name} onClick={() => applyPreset(preset)}>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>

          <label>
            Food item
            <select value={sensor.foodItemId} onChange={(e) => updateSensor('foodItemId', e.target.value)} disabled={loadingRecords}>
              <option value="">Manual telemetry only</option>
              {foods.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.title} - {item.category}
                </option>
              ))}
            </select>
          </label>

          <div className="lab-form-grid">
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
          </div>

          <div className="sensor-tuning-grid">
            <div className="sensor-slider-stack">
              <SliderField label="Temperature" value={sensor.temperatureC} min={-5} max={70} step={0.5} unit=" C" hint="Cold holding <= 5 C; hot holding for prepared food >= 57 C." onChange={(value) => updateSensor('temperatureC', value)} />
              <SliderField label="Humidity" value={sensor.humidityPct} min={10} max={100} step={1} unit="%" hint="Outside the category band increases quality stress." onChange={(value) => updateSensor('humidityPct', value)} />
              <SliderField label="Gas spoilage index" value={sensor.gasLevel} min={0} max={100} step={1} unit="" hint="Represents normalized VOC/ammonia/ethylene-style gas signal." onChange={(value) => updateSensor('gasLevel', value)} />
            </div>
            <InlineFreshnessScore freshness={freshness} />
          </div>

          <div className="telemetry-box">
            <label>Device ID<input value={sensor.deviceId} onChange={(e) => updateSensor('deviceId', e.target.value)} placeholder="eco-device-001" /></label>
            <button className="btn-primary" type="button" onClick={sendTelemetry}>Attach telemetry to listing</button>
            {telemetryStatus && <p className="helper-text">{telemetryStatus}</p>}
          </div>
        </article>

        <div className="lab-results-column">
          <DecisionPanel freshness={freshness} />
          <ModelBreakdown freshness={freshness} />
          {previewStatus && <div className="notice">{previewStatus}</div>}
        </div>

        <article className="ops-card lab-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Demand center</p>
              <h2>Add receiver need</h2>
            </div>
            <span className="status-pill risk-low">{centers.length} centers</span>
          </div>
          <form className="add-food-form lab-form-grid" onSubmit={createDemandCenter}>
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
            <button className="btn-primary full-row" type="submit">Save demand center</button>
            {centerStatus && <p className="helper-text full-row">{centerStatus}</p>}
          </form>
        </article>

        <article className="ops-card lab-card matches-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Allocation ranking</p>
              <h2>Best destinations for selected food</h2>
            </div>
            <button className="btn-primary" type="button" onClick={rankMatches}>Rank demand centers</button>
          </div>
          {selectedFood && (
            <div className="selected-food-strip">
              <span><strong>{selectedFood.title}</strong><small>{selectedFood.pickupAddress || selectedFood.location}</small></span>
              <span><strong>{selectedFood.estimatedMeals || 0}</strong><small>Meals</small></span>
              <span><strong>{formatDateTime(selectedFood.effectiveExpiryDate || selectedFood.expiryDate)}</strong><small>Current deadline</small></span>
            </div>
          )}
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
