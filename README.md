# Polímatas — Gestão de Vendas e Projetos

Sistema web para centralizar o funil comercial e a execução de projetos da Polímatas em uma única ferramenta, no estilo Trello, eliminando o controle disperso em planilhas, WhatsApp e anotações soltas.

Projeto desenvolvido para o **Hackathon Polímatas**.

## Contexto

A Polímatas é uma empresa de tecnologia que hoje controla projetos e vendas de forma dispersa. Conforme o volume de clientes cresce, isso gera retrabalho: venda fechada que demora a virar projeto, tarefa sem responsável, prazo perdido e nenhuma visibilidade do andamento.

Este sistema conecta o comercial à execução em dois quadros integrados.

## O que o sistema faz

**Pipeline de Vendas** — oportunidades comerciais avançam pelas etapas Lead → Qualificação → Proposta → Negociação → Fechado/Perdido. É apenas o controle do funil, não uma plataforma de atendimento.

**Pipeline de Projetos** — quadro kanban de execução (Backlog → Em andamento → Revisão → Concluído), com cards, tarefas, responsáveis e prazos.

**Integração automática** — sempre que uma venda é marcada como *Fechada*, o sistema gera automaticamente um card de projeto, herdando os dados do cliente e da negociação. Esse é o fluxo central do produto: criar oportunidade → mover até *Fechada* → ver o card nascer no pipeline de projetos.

## Funcionalidades

- Interface tipo Trello: quadros, listas, cards e drag and drop
- Cadastro e movimentação de oportunidades e projetos
- Cards com responsável, descrição, prazo e checklist de tarefas
- **Automações personalizáveis**, criadas pelo próprio usuário sem programar (ex.: "quando o card entrar em Revisão, notificar o responsável"; "quando a tarefa passar do prazo, mover para Atrasados")
- **Compliance**: regras que o sistema impõe e bloqueiam ações fora do padrão (ex.: nenhuma tarefa pode ser criada sem deadline; nenhum projeto pode ir para Concluído com tarefas abertas)

## Stack técnica

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend / fullstack | Next.js | App Router + API routes no mesmo projeto, deploy direto no Vercel a cada push |
| Hospedagem | Vercel | Plano gratuito, deploy automático via GitHub |
| Banco de dados | Supabase (Postgres) | Plano gratuito, autenticação e banco relacional prontos, setup rápido |

> A stack é livre por definição do desafio; esta é a decisão adotada pelo time por ser o caminho mais curto até um sistema no ar (push no GitHub e o deploy sobe sozinho).

## Como rodar localmente

Pré-requisitos: Node.js 18+ e uma conta no [Supabase](https://supabase.com) (ou Neon) para o banco de dados.

```bash
# clonar o repositório
git clone https://github.com/bigkaio/polimatas-gestao-projetos.git
cd polimatas-gestao-projetos

# instalar dependências
npm install

# configurar variáveis de ambiente
cp .env.example .env.local
# preencher DATABASE_URL / SUPABASE_URL / SUPABASE_ANON_KEY com as credenciais do seu projeto

# rodar as migrações do banco
npm run db:migrate

# subir o servidor de desenvolvimento
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

## Deploy

- **Produção:** _(link será adicionado quando o deploy estiver publicado)_
- **Credenciais de teste:** _(a definir)_

## Decisões técnicas

_Esta seção será atualizada conforme o desenvolvimento avança, registrando as decisões de arquitetura tomadas pelo time (modelagem do banco, motor de automações, estratégia de compliance, etc.)._

## Status do projeto

🚧 Em desenvolvimento — repositório inicial criado a partir do briefing do desafio.

## Critérios de avaliação

| Critério | O que é avaliado |
|---|---|
| Funcionamento | O fluxo venda → projeto roda de ponta a ponta? |
| Automação | As regras são configuráveis pelo usuário ou estão fixas no código? |
| Compliance | As regras realmente bloqueiam, ou são só avisos? |
| Usabilidade | Alguém da Polímatas conseguiria usar sem treinamento? |
| Apresentação | Demo clara e objetiva |
