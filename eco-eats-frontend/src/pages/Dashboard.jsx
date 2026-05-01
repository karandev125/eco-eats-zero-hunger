import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../index.css';
import { api } from '../api';
import {
  CATEGORY_OPTIONS,
  formatDateTime,
  formatFreshnessScore,
  freshnessClass,
  freshnessLabel,
  getStoredUser,
  statusLabel,
  totalKg,
  totalMeals,
  urgencyClass,
  urgencyLabel
} from '../utils/foodDisplay';
import { geocodeLocation } from '../utils/routingClient';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const profileFromUser = (user) => ({
  address: user?.address || '',
  phone: user?.phone || '',
  organization: user?.organization || ''
});

const initialFoodData = {
  title: '',
  quantity: '',
  location: '',
  expiryDate: '',
  category: 'general',
  description: '',
  deviceId: '',
  temperatureC: '',
  humidityPct: '',
  gasLevel: ''
};

const coordinatesFor = (item) => {
  const coords = item.pickupCoordinates;
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return null;
  return coords;
};

const OperationsMap = ({ items }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([12.9716, 77.5946], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance.current);

    markerLayerRef.current = L.layerGroup().addTo(mapInstance.current);
    window.setTimeout(() => mapInstance.current?.invalidateSize(), 0);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markerLayerRef.current) return;

    markerLayerRef.current.clearLayers();
    const bounds = [];

    items.forEach((item) => {
      const coords = coordinatesFor(item);
      if (!coords) return;

      const marker = L.marker([coords.lat, coords.lng]).bindPopup(
        `<strong>${item.title}</strong><br>${item.quantity}<br>${statusLabel(item)}`
      );
      markerLayerRef.current.addLayer(marker);
      bounds.push([coords.lat, coords.lng]);
    });

    if (bounds.length > 0) {
      mapInstance.current.invalidateSize();
      mapInstance.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [items]);

  return <div className="ops-map" ref={mapRef} />;
};

const StatCard = ({ label, value, detail }) => (
  <div className="metric-card">
    <span>{label}</span>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [myListings, setMyListings] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [availableFood, setAvailableFood] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showProfileModal, setShowProfileModal] = useState(() => {
    const storedUser = getStoredUser();
    return Boolean(storedUser && !storedUser.address);
  });
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [profileData, setProfileData] = useState(() => profileFromUser(getStoredUser()));
  const [foodData, setFoodData] = useState(initialFoodData);
  const [pickupPreview, setPickupPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [error, setError] = useState('');

  const isDonor = user?.role === 'donor';
  const operationalItems = isDonor ? myListings : availableFood;
  const activityItems = isDonor ? myListings : myOrders;
  const activeListings = myListings.filter((item) => item.status === 'available' || item.isAvailable);
  const claimedListings = myListings.filter((item) => item.status === 'claimed' || item.claimedBy);
  const urgentItems = operationalItems.filter((item) => ['critical', 'urgent', 'soon'].includes(item.expiry?.urgency));

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      setError('');

      try {
        if (user.role === 'donor') {
          const res = await api.get(`/food/user/${user._id}`);
          setMyListings(res.data);
        } else {
          const [ordersRes, foodRes] = await Promise.all([
            api.get(`/food/orders/${user._id}`),
            api.get('/food', { params: { sort: 'bestmatch' } })
          ]);
          setMyOrders(ordersRes.data);
          setAvailableFood(foodRes.data);
        }
      } catch (err) {
        console.error('Dashboard load failed:', err);
        setError('Could not load dashboard data. Check that the backend is running.');
      }
    };

    loadDashboard();
  }, [navigate, user]);

  const updateFoodData = (field, value) => {
    setFoodData((current) => ({ ...current, [field]: value }));
  };

  const handleClaimClick = (item) => {
    navigate('/order', { state: { item, receiverLocation: profileData.address } });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const res = await api.put(`/auth/update/${user._id}`, profileData);
    localStorage.setItem('user', JSON.stringify(res.data));
    setUser(res.data);
    setShowProfileModal(false);
  };

  const handlePreviewPickup = async () => {
    if (!foodData.location.trim()) {
      setPickupPreview(null);
      setPreviewStatus('Enter a pickup address first.');
      return;
    }

    setPreviewStatus('Resolving pickup address...');

    try {
      const data = await geocodeLocation(foodData.location);
      setPickupPreview(data);
      setPreviewStatus(data.displayName || 'Pickup location resolved.');
    } catch (err) {
      console.error('Pickup preview failed:', err);
      setPickupPreview(null);
      setPreviewStatus('Could not resolve that pickup address.');
    }
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    const res = await api.post('/food/add', { ...foodData, donor: user._id });
    setMyListings((current) => [res.data, ...current]);
    setFoodData(initialFoodData);
    setPickupPreview(null);
    setPreviewStatus('');
    setShowFoodModal(false);
  };

  if (!user) return null;

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-rail">
        <div className="profile-section">
          <div className="profile-pic">{user.username.charAt(0).toUpperCase()}</div>
          <h3>{user.username}</h3>
          <p className="role-badge">{isDonor ? 'Donor' : 'Receiver'}</p>
        </div>

        <nav className="dash-nav">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={activeTab === 'operations' ? 'active' : ''} onClick={() => setActiveTab('operations')}>
            Operations
          </button>
          {!isDonor && (
            <button className={activeTab === 'browse' ? 'active' : ''} onClick={() => setActiveTab('browse')}>
              Browse Food
            </button>
          )}
          <button onClick={() => setShowProfileModal(true)}>Edit Profile</button>
          <button className="logout-btn" onClick={() => { localStorage.clear(); navigate('/login'); }}>Logout</button>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="section-header dashboard-topbar">
          <div>
            <p className="eyebrow">{isDonor ? 'Donor workspace' : 'Receiver workspace'}</p>
            <h1>{isDonor ? 'Manage surplus before it expires.' : 'Coordinate pickups that still have time.'}</h1>
          </div>
          {isDonor && (
            <button className="btn-primary" onClick={() => setShowFoodModal(true)}>
              Add listing
            </button>
          )}
        </header>

        {error && <div className="notice error-notice">{error}</div>}

        {activeTab === 'overview' && (
          <>
            <section className="metrics-grid">
              <StatCard label={isDonor ? 'Active listings' : 'Orders placed'} value={isDonor ? activeListings.length : myOrders.length} />
              <StatCard label="Estimated meals" value={totalMeals(activityItems)} />
              <StatCard label="Food volume" value={`${totalKg(activityItems).toFixed(1)} kg`} />
              <StatCard label={isDonor ? 'Claimed listings' : 'Urgent matches'} value={isDonor ? claimedListings.length : urgentItems.length} />
            </section>

            <section className="ops-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Recent activity</p>
                  <h2>{isDonor ? 'Your listings' : 'Order history'}</h2>
                </div>
              </div>
              <div className="table-container">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Expiry</th>
                      <th>Quantity</th>
                      <th>Meals</th>
                      <th>Freshness</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityItems.map((item) => (
                      <tr key={item._id}>
                        <td>{item.title}</td>
                        <td>{formatDateTime(item.expiryDate)}</td>
                        <td>{item.quantity}</td>
                        <td>{item.estimatedMeals || 0}</td>
                        <td><span className={`status-pill ${freshnessClass(item.freshness?.state)}`}>{freshnessLabel(item.freshness?.state)}</span></td>
                        <td><span className={`status-pill ${urgencyClass(item.expiry?.urgency)}`}>{statusLabel(item)}</span></td>
                      </tr>
                    ))}
                    {activityItems.length === 0 && (
                      <tr><td colSpan="6" className="empty-cell">No activity yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === 'operations' && (
          <section className="ops-grid">
            <div className="ops-card map-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Map operations</p>
                  <h2>{isDonor ? 'Pickup locations' : 'Available surplus nearby'}</h2>
                </div>
              </div>
              <OperationsMap items={operationalItems} />
            </div>

            <div className="ops-card operations-queue">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Allocation queue</p>
                  <h2>{operationalItems.length} records</h2>
                </div>
              </div>
              <div className="queue-list">
                {operationalItems.map((item) => (
                  <article key={item._id} className="queue-row">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.pickupAddress || item.location}</p>
                    </div>
                    <div className="queue-meta">
                      <span className={`status-pill ${urgencyClass(item.expiry?.urgency)}`}>{urgencyLabel(item.expiry?.urgency)}</span>
                      <span className={`status-pill ${freshnessClass(item.freshness?.state)}`}>{freshnessLabel(item.freshness?.state)}</span>
                      <small>{item.estimatedMeals || 0} meals</small>
                    </div>
                  </article>
                ))}
                {operationalItems.length === 0 && <div className="empty-state compact-empty">No mapped records yet.</div>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'browse' && !isDonor && (
          <section className="food-results-list">
            {availableFood.map((item) => (
              <article key={item._id} className="ops-card food-result-card">
                <div>
                  <p className="eyebrow">{item.category || 'general'}</p>
                  <h3>{item.title}</h3>
                  <p>{item.pickupAddress || item.location}</p>
                  <span className={`status-pill ${urgencyClass(item.expiry?.urgency)}`}>{urgencyLabel(item.expiry?.urgency)}</span>
                  <span className={`status-pill ${freshnessClass(item.freshness?.state)}`}>{freshnessLabel(item.freshness?.state)}</span>
                </div>
                <div className="food-result-side">
                  <p><strong>Meals</strong>{item.estimatedMeals || 0}</p>
                  <p><strong>Expires</strong>{formatDateTime(item.expiryDate)}</p>
                  <p><strong>Freshness</strong>{formatFreshnessScore(item.freshness)}</p>
                  <button className="btn-primary" onClick={() => handleClaimClick(item)}>Check route</button>
                </div>
              </article>
            ))}
            {availableFood.length === 0 && <div className="empty-state">No food available right now.</div>}
          </section>
        )}
      </section>

      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-panel">
            <div className="section-header">
              <h3>Edit profile</h3>
              <button className="icon-close" type="button" onClick={() => setShowProfileModal(false)}>Close</button>
            </div>
            <form className="add-food-form" onSubmit={handleProfileUpdate}>
              <label>Address<input value={profileData.address} onChange={(e) => setProfileData({ ...profileData, address: e.target.value })} required /></label>
              <label>Phone<input value={profileData.phone} onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })} /></label>
              <label>Organization<input value={profileData.organization} onChange={(e) => setProfileData({ ...profileData, organization: e.target.value })} /></label>
              <button type="submit" className="btn-primary">Save profile</button>
            </form>
          </div>
        </div>
      )}

      {showFoodModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-panel wide-modal">
            <div className="section-header">
              <div>
                <p className="eyebrow">New surplus listing</p>
                <h3>Add food</h3>
              </div>
              <button className="icon-close" type="button" onClick={() => setShowFoodModal(false)}>Close</button>
            </div>
            <form className="add-food-form listing-form" onSubmit={handleAddFood}>
              <label>Title<input value={foodData.title} onChange={(e) => updateFoodData('title', e.target.value)} required /></label>
              <label>Quantity<input value={foodData.quantity} onChange={(e) => updateFoodData('quantity', e.target.value)} placeholder="10 kg" required /></label>
              <label>
                Category
                <select value={foodData.category} onChange={(e) => updateFoodData('category', e.target.value)}>
                  {CATEGORY_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>Expiry<input type="datetime-local" value={foodData.expiryDate} onChange={(e) => updateFoodData('expiryDate', e.target.value)} required /></label>
              <label>Device ID<input value={foodData.deviceId} onChange={(e) => updateFoodData('deviceId', e.target.value)} placeholder="eco-device-001" /></label>
              <label className="full-row">Pickup address<input value={foodData.location} onChange={(e) => updateFoodData('location', e.target.value)} required /></label>
              <label>Temperature C<input type="number" step="0.1" value={foodData.temperatureC} onChange={(e) => updateFoodData('temperatureC', e.target.value)} placeholder="4" /></label>
              <label>Humidity %<input type="number" step="0.1" value={foodData.humidityPct} onChange={(e) => updateFoodData('humidityPct', e.target.value)} placeholder="60" /></label>
              <label>Gas level<input type="number" step="1" value={foodData.gasLevel} onChange={(e) => updateFoodData('gasLevel', e.target.value)} placeholder="25" /></label>
              <label className="full-row">Description<textarea value={foodData.description} onChange={(e) => updateFoodData('description', e.target.value)} rows="3" /></label>
              <div className="full-row modal-actions">
                <button className="btn-secondary" type="button" onClick={handlePreviewPickup}>Preview pickup</button>
                <button className="btn-primary" type="submit">Post listing</button>
              </div>
              {(previewStatus || pickupPreview) && (
                <div className="notice full-row">
                  <strong>Pickup preview</strong>
                  <p>{previewStatus}</p>
                  {pickupPreview && (
                    <small>
                      {pickupPreview.coordinates.lat.toFixed(4)}, {pickupPreview.coordinates.lng.toFixed(4)}
                    </small>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
