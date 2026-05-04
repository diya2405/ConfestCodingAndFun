from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import secrets, string

contests_bp = Blueprint('contests', __name__)

def _generate_key(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def _status(c):
    now = datetime.now(timezone.utc)
    start = c.get("start_time")
    if not start:
        return "upcoming"

    # Parse if stored as string
    if isinstance(start, str):
        s = start
        # normalize Z -> +00:00
        if s.endswith('Z'):
            s = s[:-1] + '+00:00'
        try:
            start = datetime.fromisoformat(s)
        except:
            return "upcoming"

    # Now ensure start is timezone-aware UTC for comparison
    if isinstance(start, datetime):
        if start.tzinfo is None:
            # assume stored naive datetime is UTC
            start = start.replace(tzinfo=timezone.utc)
        else:
            start = start.astimezone(timezone.utc)

    end = start + timedelta(minutes=int(c.get("duration_mins", 90)))
    if now < start: return "upcoming"
    if now <= end: return "live"
    return "completed"

def _serialize(c, db, user_id=None):
    start = c.get("start_time")
    participants = db["contest_participants"]
    count = participants.count_documents({"contest_id": c["_id"]})
    registered = False
    if user_id:
        registered = bool(participants.find_one({
            "contest_id": c["_id"],
            "user_id": ObjectId(user_id)
        }))
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
        "access_type":      c.get("access_type", "public"),
        "prize":            c.get("prize", ""),
        "problem_ids":      [str(p) for p in c.get("problem_ids", [])],
        "created_by":       str(c.get("created_by", "")),
        "created_by_name":  c.get("created_by_name", ""),
        "participant_count": count,
        "registered":       registered,
        # Never expose access_key in list view
    }

def init_contests(app, db):
    contests     = db["contests"]
    participants = db["contest_participants"]
    problems_col = db["problems"]
    users        = db["users"]
    submissions  = db["submissions"]

    # ── GET all contests ───────────────────────────────────────────────────
    @contests_bp.route('/', methods=['GET'])
    @jwt_required()
    def get_contests():
        user_id = get_jwt_identity()
        all_c = list(contests.find().sort("start_time", 1))
        return jsonify({
            "contests": [_serialize(c, db, user_id) for c in all_c]
        }), 200

    # ── CREATE contest ─────────────────────────────────────────────────────
    @contests_bp.route('/create', methods=['POST'])
    @jwt_required()
    def create_contest():
        user_id = get_jwt_identity()
        data    = request.get_json()
        user    = users.find_one({"_id": ObjectId(user_id)})

        if not data.get("title"):
            return jsonify({"error": "Title is required"}), 400
        if not data.get("start_time"):
            return jsonify({"error": "Start time is required"}), 400
        if not data.get("duration_mins"):
            return jsonify({"error": "Duration is required"}), 400

        try:
            raw = data["start_time"]
            # Normalize Z suffix
            if raw.endswith('Z'):
                raw = raw[:-1] + '+00:00'
            start = datetime.fromisoformat(raw)
            # Make timezone-aware UTC
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            else:
                start = start.astimezone(timezone.utc)
        except Exception as e:
            return jsonify({"error": f"Invalid start_time format: {e}"}), 400

        # Handle access key
        access_type = data.get("access_type", "public")
        if access_type == "private":
            access_key = (data.get("access_key") or _generate_key()).upper().strip()
        else:
            access_key = None

        # If a contest with same title + creator + start_time already exists, return it (idempotent)
        try:
            existing = contests.find_one({
                "created_by": ObjectId(user_id),
                "title": data.get("title"),
                "start_time": start,
            })
        except Exception:
            existing = None
        if existing:
            return jsonify({
                "message": "Contest already exists",
                "contest_id": str(existing["_id"]),
                "access_key": existing.get("access_key"),
            }), 200

        # Create problems
        problem_ids = []
        for prob in data.get("problems", []):
            doc = {
                "title":       prob.get("title", "Problem"),
                "description": prob.get("description", ""),
                "difficulty":  prob.get("difficulty", "Medium"),
                "points":      int(prob.get("points", 100)),
                "examples":    prob.get("examples", []),
                "constraints": prob.get("constraints", []),
                "test_cases":  prob.get("test_cases", []),
                "starter": {
                    "python":     "def solution():\n    # Write your solution here\n    pass\n",
                    "cpp":        "#include <bits/stdc++.h>\nusing namespace std;\n\n// Write your solution here\n",
                    "java":       "class Solution {\n    // Write your solution here\n}\n",
                    "javascript": "function solution() {\n    // Write your solution here\n}\n",
                },
                "time_limit_ms":    int(prob.get("time_limit_ms", 1000)),
                "memory_limit_mb":  int(prob.get("memory_limit_mb", 256)),
                # Issue 2: per-problem time limit in minutes (0 = no individual limit)
                "time_limit_mins":  int(prob.get("time_limit_mins", 0)) if prob.get("time_limit_mins") else 0,
                "created_at": datetime.utcnow(),
            }
            res = problems_col.insert_one(doc)
            problem_ids.append(res.inserted_id)

        contest_doc = {
            "title":            data["title"],
            "description":      data.get("description", ""),
            "difficulty":       data.get("difficulty", "Medium"),
            "start_time":       start,
            "duration_mins":    int(data["duration_mins"]),
            "max_participants": int(data.get("max_participants", 100)),
            "tags":             data.get("tags", []),
            "problem_ids":      problem_ids,
            "access_type":      access_type,
            "access_key":       access_key,
            "prize":            data.get("prize", ""),
            "created_by":       ObjectId(user_id),
            "created_by_name":  user["username"] if user else "Unknown",
            "created_at":       datetime.utcnow(),
        }
        result = contests.insert_one(contest_doc)

        return jsonify({
            "message":    "Contest created successfully",
            "contest_id": str(result.inserted_id),
            "access_key": access_key,
        }), 201

    # ── JOIN contest with access key ───────────────────────────────────────
    @contests_bp.route('/<contest_id>/join', methods=['POST'])
    @jwt_required()
    def join_contest(contest_id):
        user_id = get_jwt_identity()
        data    = request.get_json() or {}

        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        status = _status(contest)
        if status == "completed":
            return jsonify({"error": "Contest has already ended"}), 400

        # Validate access key for private contests
        if contest.get("access_type") == "private":
            provided_key = (data.get("access_key") or "").strip().upper()
            if not provided_key:
                return jsonify({"error": "This is a private contest. Enter the access key."}), 403
            if provided_key != (contest.get("access_key") or "").upper():
                return jsonify({"error": "Invalid access key. Contact the contest organizer."}), 403

        # Check if already registered
        existing = participants.find_one({"contest_id": cid, "user_id": uid})
        if existing:
            return jsonify({
                "message":  "Already registered",
                "already":  True,
                "status":   status,
            }), 200

        # Check capacity
        count = participants.count_documents({"contest_id": cid})
        if count >= contest.get("max_participants", 100):
            return jsonify({"error": "Contest is full"}), 400

        user = users.find_one({"_id": uid})
        try:
            result = participants.insert_one({
                "contest_id":      cid,
                "user_id":         uid,
                "username":        user["username"] if user else "Unknown",
                "institution":     user.get("institution", "") if user else "",
                "total_score":     0,
                "problems_solved": 0,
                "rank":            None,
                "joined_at":       datetime.utcnow(),
                "last_submission": None,
                # Issue 5: Hint Tokens — each participant starts with 3
                "hint_tokens":     3,
                "hints_used":      [],
            })
        except Exception as e:
            return jsonify({"error": f"Failed to register: {str(e)}"}), 500
        
        try:
            users.update_one({"_id": uid}, {"$inc": {"contests_entered": 1}})
        except Exception as e:
            pass

        return jsonify({
            "message": "Registered successfully",
            "status":  status,
        }), 201

    # ── GET single contest (with problems, for arena) ──────────────────────
    @contests_bp.route('/<contest_id>', methods=['GET'])
    @jwt_required()
    def get_contest(contest_id):
        user_id = get_jwt_identity()
        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        # Check if user is registered OR is the creator (creator can always enter)
        contest_obj = contests.find_one({"_id": cid})
        is_creator = contest_obj and contest_obj.get("created_by") == uid
        reg = participants.find_one({"contest_id": cid, "user_id": uid})
        if not reg and not is_creator:
            return jsonify({"error": "Not registered for this contest", "registered": False}), 403

        prob_docs = list(problems_col.find(
            {"_id": {"$in": contest.get("problem_ids", [])}}
        ))

        serialized = _serialize(contest, db, user_id)
        serialized["problems"] = [{
            "_id":          str(p["_id"]),
            "title":        p.get("title", ""),
            "difficulty":   p.get("difficulty", "Medium"),
            "points":       p.get("points", 100),
            "description":  p.get("description", ""),
            "examples":     p.get("examples", []),
            "constraints":  p.get("constraints", []),
            "test_cases":   p.get("test_cases", []),
            "starter":      p.get("starter", {}),
            "time_limit_ms":    p.get("time_limit_ms", 1000),
            "memory_limit_mb":  p.get("memory_limit_mb", 256),
            "time_limit_mins":  p.get("time_limit_mins", 0),
        } for p in prob_docs]
        serialized["registered"] = True
        # Issue 5: include participant's remaining hint tokens
        if reg:
            serialized["hint_tokens"] = reg.get("hint_tokens", 3)
            serialized["hints_used"]  = reg.get("hints_used", [])
        elif is_creator:
            serialized["hint_tokens"] = 0  # creators don't participate
            serialized["hints_used"]  = []
        return jsonify(serialized), 200

    # ── WAITING LOBBY — participants in a contest ──────────────────────────
    @contests_bp.route('/<contest_id>/lobby', methods=['GET'])
    @jwt_required()
    def lobby(contest_id):
        try:
            cid = ObjectId(contest_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        entries = list(participants.find({"contest_id": cid}).sort("joined_at", 1))
        return jsonify({
            "status":          _status(contest),
            "start_time":      contest["start_time"].isoformat() if isinstance(contest.get("start_time"), datetime) else "",
            "duration_mins":   contest.get("duration_mins", 90),
            "title":           contest.get("title", ""),
            "participant_count": len(entries),
            "max_participants": contest.get("max_participants", 100),
            "participants": [{
                "username":    e.get("username", ""),
                "institution": e.get("institution", ""),
                "joined_at":   e["joined_at"].isoformat() if isinstance(e.get("joined_at"), datetime) else "",
            } for e in entries]
        }), 200

    # ── LEADERBOARD for one contest ────────────────────────────────────────
    @contests_bp.route('/<contest_id>/leaderboard', methods=['GET'])
    def get_leaderboard(contest_id):
        try:
            cid = ObjectId(contest_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400

        entries = list(participants.find({"contest_id": cid}).sort("total_score", -1))
        return jsonify({
            "leaderboard": [{
                "rank":            i + 1,
                "username":        e.get("username", ""),
                "institution":     e.get("institution", ""),
                "total_score":     e.get("total_score", 0),
                "problems_solved": e.get("problems_solved", 0),
                "last_submission": e["last_submission"].isoformat() if isinstance(e.get("last_submission"), datetime) else None,
            } for i, e in enumerate(entries)]
        }), 200

    # ── OVERALL leaderboard (across all contests) ──────────────────────────
    @contests_bp.route('/leaderboard/overall', methods=['GET'])
    def overall_leaderboard():
        top_users = list(users.find(
            {"score": {"$gt": 0}},
            {"username": 1, "score": 1, "problems_solved": 1, "contests_entered": 1, "institution": 1}
        ).sort("score", -1).limit(50))

        return jsonify({
            "leaderboard": [{
                "rank":             i + 1,
                "username":         u.get("username", ""),
                "institution":      u.get("institution", ""),
                "score":            u.get("score", 0),
                "problems_solved":  u.get("problems_solved", 0),
                "contests_entered": u.get("contests_entered", 0),
            } for i, u in enumerate(top_users)]
        }), 200

    # ── HINT TOKEN — Issue 5 ───────────────────────────────────────────────
    # POST /contests/<contest_id>/hint
    # Body: { problem_id: "..." }
    # Reveals one hidden test case for the problem. Costs 1 hint token.
    @contests_bp.route('/<contest_id>/hint', methods=['POST'])
    @jwt_required()
    def use_hint(contest_id):
        user_id = get_jwt_identity()
        data    = request.get_json() or {}

        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        # Only available during live contests (and let completed ones use too for review)
        problem_id = data.get("problem_id")
        if not problem_id:
            return jsonify({"error": "problem_id is required"}), 400

        try:
            pid = ObjectId(problem_id)
        except Exception:
            return jsonify({"error": "Invalid problem_id"}), 400

        # Find participant record
        part = participants.find_one({"contest_id": cid, "user_id": uid})
        if not part:
            return jsonify({"error": "You are not registered for this contest"}), 403

        tokens_left = part.get("hint_tokens", 3)
        if tokens_left <= 0:
            return jsonify({"error": "No hint tokens remaining. You have used all 3 hints for this contest."}), 400

        # Check if a hint for this problem was already used
        hints_used = part.get("hints_used", [])
        used_for_prob = [h for h in hints_used if h.get("problem_id") == str(pid)]

        # Fetch problem test cases
        prob = problems_col.find_one({"_id": pid})
        if not prob:
            return jsonify({"error": "Problem not found"}), 404

        test_cases = prob.get("test_cases", [])
        if not test_cases:
            return jsonify({"error": "No test cases available for this problem"}), 400

        # Pick the test case to reveal: cycle through hidden ones not yet revealed
        already_revealed_indices = {h.get("tc_index") for h in used_for_prob}
        # Find first unrevealed test case index (skip index 0 which is typically shown as example)
        reveal_idx = None
        for i in range(len(test_cases)):
            if i not in already_revealed_indices:
                reveal_idx = i
                break

        if reveal_idx is None:
            return jsonify({"error": "All test cases for this problem have already been revealed"}), 400

        tc = test_cases[reveal_idx]

        # Record this hint usage
        hint_record = {
            "problem_id": str(pid),
            "tc_index":   reveal_idx,
            "used_at":    datetime.utcnow().isoformat(),
        }
        participants.update_one(
            {"contest_id": cid, "user_id": uid},
            {
                "$inc": {"hint_tokens": -1},
                "$push": {"hints_used": hint_record},
            }
        )

        import json as _json
        inp = tc.get("input", "")
        out = tc.get("output", "")

        return jsonify({
            "message":        f"Hint revealed! Test case #{reveal_idx + 1} is now visible.",
            "tokens_left":    tokens_left - 1,
            "tc_index":       reveal_idx,
            "tc_total":       len(test_cases),
            "input":          _json.dumps(inp) if isinstance(inp, list) else str(inp),
            "expected_output": _json.dumps(out) if not isinstance(out, str) else out,
        }), 200

    # ── Contests created BY a user ─────────────────────────────────────────
    @contests_bp.route('/my/created', methods=['GET'])
    @jwt_required()
    def my_created():
        user_id = get_jwt_identity()
        my_contests = list(contests.find(
            {"created_by": ObjectId(user_id)}
        ).sort("created_at", -1))

        result = []
        for c in my_contests:
            count = participants.count_documents({"contest_id": c["_id"]})
            s = _serialize(c, db, user_id)
            s["participant_count"] = count
            # Creator sees their own access key
            s["access_key"] = c.get("access_key")
            result.append(s)
        return jsonify({"contests": result}), 200

    # ── Contests JOINED by a user ──────────────────────────────────────────
    @contests_bp.route('/my/joined', methods=['GET'])
    @jwt_required()
    def my_joined():
        user_id = get_jwt_identity()
        my_parts = list(participants.find({"user_id": ObjectId(user_id)}).sort("joined_at", -1))
        result = []
        for p in my_parts:
            c = contests.find_one({"_id": p["contest_id"]})
            if c:
                s = _serialize(c, db, user_id)
                s["my_score"]          = p.get("total_score", 0)
                s["my_problems_solved"] = p.get("problems_solved", 0)
                result.append(s)
        return jsonify({"contests": result}), 200

    # ── Contest Dashboard for CREATOR ──────────────────────────────────────
    @contests_bp.route('/<contest_id>/dashboard', methods=['GET'])
    @jwt_required()
    def contest_dashboard(contest_id):
        user_id = get_jwt_identity()
        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        # Only contest creator can see dashboard
        if contest.get("created_by") != uid:
            return jsonify({"error": "Only contest creator can access this"}), 403

        # Get all participants
        entries = list(participants.find({"contest_id": cid}).sort("total_score", -1))

        # Build leaderboard with rankings
        leaderboard = []
        for i, p in enumerate(entries):
            leaderboard.append({
                "rank":            i + 1,
                "username":        p.get("username", ""),
                "institution":     p.get("institution", ""),
                "total_score":     p.get("total_score", 0),
                "problems_solved": p.get("problems_solved", 0),
                "joined_at":       p["joined_at"].isoformat() if isinstance(p.get("joined_at"), datetime) else "",
                "last_submission": p["last_submission"].isoformat() if isinstance(p.get("last_submission"), datetime) else None,
            })

        contest_ser = _serialize(contest, db, user_id)
        
        # Include full problem details for editing
        prob_docs = list(problems_col.find(
            {"_id": {"$in": contest.get("problem_ids", [])}}
        ))
        problems_list = [{
            "_id":          str(p["_id"]),
            "title":        p.get("title", ""),
            "description":  p.get("description", ""),
            "difficulty":   p.get("difficulty", "Medium"),
            "points":       p.get("points", 100),
            "test_cases":   p.get("test_cases", []),
            "examples":     p.get("examples", []),
            "constraints":  p.get("constraints", []),
        } for p in prob_docs]
        
        return jsonify({
            "contest": contest_ser,
            "problems": problems_list,
            "access_key": contest.get("access_key"),
            "participant_count": len(entries),
            "leaderboard": leaderboard,
        }), 200

        # ── ADMIN: migrate test_cases input strings -> { stdin: ... } structure ──
        @contests_bp.route('/admin/migrate-testcases', methods=['POST'])
        @jwt_required()
        def migrate_testcases():
            user_id = get_jwt_identity()
            try:
                uid = ObjectId(user_id)
            except:
                return jsonify({"error": "Invalid user"}), 400
            user = users.find_one({"_id": uid})
            if not user or user.get('role') != 'admin':
                return jsonify({"error": "Only admin can run migration"}), 403

            modified = []
            for p in problems_col.find({}):
                tcs = p.get('test_cases', []) or []
                new_tcs = []
                changed = False
                for t in tcs:
                    # case: testcase is a plain string -> treat as stdin
                    if isinstance(t, str):
                        new_tcs.append({"stdin": t, "output": ""})
                        changed = True
                        continue

                    # case: dict with input as string -> convert to stdin
                    if isinstance(t, dict):
                        if 'input' in t and isinstance(t['input'], str):
                            new_tcs.append({"stdin": t['input'], "output": t.get('output')})
                            changed = True
                            continue
                        # already fine
                        new_tcs.append(t)
                        continue

                    # unknown type, keep as-is
                    new_tcs.append(t)

                if changed:
                    problems_col.update_one({"_id": p['_id']}, {"$set": {"test_cases": new_tcs, "updated_at": datetime.utcnow()}})
                    modified.append(str(p['_id']))

            return jsonify({"modified_count": len(modified), "modified_ids": modified}), 200

    # ── EDIT problem (creator only) ────────────────────────────────────────
    @contests_bp.route('/<contest_id>/problems/<problem_id>/edit', methods=['PUT'])
    @jwt_required()
    def edit_problem(contest_id, problem_id):
        user_id = get_jwt_identity()
        data = request.get_json()
        
        try:
            cid = ObjectId(contest_id)
            uid = ObjectId(user_id)
            pid = ObjectId(problem_id)
        except:
            return jsonify({"error": "Invalid ID"}), 400
        
        # Verify contest exists and user is creator
        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404
        if contest.get("created_by") != uid:
            return jsonify({"error": "Only contest creator can edit problems"}), 403
        
        # Verify problem belongs to contest
        if pid not in contest.get("problem_ids", []):
            return jsonify({"error": "Problem not in this contest"}), 404
        
        # Update problem fields
        update_doc = {}
        if "title" in data:
            update_doc["title"] = data["title"]
        if "description" in data:
            update_doc["description"] = data["description"]
        if "difficulty" in data:
            update_doc["difficulty"] = data["difficulty"]
        if "points" in data:
            update_doc["points"] = int(data["points"])
        if "test_cases" in data:
            update_doc["test_cases"] = data["test_cases"]
        if "examples" in data:
            update_doc["examples"] = data["examples"]
        if "constraints" in data:
            update_doc["constraints"] = data["constraints"]
        if "time_limit_ms" in data:
            update_doc["time_limit_ms"] = int(data["time_limit_ms"])
        if "memory_limit_mb" in data:
            update_doc["memory_limit_mb"] = int(data["memory_limit_mb"])
        
        if not update_doc:
            return jsonify({"error": "No fields to update"}), 400
        
        update_doc["updated_at"] = datetime.utcnow()
        problems_col.update_one({"_id": pid}, {"$set": update_doc})
        
        return jsonify({"message": "Problem updated successfully"}), 200

    return contests_bp