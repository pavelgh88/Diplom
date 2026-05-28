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

        # Find most fractional variable (closest to 0.5 → maximal branching uncertainty)
        frac_idx: Optional[int] = None
        frac_max = 0.0
        for i, val in enumerate(result.x):
            frac_part = val - math.floor(val)
            dist = min(frac_part, 1.0 - frac_part)
            if dist > 1e-6:  # truly fractional (away from integer on both sides)
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
