from datetime import datetime

def create_user(username, email, password_hash, extra={}):
    return {
        "username": username,
        "email": email,
        "password": password_hash,
        "phone": extra.get("phone", ""),
        "institution": extra.get("institution", ""),
        "purpose": extra.get("purpose", ""),
        "experience_level": extra.get("experience_level", ""),
        "interests": extra.get("interests", []),
        "role": "user",
        "score": 0,
        "rank": None,
        "problems_solved": 0,
        "contests_entered": 0,
        "streak": 0,
        "created_at": datetime.utcnow()
    }