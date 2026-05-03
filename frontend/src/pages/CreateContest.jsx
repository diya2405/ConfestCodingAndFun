import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

function Navbar({ user, onLogout }) {
  return (
    <nav style={nav.bar}>
      <div style={nav.inner}>
        <Link to="/dashboard" style={nav.logo}>CONFEST</Link>
        <div style={nav.links}>
          <Link to="/dashboard" style={nav.link}>Dashboard</Link>
          <Link to="/contests"  style={nav.link}>Contests</Link>
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
  bar:       { position:'sticky',top:0,zIndex:100,background:'#fff',borderBottom:'1.5px solid #E8E4DC',fontFamily:'"DM Sans","Segoe UI",sans-serif' },
  inner:     { maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',padding:'0 32px',height:64,gap:40 },
  logo:      { fontSize:20,fontWeight:900,color:'#D4521A',textDecoration:'none',letterSpacing:2,fontFamily:'Georgia,serif' },
  links:     { display:'flex',gap:32,flex:1 },
  link:      { fontSize:15,fontWeight:600,color:'#444',textDecoration:'none' },
  right:     { display:'flex',alignItems:'center',gap:16 },
  avatar:    { width:38,height:38,borderRadius:'50%',background:'#D4521A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,textDecoration:'none' },
  logoutBtn: { padding:'8px 18px',borderRadius:8,border:'1.5px solid #DDD',background:'transparent',fontSize:14,fontWeight:600,color:'#666',cursor:'pointer' },
};

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const TAGS_OPTIONS = ['Arrays', 'Strings', 'DP', 'Graphs', 'Trees', 'Math', 'Sorting', 'Recursion', 'Greedy', 'Binary Search'];

const emptyProblem = () => ({
  title: '', description: '', difficulty: 'Medium', points: 100,
  examples: [{ input: '', output: '', explanation: '' }],
  constraints: [''],
  test_cases: [{ input: '', output: '' }],
});

export default function CreateContest() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', difficulty: 'Medium',
    start_time: '', duration_mins: 90, max_participants: 100,
    tags: [],
  });
  const [problems, setProblems] = useState([emptyProblem()]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleTag = t => setForm(p => ({
    ...p,
    tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t]
  }));

  // Problem helpers
  const setProb = (i, k, v) => setProblems(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  const addProblem = () => setProblems(ps => [...ps, emptyProblem()]);
  const removeProblem = i => setProblems(ps => ps.filter((_, idx) => idx !== i));

  const setExample = (pi, ei, k, v) => setProblems(ps => ps.map((p, idx) => {
    if (idx !== pi) return p;
    const ex = [...p.examples];
    ex[ei] = { ...ex[ei], [k]: v };
    return { ...p, examples: ex };
  }));

  const setTestCase = (pi, ti, k, v) => setProblems(ps => ps.map((p, idx) => {
    if (idx !== pi) return p;
    const tc = [...p.test_cases];
    tc[ti] = { ...tc[ti], [k]: v };
    return { ...p, test_cases: tc };
  }));

  const setConstraint = (pi, ci, v) => setProblems(ps => ps.map((p, idx) => {
    if (idx !== pi) return p;
    const cs = [...p.constraints];
    cs[ci] = v;
    return { ...p, constraints: cs };
  }));

  const validate = () => {
    if (step === 1) {
      if (!form.title.trim())       return setError('Contest title is required'), false;
      if (!form.start_time)         return setError('Start time is required'), false;
      if (form.duration_mins < 10)  return setError('Duration must be at least 10 minutes'), false;
      if (new Date(form.start_time) < new Date()) return setError('Start time must be in the future'), false;
    }
    if (step === 2) {
      for (let i = 0; i < problems.length; i++) {
        if (!problems[i].title.trim())       return setError(`Problem ${i + 1}: title required`), false;
        if (!problems[i].description.trim()) return setError(`Problem ${i + 1}: description required`), false;
      }
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { ...form, problems };
      const res = await API.post('/contests/create', payload);
      setSuccess('Contest created successfully!');
      setTimeout(() => navigate(`/contests`), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    border:'1.5px solid #E8E4DC', borderRadius:10,
    padding:'11px 14px', fontSize:15, fontFamily:'inherit',
    outline:'none', width:'100%', boxSizing:'border-box', color:'#1A1A1A',
  };
  const lbl = { fontSize:13, fontWeight:700, color:'#888', display:'block', marginBottom:6 };
  const field = { display:'flex', flexDirection:'column', gap:0, marginBottom:18 };

  const STEPS = ['Contest Details', 'Add Problems', 'Review & Publish'];

  return (
    <div style={{ minHeight:'100vh', background:'#FAF8F4', fontFamily:'"DM Sans","Segoe UI",sans-serif' }}>
      <Navbar user={user} onLogout={() => { logout(); navigate('/login'); }} />

      <main style={{ maxWidth:860, margin:'0 auto', padding:'40px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <Link to="/contests" style={{ fontSize:13, color:'#D4521A', fontWeight:600, textDecoration:'none' }}>← Back to Contests</Link>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#1A1A1A', margin:'10px 0 4px', fontFamily:'Georgia,serif' }}>Create a Contest</h1>
          <p style={{ color:'#888', fontSize:14, margin:0 }}>Set up a timed coding contest for your peers</p>
        </div>

        {/* Step Indicator */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:36 }}>
          {STEPS.map((s, i) => {
            const done   = step > i + 1;
            const active = step === i + 1;
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                  <div style={{
                    width:32, height:32, borderRadius:'50%', display:'flex',
                    alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14,
                    background: done||active ? '#D4521A' : '#EEE',
                    color: done||active ? '#fff' : '#AAA',
                  }}>{done ? '✓' : i + 1}</div>
                  <span style={{ fontSize:11, fontWeight:active?700:400, color:active?'#D4521A':'#AAA', whiteSpace:'nowrap' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex:1, height:2, background: step > i+1 ? '#D4521A' : '#EEE', margin:'0 8px 18px', transition:'background 0.3s' }} />
                )}
              </div>
            );
          })}
        </div>

        {error   && <div style={{ background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:14 }}>{error}</div>}
        {success && <div style={{ background:'#DCFCE7', color:'#166534', border:'1px solid #BBF7D0', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:14 }}>{success}</div>}

        {/* ── STEP 1: Contest Details ── */}
        {step === 1 && (
          <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E8E4DC', padding:'32px' }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#1A1A1A', margin:'0 0 24px', fontFamily:'Georgia,serif' }}>Contest Details</h2>

            <div style={field}>
              <label style={lbl}>Contest Title *</label>
              <input style={inp} placeholder="e.g. Weekly Challenge #13" value={form.title} onChange={e => setF('title', e.target.value)} />
            </div>

            <div style={field}>
              <label style={lbl}>Description</label>
              <textarea style={{ ...inp, minHeight:90, resize:'vertical' }} placeholder="What is this contest about?" value={form.description} onChange={e => setF('description', e.target.value)} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:18 }}>
              <div style={field}>
                <label style={lbl}>Start Date & Time *</label>
                <input style={inp} type="datetime-local" value={form.start_time} onChange={e => setF('start_time', e.target.value)} />
              </div>
              <div style={field}>
                <label style={lbl}>Duration (minutes) *</label>
                <input style={inp} type="number" min={10} max={360} value={form.duration_mins} onChange={e => setF('duration_mins', parseInt(e.target.value))} />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:18 }}>
              <div style={field}>
                <label style={lbl}>Difficulty</label>
                <div style={{ display:'flex', gap:10 }}>
                  {DIFFICULTIES.map(d => (
                    <button key={d} onClick={() => setF('difficulty', d)} style={{
                      flex:1, padding:'10px', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer',
                      border:'1.5px solid', fontFamily:'inherit',
                      borderColor: form.difficulty === d ? '#D4521A' : '#E8E4DC',
                      background:  form.difficulty === d ? '#FEF1EB' : '#fff',
                      color:       form.difficulty === d ? '#D4521A' : '#888',
                    }}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={field}>
                <label style={lbl}>Max Participants</label>
                <input style={inp} type="number" min={2} max={1000} value={form.max_participants} onChange={e => setF('max_participants', parseInt(e.target.value))} />
              </div>
            </div>

            <div style={field}>
              <label style={lbl}>Tags</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {TAGS_OPTIONS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)} style={{
                    padding:'7px 16px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
                    border:'1.5px solid', fontFamily:'inherit',
                    borderColor: form.tags.includes(t) ? '#D4521A' : '#E8E4DC',
                    background:  form.tags.includes(t) ? '#FEF1EB' : '#fff',
                    color:       form.tags.includes(t) ? '#D4521A' : '#888',
                  }}>{form.tags.includes(t) ? '✓ ' : ''}{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Problems ── */}
        {step === 2 && (
          <div>
            {problems.map((prob, pi) => (
              <div key={pi} style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E8E4DC', padding:'28px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                  <h2 style={{ fontSize:16, fontWeight:800, color:'#1A1A1A', margin:0 }}>Problem {pi + 1}</h2>
                  {problems.length > 1 && (
                    <button onClick={() => removeProblem(pi)} style={{ background:'#FEE2E2', color:'#991B1B', border:'none', borderRadius:8, padding:'6px 14px', fontSize:13, fontWeight:600, cursor:'pointer' }}>Remove</button>
                  )}
                </div>

                <div style={field}>
                  <label style={lbl}>Problem Title *</label>
                  <input style={inp} placeholder="e.g. Two Sum" value={prob.title} onChange={e => setProb(pi, 'title', e.target.value)} />
                </div>

                <div style={field}>
                  <label style={lbl}>Problem Description *</label>
                  <textarea style={{ ...inp, minHeight:120, resize:'vertical' }} placeholder="Describe the problem clearly..." value={prob.description} onChange={e => setProb(pi, 'description', e.target.value)} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:18 }}>
                  <div style={field}>
                    <label style={lbl}>Difficulty</label>
                    <div style={{ display:'flex', gap:8 }}>
                      {DIFFICULTIES.map(d => (
                        <button key={d} onClick={() => setProb(pi, 'difficulty', d)} style={{
                          flex:1, padding:'9px 6px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer',
                          border:'1.5px solid', fontFamily:'inherit',
                          borderColor: prob.difficulty === d ? '#D4521A' : '#E8E4DC',
                          background:  prob.difficulty === d ? '#FEF1EB' : '#fff',
                          color:       prob.difficulty === d ? '#D4521A' : '#888',
                        }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div style={field}>
                    <label style={lbl}>Points</label>
                    <input style={inp} type="number" min={10} max={500} value={prob.points} onChange={e => setProb(pi, 'points', parseInt(e.target.value))} />
                  </div>
                </div>

                {/* Examples */}
                <div style={{ marginBottom:18 }}>
                  <label style={lbl}>Examples</label>
                  {prob.examples.map((ex, ei) => (
                    <div key={ei} style={{ background:'#FAF8F4', borderRadius:10, border:'1px solid #E8E4DC', padding:'14px', marginBottom:10 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8 }}>
                        <div>
                          <label style={{ ...lbl, fontSize:11 }}>Input</label>
                          <input style={{ ...inp, fontSize:13 }} placeholder="nums = [2,7,11], target = 9" value={ex.input} onChange={e => setExample(pi, ei, 'input', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ ...lbl, fontSize:11 }}>Output</label>
                          <input style={{ ...inp, fontSize:13 }} placeholder="[0,1]" value={ex.output} onChange={e => setExample(pi, ei, 'output', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize:11 }}>Explanation (optional)</label>
                        <input style={{ ...inp, fontSize:13 }} placeholder="Because nums[0] + nums[1] == 9..." value={ex.explanation} onChange={e => setExample(pi, ei, 'explanation', e.target.value)} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setProblems(ps => ps.map((p, idx) => idx === pi ? { ...p, examples: [...p.examples, { input:'', output:'', explanation:'' }] } : p))}
                    style={{ fontSize:13, color:'#D4521A', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    + Add Example
                  </button>
                </div>

                {/* Test Cases */}
                <div style={{ marginBottom:18 }}>
                  <label style={lbl}>Test Cases (used for auto-grading)</label>
                  {prob.test_cases.map((tc, ti) => (
                    <div key={ti} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:8 }}>
                      <div>
                        <label style={{ ...lbl, fontSize:11 }}>Input</label>
                        <input style={{ ...inp, fontSize:13 }} placeholder='[2,7,11], 9' value={tc.input} onChange={e => setTestCase(pi, ti, 'input', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize:11 }}>Expected Output</label>
                        <input style={{ ...inp, fontSize:13 }} placeholder='[0,1]' value={tc.output} onChange={e => setTestCase(pi, ti, 'output', e.target.value)} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setProblems(ps => ps.map((p, idx) => idx === pi ? { ...p, test_cases: [...p.test_cases, { input:'', output:'' }] } : p))}
                    style={{ fontSize:13, color:'#D4521A', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    + Add Test Case
                  </button>
                </div>

                {/* Constraints */}
                <div>
                  <label style={lbl}>Constraints</label>
                  {prob.constraints.map((c, ci) => (
                    <input key={ci} style={{ ...inp, marginBottom:8, fontSize:13 }} placeholder="e.g. 1 ≤ n ≤ 10^5" value={c} onChange={e => setConstraint(pi, ci, e.target.value)} />
                  ))}
                  <button onClick={() => setProblems(ps => ps.map((p, idx) => idx === pi ? { ...p, constraints: [...p.constraints, ''] } : p))}
                    style={{ fontSize:13, color:'#D4521A', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>
                    + Add Constraint
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addProblem} style={{
              width:'100%', padding:'14px', borderRadius:10, border:'2px dashed #D4521A',
              background:'#FEF1EB', color:'#D4521A', fontSize:15, fontWeight:700, cursor:'pointer',
            }}>
              + Add Another Problem
            </button>
          </div>
        )}

        {/* ── STEP 3: Review ── */}
        {step === 3 && (
          <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #E8E4DC', padding:'32px' }}>
            <h2 style={{ fontSize:18, fontWeight:800, color:'#1A1A1A', margin:'0 0 24px', fontFamily:'Georgia,serif' }}>Review & Publish</h2>

            <div style={{ background:'#FAF8F4', borderRadius:12, padding:'20px', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, color:'#1A1A1A', margin:'0 0 14px' }}>{form.title}</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:14 }}>
                {[
                  ['Difficulty', form.difficulty],
                  ['Duration', `${form.duration_mins} min`],
                  ['Max Participants', form.max_participants],
                  ['Start Time', form.start_time ? new Date(form.start_time).toLocaleString('en-IN') : 'Not set'],
                  ['Problems', problems.length],
                  ['Tags', form.tags.join(', ') || 'None'],
                ].map(([k, v]) => (
                  <div key={k} style={{ borderBottom:'1px solid #E8E4DC', paddingBottom:10 }}>
                    <div style={{ fontSize:11, color:'#AAA', fontWeight:700, textTransform:'uppercase', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1A1A1A' }}>{String(v)}</div>
                  </div>
                ))}
              </div>
              {form.description && <p style={{ fontSize:14, color:'#666', margin:0 }}>{form.description}</p>}
            </div>

            <div style={{ marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, color:'#1A1A1A', margin:'0 0 12px' }}>Problems ({problems.length})</h3>
              {problems.map((p, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'#FAF8F4', borderRadius:10, marginBottom:8, border:'1px solid #E8E4DC' }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#1A1A1A' }}>P{i+1}. {p.title || 'Untitled'}</span>
                  <div style={{ display:'flex', gap:10 }}>
                    <span style={{ fontSize:12, fontWeight:700, color: p.difficulty==='Easy'?'#16a34a':p.difficulty==='Hard'?'#dc2626':'#d97706' }}>{p.difficulty}</span>
                    <span style={{ fontSize:12, color:'#D4521A', fontWeight:700 }}>{p.points} pts</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:'#FEF1EB', border:'1px solid #F4B89A', borderRadius:10, padding:'14px 16px', fontSize:14, color:'#7C2D12' }}>
              ⚠️ Once published, the contest title and start time cannot be changed. Make sure all details are correct.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', gap:12, marginTop:28 }}>
          {step > 1 && (
            <button onClick={() => { setError(''); setStep(s => s-1); }} style={{ padding:'13px 24px', borderRadius:10, border:'1.5px solid #E8E4DC', background:'transparent', fontSize:15, fontWeight:700, color:'#666', cursor:'pointer', fontFamily:'inherit' }}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => { if(validate()) setStep(s => s+1); }} style={{ flex:1, padding:'13px', borderRadius:10, border:'none', background:'#D4521A', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={{ flex:1, padding:'13px', borderRadius:10, border:'none', background:'#D4521A', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', fontFamily:'inherit', opacity: loading?0.7:1 }}>
              {loading ? 'Publishing...' : '🚀 Publish Contest'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}