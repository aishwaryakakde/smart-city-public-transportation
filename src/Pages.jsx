import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BusFront, CalendarDays, CarFront, Clock3, GitFork, Hospital, Hotel,
  Landmark, LogIn, LogOut, MapPinned, Search, Settings, ShoppingBag, Users,
} from 'lucide-react';
import { api } from './api';
import { BusArt, SkylineStrip } from './Illustrations';

export const asArray = (v) => (Array.isArray(v) ? v : []);

export const to12h = (t) => {
  if (!t) return '--';
  const [h, m] = String(t).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

export const pageConfigs = {
  buses: {
    title: 'Bus Information',
    subtitle: 'All buses with their type, seats, depot and operator.',
    icon: BusFront,
    load: () => api.buses(),
    columns: [
      ['Bus Number', 'bus_number'], ['Type', 'bus_type'], ['Seats', 'total_seats'],
      ['Status', 'status'], ['Depot', 'dept_name'], ['Operator', 'operator_name'],
    ],
  },
  routes: {
    title: 'Bus Routes',
    subtitle: 'Every route with distance, travel time and the stops on the way.',
    icon: MapPinned,
    load: () => api.routes(),
    columns: [
      ['Route', 'route_name'], ['From', 'source'], ['To', 'destination'],
      ['Distance (km)', 'distance_km'], ['Time (min)', 'estimated_time'], ['Bus', 'bus_number'],
      ['Stops', (r) => asArray(r.stops).map((s) => s.stop_name).join(' → ')],
    ],
  },
  schedules: {
    title: 'Bus Schedules',
    subtitle: 'Departure and arrival times for every bus.',
    icon: CalendarDays,
    load: () => api.schedules(),
    columns: [
      ['Route', 'route_name'], ['Bus', 'bus_number'], ['Type', 'bus_type'],
      ['Departure', (r) => to12h(r.departure_time)], ['Arrival', (r) => to12h(r.arrival_time)],
      ['Status', 'status'],
    ],
  },
  arrivals: {
    title: 'Estimated Arrival',
    subtitle: 'Live estimated arrival of buses at each stop.',
    icon: Clock3,
    load: () => api.arrivals(),
    columns: [
      ['Bus', 'bus_number'], ['Route', 'route_name'], ['At stop', 'stop_name'],
      ['ETA', (r) => `${r.eta_minutes} min`], ['Delay', (r) => `${r.delay_minutes} min`],
      ['Status', 'status'],
    ],
  },
  traffic: {
    title: 'Traffic Information',
    subtitle: 'Road conditions, congestion and average speed on each route.',
    icon: CarFront,
    load: () => api.traffic().then((d) => asArray(d.roads)),
    columns: [
      ['Road', 'road_name'], ['From', 'source_city'], ['To', 'destination_city'],
      ['Traffic level', 'traffic_level'], ['Congestion', (r) => `${r.congestion_percent}%`],
      ['Avg speed', (r) => `${r.average_speed_kmh} km/h`],
    ],
  },
  crowd: {
    title: 'Crowd Information',
    subtitle: 'How busy each bus stop is right now.',
    icon: Users,
    load: () => api.crowd(),
    columns: [
      ['Bus stop', 'stop_name'], ['Platform', 'platform_no'], ['Crowd level', 'crowd_level'],
      ['Estimated people', 'crowd_count_estimate'],
    ],
  },
  connectivity: {
    title: 'Road Connectivity',
    subtitle: 'Roads that connect the cities, with distance and travel time.',
    icon: GitFork,
    load: () => api.connectivity().then((d) => asArray(d.roads)),
    columns: [
      ['From', 'from'], ['To', 'to'], ['Distance (km)', 'distance_km'],
      ['Travel time (min)', 'travel_time_min'], ['Highway', 'highway'],
    ],
  },
};

const tones = {
  Active: 'green', 'On Time': 'green', Low: 'green', Smooth: 'green', Running: 'green', Success: 'green',
  Scheduled: 'blue',
  Medium: 'amber', Moderate: 'amber', Delayed: 'amber',
  High: 'red', Heavy: 'red', Maintenance: 'red',
};

function Cell({ value }) {
  const text = value === null || value === undefined ? '' : value;
  const tone = typeof text === 'string' ? tones[text] : null;
  return tone ? <span className={`pg-badge pg-badge-${tone}`}>{text}</span> : <>{String(text)}</>;
}

function DataTable({ columns, rows }) {
  return (
    <div className="pg-table-wrap">
      <table className="pg-table">
        <thead>
          <tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(([label, key]) => (
                <td key={label}><Cell value={typeof key === 'function' ? key(row) : row[key]} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageHero({ icon: Icon, title, subtitle, chips = [], onBack }) {
  return (
    <header className="page-hero">
      <div className="page-hero-copy">
        <span className="page-hero-icon"><Icon size={26} /></span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <div className="page-hero-chips">
            {chips.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      </div>
      <BusArt className="page-hero-art" id="hero-bus" />
      <SkylineStrip className="page-hero-skyline" />
      <button type="button" className="page-back" onClick={onBack}>
        <ArrowLeft size={15} /> Back to dashboard
      </button>
    </header>
  );
}

function Loading() {
  return <div className="pg-loading"><span className="pg-spinner" /> Loading data...</div>;
}

function Empty({ text = 'No data found.' }) {
  return <div className="pg-empty"><BusFront size={34} /><p>{text}</p></div>;
}

export function DataPage({ pageKey, onBack }) {
  const config = pageConfigs[pageKey];
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setRows(null);
    setError('');
    setSearch('');
    config.load().then((r) => setRows(asArray(r))).catch((e) => setError(e.message));
  }, [pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  return (
    <>
      <PageHero
        icon={config.icon}
        title={config.title}
        subtitle={config.subtitle}
        chips={rows ? [`${rows.length} records`, 'Live from database'] : ['Loading...']}
        onBack={onBack}
      />
      <article className="page-card">
        <div className="page-toolbar">
          <label className="page-search">
            <Search size={17} />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {rows && <span className="page-count">Showing {filtered.length} of {rows.length}</span>}
        </div>
        {error && <p className="route-error" role="alert">{error}</p>}
        {!rows && !error && <Loading />}
        {rows && (filtered.length ? <DataTable columns={config.columns} rows={filtered} /> : <Empty />)}
      </article>
    </>
  );
}

const placeMeta = {
  Hospital: { icon: Hospital, tone: 'red', label: 'Hospital' },
  Temple: { icon: Landmark, tone: 'orange', label: 'Temple' },
  Hotel: { icon: Hotel, tone: 'blue', label: 'Hotel' },
  ShoppingMall: { icon: ShoppingBag, tone: 'purple', label: 'Shopping mall' },
};

export function PlacesPage({ cityNames, defaultCity, defaultType, onBack }) {
  const [city, setCity] = useState(defaultCity);
  const [type, setType] = useState(defaultType || '');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    setError('');
    api.nearby(city, type).then((r) => setRows(asArray(r))).catch((e) => setError(e.message));
  }, [city, type]);

  const types = [['', 'All'], ['Hospital', 'Hospitals'], ['Temple', 'Temples'], ['Hotel', 'Hotels'], ['ShoppingMall', 'Shopping']];

  return (
    <>
      <PageHero
        icon={Landmark}
        title="Nearby Places"
        subtitle="Hospitals, temples, hotels and malls close to the bus stops."
        chips={rows ? [`${rows.length} places`, city || 'All cities'] : ['Loading...']}
        onBack={onBack}
      />
      <article className="page-card">
        <div className="page-toolbar">
          <div className="filter-chips">
            {types.map(([value, label]) => (
              <button
                key={label}
                type="button"
                className={`filter-chip ${type === value ? 'active' : ''}`}
                onClick={() => setType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <select className="page-select" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cityNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {error && <p className="route-error" role="alert">{error}</p>}
        {!rows && !error && <Loading />}
        {rows && rows.length === 0 && <Empty text="No places found." />}
        {rows && rows.length > 0 && (
          <div className="place-tiles">
            {rows.map((p, i) => {
              const meta = placeMeta[p.type] || placeMeta.Hotel;
              const Icon = meta.icon;
              return (
                <article className={`place-tile tile-${meta.tone}`} key={`${p.name}-${i}`}>
                  <span className="place-tile-icon"><Icon size={26} /></span>
                  <div className="place-tile-text">
                    <strong>{p.name}</strong>
                    <small>{p.city} · {meta.label}</small>
                  </div>
                  {p.emergency && <span className="pg-badge pg-badge-red">24x7 Emergency</span>}
                </article>
              );
            })}
          </div>
        )}
      </article>
    </>
  );
}

export function AdminPage({ user, onBack, onLogin, onLogout }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  const tiles = stats
    ? [
        ['Total buses', stats.total_buses, '#1477e8', '#0a58d0'],
        ['Active buses', stats.active_buses, '#16a34a', '#0f7a37'],
        ['Total routes', stats.total_routes, '#8b5cf6', '#6d3fe0'],
        ['Registered passengers', stats.registered_passengers, '#f59e0b', '#d97706'],
        ['Tickets this month', stats.tickets_this_month, '#ef4444', '#c81e1e'],
      ]
    : [];

  return (
    <>
      <PageHero
        icon={Settings}
        title="Admin Panel"
        subtitle={user ? `Signed in as ${user.name}` : 'You are browsing as a guest.'}
        chips={[user ? 'Signed in' : 'Guest mode']}
        onBack={onBack}
      />
      <article className="page-card">
        <div className="admin-profile">
          <span className="admin-avatar">{(user?.name || 'G').charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user ? user.name : 'Guest visitor'}</strong>
            <small>{user ? user.email : 'Login to manage your account.'}</small>
          </div>
          {user ? (
            <button className="pg-btn pg-btn-ghost" type="button" onClick={onLogout}>
              <LogOut size={16} /> Logout
            </button>
          ) : (
            <button className="pg-btn" type="button" onClick={onLogin}>
              <LogIn size={16} /> Go to login
            </button>
          )}
        </div>

        {error && <p className="route-error" role="alert">{error}</p>}
        {!stats && !error && <Loading />}
        {stats && (
          <div className="admin-grid">
            {tiles.map(([label, value, a, b]) => (
              <div className="admin-stat" key={label} style={{ '--a': a, '--b': b }}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}