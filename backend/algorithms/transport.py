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
            path_set = set(path[1:])  # exclude entering cell from "visited"
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
