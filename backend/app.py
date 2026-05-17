import os
from flask import Flask
from flask_cors import CORS

from api.routes import api_bp


def create_app() -> Flask:
    """Application factory — creates and configures the Flask app."""
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(api_bp, url_prefix="/api")
    return app


if __name__ == "__main__":
    application = create_app()
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    application.run(debug=debug_mode, port=5001)
