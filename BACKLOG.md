# Backlog do Produto — Polímatas Flow

O backlog completo foi publicado como site de documentação (MkDocs Material) e está disponível em:

### 📖 https://bigkaio.github.io/polimatas-gestao-projetos/

O conteúdo é mantido em [`docs/`](docs/), uma página por seção:

| Seção | Página |
|---|---|
| Visão do produto, dores e métricas de sucesso | [`docs/index.md`](docs/index.md) |
| Escopo, premissas e restrições | [`docs/escopo.md`](docs/escopo.md) |
| Personas, papéis e matriz de permissões | [`docs/personas.md`](docs/personas.md) |
| Stack escolhida e ADRs | [`docs/stack.md`](docs/stack.md) |
| Arquitetura, motores de automação e compliance, modelo de dados | [`docs/arquitetura.md`](docs/arquitetura.md) |
| Épicos e histórias de usuário com critérios de aceite | [`docs/historias.md`](docs/historias.md) |
| Priorização, sprints, Definition of Ready e Definition of Done | [`docs/plano.md`](docs/plano.md) |
| Riscos, mitigações e rastreabilidade dos critérios de avaliação | [`docs/riscos.md`](docs/riscos.md) |
| Roteiro da demo, backlog futuro e glossário | [`docs/demo.md`](docs/demo.md) |

## Rodar a documentação localmente

```bash
pip install -r requirements.txt
mkdocs serve
```

O site fica em `http://127.0.0.1:8000`. Todo push na branch `main` que altere `docs/` ou `mkdocs.yml` republica o site automaticamente via GitHub Actions.
