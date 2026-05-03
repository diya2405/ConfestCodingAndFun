import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) {
      return setError('Both fields are required.');
    }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>

        <div style={s.logo}>
          <span style={s.logoText}>CONFEST</span>
        </div>

        <h1 style={s.title}>Welcome back</h1>
        <p style={s.sub}>Sign in to your account</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handle} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ ...s.input, paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={s.eyeBtn}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p style={s.footer}>
          No account?{' '}
          <Link to="/register" style={s.link}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: '24px' },
  card:    { width: '100%', maxWidth: 520, background: '#FFFFFF', border: '1px solid #E6E7EA', borderRadius: 18, padding: '40px 36px 32px', boxSizing: 'border-box' },
  logo:    { marginBottom: 20 },
  logoText:{ fontSize: 24, fontWeight: 900, color: '#F97316', letterSpacing: 1, fontFamily: 'Georgia, serif' },
  title:   { fontSize: 28, fontWeight: 900, color: '#0F1720', margin: '0 0 8px', fontFamily: 'Georgia, serif' },
  sub:     { fontSize: 16, color: '#6B7280', margin: '0 0 24px' },
  error:   { background: '#FFF1F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 20 },
  form:    { display: 'flex', flexDirection: 'column', gap: 18 },
  field:   { display: 'flex', flexDirection: 'column', gap: 8 },
  label:   { fontSize: 15, fontWeight: 700, color: '#374151' },
  input:   { background: '#FFFFFF', border: '1.25px solid #E6E7EA', borderRadius: 10, padding: '12px 14px', fontSize: 16, color: '#0F1720', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  eyeBtn:  { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 },
  btn:     { marginTop: 8, padding: '14px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  footer:  { textAlign: 'center', marginTop: 22, fontSize: 15, color: '#6B7280' },
  link:    { color: '#F97316', fontWeight: 700, textDecoration: 'none' },
};