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

export interface SimplexCheckRequest {
  tableau: number[][];
  col_names: string[];
  user_pivot_col: number;
  user_pivot_row: number;
}

export interface ValidatorResult {
  valid: boolean;
  message: string;
  correct_col?: number | null;
  correct_row?: number | null;
  correct_var?: number | null;
  hint?: string | null;
  total_cost?: number;
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

// ──── Blind tableau validation ────────────────────────────────────────────────

export interface TableauCellError {
  row: number;
  col: number;
  expected: number;
  got: number;
}

export interface TableauCheckResult {
  valid: boolean;
  message: string;
  errors: TableauCellError[];
  expected_tableau?: number[][];
}

// ──── Transport training ──────────────────────────────────────────────────────

export interface PotentialsCheckResult {
  valid: boolean;
  message: string;
  errors: Array<{ type: "u" | "v"; index: number; expected: number; got: number | null }>;
  u?: (number | null)[];
  v?: (number | null)[];
}

export interface EnteringCheckResult {
  valid: boolean;
  message: string;
  optimal?: boolean;
  correct_cell?: [number, number];
  hint?: string;
}

// ──── Session statistics ──────────────────────────────────────────────────────

export interface TaskAttempt {
  type: string;
  label: string;
  mistakes: number;
  hints: number;
  solved: boolean;
  ts: number;
}

// ──── Tasks library ───────────────────────────────────────────────────────────

export type TaskType = "simplex" | "branch_and_bound" | "transport";

export interface TaskSummary {
  id: number;
  title: string;
  type: TaskType;
  description: string;
}

export interface Task extends TaskSummary {
  theory_hint: string;
  problem: LPProblem | TransportProblem;
  expected?: {
    optimal_value?: number;
    solution?: number[];
  };
}
