const BASE = 'http://127.0.0.1:5000/api';

const request = async (path, options = {}) => {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...options,
    });
  } catch {
    throw new Error('Backend not reachable. Start the backend on port 5000.');
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    throw new Error('Backend returned an invalid response.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const api = {
  stats: () => request('/dashboard/stats'),
  cities: () => request('/cities'),
  journey: (from, to) =>
    request(`/journey?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  buses: () => request('/buses'),
  routes: () => request('/routes'),
  schedules: (routeId) => request(`/schedules${routeId ? `?route_id=${routeId}` : ''}`),
  stops: () => request('/stops'),

  liveBuses: (routeId) => request(`/live/buses${routeId ? `?route_id=${routeId}` : ''}`),
  arrivals: () => request('/arrivals'),
  crowd: () => request('/crowd'),
  traffic: () => request('/traffic'),

  connectivity: () => request('/connectivity'),
  nearby: (city, type) => {
    const p = new URLSearchParams();
    if (city) p.set('city', city);
    if (type) p.set('type', type);
    return request(`/nearby?${p.toString()}`);
  },

  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  card: (cardNumber) => request(`/ncmc/${cardNumber}`),
  recharge: (cardNumber, amount) =>
    request(`/ncmc/${cardNumber}/recharge`, { method: 'POST', body: JSON.stringify({ amount }) }),
  bookTicket: (card_number, route_id) =>
    request('/tickets', { method: 'POST', body: JSON.stringify({ card_number, route_id }) }),
};