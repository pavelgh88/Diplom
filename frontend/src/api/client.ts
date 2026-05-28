import axios from "axios";
import type {
  LPProblem,
  SimplexResult,
  SimplexCheckRequest,
  ValidatorResult,
  BnBResult,
  TransportProblem,
  TransportResult,
  TableauCheckResult,
  PotentialsCheckResult,
  EnteringCheckResult,
  TaskSummary,
  Task,
} from "../types";

// Set REACT_APP_API_URL in production (Vercel env vars) to your Render backend URL,
// e.g. "https://diploma-backend.onrender.com/api". Falls back to localhost for dev.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001/api";

const api = axios.create({
  baseURL: API_URL,
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

// ── Blind tableau check ───────────────────────────────────────────────────────

export async function checkSimplexTableau(
  prev_tableau: number[][],
  pivot_col: number,
  pivot_row: number,
  student_tableau: number[][]
): Promise<TableauCheckResult> {
  const { data } = await api.post<TableauCheckResult>("/simplex/check-tableau", {
    prev_tableau, pivot_col, pivot_row, student_tableau,
  });
  return data;
}

// ── Transport training ────────────────────────────────────────────────────────

export async function checkTransportPotentials(
  basic_cells: number[][],
  costs: number[][],
  student_u: (number | null)[],
  student_v: (number | null)[]
): Promise<PotentialsCheckResult> {
  const { data } = await api.post<PotentialsCheckResult>("/transport/check-potentials", {
    basic_cells, costs, student_u, student_v,
  });
  return data;
}

export async function checkTransportEntering(
  u: (number | null)[],
  v: (number | null)[],
  costs: number[][],
  basic_cells: number[][],
  user_row: number,
  user_col: number
): Promise<EnteringCheckResult> {
  const { data } = await api.post<EnteringCheckResult>("/transport/check-entering", {
    u, v, costs, basic_cells, user_row, user_col,
  });
  return data;
}

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateTask(
  type: string, vars: number, constraints: number
): Promise<{ type: string; problem: any }> {
  const { data } = await api.get("/generate", { params: { type, vars, constraints } });
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
