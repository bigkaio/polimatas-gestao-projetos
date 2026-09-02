# 5. Arquitetura

## 5.1 Camadas

```
┌─────────────────────────────────────────────────────────────┐
│  Navegador — Next.js App Router (React Server + Client)     │
│  Quadros · Drag&Drop (dnd-kit) · Modal do card              │
│  Construtor de automações · Painel de compliance            │
└───────────────┬─────────────────────────────────────────────┘
                │ Server Actions / Route Handlers
┌───────────────▼─────────────────────────────────────────────┐
│  CAMADA DE DOMÍNIO (src/core) — única porta de escrita      │
│                                                             │
│   1. ComplianceGuard.assert(action, context)   ← BLOQUEIA   │
│   2. Repositório (Prisma) — persiste a mutação              │
│   3. EventBus.emit(evento de domínio)                       │
│   4. AutomationEngine.dispatch(evento)  → ações             │
│   5. NotificationService / ActivityLog                      │
└───────────────┬─────────────────────────────────────────────┘
                │ Prisma
┌───────────────▼─────────────────────────────────────────────┐
│  Supabase — PostgreSQL (RLS) · Auth · Realtime              │
└─────────────────────────────────────────────────────────────┘
                ▲
                │ agendamento
        Vercel Cron (15 min) → /api/cron/tick → gatilhos temporais
```

## 5.2 Fluxo de uma mutação (ex.: arrastar card para *Concluído*)

1. UI aplica atualização **otimista** e chama a Server Action `moveCard`.
2. `ComplianceGuard` avalia todas as regras de escopo `card.move` para o card.
3. Se houver violação bloqueante → lança `ComplianceError` com a lista de motivos; **nada é persistido**; a API responde `422`; a UI **reverte** o card para a posição original e mostra o motivo.
4. Se passar → o repositório grava `list_id` e `position`.
5. `EventBus` emite `card.moved { card, fromList, toList, actor }`.
6. `AutomationEngine` carrega as regras ativas do gatilho `card.moved`, avalia as condições e executa as ações (notificar, mover, atribuir, criar card, criar tarefa…).
7. Cada execução vira uma linha em `automation_runs`; cada mutação vira uma linha em `activity_log`.
8. Supabase Realtime propaga a mudança para os outros usuários com o quadro aberto.

> Ponto de atenção arquitetural: ações de automação **também** passam pelo `ComplianceGuard`. Uma automação não pode furar uma regra de compliance — se isso acontecer, a execução é registrada como `blocked_by_compliance` e fica visível no histórico.

## 5.3 Motor de automações (configurável pelo usuário)

Estrutura de uma regra: **Gatilho → Condições (E/OU) → Ações**.

**Gatilhos disponíveis**

| Gatilho | Dispara quando |
|---|---|
| `card.created` | Um card é criado |
| `card.moved` | Um card muda de lista |
| `card.field_changed` | Um campo do card muda (responsável, prazo, valor…) |
| `task.created` | Uma tarefa é adicionada ao checklist |
| `task.completed` | Uma tarefa é marcada como concluída |
| `card.due_soon` | *(temporal)* Faltam N dias para o prazo |
| `card.overdue` | *(temporal)* O prazo passou |
| `task.overdue` | *(temporal)* O prazo da tarefa passou |

**Condições** — `campo` + `operador` (`é`, `não é`, `contém`, `maior que`, `menor que`, `está vazio`, `está preenchido`) + `valor`, combináveis com E/OU. Campos: lista, tipo do card, responsável, prazo, valor da oportunidade, cliente, quantidade de tarefas abertas, etiquetas.

**Ações**

| Ação | Efeito |
|---|---|
| `notify_user` | Notifica responsável, criador, um usuário fixo ou todos |
| `move_card` | Move o card para outra lista (inclusive *Atrasados*) |
| `assign_user` | Define o responsável |
| `set_due_date` | Define prazo (data fixa ou "hoje + N dias") |
| `add_task` | Adiciona item ao checklist |
| `add_comment` | Registra comentário automático no card |
| `create_project_card` | Cria card no Pipeline de Projetos herdando dados |
| `set_field` | Altera um campo do card |

**Exemplo — regra nativa da integração venda→projeto (`is_system`)**

```json
{
  "name": "Venda fechada gera projeto",
  "enabled": true,
  "is_system": true,
  "trigger": { "type": "card.moved", "board": "sales", "to_list": "fechado" },
  "conditions": { "op": "AND", "rules": [
    { "field": "card.type", "operator": "is", "value": "opportunity" }
  ]},
  "actions": [
    { "type": "create_project_card",
      "target_board": "projects",
      "target_list": "backlog",
      "inherit": ["client_name","client_email","client_phone","amount","description","assignee_id"],
      "title_template": "{{client_name}} — {{card.title}}",
      "link_back": true },
    { "type": "notify_user", "target": "assignee",
      "message": "Projeto criado a partir da venda {{card.title}}" }
  ]
}
```

**Exemplo — regra criada pelo usuário na demo**

```json
{
  "name": "Tarefa atrasada vai para Atrasados",
  "trigger": { "type": "task.overdue" },
  "conditions": { "op": "AND", "rules": [
    { "field": "card.list", "operator": "is_not", "value": "concluido" }
  ]},
  "actions": [
    { "type": "move_card", "target_list": "atrasados" },
    { "type": "notify_user", "target": "assignee",
      "message": "A tarefa {{task.title}} passou do prazo" }
  ]
}
```

Proteções do motor: profundidade máxima de encadeamento (uma automação disparada por outra) = **3**, para evitar laço infinito; execução idempotente por `(automation_id, card_id, event_key)`; toda execução auditada.

## 5.4 Motor de compliance (bloqueante)

Uma regra de compliance é avaliada **antes** da persistência e tem `severity: block` (impede) ou `warn` (avisa e registra).

| Escopo | Momento da avaliação |
|---|---|
| `task.create` | Antes de criar tarefa |
| `card.create` | Antes de criar card |
| `card.move` | Antes de mover card entre listas |
| `card.update` | Antes de alterar campos |
| `opportunity.close` | Antes de marcar venda como Fechada |

**Regras nativas obrigatórias (não desativáveis)**

| Regra | Escopo | Bloqueio |
|---|---|---|
| Toda tarefa precisa de deadline | `task.create`, `task.update` | "Defina um prazo para a tarefa antes de salvar." |
| Projeto não vai para *Concluído* com tarefas abertas | `card.move` (destino = concluído) | "Este projeto tem N tarefa(s) aberta(s). Conclua ou remova antes de finalizar." |

**Regras nativas configuráveis pelo admin (sugeridas, ligadas por padrão)**

| Regra | Escopo |
|---|---|
| Card de projeto em *Em andamento* precisa de responsável | `card.move` |
| Oportunidade não pode ir para *Proposta* sem valor informado | `card.move` |
| Oportunidade *Perdida* exige motivo de perda | `card.move` |
| Card de projeto precisa de prazo ao sair do *Backlog* | `card.move` |

**Enforcement em três camadas** (o que diferencia "bloqueia" de "avisa"):

1. **UI** — desabilita o alvo, mostra o motivo e reverte o drag (experiência);
2. **Servidor** — `ComplianceGuard` roda em toda Server Action e retorna `422` (garantia real, inclusive contra chamada direta à API);
3. **Banco** — `NOT NULL` em `tasks.due_date` e trigger Postgres impedindo card com tarefa aberta entrar em lista terminal (rede de segurança).

Todo bloqueio é gravado em `compliance_violations` — a tela de compliance mostra "o que foi impedido, para quem, quando", o que serve de prova viva na apresentação.

## 5.5 Modelo de dados

```
profiles ──< cards >── lists >── boards
    │         │  │
    │         │  └──< tasks
    │         └──< activity_log
    │
    └──< notifications

automations ──< automation_runs >── cards
compliance_rules ──< compliance_violations >── cards
```

| Tabela | Campos principais |
|---|---|
| `profiles` | `id` (FK `auth.users`), `name`, `email`, `role`, `avatar_url` |
| `boards` | `id`, `key` (`sales`\|`projects`), `name`, `type` |
| `lists` | `id`, `board_id`, `name`, `stage_key`, `position`, `is_terminal`, `semantics` (`won`\|`lost`\|`done`\|`late`\|`null`) |
| `cards` | `id`, `board_id`, `list_id`, `type`, `title`, `description`, `position`, `assignee_id`, `due_date`, `client_name`, `client_email`, `client_phone`, `amount`, `loss_reason`, `source_card_id`, `created_by`, `created_at`, `updated_at`, `archived_at` |
| `tasks` | `id`, `card_id`, `title`, `done`, `due_date` **(NOT NULL)**, `assignee_id`, `position`, `completed_at` |
| `automations` | `id`, `name`, `enabled`, `is_system`, `board_id`, `trigger` (jsonb), `conditions` (jsonb), `actions` (jsonb), `created_by` |
| `automation_runs` | `id`, `automation_id`, `card_id`, `status` (`success`\|`skipped`\|`error`\|`blocked_by_compliance`), `payload` (jsonb), `error`, `created_at` |
| `compliance_rules` | `id`, `name`, `scope`, `condition` (jsonb), `message`, `severity`, `enabled`, `is_system` |
| `compliance_violations` | `id`, `rule_id`, `card_id`, `actor_id`, `attempted_action` (jsonb), `created_at` |
| `notifications` | `id`, `user_id`, `card_id`, `message`, `read_at`, `created_at` |
| `activity_log` | `id`, `card_id`, `actor_id`, `action`, `before` (jsonb), `after` (jsonb), `created_at` |

**Índices**: `cards(list_id, position)`, `cards(assignee_id)`, `cards(due_date)`, `tasks(card_id, done)`, `automations(enabled)`, `notifications(user_id, read_at)`.

## 5.6 Segurança

- **RLS ligado em todas as tabelas**; leitura para qualquer usuário autenticado, escrita conforme a matriz de papéis
- Chave `service_role` usada **apenas** no endpoint de cron, protegido por `CRON_SECRET` no header
- Nenhuma rota de escrita acessa Prisma diretamente — todas passam pela camada de domínio (garante o compliance)
- Validação de entrada com Zod em toda Server Action
- Variáveis de ambiente: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`

## 5.7 Ambientes e entrega contínua

| Ambiente | Origem | Banco |
|---|---|---|
| Local | `npm run dev` | Projeto Supabase de desenvolvimento |
| Preview | Cada Pull Request (Vercel) | Mesmo banco de desenvolvimento |
| Produção | Push na `main` | Projeto Supabase de produção, com seed de demonstração |

Pipeline: push → build Next.js → `prisma migrate deploy` → deploy Vercel. `npm run db:seed` popula usuários de teste, os dois quadros, oportunidades e projetos de exemplo, as automações nativas e as regras de compliance.
