# Redesign do estudeAI — crítica e plano

> Objetivo: tirar a "cara de template gerado por IA", dar personalidade própria ao produto e deixá-lo mais chamativo, sem perder a clareza que já existe.
>
> Escopo analisado: `apps/web` — landing (`app/page.tsx`), auth, dashboard, wizard, detalhe do roadmap, componentes `ui/`, `brand/`, `roadmap/`, `wizard/` e `globals.css`.

---

## 1. Diagnóstico geral

### Primeira impressão (2 segundos)
A landing é limpa e bem organizada, mas parece **qualquer SaaS feito com shadcn + v0**: fundo cinza-frio com malha de pontos, eyebrow monoespaçada em caixa alta, título grande alinhado à esquerda, grid de 4 passos numerados `01 02 03 04`, 3 cards iguais com ícone num quadradinho, faixa escura de CTA no final. Cada padrão isolado é correto; juntos, formam o "kit" que todo mundo já reconhece como gerado.

### O que já funciona (manter)
- **A metáfora da rota** (`components/brand/roadmap-route.tsx`) é a melhor ideia visual do projeto: é própria, tem significado e conecta landing e produto. Ela deve virar o centro do redesign.
- **Bricolage Grotesque nos títulos** tem personalidade. Fica.
- **Acento único laranja** e a disciplina de tokens em `globals.css` (comentários, dark mode cuidado).
- Microdetalhes bons: `text-wrap: balance`, rótulos do SVG escondidos em telas pequenas, update otimista no checkbox, estados de erro tratados.

### O maior problema
**A identidade some dentro do produto.** A landing promete uma "rota"; o wizard, o dashboard e o detalhe do roadmap viram listas de cards cinza com checkbox, iguais a qualquer to-do app. É exatamente onde o usuário passa mais tempo, e é onde o design é mais genérico.

---

## 2. Os "sinais de IA" encontrados

| # | Sinal | Onde | Por que denuncia | Troca por |
|---|---|---|---|---|
| 1 | Ícone `Sparkles` ✨ | landing (card "A IA monta…"), botão "Gerar roadmap", painel de reajuste | É o clichê visual nº 1 de produto com IA | Ícone próprio da marca (pino de rota / bússola / nó de bifurcação) desenhado no mesmo traço do SVG da rota |
| 2 | Malha de pontos `.dot-grid` no hero | `globals.css`, `app/page.tsx` | Fundo padrão de templates Vercel/v0 | Textura própria: linhas de rota/topográficas bem sutis, ou fundo liso com cor quente |
| 3 | Eyebrow mono caixa alta acima de **todo** título | landing, dashboard, detalhe | Repetido em toda seção, vira tique | Usar só em 1–2 lugares (ex.: dados/labels), não como prefixo de seção |
| 4 | Grid `gap-px` com `01 02 03 04` | "Como funciona" | Layout de bento/feature grid de template | Mostrar o wizard de verdade: uma linha de rota horizontal com as 4 paradas e a pergunta real de cada uma |
| 5 | 3 cards idênticos (ícone em caixa + título + parágrafo) | "Trilhas" | O padrão mais reconhecível de landing gerada | Cada trilha com cor, mini-mapa e exemplos reais de tópicos (ver §4.2) |
| 6 | Faixa escura invertida no final com CTA | landing | Fechamento de template | CTA que continua a rota: a linha do hero termina no botão |
| 7 | Títulos em pares de frases curtas | "Quatro perguntas. Um roadmap sob medida." / "Três caminhos. Um escolhido pra você." | Ritmo de copy de LLM | Frases com voz própria e informação concreta |
| 8 | Travessão (—) em quase todo parágrafo | landing inteira, dashboard | Marca registrada de texto gerado | Vírgula, ponto ou dois-pontos |
| 9 | "A IA" como protagonista em toda frase | landing, dashboard, wizard | O produto vira "wrapper de IA"; o usuário quer o roadmap, não a IA | Falar do resultado ("seu roadmap", "seu próximo tópico"), citar IA uma vez |
| 10 | Componentes shadcn sem customização | `Card` com `ring-1`, `Badge` pílula `rounded-4xl`, `Button` h-8 | Visual "padrão de fábrica" | Componentes com a linguagem da marca (§5) |
| 11 | Cinza-frio `#F6F7F8` + branco | `:root` | Paleta neutra de SaaS genérico | Neutros quentes (§3.1) |
| 12 | Skeleton cinza pulsante para a geração | `roadmap-result-skeleton.tsx` | Espera longa (Gemini) tratada como loading comum | Animação da rota sendo traçada com etapas narradas (§4.4) |

### Inconsistência de conteúdo (corrigir junto)
A landing promete opções que o wizard não tem:
- "Objetivo: carreira, projeto próprio, **freelas ou curiosidade**" → o wizard só tem *Entrar no mercado* e *Construir meu produto*.
- "Afinidade: interface, lógica de sistemas, **ou os dois**" → o wizard só tem duas opções.
- "Estilo: visual, teórico ou prático" → o wizard usa *Mão na massa / Teórico / Audiovisual*.

Usar `lib/wizard/steps.ts` como fonte única e gerar o texto da landing a partir dele.

---

## 3. Nova direção visual

### Conceito: **"mapa de linhas"**
O roadmap como um mapa de transporte: trilhas são **linhas** coloridas, módulos são **estações**, tópicos são paradas. Isso já está embrionário no SVG da rota; o redesign leva a ideia para todas as telas. É reconhecível, é próprio do produto e torna o progresso visível de um jeito que barra de porcentagem não faz.

### 3.1 Paleta

Sair do cinza-frio para neutros quentes (papel) e dar uma cor por trilha. O laranja continua sendo a cor da marca e da ação principal.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--background` (papel) | `#FAF7F2` | `#121110` | fundo |
| `--card` | `#FFFFFF` | `#1B1917` | superfícies |
| `--foreground` (tinta) | `#1A1714` | `#F4F0EA` | texto |
| `--muted-foreground` | `#5C5650` | `#A8A097` | texto secundário |
| `--ink-faint` | `#7A736B` | `#857D74` | metadados (ver contraste §6) |
| `--border` | `#E8E2D9` | `#2C2825` | linhas |
| `--brand` (laranja) | `#E2481F` | `#FF6B3E` | ação principal, trecho percorrido |
| `--line-front` | `#E2481F` | `#FF6B3E` | trilha Frontend (= marca) |
| `--line-back` | `#2F6FEB` | `#5B8CFF` | trilha Backend |
| `--line-full` | `#7A3FD1` | `#A47BFF` | trilha Fullstack |
| `--line-ops` | `#0F8F8C` | `#3CCFC8` | trilha DevOps (azul-petróleo, para não confundir com o verde de concluído) |
| `--success` | `#1F9D64` | `#34C77E` | concluído |

Regra: **a cor da trilha aparece na linha da rota, no marcador do card e no header do detalhe**. Fundo e texto continuam neutros. Isso dá cor ao produto sem virar arco-íris.

### 3.2 Tipografia

Hoje há tamanhos soltos como `11.5px`, `12.5px`, `13.5px`, `14.5px`, `15.5px`, `16.5px`, `17px`, `26px`. Trocar por uma escala fixa e mais contrastante:

| Token | Tamanho / altura | Fonte | Uso |
|---|---|---|---|
| `display` | `clamp(3rem, 8vw, 5.5rem)` / 0.95 | Bricolage 800, tracking -0.035em | hero |
| `h1` | 40 / 1.05 | Bricolage 800 | título de página |
| `h2` | 28 / 1.1 | Bricolage 700 | seção |
| `h3` | 20 / 1.2 | Bricolage 700 | card / módulo |
| `body-lg` | 18 / 1.55 | Plex Sans 400 | lead |
| `body` | 15 / 1.55 | Plex Sans 400 | padrão |
| `small` | 13 / 1.45 | Plex Sans 500 | apoio |
| `mono` | 12 / 1.4 | Plex Mono 500 | dados: horas, %, datas |

- Wizard e detalhe hoje usam `font-medium` em títulos (padrão shadcn) e destoam da landing (`extrabold`). Unificar em 700/800.
- Usar números grandes em Bricolage como elemento gráfico (progresso "42%", passo "2/4").

### 3.3 Forma e superfície
- Raio: padronizar em **dois** valores: `12px` (cards, inputs) e `999px` (só marcadores de estação e chips). Hoje há `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[9px]`, `rounded-[5px]`, `rounded-[4px]`.
- Cards: borda de 1px na cor `--border` + sombra "dura" de 1 camada só no hover (`0 2px 0 var(--border)`), em vez do `ring-1 ring-foreground/10` genérico.
- Botão primário: altura mínima 44px, sombra inferior sólida (`0 3px 0` em laranja mais escuro) que "afunda" no `:active`. Dá um toque tátil e de marca.

### 3.4 Movimento
- **Traçado da rota animado** (`stroke-dasharray` + `stroke-dashoffset`) no hero, no carregamento e ao concluir tópicos.
- Concluir o último tópico de um módulo: a linha avança até a estação seguinte e a estação "acende" (scale 1 → 1.25 → 1, 300ms).
- Respeitar `prefers-reduced-motion` em tudo.

### 3.5 Iconografia
- Remover `Sparkles` e `Wand2`.
- Criar 4–5 ícones próprios no traço da rota (2px, pontas arredondadas): *estação*, *bifurcação*, *destino*, *reajustar rota* (seta que desvia), *recurso*. Os ícones de trilha que já existem na landing são um bom começo.

---

## 4. Tela por tela

### 4.1 Landing (`app/page.tsx`)

**Hero**
- Layout em duas colunas no desktop: texto à esquerda, à direita uma **prévia real de roadmap** (card com a linha colorida, 3 estações, 2 tópicos marcados, "~6h"). Hoje o lado direito fica vazio e o SVG fica dentro de uma caixa com borda, o que o diminui.
- A rota sai do card de prévia e atravessa a página até as seções seguintes (a linha conduz a leitura).
- Título com tamanho `display`. Sugestões de copy sem o tom de IA:
  - "Saiba exatamente o que estudar amanhã."
  - "Seu caminho em programação, estação por estação."
- Subtítulo concreto: "Quatro perguntas sobre seu tempo e seu objetivo. Você recebe uma trilha em módulos, com horas estimadas e links para estudar cada tópico."
- CTA: "Montar meu roadmap" + texto de apoio "grátis · 2 minutos" logo abaixo (hoje só aparece no fim).

**Como funciona** → substituir o grid `01–04` por uma linha horizontal com 4 estações. Em cada estação, a pergunta real e as opções em chips (vindas de `WIZARD_STEPS`). No celular, a linha fica vertical.

**Exemplo de resultado (seção nova)** → mostrar um módulo real de roadmap com tópicos, horas e recursos (YouTube, docs). É o que mais convence e hoje não existe: a landing só descreve.

**Trilhas** → em vez de 3 cards iguais, 3 linhas paralelas coloridas (laranja/azul/roxo) com nome, descrição curta e 4–5 tópicos de exemplo como estações. Visual de mapa, não de feature grid.

**CTA final** → a linha da rota termina num destino pontilhado com o botão. Remover a faixa escura invertida.

**Rodapé** → incluir algo de autoria (ex.: "feito por …", link do GitHub). Ajuda a tirar a cara de produto genérico.

### 4.2 Auth (`app/(auth)/*`, `auth-form.tsx`)
- Layout dividido: à esquerda o formulário; à direita (desktop) um painel com a rota animada e uma frase curta ("Sua rota fica salva aqui.").
- Tirar o `Card` padrão em volta do formulário; título em `h1` Bricolage 800.
- Inputs com altura 44px e foco em laranja com halo suave.

### 4.3 Wizard (`app/(protected)/wizard`, `components/wizard/*`)
- **Tela cheia, uma pergunta grande**: título em `h1` (40px), passo como número grande "2/4" em Bricolage.
- Progresso como **mini rota de 4 estações** no topo, em vez da barra fina + "50%".
- Opções como cards grandes com ícone/ilustração própria por opção, atalhos de teclado (`1`, `2`, `3`) e **avanço automático** ao selecionar (com 250ms de feedback visual). O botão "Avançar" fica redundante; manter só "Voltar".
- Na última pergunta, o botão "Gerar roadmap" usa o ícone de bifurcação, não `Sparkles`.

### 4.4 Geração (`roadmap-result-skeleton.tsx`)
A espera do Gemini leva segundos; tratar como momento de produto, não como loading:
- A rota é desenhada aos poucos na tela.
- Mensagens em sequência, ligadas às respostas do usuário: "Lendo seu objetivo: entrar no mercado…", "Calculando carga para ~15h por semana…", "Escolhendo recursos em vídeo…".
- Ao terminar, a rota "pousa" no topo do detalhe (transição para `/roadmaps/:id`).

### 4.5 Dashboard (`app/(protected)/dashboard`, `roadmap-card.tsx`)
- Cada card ganha uma **mini linha de metrô** com as estações (módulos), colorida pela trilha e preenchida até onde o usuário chegou. Substitui a barra de progresso genérica.
- Mostrar "próximo tópico: *Flexbox*" no card, para ser acionável.
- Número do progresso grande (Bricolage) em vez de `%` pequeno em mono.
- Remover a eyebrow "Seus estudos"; título "Meus roadmaps" em `h1`.
- Botão "Novo roadmap" como primário quando não houver roadmap ativo.

### 4.6 Detalhe do roadmap (`roadmap-detail.tsx`, `topic-checkbox.tsx`)
A tela mais importante e hoje a mais genérica.
- **Header**: faixa com a cor da trilha, nome da trilha em `h1`, progresso grande, horas restantes estimadas.
- **Módulos como estações numa linha vertical** à esquerda (timeline): trecho concluído preenchido na cor da trilha, trecho pendente tracejado. Os tópicos ficam à direita de cada estação. Substitui a pilha de `Card`s iguais.
- **Módulo atual** destacado (expandido); módulos concluídos colapsados com um "✓ 6/6"; futuros em opacidade menor.
- Checkbox de tópico maior (24px, área de toque 44px) em formato de "parada" redonda, que acende na cor da trilha (hoje é verde genérico).
- Justificativa da IA em um bloco de citação discreto ("Por que essa trilha"), colapsável, em vez de parágrafo solto no topo.
- **Reajuste**: botão "Reajustar rota" com o ícone de desvio. Após o reajuste, tópicos novos/ajustados ganham um marcador lateral na cor da marca (em vez de `Badge` outline pequeno), e o resumo aparece como um aviso no topo da timeline.
- Excluir roadmap continua no fim da página (decisão correta).

### 4.7 Navegação autenticada (`app-nav.tsx`)
- Remover o e-mail em mono do topo (ruído). Trocar por avatar com inicial + menu (perfil, tema, sair).
- Link "Meus roadmaps" visível na barra.

---

## 5. Componentes base a ajustar

| Componente | Hoje | Proposta |
|---|---|---|
| `Button` | shadcn padrão, `h-8`, `hover:bg-primary/80` | `h-11` padrão, raio 12px, sombra sólida inferior, `:active` afunda 2px; variante `ghost` mantém |
| `Card` | `ring-1 ring-foreground/10`, `rounded-xl` | borda 1px `--border`, raio 12px, sombra dura no hover |
| `Badge` | pílula `rounded-4xl` `h-5` | chip com bolinha colorida da trilha + texto, raio 6px |
| `ProgressBar` | barra 6px laranja | componente `RouteProgress` (linha com estações); manter barra só onde não houver espaço |
| `Input`/`Textarea` | padrão | 44px, fundo `--card`, foco com halo laranja 3px |
| Novo `RouteLine` | — | SVG reutilizável (horizontal/vertical, n estações, % percorrido, cor da trilha, animação) que alimenta hero, wizard, cards e detalhe |

---

## 6. Acessibilidade (corrigir no redesign)

| Item | Situação atual | Correção |
|---|---|---|
| `--ink-faint` `#8A8F99` sobre branco | ≈ 3.3:1, **reprova** AA para texto pequeno (usado em 11–12.5px: datas, horas, legendas) | escurecer para ~`#6B655E` no claro (≥ 4.5:1) |
| Texto branco sobre laranja `#F0562E` | ≈ 3.5:1, **reprova** AA para 15px semibold | laranja do botão ~`#C93D17` (≈ 5:1) ou texto tinta escura sobre laranja |
| Botões `h-8` (32px), checkbox 18px, `ThemeToggle` | abaixo de 44px no celular | mínimo 44×44 de área clicável |
| Rótulos do SVG `text-[10.5px]`/`[11px]` | pequenos | ≥ 12px ou esconder |
| Animações novas | — | respeitar `prefers-reduced-motion` |
| Progresso do wizard | `aria-valuenow` sem rótulo | adicionar `aria-label="Progresso do diagnóstico"` |

---

## 7. Copy: diretrizes

- Evitar travessões; usar vírgula, ponto ou dois-pontos.
- Evitar pares de frases curtas espelhadas ("X. Um Y.").
- Citar a IA no máximo uma vez por tela. O protagonista é o roadmap do usuário.
- Preferir números concretos: "~6h", "4 módulos", "23 tópicos".
- Tom: direto, de colega mais experiente. Ex.: "Comece por aqui", "Próxima parada: APIs REST".

---

## 8. Ordem de implementação sugerida

1. **Fundação** — tokens novos em `globals.css` (paleta quente, cores de trilha, escala tipográfica, raios), contraste corrigido, `Button`/`Card`/`Badge`/`Input` ajustados. Tudo o resto herda.
2. **`RouteLine`** — componente SVG único e animável. É a peça que dá identidade a todas as telas.
3. **Detalhe do roadmap** — timeline de estações. Maior ganho percebido, é onde o usuário passa mais tempo.
4. **Dashboard** — cards com mini linha e "próximo tópico".
5. **Wizard + geração** — tela cheia, auto-avanço, rota sendo traçada no carregamento.
6. **Landing** — hero com prévia real, seção de exemplo, trilhas como linhas, copy reescrita e alinhada com `steps.ts`.
7. **Auth + nav** — layout dividido, avatar/menu.
8. **Polimento** — ícones próprios, microinterações, revisão de `prefers-reduced-motion` e dark mode.

### Critérios de pronto
- Nenhum `Sparkles`/`Wand2` no código.
- Nenhum tamanho de fonte fora da escala (buscar `text-\[\d+(\.\d+)?px\]`).
- Contraste AA em todos os textos (checar com Lighthouse/axe nos dois temas).
- A rota aparece em todas as telas principais: landing, wizard, dashboard, detalhe.
- Texto da landing gerado a partir de `lib/wizard/steps.ts`.

---

## 9. Status da implementação (16/11/2026)

Implementado em `apps/web` conforme as seções 3 a 7. Diferenças em relação ao plano:

- **Botão primário**: em vez de escurecer o laranja, o texto do botão passou a ser tinta escura sobre o laranja vivo (5.2:1). Laranja como texto pequeno usa o token `brand-ink`.
- **Card do dashboard sem "próximo tópico"** e com 5 estações fixas: `GET /roadmap` (`RoadmapListItemDto`) não devolve módulos nem tópicos. Exige mudança na API e em `shared-types`.
- **Opções do wizard** usam a tecla de atalho (1, 2, 3) como elemento visual, sem ilustração por opção.
- **Transição da tela de geração para o detalhe** ("a rota pousa no topo") não foi feita; a navegação é direta.
- **Escala tipográfica**: os degraus `text-xs` a `text-3xl` do Tailwind foram sobrescritos em `globals.css`, então qualquer `text-*` já cai na escala. Campos de formulário usam `text-field` (16px, evita zoom no iOS).
- **Raios**: 12px para superfícies e controles, 8px/6px para elementos internos (miniaturas, chips), pílula para estações.
