# 3. Personas e papéis

| Persona | Quem é | O que precisa | Papel no sistema |
|---|---|---|---|
| **Vendedor** | Comercial da Polímatas | Registrar oportunidades e movê-las pelo funil sem burocracia | `sales` |
| **Gestor de Projetos** | Coordena a execução | Ver o projeto nascer da venda, distribuir tarefas, cobrar prazos | `manager` |
| **Executor** | Dev / designer / analista | Ver o que é dele, marcar tarefa como concluída | `member` |
| **Administrador** | Dono do processo | Criar automações e regras de compliance, gerenciar usuários | `admin` |

## 3.1 Matriz de permissões

A tabela abaixo é o **padrão de fábrica**. O administrador ajusta qualquer célula
em **Configurações → Permissões por papel**, e o override vale imediatamente na
camada de domínio — não é um filtro de interface.

| Ação | Capacidade | `sales` | `member` | `manager` | `admin` |
|---|---|:--:|:--:|:--:|:--:|
| Ver ambos os quadros | — | ✅ | ✅ | ✅ | ✅ |
| Criar/mover oportunidade | `board.sales.mutate` | ✅ | ❌ | ✅ | ✅🔒 |
| Criar/mover card de projeto | `board.projects.mutate` | ❌ | ❌ | ✅ | ✅🔒 |
| Editar card em que é responsável | `card.edit.own` | ✅ | ✅ | ✅ | ✅🔒 |
| Editar card de outra pessoa | `card.edit.any` | ✅ | ✅ | ✅ | ✅🔒 |
| Criar/editar/remover tarefa | `task.manage` | ✅ | ✅ | ✅ | ✅🔒 |
| Concluir tarefa de checklist | `task.complete` | ✅ | ✅ | ✅ | ✅🔒 |
| Criar/editar **automações** | `automations.manage` | ❌ | ❌ | ✅ | ✅🔒 |
| Criar/editar **regras de compliance** | `compliance.manage` | ❌ | ❌ | ❌ | ✅🔒 |
| Gerenciar usuários e permissões | `users.manage` | ❌ | ❌ | ❌ | ✅🔒 |

✅/❌ = padrão, editável pelo admin. ✅🔒 = concedido e fixo: o `admin` mantém todas as
capacidades sempre. Sem essa trava seria possível remover o acesso à própria
tela de configurações e não haveria como voltar atrás pela interface.

`card.edit.any` e `task.manage` só valem dentro dos quadros que o papel já
pode mexer — desligar `board.projects.mutate` fecha o quadro de projetos
inteiro para aquele papel, independentemente das outras capacidades.

> Regras de compliance nativas (as do briefing) são **imutáveis** mesmo para o `admin`: podem ser consultadas, mas não desligadas. Isso protege o critério de avaliação "as regras realmente bloqueiam".

## 3.2 Configurações do administrador

`/configuracoes` reúne três abas, disponíveis para quem tem `users.manage`:

| Aba | O que faz |
|---|---|
| **Permissões por papel** | Liga e desliga cada capacidade por papel. O contorno âmbar marca o que difere do padrão; "Restaurar padrão do briefing" desfaz tudo. |
| **Usuários** | **Adicionar membro** (nome, e-mail, papel): o sistema gera uma senha temporária exibida uma única vez, e a pessoa define a própria senha no primeiro acesso. Também troca o papel de cada pessoa, e quem é afetado recebe notificação. |
| **Histórico** | Trilha auditável de toda mudança de permissão e de papel: quem mudou, o quê, de que valor para qual e quando. |

Guardas do servidor, não da interface:

- ninguém altera o **próprio papel** — precisa de outro administrador;
- o **último administrador** não pode ser rebaixado;
- o papel `admin` não é editável na matriz;
- toda escrita exige `users.manage` e é registrada em `permission_audit`.

As permissões são lidas da tabela `role_permissions` (linha ausente = padrão)
com cache curto de processo, invalidado a cada gravação. A checagem acontece em
`src/core/domain.ts`, a mesma porta única de escrita do sistema — desligar uma
capacidade recusa a ação com 403 mesmo em chamada direta à camada de domínio,
sem passar pela interface.
