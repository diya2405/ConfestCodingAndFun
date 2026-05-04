import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0A0F1E',
  panel:   '#0F1628',
  card:    'rgba(255,255,255,0.04)',
  border:  'rgba(255,255,255,0.09)',
  accent:  '#D4521A',
  accentL: 'rgba(212,82,26,0.15)',
  text:    '#E6EDF3',
  muted:   '#6B7280',
  green:   '#16a34a',
  red:     '#dc2626',
  yellow:  '#d97706',
  blue:    '#2563eb',
};

const VERDICT_C = {
  Accepted: '#16a34a', Partial: '#d97706',
  'Wrong Answer': '#dc2626', 'Runtime Error': '#7c3aed',
  'Compilation Error': '#7c3aed', 'Time Limit Exceeded': '#d97706',
};

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function Badge({ children, color = C.muted }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: color + '22',
      color,
    }}>
      {children}
    </span>
  );
}

function StatCard({ icon, label, value, sub, color = C.accent }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      borderTop: `3px solid ${color}`,
      flex: 1,
      minWidth: 150,
    }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginTop: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#444', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || 'Search…'}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '9px 14px',
        fontSize: 13,
        color: C.text,
        fontFamily: 'inherit',
        outline: 'none',
        width: 260,
      }}
    />
  );
}

function ActionBtn({ onClick, children, danger = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        border: 'none',
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        background: danger ? 'rgba(220,38,38,0.15)' : C.accentL,
        color: danger ? '#F87171' : C.accent,
        transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function Pagination({ page, total, perPage, onPage }) {
  const totalPages = Math.ceil(total / perPage) || 1;
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
      <ActionBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>← Prev</ActionBtn>
      <span style={{ fontSize: 12, color: C.muted }}>Page {page} / {totalPages} ({total} total)</span>
      <ActionBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next →</ActionBtn>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#13192E',
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '28px 32px',
        maxWidth: 400,
        width: '90%',
        fontFamily: '"DM Sans",sans-serif',
      }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: C.text, textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px', borderRadius: 8, border: 'none',
            background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
          }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/admin/stats').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (!stats) return <p style={{ color: C.muted }}>Failed to load stats.</p>;

  return (
    <div>
      <h2 style={T.sectionTitle}>Platform Overview</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <StatCard icon="👥" label="Total Users"       value={stats.total_users}       color={C.blue}   />
        <StatCard icon="🏆" label="Total Contests"    value={stats.total_contests}    color={C.accent} />
        <StatCard icon="📝" label="Submissions"       value={stats.total_submissions} color={C.green}  />
        <StatCard icon="🧩" label="Problems"          value={stats.total_problems}    color="#8b5cf6"  />
        <StatCard icon="✅" label="Accepted"          value={stats.accepted_submissions} sub={`of ${stats.total_submissions}`} color={C.green} />
        <StatCard icon="🔴" label="Live Contests"     value={stats.live_contests}     color={C.red}    />
        <StatCard icon="⭐" label="Active Users"      value={stats.active_users}      color={C.yellow} />
      </div>

      <div style={T.infoBox}>
        <h3 style={{ margin: '0 0 10px', color: C.text, fontSize: 14, fontWeight: 800 }}>🔑 Quick Actions</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href="#users"       style={T.quickLink}>Manage Users →</a>
          <a href="#contests"    style={T.quickLink}>Manage Contests →</a>
          <a href="#submissions" style={T.quickLink}>View Submissions →</a>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState('');
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState('');
  const [confirm, setConfirm]   = useState(null); // { id, name }

  const load = useCallback(() => {
    setLoading(true);
    API.get('/admin/users', { params: { page, per_page: 30, q } })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [load]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await API.put(`/admin/users/${u._id}`, { role: newRole });
      notify(`${u.username} is now ${newRole}`);
      load();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await API.delete(`/admin/users/${confirm.id}`);
      notify(`User "${confirm.name}" deleted`);
      setConfirm(null);
      load();
    } catch (err) {
      notify(err.response?.data?.error || 'Delete failed');
      setConfirm(null);
    }
  };

  return (
    <div id="users">
      {toast && <Toast msg={toast} />}
      {confirm && (
        <ConfirmDialog
          message={`Permanently delete user "${confirm.name}"? This also removes their submissions and contest entries.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={T.sectionTitle}>Users ({total})</h2>
        <SearchBar value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by name / email…" />
      </div>

      {loading ? <Loader /> : (
        <div style={T.tableWrap}>
          <table style={T.table}>
            <thead>
              <tr>
                {['Username','Email','Institution','Role','Score','Problems','Contests','Joined','Actions'].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={9} style={{ ...T.td, textAlign: 'center', color: C.muted, padding: 32 }}>No users found</td></tr>
              )}
              {users.map(u => (
                <tr key={u._id} style={T.tr}>
                  <td style={T.td}><span style={{ fontWeight: 700, color: C.text }}>{u.username}</span></td>
                  <td style={{ ...T.td, color: C.muted }}>{u.email}</td>
                  <td style={{ ...T.td, color: C.muted }}>{u.institution || '—'}</td>
                  <td style={T.td}>
                    <Badge color={u.role === 'admin' ? C.accent : C.muted}>
                      {u.role === 'admin' ? '👑 Admin' : 'User'}
                    </Badge>
                  </td>
                  <td style={{ ...T.td, color: C.text }}>{u.score}</td>
                  <td style={{ ...T.td, color: C.muted }}>{u.problems_solved}</td>
                  <td style={{ ...T.td, color: C.muted }}>{u.contests_entered}</td>
                  <td style={{ ...T.td, color: C.muted, fontSize: 11 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ ...T.td, display: 'flex', gap: 6 }}>
                    <ActionBtn onClick={() => toggleRole(u)}>
                      {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                    </ActionBtn>
                    <ActionBtn danger onClick={() => setConfirm({ id: u._id, name: u.username })}>
                      Delete
                    </ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} perPage={30} onPage={setPage} />
    </div>
  );
}

// ─── Contests Tab ─────────────────────────────────────────────────────────────
function ContestsTab() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [q, setQ]             = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState('');
  const [confirm, setConfirm] = useState(null);

  const STATUS_C = { live: C.green, upcoming: C.accent, completed: C.muted, unknown: C.muted };

  const load = useCallback(() => {
    setLoading(true);
    API.get('/admin/contests', { params: { page, per_page: 30, q } })
      .then(r => { setItems(r.data.contests); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [load]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await API.delete(`/admin/contests/${confirm.id}`);
      notify(`Contest "${confirm.name}" deleted`);
      setConfirm(null);
      load();
    } catch (err) {
      notify(err.response?.data?.error || 'Delete failed');
      setConfirm(null);
    }
  };

  return (
    <div id="contests">
      {toast && <Toast msg={toast} />}
      {confirm && (
        <ConfirmDialog
          message={`Permanently delete contest "${confirm.name}"? This removes all problems, submissions, and participant data.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={T.sectionTitle}>Contests ({total})</h2>
        <SearchBar value={q} onChange={v => { setQ(v); setPage(1); }} placeholder="Search by title…" />
      </div>

      {loading ? <Loader /> : (
        <div style={T.tableWrap}>
          <table style={T.table}>
            <thead>
              <tr>
                {['Title','Status','Difficulty','Problems','Participants','Creator','Start','Access','Actions'].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={9} style={{ ...T.td, textAlign: 'center', color: C.muted, padding: 32 }}>No contests found</td></tr>
              )}
              {items.map(c => (
                <tr key={c._id} style={T.tr}>
                  <td style={{ ...T.td, fontWeight: 700, color: C.text, maxWidth: 200 }}>
                    <Link to={`/contest-dashboard/${c._id}`} style={{ color: C.text, textDecoration: 'none' }}>
                      {c.title}
                    </Link>
                  </td>
                  <td style={T.td}>
                    <Badge color={STATUS_C[c.status] || C.muted}>{c.status}</Badge>
                  </td>
                  <td style={T.td}><Badge>{c.difficulty}</Badge></td>
                  <td style={{ ...T.td, color: C.muted }}>{c.problem_count}</td>
                  <td style={{ ...T.td, color: C.muted }}>{c.participant_count}</td>
                  <td style={{ ...T.td, color: C.muted }}>{c.created_by_name || '—'}</td>
                  <td style={{ ...T.td, color: C.muted, fontSize: 11 }}>
                    {c.start_time ? new Date(c.start_time).toLocaleString() : '—'}
                  </td>
                  <td style={T.td}><Badge>{c.access_type}</Badge></td>
                  <td style={T.td}>
                    <ActionBtn danger onClick={() => setConfirm({ id: c._id, name: c.title })}>Delete</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} perPage={30} onPage={setPage} />
    </div>
  );
}

// ─── Submissions Tab ──────────────────────────────────────────────────────────
function SubmissionsTab() {
  const [items, setItems]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [verdict, setVerdict] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState('');
  const [confirm, setConfirm] = useState(null);

  const VERDICTS = ['', 'Accepted', 'Partial', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Time Limit Exceeded'];

  const load = useCallback(() => {
    setLoading(true);
    API.get('/admin/submissions', { params: { page, per_page: 50, verdict } })
      .then(r => { setItems(r.data.submissions); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, verdict]);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await API.delete(`/admin/submissions/${confirm.id}`);
      notify('Submission deleted');
      setConfirm(null);
      load();
    } catch {
      notify('Delete failed');
      setConfirm(null);
    }
  };

  return (
    <div id="submissions">
      {toast && <Toast msg={toast} />}
      {confirm && (
        <ConfirmDialog
          message="Permanently delete this submission?"
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={T.sectionTitle}>Submissions ({total})</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Filter verdict:</label>
          <select
            value={verdict}
            onChange={e => { setVerdict(e.target.value); setPage(1); }}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              color: C.text,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {VERDICTS.map(v => <option key={v} value={v}>{v || 'All verdicts'}</option>)}
          </select>
        </div>
      </div>

      {loading ? <Loader /> : (
        <div style={T.tableWrap}>
          <table style={T.table}>
            <thead>
              <tr>
                {['User','Problem','Language','Verdict','Score','Tests','Late','Submitted','Actions'].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={9} style={{ ...T.td, textAlign: 'center', color: C.muted, padding: 32 }}>No submissions found</td></tr>
              )}
              {items.map(s => (
                <tr key={s._id} style={T.tr}>
                  <td style={{ ...T.td, fontWeight: 700, color: C.text }}>{s.username}</td>
                  <td style={{ ...T.td, color: C.muted, maxWidth: 180 }}>{s.problem_title}</td>
                  <td style={T.td}><Badge>{(s.language || '').toUpperCase()}</Badge></td>
                  <td style={T.td}>
                    <Badge color={VERDICT_C[s.verdict] || C.muted}>{s.verdict}</Badge>
                  </td>
                  <td style={{ ...T.td, color: C.text }}>{s.score}</td>
                  <td style={{ ...T.td, color: C.muted }}>{s.test_cases_passed}/{s.test_cases_total}</td>
                  <td style={T.td}>
                    {s.is_late ? <Badge color={C.muted}>Practice</Badge> : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...T.td, color: C.muted, fontSize: 11 }}>
                    {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}
                  </td>
                  <td style={T.td}>
                    <ActionBtn danger onClick={() => setConfirm({ id: s._id })}>Delete</ActionBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} perPage={50} onPage={setPage} />
    </div>
  );
}

// ─── Settings / Promote Tab ───────────────────────────────────────────────────
function SettingsTab() {
  const [email, setEmail]   = useState('');
  const [msg, setMsg]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const promote = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (!email.trim()) return setError('Email is required');
    setLoading(true);
    try {
      const res = await API.post('/admin/promote', { email: email.trim() });
      setMsg(res.data.message);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={T.sectionTitle}>Settings & Admin Management</h2>

      <div style={{ maxWidth: 480 }}>
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
            👑 Promote User to Admin
          </h3>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
            Enter the email address of a registered user to grant them admin privileges.
          </p>

          {msg   && <div style={T.successBox}>{msg}</div>}
          {error && <div style={T.errorBox}>{error}</div>}

          <form onSubmit={promote} style={{ display: 'flex', gap: 10 }}>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: C.text,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: C.accent,
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '…' : 'Promote'}
            </button>
          </form>
        </div>

        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: '24px 28px',
        }}>
          <h3 style={{ color: C.text, fontSize: 15, fontWeight: 800, margin: '0 0 12px' }}>
            ℹ️ Admin Role Notes
          </h3>
          <ul style={{ color: C.muted, fontSize: 13, lineHeight: 2, paddingLeft: 18, margin: 0 }}>
            <li>Admins can view all contests, users, and submissions.</li>
            <li>Admins can delete any contest, user, or submission.</li>
            <li>Admins can promote or demote other users.</li>
            <li>An admin cannot demote or delete their own account from this panel.</li>
            <li>The first admin must be set directly in MongoDB (set <code style={{ background: '#1a1f35', padding: '1px 5px', borderRadius: 4, color: '#f59e0b' }}>role: "admin"</code>).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      Loading…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 28,
      zIndex: 9999,
      background: '#1a2a1a',
      border: `1px solid ${C.green}`,
      color: '#86efac',
      borderRadius: 10,
      padding: '12px 20px',
      fontSize: 13,
      fontWeight: 700,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      ✓ {msg}
    </div>
  );
}

// ─── Table styles ─────────────────────────────────────────────────────────────
const T = {
  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: C.text,
    margin: '0 0 6px',
    fontFamily: 'Georgia,serif',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    fontFamily: '"DM Sans","Segoe UI",sans-serif',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '11px 14px',
    color: C.muted,
    borderBottom: `1px solid rgba(255,255,255,0.04)`,
    verticalAlign: 'middle',
  },
  tr: {
    transition: 'background 0.1s',
  },
  infoBox: {
    background: C.accentL,
    border: `1px solid rgba(212,82,26,0.25)`,
    borderRadius: 12,
    padding: '18px 22px',
  },
  quickLink: {
    color: C.accent,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    background: 'rgba(212,82,26,0.1)',
    padding: '6px 14px',
    borderRadius: 8,
    border: `1px solid rgba(212,82,26,0.25)`,
  },
  successBox: {
    background: 'rgba(22,163,74,0.12)',
    border: '1px solid rgba(22,163,74,0.3)',
    color: '#86efac',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
  errorBox: {
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.3)',
    color: '#FCA5A5',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 16,
  },
};

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',     label: '📊 Overview'    },
  { id: 'users',        label: '👥 Users'        },
  { id: 'contests',     label: '🏆 Contests'     },
  { id: 'submissions',  label: '📝 Submissions'  },
  { id: 'settings',     label: '⚙️ Settings'     },
];

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '"DM Sans","Segoe UI",sans-serif', color: C.text }}>
      {/* Top nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,15,30,0.95)',
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', padding: '0 28px', height: 58, gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <span style={{ fontSize: 17, fontWeight: 900, color: C.accent, fontFamily: 'Georgia,serif', letterSpacing: 2 }}>
              CONFEST
            </span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: C.accent,
              background: C.accentL, border: `1px solid rgba(212,82,26,0.3)`,
              borderRadius: 4, padding: '2px 7px',
            }}>ADMIN</span>
          </div>

          {/* Tab nav */}
          <div style={{ display: 'flex', gap: 4, flex: 1, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: tab === t.id ? 800 : 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: tab === t.id ? C.accentL : 'transparent',
                  color: tab === t.id ? C.accent : C.muted,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  borderBottom: tab === t.id ? `2px solid ${C.accent}` : '2px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              👑 <span style={{ fontWeight: 700, color: C.text }}>{user?.username}</span>
            </span>
            <Link to="/dashboard" style={{ fontSize: 12, color: C.muted, textDecoration: 'none', fontWeight: 600 }}>
              ← User site
            </Link>
            <button onClick={handleLogout} style={{
              padding: '6px 14px',
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 28px 80px' }}>
        {tab === 'overview'    && <OverviewTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'contests'    && <ContestsTab />}
        {tab === 'submissions' && <SubmissionsTab />}
        {tab === 'settings'    && <SettingsTab />}
      </main>
    </div>
  );
}
