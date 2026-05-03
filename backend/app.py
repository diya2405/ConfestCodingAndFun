from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from routes.profile import init_profile
from routes.contests import init_contests
from routes.submissions import init_submissions


load_dotenv()

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

CORS(app, origins=["http://localhost:5173"], supports_credentials=True)

JWTManager(app)

client = MongoClient(os.getenv("MONGO_URI"))
db = client["confest"]

try:
    client.admin.command('ping')
    print("✅ MongoDB connected successfully")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")

from routes.auth import init_auth
auth_bp = init_auth(app, db)
app.register_blueprint(auth_bp, url_prefix="/api/auth")

profile_bp = init_profile(app, db)
app.register_blueprint(profile_bp, url_prefix="/api/auth")

contests_bp = init_contests(app, db)
app.register_blueprint(contests_bp, url_prefix="/api/contests")

submissions_bp = init_submissions(app, db)
app.register_blueprint(submissions_bp, url_prefix="/api/submissions")

if __name__ == "__main__":
    app.run(debug=True, port=5000)