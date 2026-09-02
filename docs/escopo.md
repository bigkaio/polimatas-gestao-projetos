# 2. Escopo

## 2.1 Dentro do escopo (hackathon)

- Dois quadros integrados: **Pipeline de Vendas** e **Pipeline de Projetos**
- Quadros, listas e cards com **drag and drop** persistido
- Cards com responsável, descrição, prazo e **checklist de tarefas**
- **Integração automática** venda *Fechada* → card de projeto
- **Motor de automações personalizáveis** configurado pela UI (sem código)
- **Motor de compliance** com regras bloqueantes aplicadas no servidor
- Notificações in-app, histórico de atividade por card e log de execuções/bloqueios
- Autenticação, papéis de usuário e dados de demonstração (seed)
- Deploy público contínuo + credenciais de teste

## 2.2 Fora do escopo (declarado)

- Plataforma de **atendimento** ao cliente (chat, inbox, WhatsApp integrado) — o briefing exclui explicitamente
- Faturamento, contratos, emissão de nota fiscal, integração financeira
- App mobile nativo (a entrega é web responsiva)
- Relatórios/BI avançados, dashboards analíticos, exportação de dados
- Multi-tenant / múltiplas empresas — o sistema é de uso interno da Polímatas
- Importação de planilhas legadas
- Automações com integrações externas (Slack, e-mail transacional em massa, webhooks de terceiros) — apenas notificação in-app e e-mail simples

## 2.3 Premissas

- Volume esperado: dezenas de usuários, centenas de cards — não há requisito de escala massiva
- Todos os usuários são da Polímatas e autenticados; não há acesso público de leitura
- Idioma único: **pt-BR**. Fuso: **America/Sao_Paulo** (persistência em UTC)
- O quadro é compartilhado — não existe quadro privado por usuário

## 2.4 Restrições

- Prazo do hackathon (planejado para ~40 horas de trabalho efetivo do time)
- Infraestrutura restrita a planos gratuitos (Vercel Hobby + Supabase Free)
- A avaliação exige **sistema no ar** — deploy é requisito, não item opcional
