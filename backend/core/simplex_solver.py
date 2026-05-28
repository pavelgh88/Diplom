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

        # Leaving variable: minimum ratio test (errstate suppresses divide-by-zero on masked rows)
        rhs = T[:m, -1]
        with np.errstate(divide="ignore", invalid="ignore"):
            ratios = np.where(col_vals > 1e-9, rhs / col_vals, np.inf)
        p_row = int(np.argmin(ratios))

        entering = col_names[p_col]
        leaving = col_names[basic[p_row]]

        snapshot(
            f"Ітерація {iteration + 1}: входить {entering}, виходить {leaving}",
            p_row,
            p_col,
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
        # No pivots needed — relabel the initial snapshot instead of adding a duplicate
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
