import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { getContest, getLeaderboard, computeStatus, getTimeLeft } from '../localStore';

const DIFF_C  = { Easy:'#16a34a', Medium:'#d97706', Hard:'#dc2626' };
const MEDAL   = ['🥇','🥈','🥉'];

function Navbar({ user, onLogout }) {
  return (
    <nav style={N.bar}>
      <div style={N.inner}>
        <Link to="/contests" style={N.logo}>CONFEST</Link>
        <div style={N.links}>
          <Link to="/dashboard" style={N.link}>Dashboard</Link>
          <Link to="/contests"  style={N.link}>Contests</Link>
        </div>
        <div style={N.right}>
          <Link to="/profile" style={N.avatar}>{user?.username?.[0]?.toUpperCase()||'U'}</Link>
          <button onClick={onLogout} style={N.out}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
const N = {
  bar:   { position:'sticky',top:0,zIndex:100,background:'#fff',borderBottom:'1.5px solid #E8E4DC',fontFamily:'"DM Sans","Segoe UI",sans-serif' },
  inner: { maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',padding:'0 32px',height:64,gap:40 },
  logo:  { fontSize:20,fontWeight:900,color:'#D4521A',textDecoration:'none',letterSpacing:2,fontFamily:'Georgia,serif' },
  links: { display:'flex',gap:32,flex:1 },
  link:  { fontSize:14,fontWeight:600,color:'#444',textDecoration:'none' },
  right: { display:'flex',alignItems:'center',gap:14 },
  avatar:{ width:34,height:34,borderRadius:'50%',background:'#D4521A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,textDecoration:'none' },
  out:   { padding:'7px 14px',borderRadius:8,border:'1.5px solid #DDD',background:'transparent',fontSize:13,fontWeight:600,color:'#666',cursor:'pointer' },
};

function LiveCountdown({ contest }) {
  const calc = () => {
    const start = new Date(contest.start_time).getTime();
    const end   = start + contest.duration_mins * 60000;
    const now   = Date.now();
    const status = now < start ? 'upcoming' : now <= end ? 'live' : 'completed';
    const target = status === 'upcoming' ? start : end;
    const diff   = Math.max(0, target - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { status, h, m, s, pct: status === 'live' ? Math.max(0,(end-now)/((end-start))*100) : 0 };
  };

  const [t, setT] = useState(calc());
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  const color = t.status === 'live' ? '#16a34a' : t.status === 'upcoming' ? '#D4521A' : '#888';
  const label = t.status === 'upcoming' ? 'Starts in' : t.status === 'live' ? 'Time remaining' : 'Contest ended';
  const time  = `${t.h > 0 ? t.h+'h ' : ''}${String(t.m).padStart(2,'0')}:${String(t.s).padStart(2,'0')}`;

  return (
    <div style={{ background:'#fff', border:'1.5px solid #E8E4DC', borderRadius:14, padding:'20px 24px' }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#AAA', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:36, fontWeight:900, color, fontFamily:'monospace', marginBottom: t.status==='live'?12:0 }}>
        {t.status === 'completed' ? '—' : time}
      </div>
      {t.status === 'live' && (
        <div style={{ height:6, background:'#F0EDE6', borderRadius:3 }}>
          <div style={{ height:'100%', width:`${t.pct}%`, background: t.pct < 20 ? '#dc2626' : color, borderRadius:3, transition:'width 1s linear' }} />
        </div>
      )}
    </div>
  );
}

export default function ContestDashboard() {
  const { contestId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [contest,      setContest]      = useState(null);
  const [leaderboard,  setLeaderboard]  = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('participants');
  const [tick,         setTick]         = useState(0);
  const [copyMsg,      setCopyMsg]      = useState('');

  const userId = user?.id || user?._id || '';

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Contest details
      const cr = await API.get(`/contests/${contestId}`).catch(() => null);
      if (cr?.data) {
        setContest(cr.data);
      } else {
        const local = getContest(contestId);
        setContest(local);
      }

      // Leaderboard
      const lr = await API.get(`/contests/${contestId}/leaderboard`).catch(() => null);
      if (lr?.data?.leaderboard) {
        setLeaderboard(lr.data.leaderboard);
      } else {
        setLeaderboard(getLeaderboard(contestId));
      }

      // Lobby/participants
      const pr = await API.get(`/contests/${contestId}/lobby`).catch(() => null);
      if (pr?.data?.participants) {
        setParticipants(pr.data.participants);
      }
    } catch {
      const local = getContest(contestId);
      setContest(local);
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => { fetchData(); }, [fetchData, tick]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const copyKey = () => {
    const key = contest?.access_key;
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  };

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAF8F4', fontFamily:'"DM Sans",sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#D4521A', fontFamily:'Georgia,serif', marginBottom:8 }}>CONFEST</div>
        <div style={{ fontSize:14, color:'#888' }}>Loading contest dashboard...</div>
      </div>
    </div>
  );

  if (!contest) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAF8F4', fontFamily:'"DM Sans",sans-serif' }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ color:'#888' }}>Contest not found.</p>
        <Link to="/contests" style={{ color:'#D4521A', fontWeight:700 }}>Back to Contests</Link>
      </div>
    </div>
  );

  const status   = computeStatus(contest);
  const isCreator = String(contest.created_by) === String(userId) || contest.created_by_name === user?.username;

  const STATUS_LABEL = { live:'● LIVE', upcoming:'UPCOMING', completed:'ENDED' };
  const STATUS_COLOR = { live:'#16a34a', upcoming:'#D4521A', completed:'#888' };

  return (
    <div style={{ minHeight:'100vh', background:'#FAF8F4', fontFamily:'"DM Sans","Segoe UI",sans-serif' }}>
      <Navbar user={user} onLogout={handleLogout} />

      <main style={{ maxWidth:1100, margin:'0 auto', padding:'36px 32px 60px' }}>

        {/* Breadcrumb */}
        <div style={{ fontSize:13, color:'#AAA', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          <Link to="/contests" style={{ color:'#D4521A', textDecoration:'none', fontWeight:600 }}>Contests</Link>
          <span>/</span>
          <span style={{ color:'#666' }}>{contest.title}</span>
        </div>

        {/* Header */}
        <div style={{ background:'#fff', border:'1.5px solid #E8E4DC', borderRadius:16, padding:'28px 32px', marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20, background: STATUS_COLOR[status]+'18', color: STATUS_COLOR[status] }}>
                  {STATUS_LABEL[status]}
                </span>
                <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20, background: DIFF_C[contest.difficulty]+'18', color: DIFF_C[contest.difficulty] }}>
                  {contest.difficulty}
                </span>
                {contest.access_type === 'private' && (
                  <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20, background:'#EEE8FF', color:'#7c3aed' }}>🔑 Private</span>
                )}
                {isCreator && (
                  <span style={{ fontSize:12, fontWeight:700, padding:'4px 12px', borderRadius:20, background:'#FEF1EB', color:'#D4521A' }}>👑 You Created This</span>
                )}
              </div>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#1A1A1A', margin:'0 0 8px', fontFamily:'Georgia,serif' }}>{contest.title}</h1>
              <p style={{ fontSize:14, color:'#666', margin:'0 0 14px', lineHeight:1.6 }}>{contest.description}</p>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                <span style={{ fontSize:13, color:'#888' }}>⏱ {contest.duration_mins} min</span>
                <span style={{ fontSize:13, color:'#888' }}>👥 {participants.length || leaderboard.length}/{contest.max_participants} joined</span>
                <span style={{ fontSize:13, color:'#888' }}>📝 {(contest.problems||contest.problem_ids||[]).length} problems</span>
                <span style={{ fontSize:13, color:'#888' }}>🗓 {new Date(contest.start_time).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                {contest.prize && <span style={{ fontSize:13, color:'#D4521A', fontWeight:600 }}>🏅 {contest.prize}</span>}
              </div>
            </div>

            {/* Creator key + actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:200 }}>
              {isCreator && contest.access_key && (
                <div style={{ background:'#FEF1EB', border:'1.5px solid #FBBF9A', borderRadius:12, padding:'14px 18px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#D4521A', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                    🔑 Access Key (share with participants)
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:'#D4521A', letterSpacing:3, fontFamily:'monospace' }}>
                      {contest.access_key}
                    </span>
                    <button onClick={copyKey} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #D4521A', background:'transparent', color:'#D4521A', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {copyMsg || 'Copy'}
                    </button>
                  </div>
                </div>
              )}
              {!isCreator && (
                <div style={{ background:'#DCFCE7', border:'1px solid #86EFAC', borderRadius:12, padding:'12px 16px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#166534' }}>✓ You are registered</div>
                  <div style={{ fontSize:12, color:'#15803D', marginTop:3 }}>
                    {status === 'live' ? 'Contest is live — enter the arena!' : status === 'upcoming' ? 'Waiting for contest to start.' : 'Contest has ended.'}
                  </div>
                </div>
              )}
              {status === 'live' && !isCreator && (
                <Link to={`/arena/${contestId}`} style={{ padding:'12px 20px', background:'#D4521A', color:'#fff', borderRadius:10, textDecoration:'none', fontSize:14, fontWeight:800, textAlign:'center' }}>
                  ⚡ Enter Coding Arena →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20 }}>

          {/* LEFT — Timer + Stats */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <LiveCountdown contest={contest} />

            {/* Quick stats */}
            <div style={{ background:'#fff', border:'1.5px solid #E8E4DC', borderRadius:14, padding:'20px 24px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:14 }}>Contest Stats</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  { label:'Total Participants', val: participants.length || leaderboard.length },
                  { label:'Spots Remaining',    val: Math.max(0, contest.max_participants - (participants.length || leaderboard.length)) },
                  { label:'Problems',           val: (contest.problems || contest.problem_ids || []).length },
                  { label:'Duration',           val: `${contest.duration_mins} minutes` },
                  { label:'Created by',         val: contest.created_by_name || '—' },
                ].map(({ label, val }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:10, borderBottom:'1px solid #F5F2EC' }}>
                    <span style={{ fontSize:13, color:'#888' }}>{label}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#1A1A1A' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            {(contest.tags||[]).length > 0 && (
              <div style={{ background:'#fff', border:'1.5px solid #E8E4DC', borderRadius:14, padding:'18px 20px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1A1A1A', marginBottom:10 }}>Topics</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {contest.tags.map(t => <span key={t} style={{ fontSize:12, background:'#F3F0EA', color:'#555', padding:'4px 12px', borderRadius:20 }}>{t}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Participants + Leaderboard tabs */}
          <div style={{ background:'#fff', border:'1.5px solid #E8E4DC', borderRadius:14, overflow:'hidden' }}>
            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1.5px solid #E8E4DC' }}>
              {[
                ['participants', `👥 Participants (${participants.length || leaderboard.length})`],
                ['leaderboard',  `🏆 Leaderboard`],
              ].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding:'14px 24px', border:'none', background:'transparent', fontSize:14, fontWeight:700,
                  cursor:'pointer', fontFamily:'inherit',
                  color: tab===key ? '#D4521A' : '#888',
                  borderBottom: tab===key ? '2px solid #D4521A' : '2px solid transparent',
                }}>{label}</button>
              ))}
              <div style={{ flex:1, display:'flex', justifyContent:'flex-end', alignItems:'center', paddingRight:16 }}>
                <span style={{ fontSize:11, color:'#AAA' }}>Auto-refreshes every 10s</span>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#16a34a', display:'inline-block', marginLeft:6, animation:'pulse 1.5s infinite' }} />
              </div>
            </div>

            {/* PARTICIPANTS TAB */}
            {tab === 'participants' && (
              <div>
                {participants.length === 0 && leaderboard.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'60px', color:'#AAA', fontSize:14 }}>
                    {contest.access_type === 'private'
                      ? `Share the access key "${contest.access_key}" for participants to join.`
                      : 'No participants yet. Share the contest link!'}
                  </div>
                ) : (
                  <>
                    {/* Header row */}
                    <div style={{ display:'grid', gridTemplateColumns:'40px 1fr 160px 120px', gap:0, padding:'10px 20px', background:'#F9F7F4', fontSize:11, fontWeight:700, color:'#AAA', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      <span>#</span>
                      <span>Participant</span>
                      <span>Institution</span>
                      <span style={{ textAlign:'right' }}>Joined</span>
                    </div>
                    {/* Use leaderboard entries if participants not available */}
                    {(participants.length > 0 ? participants : leaderboard).map((p, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'40px 1fr 160px 120px',
                        padding:'14px 20px', borderTop:'1px solid #F5F2EC', alignItems:'center',
                        background: (p.username === user?.username) ? '#FEF9F7' : 'transparent',
                      }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'#888' }}>{i + 1}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'#D4521A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, flexShrink:0 }}>
                            {(p.username||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color: p.username===user?.username ? '#D4521A' : '#1A1A1A' }}>
                              {p.username}{p.username===user?.username ? ' (You)' : ''}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize:13, color:'#888' }}>{p.institution || '—'}</span>
                        <span style={{ fontSize:12, color:'#AAA', textAlign:'right' }}>
                          {p.joined_at ? new Date(p.joined_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—'}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* LEADERBOARD TAB */}
            {tab === 'leaderboard' && (
              <div>
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'60px', color:'#AAA', fontSize:14 }}>
                    No submissions yet. Leaderboard will populate once contest starts.
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 100px 100px 100px', padding:'10px 20px', background:'#F9F7F4', fontSize:11, fontWeight:700, color:'#AAA', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      <span>Rank</span>
                      <span>Participant</span>
                      <span style={{ textAlign:'center' }}>Solved</span>
                      <span style={{ textAlign:'right' }}>Score</span>
                      <span style={{ textAlign:'right' }}>Last Sub</span>
                    </div>
                    {leaderboard.map((p, i) => (
                      <div key={i} style={{
                        display:'grid', gridTemplateColumns:'60px 1fr 100px 100px 100px',
                        padding:'14px 20px', borderTop:'1px solid #F5F2EC', alignItems:'center',
                        background: p.username===user?.username ? '#FEF1EB' : 'transparent',
                      }}>
                        <div style={{ fontSize: i<3?22:15, fontWeight:800, color: i<3?'':p.username===user?.username?'#D4521A':'#888' }}>
                          {i < 3 ? MEDAL[i] : `#${i+1}`}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background: p.username===user?.username ? '#D4521A' : '#F3F0EA', color: p.username===user?.username ? '#fff':'#555', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800 }}>
                            {(p.username||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color: p.username===user?.username?'#D4521A':'#1A1A1A' }}>
                              {p.username}{p.username===user?.username?' (You)':''}
                            </div>
                            <div style={{ fontSize:11, color:'#AAA' }}>{p.institution||'—'}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:'center', fontSize:14, fontWeight:700, color:'#1A1A1A' }}>
                          {p.problems_solved || 0}
                        </div>
                        <div style={{ textAlign:'right', fontSize:16, fontWeight:900, color:'#D4521A' }}>
                          {p.total_score || p.score || 0}
                        </div>
                        <div style={{ textAlign:'right', fontSize:11, color:'#AAA' }}>
                          {p.last_submission ? new Date(p.last_submission).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : '—'}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}