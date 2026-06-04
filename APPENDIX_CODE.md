# Додаток А. Програмний код серверної частини

У цьому додатку наведено повний код ключових модулів серверної частини
навчального тренажера: трьох розв'язувачів (симплекс-метод, метод гілок і меж,
метод потенціалів для транспортної задачі), валідаторів дій студента,
генератора випадкових задач, REST API та точки входу Flask-додатку.

Усі модулі написано на Python 3.12 із використанням бібліотек NumPy 1.26.4 та
SciPy 1.13.1. Коментарі та повідомлення про помилки — українською мовою.

---

## А.1 Точка входу Flask-додатку

**Лістинг А.1** — `backend/app.py` (30 рядків)

Реалізує шаблон application factory: функція `create_app()` створює і
конфігурує екземпляр Flask, налаштовує CORS (з можливістю обмеження домену
через змінну середовища `FRONTEND_URL`), реєструє Blueprint з REST-маршрутами.
Об'єкт `application` на рівні модуля використовується Gunicorn у продакшні.

```python
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
```

---

## А.2 Симплекс-метод

**Лістинг А.2** — `backend/core/simplex_solver.py` (123 рядки)

Класична реалізація двофазного табличного симплекс-методу для задач у формі
`min/max c·x s.t. Ax ≤ b, b ≥ 0, x ≥ 0`. Використовується правило Данціга для
вибору ведучого стовпця та правило мінімального відношення для ведучого рядка.
Кожна ітерація зберігається у списку `steps` для покрокового відображення.

```python
import numpy as np
from typing import List, Dict, Any, Optional


def solve_simplex(
    c: List[float],
    A: List[List[float]],
    b: List[float],
    maximize: bool = False,
) -> Dict[str, Any]:
    """
    Solve LP:  min/max  c^T x
               s.t.     Ax <= b,  x >= 0

    Returns step-by-step simplex tableaux.
    Each constraint must have b_i >= 0 (standard <= form).
    """
    c_arr = np.array(c, dtype=float)
    A_arr = np.array(A, dtype=float)
    b_arr = np.array(b, dtype=float)

    if np.any(b_arr < -1e-9):
        return {"error": "Всі значення правої частини b мають бути >= 0"}

    if maximize:
        c_arr = -c_arr

    m, n = A_arr.shape
    n_total = n + m  # original vars + slack vars

    # Build tableau: m constraint rows + 1 objective row
    # Columns: [x1..xn | s1..sm | RHS]
    T = np.zeros((m + 1, n_total + 1))
    T[:m, :n] = A_arr
    T[:m, n:n_total] = np.eye(m)
    T[:m, -1] = b_arr
    T[m, :n] = c_arr  # reduced costs (objective row)

    # Initial basis: slack variables s1..sm
    basic = list(range(n, n_total))

    col_names = [f"x{i+1}" for i in range(n)] + [f"s{i+1}" for i in range(m)]

    steps: List[Dict] = []

    def snapshot(desc: str, p_row: Optional[int] = None, p_col: Optional[int] = None) -> None:
        tableau = [row[:] for row in T.tolist()]
        if maximize:
            tableau[m][:-1] = [-v for v in tableau[m][:-1]]
            tableau[m][-1] = -tableau[m][-1]
        steps.append({
            "description": desc,
            "tableau": tableau,
            "col_names": col_names + ["RHS"],
            "row_names": [col_names[v] for v in basic] + ["z"],
            "basic_vars": [col_names[v] for v in basic],
            "pivot_row": p_row,
            "pivot_col": p_col,
        })

    snapshot("Початкова таблиця")

    num_pivots = 0
    for iteration in range(200):
        obj_row = T[m, :n_total]

        # Optimality: all reduced costs >= 0
        if np.all(obj_row >= -1e-9):
            break

        # Entering variable: most negative reduced cost (Dantzig's rule)
        p_col = int(np.argmin(obj_row))

        # Unboundedness check
        col_vals = T[:m, p_col]
        if np.all(col_vals <= 1e-9):
            return {"error": "Задача необмежена", "steps": steps}

        # Leaving variable: minimum ratio test
        rhs = T[:m, -1]
        with np.errstate(divide="ignore", invalid="ignore"):
            ratios = np.where(col_vals > 1e-9, rhs / col_vals, np.inf)
        p_row = int(np.argmin(ratios))

        entering = col_names[p_col]
        leaving = col_names[basic[p_row]]

        snapshot(
            f"Ітерація {iteration + 1}: входить {entering}, виходить {leaving}",
            p_row, p_col,
        )

        # Pivot: normalize pivot row, then eliminate pivot column from all other rows
        T[p_row] = T[p_row] / T[p_row, p_col]
        for i in range(m + 1):
            if i != p_row:
                T[i] -= T[i, p_col] * T[p_row]

        basic[p_row] = p_col
        num_pivots += 1

    # Extract primal solution
    x = np.zeros(n_total)
    for i, var in enumerate(basic):
        x[var] = T[i, -1]

    solution = [round(float(v), 10) for v in x[:n]]
    obj_value = float(T[m, -1]) if maximize else -float(T[m, -1])

    if num_pivots == 0:
        steps[0]["description"] = "Оптимальна таблиця (початкове рішення вже є оптимальним)"
    else:
        snapshot("Оптимальна таблиця")

    return {
        "status": "optimal",
        "solution": solution,
        "optimal_value": round(obj_value, 10),
        "steps": steps,
        "num_iterations": num_pivots,
    }
```

---

## А.3 Метод гілок і меж

**Лістинг А.3** — `backend/core/bnb_solver.py` (142 рядки)

Реалізація методу гілок і меж для цілочислових задач. Для розв'язання
LP-релаксації на кожному вузлі використовується `scipy.optimize.linprog`
(метод HiGHS). Стратегія вибору змінної для розгалуження — *most fractional*
(найдробовіша, тобто найближча до 0.5). Відсікання гілок виконується за
правилом меж: вузол відкидається, якщо його LP-значення не може покращити
поточний рекорд.

```python
import math
import numpy as np
from scipy.optimize import linprog
from typing import List, Dict, Any, Optional, Tuple


def solve_branch_and_bound(
    c: List[float],
    A_ub: List[List[float]],
    b_ub: List[float],
    maximize: bool = False,
    var_bounds: Optional[List[List[Optional[float]]]] = None,
) -> Dict[str, Any]:
    """
    Solve ILP:  min/max  c^T x
                s.t.     A_ub x <= b_ub,  x >= 0,  x integer

    Returns a list of B&B tree nodes suitable for ReactFlow visualization.
    """
    c_arr = np.array(c, dtype=float)
    A_arr = np.array(A_ub, dtype=float)
    b_arr = np.array(b_ub, dtype=float)
    n = len(c)

    # Internal representation: always minimize
    c_min = -c_arr if maximize else c_arr

    if var_bounds is None:
        bounds: List[Tuple[float, Optional[float]]] = [(0.0, None)] * n
    else:
        bounds = [(float(b[0]), float(b[1]) if b[1] is not None else None) for b in var_bounds]

    nodes: List[Dict[str, Any]] = []
    _id = [0]
    _best_obj = [math.inf]   # best minimization value found so far
    _best_sol = [None]       # corresponding solution vector

    def _new_id() -> int:
        nid = _id[0]
        _id[0] += 1
        return nid

    def _solve_lp(node_bounds: List[Tuple]) -> Any:
        return linprog(c_min, A_ub=A_arr, b_ub=b_arr, bounds=node_bounds, method="highs")

    def _bnb(
        parent_id: Optional[int],
        node_bounds: List[Tuple],
        depth: int,
        label: str,
    ) -> None:
        nid = _new_id()
        result = _solve_lp(node_bounds)

        node: Dict[str, Any] = {
            "id": nid,
            "parent_id": parent_id,
            "depth": depth,
            "label": label,
            "bounds": [[b[0], b[1]] for b in node_bounds],
        }

        # Infeasible subproblem
        if result.status != 0:
            node["status"] = "infeasible"
            node["lp_value"] = None
            node["solution"] = None
            nodes.append(node)
            return

        lp_min = float(result.fun)
        lp_display = -lp_min if maximize else lp_min
        node["lp_value"] = round(lp_display, 8)
        node["solution"] = [round(float(v), 8) for v in result.x]

        # Prune: LP bound is no better than the best integer solution found
        if lp_min >= _best_obj[0] - 1e-9:
            node["status"] = "pruned"
            nodes.append(node)
            return

        # Find most fractional variable (closest to 0.5)
        frac_idx: Optional[int] = None
        frac_max = 0.0
        for i, val in enumerate(result.x):
            frac_part = val - math.floor(val)
            dist = min(frac_part, 1.0 - frac_part)
            if dist > 1e-6:
                if dist > frac_max:
                    frac_max = dist
                    frac_idx = i

        # All variables are integer — update best solution
        if frac_idx is None:
            node["status"] = "integer"
            if lp_min < _best_obj[0]:
                _best_obj[0] = lp_min
                _best_sol[0] = result.x.copy()
            nodes.append(node)
            return

        # Branch on frac_idx
        node["status"] = "branched"
        node["branch_var"] = frac_idx
        node["branch_value"] = round(float(result.x[frac_idx]), 8)
        nodes.append(node)

        frac_val = result.x[frac_idx]
        floor_val = math.floor(frac_val)
        ceil_val = math.ceil(frac_val)
        var_label = f"x{frac_idx + 1}"

        # Left child: x_i <= floor(frac_val)
        left_bounds = [b for b in node_bounds]
        lb, ub = node_bounds[frac_idx]
        left_bounds[frac_idx] = (lb, float(floor_val))
        _bnb(nid, left_bounds, depth + 1, f"{var_label} ≤ {floor_val}")

        # Right child: x_i >= ceil(frac_val)
        right_bounds = [b for b in node_bounds]
        right_bounds[frac_idx] = (float(ceil_val), ub)
        _bnb(nid, right_bounds, depth + 1, f"{var_label} ≥ {ceil_val}")

    _bnb(None, bounds, 0, "LP-релаксація")

    if _best_sol[0] is None:
        return {
            "status": "infeasible",
            "nodes": nodes,
            "total_nodes": len(nodes),
        }

    raw_obj = float(_best_obj[0])
    optimal_value = -raw_obj if maximize else raw_obj

    return {
        "status": "optimal",
        "solution": [round(float(v), 8) for v in _best_sol[0]],
        "optimal_value": round(optimal_value, 8),
        "nodes": nodes,
        "total_nodes": len(nodes),
    }
```

---

## А.4 Метод потенціалів (транспортна задача)

**Лістинг А.4** — `backend/core/transport_solver.py` (222 рядки)

Реалізація класичного методу потенціалів (MODI) для збалансованої транспортної
задачі. Етапи: балансування (з додаванням фіктивного постачальника/споживача
для незбалансованих задач), побудова початкового плану методом північно-західного
кута, ітеративне обчислення потенціалів `u_i, v_j`, оцінок `Δ_ij`, пошук циклу
перерозподілу через DFS та перерозподіл по циклу.

```python
import numpy as np
from typing import List, Dict, Any, Optional, Tuple, Set


def solve_transport(
    supply: List[float],
    demand: List[float],
    costs: List[List[float]],
) -> Dict[str, Any]:
    """
    Solve the balanced transportation problem using the Method of Potentials (MODI).

    Args:
        supply: supply at each source [s1, ..., sm]
        demand: demand at each destination [d1, ..., dn]
        costs:  cost matrix costs[i][j], shape (m, n)

    Returns a dict with status, allocation, optimal_value, steps, num_iterations.
    """
    supply = [float(s) for s in supply]
    demand = [float(d) for d in demand]
    costs_arr = np.array(costs, dtype=float)

    m_orig = len(supply)
    n_orig = len(demand)

    if costs_arr.shape != (m_orig, n_orig):
        return {"error": f"Матриця витрат має бути розміром {m_orig}×{n_orig}"}
    if any(s < 0 for s in supply):
        return {"error": "Запаси постачальників мають бути ≥ 0"}
    if any(d < 0 for d in demand):
        return {"error": "Потреби споживачів мають бути ≥ 0"}

    total_supply = sum(supply)
    total_demand = sum(demand)

    # Balance the problem by adding a dummy source or destination
    dummy_col = dummy_row = False
    if total_supply > total_demand + 1e-9:
        demand = demand + [total_supply - total_demand]
        costs_arr = np.hstack([costs_arr, np.zeros((m_orig, 1))])
        dummy_col = True
    elif total_demand > total_supply + 1e-9:
        supply = supply + [total_demand - total_supply]
        costs_arr = np.vstack([costs_arr, np.zeros((1, n_orig))])
        dummy_row = True

    m = len(supply)
    n = len(demand)

    # ── Initial basic feasible solution: North-West corner method ──────────────
    allocation = np.zeros((m, n))
    basic_cells: List[Tuple[int, int]] = []

    sup = supply.copy()
    dem = demand.copy()
    i, j = 0, 0
    while i < m and j < n:
        amt = min(sup[i], dem[j])
        allocation[i, j] = amt
        sup[i] -= amt
        dem[j] -= amt
        if (i, j) not in basic_cells:
            basic_cells.append((i, j))
        if sup[i] < 1e-10 and dem[j] < 1e-10:
            # Degenerate step — advance both but keep only one basis cell
            if i + 1 < m:
                i += 1
            else:
                j += 1
        elif sup[i] < 1e-10:
            i += 1
        else:
            j += 1

    # Ensure we have exactly m+n-1 basic cells (add epsilon cells for degeneracy)
    all_cells = {(r, c) for r in range(m) for c in range(n)}
    basic_set: Set[Tuple[int, int]] = set(basic_cells)
    if len(basic_cells) < m + n - 1:
        for cell in sorted(all_cells - basic_set):
            if len(basic_cells) == m + n - 1:
                break
            basic_cells.append(cell)
            basic_set.add(cell)

    steps: List[Dict[str, Any]] = []

    def _snapshot(desc: str, alloc: np.ndarray,
                  u: list, v: list,
                  delta=None,
                  entering=None,
                  loop=None) -> None:
        steps.append({
            "description": desc,
            "allocation": alloc.tolist(),
            "basic_cells": list(basic_cells),
            "u": [round(x, 6) if x is not None else None for x in u],
            "v": [round(x, 6) if x is not None else None for x in v],
            "delta": [[None if np.isnan(d) else round(float(d), 6) for d in row]
                      for row in delta.tolist()] if delta is not None else None,
            "entering_cell": list(entering) if entering is not None else None,
            "loop": [list(c) for c in loop] if loop is not None else None,
        })

    def _compute_potentials() -> Tuple[list, list]:
        u: List[Optional[float]] = [None] * m
        v: List[Optional[float]] = [None] * n
        u[0] = 0.0
        changed = True
        while changed:
            changed = False
            for (bi, bj) in basic_cells:
                if u[bi] is not None and v[bj] is None:
                    v[bj] = costs_arr[bi, bj] - u[bi]
                    changed = True
                elif v[bj] is not None and u[bi] is None:
                    u[bi] = costs_arr[bi, bj] - v[bj]
                    changed = True
        return u, v

    def _find_loop(enter_r: int, enter_c: int) -> Optional[List[Tuple[int, int]]]:
        """Find improvement loop via DFS; returns list of (row, col) pairs."""
        bset = set(basic_cells)

        def dfs(path: List[Tuple[int, int]], move_col: bool):
            r, c = path[-1]
            path_set = set(path[1:])
            if move_col:
                # Move vertically (same column c, different row)
                for (br, bc) in bset:
                    if bc == c and br != r and (br, bc) not in path_set:
                        result = dfs(path + [(br, bc)], False)
                        if result:
                            return result
            else:
                # Move horizontally (same row r, different col)
                for (br, bc) in bset:
                    if br == r and bc != c and (br, bc) not in path_set:
                        if bc == enter_c and len(path) >= 3:
                            return path + [(br, bc)]
                        result = dfs(path + [(br, bc)], True)
                        if result:
                            return result
            return None

        return dfs([(enter_r, enter_c)], False)

    # Initial snapshot (no potentials yet)
    _snapshot("Початковий розподіл (метод північно-західного кута)",
              allocation.copy(), [None] * m, [None] * n)

    num_iterations = 0
    for iteration in range(200):
        u, v = _compute_potentials()

        # Compute reduced costs for non-basic cells
        bset = set(basic_cells)
        delta = np.full((m, n), np.nan)
        entering: Optional[Tuple[int, int]] = None
        min_delta = -1e-9

        for ii in range(m):
            for jj in range(n):
                if (ii, jj) not in bset:
                    if u[ii] is not None and v[jj] is not None:
                        d = costs_arr[ii, jj] - u[ii] - v[jj]
                        delta[ii, jj] = d
                        if d < min_delta:
                            min_delta = d
                            entering = (ii, jj)

        if entering is None:
            # Optimality reached
            label = "Оптимальна таблиця" if num_iterations == 0 else f"Оптимальна таблиця (ітерація {iteration + 1})"
            _snapshot(label, allocation.copy(), u, v, delta, None, None)
            break

        # Find the loop
        loop = _find_loop(entering[0], entering[1])
        if loop is None:
            return {"error": "Не вдалося знайти цикл покращення (вироджена задача)"}

        _snapshot(
            f"Ітерація {iteration + 1}: вхідна клітина ({entering[0] + 1},{entering[1] + 1})",
            allocation.copy(), u, v, delta, entering, loop,
        )

        # Redistribute: even-indexed cells get +theta, odd-indexed get -theta
        minus_cells = [loop[k] for k in range(1, len(loop), 2)]
        theta = min(allocation[r, c] for r, c in minus_cells)

        for k, (r, c) in enumerate(loop):
            allocation[r, c] += theta if k % 2 == 0 else -theta

        # Remove the first minus_cell that reached 0 from the basis
        leaving: Optional[Tuple[int, int]] = None
        for r, c in minus_cells:
            if abs(allocation[r, c]) < 1e-10:
                allocation[r, c] = 0.0
                leaving = (r, c)
                break

        if leaving is not None:
            basic_cells.remove(leaving)
        basic_cells.append(entering)
        num_iterations += 1
    else:
        return {"error": "Метод потенціалів не збіжився за максимальну кількість ітерацій"}

    # Trim dummy row/column from the result allocation
    result_alloc = allocation[:m_orig, :n_orig]
    obj_value = float(np.sum(allocation[:m_orig, :n_orig] * np.array(costs)[:m_orig, :n_orig]))

    return {
        "status": "optimal",
        "allocation": [[round(float(v), 6) for v in row] for row in result_alloc.tolist()],
        "optimal_value": round(obj_value, 6),
        "steps": steps,
        "num_iterations": num_iterations,
        "dummy_row": dummy_row,
        "dummy_col": dummy_col,
    }
```

---

## А.5 Валідатори дій студента

**Лістинг А.5** — `backend/core/validator.py` (360 рядків)

Шість функцій для перевірки дій студента в інтерактивному покроковому режимі:
вибір ведучого стовпця/рядка симплексу, ручний перерахунок таблиці у сліпому
режимі, вибір змінної для розгалуження у методі гілок і меж, обчислення
потенціалів і вибір вхідної клітинки у транспортній задачі. Усі функції
повертають уніфіковану структуру `{valid, message, ...}` з конкретними
підказками українською мовою.

```python
import math
import numpy as np
from typing import List, Dict, Any, Optional


def validate_simplex_pivot(
    tableau: List[List[float]],
    col_names: List[str],
    user_pivot_col: int,
    user_pivot_row: int,
) -> Dict[str, Any]:
    """
    Validate a student's pivot selection against the correct simplex choice.
    Returns dict: {valid, message, correct_col, correct_row, hint}.
    """
    T = np.array(tableau, dtype=float)
    m = T.shape[0] - 1
    n_total = T.shape[1] - 1

    obj_row = T[m, :n_total]

    min_val = float(np.min(obj_row))
    if min_val >= -1e-9:
        return {
            "valid": False,
            "message": "Таблиця вже оптимальна — жодний рядок не потребує зведення.",
            "correct_col": None, "correct_row": None,
            "hint": "Перевірте рядок цільової функції: всі коефіцієнти ≥ 0.",
        }

    correct_col = int(np.argmin(obj_row))
    col_vals = T[:m, correct_col]
    rhs = T[:m, -1]
    with np.errstate(divide="ignore", invalid="ignore"):
        ratios = np.where(col_vals > 1e-9, rhs / col_vals, np.inf)
    correct_row = int(np.argmin(ratios))

    col_ok = user_pivot_col == correct_col
    row_ok = user_pivot_row == correct_row

    if col_ok and row_ok:
        return {
            "valid": True,
            "message": "Правильно! Ведучий стовпець і рядок вибрані вірно.",
            "correct_col": correct_col, "correct_row": correct_row, "hint": None,
        }

    if not col_ok:
        name = col_names[correct_col] if correct_col < len(col_names) else str(correct_col)
        return {
            "valid": False,
            "message": (
                "Неправильний ведучий стовпець. Слід обирати змінну з "
                "найбільшим від'ємним коефіцієнтом у рядку цільової функції."
            ),
            "correct_col": correct_col, "correct_row": correct_row,
            "hint": f"Найбільший від'ємний коефіцієнт у рядку z — у стовпці «{name}» (значення {min_val:.4f}).",
        }

    min_ratio = float(ratios[correct_row])
    user_ratio = float(ratios[user_pivot_row]) if user_pivot_row < m else math.inf
    return {
        "valid": False,
        "message": (
            "Неправильний ведучий рядок. "
            "Застосуйте правило мінімального відношення θ = RHS / a_ij (тільки для a_ij > 0)."
        ),
        "correct_col": correct_col, "correct_row": correct_row,
        "hint": (
            f"Мінімальне θ = {min_ratio:.4f} у рядку {correct_row + 1}. "
            f"Ви обрали рядок {user_pivot_row + 1} (θ = {user_ratio:.4f})."
        ),
    }


def validate_transport_allocation(
    costs: List[List[float]],
    supply: List[float],
    demand: List[float],
    user_allocation: List[List[float]],
) -> Dict[str, Any]:
    """Validate a student's final transport allocation."""
    m = len(supply)
    n = len(demand)

    if len(user_allocation) != m:
        return {"valid": False, "message": f"Матриця розподілу повинна мати {m} рядків."}
    for row in user_allocation:
        if len(row) != n:
            return {"valid": False, "message": f"Кожен рядок матриці розподілу повинен мати {n} елементів."}

    alloc = np.array(user_allocation, dtype=float)

    if np.any(alloc < -1e-9):
        return {"valid": False, "message": "Усі значення розподілу мають бути невід'ємними."}

    row_sums = alloc.sum(axis=1)
    for i, (rs, s) in enumerate(zip(row_sums, supply)):
        if abs(rs - s) > 1e-6:
            return {
                "valid": False,
                "message": f"Порушено умову постачальника {i + 1}: відправлено {rs:.4f}, потрібно {s}.",
            }

    col_sums = alloc.sum(axis=0)
    for j, (cs, d) in enumerate(zip(col_sums, demand)):
        if abs(cs - d) > 1e-6:
            return {
                "valid": False,
                "message": f"Порушено умову споживача {j + 1}: отримано {cs:.4f}, потрібно {d}.",
            }

    C = np.array(costs, dtype=float)
    user_cost = float(np.sum(C * alloc))

    return {
        "valid": True,
        "message": "Правильно! Розподіл задовольняє всі обмеження.",
        "total_cost": round(user_cost, 6),
    }


def validate_bnb_branch(
    lp_solution: List[float],
    user_branch_var: int,
) -> Dict[str, Any]:
    """
    Validate which variable the student chooses to branch on.
    Correct choice is the most fractional variable (closest to 0.5).
    """
    best_idx: Optional[int] = None
    best_dist = 0.0
    fractional_vars = []

    for i, val in enumerate(lp_solution):
        frac = val - math.floor(val)
        if frac > 1e-6:
            dist = min(frac, 1.0 - frac)
            fractional_vars.append(i)
            if dist > best_dist:
                best_dist = dist
                best_idx = i

    if best_idx is None:
        return {
            "valid": False,
            "message": "Всі змінні цілочисельні — розгалуження не потрібне.",
            "correct_var": None, "hint": None,
        }

    if user_branch_var == best_idx:
        frac = lp_solution[best_idx] - math.floor(lp_solution[best_idx])
        return {
            "valid": True,
            "message": f"Правильно! Змінна x{best_idx + 1} є найдробовішою (дробова частина ≈ {frac:.4f}).",
            "correct_var": best_idx, "hint": None,
        }

    user_frac = lp_solution[user_branch_var] - math.floor(lp_solution[user_branch_var])
    best_frac = lp_solution[best_idx] - math.floor(lp_solution[best_idx])

    if user_frac < 1e-6:
        hint = (
            f"x{user_branch_var + 1} = {lp_solution[user_branch_var]:.4g} — ціле число, "
            f"по ньому розгалуження не виконується. "
            f"Правильний вибір: x{best_idx + 1} (дробова частина {best_frac:.4f})."
        )
    else:
        hint = (
            f"x{best_idx + 1} має дробову частину {best_frac:.4f} — "
            f"ближчу до 0.5, ніж x{user_branch_var + 1} ({user_frac:.4f})."
        )

    return {
        "valid": False,
        "message": (
            "Неправильний вибір змінної для розгалуження. "
            "Слід обирати змінну з найбільшою дробовою частиною (стратегія «most fractional»)."
        ),
        "correct_var": best_idx, "hint": hint,
    }


def validate_simplex_tableau(
    prev_tableau: List[List[float]],
    pivot_col: int,
    pivot_row: int,
    student_tableau: List[List[float]],
) -> Dict[str, Any]:
    """Compare student's hand-computed next tableau with the correct pivot result."""
    T = np.array(prev_tableau, dtype=float)
    T[pivot_row] = T[pivot_row] / T[pivot_row, pivot_col]
    for i in range(len(T)):
        if i != pivot_row:
            T[i] -= T[i, pivot_col] * T[pivot_row]

    expected = T.tolist()
    S = np.array(student_tableau, dtype=float)

    if S.shape != T.shape:
        return {"valid": False, "message": "Розмір таблиці не збігається.",
                "errors": [], "expected_tableau": expected}

    errors = []
    for r in range(len(expected)):
        for c in range(len(expected[r])):
            if abs(expected[r][c] - float(S[r][c])) > 1e-3:
                errors.append({
                    "row": r, "col": c,
                    "expected": round(expected[r][c], 4),
                    "got": round(float(S[r][c]), 4),
                })

    if not errors:
        return {"valid": True, "message": "Таблицю обчислено правильно!",
                "errors": [], "expected_tableau": expected}

    return {
        "valid": False,
        "message": f"Знайдено {len(errors)} помилок у таблиці. Перевірте виділені клітинки.",
        "errors": errors,
        "expected_tableau": [[round(v, 4) for v in row] for row in expected],
    }


def validate_transport_potentials(
    basic_cells: List[List[int]],
    costs: List[List[float]],
    student_u: List[Optional[float]],
    student_v: List[Optional[float]],
) -> Dict[str, Any]:
    """Validate student-computed potentials u_i, v_j (u[0] = 0 convention)."""
    m, n = len(student_u), len(student_v)
    C = np.array(costs, dtype=float)

    u: List[Optional[float]] = [None] * m
    v: List[Optional[float]] = [None] * n
    u[0] = 0.0
    changed = True
    while changed:
        changed = False
        for (bi, bj) in basic_cells:
            if bi < m and bj < n:
                if u[bi] is not None and v[bj] is None:
                    v[bj] = float(C[bi, bj]) - u[bi]
                    changed = True
                elif v[bj] is not None and u[bi] is None:
                    u[bi] = float(C[bi, bj]) - v[bj]
                    changed = True

    errors = []
    for i, (su, cu) in enumerate(zip(student_u, u)):
        if cu is None:
            continue
        if su is None or abs(float(su) - cu) > 1e-3:
            errors.append({"type": "u", "index": i, "expected": round(cu, 4), "got": su})

    for j, (sv, cv) in enumerate(zip(student_v, v)):
        if cv is None:
            continue
        if sv is None or abs(float(sv) - cv) > 1e-3:
            errors.append({"type": "v", "index": j, "expected": round(cv, 4), "got": sv})

    if not errors:
        return {
            "valid": True,
            "message": "Потенціали обчислені правильно!",
            "errors": [],
            "u": [round(x, 4) if x is not None else None for x in u],
            "v": [round(x, 4) if x is not None else None for x in v],
        }

    return {
        "valid": False,
        "message": f"Знайдено {len(errors)} помилок. Пам'ятайте: u₀ = 0, а для базисних клітинок c_ij = u_i + v_j.",
        "errors": errors,
        "u": [round(x, 4) if x is not None else None for x in u],
        "v": [round(x, 4) if x is not None else None for x in v],
    }


def validate_transport_entering(
    u: List[float],
    v: List[float],
    costs: List[List[float]],
    basic_cells: List[List[int]],
    user_row: int,
    user_col: int,
) -> Dict[str, Any]:
    """Validate which non-basic cell the student chose as entering (most negative delta)."""
    C = np.array(costs, dtype=float)
    m, n = C.shape
    basic_set = {(r, c) for r, c in basic_cells if r < m and c < n}

    best_delta = 0.0
    best_cell = None
    for i in range(m):
        for j in range(n):
            if (i, j) in basic_set:
                continue
            if u[i] is None or v[j] is None:
                continue
            delta = float(C[i, j]) - float(u[i]) - float(v[j])
            if delta < best_delta - 1e-9:
                best_delta = delta
                best_cell = (i, j)

    if best_cell is None:
        return {
            "valid": True,
            "message": "Усі оцінки Δ ≥ 0 — поточний план оптимальний, вхідної клітинки немає.",
            "optimal": True,
        }

    user_delta = float(C[user_row, user_col]) - float(u[user_row]) - float(v[user_col])
    if (user_row, user_col) == best_cell:
        return {
            "valid": True,
            "message": f"Правильно! Клітинка ({user_row+1},{user_col+1}) має Δ = {best_delta:.4f} — найменше серед від'ємних.",
            "optimal": False,
            "correct_cell": list(best_cell),
        }

    return {
        "valid": False,
        "message": (
            f"Неправильний вибір. Клітинка ({user_row+1},{user_col+1}) має Δ = {user_delta:.4f}, "
            f"але мінімальне Δ = {best_delta:.4f} у клітинці ({best_cell[0]+1},{best_cell[1]+1})."
        ),
        "optimal": False,
        "correct_cell": list(best_cell),
        "hint": "Обирайте клітинку з найбільшим від'ємним значенням Δ_ij = c_ij − u_i − v_j.",
    }
```

---

## А.6 Генератор випадкових задач

**Лістинг А.6** — `backend/core/generator.py` (109 рядків)

Три функції для генерації випадкових задач для всіх трьох методів. Випадкові
коефіцієнти підбираються з гарантованою допустимістю та нетривіальністю
розв'язку. Для ЦП-задачі додатково перевіряється, що LP-релаксація має дробовий
розв'язок (щоб метод гілок і меж справді виконав розгалуження).

```python
import math
import random
from typing import Any, Dict, Optional

import numpy as np
from scipy.optimize import linprog


def generate_lp(
    n_vars: int = 2,
    n_constraints: int = 3,
    maximize: bool = True,
    seed: Optional[int] = None,
    max_attempts: int = 30,
) -> Optional[Dict[str, Any]]:
    rng = random.Random(seed)

    for _ in range(max_attempts):
        c = [rng.randint(1, 9) for _ in range(n_vars)]
        A = [[rng.randint(1, 6) for _ in range(n_vars)] for _ in range(n_constraints)]
        b = [rng.randint(n_vars * 4, n_vars * 12) for _ in range(n_constraints)]

        c_min = [-v for v in c] if maximize else c[:]
        result = linprog(c_min, A_ub=A, b_ub=b, bounds=[(0, None)] * n_vars, method="highs")

        if result.status != 0:
            continue
        if all(abs(v) < 1e-6 for v in result.x):
            continue

        opt = -result.fun if maximize else result.fun
        return {
            "c": c, "A": A, "b": b, "maximize": maximize,
            "expected": {
                "optimal_value": round(opt, 4),
                "solution": [round(v, 4) for v in result.x],
            },
        }
    return None


def generate_ilp(
    n_vars: int = 2,
    n_constraints: int = 3,
    maximize: bool = True,
    seed: Optional[int] = None,
    max_attempts: int = 40,
) -> Optional[Dict[str, Any]]:
    from core.bnb_solver import solve_branch_and_bound
    rng = random.Random(seed)

    for _ in range(max_attempts):
        c = [rng.randint(1, 9) for _ in range(n_vars)]
        A = [[rng.randint(1, 6) for _ in range(n_vars)] for _ in range(n_constraints)]
        b = [rng.randint(n_vars * 3, n_vars * 9) for _ in range(n_constraints)]

        c_min = [-v for v in c] if maximize else c[:]
        lp = linprog(c_min, A_ub=A, b_ub=b, bounds=[(0, None)] * n_vars, method="highs")
        if lp.status != 0:
            continue

        # Require truly fractional LP relaxation
        fracs = [min(v - math.floor(v), 1 - (v - math.floor(v))) for v in lp.x]
        if not any(f > 1e-3 for f in fracs):
            continue

        res = solve_branch_and_bound(c=c, A_ub=A, b_ub=b, maximize=maximize)
        if res.get("status") != "optimal":
            continue
        if all(abs(v) < 1e-6 for v in res["solution"]):
            continue

        return {
            "c": c, "A": A, "b": b, "maximize": maximize,
            "expected": {
                "optimal_value": res["optimal_value"],
                "solution": [round(v) for v in res["solution"]],
            },
        }
    return None


def generate_transport(
    n_sources: int = 3,
    n_dests: int = 3,
    seed: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    from core.transport_solver import solve_transport
    rng = random.Random(seed)

    supply = [rng.randint(10, 50) for _ in range(n_sources)]
    demand = [rng.randint(10, 50) for _ in range(n_dests)]

    ts, td = sum(supply), sum(demand)
    if ts > td:
        demand[-1] += ts - td
    elif td > ts:
        supply[-1] += td - ts

    costs = [[rng.randint(1, 20) for _ in range(n_dests)] for _ in range(n_sources)]

    res = solve_transport(supply=supply, demand=demand, costs=costs)
    if "error" in res:
        return None

    return {
        "supply": supply, "demand": demand, "costs": costs,
        "expected": {"optimal_value": res["optimal_value"]},
    }
```

---

## А.7 REST API

**Лістинг А.7** — `backend/api/routes.py` (фрагменти)

Усі 18 ендпоінтів зібрано у Flask Blueprint `api_bp` з префіксом `/api`.
Нижче наведено ключові фрагменти: розв'язувачі та валідатори. Повний код
доступний у файлі `backend/api/routes.py`.

```python
from flask import Blueprint, request, jsonify
from core.simplex_solver import solve_simplex
from core.bnb_solver import solve_branch_and_bound
from core.transport_solver import solve_transport
from core.validator import (
    validate_simplex_pivot,
    validate_bnb_branch,
    validate_transport_allocation,
    validate_simplex_tableau,
    validate_transport_potentials,
    validate_transport_entering,
)
from core.generator import generate_lp, generate_ilp, generate_transport

api_bp = Blueprint("api", __name__)


@api_bp.route("/simplex", methods=["POST"])
def simplex_endpoint():
    """Solve LP via simplex method, return step-by-step tableaux."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    for field in ("c", "A", "b"):
        if field not in data:
            return jsonify({"error": f"Відсутнє поле: {field}"}), 400
    try:
        result = solve_simplex(
            c=data["c"], A=data["A"], b=data["b"],
            maximize=bool(data.get("maximize", False)),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/branch-and-bound", methods=["POST"])
def branch_and_bound_endpoint():
    """Solve ILP via branch-and-bound, return tree of nodes."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    try:
        result = solve_branch_and_bound(
            c=data["c"], A_ub=data["A"], b_ub=data["b"],
            maximize=bool(data.get("maximize", False)),
            var_bounds=data.get("var_bounds"),
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/transport", methods=["POST"])
def transport_endpoint():
    """Solve balanced transportation problem via MODI."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
    try:
        result = solve_transport(
            supply=data["supply"], demand=data["demand"], costs=data["costs"],
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@api_bp.route("/simplex/check", methods=["POST"])
def simplex_check():
    """Validate student's pivot column/row choice."""
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Очікується JSON"}), 400
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


@api_bp.route("/generate", methods=["GET"])
def generate_task():
    """Generate a random task of the specified type."""
    task_type = request.args.get("type", "simplex")
    n_vars = int(request.args.get("vars", 2))
    n_constraints = int(request.args.get("constraints", 3))

    if task_type == "simplex":
        problem = generate_lp(n_vars=n_vars, n_constraints=n_constraints)
    elif task_type == "branch_and_bound":
        problem = generate_ilp(n_vars=n_vars, n_constraints=n_constraints)
    elif task_type == "transport":
        problem = generate_transport(n_sources=n_vars, n_dests=n_constraints)
    else:
        return jsonify({"error": f"Невідомий тип задачі: {task_type}"}), 400

    if problem is None:
        return jsonify({"error": "Не вдалося згенерувати задачу"}), 500
    return jsonify({"type": task_type, "problem": problem})
```

---

## Підсумок обсягу коду в Додатку А

| Модуль | Файл | Рядків |
|--------|------|--------|
| Точка входу | `backend/app.py` | 30 |
| Симплекс-метод | `backend/core/simplex_solver.py` | 123 |
| Метод гілок і меж | `backend/core/bnb_solver.py` | 142 |
| Метод потенціалів | `backend/core/transport_solver.py` | 222 |
| Валідатори | `backend/core/validator.py` | 360 |
| Генератор задач | `backend/core/generator.py` | 109 |
| REST API (фрагменти) | `backend/api/routes.py` | 419 (повний) |
| **Разом ключових модулів** | | **≈ 1 405** |

> Повний код проєкту з фронтенд-частиною (≈ 5 000 рядків TypeScript/React)
> доступний у репозиторії: <https://github.com/pavelgh88/Diplom>
