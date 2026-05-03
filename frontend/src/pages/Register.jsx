import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Background' },
  { id: 3, label: 'Interests' },
];

const PURPOSES  = ['Practice coding', 'College contests', 'Job prep', 'Teaching / Mentoring', 'Just for fun'];
const LEVELS    = ['Beginner', 'Intermediate', 'Advanced', 'Competitive Programmer'];
const INTERESTS = ['Arrays & Strings', 'Dynamic Programming', 'Graphs & Trees', 'Recursion', 'Sorting & Searching', 'System Design', 'Math & Number Theory', 'Bit Manipulation'];

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [step, setStep]       = useState(1);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    username: '', email: '', password: '', confirm: '', phone: '',
    institution: '', purpose: '', experience_level: '',
    interests: [],
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const toggleInterest = (item) =>
    setForm(p => ({
      ...p,
      interests: p.interests.includes(item)
        ? p.interests.filter(i => i !== item)
        : [...p.interests, item],
    }));

  const validate = () => {
    setError('');
    if (step === 1) {
      if (!form.username || !form.email || !form.password || !form.confirm)
        return setError('All fields are required.'), false;
      if (form.username.length < 3)
        return setError('Username needs at least 3 characters.'), false;
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email))
        return setError('Enter a valid email address.'), false;
      if (form.password.length < 6)
        return setError('Password needs at least 6 characters.'), false;
      if (form.password !== form.confirm)
        return setError('Passwords do not match.'), false;
    }
    if (step === 2) {
      if (!form.institution || !form.purpose || !form.experience_level)
        return setError('Please fill all fields.'), false;
    }
    if (step === 3) {
      if (form.interests.length === 0)
        return setError('Pick at least one interest.'), false;
    }
    return true;
  };

  const next   = () => { if (validate()) setStep(s => s + 1); };
  const back   = () => { setError(''); setStep(s => s - 1); };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, {
        phone: form.phone,
        institution: form.institution,
        purpose: form.purpose,
        experience_level: form.experience_level,
        interests: form.interests,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>

        <div style={s.logo}>CONFEST</div>
        <h1 style={s.title}>Create your account</h1>

        {/* Step indicator */}
        <div style={s.stepper}>
          {STEPS.map((st, i) => {
            const done   = step > st.id;
            const active = step === st.id;
            return (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, transition: 'all 0.2s',
                    background: done || active ? '#F97316' : '#1C1C26',
                    border: `2px solid ${done || active ? '#F97316' : '#2A2A3A'}`,
                    color: done || active ? '#fff' : '#4A4868',
                  }}>
                    {done ? '✓' : st.id}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#F97316' : '#4A4868', whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, margin: '0 6px 16px', background: step > st.id ? '#F97316' : '#2A2A3A', transition: 'background 0.3s' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && <div style={s.error}>{error}</div>}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div style={s.fields}>
            <Field label="Username">
              <input style={s.input} placeholder="devguru_x" value={form.username} onChange={e => set('username', e.target.value)} />
            </Field>
            <Field label="Email">
              <input style={s.input} type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
            <Field label="Phone (optional)">
              <input style={s.input} type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
            <Field label="Password">
              <input style={s.input} type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            </Field>
            <Field label="Confirm Password">
              <input style={s.input} type="password" placeholder="Repeat password" value={form.confirm} onChange={e => set('confirm', e.target.value)} />
            </Field>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div style={s.fields}>
            <Field label="Institution / College">
              <input style={s.input} placeholder="e.g. CHARUSAT University" value={form.institution} onChange={e => set('institution', e.target.value)} />
            </Field>
            <Field label="Why are you joining?">
              <div style={s.pills}>
                {PURPOSES.map(p => (
                  <button key={p} onClick={() => set('purpose', p)}
                    style={{ ...s.pill, ...(form.purpose === p ? s.pillOn : {}) }}>
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Your experience level">
              <div style={s.pills}>
                {LEVELS.map(l => (
                  <button key={l} onClick={() => set('experience_level', l)}
                    style={{ ...s.pill, ...(form.experience_level === l ? s.pillOn : {}) }}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div style={s.fields}>
            <Field label="Pick topics you want to practice">
              <div style={s.pills}>
                {INTERESTS.map(item => (
                  <button key={item} onClick={() => toggleInterest(item)}
                    style={{ ...s.pill, ...(form.interests.includes(item) ? s.pillOn : {}) }}>
                    {item}
                  </button>
                ))}
              </div>
            </Field>
            {form.interests.length > 0 && (
              <div style={s.selectedBox}>
                ✅ Selected: {form.interests.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {step > 1 && (
            <button onClick={back} style={s.btnGhost}>← Back</button>
          )}
          {step < 3
            ? <button onClick={next}   style={{ ...s.btn, flex: 1 }}>Continue →</button>
            : <button onClick={submit} style={{ ...s.btn, flex: 1 }} disabled={loading}>
                {loading ? 'Creating account...' : '🚀 Join Confest'}
              </button>
          }
        </div>

        <p style={s.footer}>
          Already have an account?{' '}
          <Link to="/login" style={s.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <label style={{ fontSize: 13, fontWeight: 700, color: '#8884A8' }}>{label}</label>
    {children}
  </div>
);

const s = {
  page:        { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: '24px' },
  card:        { width: '100%', maxWidth: 640, background: '#FFFFFF', border: '1px solid #E6E7EA', borderRadius: 18, padding: '36px 36px 28px', boxSizing: 'border-box' },
  logo:        { fontSize: 22, fontWeight: 900, color: '#F97316', fontFamily: 'Georgia, serif', marginBottom: 12, letterSpacing: 1 },
  title:       { fontSize: 26, fontWeight: 900, color: '#0F1720', margin: '0 0 20px', fontFamily: 'Georgia, serif' },
  stepper:     { display: 'flex', alignItems: 'flex-start', marginBottom: 22 },
  error:       { background: '#FFF1F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 10, padding: '12px 14px', fontSize: 14, marginBottom: 18 },
  fields:      { display: 'flex', flexDirection: 'column', gap: 18 },
  input:       { background: '#FFFFFF', border: '1.25px solid #E6E7EA', borderRadius: 10, padding: '12px 14px', fontSize: 16, color: '#0F1720', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  pills:       { display: 'flex', flexWrap: 'wrap', gap: 10 },
  pill:        { padding: '10px 18px', borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: 'pointer', border: '1.25px solid #E6E7EA', background: '#FFFFFF', color: '#374151', fontFamily: 'inherit', transition: 'all 0.15s' },
  pillOn:      { background: '#FFF4EB', border: '1.25px solid #F97316', color: '#F97316' },
  selectedBox: { background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#059669', borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 600 },
  btn:         { padding: '14px', background: '#F97316', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost:    { padding: '12px 18px', background: 'transparent', color: '#6B7280', border: '1.25px solid #E6E7EA', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  footer:      { textAlign: 'center', marginTop: 20, fontSize: 15, color: '#6B7280' },
  link:        { color: '#F97316', fontWeight: 700, textDecoration: 'none' },
};