import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from algorithms.simplex import solve_simplex
from algorithms.branch_and_bound import solve_branch_and_bound
from algorithms.transport import solve_transport
from algorithms.validator import (
    validate_simplex_pivot,
    validate_transport_allocation,
    validate_bnb_branch,
)

app = Flask(__name__)
CORS(app)

_TASKS_FILE = os.path.join(os.path.dirname(__file__), "data", "tasks.json")


def _load_tasks() -> list:
    with open(_TASKS_FILE, encoding="utf-8") as f:
        return json.load(f)["tasks"]


def _validate_lp_input(data: dict) -> tuple[bool, str]:
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


def _validate_transport_input(data: dict) -> tuple[bool, str]:
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


# ── Health ─────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Backend працює"})


# ── Tasks library ───────────────────────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """Return task list (without full problem details)."""
    problem_type = request.args.get("type")
    tasks = _load_tasks()
    if problem_type:
        tasks = [t for t in tasks if t.get("type") == problem_type]
    summary = [
        {
            "id": t["id"],
            "title": t["title"],
            "type": t["type"],
            "description": t["description"],
        }
        for t in tasks
    ]
    return jsonify(summary)


@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id: int):
    """Return full task including problem data."""
    tasks = _load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if task is None:
        return jsonify({"error": "Задачу не знайдено"}), 404
    return jsonify(task)


# ── Simplex ─────────────────────────────────────────────────────────────────────

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


@app.route("/api/simplex/check", methods=["POST"])
def simplex_check():
    """
    Validate a student's pivot selection.

    Body: {
      "tableau":        [[...], ...],   # current simplex tableau (including objective row)
      "col_names":      ["x1", "x2", "s1", ...],
      "user_pivot_col": <int>,
      "user_pivot_row": <int>
    }
    """
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    for field in ("tableau", "col_names", "user_pivot_col", "user_pivot_row"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400

    try:
        result = validate_simplex_pivot(
            tableau=data["tableau"],
            col_names=data["col_names"],
            user_pivot_col=int(data["user_pivot_col"]),
            user_pivot_row=int(data["user_pivot_row"]),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Branch and Bound ────────────────────────────────────────────────────────────

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


@app.route("/api/branch-and-bound/check", methods=["POST"])
def bnb_check():
    """
    Validate a student's branching variable choice.

    Body: {
      "lp_solution":    [2.5, 3.0, ...],
      "user_branch_var": <int>           # 0-based variable index
    }
    """
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    for field in ("lp_solution", "user_branch_var"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400

    try:
        result = validate_bnb_branch(
            lp_solution=data["lp_solution"],
            user_branch_var=int(data["user_branch_var"]),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Transport ───────────────────────────────────────────────────────────────────

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


@app.route("/api/transport/check", methods=["POST"])
def transport_check():
    """
    Validate a student's transport allocation.

    Body: {
      "costs":           [[...], ...],
      "supply":          [...],
      "demand":          [...],
      "user_allocation": [[...], ...]
    }
    """
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    for field in ("costs", "supply", "demand", "user_allocation"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400

    try:
        result = validate_transport_allocation(
            costs=data["costs"],
            supply=data["supply"],
            demand=data["demand"],
            user_allocation=data["user_allocation"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)
