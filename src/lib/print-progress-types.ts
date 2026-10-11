export const PRINT_SET_SIZE = 9;

export type PrintItemState = "queued" | "printing" | "printed";
export type PrintStatus = "not-started" | "in-progress" | "printing" | "ready" | "completed";

export type PrintSummary = {
  batchId: number;
  batchCode: string;
  total: number;
  printed: number;
  printing: number;
  queued: number;
  percent: number;
  status: PrintStatus;
  createdAt: string;
};

export type PrintItemRow = {
  itemId: number;
  code: string;
  name: string;
  gradeLevel: string;
  setNo: number;
  state: PrintItemState;
  queuePosition: number | null;
};

export type PrintDetail = PrintSummary & {
  setSize: number;
  printedAt: string | null;
  items: PrintItemRow[];
};

export const PRINT_STATUS_LABEL: Record<PrintStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  printing: "Printing now",
  ready: "Ready to confirm",
  completed: "Completed",
};
