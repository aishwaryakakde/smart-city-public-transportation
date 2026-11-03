import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import neo4j from 'neo4j-driver';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const {
  PORT = 5000, JWT_SECRET = 'dev_secret',
  MYSQL_HOST = 'localhost', MYSQL_PORT = 3306, MYSQL_USER = 'root', MYSQL_PASSWORD = 'root', MYSQL_DB = 'smart_transport',
  MONGO_URI = 'mongodb://localhost:27017', MONGO_DB = 'smart_transport',
  NEO4J_URI = 'bolt://localhost:7687', NEO4J_USER = 'neo4j', NEO4J_PASSWORD = '#Aishwarya07', NEO4J_DB = 'neo4j',
  FARE_PER_KM = 1,
} = process.env;

// ---------- connections ----------
const sql = mysql.createPool({
  host: MYSQL_HOST, port: Number(MYSQL_PORT), user: MYSQL_USER, password: MYSQL_PASSWORD,
  database: MYSQL_DB, waitForConnections: true, connectionLimit: 10, dateStrings: true,
});
const mongoClient = new MongoClient(MONGO_URI);
const mongo = mongoClient.db(MONGO_DB);
const neo = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// ---------- helpers ----------
const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(500).json({ error: e.message });
  });

const plain = (v) => {
  if (neo4j.isInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};
const cypher = async (query, params = {}) => {
  const session = neo.session({ database: NEO4J_DB });
  try {
    const r = await session.run(query, params);
    return r.records.map((rec) => plain(rec.toObject()));
  } finally {
    await session.close();
  }
};
const q = async (query, params = []) => (await sql.query(query, params))[0];

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ---------- health ----------
app.get('/api/health', wrap(async (_req, res) => {
  const out = { mysql: false, mongodb: false, neo4j: false };
  try { await q('SELECT 1'); out.mysql = true; } catch {}
  try { await mongo.command({ ping: 1 }); out.mongodb = true; } catch {}
  try { await cypher('RETURN 1 AS ok'); out.neo4j = true; } catch (e) { out.neo4j_error = e.message; }
  res.json(out);
}));

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { name, email, password, mobile_no, aadhar_no } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const exists = await q('SELECT user_id FROM user_registration WHERE email=?', [email]);
  if (exists.length) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const [r] = await sql.query(
    'INSERT INTO user_registration (name,email,password,mobile_no,aadhar_no) VALUES (?,?,?,?,?)',
    [name, email, hash, mobile_no || null, aadhar_no || null]);
  res.status(201).json({ user_id: r.insertId, name, email });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const [u] = await q('SELECT * FROM user_registration WHERE email=?', [email]);
  if (!u || !(await bcrypt.compare(password, u.password))) return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ user_id: u.user_id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { user_id: u.user_id, name: u.name, email: u.email } });
}));

app.get('/api/auth/me', auth, (req, res) => res.json(req.user));

// ---------- MySQL: buses, routes, schedules, stops ----------
app.get('/api/buses', wrap(async (_req, res) => {
  res.json(await q(`SELECT b.*, o.operator_name, o.contact_no AS operator_contact
                    FROM bus b LEFT JOIN operator o ON o.operator_id=b.operator_id`));
}));

app.get('/api/routes', wrap(async (_req, res) => {
  const routes = await q(`SELECT r.*, b.bus_number, b.bus_type FROM bus_route r LEFT JOIN bus b ON b.bus_id=r.bus_id`);
  const stops = await q(`SELECT route_id, stop_id, stop_sequence, stop_name FROM route_stop ORDER BY route_id, stop_sequence`);
  res.json(routes.map((r) => ({ ...r, stops: stops.filter((s) => s.route_id === r.route_id) })));
}));

app.get('/api/schedules', wrap(async (req, res) => {
  const { route_id } = req.query;
  const rows = await q(
    `SELECT s.*, b.bus_number, b.bus_type, r.route_name, r.source, r.destination
     FROM bus_schedule s JOIN bus b ON b.bus_id=s.bus_id JOIN bus_route r ON r.route_id=s.route_id
     ${route_id ? 'WHERE s.route_id=?' : ''} ORDER BY s.departure_time`, route_id ? [route_id] : []);
  res.json(rows);
}));

app.get('/api/stops', wrap(async (_req, res) => res.json(await q('SELECT * FROM bus_stop'))));

app.get('/api/cities', wrap(async (_req, res) => {
  res.json(await cypher('MATCH (c:City) RETURN c.name AS name, c.latitude AS latitude, c.longitude AS longitude ORDER BY c.name'));
}));

// ---------- dashboard cards ----------
app.get('/api/dashboard/stats', wrap(async (_req, res) => {
  const [[b], [a], [r], [p], [t]] = await Promise.all([
    q('SELECT COUNT(*) n FROM bus'),
    q("SELECT COUNT(*) n FROM bus WHERE status='Active'"),
    q('SELECT COUNT(*) n FROM bus_route'),
    q('SELECT COUNT(*) n FROM passenger'),
    q("SELECT COUNT(*) n FROM ticket WHERE purchase_datetime >= DATE_FORMAT(NOW(),'%Y-%m-01')"),
  ]);
  const crowd = await mongo.collection('bus_stop_crowd_snapshots').find().toArray();
  const rank = { Low: 1, Medium: 2, High: 3 };
  const avg = crowd.length ? crowd.reduce((s, c) => s + (rank[c.crowd_level] || 0), 0) / crowd.length : 0;
  res.json({
    total_buses: b.n, active_buses: a.n, total_routes: r.n,
    registered_passengers: p.n, tickets_this_month: t.n,
    avg_crowd_level: avg >= 2.5 ? 'High' : avg >= 1.5 ? 'Medium' : 'Low',
  });
}));

// ---------- Plan your journey ----------
app.get('/api/journey', wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  if (from === to) return res.status(400).json({ error: 'From and To must be different' });

  const [path] = await cypher(
    `MATCH (a:City {name:$from}),(b:City {name:$to}),
           p = shortestPath((a)-[:ROAD_TO*]-(b))
     RETURN [n IN nodes(p) | n.name] AS cities,
            reduce(d=0, r IN relationships(p) | d + r.distance_km) AS distance_km,
            reduce(t=0, r IN relationships(p) | t + r.travel_time_min) AS time_min,
            [r IN relationships(p) | r.highway] AS highways`, { from, to });
  if (!path) return res.status(404).json({ error: 'No road connection found' });

  const direct = await q(
    `SELECT r.route_id, r.route_name, r.distance_km, r.estimated_time, b.bus_id, b.bus_number, b.bus_type, b.total_seats
     FROM bus_route r JOIN bus b ON b.bus_id=r.bus_id WHERE r.source=? AND r.destination=?`, [from, to]);
  for (const d of direct) {
    d.schedules = await q('SELECT schedule_id, departure_time, arrival_time, status FROM bus_schedule WHERE route_id=? ORDER BY departure_time', [d.route_id]);
  }

  res.json({
    from, to,
    cities: path.cities,
    stops: Math.max(path.cities.length - 2, 0),
    distance_km: path.distance_km,
    time_min: path.time_min,
    highways: path.highways,
    estimated_fare: Math.round(path.distance_km * Number(FARE_PER_KM)),
    direct_buses: direct,
    needs_transfer: direct.length === 0,
  });
}));

// ---------- MongoDB: live tracking, arrivals, crowd, traffic ----------
const busLookup = async () => {
  const rows = await q(`SELECT b.bus_id, b.bus_number, b.bus_type, r.route_id, r.route_name, r.source, r.destination, r.distance_km
                        FROM bus b LEFT JOIN bus_route r ON r.bus_id=b.bus_id`);
  return Object.fromEntries(rows.map((r) => [r.bus_id, r]));
};
const stopLookup = async () => Object.fromEntries((await q('SELECT * FROM bus_stop')).map((s) => [s.stop_id, s]));

app.get('/api/live/buses', wrap(async (req, res) => {
  const filter = {};
  if (req.query.route_id) filter.route_id = Number(req.query.route_id);
  const [docs, buses] = await Promise.all([mongo.collection('bus_live_locations').find(filter).toArray(), busLookup()]);
  res.json(docs.map((d) => ({
    ...buses[d.bus_id],
    bus_id: d.bus_id, route_id: d.route_id,
    latitude: d.position.coordinates[1], longitude: d.position.coordinates[0],
    speed_kmh: d.speed_kmh, occupancy_percent: d.occupancy_percent,
    observed_at: d.observed_at, data_source: d.data_source,
  })));
}));

app.get('/api/arrivals', wrap(async (_req, res) => {
  const [docs, buses, stops] = await Promise.all([
    mongo.collection('bus_arrival_status').find().sort({ estimated_arrival: 1 }).toArray(), busLookup(), stopLookup()]);
  const now = Date.now();
  res.json(docs.map((d) => ({
    trip_id: d.trip_id, bus_id: d.bus_id,
    bus_number: buses[d.bus_id]?.bus_number,
    route_name: buses[d.bus_id]?.route_name,
    source: buses[d.bus_id]?.source, destination: buses[d.bus_id]?.destination,
    stop_name: stops[d.stop_id]?.stop_name,
    eta_minutes: Math.max(Math.round((new Date(d.estimated_arrival) - now) / 60000), 0),
    delay_minutes: d.delay_minutes, status: d.status,
    estimated_arrival: d.estimated_arrival,
  })));
}));

app.get('/api/crowd', wrap(async (_req, res) => {
  const [docs, stops] = await Promise.all([mongo.collection('bus_stop_crowd_snapshots').find().toArray(), stopLookup()]);
  res.json(docs.map((d) => ({ ...d, _id: undefined, stop_name: stops[d.stop_id]?.stop_name, platform_no: stops[d.stop_id]?.platform_no })));
}));

app.get('/api/traffic', wrap(async (_req, res) => {
  const docs = await mongo.collection('route_traffic').find().toArray();
  const summary = docs.reduce((a, d) => ({ ...a, [d.traffic_level]: (a[d.traffic_level] || 0) + 1 }), {});
  res.json({ roads: docs.map((d) => ({ ...d, _id: undefined })), summary });
}));

app.get('/api/status-history', wrap(async (_req, res) => {
  res.json(await mongo.collection('bus_status_history').find().sort({ changed_at: -1 }).limit(50).toArray());
}));

// ---------- Neo4j: road connectivity and nearby places ----------
app.get('/api/connectivity', wrap(async (_req, res) => {
  const roads = await cypher(
    `MATCH (a:City)-[r:ROAD_TO]->(b:City)
     RETURN a.name AS from, b.name AS to, r.distance_km AS distance_km, r.travel_time_min AS travel_time_min, r.highway AS highway`);
  res.json({ cities: await cypher('MATCH (c:City) RETURN c.name AS name, c.latitude AS latitude, c.longitude AS longitude'), roads });
}));

app.get('/api/nearby', wrap(async (req, res) => {
  const { city, type } = req.query;
  const allowed = ['Hospital', 'Temple', 'Hotel', 'ShoppingMall'];
  if (type && !allowed.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const rows = await cypher(
    `MATCH (p)-[:LOCATED_IN]->(c:City)
     WHERE ($city IS NULL OR c.name = $city) AND ($type IS NULL OR $type IN labels(p))
     RETURN labels(p)[0] AS type, p.name AS name, p.latitude AS latitude, p.longitude AS longitude,
            c.name AS city, p.emergency AS emergency
     ORDER BY c.name, type`, { city: city || null, type: type || null });
  res.json(rows);
}));

// ---------- NCMC card and tickets ----------
app.get('/api/ncmc/:cardNumber', wrap(async (req, res) => {
  const [card] = await q('SELECT * FROM ncmc_card WHERE card_number=?', [req.params.cardNumber]);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const txns = await q('SELECT * FROM ncmc_transaction WHERE card_id=? ORDER BY txn_date_time DESC', [card.card_id]);
  res.json({ card, transactions: txns });
}));

app.post('/api/ncmc/:cardNumber/recharge', auth, wrap(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'Invalid amount' });
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.query('SELECT * FROM ncmc_card WHERE card_number=? FOR UPDATE', [req.params.cardNumber]);
    if (!card) { await conn.rollback(); return res.status(404).json({ error: 'Card not found' }); }
    const newBal = Number(card.balance) + amount;
    await conn.query('UPDATE ncmc_card SET balance=? WHERE card_id=?', [newBal, card.card_id]);
    await conn.query(`INSERT INTO ncmc_transaction (card_id,amount,txn_date_time,balance_after,transaction_type) VALUES (?,?,NOW(),?,'RECHARGE')`,
      [card.card_id, amount, newBal]);
    await conn.commit();
    res.json({ balance: newBal });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

app.post('/api/tickets', wrap(async (req, res) => {
  const { card_number, route_id } = req.body;
  const conn = await sql.getConnection();
  try {
    await conn.beginTransaction();
    const [[card]] = await conn.query('SELECT * FROM ncmc_card WHERE card_number=? FOR UPDATE', [card_number]);
    const [[route]] = await conn.query('SELECT * FROM bus_route WHERE route_id=?', [route_id]);
    if (!card || !route) { await conn.rollback(); return res.status(404).json({ error: 'Card or route not found' }); }
    const fare = Math.round(Number(route.distance_km) * Number(FARE_PER_KM));
    if (Number(card.balance) < fare) { await conn.rollback(); return res.status(402).json({ error: 'Insufficient balance', fare }); }
    const newBal = Number(card.balance) - fare;
    await conn.query('UPDATE ncmc_card SET balance=? WHERE card_id=?', [newBal, card.card_id]);
    const [t] = await conn.query(`INSERT INTO ncmc_transaction (card_id,amount,txn_date_time,balance_after,transaction_type) VALUES (?,?,NOW(),?,'FARE')`,
      [card.card_id, fare, newBal]);
    const [tk] = await conn.query('INSERT INTO ticket (card_id,bus_id,route_id,fare,purchase_datetime,txn_id) VALUES (?,?,?,?,NOW(),?)',
      [card.card_id, route.bus_id, route_id, fare, t.insertId]);
    await conn.query(`INSERT INTO payment (ticket_id,amount,payment_mode,status,payment_date) VALUES (?,?,'NCMC','Success',NOW())`, [tk.insertId, fare]);
    await conn.commit();
    res.status(201).json({ ticket_id: tk.insertId, fare, balance: newBal });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// ---------- admin ----------
app.get('/api/admin/summary', auth, wrap(async (_req, res) => {
  const [users] = await q('SELECT COUNT(*) n FROM user_registration');
  const [tickets] = await q('SELECT COUNT(*) n, COALESCE(SUM(fare),0) revenue FROM ticket');
  res.json({ users: users.n, tickets: tickets.n, revenue: Number(tickets.revenue) });
}));

// ---------- start ----------
const start = async () => {
  await mongoClient.connect();
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}  (check /api/health)`));
};
start().catch((e) => { console.error('Startup failed:', e.message); process.exit(1); });
process.on('SIGINT', async () => { await mongoClient.close(); await neo.close(); await sql.end(); process.exit(0); });