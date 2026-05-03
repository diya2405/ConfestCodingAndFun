import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
 
// ─── Navbar ──────────────────────────────────────────────────────────────────
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
          <Link to="/profile" style={nav.avatar}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Link>
          <button onClick={onLogout} style={nav.logoutBtn}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
 
const nav = {
  bar: {
    position: 'sticky', top: 0, zIndex: 100,
    background: '#fff', borderBottom: '1.5px solid #E8E4DC',
    fontFamily: '"DM Sans", "Segoe UI", sans-serif',
  },
  inner: {
    maxWidth: 1200, margin: '0 auto',
    display: 'flex', alignItems: 'center',
    padding: '0 32px', height: 64, gap: 40,
  },
  logo: {
    fontSize: 20, fontWeight: 900, color: '#D4521A',
    textDecoration: 'none', letterSpacing: 2,
    fontFamily: 'Georgia, serif',
  },
  links: { display: 'flex', gap: 32, flex: 1 },
  link: {
    fontSize: 15, fontWeight: 600, color: '#444',
    textDecoration: 'none',
  },
  right: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: '#D4521A', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800, textDecoration: 'none',
  },
  logoutBtn: {
    padding: '8px 18px', borderRadius: 8,
    border: '1.5px solid #DDD', background: 'transparent',
    fontSize: 14, fontWeight: 600, color: '#666',
    cursor: 'pointer',
  },
};
 
// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...card.stat, borderTop: `4px solid ${accent}` }}>
      <div style={card.statVal}>{value}</div>
      <div style={card.statLabel}>{label}</div>
      {sub && <div style={card.statSub}>{sub}</div>}
    </div>
  );
}
 
const card = {
  stat: {
    background: '#fff', borderRadius: 14,
    border: '1.5px solid #E8E4DC',
    padding: '28px 24px', flex: 1,
  },
  statVal: { fontSize: 28, fontWeight: 800, color: '#1A1A1A', lineHeight: 1 },
  statLabel: { fontSize: 13, fontWeight: 600, color: '#888', marginTop: 6 },
  statSub: { fontSize: 12, color: '#AAA', marginTop: 3 },
};
 
// ─── Contest Card ─────────────────────────────────────────────────────────────
function ContestCard({ contest, onJoin }) {
  const diff = { Easy: '#16a34a', Medium: '#d97706', Hard: '#dc2626' };
  const statusColor = { live: '#16a34a', upcoming: '#D4521A', completed: '#888' };
  const status = contest.status || 'upcoming';
 
  const formatTime = (dt) => {
    if (!dt) return 'TBA';
    return new Date(dt).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };
 
  return (
    <div style={cc.card}>
      <div style={cc.top}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...cc.badge, background: statusColor[status] + '18', color: statusColor[status] }}>
            {status === 'live' ? '● LIVE' : status.toUpperCase()}
          </span>
          <span style={{ ...cc.badge, background: diff[contest.difficulty] + '18', color: diff[contest.difficulty] }}>
            {contest.difficulty || 'Medium'}
          </span>
        </div>
        <span style={cc.pts}>{contest.duration_mins || 90} min</span>
      </div>
      <h3 style={cc.title}>{contest.title}</h3>
      <p style={cc.desc}>{contest.description?.slice(0, 80) || 'Solve coding problems and climb the leaderboard.'}...</p>
      <div style={cc.meta}>
        <span style={cc.metaItem}>🗓 {formatTime(contest.start_time)}</span>
        <span style={cc.metaItem}>👤 {contest.max_participants || 100} spots</span>
      </div>
      {contest.tags?.length > 0 && (
        <div style={cc.tags}>
          {contest.tags.slice(0, 3).map(t => (
            <span key={t} style={cc.tag}>{t}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => onJoin(contest._id)}
        style={{ ...cc.btn, opacity: status === 'completed' ? 0.4 : 1 }}
        disabled={status === 'completed'}
      >
        {status === 'live' ? 'Join Now →' : status === 'upcoming' ? 'Register' : 'View Results'}
      </button>
    </div>
  );
}
 
const cc = {
  card: {
    background: '#fff', borderRadius: 14,
    border: '1.5px solid #E8E4DC', padding: '24px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 },
  pts: { fontSize: 13, color: '#888', fontWeight: 600 },
  title: { fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  desc: { fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 },
  meta: { display: 'flex', gap: 16 },
  metaItem: { fontSize: 13, color: '#888' },
  tags: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: { fontSize: 12, background: '#F3F0EA', color: '#666', padding: '3px 10px', borderRadius: 20 },
  btn: {
    marginTop: 4, padding: '11px 0', background: '#D4521A', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', width: '100%',
  },
};
 
// ─── Activity Row ─────────────────────────────────────────────────────────────
function ActivityRow({ item }) {
  const verdictColor = { Accepted: '#16a34a', 'Wrong Answer': '#dc2626', 'Time Limit': '#d97706' };
  const verdict = item.verdict || 'Accepted';
  return (
    <div style={act.row}>
      <div style={act.left}>
        <div style={act.name}>{item.problem_title || 'Problem ' + (item.problem_id || '')}</div>
        <div style={act.lang}>{item.language || 'Python'}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={act.score}>+{item.score || 0} pts</span>
        <span style={{ ...act.verdict, color: verdictColor[verdict] || '#888', background: (verdictColor[verdict] || '#888') + '18' }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}
 
const act = {
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 0', borderBottom: '1px solid #F0EDE6',
  },
  left: { display: 'flex', flexDirection: 'column', gap: 3 },
  name: { fontSize: 14, fontWeight: 600, color: '#1A1A1A' },
  lang: { fontSize: 11, color: '#AAA' },
  score: { fontSize: 13, fontWeight: 700, color: '#D4521A' },
  verdict: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 },
};
 
// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
 
  const [stats, setStats] = useState(null);
  const [contests, setContests] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
 
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, contestsRes, subRes] = await Promise.all([
          API.get('/auth/me'),
          API.get('/contests'),
          API.get('/submissions/recent'),
        ]);
        setStats(statsRes.data);
        setContests(contestsRes.data?.contests || []);
        setSubmissions(subRes.data?.submissions || []);
      } catch (err) {
        // Use user data from context as fallback
        setStats(user);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);
 
  const handleLogout = () => { logout(); navigate('/login'); };
  const handleJoin = (contestId) => navigate(`/contest/${contestId}`);
 
  const filteredContests = contests.filter(c =>
    activeTab === 'all' ? true : c.status === activeTab
  );
 
  // Fallback mock data for viva demo
  const mockContests = [
    { _id: '1', title: 'Weekly Coding Challenge #12', difficulty: 'Medium', status: 'live', duration_mins: 90, description: 'Solve algorithmic problems and climb the ranks in real time', tags: ['Arrays', 'DP', 'Graphs'], start_time: new Date(), max_participants: 150 },
    { _id: '2', title: 'CHARUSAT Intramural Contest', difficulty: 'Hard', status: 'upcoming', duration_mins: 120, description: 'Internal university-level competitive programming contest', tags: ['Trees', 'Graphs', 'Math'], start_time: new Date(Date.now() + 86400000), max_participants: 80 },
    { _id: '3', title: 'Beginner Blitz Round', difficulty: 'Easy', status: 'upcoming', duration_mins: 60, description: 'Perfect for beginners — build confidence with simpler problems', tags: ['Strings', 'Arrays'], start_time: new Date(Date.now() + 172800000), max_participants: 200 },
  ];
 
  const displayContests = contests.length > 0 ? filteredContests : mockContests;
 
  const mockSubs = [
    { problem_title: 'Two Sum', language: 'Python', score: 100, verdict: 'Accepted' },
    { problem_title: 'Longest Substring', language: 'C++', score: 0, verdict: 'Wrong Answer' },
    { problem_title: 'Binary Search Tree', language: 'Java', score: 80, verdict: 'Accepted' },
  ];
  const displaySubs = submissions.length > 0 ? submissions : mockSubs;
 
  const displayStats = stats || user || {};
 
  return (
    <div style={pg.root}>
      <Navbar user={displayStats} onLogout={handleLogout} />
 
      <main style={pg.main}>
        {/* Welcome Header */}
        <div style={pg.hero}>
          <div>
            <div style={pg.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋</div>
            <h1 style={pg.heroTitle}>{displayStats.username || 'Coder'}</h1>
            <div style={pg.heroBadge}>{displayStats.institution || 'CHARUSAT University'} · {displayStats.experience_level || 'Intermediate'}</div>
          </div>
          <div style={pg.heroRight}>
            <div style={pg.rankBig}>
              <div style={pg.rankNum}>#{displayStats.rank || '—'}</div>
              <div style={pg.rankLabel}>Global Rank</div>
            </div>
          </div>
        </div>
 
        {/* Stats Row */}
        <div style={pg.statsRow}>
          <StatCard label="Total Score" value={displayStats.score || 0} sub="All time" accent="#D4521A" />
          <StatCard label="Problems Solved" value={displayStats.problems_solved || 0} sub="Keep going!" accent="#16a34a" />
          <StatCard label="Contests Entered" value={displayStats.contests_entered || 0} sub="This semester" accent="#7c3aed" />
          <StatCard label="Streak" value={`${displayStats.streak || 0}d`} sub="Current streak" accent="#d97706" />
        </div>
 
        {/* Two column layout */}
        <div style={pg.grid}>
          {/* Left — Contests */}
          <div style={pg.col}>
            <div style={pg.sectionHead}>
              <h2 style={pg.sectionTitle}>Contests</h2>
              <div style={pg.tabs}>
                {['all', 'live', 'upcoming', 'completed'].map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{ ...pg.tab, ...(activeTab === t ? pg.tabActive : {}) }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {displayContests.map(c => (
                <ContestCard key={c._id} contest={c} onJoin={handleJoin} />
              ))}
              {displayContests.length === 0 && (
                <div style={pg.empty}>No contests in this category right now.</div>
              )}
            </div>
          </div>
 
          {/* Right — Activity + Interests */}
          <div style={pg.col}>
            <div style={pg.sectionHead}>
              <h2 style={pg.sectionTitle}>Recent Submissions</h2>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #E8E4DC', padding: '8px 24px' }}>
              {displaySubs.slice(0, 6).map((s, i) => (
                <ActivityRow key={i} item={s} />
              ))}
              {displaySubs.length === 0 && (
                <div style={{ ...pg.empty, padding: '32px 0' }}>No submissions yet. Join a contest!</div>
              )}
            </div>
 
            {/* Interests */}
            <div style={{ marginTop: 24 }}>
              <h2 style={pg.sectionTitle}>Your Interests</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {(displayStats.interests || ['Arrays & Strings', 'Dynamic Programming', 'Graphs']).map(i => (
                  <span key={i} style={pg.interestTag}>{i}</span>
                ))}
              </div>
            </div>
 
            {/* Quick links */}
            <div style={{ marginTop: 24 }}>
              <h2 style={pg.sectionTitle}>Quick Actions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {[
                  { label: 'View Full Leaderboard', path: '/leaderboard', icon: '🏆' },
                  { label: 'Browse All Contests', path: '/contests', icon: '⚡' },
                  { label: 'Edit Your Profile', path: '/profile', icon: '👤' },
                ].map(q => (
                  <Link key={q.path} to={q.path} style={pg.quickLink}>
                    <span>{q.icon} {q.label}</span>
                    <span style={{ color: '#D4521A' }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
 
const pg = {
  root: { minHeight: '100vh', background: '#FAF8F4', fontFamily: '"DM Sans", "Segoe UI", sans-serif' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '40px 32px' },
  hero: {
    background: '#fff', borderRadius: 18, border: '1.5px solid #E8E4DC',
    padding: '36px 40px', marginBottom: 32,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: { fontSize: 13, color: '#888', fontWeight: 500, marginBottom: 4 },
  heroTitle: { fontSize: 28, fontWeight: 800, color: '#1A1A1A', margin: '0 0 8px', fontFamily: 'Georgia, serif' },
  heroBadge: { fontSize: 13, color: '#D4521A', fontWeight: 600, background: '#FEF1EB', padding: '5px 12px', borderRadius: 20, display: 'inline-block' },
  heroRight: { textAlign: 'center' },
  rankBig: { background: '#FEF1EB', borderRadius: 14, padding: '18px 32px' },
  rankNum: { fontSize: 32, fontWeight: 800, color: '#D4521A', lineHeight: 1 },
  rankLabel: { fontSize: 12, fontWeight: 600, color: '#D4521A', marginTop: 5 },
  statsRow: { display: 'flex', gap: 16, marginBottom: 32 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 400px', gap: 32 },
  col: { display: 'flex', flexDirection: 'column', gap: 0 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 },
  tabs: { display: 'flex', gap: 6 },
  tab: {
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: '1.5px solid #E8E4DC', background: 'transparent', color: '#888', cursor: 'pointer',
  },
  tabActive: { background: '#D4521A', color: '#fff', border: '1.5px solid #D4521A' },
  empty: { textAlign: 'center', color: '#AAA', padding: '48px 0', fontSize: 15 },
  interestTag: {
    fontSize: 14, fontWeight: 600, padding: '7px 16px', borderRadius: 20,
    background: '#F3F0EA', color: '#555',
  },
  quickLink: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', borderRadius: 10, border: '1.5px solid #E8E4DC',
    padding: '14px 18px', textDecoration: 'none', fontSize: 15, fontWeight: 600, color: '#333',
  },
};