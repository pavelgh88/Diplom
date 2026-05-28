import os
from flask import Flask
from flask_cors import CORS

from api.routes import api_bp


def create_app() -> Flask:
    """Application factory — creates and configures the Flask app."""
    app = Flask(__name__)
    # In production set FRONTEND_URL to your Vercel domain to restrict CORS.
    # If unset, allow all origins (handy for local dev).
    frontend_url = os.environ.get("FRONTEND_URL")
    if frontend_url:
        CORS(app, resources={r"/api/*": {"origins": frontend_url}})
    else:
        CORS(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    return app


# Exposed at module level so Gunicorn can find it: `gunicorn app:application`
application = create_app()


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    # Render injects PORT; locally we fall back to 5001.
    port = int(os.environ.get("PORT", 5001))
    application.run(debug=debug_mode, host="0.0.0.0", port=port)
