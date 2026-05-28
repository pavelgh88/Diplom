import json
import os
import random
from flask import Blueprint, request, jsonify

from core.simplex_solver import solve_simplex
from core.bnb_solver import solve_branch_and_bound
from core.transport_solver import solve_transport
from core.validator import (
    validate_simplex_pivot,
    validate_simplex_tableau,
    validate_transport_allocation,
    validate_transport_potentials,
    validate_transport_entering,
    validate_bnb_branch,
)
from core.generator import generate_lp, generate_ilp, generate_transport

api_bp = Blueprint("api", __name__)

_TASKS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "tasks.json")


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
            return False, f"Кожен рядок A має містити {n} елементів"
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


# ── Health ──────────────────────────────────────────────────────────────────────

@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "message": "Backend працює"})


# ── Tasks library ───────────────────────────────────────────────────────────────

@api_bp.route("/tasks", methods=["GET"])
def get_tasks():
    problem_type = request.args.get("type")
    tasks = _load_tasks()
    if problem_type:
        tasks = [t for t in tasks if t.get("type") == problem_type]
    return jsonify([
        {"id": t["id"], "title": t["title"], "type": t["type"], "description": t["description"]}
        for t in tasks
    ])


@api_bp.route("/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id: int):
    tasks = _load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if task is None:
        return jsonify({"error": "Задачу не знайдено"}), 404
    return jsonify(task)


@api_bp.route("/tasks/random", methods=["GET"])
def get_random_task():
    problem_type = request.args.get("type")
    tasks = _load_tasks()
    if problem_type:
        tasks = [t for t in tasks if t.get("type") == problem_type]
    if not tasks:
        return jsonify({"error": "Задач не знайдено"}), 404
    task = random.choice(tasks)
    return jsonify(task)


@api_bp.route("/stats", methods=["GET"])
def get_stats():
    tasks = _load_tasks()
    by_type: dict = {}
    for t in tasks:
        by_type[t["type"]] = by_type.get(t["type"], 0) + 1
    return jsonify({
        "total_tasks": len(tasks),
        "by_type": by_type,
        "algorithms": list(by_type.keys()),
    })


@api_bp.route("/algorithms", methods=["GET"])
def get_algorithms():
    return jsonify([
        {
            "id": "simplex",
            "title": "Симплекс-метод",
            "description": "Розв'язує задачу лінійного програмування симплекс-методом з покроковою таблицею.",
        },
        {
            "id": "branch_and_bound",
            "title": "Метод гілок і меж",
            "description": "Розв'язує цілочисельну задачу ЗЛП методом гілок і меж з візуалізацією дерева.",
        },
        {
            "id": "transport",
            "title": "Транспортна задача",
            "description": "Розв'язує транспортну задачу методом потенціалів з покроковим відображенням.",
        },
    ])


@api_bp.route("/tasks/<int:task_id>/verify", methods=["POST"])
def verify_task_answer(task_id: int):
    """Check whether the student's computed optimal value matches the task's expected answer."""
    tasks = _load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if task is None:
        return jsonify({"error": "Задачу не знайдено"}), 404

    data = request.get_json(silent=True)
    if data is None or "optimal_value" not in data:
        return jsonify({"error": "Очікується поле optimal_value у тілі запиту"}), 400

    expected = task.get("expected", {}).get("optimal_value")
    if expected is None:
        return jsonify({"error": "Для цієї задачі очікуваний результат не визначено"}), 400

    user_value = float(data["optimal_value"])
    tolerance = float(data.get("tolerance", 1e-4))
    correct = abs(user_value - expected) <= tolerance

    return jsonify({
        "correct": correct,
        "expected": expected,
        "user_value": user_value,
        "message": "Правильно! Оптимальне значення збігається." if correct
                   else f"Неправильно. Очікувалось {expected}, отримано {user_value:.4f}.",
    })


# ── Simplex ─────────────────────────────────────────────────────────────────────

@api_bp.route("/simplex", methods=["POST"])
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
            c=data["c"], A=data["A"], b=data["b"],
            maximize=bool(data.get("maximize", False)),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/simplex/hint", methods=["POST"])
def simplex_hint():
    """Return step-by-step hint for the current simplex tableau without revealing the answer."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    if "tableau" not in data or "col_names" not in data:
        return jsonify({"error": "Відсутні поля: tableau, col_names"}), 400
    try:
        import numpy as np
        T = np.array(data["tableau"], dtype=float)
        m = T.shape[0] - 1
        obj_row = T[m, :-1]
        min_val = float(np.min(obj_row))
        if min_val >= -1e-9:
            return jsonify({"hint": "Таблиця вже оптимальна — всі коефіцієнти рядка z невід'ємні.", "optimal": True})
        correct_col = int(np.argmin(obj_row))
        col_names = data["col_names"]
        col_name = col_names[correct_col] if correct_col < len(col_names) else f"стовпець {correct_col}"
        return jsonify({
            "hint": (
                f"Підказка: у рядку цільової функції є від'ємні коефіцієнти. "
                f"Знайдіть серед них найменший (найбільший за модулем) — це і є ведучий стовпець. "
                f"Мінімальний коефіцієнт = {min_val:.4f}."
            ),
            "optimal": False,
            "correct_col": correct_col,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/simplex/check", methods=["POST"])
def simplex_check():
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

@api_bp.route("/branch-and-bound", methods=["POST"])
def branch_and_bound_endpoint():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    if len(data.get("c", [])) > 20:
        return jsonify({"error": "Максимум 20 змінних"}), 400
    valid, msg = _validate_lp_input(data)
    if not valid:
        return jsonify({"error": msg}), 400
    try:
        result = solve_branch_and_bound(
            c=data["c"], A_ub=data["A"], b_ub=data["b"],
            maximize=bool(data.get("maximize", False)),
            var_bounds=data.get("bounds", None),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/branch-and-bound/check", methods=["POST"])
def bnb_check():
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

@api_bp.route("/transport", methods=["POST"])
def transport_endpoint():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    valid, msg = _validate_transport_input(data)
    if not valid:
        return jsonify({"error": msg}), 400
    try:
        result = solve_transport(
            supply=data["supply"], demand=data["demand"], costs=data["costs"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/transport/check", methods=["POST"])
def transport_check():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON у тілі запиту"}), 400
    for field in ("costs", "supply", "demand", "user_allocation"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400
    try:
        result = validate_transport_allocation(
            costs=data["costs"], supply=data["supply"],
            demand=data["demand"], user_allocation=data["user_allocation"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/transport/check-potentials", methods=["POST"])
def transport_check_potentials():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    for field in ("basic_cells", "costs", "student_u", "student_v"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400
    try:
        result = validate_transport_potentials(
            basic_cells=data["basic_cells"],
            costs=data["costs"],
            student_u=data["student_u"],
            student_v=data["student_v"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/transport/check-entering", methods=["POST"])
def transport_check_entering():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    for field in ("u", "v", "costs", "basic_cells", "user_row", "user_col"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400
    try:
        result = validate_transport_entering(
            u=data["u"], v=data["v"],
            costs=data["costs"],
            basic_cells=data["basic_cells"],
            user_row=int(data["user_row"]),
            user_col=int(data["user_col"]),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Simplex blind tableau check ──────────────────────────────────────────────────

@api_bp.route("/simplex/check-tableau", methods=["POST"])
def simplex_check_tableau():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    for field in ("prev_tableau", "pivot_col", "pivot_row", "student_tableau"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400
    try:
        result = validate_simplex_tableau(
            prev_tableau=data["prev_tableau"],
            pivot_col=int(data["pivot_col"]),
            pivot_row=int(data["pivot_row"]),
            student_tableau=data["student_tableau"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Random task generator ────────────────────────────────────────────────────────

@api_bp.route("/generate", methods=["GET"])
def generate_task():
    task_type = request.args.get("type", "simplex")
    try:
        n_vars = int(request.args.get("vars", 2))
        n_constraints = int(request.args.get("constraints", 3))
    except ValueError:
        return jsonify({"error": "vars та constraints мають бути цілими числами"}), 400

    n_vars = max(1, min(n_vars, 6))
    n_constraints = max(1, min(n_constraints, 8))

    import random as _rand
    seed = _rand.randint(0, 10**9)

    try:
        if task_type == "simplex":
            prob = generate_lp(n_vars=n_vars, n_constraints=n_constraints, maximize=True, seed=seed)
        elif task_type == "branch_and_bound":
            prob = generate_ilp(n_vars=n_vars, n_constraints=n_constraints, maximize=True, seed=seed)
        elif task_type == "transport":
            prob = generate_transport(n_sources=n_vars, n_dests=n_constraints, seed=seed)
        else:
            return jsonify({"error": f"Невідомий тип: {task_type}"}), 400

        if prob is None:
            return jsonify({"error": "Не вдалося згенерувати задачу — спробуйте ще раз"}), 500

        return jsonify({"type": task_type, "generated": True, "problem": prob})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
