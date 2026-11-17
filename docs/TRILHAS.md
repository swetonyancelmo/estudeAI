# Trilhas curadas — especificação

Status: **aprovada em 16/11/2026**. Os três PRs estão implementados: catálogo de trilhas, wizard novo com geração por trilha, e projetos com duração estimada.

Decisões da seção 11, já tomadas: justificativa pela opção A; tópicos de habilidades dominadas entram concluídos; roadmaps antigos ficam como estão.

## 1. O que muda

Hoje o roadmap é gerado pelo Gemini e guardado em cache por combinação das 4 respostas do wizard (`roadmap_templates`). O conteúdo não é revisado por ninguém e o modelo não suporta mais perguntas.

Com esta mudança:

- O conteúdo vem de **4 trilhas curadas** (frontend, backend, fullstack, devops), guardadas no banco.
- O wizard ganha perguntas e passa a **escolher a trilha** e **recortar** o conteúdo dela para a pessoa.
- A geração deixa de depender do Gemini para o conteúdo: fica instantânea e não falha por erro de IA.
- O roadmap do usuário continua sendo uma cópia própria (Etapa 6). Progresso, reajuste (Etapa 7) e exclusão não mudam.

## 2. Conteúdo das trilhas

Os 4 JSONs em `trilhas-estudeai/` foram validados (slugs únicos, pré-requisitos existentes e anteriores, nenhum obrigatório dependendo de opcional, campos e valores dentro do combinado) sem erros.

| Trilha | Módulos | Tópicos | Obrigatórios | Horas (tópicos) | Horas (só obrigatórios) | Horas (projetos) |
|---|---|---|---|---|---|---|
| frontend | 9 | 52 | 37 (71%) | 256 | 193 | 73 |
| backend | 9 | 53 | 38 (71%) | 254 | 188 | 70 |
| fullstack | 9 | 53 | 39 (73%) | 279 | 221 | 78 |
| devops | 9 | 52 | 35 (67%) | 255 | 175 | 72 |

Os arquivos passam a morar em `apps/api/src/tracks/content/*.json` e são a fonte de verdade: mudar uma trilha é editar o JSON em um PR.

## 3. Wizard novo

De 4 para até 6 perguntas. Duas são condicionais, então ninguém responde o que não faz sentido para o seu caso.

| # | Campo | Pergunta | Opções | Quando aparece |
|---|---|---|---|---|
| 1 | `goal` | Qual é o seu objetivo? | mercado, startup | sempre (já existe) |
| 2 | `area` | Já sabe qual área quer seguir? | frontend, backend, fullstack, devops, "ainda não sei" | sempre (nova) |
| 3 | `affinity` | Com o que você mais se identifica? | visual, lógica, **infraestrutura** (nova opção) | só se `area` = "ainda não sei" |
| 4 | `knownSkills` | O que você já sabe? (múltipla escolha) | as 12 habilidades + "estou começando do zero" | sempre (nova) |
| 5 | `weeklyTime` | Quanto tempo você tem por semana? | 5h, 15h, 30h+ | sempre (já existe) |
| 6 | `learningStyle` | Como você aprende melhor? | prático, teórico, audiovisual | sempre (já existe) |

As 12 habilidades são as mesmas do campo `knownSkill` das trilhas: lógica de programação, HTML/CSS, JavaScript, TypeScript, Git, terminal Linux, SQL, HTTP/APIs, React, Node.js, Docker, nuvem.

Ficaram de fora desta versão, de propósito:

- **Nível (iniciante/intermediário/avançado):** a pergunta de habilidades já responde isso com mais precisão.
- **Prazo:** em vez de perguntar, o roadmap mostra a duração estimada no ritmo da pessoa (seção 5).
- **Texto livre e inglês:** não mudam o recorte da trilha hoje. O reajuste por texto livre já existe.

## 4. Escolha da trilha

Sem IA, por regra fixa:

1. Se a pessoa escolheu uma área, é essa.
2. Se respondeu "ainda não sei":

| Afinidade | Objetivo mercado | Objetivo startup |
|---|---|---|
| visual | frontend | fullstack |
| lógica | backend | fullstack |
| infraestrutura | devops | devops |

`TargetArea` ganha o valor `devops`.

## 5. Recorte da trilha para a pessoa

Aplicado nesta ordem, sem IA:

1. **Tempo semanal decide a profundidade.**
   - 5h: só tópicos obrigatórios.
   - 15h: obrigatórios + opcionais de nível iniciante e intermediário.
   - 30h+: trilha completa.
   - Um opcional só entra se todos os pré-requisitos dele entraram.
2. **Habilidades já dominadas.** Tópico cujo `knownSkill` a pessoa marcou entra no roadmap **já concluído**. Ele não some: a pessoa vê o que foi considerado sabido e pode desmarcar para revisar.
3. **Projetos.** O projeto de cada módulo entra como último item do módulo, marcado como projeto. Entram em todos os ritmos.
4. **Estilo de aprendizado** ordena os recursos de cada tópico: audiovisual mostra vídeos primeiro, teórico mostra artigos primeiro, prático mantém a ordem e destaca os projetos.
5. **Duração estimada.** Horas pendentes ÷ horas semanais (5, 15 ou 30), exibida como "≈ N semanas no seu ritmo". Exemplo: frontend só com obrigatórios e projetos são 266h, cerca de 53 semanas a 5h/semana.

Módulo que ficar sem nenhum tópico após o recorte é omitido.

## 6. Justificativa

O texto "por que esta área" é hoje escrito pelo Gemini junto com o roadmap. Duas opções:

- **A (escolhida):** uma chamada curta ao Gemini só para a justificativa, com um texto montado por regra como reserva se a IA falhar ou demorar. Mantém o FR-02.1 ("a IA analisa os dados do formulário") e a geração nunca falha. O teto é `JUSTIFICATION_TIMEOUT_MS` (8 s por padrão), dividido igualmente entre os modelos de `GEMINI_MODELS`.
- **B:** só o texto por regra. Zero custo e zero dependência, mas a IA sai da geração.

## 7. Banco de dados

Tabelas novas:

- `tracks`: `slug` (único), `title`, `description`, `content_hash`.
- `track_modules`: `track_id`, `slug`, `title`, `description`, `order_index`, `project_title`, `project_description`, `project_hours`.
- `track_topics`: `module_id`, `slug` (único por trilha), `title`, `level`, `required`, `estimated_hours`, `known_skill` (nulo permitido), `prerequisites` (lista de slugs), `search_query`, `order_index`, `resources_fetched_at` (nulo = ainda não buscado).
- `track_topic_resources`: mesmo formato de `topic_resources`, ligado a `track_topics`.

Colunas novas nas tabelas do usuário:

- `roadmaps`: `track_slug` e `answers` (jsonb com as respostas do wizard, incluindo o tempo semanal). Aceitam nulo, para os roadmaps antigos.
- `roadmap_topics`: `track_topic_id` (nulo permitido, `ON DELETE SET NULL`; vira nulo também quando um reajuste muda o assunto do tópico). Também `kind` (`topic` ou `project`, padrão `topic`) e `description` (nulo permitido, usado pelos projetos).

Carga do conteúdo: no boot, a API compara o hash de cada JSON com `tracks.content_hash`. Se mudou, substitui a trilha em uma transação, preservando os recursos dos tópicos cujo `slug` e `search_query` não mudaram. Roadmaps de usuários não são afetados, porque são cópias.

`roadmap_templates` e a geração completa pelo Gemini deixam de ser usadas. Proposta: manter o código parado até a versão nova estar validada e remover em um PR próprio.

## 8. Recursos de estudo (links)

O `ResourceDiscoveryService` continua sendo quem busca e valida links, agora usando o `searchQuery` de cada tópico em vez do título.

A restrição é a cota do YouTube: cada busca custa 100 unidades e a cota padrão é 10.000 por dia, ou seja, cerca de 100 tópicos por dia. As 4 trilhas somam 210 tópicos, então **a primeira carga leva uns 3 dias**.

Por isso a busca sai do momento da geração e vira uma tarefa em segundo plano:

- Roda no boot e depois a cada hora; pega tópicos com `resources_fetched_at` nulo, para quando a cota acaba e retoma depois.
- Ao preencher um tópico da trilha, copia os links também para os tópicos de usuários que nasceram dele e ainda estão sem recursos (é para isso que serve `track_topic_id`).
- Enquanto um tópico não tem links, ele aparece sem a seção de recursos, como já acontece hoje quando a busca falha.

## 9. Contrato (shared-types)

- `WizardAnswers`: ganha `area` e `knownSkills`; `affinity` vira opcional (obrigatória quando `area` = "ainda não sei", validado na API).
- `TARGET_AREAS` ganha `devops`; `AFFINITIES` ganha `infra`.
- `PersistedTopicDto` ganha `kind` e `description`.
- `RoadmapDetailDto` ganha `weeklyHours` (nulo nos roadmaps antigos). A duração em semanas é calculada no web a partir dele e das horas pendentes, para acompanhar cada tópico marcado sem esperar o servidor.
- `POST /roadmap/generate` mantém rota e formato de resposta.

## 10. Entrega em 3 PRs

1. **Catálogo de trilhas (API).** Tabelas, carga dos JSONs, tarefa de recursos em segundo plano. Nenhuma mudança visível: já começa a gastar os 3 dias de cota enquanto o resto é feito. Só cria tabelas novas; as colunas novas de `roadmaps` e `roadmap_topics` (seção 7) e a cópia de links para tópicos de usuários (seção 8) entram no PR 2, junto com a geração que passa a usá-las.
2. **Wizard novo e geração por trilha (API + web).** Perguntas novas, escolha da trilha, recorte, justificativa, rótulo e cor de DevOps na interface.
3. **Projetos e duração (API + web).** Projetos como itens do roadmap e "≈ N semanas no seu ritmo". O projeto conta no progresso e nas horas, nunca nasce concluído e não tem recursos; no reajuste a IA é instruída a mantê-lo como último item do módulo.

Cada PR com testes unitários dos services novos; o recorte (seção 5) e a escolha da trilha (seção 4) são funções puras, testadas por tabela.

## 11. Decisões pendentes

1. Justificativa: opção A ou B (seção 6)?
2. Tópicos de habilidades já dominadas entram concluídos (proposto) ou somem do roadmap?
3. Roadmaps antigos ficam como estão (proposto) ou devem ser apagados?
