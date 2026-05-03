from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from bson import ObjectId
from datetime import datetime, timedelta

contests_bp = Blueprint('contests', __name__)

def init_contests(app, db):
    contests     = db["contests"]
    participants = db["contest_participants"]
    problems_col = db["problems"]
    users        = db["users"]

    def _status(c):
        now      = datetime.utcnow()
        start    = c.get("start_time")
        duration = c.get("duration_mins", 90)
        if not start:
            return c.get("status", "upcoming")
        if isinstance(start, str):
            try:
                start = datetime.fromisoformat(start)
            except Exception:
                return "upcoming"
        end = start + timedelta(minutes=duration)
        if now < start:
            return "upcoming"
        elif now <= end:
            return "live"
        return "completed"

    def _serialize_contest(c):
        start = c.get("start_time")
        return {
            "_id":              str(c["_id"]),
            "title":            c.get("title", ""),
            "description":      c.get("description", ""),
            "difficulty":       c.get("difficulty", "Medium"),
            "status":           _status(c),
            "duration_mins":    c.get("duration_mins", 90),
            "start_time":       start.isoformat() if isinstance(start, datetime) else str(start or ""),
            "tags":             c.get("tags", []),
            "max_participants": c.get("max_participants", 100),
            "created_by":       str(c.get("created_by", "")),
            "problem_ids":      [str(p) for p in c.get("problem_ids", [])],
        }

    # ── GET all contests ───────────────────────────────────────────
    @contests_bp.route('/', methods=['GET'])
    def get_contests():
        all_c = list(contests.find().sort("start_time", 1))
        return jsonify({"contests": [_serialize_contest(c) for c in all_c]}), 200

    # ── GET single contest with problems ───────────────────────────
    @contests_bp.route('/<contest_id>', methods=['GET'])
    @jwt_required()
    def get_contest(contest_id):
        try:
            c = contests.find_one({"_id": ObjectId(contest_id)})
        except Exception:
            return jsonify({"error": "Invalid contest ID"}), 400
        if not c:
            return jsonify({"error": "Contest not found"}), 404

        problem_docs = list(problems_col.find(
            {"_id": {"$in": [ObjectId(pid) for pid in c.get("problem_ids", [])]}}
        ))
        serialized = _serialize_contest(c)
        serialized["problems"] = [{
            "_id":         str(p["_id"]),
            "title":       p.get("title", ""),
            "difficulty":  p.get("difficulty", "Medium"),
            "points":      p.get("points", 100),
            "description": p.get("description", ""),
            "examples":    p.get("examples", []),
            "constraints": p.get("constraints", []),
            "test_cases":  p.get("test_cases", []),
        } for p in problem_docs]
        return jsonify(serialized), 200

    # ── CREATE contest ─────────────────────────────────────────────
    @contests_bp.route('/create', methods=['POST'])
    @jwt_required()
    def create_contest():
        user_id = get_jwt_identity()
        data    = request.get_json()

        required = ['title', 'start_time', 'duration_mins']
        for f in required:
            if not data.get(f):
                return jsonify({"error": f"{f} is required"}), 400

        # Parse start_time
        try:
            start = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        except Exception:
            return jsonify({"error": "Invalid start_time format. Use ISO format."}), 400

        # Create embedded problems
        problem_ids = []
        for prob in data.get("problems", []):
            doc = {
                "title":       prob.get("title", "Problem"),
                "description": prob.get("description", ""),
                "difficulty":  prob.get("difficulty", "Medium"),
                "points":      prob.get("points", 100),
                "examples":    prob.get("examples", []),
                "constraints": prob.get("constraints", []),
                "test_cases":  prob.get("test_cases", []),
                "allowed_languages": prob.get("allowed_languages", ["python", "cpp", "java", "javascript"]),
                "created_at":  datetime.utcnow(),
            }
            res = db["problems"].insert_one(doc)
            problem_ids.append(res.inserted_id)

        contest_doc = {
            "title":            data['title'],
            "description":      data.get("description", ""),
            "difficulty":       data.get("difficulty", "Medium"),
            "start_time":       start,
            "duration_mins":    int(data['duration_mins']),
            "max_participants": int(data.get("max_participants", 100)),
            "tags":             data.get("tags", []),
            "problem_ids":      problem_ids,
            "created_by":       ObjectId(user_id),
            "created_at":       datetime.utcnow(),
        }
        result = contests.insert_one(contest_doc)
        return jsonify({
            "message": "Contest created successfully",
            "contest_id": str(result.inserted_id)
        }), 201

    # ── REGISTER for contest ───────────────────────────────────────
    @contests_bp.route('/<contest_id>/register', methods=['POST'])
    @jwt_required()
    def register_contest(contest_id):
        user_id = get_jwt_identity()
        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid ID"}), 400

        c = contests.find_one({"_id": cid})
        if not c:
            return jsonify({"error": "Contest not found"}), 404
        if _status(c) == "completed":
            return jsonify({"error": "Contest already ended"}), 400

        existing = participants.find_one({"contest_id": cid, "user_id": uid})
        if existing:
            return jsonify({"message": "Already registered"}), 200

        # Check capacity
        count = participants.count_documents({"contest_id": cid})
        if count >= c.get("max_participants", 100):
            return jsonify({"error": "Contest is full"}), 400

        participants.insert_one({
            "contest_id":      cid,
            "user_id":         uid,
            "total_score":     0,
            "problems_solved": 0,
            "rank":            None,
            "joined_at":       datetime.utcnow(),
        })
        users.update_one({"_id": uid}, {"$inc": {"contests_entered": 1}})
        return jsonify({"message": "Registered successfully"}), 201

    # ── LEADERBOARD ────────────────────────────────────────────────
    @contests_bp.route('/<contest_id>/leaderboard', methods=['GET'])
    def get_leaderboard(contest_id):
        try:
            cid = ObjectId(contest_id)
        except Exception:
            return jsonify({"error": "Invalid ID"}), 400

        entries = list(participants.find({"contest_id": cid}).sort("total_score", -1))
        result  = []
        for i, e in enumerate(entries):
            u = users.find_one({"_id": e["user_id"]})
            result.append({
                "rank":            i + 1,
                "username":        u["username"] if u else "Unknown",
                "total_score":     e.get("total_score", 0),
                "problems_solved": e.get("problems_solved", 0),
            })
        return jsonify({"leaderboard": result}), 200

    return contests_bp