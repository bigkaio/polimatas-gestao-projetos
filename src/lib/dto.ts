/** Formatos serializáveis trocados entre server e client components. */

export type UserDTO = { id: string; name: string };

export type CardDTO = {
  id: string;
  title: string;
  type: "opportunity" | "project";
  listId: string;
  position: number;
  assignee: UserDTO | null;
  dueDate: string | null;
  amount: string | null;
  clientName: string | null;
  lossReason: string | null;
  sourceCardId: string | null;
  hasSpawned: boolean;
  tasksTotal: number;
  tasksDone: number;
};

export type ListDTO = {
  id: string;
  name: string;
  stageKey: string;
  isTerminal: boolean;
  semantics: "won" | "lost" | "done" | "late" | null;
};

export type BoardDTO = {
  id: string;
  key: "sales" | "projects";
  name: string;
  lists: ListDTO[];
};

export type FunnelStats = {
  openTotal: string;
  wonThisMonth: string;
  conversion: number | null;
} | null;
