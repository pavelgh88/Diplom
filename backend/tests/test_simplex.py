import pytest
from algorithms.simplex import solve_simplex


class TestSimplexMinimization:
    def test_basic_two_var(self):
        # min -x1 - x2  s.t. x1+x2<=4, x1<=3, x2<=3
        # Optimal: x1=3, x2=1 or x1=1, x2=3  => obj = -4, sum = 4
        result = solve_simplex([-1, -1], [[1, 1], [1, 0], [0, 1]], [4, 3, 3])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - (-4)) < 1e-6
        assert abs(sum(result["solution"][:2]) - 4) < 1e-6

    def test_single_variable(self):
        # min -x1  s.t. x1 <= 5  => x1=5, obj=-5
        result = solve_simplex([-1], [[1]], [5])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - (-5)) < 1e-6
        assert abs(result["solution"][0] - 5) < 1e-6

    def test_already_optimal_at_origin(self):
        # min x1 + x2  s.t. x1+x2<=10  => x1=x2=0, obj=0
        result = solve_simplex([1, 1], [[1, 1]], [10])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"]) < 1e-6


class TestSimplexMaximization:
    def test_classic_two_var(self):
        # max 3x1 + 5x2  s.t. x1<=4, 2x2<=12, 3x1+5x2<=25
        # Optimal: x1=0, x2=5  => obj=25  (or x1=5/3, x2=12/5...)
        result = solve_simplex([3, 5], [[1, 0], [0, 2], [3, 5]], [4, 12, 25], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 25) < 1e-6

    def test_max_with_tight_constraints(self):
        # max x1 + x2  s.t. x1+x2<=6, x1<=4, x2<=4
        result = solve_simplex([1, 1], [[1, 1], [1, 0], [0, 1]], [6, 4, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 6) < 1e-6


class TestSimplexSteps:
    def test_steps_structure(self):
        result = solve_simplex([-1, -2], [[1, 1], [2, 1]], [4, 6])
        assert "steps" in result
        assert len(result["steps"]) >= 2  # at least initial + optimal snapshot

        for step in result["steps"]:
            assert "description" in step
            assert "tableau" in step
            assert "col_names" in step
            assert "row_names" in step
            assert "basic_vars" in step

    def test_pivot_info_present(self):
        result = solve_simplex([-3, -5], [[1, 0], [0, 2], [3, 5]], [4, 12, 18])
        iteration_steps = [s for s in result["steps"] if "Ітерація" in s["description"]]
        assert len(iteration_steps) >= 1
        for step in iteration_steps:
            assert step["pivot_row"] is not None
            assert step["pivot_col"] is not None

    def test_num_iterations_matches_steps(self):
        result = solve_simplex([-1, -1], [[1, 1], [1, 0], [0, 1]], [4, 3, 3])
        iteration_steps = [s for s in result["steps"] if "Ітерація" in s["description"]]
        assert result["num_iterations"] == len(iteration_steps)


class TestSimplexEdgeCases:
    def test_negative_b_returns_error(self):
        result = solve_simplex([-1], [[1]], [-5])
        assert "error" in result

    def test_three_variables(self):
        # max x1 + x2 + x3  s.t. x1+x2+x3 <= 9, x1<=4, x2<=4, x3<=4
        result = solve_simplex([1, 1, 1], [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [9, 4, 4, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 9) < 1e-6
