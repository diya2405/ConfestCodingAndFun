from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime

admin_bp = Blueprint('admin', __name__)


def init_admin(app, db):
    users        = db["users"]
    contests     = db["contests"]
    participants = db["contest_participants"]
    problems_col = db["problems"]
    submissions  = db["submissions"]

    # ── Helper: require admin role ────────────────────────────────────────────
    def _require_admin():
        """Returns (user_doc, error_response) — caller checks error_response first."""
        user_id = get_jwt_identity()
        try:
            user = users.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None, (jsonify({"error": "Invalid token"}), 401)
        if not user or user.get("role") != "admin":
            return None, (jsonify({"error": "Admin access required"}), 403)
        return user, None

    def _serialize_user(u):
        if not u:
            return {}
        created = u.get("created_at")
        return {
            "_id":              str(u["_id"]),
            "username":         u.get("username", ""),
            "email":            u.get("email", ""),
            "institution":      u.get("institution", ""),
            "role":             u.get("role", "user"),
            "score":            u.get("score", 0),
            "problems_solved":  u.get("problems_solved", 0),
            "contests_entered": u.get("contests_entered", 0),
            "created_at":       created.isoformat() if isinstance(created, datetime) else str(created or ""),
        }

    def _serialize_contest(c):
        from datetime import timezone, timedelta
        now = datetime.now(timezone.utc)
        start = c.get("start_time")
        if isinstance(start, str):
            s = start
            if s.endswith('Z'):
                s = s[:-1] + '+00:00'
            try:
                start = datetime.fromisoformat(s)
            except Exception:
                start = None
        if isinstance(start, datetime):
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            end = start + timedelta(minutes=int(c.get("duration_mins", 90)))
            if now < start:
                status = "upcoming"
            elif now <= end:
                status = "live"
            else:
                status = "completed"
        else:
            status = "unknown"

        start_iso = start.isoformat() if isinstance(start, datetime) else ""
        count = participants.count_documents({"contest_id": c["_id"]})
        return {
            "_id":              str(c["_id"]),
            "title":            c.get("title", ""),
            "difficulty":       c.get("difficulty", "Medium"),
            "status":           status,
            "duration_mins":    c.get("duration_mins", 90),
            "start_time":       start_iso,
            "created_by_name":  c.get("created_by_name", ""),
            "participant_count": count,
            "problem_count":    len(c.get("problem_ids", [])),
            "access_type":      c.get("access_type", "public"),
            "created_at":       c["created_at"].isoformat() if isinstance(c.get("created_at"), datetime) else "",
        }

    def _serialize_submission(s):
        prob = problems_col.find_one({"_id": s.get("problem_id")}) if s.get("problem_id") else None
        user = users.find_one({"_id": s.get("user_id")}) if s.get("user_id") else None
        return {
            "_id":               str(s["_id"]),
            "username":          user.get("username", "?") if user else "?",
            "problem_title":     prob.get("title", "?") if prob else "?",
            "language":          s.get("language", ""),
            "verdict":           s.get("verdict", ""),
            "score":             s.get("score", 0),
            "test_cases_passed": s.get("test_cases_passed", 0),
            "test_cases_total":  s.get("test_cases_total", 0),
            "is_late":           s.get("is_late", False),
            "submitted_at":      s["submitted_at"].isoformat() if isinstance(s.get("submitted_at"), datetime) else "",
        }

    # ── GET /admin/stats ───────────────────────────────────────────────────────
    @admin_bp.route('/stats', methods=['GET'])
    @jwt_required()
    def get_stats():
        _, err = _require_admin()
        if err:
            return err

        total_users       = users.count_documents({})
        total_contests    = contests.count_documents({})
        total_submissions = submissions.count_documents({})
        total_problems    = problems_col.count_documents({})
        active_users      = users.count_documents({"score": {"$gt": 0}})
        accepted          = submissions.count_documents({"verdict": "Accepted"})
        live_contests     = sum(
            1 for c in contests.find({})
            if _serialize_contest(c)["status"] == "live"
        )

        return jsonify({
            "total_users":       total_users,
            "total_contests":    total_contests,
            "total_submissions": total_submissions,
            "total_problems":    total_problems,
            "active_users":      active_users,
            "accepted_submissions": accepted,
            "live_contests":     live_contests,
        }), 200

    # ── GET /admin/users ───────────────────────────────────────────────────────
    @admin_bp.route('/users', methods=['GET'])
    @jwt_required()
    def list_users():
        _, err = _require_admin()
        if err:
            return err

        page     = max(1, int(request.args.get("page", 1)))
        per_page = min(100, int(request.args.get("per_page", 50)))
        q        = request.args.get("q", "").strip()

        query = {}
        if q:
            query = {"$or": [
                {"username": {"$regex": q, "$options": "i"}},
                {"email":    {"$regex": q, "$options": "i"}},
                {"institution": {"$regex": q, "$options": "i"}},
            ]}

        total = users.count_documents(query)
        docs  = list(users.find(query).sort("created_at", -1).skip((page-1)*per_page).limit(per_page))

        return jsonify({
            "users":    [_serialize_user(u) for u in docs],
            "total":    total,
            "page":     page,
            "per_page": per_page,
        }), 200

    # ── PUT /admin/users/<id> — update role ────────────────────────────────────
    @admin_bp.route('/users/<user_id>', methods=['PUT'])
    @jwt_required()
    def update_user(user_id):
        admin_user, err = _require_admin()
        if err:
            return err

        try:
            uid = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid user ID"}), 400

        target = users.find_one({"_id": uid})
        if not target:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}
        allowed_updates = {}

        if "role" in data:
            if data["role"] not in ("user", "admin"):
                return jsonify({"error": "Role must be 'user' or 'admin'"}), 400
            # Prevent self-demotion
            if str(admin_user["_id"]) == user_id and data["role"] != "admin":
                return jsonify({"error": "Cannot remove your own admin role"}), 400
            allowed_updates["role"] = data["role"]

        if not allowed_updates:
            return jsonify({"error": "Nothing to update"}), 400

        users.update_one({"_id": uid}, {"$set": allowed_updates})
        return jsonify({"message": "User updated", "user": _serialize_user(users.find_one({"_id": uid}))}), 200

    # ── DELETE /admin/users/<id> ───────────────────────────────────────────────
    @admin_bp.route('/users/<user_id>', methods=['DELETE'])
    @jwt_required()
    def delete_user(user_id):
        admin_user, err = _require_admin()
        if err:
            return err

        # Prevent self-deletion
        if str(admin_user["_id"]) == user_id:
            return jsonify({"error": "Cannot delete your own account from admin panel"}), 400

        try:
            uid = ObjectId(user_id)
        except Exception:
            return jsonify({"error": "Invalid user ID"}), 400

        result = users.delete_one({"_id": uid})
        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404

        # Clean up related records
        submissions.delete_many({"user_id": uid})
        participants.delete_many({"user_id": uid})

        return jsonify({"message": "User deleted"}), 200

    # ── GET /admin/contests ────────────────────────────────────────────────────
    @admin_bp.route('/contests', methods=['GET'])
    @jwt_required()
    def list_contests():
        _, err = _require_admin()
        if err:
            return err

        page     = max(1, int(request.args.get("page", 1)))
        per_page = min(100, int(request.args.get("per_page", 50)))
        q        = request.args.get("q", "").strip()

        query = {}
        if q:
            query = {"title": {"$regex": q, "$options": "i"}}

        total = contests.count_documents(query)
        docs  = list(contests.find(query).sort("created_at", -1).skip((page-1)*per_page).limit(per_page))

        return jsonify({
            "contests": [_serialize_contest(c) for c in docs],
            "total":    total,
            "page":     page,
            "per_page": per_page,
        }), 200

    # ── DELETE /admin/contests/<id> ────────────────────────────────────────────
    @admin_bp.route('/contests/<contest_id>', methods=['DELETE'])
    @jwt_required()
    def delete_contest(contest_id):
        _, err = _require_admin()
        if err:
            return err

        try:
            cid = ObjectId(contest_id)
        except Exception:
            return jsonify({"error": "Invalid contest ID"}), 400

        contest = contests.find_one({"_id": cid})
        if not contest:
            return jsonify({"error": "Contest not found"}), 404

        # Remove associated data
        problems_col.delete_many({"_id": {"$in": contest.get("problem_ids", [])}})
        participants.delete_many({"contest_id": cid})
        submissions.delete_many({"contest_id": cid})
        contests.delete_one({"_id": cid})

        return jsonify({"message": "Contest and all associated data deleted"}), 200

    # ── GET /admin/submissions ─────────────────────────────────────────────────
    @admin_bp.route('/submissions', methods=['GET'])
    @jwt_required()
    def list_submissions():
        _, err = _require_admin()
        if err:
            return err

        page     = max(1, int(request.args.get("page", 1)))
        per_page = min(100, int(request.args.get("per_page", 50)))
        verdict  = request.args.get("verdict", "").strip()

        query = {}
        if verdict:
            query["verdict"] = verdict

        total = submissions.count_documents(query)
        docs  = list(submissions.find(query).sort("submitted_at", -1).skip((page-1)*per_page).limit(per_page))

        return jsonify({
            "submissions": [_serialize_submission(s) for s in docs],
            "total":       total,
            "page":        page,
            "per_page":    per_page,
        }), 200

    # ── DELETE /admin/submissions/<id> ─────────────────────────────────────────
    @admin_bp.route('/submissions/<submission_id>', methods=['DELETE'])
    @jwt_required()
    def delete_submission(submission_id):
        _, err = _require_admin()
        if err:
            return err

        try:
            sid = ObjectId(submission_id)
        except Exception:
            return jsonify({"error": "Invalid submission ID"}), 400

        result = submissions.delete_one({"_id": sid})
        if result.deleted_count == 0:
            return jsonify({"error": "Submission not found"}), 404

        return jsonify({"message": "Submission deleted"}), 200

    # ── POST /admin/promote — promote user to admin by email ──────────────────
    @admin_bp.route('/promote', methods=['POST'])
    @jwt_required()
    def promote_user():
        _, err = _require_admin()
        if err:
            return err

        data  = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"error": "email is required"}), 400

        user = users.find_one({"email": email})
        if not user:
            return jsonify({"error": "User not found"}), 404

        users.update_one({"_id": user["_id"]}, {"$set": {"role": "admin"}})
        return jsonify({"message": f"{user['username']} promoted to admin"}), 200

    return admin_bp
