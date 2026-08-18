export type FilterOp = "eq" | "neq" | "gte" | "lte" | "in" | "gt" | "lt";

export interface DbFilter {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface DbOrder {
  col: string;
  asc: boolean;
}

export interface DbQueryPlan {
  table: string;
  select?: string;
  filters?: DbFilter[];
  order?: DbOrder[];
  single?: boolean;
  limit?: number;
}