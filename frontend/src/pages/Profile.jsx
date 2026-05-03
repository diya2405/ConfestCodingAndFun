import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
 
// ─── Reuse same Navbar ────────────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  return (
    <nav style={nav.bar}>
      <div style={nav.inner}>
        <Link to="/dashboard" style={nav.logo}>CONFEST</Link>
        <div style={nav.links}>
          <Link to="/dashboard" style={nav.link}>Dashboard</Link>
          <Link to="/contests" style={nav.link}>Contests</Link>
          <Link to="/leaderboard" style={nav.link}>Leaderboard</Link>
        </div>
        <div style={nav.right}>
          <Link to="/profile" style={{ ...nav.avatar, background: '#D4521A' }}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Link>
          <button onClick={onLogout} style={nav.logoutBtn}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
 
const nav = {
  bar: { position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1.5px solid #E8E4DC', fontFamily: '"DM Sans", "Segoe UI", sans-serif' },
  inner: { maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', padding: '0 32px', height: 64, gap: 40 },
  logo: { fontSize: 20, fontWeight: 900, color: '#D4521A', textDecoration: 'none', letterSpacing: 2, fontFamily: 'Georgia, serif' },
  links: { display: 'flex', gap: 32, flex: 1 },
  link: { fontSize: 15, fontWeight: 600, color: '#444', textDecoration: 'none' },
  right: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: { width: 38, height: 38, borderRadius: '50%', background: '#D4521A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, textDecoration: 'none' },
  logoutBtn: { padding: '8px 18px', borderRadius: 8, border: '1.5px solid #DDD', background: 'transparent', fontSize: 14, fontWeight: 600, color: '#666', cursor: 'pointer' },
};
 
// ─── Section Card wrapper ─────────────────────────────────────────────────────
function SectionCard({ title, children, action }) {
  return (
    <div style={sc.card}>
      <div style={sc.head}>
        <h2 style={sc.title}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
 
const sc = {
  card: { background: '#fff', borderRadius: 16, border: '1.5px solid #E8E4DC', padding: '22px 26px', marginBottom: 20 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 },
};
 
// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, accent }) {
  return (
    <div style={{ textAlign: 'center', background: accent + '12', borderRadius: 12, padding: '14px 16px', flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  );
}
 
// ─── Editable Field ───────────────────────────────────────────────────────────
function EditField({ label, name, value, type = 'text', onChange, disabled }) {
  return (
    <div style={ef.wrap}>
      <label style={ef.label}>{label}</label>
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        style={{ ...ef.input, background: disabled ? '#F9F7F4' : '#fff', color: disabled ? '#AAA' : '#1A1A1A' }}
      />
    </div>
  );
}
 
const ef = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: '#888' },
  input: {
    border: '1.5px solid #E8E4DC', borderRadius: 10,
    padding: '12px 16px', fontSize: 16, fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
};
 
// ─── Profile Page ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
 
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [submissions, setSubmissions] = useState([]);
 
  const INTERESTS = ['Arrays & Strings', 'Dynamic Programming', 'Graphs & Trees', 'Recursion', 'Sorting & Searching', 'System Design', 'Math & Number Theory', 'Bit Manipulation'];
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Competitive Programmer'];
 
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [meRes, subRes] = await Promise.all([
          API.get('/auth/me'),
          API.get('/submissions/recent'),
        ]);
        setProfile(meRes.data);
        setForm(meRes.data);
        setSubmissions(subRes.data?.submissions || []);
      } catch {
        const fallback = user || {};
        setProfile(fallback);
        setForm(fallback);
      }
    };
    fetchProfile();
  }, [user]);
 
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
  };
 
  const toggleInterest = (item) => {
    setForm(p => ({
      ...p,
      interests: (p.interests || []).includes(item)
        ? p.interests.filter(i => i !== item)
        : [...(p.interests || []), item],
    }));
  };
 
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await API.put('/auth/profile', {
        institution: form.institution,
        purpose: form.purpose,
        experience_level: form.experience_level,
        interests: form.interests,
        phone: form.phone,
      });
      setProfile(res.data?.user || form);
      setForm(res.data?.user || form);
      setSuccessMsg('Profile updated successfully!');
      setEditing(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      // If API not ready, save locally
      setProfile({ ...profile, ...form });
      setSuccessMsg('Profile updated!');
      setEditing(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };
 
  const handleLogout = () => { logout(); navigate('/login'); };
 
  const displayProfile = profile || user || {};
 
  // Mock submissions for display
  const mockSubs = [
    { problem_title: 'Two Sum', language: 'Python', score: 100, verdict: 'Accepted', submitted_at: new Date(Date.now() - 3600000) },
    { problem_title: 'Longest Common Subsequence', language: 'C++', score: 0, verdict: 'Wrong Answer', submitted_at: new Date(Date.now() - 86400000) },
    { problem_title: 'Binary Tree Traversal', language: 'Java', score: 80, verdict: 'Accepted', submitted_at: new Date(Date.now() - 172800000) },
    { problem_title: 'Graph BFS', language: 'Python', score: 100, verdict: 'Accepted', submitted_at: new Date(Date.now() - 259200000) },
  ];
  const displaySubs = submissions.length > 0 ? submissions : mockSubs;
 
  const verdictColor = { Accepted: '#16a34a', 'Wrong Answer': '#dc2626', 'Time Limit': '#d97706' };
 
  return (
    <div style={pg.root}>
      <Navbar user={displayProfile} onLogout={handleLogout} />
 
      <main style={pg.main}>
        {/* Breadcrumb */}
        <div style={pg.breadcrumb}>
          <Link to="/dashboard" style={pg.breadLink}>Dashboard</Link>
          <span style={{ color: '#CCC' }}> / </span>
          <span style={{ color: '#333' }}>Profile</span>
        </div>
 
        {/* Success/Error banner */}
        {successMsg && (
          <div style={pg.successBanner}>{successMsg}</div>
        )}
        {errorMsg && (
          <div style={pg.errorBanner}>{errorMsg}</div>
        )}
 
        <div style={pg.layout}>
          {/* LEFT — Profile Card */}
          <div style={pg.sidebar}>
            {/* Avatar block */}
            <div style={pg.avatarCard}>
              <div style={pg.avatarCircle}>
                {displayProfile.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <h2 style={pg.username}>{displayProfile.username || 'Username'}</h2>
              <p style={pg.email}>{displayProfile.email || 'email@example.com'}</p>
              {displayProfile.institution && (
                <p style={pg.institution}>🏛 {displayProfile.institution}</p>
              )}
              <div style={pg.levelBadge}>{displayProfile.experience_level || 'Intermediate'}</div>
 
              <div style={{ display: 'flex', gap: 10, marginTop: 20, width: '100%' }}>
                {!editing ? (
                  <button onClick={() => setEditing(true)} style={pg.editBtn}>Edit Profile</button>
                ) : (
                  <>
                    <button onClick={() => { setEditing(false); setForm(profile); }} style={pg.cancelBtn}>Cancel</button>
                    <button onClick={handleSave} style={pg.saveBtn} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>
 
            {/* Stats */}
            <div style={pg.sideStats}>
              {[
                { label: 'Score', value: displayProfile.score || 0, accent: '#D4521A' },
                { label: 'Solved', value: displayProfile.problems_solved || 0, accent: '#16a34a' },
                { label: 'Contests', value: displayProfile.contests_entered || 0, accent: '#7c3aed' },
                { label: 'Streak', value: `${displayProfile.streak || 0}d`, accent: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ ...pg.sideStat, borderLeft: `4px solid ${s.accent}` }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.accent }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
 
            {/* Purpose */}
            {displayProfile.purpose && (
              <div style={pg.purposeCard}>
                <div style={pg.purposeLabel}>Joined for</div>
                <div style={pg.purposeVal}>{displayProfile.purpose}</div>
              </div>
            )}
          </div>
 
          {/* RIGHT — Tabs */}
          <div style={pg.content}>
            {/* Tabs */}
            <div style={pg.tabRow}>
              {['overview', 'submissions', 'edit'].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{ ...pg.tab, ...(activeTab === t ? pg.tabActive : {}) }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
 
            {/* OVERVIEW TAB — Identity & About, NOT stats */}
            {activeTab === 'overview' && (
              <>
                {/* About card */}
                <SectionCard title="About">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {[
                      { label: 'Username', value: displayProfile.username || '—' },
                      { label: 'Email', value: displayProfile.email || '—' },
                      { label: 'Phone', value: displayProfile.phone || 'Not added' },
                      { label: 'Institution', value: displayProfile.institution || 'Not added' },
                      { label: 'Member Since', value: displayProfile.created_at ? new Date(displayProfile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A' },
                      { label: 'Purpose', value: displayProfile.purpose || 'Not specified' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ borderBottom: '1px solid #F5F2EC', paddingBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
 
                {/* Interests breakdown */}
                <SectionCard title="Topics You Follow">
                  {(displayProfile.interests || ['Arrays & Strings', 'Dynamic Programming', 'Graphs']).length === 0 ? (
                    <p style={{ fontSize: 13, color: '#AAA', margin: 0 }}>No interests added yet. Edit your profile to add some.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(displayProfile.interests || ['Arrays & Strings', 'Dynamic Programming', 'Graphs & Trees']).map((item, idx) => {
                        const widths = [88, 72, 61, 54, 47, 40, 33, 27];
                        const w = widths[idx % widths.length];
                        return (
                          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#444', width: 180, flexShrink: 0 }}>{item}</div>
                            <div style={{ flex: 1, height: 6, background: '#F0EDE6', borderRadius: 3 }}>
                              <div style={{ height: '100%', width: `${w}%`, background: '#D4521A', borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 12, color: '#D4521A', fontWeight: 700, width: 32, textAlign: 'right' }}>{w}%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
 
                {/* Achievements / badges */}
                <SectionCard title="Achievements">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { icon: '🥇', label: 'First Solve', earned: (displayProfile.problems_solved || 0) >= 1, desc: 'Solved your first problem' },
                      { icon: '🔥', label: 'On a Streak', earned: (displayProfile.streak || 0) >= 3, desc: '3+ day streak' },
                      { icon: '🏆', label: 'Contest Ready', earned: (displayProfile.contests_entered || 0) >= 1, desc: 'Joined a contest' },
                      { icon: '⚡', label: 'Speed Coder', earned: (displayProfile.problems_solved || 0) >= 5, desc: 'Solved 5+ problems' },
                      { icon: '🎯', label: 'Sharpshooter', earned: false, desc: '90%+ accuracy in a contest' },
                      { icon: '🌟', label: 'Top 10', earned: (displayProfile.rank || 999) <= 10, desc: 'Reached global top 10' },
                    ].map(({ icon, label, earned, desc }) => (
                      <div key={label} style={{
                        background: earned ? '#FEF1EB' : '#F9F7F4',
                        borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                        border: `1.5px solid ${earned ? '#F4B89A' : '#EEEBE4'}`,
                        opacity: earned ? 1 : 0.5,
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: earned ? '#D4521A' : '#888' }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#AAA', marginTop: 3 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}
 
            {/* SUBMISSIONS TAB */}
            {activeTab === 'submissions' && (
              <SectionCard title="Submission History">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F0EDE6' }}>
                      {['Problem', 'Language', 'Score', 'Verdict', 'Time'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#888', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displaySubs.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F0EDE6' }}>
                        <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                          {s.problem_title || 'Problem'}
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: 13, color: '#666' }}>{s.language}</td>
                        <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 700, color: '#D4521A' }}>+{s.score}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                            color: verdictColor[s.verdict] || '#888',
                            background: (verdictColor[s.verdict] || '#888') + '18',
                          }}>
                            {s.verdict}
                          </span>
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: 12, color: '#AAA' }}>
                          {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>
            )}
 
            {/* EDIT TAB */}
            {activeTab === 'edit' && (
              <>
                <SectionCard title="Personal Information">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <EditField label="Username" name="username" value={form.username} onChange={handleChange} disabled />
                    <EditField label="Email" name="email" value={form.email} onChange={handleChange} disabled />
                    <EditField label="Phone" name="phone" value={form.phone} type="tel" onChange={handleChange} />
                    <EditField label="Institution / College" name="institution" value={form.institution} onChange={handleChange} />
                  </div>
                  <p style={{ fontSize: 13, color: '#AAA', marginTop: 14, marginBottom: 0 }}>
                    Username and email cannot be changed. Contact support if needed.
                  </p>
                </SectionCard>
 
                <SectionCard title="Experience Level">
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {LEVELS.map(l => (
                      <button
                        key={l}
                        onClick={() => setForm(p => ({ ...p, experience_level: l }))}
                        style={{
                          padding: '10px 20px', borderRadius: 30, fontSize: 14, fontWeight: 600,
                          cursor: 'pointer', border: '1.5px solid',
                          borderColor: form.experience_level === l ? '#D4521A' : '#E8E4DC',
                          background: form.experience_level === l ? '#FEF1EB' : '#fff',
                          color: form.experience_level === l ? '#D4521A' : '#666',
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </SectionCard>
 
                <SectionCard title="Interests">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {INTERESTS.map(item => {
                      const active = (form.interests || []).includes(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleInterest(item)}
                          style={{
                            padding: '9px 18px', borderRadius: 30, fontSize: 14, fontWeight: 600,
                            cursor: 'pointer', border: '1.5px solid',
                            borderColor: active ? '#D4521A' : '#E8E4DC',
                            background: active ? '#FEF1EB' : '#fff',
                            color: active ? '#D4521A' : '#666',
                          }}
                        >
                          {active ? '✓ ' : ''}{item}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
 
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => { setForm(profile); setActiveTab('overview'); }}
                    style={{ padding: '12px 28px', borderRadius: 10, border: '1.5px solid #E8E4DC', background: 'transparent', fontSize: 15, fontWeight: 600, color: '#666', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '12px 36px', borderRadius: 10, border: 'none', background: '#D4521A', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
 
const pg = {
  root: { minHeight: '100vh', background: '#FAF8F4', fontFamily: '"DM Sans", "Segoe UI", sans-serif' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 32px 60px' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 24 },
  breadLink: { color: '#D4521A', textDecoration: 'none', fontWeight: 600 },
  successBanner: { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 15, fontWeight: 600 },
  errorBanner: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 18px', marginBottom: 20, fontSize: 15, fontWeight: 600 },
  layout: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 28 },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 20 },
  avatarCard: {
    background: '#fff', borderRadius: 18, border: '1.5px solid #E8E4DC',
    padding: '36px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: '50%', background: '#D4521A',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, fontWeight: 800, marginBottom: 14,
  },
  username: { fontSize: 18, fontWeight: 700, color: '#1A1A1A', margin: '0 0 3px', textAlign: 'center' },
  email: { fontSize: 13, color: '#888', margin: '0 0 6px' },
  institution: { fontSize: 12, color: '#666', margin: '0 0 10px', textAlign: 'center' },
  levelBadge: { background: '#FEF1EB', color: '#D4521A', fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20 },
  editBtn: { flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #D4521A', background: 'transparent', color: '#D4521A', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  cancelBtn: { flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E8E4DC', background: 'transparent', color: '#888', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn: { flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#D4521A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  sideStats: { background: '#fff', borderRadius: 16, border: '1.5px solid #E8E4DC', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  sideStat: { padding: '12px 16px', borderRadius: 10, background: '#FAF8F4' },
  purposeCard: { background: '#fff', borderRadius: 14, border: '1.5px solid #E8E4DC', padding: '18px 20px' },
  purposeLabel: { fontSize: 11, color: '#AAA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  purposeVal: { fontSize: 14, fontWeight: 600, color: '#1A1A1A' },
  content: {},
  tabRow: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: { padding: '7px 18px', borderRadius: 30, fontSize: 13, fontWeight: 600, border: '1.5px solid #E8E4DC', background: 'transparent', color: '#888', cursor: 'pointer' },
  tabActive: { background: '#D4521A', color: '#fff', borderColor: '#D4521A' },
  interestTag: { fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 20, background: '#F3F0EA', color: '#555' },
  langCard: { flex: 1, background: '#F9F7F4', borderRadius: 10, padding: '14px' },
  langName: { fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 },
  langBar: { height: 6, background: '#E8E4DC', borderRadius: 3, marginBottom: 6 },
  langFill: { height: '100%', background: '#D4521A', borderRadius: 3, transition: 'width 0.4s' },
  langPct: { fontSize: 12, color: '#D4521A', fontWeight: 700 },
};
 