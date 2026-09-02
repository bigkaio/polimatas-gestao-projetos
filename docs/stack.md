# 4. Stack escolhida e justificativa

| Camada | Escolha | Por quê | Alternativas descartadas |
|---|---|---|---|
| **Framework fullstack** | **Next.js 15 (App Router)** | UI e API no mesmo projeto; Server Actions eliminam camada de controller; um único deploy | Vite + Express separados (dois deploys, mais setup); Remix (time tem menos familiaridade) |
| **Linguagem** | **TypeScript (strict)** | O motor de automações e compliance é orientado a contratos JSON — tipagem evita erro de forma em tempo de execução | JavaScript puro (barato agora, caro na integração) |
| **Hospedagem** | **Vercel** | Deploy automático a cada push, preview por PR, **Vercel Cron** já resolve os gatilhos temporais das automações | Render/Railway (cron e preview menos diretos); VPS (tempo de setup incompatível com hackathon) |
| **Banco de dados** | **Supabase (PostgreSQL)** | Postgres relacional com plano gratuito; JSONB para regras dinâmicas; RLS para segurança; Realtime para o quadro atualizar entre usuários | Neon (ótimo Postgres, mas sem auth/realtime prontos); MongoDB (modelo relacional venda↔projeto ficaria frouxo) |
| **Autenticação** | **Supabase Auth** | Login e-mail/senha pronto, integrado ao mesmo Postgres, sem serviço extra | NextAuth + provider próprio (mais código para o mesmo resultado) |
| **ORM / migrações** | **Prisma** | Migrações versionadas (`npm run db:migrate` já previsto no README), tipos gerados a partir do schema | Drizzle (bom, mas menor familiaridade); SQL puro (sem tipos, mais erro) |
| **Drag and drop** | **dnd-kit** | Mantido ativamente, acessível por teclado, suporta lista↔lista; `react-beautiful-dnd` está descontinuado | react-beautiful-dnd (deprecado); HTML5 DnD nativo (ruim em mobile e acessibilidade) |
| **UI** | **Tailwind CSS + shadcn/ui** | Componentes acessíveis e prontos (modal, select, toast) sem carregar design system pesado — usabilidade é critério avaliado | MUI (peso e customização); CSS do zero (tempo) |
| **Estado servidor** | **TanStack Query + revalidação de Server Actions** | Atualização otimista no drag and drop com rollback quando o compliance bloqueia | Redux (excesso para o caso); só `useState` (sem cache nem rollback) |
| **Validação** | **Zod** | Mesmo schema valida formulário e payload da API — e descreve as regras de automação/compliance | Validação manual (duplicada e frágil) |
| **Testes** | **Vitest** (unitário nos motores) + **Playwright** (fluxo venda→projeto) | O risco maior está nos motores e no fluxo central; testar só isso cabe no prazo | Cobertura ampla (tempo indisponível) |

## 4.1 Decisões arquiteturais registradas (ADRs resumidas)

| # | Decisão | Justificativa | Consequência |
|---|---|---|---|
| **ADR-01** | Uma única tabela `cards` com discriminador `type` (`opportunity` \| `project`), em vez de duas tabelas | Os motores de automação e compliance passam a operar sobre **uma** abstração; qualquer regra criada pelo usuário funciona nos dois quadros sem código novo | Algumas colunas ficam nulas por tipo; validação por tipo vai para a camada de domínio (Zod) |
| **ADR-02** | Compliance aplicado na **camada de serviço do servidor**, com constraints de banco como segunda linha | O critério de avaliação é "bloqueia de verdade" — validação só no front seria contornável pela API | Toda mutação passa obrigatoriamente pelo guard; nenhum acesso direto ao Prisma nas rotas |
| **ADR-03** | Regras (automação e compliance) persistidas como **JSONB** e interpretadas em runtime | É o que torna as regras *configuráveis pelo usuário* em vez de fixas no código | Precisa de validação de schema e versionamento do formato da regra |
| **ADR-04** | A integração venda→projeto é uma **automação nativa** (semente do sistema), não um `if` no código | Demonstra o motor funcionando e permite ao admin ajustar a regra (ex.: qual lista de destino) | A regra é marcada como `is_system` e não pode ser excluída, só ajustada |
| **ADR-05** | Posição de card em `position` fracionário (float) em vez de índice inteiro | Mover um card grava **uma** linha, não reindexa a lista inteira | Necessita rebalanceamento quando o gap fica pequeno (job simples) |
| **ADR-06** | Gatilhos temporais via **Vercel Cron** a cada 15 min chamando `/api/cron/tick` | Sem worker dedicado nem serviço pago | Granularidade de 15 min é suficiente para prazos em dias |
