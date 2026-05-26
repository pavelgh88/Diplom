import json
import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestHealthEndpoint:
    def test_health_ok(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"


class TestTasksEndpoint:
    def test_get_all_tasks(self, client):
        resp = client.get("/api/tasks")
        assert resp.status_code == 200
        tasks = resp.get_json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 10

    def test_filter_by_simplex(self, client):
        resp = client.get("/api/tasks?type=simplex")
        assert resp.status_code == 200
        tasks = resp.get_json()
        assert all(t["type"] == "simplex" for t in tasks)
        assert len(tasks) >= 5

    def test_filter_by_transport(self, client):
        resp = client.get("/api/tasks?type=transport")
        assert resp.status_code == 200
        tasks = resp.get_json()
        assert all(t["type"] == "transport" for t in tasks)

    def test_filter_by_bnb(self, client):
        resp = client.get("/api/tasks?type=branch_and_bound")
        assert resp.status_code == 200
        tasks = resp.get_json()
        assert all(t["type"] == "branch_and_bound" for t in tasks)

    def test_task_summary_fields(self, client):
        resp = client.get("/api/tasks")
        tasks = resp.get_json()
        for t in tasks:
            for field in ("id", "title", "type", "description"):
                assert field in t

    def test_get_task_by_id(self, client):
        resp = client.get("/api/tasks/1")
        assert resp.status_code == 200
        task = resp.get_json()
        assert task["id"] == 1
        assert "problem" in task

    def test_task_not_found(self, client):
        resp = client.get("/api/tasks/9999")
        assert resp.status_code == 404

    def test_task_has_problem_fields(self, client):
        resp = client.get("/api/tasks/1")
        task = resp.get_json()
        prob = task["problem"]
        assert "c" in prob and "A" in prob and "b" in prob

    def test_transport_task_has_supply_demand(self, client):
        resp = client.get("/api/tasks?type=transport")
        tasks = resp.get_json()
        resp2 = client.get(f"/api/tasks/{tasks[0]['id']}")
        task = resp2.get_json()
        prob = task["problem"]
        assert "supply" in prob and "demand" in prob and "costs" in prob


class TestSimplexEndpoint:
    def test_solve_basic(self, client):
        payload = {"c": [3, 5], "A": [[1, 0], [0, 2]], "b": [4, 12], "maximize": True}
        resp = client.post("/api/simplex", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "optimal"

    def test_missing_fields_returns_400(self, client):
        resp = client.post("/api/simplex", json={"c": [1, 2]})
        assert resp.status_code == 400

    def test_no_json_returns_400(self, client):
        resp = client.post("/api/simplex", data="not json")
        assert resp.status_code == 400

    def test_returns_steps(self, client):
        payload = {"c": [3, 2], "A": [[1, 1], [2, 1]], "b": [4, 6], "maximize": True}
        resp = client.post("/api/simplex", json=payload)
        data = resp.get_json()
        assert "steps" in data
        assert len(data["steps"]) >= 1

    def test_mismatched_dimensions_returns_400(self, client):
        resp = client.post("/api/simplex", json={"c": [1, 2], "A": [[1]], "b": [5]})
        assert resp.status_code == 400

    def test_maximize_vs_minimize_differ(self, client):
        payload_max = {"c": [3, 2], "A": [[1, 1], [2, 1]], "b": [4, 6], "maximize": True}
        payload_min = {"c": [3, 2], "A": [[1, 1], [2, 1]], "b": [4, 6], "maximize": False}
        r_max = client.post("/api/simplex", json=payload_max).get_json()
        r_min = client.post("/api/simplex", json=payload_min).get_json()
        assert r_max["optimal_value"] != r_min["optimal_value"]


class TestSimplexCheckEndpoint:
    TABLEAU = [
        [1, 0, 1, 0, 0, 4],
        [0, 2, 0, 1, 0, 12],
        [3, 5, 0, 0, 1, 25],
        [-3, -5, 0, 0, 0, 0],
    ]
    COL_NAMES = ["x1", "x2", "s1", "s2", "s3"]

    def test_correct_pivot_returns_valid(self, client):
        payload = {
            "tableau": self.TABLEAU,
            "col_names": self.COL_NAMES,
            "user_pivot_col": 1,
            "user_pivot_row": 2,
        }
        resp = client.post("/api/simplex/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is True

    def test_wrong_pivot_returns_invalid(self, client):
        payload = {
            "tableau": self.TABLEAU,
            "col_names": self.COL_NAMES,
            "user_pivot_col": 0,
            "user_pivot_row": 0,
        }
        resp = client.post("/api/simplex/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is False

    def test_missing_field_returns_400(self, client):
        resp = client.post("/api/simplex/check", json={"tableau": self.TABLEAU})
        assert resp.status_code == 400


class TestBranchAndBoundEndpoint:
    def test_solve_basic(self, client):
        payload = {"c": [1, 1], "A": [[1, 1]], "b": [3.5], "maximize": True}
        resp = client.post("/api/branch-and-bound", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "optimal"
        assert abs(data["optimal_value"] - 3) < 1e-6

    def test_returns_nodes(self, client):
        payload = {"c": [1, 1], "A": [[1, 1]], "b": [3.5], "maximize": True}
        resp = client.post("/api/branch-and-bound", json=payload)
        data = resp.get_json()
        assert "nodes" in data
        assert len(data["nodes"]) > 0

    def test_missing_fields_returns_400(self, client):
        resp = client.post("/api/branch-and-bound", json={"c": [1]})
        assert resp.status_code == 400

    def test_infeasible_problem(self, client):
        payload = {"c": [1], "A": [[1]], "b": [-1], "maximize": True}
        resp = client.post("/api/branch-and-bound", json=payload)
        data = resp.get_json()
        assert data["status"] == "infeasible"


class TestBranchAndBoundCheckEndpoint:
    def test_correct_branch_var(self, client):
        payload = {"lp_solution": [2.5, 1.0, 3.7], "user_branch_var": 0}
        resp = client.post("/api/branch-and-bound/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is True

    def test_wrong_branch_var(self, client):
        payload = {"lp_solution": [2.5, 1.0, 3.7], "user_branch_var": 2}
        resp = client.post("/api/branch-and-bound/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is False

    def test_missing_field_returns_400(self, client):
        resp = client.post("/api/branch-and-bound/check", json={"lp_solution": [2.5]})
        assert resp.status_code == 400


class TestTransportEndpoint:
    def test_solve_basic(self, client):
        payload = {
            "supply": [20, 30],
            "demand": [25, 25],
            "costs": [[2, 3], [4, 1]],
        }
        resp = client.post("/api/transport", json=payload)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "optimal"
        assert abs(data["optimal_value"] - 85) < 1e-4

    def test_returns_allocation(self, client):
        payload = {
            "supply": [20, 30],
            "demand": [25, 25],
            "costs": [[2, 3], [4, 1]],
        }
        resp = client.post("/api/transport", json=payload)
        data = resp.get_json()
        assert "allocation" in data
        assert len(data["allocation"]) == 2

    def test_missing_fields_returns_400(self, client):
        resp = client.post("/api/transport", json={"supply": [10, 20]})
        assert resp.status_code == 400

    def test_too_large_returns_400(self, client):
        supply = [10] * 16
        demand = [10] * 16
        costs = [[1] * 16 for _ in range(16)]
        resp = client.post("/api/transport", json={"supply": supply, "demand": demand, "costs": costs})
        assert resp.status_code == 400


class TestAlgorithmsEndpoint:
    def test_returns_three_algorithms(self, client):
        resp = client.get("/api/algorithms")
        assert resp.status_code == 200
        algs = resp.get_json()
        assert len(algs) == 3

    def test_algorithm_has_fields(self, client):
        resp = client.get("/api/algorithms")
        for alg in resp.get_json():
            assert "id" in alg and "title" in alg and "description" in alg

    def test_algorithm_ids_correct(self, client):
        resp = client.get("/api/algorithms")
        ids = {a["id"] for a in resp.get_json()}
        assert "simplex" in ids
        assert "branch_and_bound" in ids
        assert "transport" in ids


class TestRandomTaskEndpoint:
    def test_returns_a_task(self, client):
        resp = client.get("/api/tasks/random")
        assert resp.status_code == 200
        task = resp.get_json()
        assert "id" in task and "type" in task

    def test_filter_by_type(self, client):
        resp = client.get("/api/tasks/random?type=simplex")
        assert resp.status_code == 200
        assert resp.get_json()["type"] == "simplex"

    def test_invalid_type_returns_404(self, client):
        resp = client.get("/api/tasks/random?type=nonexistent")
        assert resp.status_code == 404


class TestStatsEndpoint:
    def test_returns_stats(self, client):
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total_tasks" in data
        assert "by_type" in data

    def test_total_tasks_count(self, client):
        resp = client.get("/api/stats")
        data = resp.get_json()
        assert data["total_tasks"] == 40

    def test_has_all_types(self, client):
        resp = client.get("/api/stats")
        data = resp.get_json()
        assert "simplex" in data["by_type"]
        assert "branch_and_bound" in data["by_type"]
        assert "transport" in data["by_type"]

    def test_type_counts_correct(self, client):
        resp = client.get("/api/stats")
        by_type = resp.get_json()["by_type"]
        assert by_type["simplex"] == 10
        assert by_type["branch_and_bound"] == 10
        assert by_type["transport"] == 20


class TestVerifyTaskEndpoint:
    def test_correct_answer(self, client):
        resp = client.post("/api/tasks/1/verify", json={"optimal_value": 25})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["correct"] is True

    def test_wrong_answer(self, client):
        resp = client.post("/api/tasks/1/verify", json={"optimal_value": 999})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["correct"] is False

    def test_nonexistent_task(self, client):
        resp = client.post("/api/tasks/9999/verify", json={"optimal_value": 10})
        assert resp.status_code == 404

    def test_missing_value_returns_400(self, client):
        resp = client.post("/api/tasks/1/verify", json={})
        assert resp.status_code == 400

    def test_response_has_expected_field(self, client):
        resp = client.post("/api/tasks/1/verify", json={"optimal_value": 25})
        data = resp.get_json()
        assert "expected" in data and "user_value" in data and "message" in data


class TestTransportCheckEndpoint:
    def test_valid_allocation(self, client):
        payload = {
            "costs": [[2, 3], [4, 1]],
            "supply": [20, 30],
            "demand": [25, 25],
            "user_allocation": [[20, 0], [5, 25]],
        }
        resp = client.post("/api/transport/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is True

    def test_invalid_allocation(self, client):
        payload = {
            "costs": [[2, 3], [4, 1]],
            "supply": [20, 30],
            "demand": [25, 25],
            "user_allocation": [[10, 0], [5, 25]],
        }
        resp = client.post("/api/transport/check", json=payload)
        assert resp.status_code == 200
        assert resp.get_json()["valid"] is False

    def test_missing_field_returns_400(self, client):
        resp = client.post("/api/transport/check", json={"costs": [[1]], "supply": [10]})
        assert resp.status_code == 400
