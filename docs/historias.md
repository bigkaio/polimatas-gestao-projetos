# 6. Backlog

## 6.1 Épicos

| # | Épico | Objetivo | Pontos | Prioridade |
|---|---|---|---:|---|
| **E1** | Fundação técnica | Projeto, banco, auth e deploy no ar | 18 | Must |
| **E2** | Núcleo de quadros | Quadros, listas, cards e drag and drop | 24 | Must |
| **E3** | Pipeline de Vendas | Funil comercial completo | 16 | Must |
| **E4** | Pipeline de Projetos | Execução com tarefas, responsáveis e prazos | 15 | Must |
| **E5** | Integração Venda → Projeto | O fluxo central do produto | 14 | Must |
| **E6** | Motor de automações | Regras criadas pelo usuário, sem código | 37 | Must |
| **E7** | Motor de compliance | Regras que bloqueiam de verdade | 21 | Must |
| **E8** | Notificações e atividade | Fechar o ciclo das automações | 10 | Should |
| **E9** | Usabilidade e acabamento | Usar sem treinamento | 13 | Should |
| **E10** | Entrega e demonstração | Deploy, README, credenciais, demo | 8 | Must |
| | **Total** | | **176** | |

## 6.2 Histórias de usuário

> Formato: **US-xx** — *Como \<papel\>, quero \<ação\>, para \<benefício\>.* · Prioridade MoSCoW · Estimativa em pontos.

---

### E1 — Fundação técnica

**US-01 · Setup do projeto — Must · 3 pts**
*Como time, quero o projeto Next.js + TypeScript + Tailwind configurado, para começar a desenvolver com padrão único.*
- Dado o repositório clonado, quando rodo `npm install && npm run dev`, então a aplicação sobe em `localhost:3000`
- ESLint, Prettier e TypeScript em modo `strict` configurados
- Estrutura de pastas definida: `src/app`, `src/core` (domínio), `src/components`, `src/lib`

**US-02 · Schema e migrações — Must · 5 pts**
*Como time, quero o modelo de dados versionado, para evoluir o banco sem quebrar o ambiente de ninguém.*
- Todas as tabelas da seção 5.5 criadas via `prisma migrate`
- `npm run db:migrate` aplica as migrações do zero em um banco vazio
- Constraint `NOT NULL` em `tasks.due_date` presente desde a primeira migração
- Índices da seção 5.5 criados

**US-03 · Autenticação e papéis — Must · 5 pts**
*Como usuário, quero entrar com e-mail e senha, para acessar apenas o que me cabe.*
- Login, logout e sessão persistida via Supabase Auth
- Rotas do app protegidas — usuário não autenticado é redirecionado para `/login`
- Perfil criado automaticamente em `profiles` no primeiro acesso, com papel padrão `member`
- RLS ativo em todas as tabelas conforme a matriz de permissões

**US-04 · Deploy contínuo — Must · 2 pts**
*Como avaliador, quero acessar o sistema por uma URL pública, para testá-lo sem instalar nada.*
- Push na `main` publica automaticamente no Vercel
- Migrações rodam no build (`prisma migrate deploy`)
- Variáveis de ambiente configuradas em produção
- URL pública registrada no README

**US-05 · Dados de demonstração (seed) — Must · 3 pts**
*Como avaliador, quero encontrar o sistema com dados realistas, para entender o produto em 10 segundos.*
- `npm run db:seed` cria 4 usuários (um por papel), os 2 quadros com suas listas, ≥ 6 oportunidades distribuídas no funil, ≥ 4 projetos com checklists, as automações nativas e as regras de compliance
- O seed é idempotente (rodar duas vezes não duplica)

---

### E2 — Núcleo de quadros

**US-06 · Visualizar um quadro — Must · 5 pts**
*Como usuário, quero ver listas e cards lado a lado, para entender o andamento de relance.*
- Listas em colunas horizontais com rolagem; cards empilhados por `position`
- Card exibe título, responsável (avatar), prazo e progresso do checklist (ex.: 2/5)
- Contador de cards e, no funil, soma de valores por lista
- Prazo vencido destacado em vermelho; vencendo em ≤ 2 dias, em âmbar

**US-07 · Criar e editar card — Must · 3 pts**
*Como usuário, quero criar um card direto na lista, para registrar sem sair do fluxo.*
- Botão "+ Adicionar" no rodapé de cada lista abre criação inline
- Título é obrigatório; card aparece no fim da lista sem recarregar a página
- Edição de título inline no próprio card

**US-08 · Drag and drop persistente — Must · 8 pts**
*Como usuário, quero arrastar cards entre listas, para atualizar o status naturalmente.*
- Arrastar dentro da mesma lista reordena; entre listas move e reposiciona
- A nova posição persiste e sobrevive a um refresh
- Atualização otimista com **rollback** quando o servidor recusa (compliance)
- Movimentação também acessível por teclado (dnd-kit sensors)
- Gera `activity_log` e dispara o gatilho `card.moved`

**US-09 · Detalhe do card — Must · 5 pts**
*Como usuário, quero abrir o card e ver tudo sobre ele, para trabalhar sem procurar informação em outro lugar.*
- Modal com título, descrição, responsável, prazo, campos do cliente (quando oportunidade), checklist, histórico
- Todos os campos editáveis com salvamento imediato e feedback
- URL própria (`/board/[key]/card/[id]`) para compartilhar o link do card

**US-10 · Histórico de atividade — Should · 3 pts**
*Como gestor, quero ver o que aconteceu no card, para saber quem mudou o quê e quando.*
- Cada criação, movimentação, mudança de campo e conclusão de tarefa registrada em `activity_log`
- Histórico listado no modal em ordem cronológica reversa, com autor e horário relativo
- Ações executadas por automação aparecem identificadas como **"Automação: \<nome da regra\>"**

---

### E3 — Pipeline de Vendas

**US-11 · Quadro do funil — Must · 3 pts**
*Como vendedor, quero o funil com as etapas do processo, para saber onde cada negociação está.*
- Listas fixas: Lead, Qualificação, Proposta, Negociação, Fechado, Perdido
- *Fechado* e *Perdido* marcadas como terminais (`semantics: won` / `lost`)

**US-12 · Cadastrar oportunidade — Must · 5 pts**
*Como vendedor, quero registrar a oportunidade com os dados do cliente e da negociação, para que virem o projeto depois.*
- Campos: título, cliente (nome, e-mail, telefone), valor estimado, descrição, responsável, previsão de fechamento
- Nome do cliente e título são obrigatórios; valor aceita moeda em formato brasileiro
- A oportunidade nasce em *Lead* (ou na lista de origem, quando criada por lá)

**US-13 · Mover oportunidade — Must · 2 pts**
*Como vendedor, quero arrastar a oportunidade entre etapas, para refletir o avanço da negociação.*
- Movimentação respeita as regras de compliance do funil
- Data de entrada em cada etapa registrada para cálculo de tempo em etapa

**US-14 · Fechar ou perder — Must · 3 pts**
*Como vendedor, quero marcar a venda como Fechada ou Perdida, para encerrar a negociação corretamente.*
- Mover para *Perdido* exige **motivo de perda** (bloqueia sem preenchimento)
- Mover para *Fechado* dispara a automação de criação do projeto
- Confirmação explícita antes de fechar, com resumo do que será criado

**US-15 · Indicadores do funil — Should · 3 pts**
*Como gestor, quero ver os números do funil, para priorizar meu acompanhamento.*
- Cabeçalho de cada lista mostra quantidade e soma dos valores
- Barra superior com total em negociação, total fechado no mês e taxa de conversão

---

### E4 — Pipeline de Projetos

**US-16 · Quadro de execução — Must · 2 pts**
*Como gestor, quero o kanban de projetos, para acompanhar a entrega.*
- Listas: Backlog, Em andamento, Revisão, Concluído, **Atrasados** (destino das automações temporais)
- *Concluído* marcada como terminal (`semantics: done`); *Atrasados*, como `late`

**US-17 · Card de projeto completo — Must · 3 pts**
*Como gestor, quero definir responsável, descrição e prazo, para que ninguém fique sem dono nem sem data.*
- Seleção de responsável entre os usuários cadastrados
- Prazo com date picker em pt-BR
- Dados do cliente herdados aparecem em bloco destacado, com link para a oportunidade de origem

**US-18 · Checklist de tarefas — Must · 5 pts**
*Como executor, quero uma lista de tarefas dentro do card, para saber o que precisa ser feito.*
- Adicionar, editar, reordenar e remover tarefas
- Cada tarefa tem título, **prazo obrigatório** e responsável opcional
- Barra de progresso "concluídas / total" no card e no modal

**US-19 · Concluir tarefa — Must · 2 pts**
*Como executor, quero marcar a tarefa como concluída, para dar visibilidade do avanço.*
- Checkbox alterna o estado e grava `completed_at`
- Dispara o gatilho `task.completed`
- Progresso do card atualiza sem recarregar

**US-20 · Filtros e busca — Should · 3 pts**
*Como gestor, quero filtrar o quadro, para focar no que interessa agora.*
- Filtro por responsável, por prazo (atrasados / vence em 7 dias) e busca por texto
- Filtros combináveis, refletidos na URL para compartilhar a visão filtrada

---

### E5 — Integração Venda → Projeto

**US-21 · Card de projeto gerado automaticamente — Must · 8 pts** ⭐ *história central*
*Como gestor, quero que a venda fechada vire um projeto sozinha, para a execução começar sem repasse manual.*
- Dado que uma oportunidade é movida para *Fechado*, quando a movimentação é confirmada, então um card é criado no *Backlog* de Projetos em menos de 2 segundos
- O card herda: nome/e-mail/telefone do cliente, valor, descrição e responsável da venda
- Título segue o padrão `{cliente} — {título da oportunidade}`
- O card criado registra no histórico "Criado automaticamente pela venda #\<id\>"
- A regra é a automação nativa `is_system`, visível e editável (destino e campos herdados) na tela de automações

**US-22 · Rastreabilidade entre venda e projeto — Must · 3 pts**
*Como gestor, quero navegar do projeto para a venda de origem, para consultar o que foi negociado.*
- `cards.source_card_id` liga projeto → oportunidade
- Ambos os cards exibem link recíproco ("Origem: oportunidade X" / "Projeto gerado: Y")

**US-23 · Idempotência da geração — Must · 3 pts**
*Como gestor, quero que a mesma venda não gere dois projetos, para não duplicar trabalho.*
- Mover a oportunidade para fora e de volta a *Fechado* **não** cria um segundo card
- A tentativa duplicada é registrada em `automation_runs` com status `skipped`

---

### E6 — Motor de automações

**US-24 · Listar e gerenciar automações — Must · 5 pts**
*Como admin, quero uma tela com todas as regras, para saber o que o sistema faz sozinho.*
- Lista com nome, gatilho em linguagem natural, estado (ativa/inativa) e nº de execuções
- Criar, duplicar, editar e excluir (regras `is_system` não podem ser excluídas)

**US-25 · Construtor de regras sem código — Must · 13 pts** ⭐ *história central*
*Como admin sem conhecimento técnico, quero montar a regra escolhendo opções em telas, para automatizar o processo sem programar.*
- Assistente em 3 passos: **Quando** (gatilho) → **Se** (condições) → **Então** (ações)
- Todos os seletores são preenchidos com dados reais (listas, usuários, campos existentes)
- Condições combináveis com E/OU; múltiplas ações por regra, ordenáveis
- Pré-visualização em português: *"Quando um card entrar em Revisão, se o responsável estiver preenchido, então notificar o responsável."*
- Nenhum campo pede JSON, código ou expressão — a regra é gerada e validada por Zod antes de salvar

**US-26 · Execução em eventos — Must · 8 pts**
*Como usuário, quero que a regra aja sozinha quando o evento acontece, para não depender de ninguém lembrar.*
- Toda mutação emite seu evento de domínio e o motor avalia as regras ativas correspondentes
- Ações executadas na ordem definida; falha em uma ação não impede as demais, e o erro fica registrado
- Ações passam pelo compliance; violação registra `blocked_by_compliance`
- Encadeamento limitado a 3 níveis (proteção contra laço)

**US-27 · Gatilhos temporais — Must · 5 pts**
*Como gestor, quero que atrasos sejam tratados automaticamente, para o quadro refletir a realidade sem curadoria manual.*
- Vercel Cron chama `/api/cron/tick` a cada 15 minutos, autenticado por `CRON_SECRET`
- O tick avalia `card.overdue`, `task.overdue` e `card.due_soon`
- Um mesmo atraso não dispara a mesma regra duas vezes (chave de idempotência por dia)
- Regra de exemplo entregue no seed: tarefa vencida move o card para *Atrasados* e notifica o responsável

**US-28 · Histórico de execuções — Should · 3 pts**
*Como admin, quero ver quando cada regra rodou, para confiar (ou depurar) a automação.*
- Tabela de `automation_runs` com data/hora, card afetado, status e mensagem de erro
- Filtro por regra e por status

**US-29 · Ativar, desativar e testar regra — Should · 3 pts**
*Como admin, quero desligar uma regra sem apagá-la e testá-la antes, para experimentar com segurança.*
- Interruptor liga/desliga com efeito imediato
- Botão "Testar" simula a regra contra um card escolhido e mostra o que **seria** feito, sem executar

---

### E7 — Motor de compliance

**US-30 · Gerenciar regras de compliance — Must · 5 pts**
*Como admin, quero ver e configurar as regras do processo, para adaptá-las à realidade da Polímatas.*
- Tela lista as regras com escopo, severidade (bloqueia / avisa) e estado
- Regras nativas do briefing aparecem marcadas como **obrigatórias** e não podem ser desligadas
- Regras adicionais criadas com o mesmo construtor de condições das automações

**US-31 · Bloqueio no servidor — Must · 8 pts** ⭐ *história central*
*Como empresa, quero que ações fora do padrão sejam impedidas, para o processo ser cumprido de fato.*
- Dado uma tarefa sem prazo, quando tento salvar, então a criação é recusada com `422` e a tarefa **não** existe no banco
- Dado um projeto com tarefas abertas, quando arrasto para *Concluído*, então o card volta para a lista de origem e nada é persistido
- O bloqueio ocorre mesmo em chamada direta à API, sem passar pela interface *(verificado por teste automatizado)*
- Constraints/trigger no Postgres como segunda linha de defesa

**US-32 · Feedback claro do bloqueio — Must · 3 pts**
*Como usuário, quero entender por que fui impedido e o que fazer, para resolver sozinho.*
- Mensagem específica da regra violada, em português, dizendo a ação corretiva
- Ao arrastar, a lista de destino inválida fica visualmente indisponível antes do drop
- Ao ser bloqueado no modal, o campo pendente recebe foco e destaque

**US-33 · Regras nativas do briefing — Must · 3 pts**
*Como avaliador, quero ver as duas regras exigidas funcionando, para validar o critério de compliance.*
- "Nenhuma tarefa sem deadline" ativa e bloqueante
- "Nenhum projeto vai para Concluído com tarefas abertas" ativa e bloqueante
- Ambas cobertas por teste automatizado

**US-34 · Log de bloqueios — Should · 2 pts**
*Como admin, quero ver o que o sistema impediu, para saber onde o time tropeça no processo.*
- Cada bloqueio grava `compliance_violations` com regra, card, usuário e horário
- Tela mostra os bloqueios recentes

---

### E8 — Notificações e comunicação

**US-35 · Central de notificações — Should · 5 pts**
*Como responsável, quero receber avisos no sistema, para não perder o que é meu.*
- Sino no cabeçalho com contador de não lidas
- Painel lista as notificações com link para o card; marcar como lida individual e em massa

**US-36 · Aviso em tempo real — Should · 2 pts**
*Como usuário, quero ver o aviso na hora, para reagir imediatamente.*
- Toast quando uma notificação chega com a aba aberta (Supabase Realtime)
- O quadro atualiza sozinho quando outro usuário move um card

**US-37 · Notificação por e-mail — Could · 3 pts**
*Como responsável, quero receber e-mail quando algo urgente acontece, para saber mesmo fora do sistema.*
- Ação `notify_user` com opção "também por e-mail"
- Envio assíncrono; falha de e-mail não quebra a automação

---

### E9 — Usabilidade e acabamento

**US-38 · Layout responsivo — Should · 5 pts**
*Como usuário, quero usar no notebook e no celular, para acompanhar de onde estiver.*
- Quadro com rolagem horizontal em telas pequenas e modal em tela cheia no mobile
- Alvos de toque adequados; DnD funcional em touch

**US-39 · Primeiros passos guiados — Should · 3 pts**
*Como usuário novo, quero entender o sistema sem treinamento, para começar a usar em minutos.*
- Tela inicial explica os dois quadros e o fluxo venda → projeto em três frases
- Dica contextual na primeira visita a Automações e Compliance

**US-40 · Estados vazios e microcopy — Should · 2 pts**
*Como usuário, quero ser orientado quando não há nada na tela, para saber qual é o próximo passo.*
- Lista vazia mostra chamada de ação ("Nenhuma oportunidade em Proposta — arraste uma ou crie a primeira")
- Erros em linguagem de negócio, nunca mensagem técnica crua

**US-41 · Acessibilidade — Could · 3 pts**
*Como usuário de teclado ou leitor de tela, quero operar o quadro, para não depender do mouse.*
- Movimentação de cards por teclado com anúncio da ação (`aria-live`)
- Foco visível, rótulos em todos os campos, contraste mínimo AA

---

### E10 — Entrega e demonstração

**US-42 · README com decisões técnicas — Must · 3 pts**
*Como avaliador, quero entender as escolhas do time, para julgar a solução além da tela.*
- README com stack e justificativa, arquitetura, modelo de dados, como rodar localmente e como o motor de automações e o de compliance funcionam
- Este backlog referenciado a partir do README

**US-43 · Credenciais de teste — Must · 1 pt**
*Como avaliador, quero entrar no sistema publicado, para testar cada papel.*
- Um usuário por papel documentado no README, com a URL de produção

**US-44 · Roteiro e ensaio da demo — Must · 2 pts**
*Como time, quero a demonstração ensaiada, para apresentar o fluxo completo em poucos minutos.*
- Roteiro da seção 11 validado no ambiente de produção, com dados prontos
- Plano B: gravação do fluxo, caso a rede falhe

**US-45 · Monitoramento básico — Could · 2 pts**
*Como time, quero saber se algo quebrou em produção, para corrigir antes da apresentação.*
- Captura de erros no servidor e nas ações do cliente com registro consultável
