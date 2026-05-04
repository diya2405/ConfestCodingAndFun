// frontend/src/pages/CodingArena.jsx
// ALL BUGS FIXED — see comments marked FIX
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  getContest, getProblems, computeStatus, getTimeLeft,
  getLeaderboard, addSubmission, getSubmissions, isRegistered,
} from '../localStore';
 
// ─────────────────────────────────────────────────────────────────────────────
// PYODIDE — runs Python locally in the browser via WebAssembly
// FIX: proper singleton loader, FIX: use globals() not locals() to find fns
// ─────────────────────────────────────────────────────────────────────────────
let _py   = null;
let _loading = false;
let _queue   = [];
 
function getPyodide() {
  return new Promise((resolve, reject) => {
    if (_py) { resolve(_py); return; }
    _queue.push({ resolve, reject });
    if (_loading) return;
    _loading = true;
 
    if (!document.querySelector('script[src*="pyodide"]')) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      s.onload = async () => {
        try {
          // FIX: use window.loadPyodide properly
          const py = await window.loadPyodide({ indexURL:'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' });
          _py = py;
          _queue.forEach(q => q.resolve(py));
          _queue = [];
        } catch(e) {
          _queue.forEach(q => q.reject(e));
          _queue = [];
        }
      };
      s.onerror = (e) => { _queue.forEach(q => q.reject(e)); _queue = []; };
      document.head.appendChild(s);
    } else if (window.loadPyodide) {
      window.loadPyodide({ indexURL:'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/' }).then(py => {
        _py = py;
        _queue.forEach(q => q.resolve(py));
        _queue = [];
      });
    }
  });
}
 
// Deep equality with sorted keys — matches backend's json.dumps(sort_keys=True)
function deepEqual(a, b) {
  try {
    const sortedStringify = (v) => JSON.stringify(v, Object.keys(v ?? {}).sort());
    // For arrays/objects use recursive sorted stringify
    const sa = JSON.stringify(a, (_, v) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v).sort(([ka], [kb]) => ka.localeCompare(kb)));
      }
      return v;
    });
    const sb = JSON.stringify(b, (_, v) => {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v).sort(([ka], [kb]) => ka.localeCompare(kb)));
      }
      return v;
    });
    return sa === sb;
  } catch (_) {
    return String(a).trim() === String(b).trim();
  }
}

// FIX: uses globals() to find functions — locals() does NOT work after exec()
async function runPythonCode(code, testCases) {
  let py;
  try { py = await getPyodide(); }
  catch(e) { return testCases.map(tc => ({ pass:false, got:'Pyodide failed to load', expected:JSON.stringify(tc && tc.output), input:tc && tc.input, error:true })); }

  const results = [];
  for (const tc of testCases) {
    try {
      // Heuristic: if submission code reads from stdin (contains 'input(' or sys.stdin)
      // and the testcase provides an array `input`, convert that to stdin lines.
      let tcToUse = tc || {};
      const looksLikeScript = /\binput\s*\(|\bsys\.stdin\b/.test(code);
      if (looksLikeScript && Array.isArray(tc && tc.input)) {
        const lines = tc.input.map(x => (typeof x === 'string' ? x : String(x))).join('\n');
        tcToUse = { stdin: lines, output: tc.output };
      }

      // If test case provides `stdin`, run as a script and capture stdout
      if (tcToUse && tcToUse.stdin != null) {
        const runner = `
import sys, io, json, traceback
def _run_test():
    _code = ${JSON.stringify(code)}
    _stdin = ${JSON.stringify(String(tcToUse.stdin))}
    _ns = {}
    sys.stdin = io.StringIO(_stdin)
    _out = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = _out
    try:
        exec(compile(_code, '<solution>', 'exec'), _ns)
        sys.stdout = old_stdout
        out = _out.getvalue()
        return json.dumps({'out': out})
    except Exception:
        sys.stdout = old_stdout
        return json.dumps({'_err': traceback.format_exc()})

_run_test_res = _run_test()
_run_test_res
`;
        const gotRaw = await py.runPythonAsync(runner);
        let parsed;
        try { parsed = JSON.parse(gotRaw); } catch(e) { parsed = { _err: 'Invalid runner output' }; }
        if (parsed && parsed._err) {
          const errMsg = String(parsed._err).slice(0,160);
          results.push({ pass:false, got: errMsg, expected: tcToUse.output, input: tcToUse.stdin, error:true });
        } else {
          const gotStr = parsed.out;
          // Flexible comparison: try JSON parse both sides, numeric coercion, regex support
          const normalize = (v) => {
            if (v == null) return null;
            // if value is already object/array
            if (typeof v !== 'string') return v;
            const s = v.replace(/\r\n/g,'\n').trim();
            // try parse json
            try { return JSON.parse(s); } catch(_) {}
            // numeric?
            if (!Number.isNaN(Number(s))) return Number(s);
            return s;
          };
          const gotVal = normalize(gotStr);
          const expVal = normalize(tcToUse.output);
          const isRegex = typeof expVal === 'string' && expVal.startsWith('re:');
          const asStr = s => String(s == null ? '' : s).replace(/\r\n/g,'\n').trim();
          let match = false;
          if (isRegex) {
            try { match = new RegExp(expVal.slice(3)).test(asStr(gotVal)); } catch(e) { match = false; }
          } else {
            // Issue 1 fix: use deepEqual (sort-key aware) for objects/arrays
            if ((typeof gotVal === 'object' && gotVal !== null) || (typeof expVal === 'object' && expVal !== null)) {
              match = deepEqual(gotVal, expVal);
              if (!match) match = asStr(gotVal) === asStr(expVal);
            } else {
              match = asStr(gotVal) === asStr(expVal);
            }
          }
          results.push({ pass: match, got: gotVal, expected: expVal, input: tcToUse.stdin, error:false });
        }
        continue;
      }

      // Function-style: call the user's first exported function with provided params
      const inputArgs = Array.isArray(tc && tc.input) ? tc.input : (tc && tc.input === undefined ? [] : [tc.input]);
      const runner2 = `
import json, traceback
def _run_test2():
    _code = ${JSON.stringify(code)}
    _input = json.loads(${JSON.stringify(JSON.stringify(inputArgs))})
    _ns = {}
    try:
        exec(compile(_code, '<solution>', 'exec'), _ns)
        fns = [v for k,v in _ns.items() if callable(v) and not k.startswith('_')]
        if not fns:
            raise RuntimeError('No function found')
        # call the first function
        ret = None
        if isinstance(_input, list):
            ret = fns[0](*_input)
        else:
            ret = fns[0](_input)
        return json.dumps({'ret': ret})
    except Exception:
        return json.dumps({'_err': traceback.format_exc()})

_run_test2_res = _run_test2()
_run_test2_res
`;
      const gotRaw2 = await py.runPythonAsync(runner2);
      let parsed2;
      try { parsed2 = JSON.parse(gotRaw2); } catch(e) { parsed2 = { _err: 'Invalid runner output' }; }
      if (parsed2 && parsed2._err) {
        const errMsg = String(parsed2._err).slice(0,160);
        results.push({ pass:false, got: errMsg, expected: (tc && tc.output), input: inputArgs, error:true });
      } else {
        const gotVal = parsed2.ret;
        // reuse flexible comparison
        const normalizeVal = (v) => {
          if (v == null) return null;
          if (typeof v !== 'string') return v;
          const s = v.replace(/\r\n/g,'\n').trim();
          try { return JSON.parse(s); } catch(_) {}
          if (!Number.isNaN(Number(s))) return Number(s);
          return s;
        };
        const gotN = normalizeVal(gotVal);
        const expN = normalizeVal(tc && tc.output);
        const asStr2 = s => String(s == null ? '' : s).replace(/\r\n/g,'\n').trim();
        let match = false;
        if (typeof expN === 'string' && expN.startsWith('re:')) {
          try { match = new RegExp(expN.slice(3)).test(asStr2(gotN)); } catch(e) { match = false; }
        } else {
          // Issue 1 fix: use deepEqual (sort-key aware) for objects/arrays
          if ((typeof gotN === 'object' && gotN !== null) || (typeof expN === 'object' && expN !== null)) {
            match = deepEqual(gotN, expN);
            if (!match) match = asStr2(gotN) === asStr2(expN);
          } else {
            match = asStr2(gotN) === asStr2(expN);
          }
        }
        results.push({ pass: match, got: gotN, expected: expN, input: inputArgs, error:false });
      }

    } catch(e) {
      const msg = String(e).slice(0,160);
      results.push({ pass:false, got:msg, expected: JSON.stringify(tc && tc.output), input: tc && tc.input, error:true });
    }
  }
  return results;
}
 
// ─────────────────────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────────────────────
function ArenaNav({ contest, problems, probIdx, onSwitch, username, onExit }) {
  const DIFF_C = { Easy:'#16a34a', Medium:'#d97706', Hard:'#dc2626' };
  return (
    <nav style={{ position:'sticky',top:0,zIndex:100,background:'#1A1A2E',borderBottom:'1px solid #2A2A3E',fontFamily:'"DM Sans","Segoe UI",sans-serif',userSelect:'none' }}>
      <div style={{ display:'flex',alignItems:'center',padding:'0 20px',height:52,gap:16 }}>
        <Link to="/contests" style={{ fontSize:16,fontWeight:900,color:'#D4521A',textDecoration:'none',letterSpacing:2,fontFamily:'Georgia,serif',flexShrink:0 }}>CONFEST</Link>
        <div style={{ width:1,height:24,background:'#2A2A3E',flexShrink:0 }} />
        <div style={{ display:'flex',gap:4,flex:1,overflowX:'auto',paddingBottom:2 }}>
          {problems.map((p, i) => (
            <button key={p._id||i} onClick={() => onSwitch(i)} style={{
              padding:'5px 14px',borderRadius:20,border:'none',fontSize:12,fontWeight:700,
              cursor:'pointer',fontFamily:'inherit',flexShrink:0,whiteSpace:'nowrap',
              background: i===probIdx ? '#D4521A' : '#2A2A3E',
              color: i===probIdx ? '#fff' : '#888',
            }}>
              P{i+1}: {(p.title||'').slice(0,16)}{(p.title||'').length>16?'…':''}
              <span style={{ marginLeft:4,fontSize:10,color:i===probIdx?'#FFD0B0':DIFF_C[p.difficulty]||'#888' }}>
                ({p.points||0}pts)
              </span>
            </button>
          ))}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:12,flexShrink:0 }}>
          <span style={{ fontSize:12,color:'#666' }}>{username}</span>
          <button onClick={onExit} style={{ padding:'5px 12px',borderRadius:6,border:'1px solid #2A2A3E',background:'transparent',fontSize:12,color:'#888',cursor:'pointer' }}>Exit</button>
        </div>
      </div>
    </nav>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// TIMER BAR
// ─────────────────────────────────────────────────────────────────────────────
function ContestTimer({ contest }) {
  const [t, setT] = useState(getTimeLeft(contest));
  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft(contest)), 1000);
    return () => clearInterval(id);
  }, [contest._id]);
  const urgent = t.mins < 5;
  return (
    <div style={{ background: urgent?'#7f1d1d':'#0F3460', padding:'7px 20px', display:'flex', alignItems:'center', gap:16 }}>
      <span style={{ fontSize:12,color:'#aaa',fontWeight:600,flex:1 }}>{contest.title}</span>
      <div style={{ display:'flex',alignItems:'center',gap:12,maxWidth:360,flex:1 }}>
        <div style={{ flex:1,height:5,background:'rgba(255,255,255,0.1)',borderRadius:3 }}>
          <div style={{ height:'100%',width:`${t.pct}%`,background:urgent?'#ef4444':'#D4521A',borderRadius:3,transition:'width 1s linear' }} />
        </div>
        <span style={{ fontSize:15,fontWeight:900,color:urgent?'#fca5a5':'#fff',fontFamily:'monospace',flexShrink:0 }}>
          {String(t.mins).padStart(2,'0')}:{String(t.secs).padStart(2,'0')}
        </span>
      </div>
      <span style={{ fontSize:11,color:'#666' }}>{contest.duration_mins} min</span>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// WAITING LOBBY — shown when contest is upcoming + user is registered
// ─────────────────────────────────────────────────────────────────────────────
function Lobby({ contest, participants, username }) {
  const [t, setT] = useState({ mins:0, secs:0, started:false });

  useEffect(() => {
    const calc = () => {
      const start = new Date(contest.start_time).getTime();
      const left  = Math.max(0, start - Date.now());
      // Also check server status field — trust it over local clock (timezone issues)
      const started = Date.now() >= start || contest.status === 'live' || contest.status === 'completed';
      setT({ mins: Math.floor(left/60000), secs: Math.floor((left%60000)/1000), started });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [contest._id, contest.status]);

  return (
    <div style={{ minHeight:'100vh', background:'#0D1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'"DM Sans","Segoe UI",sans-serif', flexDirection:'column', gap:0, padding:24 }}>
      <div style={{ maxWidth:520, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#D4521A', letterSpacing:2, fontFamily:'Georgia,serif', marginBottom:28 }}>CONFEST</div>

        <div style={{ background:'#161B22', borderRadius:20, border:'1px solid #2A2A3E', padding:'36px 32px', marginBottom:20 }}>
          {t.started ? (
            <>
              <div style={{ fontSize:48, marginBottom:12 }}>🚀</div>
              <div style={{ fontSize:22, fontWeight:900, color:'#16a34a', marginBottom:8 }}>Contest has started!</div>
              <div style={{ fontSize:14, color:'#aaa', marginBottom:20 }}>Loading arena...</div>
              <div style={{ width:40, height:4, background:'#D4521A', borderRadius:2, margin:'0 auto', animation:'pulse 1s infinite' }} />
            </>
          ) : (
            <>
              <div style={{ fontSize:13, color:'#888', fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Contest starts in</div>
              <div style={{ fontSize:64, fontWeight:900, color: t.mins === 0 && t.secs <= 10 ? '#ef4444' : '#D4521A', fontFamily:'monospace', letterSpacing:4, lineHeight:1, marginBottom:8, transition:'color 0.3s' }}>
                {String(t.mins).padStart(2,'0')}:{String(t.secs).padStart(2,'0')}
              </div>
              <div style={{ fontSize:14, color:'#aaa', marginBottom:20 }}>{contest.title}</div>

              <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
                <span style={{ fontSize:13, color:'#666', background:'#1A1A2E', padding:'6px 14px', borderRadius:20 }}>⏱ {contest.duration_mins} min</span>
                <span style={{ fontSize:13, color:'#666', background:'#1A1A2E', padding:'6px 14px', borderRadius:20 }}>{contest.difficulty}</span>
                {contest.prize && <span style={{ fontSize:13, color:'#D4521A', background:'#2A1A0E', padding:'6px 14px', borderRadius:20 }}>🏅 {contest.prize}</span>}
              </div>

              <div style={{ background:'#dcfce722', border:'1px solid #16a34a44', borderRadius:10, padding:'10px 16px', fontSize:13, color:'#86efac', fontWeight:600 }}>
                ✓ You are registered — arena unlocks automatically when the timer hits 00:00
              </div>
            </>
          )}
        </div>

        {/* Participants in lobby */}
        {participants.length > 0 && (
          <div style={{ background:'#161B22', borderRadius:16, border:'1px solid #2A2A3E', padding:'20px 24px', textAlign:'left' }}>
            <div style={{ fontSize:13, color:'#888', fontWeight:700, marginBottom:12 }}>Participants in lobby ({participants.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {participants.slice(0, 8).map((p, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: p.username===username?'#D4521A':'#2A2A3E', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, flexShrink:0 }}>
                    {(p.username||'?')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize:13, color: p.username===username?'#D4521A':'#E6EDF3', fontWeight: p.username===username?700:400 }}>
                    {p.username} {p.username===username?'(You)':''}
                  </span>
                </div>
              ))}
              {participants.length > 8 && <div style={{ fontSize:12, color:'#555', marginTop:4 }}>+{participants.length-8} more participants...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ProblemPanel({ problem, submissions }) {
  const [tab, setTab] = useState('problem');
  const DIFF_C = { Easy:'#16a34a', Medium:'#d97706', Hard:'#dc2626' };
  const VERD_C = { Accepted:'#16a34a','Wrong Answer':'#dc2626',Partial:'#d97706','Time Limit Exceeded':'#d97706','Runtime Error':'#dc2626','Compilation Error':'#7c3aed' };
 
  // FIX: match both field name styles — API returns problem_id, local store uses problemId
  const mySubmissions = submissions.filter(s =>
    s.problemId === problem._id || s.problem_id === problem._id
  );
  const myAccepted = mySubmissions.some(s => s.verdict === 'Accepted');
 
  const renderText = (text = '') => {
    return text.split('\n').map((line, li) => {
      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
      return (
        <p key={li} style={{ margin:'0 0 8px', fontSize:14, color:'#444', lineHeight:1.8 }}>
          {parts.map((part, pi) => {
            if (part.startsWith('**') && part.endsWith('**')) return <strong key={pi}>{part.slice(2,-2)}</strong>;
            if (part.startsWith('`')  && part.endsWith('`'))  return <code key={pi} style={{ background:'#F3F0EA',padding:'2px 6px',borderRadius:4,fontSize:'0.88em',color:'#D4521A',fontFamily:'monospace' }}>{part.slice(1,-1)}</code>;
            return part;
          })}
        </p>
      );
    });
  };

  // pretty print helper for test case UI
  const prettyPrint = (v) => {
    try {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v, null, 2);
      if (typeof v === 'string') {
        // try parse JSON string
        const t = v.trim();
        try { const p = JSON.parse(t); return JSON.stringify(p, null, 2); } catch(e) {}
        return v;
      }
      return String(v);
    } catch (e) { return String(v); }
  };
 
  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#fff' }}>
      {/* Tabs */}
      <div style={{ display:'flex',borderBottom:'1.5px solid #E8E4DC',padding:'0 16px',gap:4,flexShrink:0 }}>
        {['problem','submissions'].map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 14px',border:'none',background:'transparent',fontSize:13,fontWeight:700,
            cursor:'pointer',fontFamily:'inherit',
            color:tab===t?'#D4521A':'#888',
            borderBottom:tab===t?'2px solid #D4521A':'2px solid transparent',
          }}>
            {t==='problem'?'Problem':`My Submissions${mySubmissions.length?` (${mySubmissions.length})`:''}`}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {tab==='problem' && (() => {
          return (
            <>
              <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:20 }}>
                <h2 style={{ fontSize:17,fontWeight:800,color:'#1A1A1A',margin:0 }}>{problem.title}</h2>
                <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:DIFF_C[problem.difficulty]+'18',color:DIFF_C[problem.difficulty] }}>{problem.difficulty}</span>
                <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#FEF1EB',color:'#D4521A' }}>{problem.points} pts</span>
                {myAccepted && <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#dcfce7',color:'#15803d' }}>✓ Solved</span>}
              </div>
              <div style={{ marginBottom:20 }}>{renderText(problem.description)}</div>

              {(problem.examples||[]).length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize:13,fontWeight:700,color:'#1A1A1A',marginBottom:10 }}>Examples</h3>
                  {problem.examples.map((ex,i) => (
                    <div key={i} style={{ background:'#F9F7F4',borderRadius:8,padding:'12px 14px',marginBottom:8,fontFamily:'monospace',fontSize:12 }}>
                      <div style={{ marginBottom:4 }}><span style={{ color:'#888',fontWeight:700 }}>Input: </span><span style={{ color:'#333' }}>{ex.input}</span></div>
                      <div style={{ marginBottom:4 }}><span style={{ color:'#888',fontWeight:700 }}>Output: </span><span style={{ color:'#D4521A',fontWeight:700 }}>{ex.output}</span></div>
                      {ex.explanation && <div style={{ color:'#888',fontSize:11,marginTop:4 }}>// {ex.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}

              {(problem.constraints||[]).filter(Boolean).length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <h3 style={{ fontSize:13,fontWeight:700,color:'#1A1A1A',marginBottom:8 }}>Constraints</h3>
                  <ul style={{ margin:0,paddingLeft:18 }}>
                    {problem.constraints.filter(Boolean).map((c,i) => (
                      <li key={i} style={{ fontSize:12,color:'#555',marginBottom:4,fontFamily:'monospace' }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ display:'flex',gap:16,paddingTop:10,borderTop:'1px solid #F0EDE6' }}>
                <span style={{ fontSize:11,color:'#AAA' }}>⏱ {problem.time_limit_ms||1000}ms exec</span>
                <span style={{ fontSize:11,color:'#AAA' }}>💾 {problem.memory_limit_mb||256}MB</span>
                {problem.time_limit_mins > 0 && (
                  <span style={{ fontSize:11,color:'#f59e0b',fontWeight:700 }}>⏰ Must solve within {problem.time_limit_mins} min of contest start</span>
                )}
              </div>
            </>
          );
        })()}

        {tab==='submissions' && (
          <div>
            {mySubmissions.length===0 ? (
              <p style={{ color:'#AAA',fontSize:14,textAlign:'center',marginTop:40 }}>No submissions yet for this problem.</p>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {mySubmissions.map((s,i) => (
                  <div key={i} style={{ border:'1.5px solid #E8E4DC',borderRadius:10,padding:'12px 14px' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:13,fontWeight:800,color:VERD_C[s.verdict]||'#888' }}>{s.verdict}</span>
                        {(s.is_late || s.isLate) && (
                          <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'#1f2937',color:'#6b7280' }}>PRACTICE</span>
                        )}
                      </div>
                      <span style={{ fontSize:11,color:'#AAA' }}>{new Date(s.submittedAt||s.submitted_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
                      <span style={{ fontSize:12,color:'#888' }}>{(s.language||'').toUpperCase()}</span>
                      <span style={{ fontSize:12,color:'#888' }}>{s.passed??s.test_cases_passed??0}/{s.total??s.test_cases_total??0} tests</span>
                      {s.score>0 && !(s.is_late||s.isLate) && <span style={{ fontSize:12,color:'#D4521A',fontWeight:700 }}>+{s.score} pts</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// CODE EDITOR — anti-paste, Tab indentation
// ─────────────────────────────────────────────────────────────────────────────
function CodeEditor({ value, onChange, language, theme='dark' }) {
  const codeAreaRef = useRef(null);
  const cmRef = useRef(null);
  const LC  = { python:'#3b82f6', cpp:'#8b5cf6', java:'#f59e0b', javascript:'#eab308' };

  // Load CodeMirror assets dynamically and instantiate
  useEffect(() => {
    let cancelled = false;
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    const loadCSS = (href) => new Promise((res) => {
      if (document.querySelector(`link[href="${href}"]`)) return res();
      const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l); l.onload=res;
    });

    const init = async () => {
      try {
        await loadCSS('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/python/python.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/clike/clike.min.js');
        if (cancelled) return;
        if (window.CodeMirror && codeAreaRef.current && !cmRef.current) {
          cmRef.current = window.CodeMirror.fromTextArea(codeAreaRef.current, {
            lineNumbers: true,
            mode: language === 'python' ? 'python' : language === 'javascript' ? 'javascript' : 'text/x-c++src',
            indentUnit: 4,
            tabSize: 4,
            theme: theme === 'dark' ? 'default' : 'default',
            autofocus: true,
          });
          cmRef.current.on('change', (cm) => onChange(cm.getValue()));
        }
      } catch (e) {
        // ignore — fallback to textarea
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cmRef.current && cmRef.current.getValue() !== value) cmRef.current.setValue(value);
  }, [value]);

  useEffect(() => {
    if (cmRef.current) {
      const mode = language === 'python' ? 'python' : language === 'javascript' ? 'javascript' : 'text/x-c++src';
      try { cmRef.current.setOption('mode', mode); } catch(e){}
    }
  }, [language]);

  return (
    <div style={{ height:'100%',display:'flex',flexDirection:'column' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 14px',background:'#161B22',borderBottom:'1px solid #2A2A3E',flexShrink:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:10,background:(LC[language]||'#888')+'22',color:LC[language]||'#888' }}>{(language||'').toUpperCase()}</span>
          <span style={{ fontSize:11,color:'#E6EDF3' }}>solution.{language==='javascript'?'js':language==='python'?'py':language==='java'?'java':'cpp'}</span>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <span style={{ fontSize:11,color:'#888' }}>Editor</span>
        </div>
      </div>
      {/* textarea fallback — CodeMirror will replace this if available */}
      <textarea ref={codeAreaRef} defaultValue={value} style={{ flex:1, width:'100%', padding:'14px 16px', fontSize:14, lineHeight:1.75, fontFamily:'"Fira Code",monospace' }} />
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD PANEL
// ─────────────────────────────────────────────────────────────────────────────
function LeaderboardPanel({ contestId, userId, tick }) {
  const [board, setBoard] = useState([]);
  const MEDAL = ['🥇','🥈','🥉'];
 
  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await API.get(`/contests/${contestId}/leaderboard`);
        setBoard(r.data?.leaderboard || []);
      } catch {
        setBoard(getLeaderboard(contestId));
      }
    };
    fetch();
  }, [contestId, tick]);
 
  return (
    <div style={{ height:'100%',overflowY:'auto',background:'#0F0F1A' }}>
      <div style={{ padding:'12px 16px',borderBottom:'1px solid #2A2A3E',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <span style={{ fontSize:13,fontWeight:800,color:'#E6EDF3' }}>🏆 Leaderboard</span>
        <span style={{ fontSize:10,color:'#555' }}>live</span>
      </div>
      {board.length===0 ? (
        <div style={{ padding:'32px 16px',textAlign:'center',color:'#555',fontSize:13 }}>Be the first to submit!</div>
      ) : (
        board.map((p,i) => (
          <div key={p.userId||p.username||i} style={{
            display:'flex',alignItems:'center',gap:10,padding:'11px 16px',
            borderBottom:'1px solid #1A1A2E',
            background: (p.userId===userId||p.username===userId)?'#1A1200':'transparent',
          }}>
            <div style={{ width:22,textAlign:'center',fontSize:i<3?16:12,fontWeight:800,color:i<3?'':p.userId===userId?'#D4521A':'#555',flexShrink:0 }}>
              {i<3?MEDAL[i]:i+1}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:12,fontWeight:700,color:p.userId===userId||p.username===userId?'#D4521A':'#E6EDF3',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                {p.username}{(p.userId===userId||p.username===userId)?' (You)':''}
              </div>
              <div style={{ fontSize:10,color:'#555' }}>{p.institution||'—'}</div>
            </div>
            <div style={{ textAlign:'right',flexShrink:0 }}>
              <div style={{ fontSize:13,fontWeight:800,color:'#E6EDF3' }}>{p.total_score??p.score??0}</div>
              <div style={{ fontSize:10,color:'#555' }}>{p.problems_solved??p.solved??0} solved</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// VERDICT PANEL — shows result after run/submit with expandable test cases
// FIX: shows "Partial" verdict correctly, proper field names
// ─────────────────────────────────────────────────────────────────────────────
function VerdictPanel({ result, onClose }) {
  const [expanded, setExpanded] = useState(false);
 
  const VERD_C = {
    Accepted:'#16a34a', 'All Passed':'#16a34a',
    'Wrong Answer':'#dc2626', 'Some Failed':'#dc2626',
    Partial:'#d97706', 'Time Limit Exceeded':'#d97706',
    'Runtime Error':'#dc2626', 'Compilation Error':'#7c3aed',
    Loading:'#888', Note:'#3b82f6',
  };
 
  const color   = VERD_C[result.verdict] || '#888';
  const isOK    = result.verdict === 'Accepted' || result.verdict === 'All Passed';
  const isLoad  = result.verdict === 'Loading';
  const icon    = isLoad ? '⏳' : isOK ? '✅' : result.verdict === 'Partial' ? '🟡' : result.verdict === 'Note' ? 'ℹ️' : '❌';
 
  return (
    <div style={{ position:'absolute',bottom:0,left:0,right:0,background:'#fff',borderTop:`3px solid ${color}`,padding:'12px 18px',zIndex:50,boxShadow:'0 -8px 28px rgba(0,0,0,0.1)' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4,flexWrap:'wrap' }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            <span style={{ fontSize:15,fontWeight:800,color }}>{result.verdict}</span>
            {result.passed!=null && !isLoad && (
              <span style={{ fontSize:13,color:'#888' }}>{result.passed}/{result.total} test cases passed</span>
            )}
            {result.score>0 && !result.runOnly && !result.isLate && (
              <span style={{ fontSize:13,fontWeight:700,color:'#D4521A',background:'#FEF1EB',padding:'2px 10px',borderRadius:20 }}>
                +{result.score} pts
              </span>
            )}
            {result.isLate && (
              <span style={{ fontSize:12,fontWeight:700,color:'#9ca3af',background:'#1f2937',padding:'2px 10px',borderRadius:20 }}>
                Practice — score not counted
              </span>
            )}
          </div>

          {result.verdict==='Loading' && <div style={{ fontSize:13,color:'#888' }}>Running against test cases...</div>}
          {result.verdict==='Note'    && result.message && <div style={{ fontSize:13,color:'#3b82f6' }}>{result.message}</div>}
          {result.timeMs>0 && !isLoad && <div style={{ fontSize:12,color:'#AAA' }}>Execution: {result.timeMs}ms</div>}
 
          {/* For run-only (local Run), show program output prominently */}
          {result.runOnly && (result.details||[]).length > 0 && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:13,fontWeight:700,marginBottom:6 }}>Program Output</div>
              <div style={{ background:'#0f1724', color:'#e6edf3', padding:10, borderRadius:8, fontFamily:'monospace', fontSize:13, whiteSpace:'pre-wrap' }}>
                {(result.details||[]).map((d,i) => (
                  <div key={i} style={{ marginBottom: i === (result.details.length-1) ? 0 : 8 }}>
                    <div style={{ fontSize:11, color:'#94a3b8', marginBottom:4 }}>Test {i+1} Output:</div>
                    <div>{typeof d.got === 'string' ? d.got : JSON.stringify(d.got)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test case breakdown */}
          {(result.details||[]).length>0 && !isLoad && (
            <div style={{ marginTop:8 }}>
              <button onClick={()=>setExpanded(!expanded)} style={{ background:'none',border:'none',color:'#D4521A',fontSize:12,fontWeight:700,cursor:'pointer',padding:0,textDecoration:'underline' }}>
                {expanded?'▼ Hide':'▶ Show'} test cases ({result.details.length})
              </button>
              {expanded && (
                <div style={{ marginTop:8,maxHeight:220,overflowY:'auto',borderLeft:'2px solid #E8E4DC',paddingLeft:10 }}>
                  {result.details.map((d,i) => (
                    <div key={i} style={{ marginBottom:10,paddingBottom:10,borderBottom:'1px solid #F0EDE6',fontSize:12 }}>
                      <div style={{ display:'flex',gap:8,alignItems:'center',marginBottom:4 }}>
                        <span style={{ color:d.pass?'#16a34a':'#dc2626',fontSize:14 }}>{d.pass?'✓':'✗'}</span>
                        <span style={{ fontWeight:700,color:d.pass?'#16a34a':'#dc2626' }}>Test {i+1}</span>
                        {d.error && <span style={{ fontSize:10,background:'#FEE2E2',color:'#991B1B',padding:'2px 6px',borderRadius:4 }}>ERROR</span>}
                      </div>
                      <div style={{ background:'#F9F7F4',padding:8,borderRadius:4,fontFamily:'monospace',fontSize:11,whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#444' }}>
                        <div style={{ display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap' }}>
                                  <div style={{ flex:1, minWidth:160 }}><strong>Input:</strong>
                                    <pre style={{ marginTop:6, color:'#333', background:'transparent', padding:0, margin:0, fontFamily:'monospace', fontSize:12 }}>{prettyPrint(d.input)}</pre>
                                  </div>
                                  <div style={{ flex:1, minWidth:160 }}><strong>Expected:</strong>
                                    <pre style={{ marginTop:6, color:'#16a34a', background:'transparent', padding:0, margin:0, fontFamily:'monospace', fontSize:12 }}>{prettyPrint(d.expected)}</pre>
                                  </div>
                                  <div style={{ flex:1, minWidth:160 }}><strong>Got:</strong>
                                    <pre style={{ marginTop:6, color:d.pass?'#16a34a':'#dc2626', background:'transparent', padding:0, margin:0, fontFamily:'monospace', fontSize:12 }}>{prettyPrint(d.got)}</pre>
                                  </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Detailed log for runtime/server errors */}
          {(result.error || (result.details||[]).some(d=>d.error)) && (
            <div style={{ marginTop:10 }}>
              <button onClick={() => setExpanded(prev=>!prev)} style={{ background:'none',border:'none',color:'#D4521A',fontSize:12,fontWeight:700,cursor:'pointer',padding:0,textDecoration:'underline' }}>
                {expanded ? '▼ Hide' : '▶ Show'} Detailed Log
              </button>
              {expanded && (
                <div style={{ marginTop:8, background:'#111827', color:'#fff', padding:12, borderRadius:8, fontFamily:'monospace', fontSize:12, maxHeight:240, overflowY:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
                    <button onClick={async () => { const log = (result.error ? String(result.error) : '') + '\n' + (result.details||[]).map(d=>d.error?String(d.got):'').join('\n'); await navigator.clipboard.writeText(log); }} style={{ padding:'6px 10px', borderRadius:6, border:'none', background:'#D4521A', color:'#fff', cursor:'pointer' }}>Copy Log</button>
                  </div>
                  <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>{result.error ? String(result.error) : (result.details||[]).map((d,i)=>d.error?`Test ${i+1} error:\n${String(d.got)}`:'').filter(Boolean).join('\n\n')}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888',flexShrink:0,paddingTop:2 }}>✕</button>
      </div>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────────────────
// MAIN CODING ARENA
// ─────────────────────────────────────────────────────────────────────────────
const LANGS = ['python','cpp','java','javascript'];
 
export default function CodingArena() {
  const { contestId } = useParams();
  // FIX: was "const { user, logout } = useNavigate ? ..." — always broke.
  // useNavigate is always defined so that condition was always true → user was null.
  const { user: authUser, logout: authLogout } = useAuth();
  const navigate = useNavigate();
 
  const [contest,      setContest]    = useState(null);
  const [problems,     setProblems]   = useState([]);
  const [probIdx,      setProbIdx]    = useState(0);
  const [leftWidthPx,  setLeftWidthPx] = useState(() => {
    try { const v = localStorage.getItem('arena:leftWidth'); return v ? parseInt(v,10) : Math.floor(window.innerWidth * 0.38); } catch(e){ return Math.floor(window.innerWidth * 0.38); }
  });
  const [participants, setParticipants] = useState([]);
  const [loading,      setLoading]    = useState(true);
  const [notAllowed,   setNotAllowed] = useState(false);
 
  const [lang,       setLang]       = useState('python');
  const [code,       setCode]       = useState('');
  const [theme,      setTheme]      = useState(() => { try { return localStorage.getItem('arena:theme') || 'dark'; } catch(e){ return 'dark'; } });
  const [editorHeight, setEditorHeight] = useState(() => {
    try { const v = localStorage.getItem('arena:editorHeight'); return v ? parseInt(v,10) : null; } catch(e) { return null; }
  }); // pixels, null = fill
  const [running,    setRunning]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdict,    setVerdict]    = useState(null);
  const [lbTick,     setLbTick]     = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [tick,        setTick]        = useState(0); // seconds tick for countdown/status re-check

  // Issue 5: Hint Token state
  const [hintTokens, setHintTokens] = useState(3);
  const [hintModal,  setHintModal]  = useState(null); // { input, expected_output, tc_index, tc_total, message }
  const [hintLoading, setHintLoading] = useState(false);

  // FIX: get userId consistently — API returns 'id', local store uses '_id'
  const userId      = authUser?.id || authUser?._id || '';
  const username    = authUser?.username || '';
  const institution = authUser?.institution || '';

  // ── Load contest + problems (runs once on mount) ──────────────────────────
  useEffect(() => {
    if (!contestId) return;
    const doFetch = async () => {
      setLoading(true);
      setNotAllowed(false);
      try {
        const r = await API.get(`/contests/${contestId}`);
        const c = r.data;
        // API returned data successfully — user is registered
        setContest(c);
        setProblems(c.problems || []);
        // Issue 5: load hint tokens from contest data
        if (typeof c.hint_tokens === 'number') setHintTokens(c.hint_tokens);
      } catch(err) {
        const status = err.response?.status;
        if (status === 403) {
          // Not registered — show not-allowed screen
          setNotAllowed(true);
          setLoading(false);
          return;
        }
        if (status === 404) {
          // Contest doesn't exist
          navigate('/contests');
          return;
        }
        // Network/other error — try local store fallback
        const local = getContest(contestId);
        if (local) {
          setContest(local);
          setProblems(getProblems(local.problem_ids || []));
          if (!isRegistered(contestId, userId)) {
            setNotAllowed(true);
            setLoading(false);
            return;
          }
        } else {
          // Nothing available — go back to contests
          navigate('/contests');
          return;
        }
      }
      // Load lobby participants (non-critical, ignore errors)
      try {
        const r = await API.get(`/contests/${contestId}/lobby`);
        setParticipants(r.data.participants || []);
      } catch { setParticipants([]); }
      setLoading(false);
    };
    doFetch();
  }, [contestId]); // intentionally omit userId — prevents re-fetch loop
 
  // ── Submissions ────────────────────────────────────────────────────────────
  const refreshSubs = useCallback(() => {
    // FIX: also try fetching from API for persistence
    API.get('/submissions/recent').then(r => {
      const all = r.data?.submissions || [];
      // Filter to this contest
      const mine = all.filter(s => s.contest_id === contestId || s.contestId === contestId);
      if (mine.length > 0) {
        setSubmissions(mine);
      } else {
        setSubmissions(getSubmissions({ userId, contestId }));
      }
    }).catch(() => {
      setSubmissions(getSubmissions({ userId, contestId }));
    });
    setLbTick(t => t+1);
  }, [userId, contestId]);
 
  useEffect(() => { if (userId) refreshSubs(); }, [refreshSubs]);
 
  // ── Starter code when problem/lang changes ─────────────────────────────────
  useEffect(() => {
    const prob = problems[probIdx];
    // Try load autosaved code first
    const pid = prob?._id;
    let loaded = null;
    try {
      if (contestId && pid) loaded = localStorage.getItem(`editor:${contestId}:${pid}:${lang}`);
    } catch (e) { loaded = null; }
    if (loaded != null) {
      setCode(loaded);
    } else if (prob?.starter?.[lang]) {
      setCode(prob.starter[lang]);
    } else if (prob) {
      setCode(`# Write your ${lang} solution here\n`);
    }
    setVerdict(null);
  }, [probIdx, lang, problems]);

  // Persist theme and leftWidth
  useEffect(() => { try { localStorage.setItem('arena:theme', theme); } catch(e){} }, [theme]);
  useEffect(() => { try { localStorage.setItem('arena:leftWidth', String(leftWidthPx)); } catch(e){} }, [leftWidthPx]);
  useEffect(() => { try { if (editorHeight==null) localStorage.removeItem('arena:editorHeight'); else localStorage.setItem('arena:editorHeight', String(editorHeight)); } catch(e){} }, [editorHeight]);

  // Autosave editor content per contest/problem/lang
  useEffect(() => {
    const prob = problems[probIdx];
    if (!contestId || !prob?._id) return;
    const key = `editor:${contestId}:${prob._id}:${lang}`;
    try { localStorage.setItem(key, code); } catch(e) {}
  }, [code, contestId, probIdx, lang, problems]);
 
  // ── Tick every second — drives countdown display and upcoming→live transition
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Refresh leaderboard every 30s ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setLbTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);
 
  // ── RUN — Python only via Pyodide ─────────────────────────────────────────
  const handleRun = async () => {
    const prob = problems[probIdx];
    if (!prob) return;
    if (lang !== 'python') {
      setVerdict({ verdict:'Note', score:0, timeMs:0, passed:0, total:0, details:[], runOnly:true,
        message:'Local run is Python-only. C++/Java/JS go through Submit and are evaluated server-side.' });
      return;
    }
    setRunning(true);
    setVerdict({ verdict:'Loading', score:0 });
    try {
      const start   = Date.now();
      const results = await runPythonCode(code, prob.test_cases || []);
      const passed  = results.filter(r => r.pass).length;
      const total   = results.length;
      const timeMs  = Date.now() - start;
      const verdict = passed === total ? 'All Passed' : 'Some Failed';
      setVerdict({ verdict, score:0, passed, total, timeMs, details:results, runOnly:true });
    } catch(e) {
      setVerdict({ verdict:'Runtime Error', score:0, passed:0, total:0, timeMs:0, details:[], error:String(e), runOnly:true });
    }
    setRunning(false);
  };
 
  // ── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const prob = problems[probIdx];
    if (!prob) return;
    setSubmitting(true);
    setVerdict({ verdict:'Loading', score:0 });

    try {
      // Try backend first — it does real evaluation
      const res = await API.post('/submissions/submit', {
        problem_id: prob._id,
        contest_id: contestId,
        code,
        language: lang,
      });
      const d = res.data;
      // Save to local store as backup
      addSubmission({
        userId, problemId: prob._id, contestId,
        language: lang, code,
        verdict: d.verdict, score: d.score,
        passed: d.passed, total: d.total, timeMs: d.execution_time_ms,
      });
      setVerdict({
        verdict: d.verdict, score: d.score, passed: d.passed, total: d.total,
        timeMs: d.execution_time_ms, details: d.test_results || [],
        isLate: d.is_late || false,
      });
    } catch {
      // Fallback: local Pyodide for Python
      if (lang === 'python') {
        try {
          const start   = Date.now();
          const results = await runPythonCode(code, prob.test_cases || []);
          const passed  = results.filter(r => r.pass).length;
          const total   = results.length;
          const timeMs  = Date.now() - start;
          // FIX: proper verdict — Partial if some pass but not all
          const verdict = passed===total ? 'Accepted' : results.some(r=>r.error) ? 'Runtime Error' : passed>0 ? 'Partial' : 'Wrong Answer';
          // FIX: partial score = (passed/total) * points — no arbitrary 0.3 multiplier
          const score   = passed===total ? (prob.points||100) : Math.floor((passed/Math.max(total,1)) * (prob.points||100));
          addSubmission({ userId, problemId:prob._id, contestId, language:lang, code, verdict, score, passed, total, timeMs });
          setVerdict({ verdict, score, passed, total, timeMs, details:results });
        } catch(e) {
          const entry = { userId, problemId:prob._id, contestId, language:lang, code, verdict:'Runtime Error', score:0, passed:0, total:(prob.test_cases||[]).length, timeMs:0 };
          addSubmission(entry);
          setVerdict({ ...entry, details:[], error:String(e) });
        }
      } else {
        // Non-Python without backend: show clear message
        setVerdict({ verdict:'Note', score:0, passed:0, total:0, timeMs:0, details:[], runOnly:true,
          message:`${lang.toUpperCase()} requires the backend server to evaluate. Start Flask (python app.py) and try again.` });
        setSubmitting(false);
        return;
      }
    }

    refreshSubs();
    setSubmitting(false);
  };

  // ── HINT TOKEN (Issue 5) ───────────────────────────────────────────────────
  const handleHint = async () => {
    const prob = problems[probIdx];
    if (!prob) return;
    if (hintTokens <= 0) return;
    setHintLoading(true);
    try {
      const res = await API.post(`/contests/${contestId}/hint`, { problem_id: prob._id });
      const d = res.data;
      setHintTokens(d.tokens_left);
      setHintModal({
        message:         d.message,
        input:           d.input,
        expected_output: d.expected_output,
        tc_index:        d.tc_index,
        tc_total:        d.tc_total,
        tokens_left:     d.tokens_left,
      });
    } catch(err) {
      const msg = err.response?.data?.error || 'Failed to use hint. Try again.';
      setHintModal({ error: msg });
    }
    setHintLoading(false);
  };

  const handleLogout = () => { authLogout(); navigate('/login'); };
 
  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D1117',fontFamily:'"DM Sans",sans-serif',flexDirection:'column',gap:10 }}>
      <div style={{ fontSize:22,fontWeight:900,color:'#D4521A',fontFamily:'Georgia,serif' }}>CONFEST</div>
      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
        <div style={{ width:18,height:18,border:'3px solid #D4521A',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
        <div style={{ fontSize:14,color:'#888' }}>Loading arena...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
 
  if (!contest) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0D1117',fontFamily:'"DM Sans",sans-serif',flexDirection:'column',gap:12 }}>
      <div style={{ fontSize:22,fontWeight:900,color:'#D4521A',fontFamily:'Georgia,serif' }}>CONFEST</div>
      <div style={{ fontSize:14,color:'#888' }}>Contest not found.</div>
      <Link to="/contests" style={{ marginTop:8,color:'#D4521A',fontSize:14,fontWeight:700 }}>← Back to Contests</Link>
    </div>
  );
 
  if (notAllowed) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FAF8F4',fontFamily:'"DM Sans",sans-serif' }}>
      <div style={{ textAlign:'center',maxWidth:380 }}>
        <div style={{ fontSize:40,marginBottom:16 }}>🔒</div>
        <h2 style={{ fontSize:20,fontWeight:800,color:'#1A1A1A',marginBottom:8 }}>Not Registered</h2>
        <p style={{ color:'#888',fontSize:14,marginBottom:24 }}>Register for this contest first before entering the coding arena.</p>
        <Link to="/contests" style={{ padding:'12px 28px',background:'#D4521A',color:'#fff',borderRadius:10,textDecoration:'none',fontSize:14,fontWeight:800 }}>← Back to Contests</Link>
      </div>
    </div>
  );
 
  // Use tick to re-evaluate status every second (upcoming→live auto-transition)
  // Also trust the server's status field if local time calc says upcoming but server says live
  const localStatus = computeStatus(contest);
  const serverStatus = contest.status; // server computes this correctly in UTC
  // If either says live/completed, show arena — don't get stuck in lobby
  const status = (serverStatus === 'live' || localStatus === 'live') ? 'live'
               : (serverStatus === 'completed' || localStatus === 'completed') ? 'completed'
               : 'upcoming';
  const _tickRef = tick; // eslint-disable-line no-unused-vars — keeps tick in scope to trigger re-render
  const problem = problems[probIdx] || null;

  // Show lobby only if truly upcoming by BOTH server and local clock
  if (status === 'upcoming') {
    return <Lobby contest={contest} participants={participants} username={username} />;
  }
 
  return (
    <div style={{ height:'100vh',display:'flex',flexDirection:'column',background:'#0D1117',fontFamily:'"DM Sans","Segoe UI",sans-serif',overflow:'hidden' }}>
      <ArenaNav contest={contest} problems={problems} probIdx={probIdx} onSwitch={i=>{setProbIdx(i);setVerdict(null)}} username={username} onExit={handleLogout} />

      {status==='live'      && <ContestTimer contest={contest} />}
      {/* Issue 4: Completed banner — allow practice submissions, but scores don't count */}
      {status==='completed' && (
        <div style={{ background:'#1f2937',padding:'8px 20px',fontSize:13,color:'#D1D5DB',fontWeight:600,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:12 }}>
          <span>🏁 Contest ended</span>
          <span style={{ color:'#9ca3af',fontWeight:400 }}>— Practice mode: submissions run but don't count to the leaderboard</span>
        </div>
      )}

      {/* Issue 5: Hint Modal */}
      {hintModal && (
        <div style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div style={{ background:'#1C2333',border:'1px solid #2A2A3E',borderRadius:16,padding:'28px 32px',maxWidth:480,width:'90%',fontFamily:'inherit' }}>
            {hintModal.error ? (
              <>
                <div style={{ fontSize:16,fontWeight:800,color:'#ef4444',marginBottom:12 }}>❌ Hint Unavailable</div>
                <div style={{ fontSize:14,color:'#9ca3af',marginBottom:20 }}>{hintModal.error}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize:16,fontWeight:800,color:'#f59e0b',marginBottom:4 }}>💡 Hint Revealed</div>
                <div style={{ fontSize:13,color:'#9ca3af',marginBottom:16 }}>
                  {hintModal.message} · {hintModal.tokens_left} hint{hintModal.tokens_left !== 1 ? 's' : ''} remaining
                </div>
                <div style={{ background:'#0D1117',borderRadius:10,padding:'14px 16px',marginBottom:8 }}>
                  <div style={{ fontSize:12,color:'#6b7280',marginBottom:6,fontWeight:600 }}>
                    Test Case #{(hintModal.tc_index||0)+1} of {hintModal.tc_total}
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11,color:'#4b5563',fontWeight:700,marginBottom:2 }}>INPUT</div>
                    <pre style={{ margin:0,fontSize:13,color:'#e5e7eb',fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-all' }}>{hintModal.input}</pre>
                  </div>
                  <div>
                    <div style={{ fontSize:11,color:'#4b5563',fontWeight:700,marginBottom:2 }}>EXPECTED OUTPUT</div>
                    <pre style={{ margin:0,fontSize:13,color:'#34d399',fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-all' }}>{hintModal.expected_output}</pre>
                  </div>
                </div>
              </>
            )}
            <button onClick={() => setHintModal(null)} style={{ width:'100%',padding:'10px',borderRadius:8,border:'none',background:'#D4521A',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
        {/* LEFT — problem */}
          <div id="left-panel" style={{ width:leftWidthPx, minWidth:280, maxWidth:900, borderRight:'1px solid #2A2A3E',display:'flex',flexDirection:'column',overflow:'hidden' }}>
          {problem ? <ProblemPanel problem={problem} submissions={submissions} />
                   : <div style={{ padding:40,color:'#888',textAlign:'center',fontSize:14 }}>No problems yet.</div>}
        </div>

        {/* Vertical resizer */}
        <div style={{ width:6, cursor:'col-resize', background:'transparent' }}
          onMouseDown={e => {
            const startX = e.clientX;
            const startW = document.getElementById('left-panel')?.clientWidth || leftWidthPx;
            const onMove = ev => {
              const dx = ev.clientX - startX;
              const nw = Math.max(240, Math.min(window.innerWidth - 400, startW + dx));
              setLeftWidthPx(nw);
            };
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />

        {/* MIDDLE — editor */}
        <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative' }}>
          {/* Toolbar */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'#161B22',borderBottom:'1px solid #2A2A3E',flexShrink:0,gap:10 }}>
            <div style={{ display:'flex',gap:4 }}>
              {LANGS.map(l => {
                const LC = { python:'#3b82f6',cpp:'#8b5cf6',java:'#f59e0b',javascript:'#eab308' };
                return (
                  <button key={l} onClick={()=>setLang(l)} style={{ padding:'5px 12px',borderRadius:6,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:lang===l?LC[l]+'33':'transparent',color:lang===l?LC[l]:'#555' }}>
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div style={{ display:'flex',gap:8,alignItems:'center' }}>
              <button onClick={handleRun} disabled={running||submitting} style={{ padding:'6px 14px',borderRadius:7,border:'1px solid #374151',background:'transparent',color:'#9ca3af',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:running?0.6:1 }}>
                {running?'⏳ Running...':'▶ Run'}
              </button>
              {/* Issue 5: Hint Token button — visible during live or completed contests */}
              {hintTokens > 0 && status !== 'upcoming' && (
                <button
                  onClick={handleHint}
                  disabled={hintLoading || running || submitting || !problem}
                  title={`Use a hint token to reveal a hidden test case (${hintTokens} remaining)`}
                  style={{
                    padding:'6px 12px',borderRadius:7,border:'1px solid #f59e0b',
                    background:'#f59e0b18',color:'#f59e0b',fontSize:12,fontWeight:700,
                    cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4,
                    opacity:(hintLoading||!problem)?0.6:1,
                  }}>
                  💡 {hintLoading ? '...' : `Hint (${hintTokens})`}
                </button>
              )}
              {hintTokens === 0 && status !== 'upcoming' && (
                <span style={{ fontSize:11,color:'#4b5563',fontWeight:600 }} title="All hint tokens used">💡 No hints left</span>
              )}
              {/* Issue 4: Submit button enabled in completed mode (practice) */}
              <button onClick={handleSubmit} disabled={running||submitting||!problem} style={{
                padding:'6px 18px',borderRadius:7,border:'none',fontSize:12,fontWeight:800,cursor:'pointer',fontFamily:'inherit',opacity:submitting?0.7:1,
                background:status==='completed'?'#2563eb':'#D4521A',color:'#fff',
              }}>
                {submitting ? '⏳ Submitting...' : status==='completed' ? '🔁 Practice Submit' : 'Submit →'}
              </button>
              <button onClick={() => setTheme(t => t==='dark'?'light':'dark')} style={{ padding:'6px 10px',borderRadius:7,border:'1px solid #374151',background:'transparent',color:'#9ca3af',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                {theme==='dark' ? '🌙 Dark' : '🌤 Light'}
              </button>
            </div>
          </div>
 
          <div style={{ flex:1,overflow:'hidden',display:'flex',flexDirection:'column' }}>
            <div style={{ height:6, cursor:'ns-resize', background:'transparent' }}
              onMouseDown={e => {
                const startY = e.clientY;
                const startH = (document.getElementById('editor-container')?.clientHeight) || 400;
                const onMove = ev => {
                  const dy = ev.clientY - startY;
                  const nh = Math.max(160, startH + dy);
                  setEditorHeight(nh);
                };
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }} />
            <div id="editor-container" style={{ flex: editorHeight? 'none':'1', height: editorHeight? editorHeight:'auto', overflow:'hidden' }}>
              <CodeEditor value={code} onChange={setCode} language={lang} theme={theme} />
            </div>
          </div>
 
          {verdict && <VerdictPanel result={verdict} onClose={()=>setVerdict(null)} />}
        </div>
 
        {/* RIGHT — leaderboard */}
        <div style={{ width:250,borderLeft:'1px solid #2A2A3E',display:'flex',flexDirection:'column',overflow:'hidden' }}>
          <LeaderboardPanel contestId={contestId} userId={userId} tick={lbTick} />
        </div>
      </div>
    </div>
  );
}