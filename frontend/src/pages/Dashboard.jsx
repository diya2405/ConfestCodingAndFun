// frontend/src/pages/Dashboard.jsx
// FIX: independent API calls (not Promise.all — one failure kills all)
// FIX: handleJoin navigates to /arena/:id not /contest/:id
// FIX: contests tab filter uses computeStatus not raw .status
// FIX: all data is dynamic from API with proper fallbacks
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { computeStatus, getContests } from '../localStore';

// ── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  return (
    <nav style={{ position:'sticky',top:0,zIndex:100,background:'#fff',borderBottom:'1.5px solid #E8E4DC',fontFamily:'"DM Sans","Segoe UI",sans-serif' }}>
      <div style={{ maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',padding:'0 32px',height:64,gap:40 }}>
        <Link to="/dashboard" style={{ fontSize:20,fontWeight:900,color:'#D4521A',textDecoration:'none',letterSpacing:2,fontFamily:'Georgia,serif' }}>CONFEST</Link>
        <div style={{ display:'flex',gap:32,flex:1 }}>
          <Link to="/dashboard"  style={{ fontSize:14,fontWeight:700,color:'#D4521A',textDecoration:'none',borderBottom:'2px solid #D4521A',paddingBottom:2 }}>Dashboard</Link>
          <Link to="/contests"   style={{ fontSize:14,fontWeight:600,color:'#444',textDecoration:'none' }}>Contests</Link>
          <Link to="/leaderboard" style={{ fontSize:14,fontWeight:600,color:'#444',textDecoration:'none' }}>Leaderboard</Link>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:16 }}>
          <Link to="/profile" style={{ width:36,height:36,borderRadius:'50%',background:'#D4521A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:800,textDecoration:'none' }}>
            {user?.username?.[0]?.toUpperCase()||'U'}
          </Link>
          <button onClick={onLogout} style={{ padding:'7px 16px',borderRadius:8,border:'1.5px solid #DDD',background:'transparent',fontSize:13,fontWeight:600,color:'#666',cursor:'pointer' }}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:'#fff',borderRadius:14,border:'1.5px solid #E8E4DC',padding:'22px 24px',flex:1,borderTop:`4px solid ${accent}` }}>
      <div style={{ fontSize:26,fontWeight:800,color:'#1A1A1A',lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:13,fontWeight:600,color:'#888',marginTop:6 }}>{label}</div>
      {sub && <div style={{ fontSize:11,color:'#AAA',marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ── Contest mini-card on dashboard ───────────────────────────────────────────
const DIFF_C = { Easy:'#16a34a',Medium:'#d97706',Hard:'#dc2626' };
const STAT_C = { live:'#15803d',upcoming:'#D4521A',completed:'#888' };

function MiniContestCard({ contest, onAction }) {
  const status = computeStatus(contest);
  const reg    = contest.registered === true;

  let cta = 'Register';
  let ctaBg = '#D4521A';
  if (status==='completed')         { cta='View Results';    ctaBg='#888'; }
  else if (reg && status==='live')  { cta='Enter Arena ⚡'; ctaBg='#16a34a'; }
  else if (reg)                     { cta='View Lobby 🕐';   ctaBg='#0369a1'; }

  return (
    <div style={{ background:'#fff',borderRadius:12,border:status==='live'?'1.5px solid #86efac':'1.5px solid #E8E4DC',padding:'18px 20px',boxShadow:status==='live'?'0 0 0 3px #dcfce7':'none' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,gap:8,flexWrap:'wrap' }}>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:STAT_C[status]+'18',color:STAT_C[status] }}>
            {status==='live'?'● LIVE':status.toUpperCase()}
          </span>
          <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:DIFF_C[contest.difficulty]+'18',color:DIFF_C[contest.difficulty] }}>
            {contest.difficulty}
          </span>
          {reg && <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#dcfce7',color:'#15803d' }}>✓ Registered</span>}
        </div>
        <span style={{ fontSize:11,color:'#AAA' }}>{contest.duration_mins} min</span>
      </div>
      <div style={{ fontSize:14,fontWeight:700,color:'#1A1A1A',marginBottom:5 }}>{contest.title}</div>
      <div style={{ fontSize:12,color:'#666',marginBottom:10,lineHeight:1.4 }}>{(contest.description||'').slice(0,70)}{(contest.description||'').length>70?'…':''}</div>
      <div style={{ display:'flex',gap:12,marginBottom:12,flexWrap:'wrap' }}>
        <span style={{ fontSize:12,color:'#888' }}>🗓 {new Date(contest.start_time).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
        <span style={{ fontSize:12,color:'#888' }}>👥 {contest.participant_count??contest.registered_users?.length??0}/{contest.max_participants}</span>
        {contest.prize && <span style={{ fontSize:12,color:'#D4521A',fontWeight:600 }}>🏅 {contest.prize}</span>}
      </div>
      <button
        onClick={() => onAction(contest)}
        disabled={status==='completed'}
        style={{ width:'100%',padding:'9px',borderRadius:8,border:'none',background:ctaBg,color:'#fff',fontSize:13,fontWeight:700,cursor:status==='completed'?'not-allowed':'pointer',fontFamily:'inherit',opacity:status==='completed'?0.5:1 }}
      >
        {cta}
      </button>
    </div>
  );
}

// ── Submission row ────────────────────────────────────────────────────────────
function SubRow({ item }) {
  const VC = { Accepted:'#16a34a','Wrong Answer':'#dc2626',Partial:'#d97706','Time Limit Exceeded':'#d97706','Runtime Error':'#dc2626','Compilation Error':'#7c3aed' };
  const v = item.verdict || 'Pending';
  return (
    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:'1px solid #F0EDE6' }}>
      <div>
        <div style={{ fontSize:14,fontWeight:600,color:'#1A1A1A' }}>{item.problem_title||'Problem'}</div>
        <div style={{ fontSize:11,color:'#AAA',marginTop:2 }}>{(item.language||'').toUpperCase()} · {item.contest_title||''}</div>
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
        {item.score>0 && <span style={{ fontSize:12,fontWeight:700,color:'#D4521A' }}>+{item.score}</span>}
        <span style={{ fontSize:12,fontWeight:700,padding:'3px 10px',borderRadius:20,color:VC[v]||'#888',background:(VC[v]||'#888')+'18' }}>{v}</span>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats,       setStats]       = useState(null);
  const [contests,    setContests]    = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [contestTab,  setContestTab]  = useState('all');
  const [statsLoading, setStatsLoading] = useState(true);

  const userId = user?.id || user?._id || '';

  // FIX: independent fetches — one failure doesn't kill everything
  useEffect(() => {
    // 1. User stats
    API.get('/auth/me')
      .then(r => setStats(r.data))
      .catch(() => setStats(user))
      .finally(() => setStatsLoading(false));

    // 2. Contests — independent
    API.get('/contests/')
      .then(r => {
        if (r.data?.contests?.length >= 0) setContests(r.data.contests);
        else setContests(getContests());
      })
      .catch(() => setContests(getContests()));

    // 3. Submissions — independent
    API.get('/submissions/recent')
      .then(r => setSubmissions(r.data?.submissions || []))
      .catch(() => setSubmissions([]));
  }, [userId]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // FIX: use computeStatus not raw .status for filter
  const filtered = contests.filter(c =>
    contestTab === 'all' || computeStatus(c) === contestTab
  );

  // FIX: correct route is /arena/:id, not /contest/:id
  const handleContestAction = (contest) => {
    const status = computeStatus(contest);
    const isCreator = String(contest.created_by) === String(userId) || contest.created_by_name === user?.username;
    if (isCreator)                navigate(`/contest-dashboard/${contest._id}`);
    else if (status !== 'completed') navigate(`/arena/${contest._id}`);
  };

  const displayStats = stats || user || {};
  const counts = {
    all:       contests.length,
    live:      contests.filter(c => computeStatus(c) === 'live').length,
    upcoming:  contests.filter(c => computeStatus(c) === 'upcoming').length,
    completed: contests.filter(c => computeStatus(c) === 'completed').length,
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ minHeight:'100vh',background:'#FAF8F4',fontFamily:'"DM Sans","Segoe UI",sans-serif' }}>
      <Navbar user={displayStats} onLogout={handleLogout} />
      <main style={{ maxWidth:1200,margin:'0 auto',padding:'36px 32px 60px' }}>

        {/* Hero */}
        <div style={{ background:'#fff',borderRadius:18,border:'1.5px solid #E8E4DC',padding:'28px 36px',marginBottom:28,display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:13,color:'#888',fontWeight:500,marginBottom:4 }}>{greeting} 👋</div>
            <h1 style={{ fontSize:26,fontWeight:900,color:'#1A1A1A',margin:'0 0 8px',fontFamily:'Georgia,serif' }}>
              {statsLoading ? '...' : displayStats.username || 'Coder'}
            </h1>
            <div style={{ fontSize:13,color:'#D4521A',fontWeight:600,background:'#FEF1EB',padding:'5px 12px',borderRadius:20,display:'inline-block' }}>
              {displayStats.institution || 'No institution set'} · {displayStats.experience_level || 'Beginner'}
            </div>
          </div>
          <div style={{ textAlign:'center',background:'#FEF1EB',borderRadius:14,padding:'16px 30px' }}>
            <div style={{ fontSize:30,fontWeight:900,color:'#D4521A',lineHeight:1 }}>
              {displayStats.rank ? `#${displayStats.rank}` : '—'}
            </div>
            <div style={{ fontSize:12,fontWeight:600,color:'#D4521A',marginTop:5 }}>Global Rank</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'flex',gap:14,marginBottom:28,flexWrap:'wrap' }}>
          <StatCard label="Total Score"     value={displayStats.score||0}            sub="All time"      accent="#D4521A" />
          <StatCard label="Problems Solved" value={displayStats.problems_solved||0}  sub="Keep going!"  accent="#16a34a" />
          <StatCard label="Contests Joined" value={displayStats.contests_entered||0} sub="This semester" accent="#7c3aed" />
          <StatCard label="Streak"          value={`${displayStats.streak||0}d`}     sub="Days active"  accent="#d97706" />
        </div>

        {/* Two-column grid */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 380px',gap:28 }}>

          {/* LEFT — Contests */}
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
              <h2 style={{ fontSize:16,fontWeight:700,color:'#1A1A1A',margin:0 }}>Contests</h2>
              <div style={{ display:'flex',gap:4 }}>
                {['all','live','upcoming','completed'].map(t => (
                  <button key={t} onClick={()=>setContestTab(t)} style={{
                    padding:'5px 12px',borderRadius:20,fontSize:12,fontWeight:700,border:'1.5px solid',cursor:'pointer',fontFamily:'inherit',
                    borderColor:contestTab===t?'#D4521A':'#E8E4DC',
                    background:contestTab===t?'#D4521A':'transparent',
                    color:contestTab===t?'#fff':'#888',
                  }}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}{counts[t]>0?` (${counts[t]})`:''}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ background:'#fff',borderRadius:12,border:'1.5px solid #E8E4DC',padding:'48px',textAlign:'center',color:'#AAA',fontSize:14 }}>
                No contests in this category.{' '}
                <Link to="/contests" style={{ color:'#D4521A',fontWeight:700,textDecoration:'none' }}>Browse all →</Link>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                {filtered.slice(0,5).map(c => (
                  <MiniContestCard key={c._id} contest={c} onAction={handleContestAction} />
                ))}
                {filtered.length > 5 && (
                  <Link to="/contests" style={{ textAlign:'center',padding:'12px',background:'#fff',borderRadius:10,border:'1.5px solid #E8E4DC',color:'#D4521A',fontWeight:700,fontSize:13,textDecoration:'none' }}>
                    View all {filtered.length} contests →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Submissions + Interests + Actions */}
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            {/* Recent submissions */}
            <div>
              <h2 style={{ fontSize:16,fontWeight:700,color:'#1A1A1A',margin:'0 0 12px' }}>Recent Submissions</h2>
              <div style={{ background:'#fff',borderRadius:12,border:'1.5px solid #E8E4DC',padding:'4px 20px' }}>
                {submissions.length === 0 ? (
                  <div style={{ padding:'32px 0',textAlign:'center',color:'#AAA',fontSize:13 }}>No submissions yet. Join a contest!</div>
                ) : (
                  submissions.slice(0,6).map((s,i) => <SubRow key={s._id||i} item={s} />)
                )}
              </div>
            </div>

            {/* Interests */}
            <div>
              <h2 style={{ fontSize:15,fontWeight:700,color:'#1A1A1A',margin:'0 0 10px' }}>Your Interests</h2>
              <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                {(displayStats.interests||[]).length > 0
                  ? displayStats.interests.map(i => <span key={i} style={{ fontSize:13,fontWeight:600,padding:'6px 14px',borderRadius:20,background:'#F3F0EA',color:'#555' }}>{i}</span>)
                  : <span style={{ fontSize:13,color:'#AAA' }}>No interests set — <Link to="/profile" style={{ color:'#D4521A',fontWeight:700,textDecoration:'none' }}>add some in your profile</Link></span>
                }
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <h2 style={{ fontSize:15,fontWeight:700,color:'#1A1A1A',margin:'0 0 10px' }}>Quick Actions</h2>
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {[
                  { label:'Browse All Contests',    path:'/contests',     icon:'⚡' },
                  { label:'View Global Leaderboard', path:'/leaderboard', icon:'🏆' },
                  { label:'Edit Profile',            path:'/profile',     icon:'👤' },
                ].map(q => (
                  <Link key={q.path} to={q.path} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',background:'#fff',borderRadius:10,border:'1.5px solid #E8E4DC',padding:'13px 16px',textDecoration:'none',fontSize:14,fontWeight:600,color:'#333' }}>
                    <span>{q.icon} {q.label}</span>
                    <span style={{ color:'#D4521A' }}>→</span>
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