import { useState } from 'react';
import {
  BusFront, Clock3, Eye, EyeOff, Lock, LogIn, Mail, MapPin, Phone, ShieldCheck, UserPlus, UserRound,
} from 'lucide-react';
import { api } from './api';
import { BusArt } from './Illustrations';

export default function LoginPage({ onSuccess, onGuest }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile_no: '' });
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const isLogin = mode === 'login';

  const change = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!form.email || !form.password || (!isLogin && !form.name)) {
      setMessage('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      if (!isLogin) {
        await api.register({
          name: form.name,
          email: form.email,
          password: form.password,
          mobile_no: form.mobile_no || undefined,
        });
      }
      const data = await api.login(form.email, form.password);
      onSuccess(data.user);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <div className="auth-brand">
          <span className="auth-brand-icon"><BusFront size={30} /></span>
          <div>
            <strong>Smart<span>Transport</span></strong>
            <small>Smart City · Smart Mobility</small>
          </div>
        </div>

        <h1>Travel smart across Solapur, Tuljapur, Dharashiv and Latur</h1>
        <p>Live bus tracking, schedules, crowd and traffic updates, all in one place.</p>

        <ul className="auth-features">
          <li><MapPin size={18} /> Live bus tracking on the map</li>
          <li><Clock3 size={18} /> Accurate arrivals and schedules</li>
          <li><ShieldCheck size={18} /> Secure NCMC card and ticket records</li>
        </ul>

        <BusArt className="auth-art" id="login-bus" />
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-card-head">
            <span className="auth-card-icon">{isLogin ? <LogIn size={24} /> : <UserPlus size={24} />}</span>
            <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p>{isLogin ? 'Sign in to continue to your dashboard.' : 'Register to start using SmartTransport.'}</p>
          </div>

          <div className="auth-tabs">
            <button type="button" className={isLogin ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Login</button>
            <button type="button" className={!isLogin ? 'active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Register</button>
          </div>

          {!isLogin && (
            <label className="auth-field">
              <UserRound size={18} />
              <input placeholder="Full name" value={form.name} onChange={change('name')} />
            </label>
          )}

          <label className="auth-field">
            <Mail size={18} />
            <input type="email" placeholder="Email address" value={form.email} onChange={change('email')} autoComplete="email" />
          </label>

          {!isLogin && (
            <label className="auth-field">
              <Phone size={18} />
              <input placeholder="Mobile number (optional)" value={form.mobile_no} onChange={change('mobile_no')} />
            </label>
          )}

          <label className="auth-field">
            <Lock size={18} />
            <input
              type={show ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={change('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            <button type="button" className="auth-eye" onClick={() => setShow(!show)} aria-label="Show or hide password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </label>

          {message && <p className="auth-message">{message}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>

          <button className="auth-guest" type="button" onClick={onGuest}>
            Continue as guest
          </button>
        </form>
      </section>
    </div>
  );
}