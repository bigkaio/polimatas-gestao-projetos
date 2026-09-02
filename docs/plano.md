# Plano de execução

## 7. Priorização e plano de execução

### 7.1 Critério de priorização

Ordem: **(1)** o que a avaliação mede diretamente → **(2)** o que desbloqueia outras histórias → **(3)** o que reduz risco técnico → **(4)** acabamento. Um item de acabamento nunca entra antes de um item Must ainda aberto.

### 7.2 Sprints do hackathon (~40h de trabalho efetivo)

| Sprint | Janela | Conteúdo | Pontos | Resultado ao final |
|---|---|---|---:|---|
| **S0 — Fundação** | h0–h6 | E1 completo (US-01…US-05) | 18 | Aplicação vazia **no ar**, com login e banco migrado |
| **S1 — Quadros** | h6–h18 | E2, E3, E4 | 55 | Dois quadros usáveis com drag and drop, cards e checklists |
| **S2 — Motores** | h18–h32 | E5, E6, E7 | 72 | Fluxo venda→projeto, automações configuráveis e compliance bloqueando |
| **S3 — Acabamento** | h32–h40 | E8, E9, E10 | 31 | Notificações, usabilidade, README, seed e demo ensaiada |

### 7.3 Corte de MVP demonstrável (h30 — *feature freeze* funcional)

Se o tempo apertar, este é o conjunto **inegociável**, porque cobre todos os critérios de avaliação:

US-01 · US-02 · US-03 · US-04 · US-05 · US-06 · US-07 · US-08 · US-09 · US-11 · US-12 · US-13 · US-14 · US-16 · US-17 · US-18 · US-19 · **US-21** · US-22 · US-23 · US-24 · **US-25** · US-26 · US-27 · US-30 · **US-31** · US-32 · US-33 · US-35 · US-42 · US-43 · US-44

Primeiros itens a sair do escopo, nesta ordem: US-37 (e-mail), US-45 (monitoramento), US-41 (acessibilidade avançada), US-15 (indicadores), US-20 (filtros), US-28 (histórico de execuções).


---

## 8. Definition of Ready e Definition of Done

### 8.1 Definition of Ready (para a história entrar no sprint)

- Descrita no formato história de usuário, com benefício explícito
- Critérios de aceite verificáveis e sem ambiguidade
- Dependências identificadas e já concluídas ou planejadas antes
- Estimada pelo time e cabendo em um dia de trabalho (senão, é quebrada)
- Impactos em compliance e automação avaliados

### 8.2 Definition of Done (para a história ser considerada pronta)

- Todos os critérios de aceite atendidos e verificados manualmente
- Código com TypeScript `strict` sem erro e lint limpo
- Mutação passando pela camada de domínio (compliance + eventos), sem acesso direto ao banco na rota
- Teste automatizado nos motores e no fluxo central (histórias ⭐)
- Funcionando **em produção**, não só localmente
- Sem regressão no fluxo venda → projeto
- Textos em pt-BR, estados de carregamento e de erro tratados
