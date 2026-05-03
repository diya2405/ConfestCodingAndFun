from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta, datetime
from bson import ObjectId
import re

auth_bp = Blueprint('auth', __name__)
bcrypt  = Bcrypt()

def init_auth(app, db):
    bcrypt.init_app(app)
    users = db["users"]

    @auth_bp.route('/register', methods=['POST'])
    def register():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        username         = data.get("username", "").strip()
        email            = data.get("email", "").strip().lower()
        password         = data.get("password", "")
        phone            = data.get("phone", "").strip()
        institution      = data.get("institution", "").strip()
        purpose          = data.get("purpose", "").strip()
        experience_level = data.get("experience_level", "").strip()
        interests        = data.get("interests", [])

        if not username or not email or not password:
            return jsonify({"error": "Username, email and password required"}), 400
        if len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters"}), 400
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({"error": "Invalid email address"}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400
        if users.find_one({"email": email}):
            return jsonify({"error": "Email already registered"}), 409
        if users.find_one({"username": username}):
            return jsonify({"error": "Username already taken"}), 409

        from models.user import create_user
        hashed   = bcrypt.generate_password_hash(password).decode('utf-8')
        user_doc = create_user(username, email, hashed, {
            "phone": phone, "institution": institution,
            "purpose": purpose, "experience_level": experience_level,
            "interests": interests
        })
        result = users.insert_one(user_doc)
        token  = create_access_token(
            identity=str(result.inserted_id),
            expires_delta=timedelta(days=7)
        )
        return jsonify({
            "message": "Account created successfully",
            "token": token,
            "user": _serialize_user(users.find_one({"_id": result.inserted_id}))
        }), 201

    @auth_bp.route('/login', methods=['POST'])
    def login():
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email    = data.get("email", "").strip().lower()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        user = users.find_one({"email": email})
        if not user or not bcrypt.check_password_hash(user["password"], password):
            return jsonify({"error": "Invalid email or password"}), 401

        token = create_access_token(
            identity=str(user["_id"]),
            expires_delta=timedelta(days=7)
        )
        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": _serialize_user(user)
        }), 200

    @auth_bp.route('/me', methods=['GET'])
    @jwt_required()
    def get_me():
        user_id = get_jwt_identity()
        user    = users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404
        return jsonify(_serialize_user(user)), 200

    @auth_bp.route('/profile', methods=['PUT'])
    @jwt_required()
    def update_profile():
        user_id = get_jwt_identity()
        data    = request.get_json()

        allowed = ['institution', 'purpose', 'experience_level', 'interests', 'phone']
        update  = {k: data[k] for k in allowed if k in data}

        if not update:
            return jsonify({"error": "Nothing to update"}), 400

        users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
        updated = users.find_one({"_id": ObjectId(user_id)})
        return jsonify({"message": "Profile updated", "user": _serialize_user(updated)}), 200

    def _serialize_user(u):
        if not u:
            return {}
        created = u.get("created_at")
        if created and isinstance(created, datetime):
            created_str = created.isoformat()
        elif created:
            created_str = str(created)
        else:
            created_str = None

        return {
            "id":               str(u["_id"]),
            "username":         u.get("username", ""),
            "email":            u.get("email", ""),
            "phone":            u.get("phone", ""),
            "institution":      u.get("institution", ""),
            "purpose":          u.get("purpose", ""),
            "experience_level": u.get("experience_level", ""),
            "interests":        u.get("interests", []),
            "role":             u.get("role", "user"),
            "score":            u.get("score", 0),
            "rank":             u.get("rank"),
            "problems_solved":  u.get("problems_solved", 0),
            "contests_entered": u.get("contests_entered", 0),
            "streak":           u.get("streak", 0),
            "created_at":       created_str,
        }

    return auth_bp