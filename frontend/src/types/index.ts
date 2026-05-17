// ──── Shared input ────────────────────────────────────────────────────────────

export interface LPProblem {
  c: number[];
  A: number[][];
  b: number[];
  maximize: boolean;
  bounds?: [number, number | null][];
}

// ──── Simplex ─────────────────────────────────────────────────────────────────

export interface SimplexStep {
  description: string;
  tableau: number[][];
  col_names: string[];
  row_names: string[];
  basic_vars: string[];
  pivot_row: number | null;
  pivot_col: number | null;
}

export interface SimplexResult {
  status: "optimal" | "error";
  solution?: number[];
  optimal_value?: number;
  steps?: SimplexStep[];
  num_iterations?: number;
  error?: string;
}

// ──── Branch and Bound ────────────────────────────────────────────────────────

export type BnBNodeStatus = "branched" | "integer" | "infeasible" | "pruned";

export interface BnBNode {
  id: number;
  parent_id: number | null;
  depth: number;
  label: string;
  status: BnBNodeStatus;
  lp_value: number | null;
  solution: number[] | null;
  bounds: [number, number | null][];
  branch_var?: number;
  branch_value?: number;
}

export interface BnBResult {
  status: "optimal" | "infeasible" | "error";
  solution?: number[];
  optimal_value?: number;
  nodes?: BnBNode[];
  total_nodes?: number;
  error?: string;
}

// ──── Transport ───────────────────────────────────────────────────────────────

export interface TransportProblem {
  supply: number[];
  demand: number[];
  costs: number[][];
}

export interface TransportStep {
  description: string;
  allocation: number[][];
  basic_cells: [number, number][];
  u: (number | null)[];
  v: (number | null)[];
  delta: (number | null)[][] | null;
  entering_cell: [number, number] | null;
  loop: [number, number][] | null;
}

export interface TransportResult {
  status: "optimal" | "error";
  allocation?: number[][];
  optimal_value?: number;
  steps?: TransportStep[];
  num_iterations?: number;
  dummy_row?: boolean;
  dummy_col?: boolean;
  error?: string;
}
