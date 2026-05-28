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

    tableau  — current tableau including objective row (last row).
    col_names — column names list (length = num columns - 1, last col is RHS).
    user_pivot_col — 0-based column index chosen by the student.
    user_pivot_row — 0-based row index chosen by the student.

    Returns dict: {valid, message, correct_col, correct_row, hint}.
    """
    T = np.array(tableau, dtype=float)
    m = T.shape[0] - 1      # number of constraint rows
    n_total = T.shape[1] - 1  # columns without RHS

    obj_row = T[m, :n_total]

    # Determine correct pivot column (most negative reduced cost)
    min_val = float(np.min(obj_row))
    if min_val >= -1e-9:
        return {
            "valid": False,
            "message": "Таблиця вже оптимальна — жодний рядок не потребує зведення.",
            "correct_col": None,
            "correct_row": None,
            "hint": "Перевірте рядок цільової функції: всі коефіцієнти ≥ 0.",
        }

    correct_col = int(np.argmin(obj_row))

    # Determine correct pivot row (minimum ratio test on correct_col)
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
            "correct_col": correct_col,
            "correct_row": correct_row,
            "hint": None,
        }

    if not col_ok:
        name = col_names[correct_col] if correct_col < len(col_names) else str(correct_col)
        return {
            "valid": False,
            "message": (
                f"Неправильний ведучий стовпець. "
                f"Слід обирати змінну з найбільшим від'ємним коефіцієнтом у рядку цільової функції."
            ),
            "correct_col": correct_col,
            "correct_row": correct_row,
            "hint": f"Найбільший від'ємний коефіцієнт у рядку z — у стовпці «{name}» (значення {min_val:.4f}).",
        }

    # col_ok but not row_ok
    min_ratio = float(ratios[correct_row])
    user_ratio = float(ratios[user_pivot_row]) if user_pivot_row < m else math.inf
    return {
        "valid": False,
        "message": (
            "Неправильний ведучий рядок. "
            "Застосуйте правило мінімального відношення θ = RHS / a_ij (тільки для a_ij > 0)."
        ),
        "correct_col": correct_col,
        "correct_row": correct_row,
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
    """
    Validate a student's final transport allocation.

    Checks:
    - Supply constraints satisfied.
    - Demand constraints satisfied.
    - Only non-negative values.
    - Total cost matches optimum (within tolerance).
    """
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

    # Check supply
    row_sums = alloc.sum(axis=1)
    for i, (rs, s) in enumerate(zip(row_sums, supply)):
        if abs(rs - s) > 1e-6:
            return {
                "valid": False,
                "message": f"Порушено умову постачальника {i + 1}: відправлено {rs:.4f}, потрібно {s}.",
            }

    # Check demand
    col_sums = alloc.sum(axis=0)
    for j, (cs, d) in enumerate(zip(col_sums, demand)):
        if abs(cs - d) > 1e-6:
            return {
                "valid": False,
                "message": f"Порушено умову споживача {j + 1}: отримано {cs:.4f}, потрібно {d}.",
            }

    # Compute cost
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
            "correct_var": None,
            "hint": None,
        }

    if user_branch_var == best_idx:
        frac = lp_solution[best_idx] - math.floor(lp_solution[best_idx])
        return {
            "valid": True,
            "message": f"Правильно! Змінна x{best_idx + 1} є найдробовішою (дробова частина ≈ {frac:.4f}).",
            "correct_var": best_idx,
            "hint": None,
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
            f"Неправильний вибір змінної для розгалуження. "
            f"Слід обирати змінну з найбільшою дробовою частиною (стратегія «most fractional»)."
        ),
        "correct_var": best_idx,
        "hint": hint,
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
        return {"valid": False, "message": "Розмір таблиці не збігається.", "errors": [], "expected_tableau": expected}

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
        return {"valid": True, "message": "Таблицю обчислено правильно!", "errors": [], "expected_tableau": expected}

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
