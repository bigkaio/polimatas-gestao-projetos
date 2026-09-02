# Backlog do Produto — Polímatas Flow

| | |
|---|---|
| **Produto** | Polímatas Flow — Gestão de Vendas e Projetos |
| **Contexto** | Hackathon Polímatas |
| **Versão do documento** | 1.0 |
| **Data** | 02/09/2026 |
| **Repositório** | `bigkaio/polimatas-gestao-projetos` |
| **Status** | Backlog aprovado para execução |


## 1. Visão do produto

> Para o **time comercial e de operações da Polímatas**, que hoje controla vendas e projetos em planilhas, WhatsApp e anotações soltas, o **Polímatas Flow** é um **sistema web de quadros no estilo Trello** que conecta o funil de vendas à execução dos projetos.
> Diferente de um Trello genérico, ele **transforma venda fechada em projeto automaticamente**, permite que o próprio usuário **crie automações sem programar** e **bloqueia** ações fora do padrão por meio de regras de compliance.

### 1.1 Dores → resposta do produto

| Dor atual | Consequência | Como o sistema responde |
|---|---|---|
| Venda fechada demora a virar projeto | Retrabalho, cliente esperando | Automação nativa venda *Fechada* → card de projeto criado na hora, herdando dados |
| Tarefa sem responsável | Ninguém executa, ninguém cobra | Campo de responsável no card e na tarefa + regra de compliance opcional exigindo responsável |
| Prazo perdido | Entrega atrasada, cliente insatisfeito | Deadline obrigatório por compliance + automação temporal movendo/avisando atrasados |
| Nenhuma visibilidade do andamento | Gestão por achismo | Dois quadros kanban com indicadores de funil, filtros e histórico por card |
| Regras de processo vivem na cabeça das pessoas | Padrão não é seguido | Motor de compliance que **bloqueia** a ação no servidor, não só avisa |

### 1.2 Métricas de sucesso

| Métrica | Alvo |
|---|---|
| **North star** — vendas fechadas que viram projeto | 100%, em menos de 2 segundos, sem ação manual |
| Tarefas criadas sem deadline | 0 (bloqueado pelo compliance) |
| Projetos concluídos com tarefas abertas | 0 (bloqueado pelo compliance) |
| Automações criadas pelo usuário na demo | ≥ 2 criadas ao vivo, sem tocar em código |
| Tempo para um usuário novo criar sua 1ª oportunidade | < 60 segundos, sem treinamento |
