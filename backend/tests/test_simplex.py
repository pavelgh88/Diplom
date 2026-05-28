import pytest
from core.simplex_solver import solve_simplex


class TestSimplexMinimization:
    def test_basic_two_var(self):
        # min -x1 - x2  s.t. x1+x2<=4, x1<=3, x2<=3
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

    def test_min_three_variables_bounded(self):
        # min -x1-x2-x3  s.t. x1<=3, x2<=3, x3<=3, x1+x2+x3<=7
        result = solve_simplex([-1, -1, -1], [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]], [3, 3, 3, 7])
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - (-7)) < 1e-6


class TestSimplexMaximization:
    def test_classic_two_var(self):
        # max 3x1+5x2, x1<=4, 2x2<=12, 3x1+5x2<=25 => (0,5), obj=25
        result = solve_simplex([3, 5], [[1, 0], [0, 2], [3, 5]], [4, 12, 25], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 25) < 1e-6

    def test_max_with_tight_constraints(self):
        # max x1+x2  s.t. x1+x2<=6, x1<=4, x2<=4 => obj=6
        result = solve_simplex([1, 1], [[1, 1], [1, 0], [0, 1]], [6, 4, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 6) < 1e-6

    def test_max_two_constraints(self):
        # max 3x1+2x2  s.t. x1+x2<=4, 2x1+x2<=6 => (2,2), obj=10
        result = solve_simplex([3, 2], [[1, 1], [2, 1]], [4, 6], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 10) < 1e-6
        assert abs(result["solution"][0] - 2) < 1e-6
        assert abs(result["solution"][1] - 2) < 1e-6

    def test_max_single_binding_constraint(self):
        # max 5x1+3x2, 2x1+x2<=8, x1+x2<=5 => (3,2), obj=21
        result = solve_simplex([5, 3], [[2, 1], [1, 1]], [8, 5], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 21) < 1e-6

    def test_max_objective_favors_x2(self):
        # max x1+2x2  s.t. x1+x2<=3, x2<=2 => (1,2), obj=5
        result = solve_simplex([1, 2], [[1, 1], [0, 1]], [3, 2], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 5) < 1e-6
        assert abs(result["solution"][1] - 2) < 1e-6

    def test_max_corner_at_axis(self):
        # max 2x1+5x2, x1+2x2<=4, x1+x2<=3 => (0,2), obj=10
        result = solve_simplex([2, 5], [[1, 2], [1, 1]], [4, 3], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 10) < 1e-6

    def test_max_seven_plus_five(self):
        # max 7x1+5x2  s.t. x1+x2<=6, 3x1+x2<=12 => (3,3), obj=36
        result = solve_simplex([7, 5], [[1, 1], [3, 1]], [6, 12], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 36) < 1e-6
        assert abs(result["solution"][0] - 3) < 1e-6
        assert abs(result["solution"][1] - 3) < 1e-6

    def test_max_four_constraints(self):
        # max 4x1+3x2  s.t. x1<=4, x2<=5, x1+x2<=7 => (4,3), obj=25
        result = solve_simplex([4, 3], [[1, 0], [0, 1], [1, 1]], [4, 5, 7], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 25) < 1e-6


class TestSimplexThreeVariables:
    def test_three_variables_basic(self):
        # max x1+x2+x3  s.t. x1+x2+x3<=9, x1<=4, x2<=4, x3<=4
        result = solve_simplex([1, 1, 1], [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [9, 4, 4, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 9) < 1e-6

    def test_three_variables_mixed_coeffs(self):
        # max 2x1+3x2+4x3  s.t. x1+x2+x3<=6, x1<=3, x2<=3, x3<=3 => (0,3,3), obj=21
        result = solve_simplex([2, 3, 4], [[1, 1, 1], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [6, 3, 3, 3], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 21) < 1e-6

    def test_three_variables_large(self):
        # max 5x1+4x2+3x3, resource constraints
        result = solve_simplex([5, 4, 3], [[6, 4, 2], [3, 2, 5], [5, 6, 5]], [240, 270, 420], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 273.75) < 1e-4

    def test_three_variables_sum_constraint(self):
        # max 3x1+x2+4x3, x1+x2+x3<=5, x1+x2<=3, 2x3<=4 => (3,0,2), obj=17
        result = solve_simplex([3, 1, 4], [[1, 1, 1], [1, 1, 0], [0, 0, 2]], [5, 3, 4], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 17) < 1e-6


class TestSimplexSteps:
    def test_steps_structure(self):
        result = solve_simplex([-1, -2], [[1, 1], [2, 1]], [4, 6])
        assert "steps" in result
        assert len(result["steps"]) >= 2

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

    def test_initial_step_present(self):
        result = solve_simplex([3, 5], [[1, 0], [0, 2]], [4, 12], maximize=True)
        assert any("Початкова" in s["description"] or "Крок 0" in s["description"] or s["pivot_col"] is None
                   for s in result["steps"])

    def test_final_step_has_tableau(self):
        result = solve_simplex([3, 2], [[1, 1], [2, 1]], [4, 6], maximize=True)
        last_step = result["steps"][-1]
        assert last_step["tableau"] is not None
        assert len(last_step["tableau"]) >= 2

    def test_steps_tableau_dimensions_consistent(self):
        result = solve_simplex([3, 2], [[1, 1], [2, 1]], [4, 6], maximize=True)
        for step in result["steps"]:
            t = step["tableau"]
            n_cols = len(t[0])
            for row in t:
                assert len(row) == n_cols

    def test_maximize_flag_gives_higher_value(self):
        # Maximizing should give higher value than minimizing same problem
        res_max = solve_simplex([3, 2], [[1, 1], [2, 1]], [4, 6], maximize=True)
        res_min = solve_simplex([3, 2], [[1, 1], [2, 1]], [4, 6], maximize=False)
        assert res_max["optimal_value"] > res_min["optimal_value"]


class TestSimplexEdgeCases:
    def test_negative_b_returns_error(self):
        result = solve_simplex([-1], [[1]], [-5])
        assert "error" in result

    def test_zero_rhs_feasible(self):
        result = solve_simplex([1, 1], [[1, 0], [0, 1]], [0, 0], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"]) < 1e-6

    def test_single_constraint(self):
        # max 2x1+3x2  s.t. x1+x2<=5 => x2=5, obj=15
        result = solve_simplex([2, 3], [[1, 1]], [5], maximize=True)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 15) < 1e-6

    def test_result_has_required_fields(self):
        result = solve_simplex([1, 2], [[1, 1]], [4], maximize=True)
        for field in ("status", "optimal_value", "solution", "steps", "num_iterations"):
            assert field in result, f"Missing field: {field}"

    def test_solution_satisfies_constraints(self):
        A = [[1, 1], [2, 1], [1, 2]]
        b = [4, 6, 6]
        result = solve_simplex([3, 2], A, b, maximize=True)
        assert result["status"] == "optimal"
        sol = result["solution"]
        for i, (row, rhs) in enumerate(zip(A, b)):
            lhs = sum(row[j] * sol[j] for j in range(len(sol)))
            assert lhs <= rhs + 1e-6, f"Constraint {i} violated: {lhs} > {rhs}"
