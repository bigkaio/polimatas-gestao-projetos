import { z } from "zod";
import { phoneIssue } from "@/lib/whatsapp";

/**
 * Schemas das regras de automação e compliance (seção 5.3/5.4 do backlog).
 * O construtor sem código (US-25) monta objetos destes formatos; nada é
 * digitado como JSON pelo usuário — a validação Zod roda antes de salvar.
 */

export const OPERATORS = [
  "is",
  "is_not",
  "contains",
  "greater_than",
  "less_than",
  "is_empty",
  "is_filled",
] as const;
export type Operator = (typeof OPERATORS)[number];

export const CONDITION_FIELDS = [
  "card.type",
  "card.list",
  "card.title",
  "card.assignee",
  "card.due_date",
  "card.amount",
  "card.client_name",
  "card.lead_source",
  "card.loss_reason",
  "card.open_tasks",
  "from_list",
  "to_list",
  "to_list.semantics",
  "task.title",
  "task.due_date",
  "task.assignee",
] as const;
export type ConditionField = (typeof CONDITION_FIELDS)[number];

export const conditionRuleSchema = z.object({
  field: z.enum(CONDITION_FIELDS),
  operator: z.enum(OPERATORS),
  value: z.union([z.string(), z.number()]).optional(),
});
export type ConditionRule = z.infer<typeof conditionRuleSchema>;

export const conditionGroupSchema = z.object({
  op: z.enum(["AND", "OR"]),
  rules: z.array(conditionRuleSchema),
});
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;

export const TRIGGER_TYPES = [
  "card.created",
  "card.moved",
  "card.field_changed",
  "task.created",
  "task.completed",
  "card.due_soon",
  "card.overdue",
  "task.overdue",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const triggerSchema = z.object({
  type: z.enum(TRIGGER_TYPES),
  /** Restringe ao quadro (`sales` | `projects`); ausente = qualquer quadro. */
  board: z.enum(["sales", "projects"]).optional(),
  /** Para card.moved: stage_key da lista de destino. */
  to_list: z.string().optional(),
  from_list: z.string().optional(),
  /** Para card.field_changed: qual campo. */
  field: z.string().optional(),
  /** Para card.due_soon: quantos dias antes do prazo. */
  days: z.number().int().min(1).max(30).optional(),
});
export type Trigger = z.infer<typeof triggerSchema>;

const notifyAction = z.object({
  type: z.literal("notify_user"),
  target: z.enum(["assignee", "creator", "user", "all"]),
  user_id: z.string().uuid().optional(),
  message: z.string().min(1),
});
/** Quem recebe o WhatsApp: número fixo, o cliente do card ou alguém da equipe. */
export const WHATSAPP_TARGETS = ["number", "client", "assignee", "creator", "user"] as const;
export type WhatsAppTarget = (typeof WHATSAPP_TARGETS)[number];

const whatsAppAction = z.object({
  type: z.literal("send_whatsapp"),
  // `default` mantém válidas as regras gravadas antes de existir o destino.
  to: z.enum(WHATSAPP_TARGETS).default("number"),
  /** Para `number`: DDD + número (o DDI 55 é assumido quando falta). */
  number: z.string().trim().optional(),
  /** Para `user`: a pessoa da equipe, que precisa ter WhatsApp no perfil. */
  user_id: z.string().uuid().optional(),
  message: z.string().min(1, "Escreva a mensagem do WhatsApp."),
});
export type WhatsAppAction = z.infer<typeof whatsAppAction>;

/** O que falta na ação de WhatsApp para ela ter destino, ou `null` se está completa. */
export function whatsAppActionIssue(action: WhatsAppAction): string | null {
  if (action.to === "number") {
    const issue = phoneIssue(action.number ?? "");
    if (issue) return `Número do WhatsApp: ${issue}`;
  }
  if (action.to === "user" && !action.user_id) return "Escolha quem da equipe recebe o WhatsApp.";
  return null;
}
const moveAction = z.object({
  type: z.literal("move_card"),
  target_list: z.string().min(1),
});
const assignAction = z.object({
  type: z.literal("assign_user"),
  user_id: z.string().uuid(),
});
const dueDateAction = z.object({
  type: z.literal("set_due_date"),
  mode: z.enum(["fixed", "relative"]),
  date: z.string().optional(),
  days: z.number().int().min(0).max(365).optional(),
});
const addTaskAction = z.object({
  type: z.literal("add_task"),
  title: z.string().min(1),
  due_in_days: z.number().int().min(0).max(365),
  assignee: z.enum(["card_assignee", "none"]).default("none"),
});
const commentAction = z.object({
  type: z.literal("add_comment"),
  text: z.string().min(1),
});
const createProjectAction = z.object({
  type: z.literal("create_project_card"),
  target_board: z.literal("projects"),
  target_list: z.string().min(1),
  inherit: z.array(
    z.enum(["client_name", "client_email", "client_phone", "amount", "description", "assignee_id"])
  ),
  title_template: z.string().min(1),
  link_back: z.boolean().default(true),
});
const setFieldAction = z.object({
  type: z.literal("set_field"),
  field: z.enum(["title", "description", "loss_reason", "client_name", "amount"]),
  value: z.string(),
});

export const actionSchema = z.discriminatedUnion("type", [
  notifyAction,
  whatsAppAction,
  moveAction,
  assignAction,
  dueDateAction,
  addTaskAction,
  commentAction,
  createProjectAction,
  setFieldAction,
]);
export type AutomationAction = z.infer<typeof actionSchema>;

/**
 * Formato de uma regra. `automationReadSchema` é a leitura: valida a ESTRUTURA
 * do que está gravado, para a tela conseguir descrever e abrir a regra.
 * `automationSchema` acrescenta as exigências de conteúdo e vale na GRAVAÇÃO —
 * assim uma regra antiga com número de WhatsApp incompleto ainda abre no
 * construtor (é lá que se corrige), em vez de virar "formato inválido".
 */
export const automationReadSchema = z.object({
  name: z.string().min(1, "Dê um nome à regra."),
  enabled: z.boolean().default(true),
  trigger: triggerSchema,
  conditions: conditionGroupSchema,
  actions: z.array(actionSchema).min(1, "Adicione pelo menos uma ação."),
});

export const automationSchema = automationReadSchema.extend({
  actions: automationReadSchema.shape.actions
    // discriminatedUnion não aceita refine nos membros; a checagem fica aqui.
    .superRefine((actions, ctx) => {
      actions.forEach((a, i) => {
        const issue = a.type === "send_whatsapp" ? whatsAppActionIssue(a) : null;
        if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue, path: [i] });
      });
    }),
});
export type AutomationInput = z.infer<typeof automationSchema>;

export const COMPLIANCE_SCOPES = [
  "task.create",
  "task.update",
  "card.create",
  "card.move",
  "card.update",
  "opportunity.close",
] as const;
export type ComplianceScope = (typeof COMPLIANCE_SCOPES)[number];

export const complianceRuleSchema = z.object({
  name: z.string().min(1, "Dê um nome à regra."),
  /** Uma regra pode valer para mais de um escopo (ex.: task.create,task.update). */
  scope: z.string().min(1),
  condition: conditionGroupSchema,
  message: z.string().min(1, "Escreva a mensagem mostrada ao usuário."),
  severity: z.enum(["block", "warn"]).default("block"),
  enabled: z.boolean().default(true),
});
export type ComplianceRuleInput = z.infer<typeof complianceRuleSchema>;
