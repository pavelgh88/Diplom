import pytest
from algorithms.branch_and_bound import solve_branch_and_bound


class TestBranchAndBoundBasic:
    def test_simple_ilp_maximize(self):
        # max x1 + x2  s.t. x1+x2 <= 3.5  => integer opt = 3
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 3) < 1e-6

    def test_simple_ilp_minimize(self):
        # min -x1  s.t. x1 <= 4.9  => x1=4 (integer), obj=-4
        result = solve_branch_and_bound([-1], [[1]], [4.9])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - (-4)) < 1e-6
        assert abs(result["solution"][0] - 4) < 1e-6

    def test_integer_relaxation_optimal(self):
        # LP relaxation already gives integer solution: x1<=3, x2<=3, max x1+x2 => 6
        result = solve_branch_and_bound([1, 1], [[1, 0], [0, 1]], [3, 3], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 6) < 1e-6

    def test_infeasible(self):
        # x1+x2 <= -1, x1,x2>=0 => infeasible
        result = solve_branch_and_bound([1, 1], [[1, 1]], [-1])
        assert result["status"] == "infeasible"

    def test_classic_knapsack_like(self):
        # max 3x1 + 5x2  s.t. 2x1+4x2 <= 10, x1+x2 <= 4
        # Corner points: x1=3,x2=1 → obj=14 (LP optimal AND integer feasible)
        result = solve_branch_and_bound([3, 5], [[2, 4], [1, 1]], [10, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 14) < 1e-6


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
        # Every branched node must have at least one child
        assert branched_ids.issubset(children_parent_ids)

    def test_integer_nodes_have_solution(self):
        result = solve_branch_and_bound([1, 1], [[1, 1]], [3.5], maximize=True)
        integer_nodes = [n for n in result["nodes"] if n["status"] == "integer"]
        assert len(integer_nodes) >= 1
        for node in integer_nodes:
            assert node["solution"] is not None
            assert node["lp_value"] is not None


class TestBranchAndBoundBounds:
    def test_custom_var_bounds(self):
        # max x1  s.t. x1 <= 10, but bound x1 in [0, 3]
        result = solve_branch_and_bound([1], [[1]], [10], maximize=True, var_bounds=[[0, 3]])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 3) < 1e-6

    def test_tight_bound_forces_branch(self):
        # max x1 + x2  s.t. x1+x2 <= 5.8, both vars in [0, 4]
        result = solve_branch_and_bound(
            [1, 1], [[1, 1]], [5.8], maximize=True, var_bounds=[[0, 4], [0, 4]]
        )
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 5) < 1e-6
