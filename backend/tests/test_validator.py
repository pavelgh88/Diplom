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
        # col 1 (x2) has most negative z-coef (-5); min ratio: row1→12/2=6, row2→25/5=5 → row 2
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
        # correct col but wrong row (0 instead of 2)
        result = validate_simplex_pivot(self.TABLEAU, self.COL_NAMES, 1, 0)
        assert result["valid"] is False
        assert result["correct_row"] == 2
        assert "рядок" in result["message"].lower()

    def test_optimal_tableau_returns_no_pivot(self):
        # All z-row coefficients >= 0 → optimal
        optimal_tableau = [
            [1, 0, 1, 0, 0, 4],
            [0, 1, 0, 0.5, 0, 6],
            [0, 0, -3, -2.5, 1, 2],
            [0, 0, 0, 2.5, 0, 35],
        ]
        result = validate_simplex_pivot(optimal_tableau, self.COL_NAMES, 0, 0)
        assert result["valid"] is False
        assert result["correct_col"] is None


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
            [20, 5, 0],  # row sum = 25, supply = 30 → mismatch
            [5, 30, 5],
            [0, 0, 35],
        ]
        result = validate_transport_allocation(self.COSTS, self.SUPPLY, self.DEMAND, allocation)
        assert result["valid"] is False
        assert "постачальника 1" in result["message"] or "постачальника" in result["message"]

    def test_wrong_demand_rejected(self):
        allocation = [
            [25, 5, 0],
            [0, 30, 10],
            [0, 5, 25],  # col sums: 25,40,35 but demand is 25,35,40
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


class TestBnBBranchValidation:
    def test_correct_branch_var(self):
        solution = [2.5, 1.0, 3.7]  # x3 most fractional (0.7 → dist 0.3) vs x1 (0.5 → dist 0.5)
        # x1: dist=0.5, x3: dist=0.3 → x1 is most fractional
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
