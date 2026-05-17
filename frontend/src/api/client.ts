import axios from "axios";
import type { LPProblem, SimplexResult, BnBResult, TransportProblem, TransportResult } from "../types";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  headers: { "Content-Type": "application/json" },
});

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
