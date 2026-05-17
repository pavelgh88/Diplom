from flask import Flask, request, jsonify
from flask_cors import CORS

from algorithms.simplex import solve_simplex
from algorithms.branch_and_bound import solve_branch_and_bound
from algorithms.transport import solve_transport

app = Flask(__name__)
CORS(app)


def _validate_lp_input(data: dict) -> tuple[bool, str]:
    """Return (is_valid, error_message)."""
    if not all(k in data for k in ("c", "A", "b")):
        return False, "Обов'язкові поля: c, A, b"
    if not isinstance(data["c"], list) or not data["c"]:
        return False, "Поле 'c' має бути непорожнім списком"
    if not isinstance(data["A"], list) or not data["A"]:
        return False, "Поле 'A' має бути непорожнім списком списків"
    if not isinstance(data["b"], list) or not data["b"]:
        return False, "Поле 'b' має бути непорожнім списком"
    n = len(data["c"])
    for row in data["A"]:
        if not isinstance(row, list) or len(row) != n:
            return False, f"Кожен рядок A має містити {n} елементів (відповідно до довжини c)"
    if len(data["A"]) != len(data["b"]):
        return False, "Кількість рядків A має збігатися з довжиною b"
    return True, ""


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Backend працює"})


@app.route("/api/simplex", methods=["POST"])
def simplex_endpoint():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    if len(data.get("c", [])) > 20:
        return jsonify({"error": "Максимум 20 змінних"}), 400

    valid, msg = _validate_lp_input(data)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        result = solve_simplex(
            c=data["c"],
            A=data["A"],
            b=data["b"],
            maximize=bool(data.get("maximize", False)),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/branch-and-bound", methods=["POST"])
def branch_and_bound_endpoint():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    if len(data.get("c", [])) > 20:
        return jsonify({"error": "Максимум 20 змінних"}), 400

    valid, msg = _validate_lp_input(data)
    if not valid:
        return jsonify({"error": msg}), 400

    var_bounds = data.get("bounds", None)

    try:
        result = solve_branch_and_bound(
            c=data["c"],
            A_ub=data["A"],
            b_ub=data["b"],
            maximize=bool(data.get("maximize", False)),
            var_bounds=var_bounds,
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def _validate_transport_input(data: dict) -> tuple[bool, str]:
    """Return (is_valid, error_message) for transport problem input."""
    if not all(k in data for k in ("supply", "demand", "costs")):
        return False, "Обов'язкові поля: supply, demand, costs"
    if not isinstance(data["supply"], list) or not data["supply"]:
        return False, "Поле 'supply' має бути непорожнім списком"
    if not isinstance(data["demand"], list) or not data["demand"]:
        return False, "Поле 'demand' має бути непорожнім списком"
    if not isinstance(data["costs"], list) or not data["costs"]:
        return False, "Поле 'costs' має бути непорожнім списком списків"
    m, n = len(data["supply"]), len(data["demand"])
    if len(data["costs"]) != m:
        return False, f"Матриця costs має містити {m} рядків"
    for row in data["costs"]:
        if not isinstance(row, list) or len(row) != n:
            return False, f"Кожен рядок costs має містити {n} елементів"
    if m > 15 or n > 15:
        return False, "Максимум 15 постачальників та 15 споживачів"
    return True, ""


@app.route("/api/transport", methods=["POST"])
def transport_endpoint():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400

    valid, msg = _validate_transport_input(data)
    if not valid:
        return jsonify({"error": msg}), 400

    try:
        result = solve_transport(
            supply=data["supply"],
            demand=data["demand"],
            costs=data["costs"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)
