import type { BoardKey } from "@prisma/client";
import type { TriggerType } from "./rules";

/** Evento de domínio emitido após cada mutação persistida (seção 5.2). */
export type DomainEvent = {
  type: TriggerType;
  boardKey: BoardKey;
  cardId: string;
  actorId: string | null;
  /** card.moved */
  fromListId?: string;
  toListId?: string;
  /** card.field_changed */
  field?: string;
  /** task.* */
  taskId?: string;
  /** Chave de idempotência (gatilhos temporais: `${tipo}:${id}:${dia}`). */
  eventKey?: string;
};

/** Executor de mutações: quem está agindo. */
export type Actor = { id: string; role: "admin" | "manager" | "sales" | "member" };

/** Propagação por automação: identifica a regra e controla profundidade. */
export type AutomationContext = {
  automationId: string;
  automationName: string;
  depth: number;
};

/** Encadeamento máximo de automações (proteção contra laço — seção 5.3). */
export const MAX_AUTOMATION_DEPTH = 3;
