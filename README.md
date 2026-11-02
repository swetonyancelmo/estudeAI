# estudeAI

Plataforma que monta um **roadmap de estudos personalizado** de Frontend, Backend ou Fullstack. A pessoa responde a um diagnóstico rápido (objetivo, tempo por semana, afinidade e estilo de aprendizado), a API gera o roadmap com o Gemini, e depois ela acompanha o progresso e pode pedir um reajuste quando a rotina muda.

**NestJS · TypeORM · PostgreSQL · Gemini (`@google/genai`) · Next.js · TanStack Query · Zustand · pnpm workspaces**

## O que faz

- **Diagnóstico em etapas** (wizard) que define a área, o ritmo e o formato preferido de estudo
- **Roadmap gerado por IA** com módulos e tópicos, usando Structured Output (JSON Schema estrito), sem parsing manual no front
- **Cache de roadmaps:** se outra pessoa já respondeu com os mesmos critérios, o roadmap vem do banco e o Gemini nem é chamado
- **Progresso por usuário:** marcar tópicos como concluídos e voltar depois
- **Reajuste dinâmico:** a IA reorganiza só o que falta, sem apagar o que já foi concluído
- **Recursos por tópico:** vídeos e playlists reais (YouTube Data API), com os links validados antes de salvar

## Decisões técnicas

- **IA isolada em serviços próprios** (`RoadmapAiService`, `RoadmapAdjustService`): o controller nunca chama o Gemini diretamente, o que facilita trocar de provedor.
- **Cache por match exato dos critérios**, em vez de busca por similaridade. É simples, barato e resolve o caso comum.
- **Contrato compartilhado** em `packages/shared-types`: web e API usam os mesmos DTOs, então uma mudança de payload quebra a compilação dos dois lados.
- **A geração nunca falha por causa dos recursos:** a busca de vídeos tem orçamento de tempo, e o que faltar é completado no próximo acesso.
- **Segurança:** JWT de acesso curto com refresh, rate limiting, Helmet e proteção contra poluição de parâmetros.

Os requisitos estão em [`REQUIREMENTS.md`](REQUIREMENTS.md) e a arquitetura em [`ARCHITETURE.md`](ARCHITETURE.md).

## Estrutura

```
apps/
  api/        NestJS: auth, roadmap (IA, cache, reajuste, recursos), users
  web/        Next.js (App Router): login, wizard, dashboard, roadmap
packages/
  shared-types/   DTOs compartilhados entre web e api
```

## Como rodar

Pré-requisitos: Node 20+, pnpm e Docker.

```bash
pnpm install
docker compose up -d                       # PostgreSQL na porta 5432
cp apps/api/.env.example apps/api/.env     # preencha JWT_ACCESS_SECRET e GEMINI_API_KEY
pnpm dev                                   # API em :3001 e web em :3000
```

A `YOUTUBE_API_KEY` é opcional: sem ela o roadmap continua sendo gerado, só que sem os vídeos.

## Testes

```bash
pnpm --filter api test
```

Testes unitários dos serviços da API: geração e reajuste com IA, validação do reajuste, cache, progresso, descoberta de recursos e autenticação.

## Próximos passos

- Login social (Google ou GitHub)
- Testes E2E do fluxo do wizard no front
