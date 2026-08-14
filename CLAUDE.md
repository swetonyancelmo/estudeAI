# CLAUDE.md - Web Dev Roadmap AI

> Este arquivo é a fonte de contexto para qualquer agente (Claude Code) trabalhando neste repositório.
> Fontes de verdade para requisitos e arquitetura: `REQUIREMENTS.md` e `ARCHITECTURE.md`. Este arquivo resolve as ambiguidades que esses dois deixaram em aberto e define convenções de execução.

## 1. O que é o projeto

Plataforma que aplica um wizard de diagnóstico (objetivo, tempo semanal, afinidade, estilo de aprendizado) e usa a API do Gemini para gerar um roadmap de estudos personalizado (Frontend, Backend ou Fullstack), organizado em módulos e tópicos. Usuário autenticado acompanha progresso e pode pedir reajuste dinâmico do roadmap.

## 2. Escopo desta fase

Escopo **completo**, conforme `REQUIREMENTS.md` — todos os FRs (FR-01 a FR-04) fazem parte do plano, incluindo o reajuste dinâmico (FR-04). Ordem de implementação sugerida (respeitando dependências):

1. Monorepo + skeleton (`apps/web`, `apps/api`, `packages/shared-types`)
2. Auth (FR-03.1) — necessário porque roadmap é vinculado a usuário desde o início
3. Wizard (FR-01) end-to-end, sem IA ainda (mock de resposta)
4. Integração Gemini + Structured Output (FR-02.1)
5. Cache de roadmaps pré-gerados (FR-02.2)
6. Persistência do roadmap + progresso (FR-03.2, FR-03.3)
7. Reajuste dinâmico (FR-04)

Não pule etapas — cada uma deve ter testes básicos passando antes de avançar pra próxima (spec-driven: a spec de cada etapa vem do REQUIREMENTS.md, e o "done" dela é o comportamento descrito lá).

## 3. Decisões técnicas (resolvendo os "ou" do ARCHITECTURE.md)

| Decisão | Escolha | Motivo |
|---|---|---|
| ORM | **TypeORM** | Consistência com stack usado no e-SUS Analytics (contexto de trabalho do dev) |
| Gerenciador de workspace | pnpm | Mais rápido e eficiente em disco para monorepo |
| Estratégia de cache (FR-02.2) | **Match exato** dos critérios do wizard (targetArea + faixa de tempo semanal + preferência de afinidade + estilo de aprendizado) | Simplicidade: uma constraint composta/hash dos critérios na tabela de roadmaps pré-gerados, sem necessidade de embeddings/similaridade nessa fase |
| Auth | JWT + Passport (email/senha no MVP; social provider fica como extensão, não bloqueia o resto) | Reduz escopo da primeira entrega de auth sem violar FR-03.1 |

## 4. Stack

- **apps/web:** Next.js (App Router), Tailwind + Shadcn UI, TanStack Query (server state) + Zustand (estado do wizard)
- **apps/api:** NestJS, TypeORM, PostgreSQL, JWT/Passport, `@google/genai`
- **packages/shared-types:** DTOs/interfaces compartilhados (contrato entre web e api — sempre atualizar aqui antes de mudar payloads)

## 5. Modelo de dados (base — ver ARCHITECTURE.md seção 4)

Adições necessárias para as decisões acima:
- `RoadmapCriteria` (ou colunas indexadas em `Roadmap`): `targetArea`, `weeklyTimeRange`, `affinityPreference`, `learningStyle` — usados como chave de match exato do cache.
- `Roadmap.status`: enum sugerido `draft | active | archived`.
- Histórico de reajustes (FR-04.2) precisa manter o progresso: **nunca deletar Topics concluídos ao recalcular** — a IA deve receber o progresso atual como contexto e reorganizar apenas o que resta.

## 6. Integração com Gemini

- System Instructions devem forçar Structured Output (JSON Schema estrito) — sem parsing manual no frontend (NFR-01).
- Toda chamada ao Gemini passa por uma camada de serviço isolada em `apps/api` (ex: `RoadmapAiService`), nunca chamada direto do controller — facilita trocar de provider de IA depois.
- Fallback do cache (FR-02.2) acontece **antes** dessa camada: se houver match exato, não chama o Gemini.

## 7. Convenções de execução (vibecoding)

- Cada FR implementado = 1 branch/PR, sempre referenciando o número do FR no título do commit (ex: `feat(FR-01): wizard multi-step com Zustand`).
- Testes: unitários no NestJS (services) e ao menos smoke test no fluxo crítico do wizard no Next.js.
- Nunca commitar API key do Gemini — usar `.env` + `.env.example` documentado.
- Todo endpoint novo em `apps/api` precisa do DTO correspondente criado/atualizado em `packages/shared-types` no mesmo PR.

## 8. Em aberto (revisitar quando chegar na etapa)

- Provider social de auth (Google? GitHub?) — decidir na etapa 2.
- Deploy: seguir o mesmo padrão usado no BarberSync (Neon + Render + Vercel) ou definir outro? — decidir perto da etapa de deploy.
