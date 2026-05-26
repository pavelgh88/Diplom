import pytest
from algorithms.branch_and_bound import solve_branch_and_bound


class TestBranchAndBoundBasic:
    def test_simple_ilp_maximize(self):
        # max x1+x2  s.t. x1+x2<=3.5  => integer opt=3
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 3) < 1e-6

    def test_simple_ilp_minimize(self):
        # min -x1  s.t. x1<=4.9  => x1=4, obj=-4
        result = solve_branch_and_bound([-1], [[1]], [4.9])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - (-4)) < 1e-6
        assert abs(result["solution"][0] - 4) < 1e-6

    def test_integer_relaxation_optimal(self):
        # LP relaxation already gives integer: x1<=3, x2<=3, max x1+x2 => 6
        result = solve_branch_and_bound([1, 1], [[1, 0], [0, 1]], [3, 3], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 6) < 1e-6

    def test_infeasible(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [-1])
        assert result["status"] == "infeasible"

    def test_classic_knapsack_like(self):
        # max 3x1+5x2  s.t. 2x1+4x2<=10, x1+x2<=4
        result = solve_branch_and_bound([3, 5], [[2, 4], [1, 1]], [10, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 14) < 1e-6

    def test_symmetric_constraints(self):
        # max x1+x2  s.t. 2x1+x2<=7, x1+2x2<=7 => LP=(7/3,7/3), int=(2,2)=4
        result = solve_branch_and_bound([1, 1], [[2, 1], [1, 2]], [7, 7], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 4) < 1e-6

    def test_two_constraints_integer(self):
        # max 3x1+2x2  s.t. 2x1+x2<=14, x1+2x2<=14 => LP=(14/3,14/3), int=(5,4)=23
        result = solve_branch_and_bound([3, 2], [[2, 1], [1, 2]], [14, 14], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 23) < 1e-6

    def test_taha_classic(self):
        # max x1+x2  s.t. 2x1+5x2<=16, 6x1+5x2<=30 => int opt=5
        result = solve_branch_and_bound([1, 1], [[2, 5], [6, 5]], [16, 30], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 5) < 1e-6

    def test_large_coefficients(self):
        # max 7x1+5x2  s.t. 2x1+x2<=13, x1+2x2<=11 => int (5,3)=50
        result = solve_branch_and_bound([7, 5], [[2, 1], [1, 2]], [13, 11], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 50) < 1e-6


class TestBranchAndBoundTree:
    def test_tree_nodes_present(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        assert "nodes" in result
        assert len(result["nodes"]) > 0
        assert result["total_nodes"] == len(result["nodes"])

    def test_tree_node_structure(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        for node in result["nodes"]:
            assert "id" in node
            assert "parent_id" in node
            assert "depth" in node
            assert "status" in node
            assert "label" in node
            assert node["status"] in ("integer", "infeasible", "pruned", "branched")

    def test_root_has_no_parent(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        root = next(n for n in result["nodes"] if n["depth"] == 0)
        assert root["parent_id"] is None

    def test_branched_nodes_have_children(self):
        result = solve_branch_and_bound([1, 1], [[2, 1], [1, 2]], [7, 7], maximize=True)
        branched_ids = {n["id"] for n in result["nodes"] if n["status"] == "branched"}
        children_parent_ids = {n["parent_id"] for n in result["nodes"] if n["parent_id"] is not None}
        assert branched_ids.issubset(children_parent_ids)

    def test_integer_nodes_have_solution(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        integer_nodes = [n for n in result["nodes"] if n["status"] == "integer"]
        assert len(integer_nodes) >= 1
        for node in integer_nodes:
            assert node["solution"] is not None
            assert node["lp_value"] is not None

    def test_root_is_first_node(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [5.5], maximize=True)
        root = result["nodes"][0]
        assert root["depth"] == 0
        assert root["label"] == "LP-релаксація"

    def test_node_lp_value_bounds(self):
        # Every non-infeasible node LP value >= integer optimum (for maximization)
        result = solve_branch_and_bound([1, 1], [[2, 1], [1, 2]], [7, 7], maximize=True)
        opt = result["optimal_value"]
        for node in result["nodes"]:
            if node["status"] != "infeasible" and node["lp_value"] is not None:
                assert node["lp_value"] >= opt - 1e-6, (
                    f"Node {node['id']} LP value {node['lp_value']} < optimal {opt}"
                )

    def test_depth_increases_with_branching(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        for node in result["nodes"]:
            if node["parent_id"] is not None:
                parent = next(n for n in result["nodes"] if n["id"] == node["parent_id"])
                assert node["depth"] == parent["depth"] + 1


class TestBranchAndBoundBounds:
    def test_custom_var_bounds(self):
        # max x1  s.t. x1<=10, but bound x1 in [0,3]
        result = solve_branch_and_bound([1], [[1]], [10], maximize=True, var_bounds=[[0, 3]])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 3) < 1e-6

    def test_tight_bound_forces_branch(self):
        result = solve_branch_and_bound(
            [1, 1], [[1, 1]], [5.8], maximize=True, var_bounds=[[0, 4], [0, 4]]
        )
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 5) < 1e-6

    def test_zero_upper_bound(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [5], maximize=True, var_bounds=[[0, 0], [0, 0]])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"]) < 1e-6


class TestBranchAndBoundSolution:
    def test_solution_is_integer(self):
        result = solve_branch_and_bound([3, 2], [[2, 1], [1, 2]], [14, 14], maximize=True)
        assert result["status"] == "optimal"
        for val in result["solution"]:
            assert abs(val - round(val)) < 1e-6, f"Solution value {val} is not integer"

    def test_solution_feasible(self):
        A = [[2, 1], [1, 2]]
        b = [14, 14]
        result = solve_branch_and_bound([3, 2], A, b, maximize=True)
        sol = result["solution"]
        for row, rhs in zip(A, b):
            lhs = sum(row[j] * sol[j] for j in range(len(sol)))
            assert lhs <= rhs + 1e-6

    def test_three_variable_ilp(self):
        # max x1+x2+x3  s.t. x1+x2+x3<=4.5, x1<=2, x2<=2, x3<=2
        result = solve_branch_and_bound(
            [1, 1, 1], [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [4.5, 2, 2, 2], maximize=True
        )
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 4) < 1e-6
        for val in result["solution"][:3]:
            assert abs(val - round(val)) < 1e-6
