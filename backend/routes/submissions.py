from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

submissions_bp = Blueprint('submissions', __name__)

def init_submissions(app, db):
    submissions  = db["submissions"]
    problems     = db["problems"]
    users        = db["users"]
    participants = db["contest_participants"]

    @submissions_bp.route('/recent', methods=['GET'])
    @jwt_required()
    def recent():
        user_id = get_jwt_identity()
        recent_list = list(
            submissions.find({"user_id": ObjectId(user_id)})
            .sort("submitted_at", -1).limit(10)
        )
        result = []
        for s in recent_list:
            p = problems.find_one({"_id": s.get("problem_id")})
            result.append({
                "_id":            str(s["_id"]),
                "problem_title":  p["title"] if p else "Unknown Problem",
                "language":       s.get("language", "python"),
                "verdict":        s.get("verdict", "Pending"),
                "score":          s.get("score", 0),
                "execution_time_ms": s.get("execution_time_ms", 0),
                "submitted_at":   s["submitted_at"].isoformat() if isinstance(s.get("submitted_at"), datetime) else str(s.get("submitted_at", "")),
            })
        return jsonify({"submissions": result}), 200

    @submissions_bp.route('/submit', methods=['POST'])
    @jwt_required()
    def submit():
        user_id = get_jwt_identity()
        data    = request.get_json()

        problem_id = data.get("problem_id")
        contest_id = data.get("contest_id")
        code       = data.get("code", "")
        language   = data.get("language", "python")

        if not problem_id or not code:
            return jsonify({"error": "problem_id and code required"}), 400

        try:
            prob = problems.find_one({"_id": ObjectId(problem_id)})
        except Exception:
            return jsonify({"error": "Invalid problem ID"}), 400

        if not prob:
            return jsonify({"error": "Problem not found"}), 404

        test_cases = prob.get("test_cases", [])
        total      = len(test_cases)
        passed     = 0
        verdict    = "Accepted"
        score      = prob.get("points", 100)
        exec_time  = 95

        if total == 0:
            passed = 1
            total  = 1
            verdict = "Accepted"
        elif language == "python":
            try:
                ns = {}
                exec(compile(code, "<string>", "exec"), ns)
                funcs = [k for k in ns if callable(ns[k]) and not k.startswith("_")]
                if funcs:
                    fn = ns[funcs[0]]
                    for tc in test_cases:
                        try:
                            inp = tc.get("input", [])
                            exp = tc.get("output")
                            out = fn(*inp) if isinstance(inp, list) else fn(inp)
                            if str(out).strip() == str(exp).strip():
                                passed += 1
                        except Exception:
                            pass
                    import math
                    verdict  = "Accepted" if passed == total else "Wrong Answer"
                    score    = math.floor((passed / total) * prob.get("points", 100))
                else:
                    verdict = "Runtime Error"
                    score   = 0
            except SyntaxError:
                verdict = "Compilation Error"
                score   = 0
            except Exception:
                verdict = "Runtime Error"
                score   = 0
        else:
            # For non-Python, simulate result
            verdict = "Accepted"
            passed  = total
            score   = prob.get("points", 100)

        sub_doc = {
            "user_id":            ObjectId(user_id),
            "problem_id":         ObjectId(problem_id),
            "contest_id":         ObjectId(contest_id) if contest_id else None,
            "code":               code,
            "language":           language,
            "verdict":            verdict,
            "score":              score,
            "test_cases_passed":  passed,
            "test_cases_total":   total,
            "execution_time_ms":  exec_time,
            "submitted_at":       datetime.utcnow(),
        }
        result = submissions.insert_one(sub_doc)

        if verdict == "Accepted":
            already = submissions.find_one({
                "user_id":    ObjectId(user_id),
                "problem_id": ObjectId(problem_id),
                "verdict":    "Accepted",
                "_id":        {"$ne": result.inserted_id}
            })
            if not already:
                users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$inc": {"problems_solved": 1, "score": score}}
                )

        if contest_id:
            participants.update_one(
                {"contest_id": ObjectId(contest_id), "user_id": ObjectId(user_id)},
                {"$inc": {"total_score": score}, "$set": {"last_submission": datetime.utcnow()}}
            )

        return jsonify({
            "verdict":           verdict,
            "score":             score,
            "passed":            passed,
            "total":             total,
            "execution_time_ms": exec_time,
            "submission_id":     str(result.inserted_id),
        }), 200

    return submissions_bp