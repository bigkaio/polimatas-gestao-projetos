# 3. Personas e papéis

| Persona | Quem é | O que precisa | Papel no sistema |
|---|---|---|---|
| **Vendedor** | Comercial da Polímatas | Registrar oportunidades e movê-las pelo funil sem burocracia | `sales` |
| **Gestor de Projetos** | Coordena a execução | Ver o projeto nascer da venda, distribuir tarefas, cobrar prazos | `manager` |
| **Executor** | Dev / designer / analista | Ver o que é dele, marcar tarefa como concluída | `member` |
| **Administrador** | Dono do processo | Criar automações e regras de compliance, gerenciar usuários | `admin` |

## 3.1 Matriz de permissões

| Ação | `sales` | `member` | `manager` | `admin` |
|---|:--:|:--:|:--:|:--:|
| Ver ambos os quadros | ✅ | ✅ | ✅ | ✅ |
| Criar/mover oportunidade | ✅ | ❌ | ✅ | ✅ |
| Criar/mover card de projeto | ❌ | ❌ | ✅ | ✅ |
| Editar card em que é responsável | ✅ | ✅ | ✅ | ✅ |
| Concluir tarefa de checklist | ✅ | ✅ | ✅ | ✅ |
| Criar/editar **automações** | ❌ | ❌ | ✅ | ✅ |
| Criar/editar **regras de compliance** | ❌ | ❌ | ❌ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ❌ | ✅ |

> Regras de compliance nativas (as do briefing) são **imutáveis** mesmo para o `admin`: podem ser consultadas, mas não desligadas. Isso protege o critério de avaliação "as regras realmente bloqueiam".
