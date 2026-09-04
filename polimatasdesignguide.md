# Guia de Identidade Visual — Polímatas AI
### Referência para desenvolvimento do sistema interno/produto da Polímatas

Este documento reúne a identidade visual extraída do site oficial (https://www.polimatas.tec.br/) para que o sistema a ser desenvolvido para a Polímatas mantenha consistência visual com a marca: mesma paleta de cores, tipografia, estilo de componentes, tom de voz e padrões de layout.

---

## 1. Conceito da marca

A Polímatas é uma empresa de automação e Inteligência Artificial para negócios. O nome remete ao conceito de "polímata" (pessoa com domínio em múltiplas áreas do conhecimento, como Leonardo da Vinci), e essa é a metáfora central usada no site: unir conhecimento multidisciplinar (IA, automação, estratégia) para resolver problemas de negócio.

**Tom de voz:** direto, técnico mas acessível, orientado a resultado ("automação 24/7", "suporte contínuo", "sem obrigação de contratação"). Frases curtas, objetivas, com CTAs de ação clara (ex.: "Agende uma chamada agora", "Quero automatizar meu negócio").

**Tagline principal:** "Formamos profissionais e automatizamos empresas."

**Frase de posicionamento (hero):** "Automação e inteligência artificial aplicadas com método, critério e visão estratégica."

**Slogan do rodapé:** "Transformando negócios com automação inteligente e soluções de IA sob medida."

---

## 2. Paleta de cores

O site usa um tema **dark mode** quase puro, com preto/quase-preto como base e acentos em ciano/azul, além de gradientes coloridos pontuais em elementos de destaque.

### 2.1 Cores base (fundo e neutros)

| Uso | Cor (RGB) | Hex aproximado | Observação |
|---|---|---|---|
| Fundo principal do site | `rgb(0, 0, 0)` | `#000000` | Preto puro, base de quase todas as seções |
| Fundo alternativo de seção (cards, hero) | `rgb(3, 7, 18)` | `#030712` | Preto azulado (slate-950) |
| Fundo de cards/painéis | `rgb(20, 20, 19)` / `rgb(31, 41, 55)` / `rgb(38, 38, 38)` | `#141413` / `#1F2937` / `#262626` | Cinza muito escuro, variações leves entre seções |
| Overlay escuro (imagens/vídeos) | `rgba(0, 0, 0, 0.45)` a `rgba(0, 0, 0, 0.9)` | — | Usado sobre imagens de depoimentos/hero |
| Texto principal | `rgb(255, 255, 255)` | `#FFFFFF` | Branco puro para títulos |
| Texto secundário | `rgb(209, 213, 219)` | `#D1D5DB` | Parágrafos e subtítulos |
| Texto terciário/legendas | `rgb(156, 163, 175)` / `rgb(107, 114, 128)` | `#9CA3AF` / `#6B7280` | Textos de apoio, legendas discretas |
| Bordas/divisores | `rgba(255, 255, 255, 0.1)` | — | Linhas e contornos sutis sobre fundo escuro |

### 2.2 Cor de destaque (accent) — Ciano

A cor de identidade principal da marca é o **ciano/azul-turquesa**, usada no logo, em links, títulos parciais em destaque e no botão principal de CTA.

| Uso | Cor (RGB) | Hex aproximado |
|---|---|---|
| Ciano primário (logo, links, destaques de texto) | `rgb(34, 211, 238)` | `#22D3EE` (Tailwind cyan-400) |
| Ciano secundário (hover/botões sólidos) | `rgb(6, 182, 212)` | `#06B6D4` (Tailwind cyan-500) |
| Azul-céu (variações de gradiente/linhas decorativas) | `rgb(56, 182, 254)` | `#38B6FE` |

> O logo (um "raio"/relâmpago estilizado) é ciano sobre fundo transparente/preto — símbolo de energia/automação.

### 2.3 Gradientes de destaque (CTAs e badges)

Botões e elementos de destaque específicos usam gradientes vibrantes sobre o fundo escuro, contrastando com o resto da paleta neutra:

- **Gradiente azul → roxo** (ex.: botão "Nossa Solução" no comparativo):
  `linear-gradient(to right, #60A5FA, #3B82F6, #A855F7)`
- **Gradiente verde** (indicadores de "positivo"/vantagem):
  `linear-gradient(to right, #4ADE80, #10B981, #16A34A)`
- **Gradiente ciano sutil** (linhas decorativas, glow de fundo):
  `linear-gradient(90deg, rgba(56,182,254,0.35) 0%, rgba(56,182,254,0.25) 50%, rgba(56,182,254,0) 100%)`
- **Glow radial de fundo** (usado no hero e em seções escuras para dar profundidade):
  `radial-gradient(circle at 30% 50%, rgba(6,182,212,0.06), transparent 50%)`
- **Faixa hero** (topo, atrás do header): gradiente escuro azul-petróleo → preto:
  `linear-gradient(#164E63, #155E75, #000000)`

### 2.4 Resumo — paleta para uso em código (CSS custom properties)

```css
:root {
  /* Base */
  --bg-primary: #000000;
  --bg-secondary: #030712;
  --bg-card: #141413;
  --bg-card-alt: #1F2937;

  /* Texto */
  --text-primary: #FFFFFF;
  --text-secondary: #D1D5DB;
  --text-muted: #9CA3AF;
  --text-subtle: #6B7280;

  /* Accent (marca) */
  --accent-cyan-400: #22D3EE;
  --accent-cyan-500: #06B6D4;
  --accent-sky: #38B6FE;

  /* Gradientes */
  --gradient-primary: linear-gradient(to right, #60A5FA, #3B82F6, #A855F7);
  --gradient-success: linear-gradient(to right, #4ADE80, #10B981, #16A34A);
  --gradient-glow: radial-gradient(circle at 30% 50%, rgba(6,182,212,0.06), transparent 50%);

  /* Bordas */
  --border-subtle: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.4);
}
```

---

## 3. Tipografia

- **Fonte principal:** `Inter` (com fallback `system-ui, sans-serif`).
- **Estilo dos títulos:** peso **leve/fino** (`font-weight: 300`), tamanhos grandes, transmitindo elegância e modernidade — foge do padrão "bold pesado" de sites de tecnologia genéricos.
- **Texto de corpo:** peso normal (400), cor `--text-secondary`, boa legibilidade sobre fundo escuro.
- **Destaques dentro de títulos:** palavras-chave dentro de um H2/H3 recebem a cor ciano (`--accent-cyan-400`) para chamar atenção, ex.: "Integração entre **Sistemas**", "Treinamento da **equipe**".

### Escala tipográfica observada

| Elemento | Tamanho | Peso | Cor |
|---|---|---|---|
| H1 (hero) | 36px (mobile) → tende a ~56-64px em desktop | 300 | Branco |
| H2 grande (seções de destaque, ex. "Serviços", "Casos") | 60px | 300 | Branco |
| H2 padrão (títulos de seção) | 48px | 300 | Branco |
| H2 secundário | 36px | 300 | Branco |
| H3 (cards) | ~24-28px | 400-500 | Branco / ciano no destaque |
| Parágrafo / body | 16-18px | 400 | `--text-secondary` |
| Legenda / badge (ex. "Sobre Nós", "MODELO POLÍMATAS") | 12-14px, uppercase, letter-spacing aumentado | 500-600 | Ciano ou branco translúcido |

### Recomendação de uso em CSS

```css
body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }

h1, h2 { font-weight: 300; letter-spacing: -0.02em; }
h3, .card-title { font-weight: 500; }
.eyebrow-label { text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; color: var(--accent-cyan-400); }
```

---

## 4. Layout e estrutura de página

O site segue um padrão de **landing page institucional de uma página só** (single page com âncoras), com as seguintes seções, na ordem:

1. **Header fixo (sticky)** — barra flutuante, semi-transparente com blur, cantos arredondados, "flutuando" com margem em relação ao topo/laterais.
2. **Hero** — título grande, subtítulo/tagline, dois CTAs (botão outline/escuro + botão outline verde), fundo com gradiente escuro e linhas decorativas animadas (rede/conexões, remetendo a "rede neural"), indicador de scroll animado.
3. **Sobre (Sobre Nós)** — badge "Sobre Nós", título de seção, texto explicativo, lista "O que fazemos" com bullets em ciano, imagem ilustrativa ao lado (arte conceitual de Da Vinci "cyborg", reforçando o conceito polímata).
4. **Tecnologias usadas** — faixa horizontal com logos de tecnologias/parceiros (Clinicorp, Asaas, WordPress, n8n, Python, Docker, PostgreSQL, Supabase etc.), em cinza/monocromático sobre fundo preto.
5. **Serviços** — grid de cards (3 colunas x 2 linhas), cada card com: ícone em círculo, título (com palavra-chave em ciano), descrição curta, link "Conheça mais →". Fundo dos cards levemente diferenciado do fundo geral, com decoração de linhas onduladas ao fundo.
6. **Como Funciona (processo)** — layout em duas colunas: texto explicativo + CTA à esquerda, timeline vertical de etapas à direita (linha vertical conectando itens numerados/com ícone).
7. **Casos de sucesso** — grid de cards com vídeo/depoimento (thumbnail com botão de play), nome do cliente e citação. Fundo com textura de pontos (dot grid) sutil.
8. **Quem somos (equipe)** — três colunas com foto circular, nome, cargo (em ciano) e bio curta dos fundadores.
9. **Comparações ("Por que nos escolher")** — tabela comparativa entre "Nossa Solução" (destaque com gradiente) vs. concorrentes genéricos ("Ferramentas prontas", "Freelancers"), com ícones de check/x por linha de recurso.
10. **Contato / CTA final** — bloco centralizado com título, texto, botão CTA sólido em ciano e 3 microcopys de reforço ("Chamada gratuita • Diagnóstico personalizado • Sem obrigação de contratação").
11. **Footer** — 4 colunas: logo + slogan, navegação, links legais (Política de Privacidade, Termos de Uso, Cookies), redes sociais (ícones circulares).

### Padrões de espaçamento e forma

- **Cantos arredondados generosos**: cards e botões usam `border-radius` visivelmente grande (pill-shaped nos botões, ~12-24px nos cards).
- **Fundo predominantemente preto**, com variações mínimas de tom entre seções (nunca branco/claro — o site não tem modo claro).
- Uso extensivo de **efeitos de glow/blur radial** em ciano para dar profundidade sem poluir visualmente.
- **Divisores discretos**: linhas finas em `rgba(255,255,255,0.1)` separam seções e itens de lista/tabela.
- Ícones em círculos com contorno sutil (outline), não preenchidos — estilo "line icon".

---

## 5. Componentes principais

### 5.1 Header / navegação
- Barra fixa, fundo escuro semi-transparente com `backdrop-filter: blur()`, flutuando com margem do topo.
- Logo (ícone ciano + wordmark "Polímatas" em branco) à esquerda.
- Menu horizontal centralizado: Sobre, Serviços, Como funciona, Casos, Quem somos, Comparações.
- Botão "Contato" à direita, sólido branco com texto preto (contraste proposital, destaca o CTA principal do menu).
- Item do menu ativo recebe fundo levemente destacado (pill escura).

### 5.2 Botões

| Variante | Fundo | Borda | Texto | Uso |
|---|---|---|---|---|
| Primário sólido | Ciano `#06B6D4`/gradiente | — | Preto/branco | CTA de contato principal |
| Outline escuro | Transparente/preto | Gradiente roxo/ciano na borda | Branco | CTA secundário no hero |
| Outline verde | Transparente | Verde | Branco | CTA alternativo no hero |
| Branco sólido (nav) | Branco | — | Preto | Botão "Contato" no header |
| Pill escuro (CTA seção) | `#0E7490`-ish escuro | — | Branco | "Agende uma chamada" |

Todos os botões: `border-radius` grande (pill), padding generoso (~12-16px vertical, 24-32px horizontal), ícone de seta `>` ao final em vários CTAs secundários ("Conheça mais →").

### 5.3 Cards
- Fundo escuro (`#141413` / `#1F2937`), levemente mais claro que o fundo da seção.
- Ícone circular no topo (outline, ciano ou branco).
- Título com uma palavra em destaque ciano.
- Texto descritivo em cinza claro.
- Rodapé do card com link "Conheça mais" + seta.
- Cantos arredondados (~16px), sem sombra pesada — profundidade dada por contraste de tom, não por drop-shadow.

### 5.4 Badges / eyebrow labels
- Pequenas pílulas com texto uppercase curto ("Sobre Nós", "MODELO POLÍMATAS"), fundo escuro translúcido com borda sutil, usadas para introduzir cada seção antes do título grande.

### 5.5 Tabela comparativa
- Cabeçalho com 3 "planos"/colunas: a solução da Polímatas (destacada com badge gradiente e borda luminosa) vs. duas alternativas genéricas.
- Linhas com ícones de check (✓, em círculo escuro contornado) ou "x" para ausência de recurso.
- Coluna destacada (Polímatas) tem os ícones em ciano vibrante; colunas concorrentes em cinza neutro.

---

## 6. Imagens e ilustrações

- Fotografias de pessoas (equipe, depoimentos de clientes) em estilo profissional/corporativo, com overlay escuro leve para integrar ao tema dark.
- Uma peça de arte conceitual (retrato estilo renascentista com elementos cyber/circuitos) reforçando a metáfora "polímata + IA".
- Logos de tecnologias parceiras em tom monocromático/dessaturado sobre fundo preto (Clinicorp, Asaas, WordPress, n8n, Python, Docker, PostgreSQL, Supabase, entre outras).
- Fundo decorativo com linhas finas onduladas tipo "rede neural"/fibra ótica, brancas com opacidade baixa sobre preto, usado no hero e na seção de serviços.
- Textura de pontos (dot grid) usada como fundo sutil na seção de casos.

---

## 7. Diretrizes de aplicação no sistema

Para que o sistema desenvolvido para a Polímatas "converse" visualmente com o site institucional, recomenda-se:

1. **Usar dark mode como padrão** (fundo preto/quase-preto `#000000`–`#0B0F19`), com texto branco/cinza claro.
2. **Aplicar o ciano (`#22D3EE`/`#06B6D4`) como cor de ação/destaque única** — usar com moderação, só em CTAs, links, ícones ativos, estados de foco e indicadores de status "positivo".
3. **Tipografia Inter, títulos com peso leve (300)** — evitar títulos em negrito pesado; usar tamanho grande + peso fino para transmitir sofisticação.
4. **Componentes com cantos bem arredondados** (cards, botões, inputs) e fundos em camadas de cinza muito escuro (nunca preto puro para cards, para criar profundidade sutil).
5. **Badges/eyebrows uppercase** para rotular seções ou status (ex. "Em andamento", "Novo").
6. **Botões em formato pill**, com opção de variante sólida ciano (ação primária) e variante outline (ação secundária).
7. **Ícones em estilo outline/linha fina**, dentro de círculos com contorno sutil — não usar ícones preenchidos "flat" pesados.
8. **Gradientes usados com parcimônia**, apenas em elementos de destaque máximo (ex. plano "recomendado", botão principal de conversão, badge de destaque) — não no restante da interface.
9. **Estados de sucesso/erro:** aproveitar o gradiente verde (`#4ADE80`→`#16A34A`) já usado no site para "positivo/check", e manter vermelho/laranja neutros e discretos para erro, evitando fugir do tom sóbrio da marca.
10. **Micro-interações:** hover sutil (leve brilho/realce em ciano), transições suaves — o site original usa animações discretas de entrada e scroll, não efeitos chamativos.

---

## 8. Referência rápida (cheat sheet)

```
Cor de fundo:        #000000 (principal) / #030712, #141413 (camadas)
Cor de texto:         #FFFFFF (títulos) / #D1D5DB (corpo) / #9CA3AF (legendas)
Cor de destaque:      #22D3EE (ciano-400) / #06B6D4 (ciano-500)
Gradiente CTA:        #60A5FA → #3B82F6 → #A855F7
Gradiente sucesso:    #4ADE80 → #10B981 → #16A34A
Fonte:                Inter, system-ui, sans-serif
Peso de títulos:      300 (leve)
Border-radius:        Grande / pill nos botões, ~16px nos cards
Estilo de ícones:     Outline, dentro de círculo contornado
Tom de voz:           Direto, técnico, orientado a ação e resultado
```

---

*Documento gerado a partir da análise do site oficial da Polímatas (polimatas.tec.br) em 04/09/2026, para uso como referência de identidade visual no desenvolvimento do sistema interno da empresa.*
