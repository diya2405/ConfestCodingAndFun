import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  getContests, computeStatus, getTimeLeft,
  joinContest, isRegistered, createContest,
} from '../localStore';

// ── Shared Navbar ─────────────────────────────────────────────────────────────
function Navbar({ user, onLogout }) {
  return (
    <nav style={N.bar}>
      <div style={N.inner}>
        <Link to="/dashboard" style={N.logo}>CONFEST</Link>
        <div style={N.links}>
          <Link to="/dashboard" style={N.link}>Dashboard</Link>
          <Link to="/contests" style={{ ...N.link, color: '#D4521A', borderBottom: '2px solid #D4521A', paddingBottom: 2 }}>Contests</Link>
          <Link to="/leaderboard" style={N.link}>Leaderboard</Link>
        </div>
        <div style={N.right}>
          <Link to="/profile" style={N.avatar}>{user?.username?.[0]?.toUpperCase() || 'U'}</Link>
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

// ── Live countdown badge ──────────────────────────────────────────────────────
function Countdown({ contest }) {
  const [t, setT] = useState(getTimeLeft(contest));
  useEffect(() => {
    if (computeStatus(contest) !== 'live') return;
    const id = setInterval(() => setT(getTimeLeft(contest)), 1000);
    return () => clearInterval(id);
  }, [contest._id]);
  if (computeStatus(contest) !== 'live') return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'#15803d', fontWeight:700 }}>⏱ Time Remaining</span>
        <span style={{ fontSize:13, fontWeight:800, color: t.mins < 5 ? '#dc2626' : '#15803d', fontFamily:'monospace' }}>
          {String(t.mins).padStart(2,'0')}:{String(t.secs).padStart(2,'0')}
        </span>
      </div>
      <div style={{ height:6, background:'#E8E4DC', borderRadius:3 }}>
        <div style={{ height:'100%', width:`${t.pct}%`, background: t.pct < 20 ? '#dc2626' : '#16a34a', borderRadius:3, transition:'width 1s linear' }} />
      </div>
    </div>
  );
}

// ── Join Modal (with access key) ──────────────────────────────────────────────
function JoinModal({ contest, userId, username, institution, onClose, onJoined }) {
  const [key, setKey]     = useState('');
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = () => {
    setErr(''); setLoading(true);
    setTimeout(() => {
      // Try API first, fall back to local
      const result = joinContest(contest._id, userId, username, institution, key);
      if (result.ok) { onJoined(); onClose(); }
      else           { setErr(result.error); }
      setLoading(false);
    }, 400);
  };

  const isPrivate = contest.access_type === 'private';
  const status    = computeStatus(contest);

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.box} onClick={e => e.stopPropagation()}>
        <div style={M.top}>
          <h2 style={M.title}>{isPrivate ? '🔑 Private Contest' : '⚡ Join Contest'}</h2>
          <button onClick={onClose} style={M.close}>✕</button>
        </div>
        <p style={M.sub}><b>{contest.title}</b></p>
        <div style={M.metaRow}>
          <span style={M.chip}>{status === 'live' ? '● LIVE' : status.toUpperCase()}</span>
          <span style={M.chip}>{contest.duration_mins} min</span>
          <span style={M.chip}>{contest.difficulty}</span>
          {contest.prize && <span style={{ ...M.chip, color:'#D4521A', background:'#FEF1EB' }}>🏅 {contest.prize}</span>}
        </div>

        {isPrivate && (
          <div style={{ marginTop: 18 }}>
            <label style={M.lbl}>Access Key *</label>
            <input
              value={key} onChange={e => setKey(e.target.value.toUpperCase())}
              placeholder="Enter access key from organizer"
              style={M.inp}
              autoFocus
            />
            <p style={{ fontSize:12, color:'#AAA', marginTop:6 }}>This contest requires an access key. Contact the organizer to get yours.</p>
          </div>
        )}

        {!isPrivate && (
          <p style={{ fontSize:14, color:'#555', marginTop:14 }}>
            This is a public contest. Click below to register and get access to the coding arena when it goes live.
          </p>
        )}

        {err && <div style={M.err}>{err}</div>}

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={M.btnGhost}>Cancel</button>
          <button onClick={handleJoin} disabled={loading} style={{ ...M.btnPrimary, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Joining...' : status === 'live' ? 'Join & Enter Arena →' : 'Register Free'}
          </button>
        </div>
      </div>
    </div>
  );
}
const M = {
  overlay:  { position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 },
  box:      { background:'#fff',borderRadius:18,padding:'32px',width:'100%',maxWidth:460,boxShadow:'0 24px 60px rgba(0,0,0,0.18)' },
  top:      { display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 },
  title:    { fontSize:18,fontWeight:800,color:'#1A1A1A',margin:0 },
  close:    { background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888' },
  sub:      { fontSize:14,color:'#555',margin:'4px 0 12px' },
  metaRow:  { display:'flex',gap:8,flexWrap:'wrap' },
  chip:     { fontSize:12,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'#F3F0EA',color:'#555' },
  lbl:      { fontSize:13,fontWeight:700,color:'#888',display:'block',marginBottom:6 },
  inp:      { width:'100%',boxSizing:'border-box',border:'1.5px solid #E8E4DC',borderRadius:10,padding:'12px 14px',fontSize:15,fontFamily:'inherit',outline:'none',color:'#1A1A1A',letterSpacing:2,textTransform:'uppercase' },
  err:      { background:'#FEE2E2',color:'#991B1B',border:'1px solid #FECACA',borderRadius:8,padding:'10px 14px',fontSize:13,marginTop:14 },
  btnGhost: { flex:1,padding:'12px',borderRadius:10,border:'1.5px solid #E8E4DC',background:'transparent',fontSize:14,fontWeight:600,color:'#666',cursor:'pointer',fontFamily:'inherit' },
  btnPrimary:{ flex:1,padding:'12px',borderRadius:10,border:'none',background:'#D4521A',color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer',fontFamily:'inherit' },
};

// ── Contest Card ──────────────────────────────────────────────────────────────
const DIFF = { Easy:'#16a34a', Medium:'#d97706', Hard:'#dc2626' };
const SCOLOR = { live:'#15803d', upcoming:'#D4521A', completed:'#888' };

function ContestCard({ contest, userId, username, institution, onJoined }) {
  const navigate = useNavigate();
  const [modal, setModal]   = useState(false);
  const status = computeStatus(contest);
  const reg    = userId ? isRegistered(contest._id, userId) : false;

  const handleAction = () => {
    if (status === 'completed') return;
    if (reg && status === 'live') { navigate(`/arena/${contest._id}`); return; }
    setModal(true);
  };

  const afterJoined = () => {
    onJoined();
    if (status === 'live') navigate(`/arena/${contest._id}`);
  };

  return (
    <>
      <div style={{
        background:'#fff', borderRadius:14, padding:'22px 24px',
        border: status === 'live' ? '1.5px solid #86efac' : '1.5px solid #E8E4DC',
        boxShadow: status === 'live' ? '0 0 0 3px #dcfce7' : 'none',
        display:'flex', flexDirection:'column', gap:12,
      }}>
        {/* Header badges */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20, background:SCOLOR[status]+'18',color:SCOLOR[status] }}>
              {status === 'live' ? '● LIVE' : status.toUpperCase()}
            </span>
            <span style={{ fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20, background:DIFF[contest.difficulty]+'18',color:DIFF[contest.difficulty] }}>
              {contest.difficulty}
            </span>
            {contest.access_type === 'private' && (
              <span style={{ fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'#EEE8FF',color:'#7c3aed' }}>🔑 Private</span>
            )}
            {reg && <span style={{ fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:20,background:'#dcfce7',color:'#15803d' }}>✓ Registered</span>}
          </div>
          <span style={{ fontSize:12, color:'#888', fontWeight:600 }}>{contest.duration_mins} min · {contest.problem_ids.length} problems</span>
        </div>

        {/* Title + desc */}
        <div>
          <h3 style={{ fontSize:16,fontWeight:800,color:'#1A1A1A',margin:'0 0 5px' }}>{contest.title}</h3>
          <p style={{ fontSize:13,color:'#666',margin:0,lineHeight:1.5 }}>{(contest.description||'').slice(0,100)}{(contest.description||'').length > 100 ? '…' : ''}</p>
        </div>

        {/* Meta */}
        <div style={{ display:'flex',gap:14,flexWrap:'wrap' }}>
          <span style={{ fontSize:13,color:'#888' }}>🗓 {new Date(contest.start_time).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
          <span style={{ fontSize:13,color:'#888' }}>👥 {(contest.registered_users||[]).length}/{contest.max_participants}</span>
          {contest.prize && <span style={{ fontSize:13,color:'#D4521A',fontWeight:600 }}>🏅 {contest.prize}</span>}
        </div>

        {/* Tags */}
        {(contest.tags||[]).length > 0 && (
          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
            {contest.tags.slice(0,4).map(t => <span key={t} style={{ fontSize:11,background:'#F3F0EA',color:'#666',padding:'3px 10px',borderRadius:20 }}>{t}</span>)}
          </div>
        )}

        {/* Countdown */}
        <Countdown contest={contest} />

        {/* CTA */}
        <button
          onClick={handleAction}
          disabled={status === 'completed'}
          style={{
            padding:'11px', borderRadius:10, border:'none', fontSize:14, fontWeight:800,
            fontFamily:'inherit', cursor: status === 'completed' ? 'not-allowed' : 'pointer',
            background: status === 'completed' ? '#F3F0EA' : reg && status === 'live' ? '#16a34a' : '#D4521A',
            color: status === 'completed' ? '#AAA' : '#fff',
          }}
        >
          {status === 'completed' ? 'Contest Ended' :
           reg && status === 'live' ? '⚡ Enter Coding Arena →' :
           reg ? '✓ Registered — Waiting for Start' :
           status === 'live' ? '⚡ Join Now' : 'Register Free'}
        </button>
      </div>

      {modal && (
        <JoinModal
          contest={contest} userId={userId} username={username} institution={institution}
          onClose={() => setModal(false)} onJoined={afterJoined}
        />
      )}
    </>
  );
}

// ── Create Contest Wizard ─────────────────────────────────────────────────────
const TAGS_LIST  = ['Arrays','Strings','DP','Graphs','Trees','Math','Sorting','Recursion','Greedy','Binary Search','Bit Manipulation','Geometry'];
const DIFF_LIST  = ['Easy','Medium','Hard'];
const emptyProb  = () => ({ title:'', description:'', difficulty:'Medium', points:100, examples:[{input:'',output:'',explanation:''}], constraints:[''], test_cases:[{input:'',output:''}] });

function CreateWizard({ userId, username, onCreated, onClose }) {
  const [step, setStep] = useState(1);
  const [err,  setErr]  = useState('');
  const [form, setForm] = useState({
    title:'', description:'', difficulty:'Medium', duration_mins:90,
    start_time:'', max_participants:100, tags:[], access_type:'public', access_key:'', prize:'',
  });
  const [problems, setProbs] = useState([emptyProb()]);

  const sf = (k,v) => setForm(p => ({...p,[k]:v}));
  const toggleTag = t => sf('tags', form.tags.includes(t) ? form.tags.filter(x=>x!==t) : [...form.tags,t]);

  const sp = (i,k,v) => setProbs(ps => ps.map((p,idx) => idx===i ? {...p,[k]:v} : p));
  const addEx  = i => sp(i,'examples',[...problems[i].examples,{input:'',output:'',explanation:''}]);
  const addTC  = i => sp(i,'test_cases',[...problems[i].test_cases,{input:'',output:''}]);
  const addCon = i => sp(i,'constraints',[...problems[i].constraints,'']);

  const validate = () => {
    if (step===1) {
      if (!form.title.trim())            return setErr('Title required'), false;
      if (!form.start_time)              return setErr('Start time required'), false;
      if (new Date(form.start_time)<new Date()) return setErr('Start time must be in the future'), false;
      if (form.access_type==='private' && !form.access_key.trim()) return setErr('Access key required for private contest'), false;
    }
    if (step===2) {
      for (let i=0;i<problems.length;i++) {
        if (!problems[i].title.trim())       return setErr(`Problem ${i+1}: title required`), false;
        if (!problems[i].description.trim()) return setErr(`Problem ${i+1}: description required`), false;
      }
    }
    setErr(''); return true;
  };

  const submit = () => {
    if (!validate()) return;
    const id = createContest({ ...form, problems }, userId, username);
    onCreated(id);
  };

  const inp  = { border:'1.5px solid #E8E4DC',borderRadius:10,padding:'11px 14px',fontSize:14,fontFamily:'inherit',outline:'none',width:'100%',boxSizing:'border-box',color:'#1A1A1A' };
  const lbl  = { fontSize:12,fontWeight:700,color:'#888',display:'block',marginBottom:5 };
  const STEPS = ['Contest Info','Add Problems','Review'];

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={{ ...M.box, maxWidth:680, maxHeight:'90vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={M.top}>
          <h2 style={M.title}>Create a Contest</h2>
          <button onClick={onClose} style={M.close}>✕</button>
        </div>

        {/* Stepper */}
        <div style={{ display:'flex',alignItems:'center',margin:'16px 0 24px' }}>
          {STEPS.map((s,i) => {
            const done=step>i+1, active=step===i+1;
            return (
              <div key={s} style={{ display:'flex',alignItems:'center',flex:i<STEPS.length-1?1:0 }}>
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:13,background:done||active?'#D4521A':'#EEE',color:done||active?'#fff':'#AAA' }}>{done?'✓':i+1}</div>
                  <span style={{ fontSize:11,fontWeight:active?700:400,color:active?'#D4521A':'#AAA',whiteSpace:'nowrap' }}>{s}</span>
                </div>
                {i<STEPS.length-1 && <div style={{ flex:1,height:2,background:step>i+1?'#D4521A':'#EEE',margin:'0 8px 14px',transition:'background 0.3s' }} />}
              </div>
            );
          })}
        </div>

        {err && <div style={{ ...M.err, marginBottom:16 }}>{err}</div>}

        {/* Step 1 */}
        {step===1 && (
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            <div><label style={lbl}>Contest Title *</label><input style={inp} placeholder="e.g. Weekly Blitz #13" value={form.title} onChange={e=>sf('title',e.target.value)} /></div>
            <div><label style={lbl}>Description</label><textarea style={{...inp,minHeight:72,resize:'vertical'}} placeholder="What is this contest about?" value={form.description} onChange={e=>sf('description',e.target.value)} /></div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
              <div>
                <label style={lbl}>Difficulty</label>
                <div style={{ display:'flex',gap:8 }}>
                  {DIFF_LIST.map(d => <button key={d} onClick={()=>sf('difficulty',d)} style={{ flex:1,padding:'9px 0',borderRadius:8,border:'1.5px solid',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',borderColor:form.difficulty===d?DIFF[d]:'#E8E4DC',background:form.difficulty===d?DIFF[d]+'18':'transparent',color:form.difficulty===d?DIFF[d]:'#888' }}>{d}</button>)}
                </div>
              </div>
              <div><label style={lbl}>Duration (minutes)</label><input type="number" style={inp} min="10" max="300" value={form.duration_mins} onChange={e=>sf('duration_mins',Number(e.target.value))} /></div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
              <div><label style={lbl}>Start Date & Time *</label><input type="datetime-local" style={inp} value={form.start_time} onChange={e=>sf('start_time',e.target.value)} /></div>
              <div><label style={lbl}>Max Participants</label><input type="number" style={inp} min="5" max="500" value={form.max_participants} onChange={e=>sf('max_participants',Number(e.target.value))} /></div>
            </div>
            <div>
              <label style={lbl}>Access Type</label>
              <div style={{ display:'flex',gap:10 }}>
                {[['public','🌐 Public — Anyone can join'],['private','🔑 Private — Access key required']].map(([val,label]) => (
                  <button key={val} onClick={()=>sf('access_type',val)} style={{ flex:1,padding:'11px',borderRadius:10,border:'1.5px solid',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',textAlign:'left',borderColor:form.access_type===val?'#D4521A':'#E8E4DC',background:form.access_type===val?'#FEF1EB':'#fff',color:form.access_type===val?'#D4521A':'#555' }}>{label}</button>
                ))}
              </div>
            </div>
            {form.access_type==='private' && (
              <div><label style={lbl}>Access Key *</label><input style={{...inp,textTransform:'uppercase',letterSpacing:2}} placeholder="e.g. MYCLASS2025" value={form.access_key} onChange={e=>sf('access_key',e.target.value.toUpperCase())} /></div>
            )}
            <div><label style={lbl}>Prize / Reward (optional)</label><input style={inp} placeholder="e.g. Certificate + 500 pts bonus" value={form.prize} onChange={e=>sf('prize',e.target.value)} /></div>
            <div>
              <label style={lbl}>Tags (select all that apply)</label>
              <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                {TAGS_LIST.map(t => <button key={t} onClick={()=>toggleTag(t)} style={{ padding:'6px 14px',borderRadius:20,border:'1.5px solid',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',borderColor:form.tags.includes(t)?'#D4521A':'#E8E4DC',background:form.tags.includes(t)?'#FEF1EB':'#fff',color:form.tags.includes(t)?'#D4521A':'#666' }}>{t}</button>)}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step===2 && (
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            {problems.map((prob,i) => (
              <div key={i} style={{ border:'1.5px solid #E8E4DC',borderRadius:12,padding:'20px' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                  <span style={{ fontSize:14,fontWeight:800,color:'#1A1A1A' }}>Problem {i+1}</span>
                  {problems.length>1 && <button onClick={()=>setProbs(ps=>ps.filter((_,idx)=>idx!==i))} style={{ background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:13,fontWeight:700 }}>Remove</button>}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  <div><label style={lbl}>Problem Title *</label><input style={inp} placeholder="e.g. Two Sum" value={prob.title} onChange={e=>sp(i,'title',e.target.value)} /></div>
                  <div><label style={lbl}>Problem Statement *</label><textarea style={{...inp,minHeight:80,resize:'vertical'}} placeholder="Describe the problem clearly..." value={prob.description} onChange={e=>sp(i,'description',e.target.value)} /></div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                    <div>
                      <label style={lbl}>Difficulty</label>
                      <select style={inp} value={prob.difficulty} onChange={e=>sp(i,'difficulty',e.target.value)}>
                        {DIFF_LIST.map(d=><option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div><label style={lbl}>Points</label><input type="number" style={inp} min="10" max="1000" value={prob.points} onChange={e=>sp(i,'points',Number(e.target.value))} /></div>
                  </div>
                  {/* Examples */}
                  <div>
                    <label style={lbl}>Examples</label>
                    {prob.examples.map((ex,ei) => (
                      <div key={ei} style={{ background:'#F9F7F4',borderRadius:8,padding:'10px 12px',marginBottom:8 }}>
                        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                          <div><label style={{...lbl,fontSize:11}}>Input</label><input style={{...inp,fontSize:13}} placeholder="Input" value={ex.input} onChange={e=>{const exs=[...prob.examples];exs[ei]={...exs[ei],input:e.target.value};sp(i,'examples',exs)}} /></div>
                          <div><label style={{...lbl,fontSize:11}}>Output</label><input style={{...inp,fontSize:13}} placeholder="Output" value={ex.output} onChange={e=>{const exs=[...prob.examples];exs[ei]={...exs[ei],output:e.target.value};sp(i,'examples',exs)}} /></div>
                        </div>
                        <div style={{ marginTop:8 }}><label style={{...lbl,fontSize:11}}>Explanation (optional)</label><input style={{...inp,fontSize:13}} placeholder="Explanation" value={ex.explanation} onChange={e=>{const exs=[...prob.examples];exs[ei]={...exs[ei],explanation:e.target.value};sp(i,'examples',exs)}} /></div>
                      </div>
                    ))}
                    <button onClick={()=>addEx(i)} style={{ fontSize:12,color:'#D4521A',background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>+ Add Example</button>
                  </div>
                  {/* Constraints */}
                  <div>
                    <label style={lbl}>Constraints</label>
                    {prob.constraints.map((con,ci) => (
                      <input key={ci} style={{...inp,marginBottom:6,fontSize:13}} placeholder={`Constraint ${ci+1}, e.g. 1 ≤ n ≤ 10⁵`} value={con} onChange={e=>{const cs=[...prob.constraints];cs[ci]=e.target.value;sp(i,'constraints',cs)}} />
                    ))}
                    <button onClick={()=>addCon(i)} style={{ fontSize:12,color:'#D4521A',background:'none',border:'none',cursor:'pointer',fontWeight:700 }}>+ Add Constraint</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={()=>setProbs(ps=>[...ps,emptyProb()])} style={{ padding:'11px',borderRadius:10,border:'1.5px dashed #D4521A',background:'#FEF1EB',color:'#D4521A',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
              + Add Another Problem
            </button>
          </div>
        )}

        {/* Step 3 — Review */}
        {step===3 && (
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            <div style={{ background:'#F9F7F4',borderRadius:12,padding:'20px' }}>
              <div style={{ fontSize:14,fontWeight:700,color:'#888',marginBottom:4 }}>Contest</div>
              <div style={{ fontSize:18,fontWeight:800,color:'#1A1A1A' }}>{form.title}</div>
              <div style={{ display:'flex',gap:12,marginTop:8,flexWrap:'wrap' }}>
                <span style={{ fontSize:13,color:'#555' }}>⏱ {form.duration_mins} min</span>
                <span style={{ fontSize:13,color:'#555' }}>📅 {form.start_time ? new Date(form.start_time).toLocaleString('en-IN') : '—'}</span>
                <span style={{ fontSize:13,color:'#555' }}>👥 {form.max_participants} max</span>
                {form.access_type==='private' && <span style={{ fontSize:13,color:'#7c3aed',fontWeight:700 }}>🔑 Key: {form.access_key}</span>}
              </div>
            </div>
            {problems.map((p,i) => (
              <div key={i} style={{ background:'#fff',border:'1.5px solid #E8E4DC',borderRadius:10,padding:'14px 18px' }}>
                <div style={{ fontSize:13,fontWeight:700,color:'#1A1A1A' }}>Problem {i+1}: {p.title}</div>
                <div style={{ fontSize:12,color:'#888',marginTop:3 }}>{p.difficulty} · {p.points} pts · {p.test_cases.length} test cases</div>
              </div>
            ))}
            <div style={{ background:'#dcfce7',border:'1px solid #86efac',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#166534',fontWeight:600 }}>
              ✅ Everything looks good! Click "Publish Contest" to make it live.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex',gap:10,marginTop:24 }}>
          {step>1 && <button onClick={()=>{setErr('');setStep(s=>s-1)}} style={M.btnGhost}>← Back</button>}
          {step<3
            ? <button onClick={()=>{if(validate())setStep(s=>s+1)}} style={{...M.btnPrimary,flex:1}}>Continue →</button>
            : <button onClick={submit} style={{...M.btnPrimary,flex:1,background:'#16a34a'}}>🚀 Publish Contest</button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Main Contests Page ────────────────────────────────────────────────────────
export default function Contests() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [contests,  setContests]  = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [search,    setSearch]    = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tick,      setTick]      = useState(0);

  // Re-render every 30s to update statuses
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);

  const loadContests = () => {
    // Try API first, fall back to local
    API.get('/contests').then(r => {
      if (r.data?.contests?.length) setContests(r.data.contests);
      else setContests(getContests());
    }).catch(() => setContests(getContests()));
  };

  useEffect(() => { loadContests(); }, [tick]);

  const userId      = user?.id || user?._id || 'guest';
  const username    = user?.username || 'User';
  const institution = user?.institution || '';

  const displayed = contests
    .map(c => ({ ...c, _status: computeStatus(c) }))
    .filter(c => filter === 'all' || c._status === filter)
    .filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || (c.tags||[]).some(t => t.toLowerCase().includes(search.toLowerCase())));

  const handleLogout = () => { logout(); navigate('/login'); };

  const counts = {
    all:       contests.length,
    live:      contests.filter(c => computeStatus(c) === 'live').length,
    upcoming:  contests.filter(c => computeStatus(c) === 'upcoming').length,
    completed: contests.filter(c => computeStatus(c) === 'completed').length,
  };

  return (
    <div style={{ minHeight:'100vh', background:'#FAF8F4', fontFamily:'"DM Sans","Segoe UI",sans-serif' }}>
      <Navbar user={user} onLogout={handleLogout} />

      <main style={{ maxWidth:1200, margin:'0 auto', padding:'40px 32px 60px' }}>
        {/* Header */}
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32,flexWrap:'wrap',gap:16 }}>
          <div>
            <h1 style={{ fontSize:26,fontWeight:900,color:'#1A1A1A',margin:'0 0 5px',fontFamily:'Georgia,serif' }}>Contests</h1>
            <p style={{ color:'#888',fontSize:14,margin:0 }}>Compete live. Climb the leaderboard. Win bragging rights.</p>
          </div>
          <button onClick={()=>setShowCreate(true)} style={{ padding:'11px 22px',background:'#D4521A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:8 }}>
            + Create Contest
          </button>
        </div>

        {/* Filter + Search */}
        <div style={{ display:'flex',gap:12,marginBottom:28,flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title or tag..." style={{ flex:1,minWidth:200,border:'1.5px solid #E8E4DC',borderRadius:10,padding:'10px 16px',fontSize:14,fontFamily:'inherit',outline:'none',color:'#1A1A1A',background:'#fff' }} />
          <div style={{ display:'flex',background:'#fff',border:'1.5px solid #E8E4DC',borderRadius:10,overflow:'hidden' }}>
            {['all','live','upcoming','completed'].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{ padding:'10px 16px',border:'none',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit', background:filter===f?'#D4521A':'transparent', color:filter===f?'#fff':'#888' }}>
                {f.charAt(0).toUpperCase()+f.slice(1)} {counts[f] > 0 ? `(${counts[f]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:20 }}>
          {displayed.map(c => (
            <ContestCard key={c._id} contest={c} userId={userId} username={username} institution={institution} onJoined={loadContests} />
          ))}
          {displayed.length === 0 && (
            <div style={{ gridColumn:'1/-1',textAlign:'center',padding:'60px',color:'#AAA' }}>
              No contests found.{' '}
              <button onClick={()=>setShowCreate(true)} style={{ background:'none',border:'none',color:'#D4521A',fontWeight:700,cursor:'pointer',fontSize:14 }}>Create one!</button>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateWizard
          userId={userId} username={username}
          onCreated={id => { setShowCreate(false); loadContests(); navigate(`/arena/${id}`); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}