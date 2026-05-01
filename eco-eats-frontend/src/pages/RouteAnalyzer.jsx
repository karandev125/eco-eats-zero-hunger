import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../index.css';
import { formatDuration, formatDistance, routeRiskClass } from '../utils/foodDisplay';
import { analyzeRoute } from '../utils/routingClient';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const RouteAnalyzer = () => {
  const [form, setForm] = useState({
    pickup: '',
    dropoff: '',
    expiryDate: ''
  });
  const [status, setStatus] = useState('');
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef([]);

  useEffect(() => {
    if (mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { scrollWheelZoom: false }).setView([12.9716, 77.5946], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);
      window.setTimeout(() => mapInstance.current?.invalidateSize(), 0);
    }

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const clearMapLayers = () => {
    layersRef.current.forEach((layer) => mapInstance.current?.removeLayer(layer));
    layersRef.current = [];
  };

  const drawRoute = (data) => {
    const startCoords = data.pickup.coordinates;
    const endCoords = data.dropoff.coordinates;
    const startMarker = L.marker([startCoords.lat, startCoords.lng]).addTo(mapInstance.current).bindPopup('Pickup').openPopup();
    const endMarker = L.marker([endCoords.lat, endCoords.lng]).addTo(mapInstance.current).bindPopup('Drop-off');
    const routeLayer = L.geoJSON(data.route.geometry, {
      style: {
        color: data.expiry?.canDeliverBeforeExpiry === false ? '#b42318' : data.route.fallback ? '#b7791f' : '#177a62',
        opacity: 0.9,
        weight: 6
      }
    }).addTo(mapInstance.current);

    layersRef.current.push(startMarker, endMarker, routeLayer);
    mapInstance.current.invalidateSize();
    mapInstance.current.fitBounds(routeLayer.getBounds(), { padding: [25, 25] });
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Analyzing route...');
    setRouteResult(null);
    clearMapLayers();

    try {
      const data = await analyzeRoute({
        pickup: form.pickup,
        dropoff: form.dropoff,
        expiryDate: form.expiryDate || undefined
      });

      drawRoute(data);
      setRouteResult(data);
      setStatus(data.expiry?.canDeliverBeforeExpiry === false
        ? 'Route found, but expiry timing is risky.'
        : data.route.backendFallback
          ? 'Route found using browser fallback because the backend is unavailable.'
          : 'Route found and ready to review.');
    } catch (err) {
      console.error('Route analysis error:', err);
      setStatus(err.response?.data?.message || 'Could not find one of the locations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ops-page route-analyzer-page">
      <section className="ops-hero compact-hero">
        <div>
          <p className="eyebrow">Route analyser</p>
          <h1>Check delivery feasibility before food is claimed.</h1>
          <p>
            Backend routing returns coordinates, road distance, fallback status, and expiry risk.
          </p>
        </div>
      </section>

      <section className="ops-layout order-layout">
        <aside className="ops-panel order-panel">
          <form onSubmit={handleAnalyze} className="route-form">
            <label>
              Pickup location
              <input
                type="text"
                placeholder="Restaurant, store, or address"
                value={form.pickup}
                onChange={(e) => updateForm('pickup', e.target.value)}
                required
              />
            </label>
            <label>
              Drop-off location
              <input
                type="text"
                placeholder="Demand center or receiver address"
                value={form.dropoff}
                onChange={(e) => updateForm('dropoff', e.target.value)}
                required
              />
            </label>
            <label>
              Expiry time
              <input
                type="datetime-local"
                value={form.expiryDate}
                onChange={(e) => updateForm('expiryDate', e.target.value)}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze route'}
            </button>
          </form>

          {status && <div className="notice">{status}</div>}

          {routeResult && (
            <div className="route-summary-box">
              <span className={`status-pill ${routeRiskClass(routeResult.expiry?.riskLevel)}`}>
                {routeResult.expiry?.riskLevel || 'unknown'}
              </span>
              <div className="food-metrics-grid compact-metrics">
                <span><strong>{formatDistance(routeResult.route.distanceMeters / 1000)}</strong><small>Distance</small></span>
                <span><strong>{formatDuration(routeResult.route.durationSeconds)}</strong><small>Travel time</small></span>
                <span><strong>{routeResult.route.provider}</strong><small>Provider</small></span>
                <span><strong>{routeResult.route.fallback ? 'Fallback' : 'Road route'}</strong><small>Mode</small></span>
              </div>
            </div>
          )}
        </aside>

        <section className="map-panel route-map-shell">
          <div id="map" ref={mapRef} className="route-map" />
        </section>
      </section>
    </main>
  );
};

export default RouteAnalyzer;
