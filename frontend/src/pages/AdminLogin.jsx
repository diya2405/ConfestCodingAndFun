import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // If already logged in as admin, redirect
  if (user?.role === 'admin') {
    navigate('/admin', { replace: true });
    return null;
  }

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Both fields are required.');
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      if (res.user?.role !== 'admin') {
        // Not an admin — log out and show error
        localStorage.removeItem('token');
        setError('Access denied. This portal is for administrators only.');
        setLoading(false);
        return;
      }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      {/* Background grid */}
      <div style={s.bg} />

      <div style={s.card}>
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={s.shield}>🛡️</div>
          <div style={s.logoText}>CONFEST</div>
          <div style={s.badge}>ADMIN PORTAL</div>
        </div>

        <h1 style={s.title}>Administrator Login</h1>
        <p style={s.sub}>Restricted access — authorised personnel only</p>

        {error && (
          <div style={s.error}>
            <span style={{ marginRight: 8 }}>⚠️</span>{error}
          </div>
        )}

        <form onSubmit={handle} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Admin Email</label>
            <input
              type="email"
              placeholder="admin@confest.app"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={s.input}
              autoComplete="username"
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
                autoComplete="current-password"
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
            {loading ? 'Authenticating...' : '🔐 Sign In as Admin'}
          </button>
        </form>

        <div style={s.divider} />

        <p style={s.note}>
          Not an admin?{' '}
          <a href="/login" style={s.link}>User login →</a>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0A0F1E',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '"DM Sans","Segoe UI",sans-serif',
  },
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,82,26,0.18) 0%, transparent 60%),' +
      'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
    backgroundSize: '100% 100%, 40px 40px, 40px 40px',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    background: 'rgba(15, 20, 40, 0.95)',
    border: '1px solid rgba(212,82,26,0.3)',
    borderRadius: 20,
    padding: '40px 36px 32px',
    boxSizing: 'border-box',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  shield: {
    fontSize: 40,
    marginBottom: 8,
    display: 'block',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 900,
    color: '#D4521A',
    letterSpacing: 3,
    fontFamily: 'Georgia,serif',
  },
  badge: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2,
    color: '#D4521A',
    background: 'rgba(212,82,26,0.15)',
    border: '1px solid rgba(212,82,26,0.4)',
    borderRadius: 20,
    padding: '3px 10px',
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: '#E6EDF3',
    margin: '0 0 6px',
    fontFamily: 'Georgia,serif',
  },
  sub: {
    fontSize: 13,
    color: '#6B7280',
    margin: '0 0 24px',
  },
  error: {
    background: 'rgba(185,28,28,0.15)',
    border: '1px solid rgba(185,28,28,0.4)',
    color: '#FCA5A5',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 13,
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 700, color: '#9CA3AF' },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    color: '#E6EDF3',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
  },
  btn: {
    marginTop: 8,
    padding: '13px',
    background: 'linear-gradient(135deg, #D4521A 0%, #B8421A 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    margin: '24px 0 18px',
  },
  note: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6B7280',
    margin: 0,
  },
  link: {
    color: '#D4521A',
    fontWeight: 700,
    textDecoration: 'none',
  },
};
