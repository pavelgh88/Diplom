import axios from "axios";
import type {
  LPProblem,
  SimplexResult,
  SimplexCheckRequest,
  ValidatorResult,
  BnBResult,
  TransportProblem,
  TransportResult,
  TaskSummary,
  Task,
} from "../types";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  headers: { "Content-Type": "application/json" },
});

// ── Solvers ──────────────────────────────────────────────────────────────────

export async function solveSimplex(problem: LPProblem): Promise<SimplexResult> {
  const { data } = await api.post<SimplexResult>("/simplex", problem);
  return data;
}

export async function solveBranchAndBound(problem: LPProblem): Promise<BnBResult> {
  const { data } = await api.post<BnBResult>("/branch-and-bound", problem);
  return data;
}

export async function solveTransport(problem: TransportProblem): Promise<TransportResult> {
  const { data } = await api.post<TransportResult>("/transport", problem);
  return data;
}

// ── Validators ───────────────────────────────────────────────────────────────

export async function checkSimplexPivot(req: SimplexCheckRequest): Promise<ValidatorResult> {
  const { data } = await api.post<ValidatorResult>("/simplex/check", req);
  return data;
}

export async function checkBnBBranch(
  lp_solution: number[],
  user_branch_var: number
): Promise<ValidatorResult> {
  const { data } = await api.post<ValidatorResult>("/branch-and-bound/check", {
    lp_solution,
    user_branch_var,
  });
  return data;
}

export async function checkTransportAllocation(
  costs: number[][],
  supply: number[],
  demand: number[],
  user_allocation: number[][]
): Promise<ValidatorResult> {
  const { data } = await api.post<ValidatorResult>("/transport/check", {
    costs,
    supply,
    demand,
    user_allocation,
  });
  return data;
}

// ── Tasks library ─────────────────────────────────────────────────────────────

export async function fetchTasks(type?: string): Promise<TaskSummary[]> {
  const params = type ? { type } : {};
  const { data } = await api.get<TaskSummary[]>("/tasks", { params });
  return data;
}

export async function fetchTask(id: number): Promise<Task> {
  const { data } = await api.get<Task>(`/tasks/${id}`);
  return data;
}
