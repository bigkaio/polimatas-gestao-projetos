# Demonstração, futuro e glossário

## 11. Roteiro da demonstração (≈ 5 minutos)

| # | Tempo | O que mostrar | Mensagem |
|---|---|---|---|
| 1 | 0:00–0:30 | Abrir a URL pública e fazer login | "Está no ar, qualquer um da Polímatas entra" |
| 2 | 0:30–1:15 | Pipeline de Vendas com o funil povoado; criar a oportunidade "Consultoria — Cliente Novo" | "O comercial registra em segundos" |
| 3 | 1:15–2:15 | Arrastar até *Fechado* e confirmar; **trocar para o quadro de Projetos e mostrar o card já criado** com os dados do cliente | ⭐ "Venda fechada vira projeto sozinha" |
| 4 | 2:15–3:00 | No card, tentar criar tarefa sem prazo → **bloqueado**; adicionar prazo e salvar | ⭐ "O compliance impede de verdade, não avisa" |
| 5 | 3:00–3:30 | Arrastar o projeto para *Concluído* com tarefa aberta → **bloqueado** com o motivo | "A regra do briefing, funcionando" |
| 6 | 3:30–4:30 | Abrir Automações e **criar uma regra ao vivo**: "quando entrar em Revisão, notificar o responsável"; mover um card e mostrar a notificação chegando | ⭐ "Automação configurável pelo usuário, sem código" |
| 7 | 4:30–5:00 | Mostrar o log de execuções e o log de bloqueios | "Tudo auditável — dá para confiar no processo" |


---

## 12. Backlog futuro (pós-hackathon)

| Item | Valor |
|---|---|
| Relatórios e dashboard de produtividade (tempo por etapa, taxa de conversão, carga por responsável) | Gestão baseada em dados |
| Templates de projeto (checklist padrão por tipo de serviço) | Padroniza a execução |
| Comentários e menções `@usuário` nos cards | Reduz a conversa que hoje vive no WhatsApp |
| Anexos em cards e tarefas | Centraliza contrato, proposta e briefing |
| Integração com WhatsApp/Slack como ação de automação | Aviso onde o time já está |
| Automações com agendamento próprio (ex.: "toda segunda às 9h") | Rotinas recorrentes |
| Multi-quadro (um quadro de projetos por área/cliente) | Escala organizacional |
| Importação de planilhas legadas | Migração dos dados atuais |
| Log de auditoria exportável | Exigência de clientes corporativos |
| Aplicativo mobile / PWA instalável | Uso em campo |


---

## 13. Glossário

| Termo | Significado |
|---|---|
| **Quadro (board)** | Superfície de trabalho que agrupa listas. O sistema tem dois: Vendas e Projetos |
| **Lista** | Coluna do quadro, representando uma etapa (ex.: *Negociação*, *Em andamento*) |
| **Card** | Unidade de trabalho: uma **oportunidade** no quadro de Vendas, um **projeto** no de Projetos |
| **Tarefa** | Item do checklist dentro de um card de projeto; sempre tem prazo |
| **Automação** | Regra criada pelo usuário no formato Quando → Se → Então, executada pelo sistema |
| **Gatilho** | Evento que inicia a avaliação de uma automação |
| **Compliance** | Regra que **impede** uma ação fora do padrão antes de ela ser gravada |
| **Guard** | Componente do servidor que avalia o compliance antes de qualquer escrita |
| **Lista terminal** | Lista que encerra um fluxo (*Fechado*, *Perdido*, *Concluído*) e concentra as regras mais rígidas |
| **Seed** | Carga inicial de dados de demonstração |
