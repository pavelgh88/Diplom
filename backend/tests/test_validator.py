import pytest
from algorithms.validator import (
    validate_simplex_pivot,
    validate_transport_allocation,
    validate_bnb_branch,
)


class TestSimplexPivotValidation:
    # Tableau for: max 3x1+5x2, x1<=4, 2x2<=12, 3x1+5x2<=25 → initial basis [s1,s2,s3]
    # z-row (min form): -3 -5 0 0 0 | 0
    TABLEAU = [
        [1, 0, 1, 0, 0, 4],
        [0, 2, 0, 1, 0, 12],
        [3, 5, 0, 0, 1, 25],
        [-3, -5, 0, 0, 0, 0],
    ]
    COL_NAMES = ["x1", "x2", "s1", "s2", "s3"]

    def test_correct_pivot_accepted(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 1, 2)
        assert result["valid"] is True
        assert result["correct_col"] == 1
        assert result["correct_row"] == 2

    def test_wrong_pivot_col_rejected(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 0, 2)
        assert result["valid"] is False
        assert result["correct_col"] == 1
        assert "стовпець" in result["message"].lower()

    def test_wrong_pivot_row_rejected(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 1, 0)
        assert result["valid"] is False
        assert result["correct_row"] == 2
        assert "рядок" in result["message"].lower()

    def test_optimal_tableau_returns_no_pivot(self):
        optimal_tableau = [
            [1, 0, 1, 0, 0, 4],
            [0, 1, 0, 0.5, 0, 6],
            [0, 0, -3, -2.5, 1, 2],
            [0, 0, 0, 2.5, 0, 35],
        ]
        result = validate_simplex_pivot(optimal_tableau, self.COL_NAMES, 0, 0)
        assert result["valid"] is False
        assert result["correct_col"] is None

    def test_correct_pivot_returns_hint_none(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 1, 2)
        assert result["hint"] is None

    def test_wrong_col_returns_hint(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 0, 0)
        assert result["hint"] is not None
        assert len(result["hint"]) > 0

    def test_wrong_row_returns_hint_with_theta(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 1, 0)
        assert result["hint"] is not None
        assert "θ" in result["hint"] or "theta" in result["hint"].lower() or "рядок" in result["hint"].lower()

    def test_simple_two_step_tableau(self):
        # Tableau: max x1+x2, x1+x2<=4, x1<=3
        # z-row: -1 -1 0 0 | 0  => col 0 or col 1 are both -1, min is col 0 (argmin)
        tableau = [
            [1, 1, 1, 0, 4],
            [1, 0, 0, 1, 3],
            [-1, -1, 0, 0, 0],
        ]
        col_names = ["x1", "x2", "s1", "s2"]
        result = validate_simplex_pivot(tableau, col_names, 0, 1)
        # Both x1 and x2 have z-coeff -1, so argmin = col 0 (first found)
        assert result["correct_col"] == 0

    def test_message_present_on_failure(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 0, 0)
        assert "message" in result
        assert isinstance(result["message"], str)
        assert len(result["message"]) > 0

    def test_correct_col_and_row_in_response(self):
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 0, 0)
        assert "correct_col" in result
        assert "correct_row" in result


class TestTransportAllocationValidation:
    COSTS = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
    SUPPLY = [30, 40, 30]
    DEMAND = [25, 35, 40]

    def test_correct_allocation_accepted(self):
        allocation = [
            [25, 5, 0],
            [0, 30, 10],
            [0, 0, 30],
        ]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is True
        assert "total_cost" in result

    def test_wrong_supply_rejected(self):
        allocation = [
            [20, 5, 0],
            [5, 30, 5],
            [0, 0, 35],
        ]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is False
        assert "постачальника" in result["message"]

    def test_wrong_demand_rejected(self):
        allocation = [
            [25, 5, 0],
            [0, 30, 10],
            [0, 5, 25],
        ]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is False

    def test_negative_value_rejected(self):
        allocation = [
            [26, 4, 0],
            [-1, 31, 10],
            [0, 0, 30],
        ]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is False
        assert "невід'ємн" in result["message"]

    def test_wrong_matrix_rows(self):
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, [[25, 5, 0]])
        assert result["valid"] is False
        assert "3" in result["message"]

    def test_wrong_matrix_cols(self):
        allocation = [[25, 5], [0, 30], [0, 0]]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is False

    def test_cost_computed_correctly(self):
        allocation = [[25, 5, 0], [0, 30, 10], [0, 0, 30]]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        expected_cost = 25*2 + 5*3 + 30*4 + 10*8 + 30*8
        assert abs(result["total_cost"] - expected_cost) < 1e-4

    def test_2x2_simple_case(self):
        costs = [[1, 2], [3, 4]]
        supply = [10, 10]
        demand = [10, 10]
        allocation = [[10, 0], [0, 10]]
        result = validate_transport_allocation(costs, supply, demand, allocation)
        assert result["valid"] is True
        assert abs(result["total_cost"] - 50) < 1e-4

    def test_valid_message_contains_pravylno(self):
        allocation = [[25, 5, 0], [0, 30, 10], [0, 0, 30]]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is True
        assert "Правильно" in result["message"]


class TestBnBBranchValidation:
    def test_correct_branch_var(self):
        # x1=2.5 (dist=0.5), x3=3.7 (dist=0.3) => x1 most fractional
        solution = [2.5, 1.0, 3.7]
        result = validate_bnb_branch(solution, user_branch_var=0)
        assert result["valid"] is True

    def test_wrong_branch_var(self):
        solution = [2.5, 1.0, 3.7]
        result = validate_bnb_branch(solution, user_branch_var=2)
        assert result["valid"] is False
        assert result["correct_var"] == 0
        assert result["hint"] is not None

    def test_all_integer_solution(self):
        solution = [3.0, 2.0, 1.0]
        result = validate_bnb_branch(solution, user_branch_var=0)
        assert result["valid"] is False
        assert result["correct_var"] is None

    def test_single_fractional_var(self):
        solution = [2.0, 3.7, 1.0]
        result = validate_bnb_branch(solution, user_branch_var=1)
        assert result["valid"] is True
        assert result["correct_var"] == 1

    def test_picking_integer_var_gives_hint(self):
        # x1=3.5 (fractional), x2=2.0 (integer)
        solution = [3.5, 2.0]
        result = validate_bnb_branch(solution, user_branch_var=1)
        assert result["valid"] is False
        assert result["hint"] is not None
        assert "ціле" in result["hint"] or "integer" in result["hint"].lower() or "x1" in result["hint"]

    def test_closest_to_half_chosen(self):
        # x1=2.3 (dist=0.3), x2=3.5 (dist=0.5), x3=4.8 (dist=0.2)
        # x2 most fractional (closest to 0.5)
        solution = [2.3, 3.5, 4.8]
        result = validate_bnb_branch(solution, user_branch_var=1)
        assert result["valid"] is True
        assert result["correct_var"] == 1

    def test_wrong_var_provides_comparison_hint(self):
        solution = [2.3, 3.5, 4.8]
        result = validate_bnb_branch(solution, user_branch_var=0)
        assert result["valid"] is False
        assert result["hint"] is not None

    def test_response_has_required_fields(self):
        solution = [2.5, 1.7]
        result = validate_bnb_branch(solution, user_branch_var=0)
        for field in ("valid", "message", "correct_var", "hint"):
            assert field in result, f"Missing field: {field}"

    def test_nearly_integer_not_fractional(self):
        # 1.9999999 should be treated as integer
        solution = [2.9999999, 3.5]
        result = validate_bnb_branch(solution, user_branch_var=1)
        assert result["valid"] is True
        assert result["correct_var"] == 1

    def test_message_on_correct(self):
        solution = [2.5]
        result = validate_bnb_branch(solution, user_branch_var=0)
        assert result["valid"] is True
        assert "Правильно" in result["message"]
