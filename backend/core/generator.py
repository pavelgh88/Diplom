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
