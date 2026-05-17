import pytest
from algorithms.transport import solve_transport


class TestTransportBasic:
    def test_simple_2x2(self):
        # Minimal 2x2 balanced case
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [1, 4]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        # Check supply and demand are satisfied
        alloc = result["allocation"]
        row_sums = [sum(row) for row in alloc]
        col_sums = [sum(alloc[i][j] for i in range(len(alloc))) for j in range(len(alloc[0]))]
        for s, rs in zip(supply, row_sums):
            assert abs(s - rs) < 1e-4
        for d, cs in zip(demand, col_sums):
            assert abs(d - cs) < 1e-4

    def test_optimal_value_3x3(self):
        # Classic 3x3 example from textbooks
        supply = [10, 15, 5]
        demand = [5, 10, 15]
        costs = [
            [2, 3, 4],
            [3, 2, 1],
            [5, 4, 3],
        ]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert result["optimal_value"] >= 0

    def test_already_balanced(self):
        supply = [30, 70]
        demand = [40, 60]
        costs = [[1, 3], [2, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        alloc = result["allocation"]
        assert abs(sum(alloc[0]) - 30) < 1e-4
        assert abs(sum(alloc[1]) - 70) < 1e-4

    def test_single_source_single_dest(self):
        supply = [10]
        demand = [10]
        costs = [[5]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 50) < 1e-4
        assert abs(result["allocation"][0][0] - 10) < 1e-4


class TestTransportUnbalanced:
    def test_excess_supply(self):
        # Supply > Demand: dummy column added
        supply = [50, 30]
        demand = [40, 20]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        # allocation should be 2x2 (dummy stripped)
        assert len(result["allocation"]) == 2
        assert len(result["allocation"][0]) == 2

    def test_excess_demand(self):
        # Demand > Supply: dummy row added
        supply = [30, 20]
        demand = [40, 30]
        costs = [[3, 2], [1, 4]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert len(result["allocation"]) == 2
        assert len(result["allocation"][0]) == 2


class TestTransportSteps:
    def test_steps_structure(self):
        supply = [10, 15]
        demand = [12, 13]
        costs = [[2, 3], [1, 4]]
        result = solve_transport(supply, demand, costs)
        assert "steps" in result
        assert len(result["steps"]) >= 1

        for step in result["steps"]:
            assert "description" in step
            assert "allocation" in step
            assert "basic_cells" in step
            assert "u" in step
            assert "v" in step

    def test_num_iterations_matches_steps(self):
        supply = [20, 30, 10]
        demand = [15, 25, 20]
        costs = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
        result = solve_transport(supply, demand, costs)
        iteration_steps = [s for s in result["steps"] if "Ітерація" in s["description"]]
        assert result["num_iterations"] == len(iteration_steps)


class TestTransportValidation:
    def test_negative_supply_returns_error(self):
        result = solve_transport([-5, 10], [5], [[1], [2]])
        assert "error" in result

    def test_mismatched_costs_shape_returns_error(self):
        result = solve_transport([10, 20], [15, 15], [[1, 2, 3], [4, 5, 6]])
        assert "error" in result
