from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

profile_bp = Blueprint('profile', __name__)

def init_profile(app, db):
    users = db["users"]

    @profile_bp.route('/profile', methods=['PUT'])
    @jwt_required()
    def update_profile():
        user_id = get_jwt_identity()
        data = request.get_json()

        update_fields = {}
        for field in ['institution', 'purpose', 'experience_level', 'interests', 'phone']:
            if field in data:
                update_fields[field] = data[field]

        if not update_fields:
            return jsonify({"error": "Nothing to update"}), 400

        users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )

        updated = users.find_one({"_id": ObjectId(user_id)})
        return jsonify({
            "message": "Profile updated",
            "user": {
                "id": str(updated["_id"]),
                "username": updated["username"],
                "email": updated["email"],
                "phone": updated.get("phone", ""),
                "institution": updated.get("institution", ""),
                "purpose": updated.get("purpose", ""),
                "experience_level": updated.get("experience_level", ""),
                "interests": updated.get("interests", []),
                "score": updated.get("score", 0),
                "problems_solved": updated.get("problems_solved", 0),
                "contests_entered": updated.get("contests_entered", 0),
                "streak": updated.get("streak", 0),
            }
        }), 200

    return profile_bp