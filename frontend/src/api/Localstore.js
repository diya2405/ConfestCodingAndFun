// ─────────────────────────────────────────────────────────────────────────────
// localStore.js — Central data layer for Confest
// Works 100% locally via localStorage when Flask backend is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'confest_v3';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || _seed(); }
  catch { return _seed(); }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

function _seed() {
  const s = {
    contests: [
      {
        _id: 'c1', title: 'Weekly Coding Blitz #12',
        description: 'Fast-paced 90-min contest — arrays, strings, DP. Compete live and climb the real-time leaderboard.',
        difficulty: 'Medium', duration_mins: 90,
        start_time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        max_participants: 150, tags: ['Arrays', 'DP', 'Strings'],
        problem_ids: ['p1', 'p2', 'p3'], created_by: 'system',
        access_key: null, access_type: 'public',
        prize: 'Certificate + 500 pts bonus', registered_users: [],
      },
      {
        _id: 'c2', title: 'CHARUSAT Intramural Cup',
        description: 'University-level 2-hour championship. Graphs, trees, advanced DP. Private access only.',
        difficulty: 'Hard', duration_mins: 120,
        start_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        max_participants: 80, tags: ['Graphs', 'Trees', 'Math'],
        problem_ids: ['p1', 'p2'], created_by: 'system',
        access_key: 'CHARUSAT2025', access_type: 'private',
        prize: 'Trophy + 1000 pts', registered_users: [],
      },
      {
        _id: 'c3', title: 'Beginner Friendly Blitz',
        description: '60-min easy contest — no experience needed. Build confidence, solve your first real problems.',
        difficulty: 'Easy', duration_mins: 60,
        start_time: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        max_participants: 200, tags: ['Strings', 'Basics'],
        problem_ids: ['p1'], created_by: 'system',
        access_key: null, access_type: 'public',
        prize: '200 pts bonus', registered_users: [],
      },
    ],
    problems: {
      p1: {
        _id: 'p1', title: 'Two Sum', difficulty: 'Easy', points: 100,
        time_limit_ms: 1000, memory_limit_mb: 256,
        description: 'Given an array of integers `nums` and an integer `target`, return **indices** of the two numbers such that they add up to `target`.\n\nYou may assume each input has exactly one solution. You may not use the same element twice.',
        examples: [
          { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 9' },
          { input: 'nums = [3,2,4], target = 6',     output: '[1,2]', explanation: 'nums[1] + nums[2] = 6' },
        ],
        constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i] ≤ 10⁹', 'Exactly one valid answer exists'],
        test_cases: [
          { input: [[2,7,11,15], 9], output: [0,1] },
          { input: [[3,2,4], 6],     output: [1,2] },
          { input: [[3,3], 6],       output: [0,1] },
        ],
        starter: {
          python:     'def twoSum(nums, target):\n    # Your solution here\n    pass\n',
          cpp:        '#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Your solution here\n    return {};\n}\n',
          java:       'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your solution here\n        return new int[]{};\n    }\n}\n',
          javascript: 'function twoSum(nums, target) {\n    // Your solution here\n}\n',
        },
      },
      p2: {
        _id: 'p2', title: 'Longest Substring Without Repeating', difficulty: 'Medium', points: 200,
        time_limit_ms: 1000, memory_limit_mb: 256,
        description: 'Given a string `s`, find the length of the **longest substring** without repeating characters.',
        examples: [
          { input: 's = "abcabcbb"', output: '3', explanation: '"abc" has length 3' },
          { input: 's = "bbbbb"',    output: '1', explanation: '"b" is longest' },
        ],
        constraints: ['0 ≤ s.length ≤ 5×10⁴', 's has English letters, digits, symbols and spaces'],
        test_cases: [
          { input: ['abcabcbb'], output: 3 },
          { input: ['bbbbb'],    output: 1 },
          { input: ['pwwkew'],   output: 3 },
        ],
        starter: {
          python:     'def lengthOfLongestSubstring(s):\n    # Your solution here\n    pass\n',
          cpp:        '#include <string>\nusing namespace std;\nint lengthOfLongestSubstring(string s) {\n    // Your solution here\n    return 0;\n}\n',
          java:       'class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Your solution here\n        return 0;\n    }\n}\n',
          javascript: 'function lengthOfLongestSubstring(s) {\n    // Your solution here\n}\n',
        },
      },
      p3: {
        _id: 'p3', title: 'Maximum Subarray', difficulty: 'Medium', points: 200,
        time_limit_ms: 1000, memory_limit_mb: 256,
        description: 'Given an integer array `nums`, find the subarray with the **largest sum** and return its sum.',
        examples: [
          { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: '[4,-1,2,1] = 6' },
          { input: 'nums = [5,4,-1,7,8]',             output: '23', explanation: 'Entire array' },
        ],
        constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
        test_cases: [
          { input: [[-2,1,-3,4,-1,2,1,-5,4]], output: 6  },
          { input: [[1]],                     output: 1  },
          { input: [[5,4,-1,7,8]],            output: 23 },
        ],
        starter: {
          python:     'def maxSubArray(nums):\n    # Your solution here\n    pass\n',
          cpp:        '#include <vector>\nusing namespace std;\nint maxSubArray(vector<int>& nums) {\n    // Your solution here\n    return 0;\n}\n',
          java:       'class Solution {\n    public int maxSubArray(int[] nums) {\n        // Your solution here\n        return 0;\n    }\n}\n',
          javascript: 'function maxSubArray(nums) {\n    // Your solution here\n}\n',
        },
      },
    },
    submissions: [],
    participants: [],
    users: {},
    activeUserId: null,
  };
  save(s);
  return s;
}

// ── Status ───────────────────────────────────────────────────────────────────
export function computeStatus(c) {
  const start = new Date(c.start_time).getTime();
  const end   = start + c.duration_mins * 60 * 1000;
  const now   = Date.now();
  if (now < start) return 'upcoming';
  if (now <= end)  return 'live';
  return 'completed';
}

export function getTimeLeft(c) {
  const start = new Date(c.start_time).getTime();
  const end   = start + c.duration_mins * 60 * 1000;
  const left  = Math.max(0, end - Date.now());
  return { left, pct: Math.max(0, (left / (c.duration_mins*60000)) * 100), mins: Math.floor(left/60000), secs: Math.floor((left%60000)/1000) };
}

// ── Contests ─────────────────────────────────────────────────────────────────
export function getContests()    { return load().contests; }
export function getContest(id)   { return load().contests.find(c => c._id === id) || null; }

export function createContest(data, userId, username) {
  const s = load();
  const id = 'c_' + Date.now();
  const problemIds = (data.problems || []).map((p, i) => {
    const pid = 'p_' + Date.now() + '_' + i;
    s.problems[pid] = {
      _id: pid, title: p.title, description: p.description,
      difficulty: p.difficulty || 'Medium', points: Number(p.points) || 100,
      examples: p.examples || [], constraints: p.constraints || [],
      test_cases: p.test_cases || [],
      starter: {
        python: `def solution():\n    # Write your solution here\n    pass\n`,
        cpp:    `#include <bits/stdc++.h>\nusing namespace std;\n\n// Write your solution here\n`,
        java:   `class Solution {\n    // Write your solution here\n}\n`,
        javascript: `function solution() {\n    // Write your solution here\n}\n`,
      },
    };
    return pid;
  });
  s.contests.unshift({
    _id: id, title: data.title, description: data.description || '',
    difficulty: data.difficulty || 'Medium', duration_mins: Number(data.duration_mins) || 90,
    start_time: data.start_time, max_participants: Number(data.max_participants) || 100,
    tags: data.tags || [], problem_ids: problemIds,
    created_by: userId, created_by_name: username,
    access_key: data.access_type === 'private' ? (data.access_key || '').toUpperCase() : null,
    access_type: data.access_type || 'public',
    prize: data.prize || '', registered_users: [],
  });
  save(s);
  return id;
}

export function joinContest(contestId, userId, username, institution, accessKey) {
  const s = load();
  const contest = s.contests.find(c => c._id === contestId);
  if (!contest) return { ok: false, error: 'Contest not found' };
  if (contest.access_type === 'private' && contest.access_key) {
    if ((accessKey || '').trim().toUpperCase() !== contest.access_key.toUpperCase())
      return { ok: false, error: 'Invalid access key. Contact the contest organizer.' };
  }
  if ((contest.registered_users || []).includes(userId)) return { ok: true, already: true };
  if ((contest.registered_users || []).length >= contest.max_participants)
    return { ok: false, error: 'Contest is full.' };
  contest.registered_users = [...(contest.registered_users || []), userId];
  if (!s.participants.find(p => p.contestId === contestId && p.userId === userId)) {
    s.participants.push({ contestId, userId, username, institution: institution || '', score: 0, solved: 0, joinedAt: new Date().toISOString() });
  }
  s.users[userId] = { ...(s.users[userId] || {}), username, institution };
  save(s);
  return { ok: true };
}

export function isRegistered(contestId, userId) {
  const c = load().contests.find(c => c._id === contestId);
  return c ? (c.registered_users || []).includes(userId) : false;
}

export function getProblems(ids)  { const p = load().problems; return ids.map(id => p[id]).filter(Boolean); }
export function getProblem(id)    { return load().problems[id] || null; }

// ── Leaderboard ──────────────────────────────────────────────────────────────
export function getLeaderboard(contestId) {
  return [...load().participants.filter(p => p.contestId === contestId)]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

// ── Submissions ──────────────────────────────────────────────────────────────
export function addSubmission(sub) {
  const s = load();
  const entry = { ...sub, id: 's_' + Date.now(), submittedAt: new Date().toISOString() };
  s.submissions.unshift(entry);
  if (sub.verdict === 'Accepted' && sub.contestId) {
    const p = s.participants.find(p => p.contestId === sub.contestId && p.userId === sub.userId);
    if (p) {
      const alreadySolved = s.submissions.some(ss =>
        ss.id !== entry.id && ss.userId === sub.userId &&
        ss.problemId === sub.problemId && ss.contestId === sub.contestId && ss.verdict === 'Accepted'
      );
      if (!alreadySolved) { p.score += sub.score; p.solved += 1; }
    }
  }
  save(s);
  return entry;
}

export function getSubmissions(filters = {}) {
  const s = load();
  return s.submissions
    .filter(sub =>
      (!filters.userId    || sub.userId    === filters.userId)    &&
      (!filters.contestId || sub.contestId === filters.contestId) &&
      (!filters.problemId || sub.problemId === filters.problemId)
    )
    .map(sub => ({
      ...sub,
      problem_title: s.problems[sub.problemId]?.title || 'Problem',
      contest_title: (s.contests.find(c => c._id === sub.contestId)?.title) || 'Practice',
    }));
}

// ── User ─────────────────────────────────────────────────────────────────────
export function setActiveUser(userId, data) {
  const s = load(); s.activeUserId = userId;
  s.users[userId] = { ...(s.users[userId] || {}), ...data };
  save(s);
}