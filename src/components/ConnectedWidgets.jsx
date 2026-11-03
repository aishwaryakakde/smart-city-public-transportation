import { useEffect, useState } from 'react'
import { api } from '../api'

const box = { padding: 20, background: '#fff', borderRadius: 12 }

export function StatCards() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.stats().then(setS).catch((e) => setErr(e.message))
  }, [])

  if (err) return <p style={{ color: 'red' }}>Error: {err}</p>
  if (!s) return <p>Loading...</p>

  const cards = [
    { value: s.total_buses, label: 'Total Buses' },
    { value: s.active_buses, label: 'Active Buses' },
    { value: s.total_routes, label: 'Total Routes' },
    { value: s.registered_passengers, label: 'Registered Passengers' },
    { value: s.avg_crowd_level, label: 'Avg. Crowd Level' },
  ]
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {cards.map((c) => (
        <div key={c.label} style={{ ...box, minWidth: 160 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{c.value}</div>
          <div>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

export function JourneyPlanner({ onResult }) {
  const [cities, setCities] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.cities().then((c) => {
      setCities(c)
      if (c.length > 1) {
        setFrom(c[0].name)
        setTo(c[1].name)
      }
    }).catch((e) => setErr(e.message))
  }, [])

  const swap = () => { setFrom(to); setTo(from) }

  const find = async () => {
    setErr(''); setResult(null); setLoading(true)
    try {
      const r = await api.journey(from, to)
      setResult(r)
      if (onResult) onResult(r)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={box}>
      <h3>Plan your journey</h3>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {cities.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <button onClick={swap}>⇄</button>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {cities.map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <button onClick={find} disabled={loading}>{loading ? 'Searching...' : 'Find buses'}</button>
      </div>

      {err && <p style={{ color: 'red' }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <p>
            <b>{result.from} → {result.to}</b> · {result.distance_km} km ·{' '}
            {Math.floor(result.time_min / 60)}h {result.time_min % 60}m · {result.stops} stops ·
            Est. fare ₹{result.estimated_fare}
          </p>
          {result.needs_transfer && <p>No direct bus. Route via: {result.cities.join(' → ')}</p>}
          {result.direct_buses.map((b) => (
            <div key={b.route_id} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
              <b>{b.bus_number}</b> ({b.bus_type}, {b.total_seats} seats)
              <div>
                Departures: {b.schedules.map((s) => `${s.departure_time.slice(0, 5)}→${s.arrival_time.slice(0, 5)}`).join(' | ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function NextArrivals() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    const load = () => api.arrivals().then(setRows).catch((e) => setErr(e.message))
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={box}>
      <h3>Next Arrivals</h3>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      {rows.map((r) => (
        <div key={r.trip_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #eee' }}>
          <div>
            <b>{r.bus_number}</b>
            <div>{r.source} → {r.destination} · at {r.stop_name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>{r.eta_minutes} min</b>
            <div>{r.status}{r.delay_minutes ? ` (+${r.delay_minutes} min)` : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TrafficInfo() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.traffic().then(setData).catch((e) => setErr(e.message))
  }, [])

  if (err) return <p style={{ color: 'red' }}>{err}</p>
  if (!data) return <p>Loading...</p>

  return (
    <div style={box}>
      <h3>Traffic Information</h3>
      {data.roads.map((r) => (
        <div key={r.road_name} style={{ padding: '6px 0', borderTop: '1px solid #eee' }}>
          <b>{r.source_city} → {r.destination_city}</b> ({r.road_name}) · {r.traffic_level} ·{' '}
          {r.congestion_percent}% congestion · {r.average_speed_kmh} km/h
        </div>
      ))}
    </div>
  )
}