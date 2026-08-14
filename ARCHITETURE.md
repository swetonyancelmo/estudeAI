# System Architecture Specification - Web Dev Roadmap AI

## 1. Estrutura do Monorepo
Utilização de gerenciador de pacotes com workspaces (pnpm ou npm).

/web-dev-roadmap-ai
├── apps/
│   ├── web/          # Frontend (Next.js - App Router)
│   └── api/          # Backend (NestJS)
├── packages/
│   └── shared-types/ # DTOs, Interfaces e Tipos compartilhados entre Web e API
├── REQUIREMENTS.md
├── ARCHITECTURE.md
└── PROMPTS.md

---

## 2. Stack Tecnológica

- **Frontend (`apps/web`):**
  - Next.js (React) - App Router
  - Tailwind CSS / Shadcn UI
  - State Management: React Query (TanStack Query) + Zustand (para estado do Wizard)

- **Backend (`apps/api`):**
  - NestJS
  - Banco de Dados: PostgreSQL
  - ORM: Prisma ou TypeORM
  - Autenticação: JWT / Passport
  - AI Engine: SDK oficial do Gemini (`@google/genai`)

---

## 3. Fluxo de Dados & Integração com Gemini AI

1. **Submissão do Formulário:**
   Next.js (Wizard) -> POST /api/v1/roadmap/generate -> NestJS

2. **Verificação de Cache/Pre-generated:**
   NestJS verifica no banco de dados se há um modelo pré-gerado compatível com as escolhas do usuário.

3. **Fallback / Chamada Gemini:**
   Se necessário, o NestJS invoca o serviço do Gemini injetando as System Instructions para exigir retorno estrito em Structured Outputs (JSON).

4. **Persistência & Resposta:**
   NestJS grava o roadmap no banco vinculado ao usuário e retorna a estrutura formatada para o Next.js.

---

## 4. Modelo de Dados Relacional (Draft Entidades)

- **User:** id, email, passwordHash, createdAt
- **Roadmap:** id, userId, targetArea, justification, status, createdAt
- **Module:** id, roadmapId, title, description, order
- **Topic:** id, moduleId, title, isCompleted, order
