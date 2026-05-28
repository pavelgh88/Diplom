import pytest
from core.transport_solver import solve_transport


class TestTransportBasic:
    def test_simple_2x2(self):
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        alloc = result["allocation"]
        row_sums = [sum(row) for row in alloc]
        col_sums = [sum(alloc[i][j] for i in range(len(alloc))) for j in range(len(alloc[0]))]
        for s, rs in zip(supply, row_sums):
            assert abs(s - rs) < 1e-4
        for d, cs in zip(demand, col_sums):
            assert abs(d - cs) < 1e-4

    def test_optimal_value_3x3(self):
        supply = [10, 15, 5]
        demand = [5, 10, 15]
        costs = [[2, 3, 4], [3, 2, 1], [5, 4, 3]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 60) < 1e-4

    def test_already_balanced(self):
        supply = [30, 70]
        demand = [40, 60]
        costs = [[1, 3], [2, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 110) < 1e-4

    def test_single_source_single_dest(self):
        supply = [10]
        demand = [10]
        costs = [[5]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 50) < 1e-4
        assert abs(result["allocation"][0][0] - 10) < 1e-4

    def test_2x2_known_optimum(self):
        # supply=[20,30], demand=[25,25] => optimal=85
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 85) < 1e-4

    def test_3x3_classic_balanced(self):
        # Known optimal value 375
        supply = [30, 40, 30]
        demand = [25, 35, 40]
        costs = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 375) < 1e-4

    def test_2x3_balanced(self):
        supply = [30, 20]
        demand = [10, 20, 20]
        costs = [[2, 3, 1], [5, 4, 8]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 120) < 1e-4


class TestTransportUnbalanced:
    def test_excess_supply(self):
        # Supply > Demand: dummy column added
        supply = [50, 30]
        demand = [40, 20]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
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

    def test_unbalanced_known_value(self):
        # supply=[20,30], demand=[15,25,20] => optimal=115
        supply = [20, 30]
        demand = [15, 25, 20]
        costs = [[3, 2, 5], [4, 3, 2]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 115) < 1e-4

    def test_unbalanced_supply_excess(self):
        # supply=[50,40,30], demand=[30,40,35] => optimal=185
        supply = [50, 40, 30]
        demand = [30, 40, 35]
        costs = [[3, 1, 7], [2, 3, 5], [4, 6, 2]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 185) < 1e-4


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

    def test_initial_step_is_nw_corner(self):
        supply = [10, 15]
        demand = [12, 13]
        costs = [[2, 3], [1, 4]]
        result = solve_transport(supply, demand, costs)
        assert len(result["steps"]) >= 1
        first_step = result["steps"][0]
        assert first_step["allocation"] is not None

    def test_steps_allocation_satisfies_supply_demand(self):
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        final_alloc = result["steps"][-1]["allocation"]
        row_sums = [sum(row) for row in final_alloc]
        col_sums = [sum(final_alloc[i][j] for i in range(len(final_alloc))) for j in range(len(final_alloc[0]))]
        for s, rs in zip(supply, row_sums):
            assert abs(s - rs) < 1e-4
        for d, cs in zip(demand, col_sums):
            assert abs(d - cs) < 1e-4


class TestTransportValidation:
    def test_negative_supply_returns_error(self):
        result = solve_transport([-5, 10], [5], [[1], [2]])
        assert "error" in result

    def test_mismatched_costs_shape_returns_error(self):
        result = solve_transport([10, 20], [15, 15], [[1, 2, 3], [4, 5, 6]])
        assert "error" in result

    def test_zero_supply_or_demand(self):
        supply = [0, 30]
        demand = [15, 15]
        costs = [[1, 2], [3, 4]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"

    def test_single_row_many_cols(self):
        supply = [30]
        demand = [10, 10, 10]
        costs = [[2, 5, 3]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        # Must supply all consumers: 10*2+10*5+10*3=100
        assert abs(result["optimal_value"] - 100) < 1e-4

    def test_result_has_required_fields(self):
        result = solve_transport([10, 20], [15, 15], [[2, 3], [4, 1]])
        for field in ("status", "optimal_value", "allocation", "steps", "num_iterations"):
            assert field in result, f"Missing field: {field}"


class TestTransportAllocationIntegrity:
    def test_allocation_nonnegative(self):
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        for row in result["allocation"]:
            for val in row:
                assert val >= -1e-9, f"Negative allocation value: {val}"

    def test_allocation_matches_supply(self):
        supply = [30, 40, 30]
        demand = [25, 35, 40]
        costs = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
        result = solve_transport(supply, demand, costs)
        alloc = result["allocation"]
        for i, s in enumerate(supply):
            row_sum = sum(alloc[i])
            assert abs(row_sum - s) < 1e-4, f"Supply {i}: {row_sum} != {s}"

    def test_allocation_matches_demand(self):
        supply = [30, 40, 30]
        demand = [25, 35, 40]
        costs = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
        result = solve_transport(supply, demand, costs)
        alloc = result["allocation"]
        m = len(supply)
        for j, d in enumerate(demand):
            col_sum = sum(alloc[i][j] for i in range(m))
            assert abs(col_sum - d) < 1e-4, f"Demand {j}: {col_sum} != {d}"

    def test_cost_equals_optimal(self):
        supply = [20, 30]
        demand = [25, 25]
        costs = [[2, 3], [4, 1]]
        result = solve_transport(supply, demand, costs)
        alloc = result["allocation"]
        computed_cost = sum(costs[i][j] * alloc[i][j]
                            for i in range(len(supply)) for j in range(len(demand)))
        assert abs(computed_cost - result["optimal_value"]) < 1e-4

    def test_large_balanced(self):
        supply = [120, 80, 80]
        demand = [150, 70, 60]
        costs = [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
        result = solve_transport(supply, demand, costs)
        assert result["status"] == "optimal"
        assert abs(result["optimal_value"] - 910) < 1e-4
