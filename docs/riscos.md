# Riscos e rastreabilidade

## 9. Riscos e mitigações

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| R1 | Construtor de automações (US-25) consome mais tempo que o previsto | Alta | Alto | Fatiar: primeiro versão com 3 gatilhos e 3 ações, ampliar depois; o motor já lê JSON genérico, a UI cresce sem refatorar |
| R2 | Drag and drop com bug em mobile ou conflito com o rollback do compliance | Média | Alto | Adotar dnd-kit desde o início; testar o cenário "movimento bloqueado" ainda no S1 |
| R3 | Automação disparando automação em laço | Média | Alto | Limite de profundidade 3 + idempotência por evento + log de execuções |
| R4 | RLS mal configurado bloqueando escrita legítima | Média | Médio | Escrever as policies junto com a migração e testar cada papel no seed |
| R5 | Deploy só no fim, quebrando na véspera | Baixa | Crítico | Deploy no ar já no S0; toda história é validada em produção |
| R6 | Fuso horário fazendo prazos "vencerem" errado | Média | Médio | Persistir em UTC, exibir em America/Sao_Paulo, comparar sempre no servidor |
| R7 | Cron do plano gratuito com limite de execuções | Baixa | Médio | Intervalo de 15 min (dentro do limite) + botão manual "reavaliar prazos" para a demo |
| R8 | Demo ao vivo falhando por rede ou dado inconsistente | Média | Alto | Ensaio no ambiente real, seed determinístico e gravação do fluxo como plano B |
| R9 | Escopo crescer com ideias durante o hackathon | Alta | Médio | Corte de MVP da seção 7.3 é a referência; ideias novas vão para a seção 12 |


---

## 10. Rastreabilidade: critérios de avaliação → backlog

| Critério do desafio | O que é olhado | Histórias que respondem | Prova na demo |
|---|---|---|---|
| **Funcionamento** | O fluxo venda → projeto roda de ponta a ponta? | US-11…US-14, US-16…US-19, **US-21**, US-22, US-23 | Criar oportunidade e movê-la até *Fechada*, com o card de projeto nascendo na tela |
| **Automação** | As regras são configuráveis ou fixas no código? | US-24, **US-25**, US-26, US-27, US-28, US-29 | Criar uma regra nova ao vivo, pela interface, e vê-la disparar em seguida |
| **Compliance** | As regras bloqueiam ou só avisam? | US-30, **US-31**, US-32, US-33, US-34 | Tentar salvar tarefa sem prazo e concluir projeto com tarefa aberta — ambos recusados, com o banco intacto |
| **Usabilidade** | Alguém usaria sem treinamento? | US-06, US-09, US-32, US-38, US-39, US-40, US-41 | Percurso completo sem abrir manual, com linguagem de negócio na tela |
| **Apresentação** | Demo clara e objetiva | US-05, US-42, US-43, US-44 | Roteiro da seção 11, em ambiente publicado |
