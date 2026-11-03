import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bus,
  BusFront,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  GitFork,
  Hospital,
  House,
  Hotel,
  Landmark,
  LogOut,
  MapPin,
  MapPinned,
  Navigation,
  RefreshCw,
  Settings,
  ShoppingBag,
  Users,
  UserRound,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import './pages.css';
import { api } from './api';
import LoginPage from './LoginPage';
import {
  AdminPage, DataPage, PlacesPage, pageConfigs, to12h, asArray,
} from './Pages';

const defaultCities = [
  { name: 'Solapur', latitude: 17.6599, longitude: 75.9064 },
  { name: 'Tuljapur', latitude: 18.007, longitude: 76.07 },
  { name: 'Dharashiv', latitude: 18.186, longitude: 76.0419 },
  { name: 'Latur', latitude: 18.4088, longitude: 76.5604 },
];

const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes} min`;
};

const navigation = [
  { label: 'Home', icon: House, page: 'dashboard' },
  { label: 'Bus Information', icon: BusFront, page: 'buses' },
  { label: 'Bus Routes', icon: MapPinned, page: 'routes' },
  { label: 'Bus Schedules', icon: CalendarDays, page: 'schedules' },
  { label: 'Live Tracking', icon: MapPin, page: 'dashboard', target: 'live-tracking' },
  { label: 'Crowd Information', icon: Users, page: 'crowd' },
  { label: 'Estimated Arrival', icon: Clock3, page: 'arrivals' },
  { label: 'Traffic Information', icon: CarFront, page: 'traffic' },
  { label: 'Road Connectivity', icon: GitFork, page: 'connectivity' },
  { label: 'Nearby Places', icon: Landmark, page: 'places' },
  { label: 'Admin Panel', icon: Settings, page: 'admin' },
];

function LiveMap({ cities, locations, buses }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const busMarkersRef = useRef([]);
  const cityKey = cities.join('|');

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const map = L.map(mapElement.current, { zoomControl: false, scrollWheelZoom: false })
      .setView([17.9, 76.0], 9);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    routeRef.current = L.polyline([], { color: '#1477e8', weight: 4, opacity: 0.92 }).addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      routeRef.current = null;
      stationMarkersRef.current = [];
      busMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const known = cities.filter((c) => locations[c]);
    const route = known.map((c) => locations[c]);
    if (route.length < 2) return;
    routeRef.current?.setLatLngs(route);
    map.fitBounds(route, { padding: [45, 45], maxZoom: route.length === 2 ? 11 : 10 });

    stationMarkersRef.current.forEach((m) => m.remove());
    stationMarkersRef.current = known.map((city, index) => {
      const isEndpoint = index === 0 || index === known.length - 1;
      const icon = L.divIcon({
        className: isEndpoint ? 'station-marker-wrap' : 'stop-marker-wrap',
        html: `<span class="${isEndpoint ? 'station-marker' : 'stop-marker'}"></span>`,
        iconSize: [isEndpoint ? 22 : 14, isEndpoint ? 22 : 14],
        iconAnchor: [isEndpoint ? 11 : 7, isEndpoint ? 11 : 7],
      });
      return L.marker(locations[city], { icon })
        .addTo(map)
        .bindPopup(`${city}${isEndpoint ? (index === 0 ? ' · origin' : ' · destination') : ' · stop'}`);
    });
  }, [cityKey, locations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    busMarkersRef.current.forEach((m) => m.remove());
    const icon = L.divIcon({
      className: 'bus-marker-wrap',
      html: '<span class="bus-marker">▰</span>',
      iconSize: [29, 29],
      iconAnchor: [14, 14],
    });
    busMarkersRef.current = buses
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => L.marker([b.latitude, b.longitude], { icon })
        .addTo(map)
        .bindPopup(`${b.bus_number} · ${b.route_name || ''}<br/>${b.speed_kmh} km/h · ${b.occupancy_percent}% full`));
  }, [buses]);

  return <div className="live-map" ref={mapElement} aria-label="Bus route map" />;
}

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [guest, setGuest] = useState(false);

  const [cityList, setCityList] = useState(defaultCities);
  const [fromChoice, setFromChoice] = useState('Solapur');
  const [toChoice, setToChoice] = useState('Latur');
  const [selectedFrom, setSelectedFrom] = useState('Solapur');
  const [selectedTo, setSelectedTo] = useState('Latur');
  const [routeError, setRouteError] = useState('');
  const [apiError, setApiError] = useState('');
  const [activeNav, setActiveNav] = useState('Home');
  const [page, setPage] = useState('dashboard');
  const [placesType, setPlacesType] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [now, setNow] = useState(new Date());

  const [dashStats, setDashStats] = useState(null);
  const [apiJourney, setApiJourney] = useState(null);
  const [liveBuses, setLiveBuses] = useState([]);
  const [arrivals, setArrivals] = useState([]);
  const [trafficRoads, setTrafficRoads] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [nearby, setNearby] = useState([]);

  const cityNames = cityList.map((c) => c.name);
  const locations = useMemo(
    () => Object.fromEntries(cityList.map((c) => [c.name, [c.latitude, c.longitude]])),
    [cityList],
  );

  useEffect(() => {
    api.cities().then((c) => { if (asArray(c).length) setCityList(c); }).catch((e) => setApiError(e.message));
    api.stats().then(setDashStats).catch((e) => setApiError(e.message));
  }, []);

  useEffect(() => {
    api.journey(selectedFrom, selectedTo)
      .then((j) => { setApiJourney(j); setRouteError(''); })
      .catch((e) => { setApiJourney(null); setRouteError(e.message); });
  }, [selectedFrom, selectedTo]);

  useEffect(() => {
    api.nearby(selectedFrom).then((r) => setNearby(asArray(r))).catch(() => setNearby([]));
  }, [selectedFrom]);

  const loadLive = useCallback(() => {
    Promise.all([api.liveBuses(), api.arrivals(), api.traffic(), api.schedules()])
      .then(([live, arr, traffic, sched]) => {
        setLiveBuses(asArray(live));
        setArrivals(asArray(arr));
        setTrafficRoads(asArray(traffic && traffic.roads));
        setAllSchedules(asArray(sched));
        setApiError('');
        setLastUpdated(new Date());
      })
      .catch((e) => setApiError(e.message));
  }, []);

  useEffect(() => {
    loadLive();
    const liveTimer = window.setInterval(loadLive, 10_000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(liveTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadLive]);

  const journey = apiJourney
    ? {
        cities: asArray(apiJourney.cities),
        distance: apiJourney.distance_km,
        duration: formatDuration(apiJourney.time_min),
        fare: apiJourney.estimated_fare,
        stops: apiJourney.stops,
      }
    : { cities: [selectedFrom, selectedTo], distance: '--', duration: '--', fare: '--', stops: 0 };

  const pairs = journey.cities.slice(0, -1).map((c, i) => `${c}|${journey.cities[i + 1]}`);

  const routeSchedules = allSchedules.filter((s) => pairs.includes(`${s.source}|${s.destination}`));
  const shownSchedules = (routeSchedules.length ? routeSchedules : allSchedules).slice(0, 3);

  const roadsOnRoute = trafficRoads.filter(
    (r) => pairs.includes(`${r.source_city}|${r.destination_city}`)
      || pairs.includes(`${r.destination_city}|${r.source_city}`),
  );
  let traffic = { smooth: '--', moderate: '--', heavy: '--' };
  let trafficLevel = 'No data';
  let trafficClass = 'smooth';
  let trafficLoad = 0;
  if (roadsOnRoute.length) {
    const avg = Math.round(
      roadsOnRoute.reduce((sum, r) => sum + Number(r.congestion_percent || 0), 0) / roadsOnRoute.length,
    );
    trafficLoad = avg;
    traffic = {
      smooth: 100 - avg,
      moderate: avg >= 60 ? 0 : avg,
      heavy: avg >= 60 ? avg : 0,
    };
    trafficLevel = avg < 30 ? 'Smooth' : avg < 60 ? 'Moderate' : 'Heavy';
    trafficClass = trafficLevel.toLowerCase();
  }

  const statCards = [
    { label: 'Total Buses', value: dashStats?.total_buses ?? '--', icon: BusFront, color: 'blue', note: 'Across the division' },
    { label: 'Active Buses', value: dashStats?.active_buses ?? '--', icon: Check, color: 'green', note: 'On the road now' },
    { label: 'Total Routes', value: dashStats?.total_routes ?? '--', icon: GitFork, color: 'purple', note: 'Connected routes' },
    { label: 'Registered Passengers', value: dashStats?.registered_passengers ?? '--', icon: Users, color: 'orange', note: 'In the system' },
    { label: 'Avg. Crowd Level', value: dashStats?.avg_crowd_level ?? '--', icon: Users, color: 'red', note: 'Across all stops' },
  ];

  const placeCards = [
    { label: 'Hospitals', type: 'Hospital', icon: Hospital, color: 'red' },
    { label: 'Temples', type: 'Temple', icon: Landmark, color: 'orange' },
    { label: 'Hotels', type: 'Hotel', icon: Hotel, color: 'blue' },
    { label: 'Shopping', type: 'ShoppingMall', icon: ShoppingBag, color: 'purple' },
  ].map((p) => ({ ...p, count: `${nearby.filter((n) => n.type === p.type).length} nearby` }));

  const openPage = (label, pageKey, target) => {
    setActiveNav(label);
    setPage(pageKey);
    window.scrollTo({ top: 0 });
    if (pageKey === 'dashboard' && target) {
      window.setTimeout(
        () => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        80,
      );
    }
  };
  const goHome = () => openPage('Home', 'dashboard');

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setGuest(false);
    setProfileOpen(false);
    openPage('Home', 'dashboard');
  };

  const submitJourney = (event) => {
    event.preventDefault();
    if (fromChoice === toChoice) {
      setRouteError('Choose two different cities to find a bus route.');
      return;
    }
    setSelectedFrom(fromChoice);
    setSelectedTo(toChoice);
    setRouteError('');
    loadLive();
  };

  const swapJourney = () => {
    if (fromChoice === toChoice) {
      setRouteError('Choose two different cities to find a bus route.');
      return;
    }
    setFromChoice(toChoice);
    setToChoice(fromChoice);
    setSelectedFrom(toChoice);
    setSelectedTo(fromChoice);
    setRouteError('');
  };

  if (!user && !guest) {
    return (
      <LoginPage
        onSuccess={(u) => { setUser(u); setGuest(false); }}
        onGuest={() => setGuest(true)}
      />
    );
  }

  return (
    <div className="dashboard-shell" id="dashboard">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" onClick={goHome}>
          <span className="brand-icon"><BusFront size={36} strokeWidth={2.2} /></span>
          <span className="brand-name">Smart<span>Transport</span></span>
          <span className="brand-tagline">Smart City · Smart Mobility</span>
        </a>

        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, page: pageKey, target }) => (
            <button
              className={`nav-item ${activeNav === label ? 'active' : ''}`}
              key={label}
              onClick={() => openPage(label, pageKey, target)}
              type="button"
            >
              <Icon size={19} strokeWidth={2.4} />
              <span>{label}</span>
            </button>
          ))}
          <button className="nav-item logout-item" type="button" onClick={handleLogout}>
            <LogOut size={19} strokeWidth={2.4} /><span>Logout</span>
          </button>
        </nav>

        <div className="sidebar-cityscape" aria-hidden="true">
          <span className="cityline cityline-one" />
          <span className="cityline cityline-two" />
          <span className="cityline cityline-three" />
          <p>Smarter City...<br />Greener Tomorrow...</p>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div className="header-skyline" aria-hidden="true" />
          <div className="header-title">
            <h1>Smart City Public Transportation Management System</h1>
            <p><MapPin size={14} fill="currentColor" /> Solapur <i /> Tuljapur <i /> Dharashiv <i /> Latur</p>
          </div>
          <div className="header-actions">
            <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)} type="button">
              <span className="profile-avatar"><UserRound size={23} fill="white" /></span>
              <span className="profile-copy"><small>Welcome</small><strong>{user ? user.name : 'Guest'}</strong></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <strong>{user ? user.name : 'Guest visitor'}</strong>
                <span>{user ? user.email : 'Not signed in'}</span>
                <button type="button" onClick={() => { setProfileOpen(false); openPage('Admin Panel', 'admin'); }}>
                  <Settings size={15} /> Account settings
                </button>
                <button type="button" onClick={handleLogout}>
                  <LogOut size={15} /> {user ? 'Logout' : 'Go to login'}
                </button>
              </div>
            )}
            <span className="header-divider" />
            <button className="notification-button" aria-label="Notifications" onClick={() => setNotice(!notice)} type="button">
              <Bell size={22} />
              <span className="notification-count">{notice ? 1 : 2}</span>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {apiError && (
            <p className="route-error" role="alert">
              Cannot read data from the backend: {apiError}
            </p>
          )}

          {pageConfigs[page] && <DataPage pageKey={page} onBack={goHome} />}
          {page === 'places' && (
            <PlacesPage cityNames={cityNames} defaultCity={selectedFrom} defaultType={placesType} onBack={goHome} />
          )}
          {page === 'admin' && (
            <AdminPage
              user={user}
              onBack={goHome}
              onLogin={() => setGuest(false)}
              onLogout={handleLogout}
            />
          )}

          {page === 'dashboard' && (
            <>
              <section className="journey-planner panel" aria-label="Plan your journey">
                <div className="planner-heading">
                  <span className="planner-icon"><Navigation size={19} /></span>
                  <div>
                    <h2>Plan your journey</h2>
                    <p>Choose your starting point and destination to see buses and route details.</p>
                  </div>
                </div>
                <form className="journey-form" onSubmit={submitJourney}>
                  <label className="journey-field">
                    <span>From</span>
                    <span className="journey-select">
                      <MapPin size={16} />
                      <select value={fromChoice} onChange={(event) => setFromChoice(event.target.value)} aria-label="Starting city">
                        {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                      <ChevronDown size={15} />
                    </span>
                  </label>
                  <button className="swap-route" type="button" onClick={swapJourney} aria-label="Swap starting point and destination">
                    <RefreshCw size={17} />
                  </button>
                  <label className="journey-field">
                    <span>To</span>
                    <span className="journey-select destination-select">
                      <MapPin size={16} />
                      <select value={toChoice} onChange={(event) => setToChoice(event.target.value)} aria-label="Destination city">
                        {cityNames.map((city) => <option key={city} value={city}>{city}</option>)}
                      </select>
                      <ChevronDown size={15} />
                    </span>
                  </label>
                  <button className="find-buses-button" type="submit"><BusFront size={17} /> Find buses</button>
                </form>
                <div className="journey-summary" aria-live="polite">
                  <span><Navigation size={14} /> {selectedFrom} <ArrowRight size={13} /> {selectedTo}</span>
                  <i />
                  <span>{journey.distance} km</span>
                  <i />
                  <span>{journey.duration}</span>
                  <i />
                  <span>{journey.stops} {journey.stops === 1 ? 'stop' : 'stops'}</span>
                  <i />
                  <span>Est. fare ₹{journey.fare}</span>
                </div>
                {apiJourney && asArray(apiJourney.direct_buses).length > 0 && (
                  <div className="journey-summary">
                    {apiJourney.direct_buses.map((b) => (
                      <span key={b.route_id}>
                        <Bus size={14} /> {b.bus_number} ({b.bus_type}):{' '}
                        {asArray(b.schedules).map((s) => to12h(s.departure_time)).join(', ')}
                      </span>
                    ))}
                  </div>
                )}
                {apiJourney && apiJourney.needs_transfer && (
                  <p className="route-error">
                    No direct bus. Change buses at: {journey.cities.join(' → ')}
                  </p>
                )}
                {routeError && <p className="route-error" role="alert">{routeError}</p>}
              </section>

              <section className="stats-grid" aria-label="Transit overview">
                {statCards.map(({ label, value, icon: Icon, color, note }) => (
                  <article className={`stat-card stat-${color}`} key={label}>
                    <div className="stat-icon"><Icon size={25} strokeWidth={2.7} /></div>
                    <div className="stat-copy">
                      <strong>{value}</strong>
                      <span>{label}</span>
                      <small>{note}</small>
                    </div>
                    <svg className="stat-sparkline" viewBox="0 0 180 32" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 25 C18 23 22 17 37 22 S56 28 72 17 S96 18 111 21 S135 5 148 15 S165 22 180 8 V32 H0Z" />
                      <path className="spark-stroke" d="M0 25 C18 23 22 17 37 22 S56 28 72 17 S96 18 111 21 S135 5 148 15 S165 22 180 8" />
                    </svg>
                  </article>
                ))}
              </section>

              <section className="overview-grid">
                <article className="panel map-panel" id="live-tracking">
                  <div className="panel-heading map-heading">
                    <h2><MapPin size={20} fill="currentColor" /> Live Bus Tracking</h2>
                    <div className="map-tools">
                      <span className="route-chip">{selectedFrom} <ArrowRight size={13} /> {selectedTo}</span>
                      <button className="live-refresh" onClick={loadLive} type="button">
                        <RefreshCw size={15} /> Live
                      </button>
                      <span className="sr-only" aria-live="polite">
                        Map refreshed at {lastUpdated.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="map-frame">
                    <LiveMap cities={journey.cities} locations={locations} buses={liveBuses} />
                    <div className="map-route-badge">
                      <span className="route-badge-pulse" />
                      <span><strong>{selectedFrom}</strong><ArrowRight size={13} /><strong>{selectedTo}</strong></span>
                      <small>{liveBuses.length} buses live · {journey.distance} km</small>
                    </div>
                    <div className="map-legend">
                      <span><i className="legend-dot on-time" />Bus on route</span>
                      <span><i className="legend-dot route-dot" />Selected route</span>
                      <span><i className="legend-dot stop-dot" />Route stop</span>
                    </div>
                    <span className="map-attribution">© OpenStreetMap</span>
                  </div>
                </article>

                <div className="right-stack">
                  <article className="panel arrivals-panel" id="arrivals">
                    <div className="panel-heading">
                      <h2><BusFront size={19} /> Next Arrivals</h2>
                      <button className="text-link" type="button" onClick={() => openPage('Estimated Arrival', 'arrivals')}>
                        View All <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="arrival-list">
                      {arrivals.length === 0 && <p style={{ padding: 16 }}>No live arrivals right now.</p>}
                      {arrivals.slice(0, 3).map((arrival) => (
                        <div className="arrival-row" key={arrival.trip_id}>
                          <div className="arrival-bus"><Bus size={26} /></div>
                          <div className="arrival-details">
                            <strong>{arrival.bus_number}</strong>
                            <span>{arrival.source} → {arrival.destination}</span>
                          </div>
                          <div className="arrival-time">
                            <strong>{arrival.eta_minutes} min</strong>
                            <span>{arrival.status}{arrival.delay_minutes > 0 ? ` · +${arrival.delay_minutes} min` : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="panel traffic-panel" id="traffic">
                    <div className="panel-heading">
                      <h2><CarFront size={19} /> Traffic Information</h2>
                      <button className="text-link" type="button" onClick={() => openPage('Traffic Information', 'traffic')}>
                        View Details <ArrowRight size={14} />
                      </button>
                    </div>
                    <div className="traffic-content">
                      <div
                        className={`traffic-gauge traffic-${trafficClass}`}
                        style={{ '--traffic-load': `${trafficLoad}%` }}
                        aria-label={`${trafficLevel} traffic on the selected route`}
                      >
                        <div><CarFront size={23} /><strong>{trafficLevel}<br />Traffic</strong></div>
                      </div>
                      <div className="traffic-legend">
                        <span><i className="legend-dot smooth" />Smooth Roads <strong>{traffic.smooth}{traffic.smooth === '--' ? '' : '%'}</strong></span>
                        <span><i className="legend-dot moderate" />Moderate Traffic <strong>{traffic.moderate}{traffic.moderate === '--' ? '' : '%'}</strong></span>
                        <span><i className="legend-dot heavy" />Heavy Traffic <strong>{traffic.heavy}{traffic.heavy === '--' ? '' : '%'}</strong></span>
                      </div>
                    </div>
                    <p className="traffic-route-note">
                      {selectedFrom} → {selectedTo} · {roadsOnRoute.length ? roadsOnRoute.map((r) => r.road_name).join(', ') : 'no traffic data for this route'}
                    </p>
                  </article>
                </div>
              </section>

              <section className="bottom-grid">
                <article className="panel schedule-panel" id="schedules">
                  <div className="panel-heading">
                    <h2><CalendarDays size={19} /> Bus Schedules</h2>
                    <button className="text-link" type="button" onClick={() => openPage('Bus Schedules', 'schedules')}>
                      View All <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="schedule-table-wrap">
                    <table>
                      <thead><tr><th>From</th><th>To</th><th>Departure</th><th>Arrival</th></tr></thead>
                      <tbody>
                        {shownSchedules.map((schedule) => (
                          <tr key={schedule.schedule_id}>
                            <td>{schedule.source}</td>
                            <td>{schedule.destination}</td>
                            <td>{to12h(schedule.departure_time)}</td>
                            <td>{to12h(schedule.arrival_time)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="panel places-panel" id="places">
                  <div className="panel-heading">
                    <h2><MapPin size={19} fill="currentColor" /> Places near {selectedFrom}</h2>
                    <button className="text-link" type="button" onClick={() => { setPlacesType(''); openPage('Nearby Places', 'places'); }}>
                      View All <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="places-grid">
                    {placeCards.map(({ label, type, count, icon: Icon, color }) => (
                      <button
                        className={`place-card place-${color}`}
                        key={label}
                        type="button"
                        onClick={() => { setPlacesType(type); openPage('Nearby Places', 'places'); }}
                      >
                        <span><Icon size={29} fill="currentColor" /></span>
                        <strong>{label}</strong>
                        <small>{count}</small>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="promo-card">
                  <div className="promo-cityscape" aria-hidden="true">
                    <span /><span /><span /><span /><span />
                  </div>
                  <div className="promo-copy">
                    <strong>SmartTransport</strong>
                    <span>Travel Smart. Live Better.</span>
                  </div>
                  <div className="promo-bus"><BusFront size={100} strokeWidth={1.5} /></div>
                  <div className="promo-swoosh" />
                  <ArrowUpRight className="promo-arrow" size={18} />
                </article>
              </section>
            </>
          )}

          <footer className="dashboard-footer">
            <span>SmartTransport · Public transit overview</span>
            <span>System time: {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;