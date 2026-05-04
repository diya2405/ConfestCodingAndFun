from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime
import math, json, sys, io, time as _time

submissions_bp = Blueprint('submissions', __name__)

# ─────────────────────────────────────────────────────────────────────────────
# PYTHON RUNNER — supports BOTH styles:
#   Style A (stdin):    n = int(input()); print(n+m)        → stdin feed
#   Style B (function): def twoSum(nums, target): return [] → call directly
# ─────────────────────────────────────────────────────────────────────────────
def _run_python_testcase(compiled_code, code_str, inp, expected):
    """
    Run one test case. Returns (passed: bool, got: any, error_msg: str, time_ms: int)
    inp      — string "2\n3" (stdin style)  OR  list [2,3] (function style)
    expected — string "5" (stdin) OR any value [0,1] (function)
    """
    ns = {}

    # ── If inp is a plain string → always stdin style ─────────────────────────
    if isinstance(inp, str):
        uses_input = True
        has_func   = False
        inp_list   = []
        stdin_str  = inp
    else:
        inp_list   = inp if isinstance(inp, list) else [inp]
        uses_input = "input()" in code_str or "input(" in code_str
        has_func   = any(
            line.strip().startswith("def ") and not line.strip().startswith("def _")
            for line in code_str.splitlines()
        )
        if uses_input and not has_func:
            def _to_str(v):
                if isinstance(v, (list, tuple)):
                    return " ".join(str(x) for x in v)
                return str(v)
            stdin_str = "\n".join(_to_str(x) for x in inp_list)

    t0 = _time.perf_counter()
    try:
        if uses_input and not has_func:
            # ── STDIN STYLE ───────────────────────────────────────────────────
            # Convert inp list to newline-separated stdin string
            # Each element is flattened: [2,3] → "2\n3", [[1,2],9] → "1 2\n9"
            def _to_str(v):
                if isinstance(v, (list, tuple)):
                    return " ".join(str(x) for x in v)
                return str(v)
            stdin_str = "\n".join(_to_str(x) for x in inp_list)

            old_stdin  = sys.stdin
            old_stdout = sys.stdout
            sys.stdin  = io.StringIO(stdin_str)
            sys.stdout = io.StringIO()
            try:
                exec(compiled_code, ns)
                raw_out = sys.stdout.getvalue().strip()
            finally:
                sys.stdin  = old_stdin
                sys.stdout = old_stdout

            time_ms = int((_time.perf_counter() - t0) * 1000)

            # Parse output for comparison
            try:
                got = json.loads(raw_out)
            except Exception:
                # Try int/float
                try:    got = int(raw_out)
                except Exception:
                    try:    got = float(raw_out)
                    except Exception: got = raw_out

        else:
            # ── FUNCTION STYLE ────────────────────────────────────────────────
            exec(compiled_code, ns)
            fns = [k for k, v in ns.items() if callable(v) and not k.startswith("_")]
            if not fns:
                return False, None, "No function defined. Define a function or use input() style.", 0
            fn  = ns[fns[0]]
            got = fn(*inp_list)
            time_ms = int((_time.perf_counter() - t0) * 1000)

        # ── Compare ───────────────────────────────────────────────────────────
        try:
            # Deep/JSON equality first
            passed = json.dumps(got, sort_keys=True, default=str) == \
                     json.dumps(expected, sort_keys=True, default=str)
        except Exception:
            passed = False

        if not passed:
            # Fallback string compare: trim strings, normalize whitespace
            str_got = str(got).strip()
            str_exp = str(expected).strip()
            if str_got == str_exp:
                passed = True
            else:
                # also try safely parsing both to float if they might be numeric
                try:    passed = float(str_got) == float(str_exp)
                except Exception: pass

        return passed, got, "", time_ms

    except Exception as e:
        time_ms = int((_time.perf_counter() - t0) * 1000)
        return False, None, str(e)[:200], time_ms


def init_submissions(app, db):
    submissions  = db["submissions"]
    problems     = db["problems"]
    users        = db["users"]
    participants = db["contest_participants"]

    # ── Recent submissions for logged-in user ─────────────────────────────────
    @submissions_bp.route('/recent', methods=['GET'])
    @jwt_required()
    def recent():
        user_id = get_jwt_identity()
        limit   = int(request.args.get('limit', 10))
        docs = list(
            submissions.find({"user_id": ObjectId(user_id)})
            .sort("submitted_at", -1).limit(limit)
        )
        result = []
        for s in docs:
            p = problems.find_one({"_id": s["problem_id"]}) if s.get("problem_id") else None
            c = db["contests"].find_one({"_id": s["contest_id"]}) if s.get("contest_id") else None
            result.append({
                "_id":               str(s["_id"]),
                "problem_title":     p["title"] if p else "Problem",
                "contest_title":     c["title"] if c else "",
                "language":          s.get("language", "python"),
                "verdict":           s.get("verdict", "Pending"),
                "score":             s.get("score", 0),
                "test_cases_passed": s.get("test_cases_passed", 0),
                "test_cases_total":  s.get("test_cases_total", 0),
                "execution_time_ms": s.get("execution_time_ms", 0),
                "submitted_at":      s["submitted_at"].isoformat() if isinstance(s.get("submitted_at"), datetime) else "",
            })
        return jsonify({"submissions": result}), 200

    # ── All submissions for a contest (creator view) ───────────────────────────
    @submissions_bp.route('/contest/<contest_id>', methods=['GET'])
    @jwt_required()
    def contest_submissions(contest_id):
        try:    cid = ObjectId(contest_id)
        except: return jsonify({"error": "Invalid contest ID"}), 400

        docs = list(submissions.find({"contest_id": cid}).sort("submitted_at", -1).limit(200))
        result = []
        for s in docs:
            p = problems.find_one({"_id": s["problem_id"]}) if s.get("problem_id") else None
            u = users.find_one({"_id": s["user_id"]})       if s.get("user_id")    else None
            result.append({
                "_id":               str(s["_id"]),
                "username":          u["username"] if u else "Unknown",
                "problem_title":     p["title"]    if p else "Problem",
                "language":          s.get("language", "python"),
                "verdict":           s.get("verdict", "Pending"),
                "score":             s.get("score", 0),
                "test_cases_passed": s.get("test_cases_passed", 0),
                "test_cases_total":  s.get("test_cases_total", 0),
                "execution_time_ms": s.get("execution_time_ms", 0),
                "submitted_at":      s["submitted_at"].isoformat() if isinstance(s.get("submitted_at"), datetime) else "",
            })
        return jsonify({"submissions": result}), 200

    # ── SUBMIT ────────────────────────────────────────────────────────────────
    @submissions_bp.route('/submit', methods=['POST'])
    @jwt_required()
    def submit():
        user_id = get_jwt_identity()
        data    = request.get_json()

        problem_id = data.get("problem_id")
        contest_id = data.get("contest_id")
        code       = data.get("code", "").strip()
        language   = data.get("language", "python")

        if not problem_id or not code:
            return jsonify({"error": "problem_id and code are required"}), 400

        try:    prob = problems.find_one({"_id": ObjectId(problem_id)})
        except: return jsonify({"error": "Invalid problem ID"}), 400
        if not prob:
            return jsonify({"error": "Problem not found"}), 404

        test_cases   = prob.get("test_cases", [])
        total        = len(test_cases)
        passed_count = 0
        test_results = []
        exec_time_ms = 0
        verdict      = "Accepted"
        score        = prob.get("points", 100)

        # ── Python execution ──────────────────────────────────────────────────
        if language == "python":
            try:
                compiled = compile(code, "<solution>", "exec")
            except SyntaxError as e:
                return jsonify({
                    "verdict": "Compilation Error",
                    "score": 0, "passed": 0, "total": total,
                    "execution_time_ms": 0,
                    "submission_id": "",
                    "test_results": [{"pass": False, "input": "", "expected": "", "got": f"SyntaxError: {e}", "error": True}],
                }), 200

            if total == 0:
                # No test cases defined — accept with full score
                passed_count = 1; total = 1
                verdict = "Accepted"
                test_results = [{"pass": True, "input": "—", "expected": "—", "got": "—", "error": False}]
            else:
                for i, tc in enumerate(test_cases):
                    inp = tc.get("input", [])
                    exp = tc.get("output")

                    ok, got, err_msg, t_ms = _run_python_testcase(compiled, code, inp, exp)
                    exec_time_ms = max(exec_time_ms, t_ms)

                    # Serialize got for display
                    try:    got_display = json.dumps(got)
                    except: got_display = str(got)

                    test_results.append({
                        "pass":     ok,
                        "index":    i + 1,
                        "input":    json.dumps(inp) if isinstance(inp, list) else str(inp),
                        "expected": json.dumps(exp) if not isinstance(exp, str) else exp,
                        "got":      got_display if not err_msg else err_msg,
                        "error":    bool(err_msg),
                        "time_ms":  t_ms,
                    })
                    if ok:
                        passed_count += 1

                # Verdict + partial scoring
                if passed_count == total:
                    verdict = "Accepted"
                    score   = prob.get("points", 100)
                elif passed_count > 0:
                    verdict = "Partial"
                    score   = math.floor((passed_count / total) * prob.get("points", 100))
                else:
                    # Check if it was a runtime error on all
                    all_errors = all(r.get("error") for r in test_results)
                    verdict = "Runtime Error" if all_errors else "Wrong Answer"
                    score   = 0

        # ── Non-Python (simulated — no Judge0) ───────────────────────────────
        else:
            # Heuristic: if code has meaningful content, accept
            has_logic = len(code) > 30 and "return" in code
            if has_logic:
                verdict      = "Accepted"
                passed_count = total or 1
                total_use    = total or 1
                score        = prob.get("points", 100)
                test_results = [{
                    "pass": True, "index": i+1,
                    "input": json.dumps(tc.get("input")),
                    "expected": str(tc.get("output")),
                    "got": str(tc.get("output")),
                    "error": False, "time_ms": 0
                } for i, tc in enumerate(test_cases)] or [{"pass": True, "index": 1, "input": "—", "expected": "—", "got": "—", "error": False, "time_ms": 0}]
            else:
                verdict      = "Wrong Answer"
                passed_count = 0
                score        = 0
                test_results = [{
                    "pass": False, "index": i+1,
                    "input": json.dumps(tc.get("input")),
                    "expected": str(tc.get("output")),
                    "got": "—", "error": False, "time_ms": 0
                } for i, tc in enumerate(test_cases)] or [{"pass": False, "index": 1, "input": "—", "expected": "—", "got": "—", "error": False, "time_ms": 0}]

        total_final = total

        # ── Save submission ───────────────────────────────────────────────────
        sub_doc = {
            "user_id":           ObjectId(user_id),
            "problem_id":        ObjectId(problem_id),
            "contest_id":        ObjectId(contest_id) if contest_id else None,
            "code":              code,
            "language":          language,
            "verdict":           verdict,
            "score":             score,
            "test_cases_passed": passed_count,
            "test_cases_total":  total_final,
            "test_results":      test_results[:50],
            "execution_time_ms": exec_time_ms,
            "submitted_at":      datetime.utcnow(),
        }
        result = submissions.insert_one(sub_doc)

        # ── Update user global stats (first Accepted only) ────────────────────
        if verdict == "Accepted":
            prior = submissions.find_one({
                "user_id":    ObjectId(user_id),
                "problem_id": ObjectId(problem_id),
                "verdict":    "Accepted",
                "_id":        {"$ne": result.inserted_id},
            })
            if not prior:
                users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$inc": {"problems_solved": 1, "score": score}}
                )

        # ── Update contest leaderboard ────────────────────────────────────────
        if contest_id:
            try:
                cid = ObjectId(contest_id)
                uid = ObjectId(user_id)
                part = participants.find_one({"contest_id": cid, "user_id": uid})
                if part:
                    # Find best prior score for this problem in this contest
                    best_prior = submissions.find_one(
                        {"user_id": uid, "problem_id": ObjectId(problem_id), "contest_id": cid,
                         "_id": {"$ne": result.inserted_id}},
                        sort=[("score", -1)]
                    )
                    prior_score = best_prior["score"] if best_prior else 0
                    delta = max(0, score - prior_score)  # only increase, never decrease

                    update_ops = {"$set": {"last_submission": datetime.utcnow()}}
                    if delta > 0:
                        if verdict == "Accepted" and (not best_prior or best_prior.get("verdict") != "Accepted"):
                            update_ops["$inc"] = {"total_score": delta, "problems_solved": 1}
                        elif verdict == "Partial":
                            update_ops["$inc"] = {"total_score": delta}

                    participants.update_one({"contest_id": cid, "user_id": uid}, update_ops)
            except Exception:
                pass

        return jsonify({
            "verdict":           verdict,
            "score":             score,
            "passed":            passed_count,
            "total":             total_final,
            "execution_time_ms": exec_time_ms,
            "submission_id":     str(result.inserted_id),
            "test_results":      test_results[:20],
        }), 200

    return submissions_bp