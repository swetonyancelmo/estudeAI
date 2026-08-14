# Requirements Specification (PRD) - Web Dev Roadmap AI

## 1. Visão Geral do Produto
O **Web Dev Roadmap AI** é uma plataforma educacional guiada por Inteligência Artificial que diagnostica o perfil, disponibilidade e preferências de estudantes de programação para gerar e gerenciar roadmaps de estudo personalizados para o desenvolvimento Web.

---

## 2. Personas & Objetivos
- **Estudante Iniciante:** Deseja ingressar na área Web sem se sentir sobrecarregado com excesso de conteúdos. Busca um plano de ação personalizado e direto ao ponto.
- **Estudante em Evolução:** Já possui um roadmap ativo, acompanha seu progresso marcando tarefas e ajusta o ritmo de estudo conforme sua rotina semanal muda.

---

## 3. Requisitos Funcionais (FR)

### FR-01: Diagnóstico Dinâmico (Wizard)
- **FR-01.1:** O formulário deve apresentar o formato Wizard (uma pergunta por tela/step).
- **FR-01.2:** As perguntas devem coletar: Objetivo (ex: mercado, startup), Tempo semanal disponível (ex: 5h, 15h, 30h+), Preferências de afinidade (ex: visual/interface vs. lógica/dados) e Estilo de aprendizado.
- **FR-01.3:** O usuário pode navegar entre os passos anteriores para ajustar respostas antes do envio.

### FR-02: Recomendação e Gerenciamento do Roadmap
- **FR-02.1:** A IA (Gemini API) analisa os dados do formulário e retorna uma sugestão de área (Frontend, Backend ou Fullstack) acompanhada de um roadmap detalhado em módulos e tópicos.
- **FR-02.2:** O sistema deve consultar primeiro um repositório de roadmaps pré-gerados/em cache para otimizar chamadas; caso não atenda aos critérios exatos, realiza a chamada à API do Gemini.
- **FR-02.3:** O usuário tem a opção de rejeitar a sugestão gerada e refazer o formulário a qualquer momento.

### FR-03: Autenticação e Persistência
- **FR-03.1:** O usuário deve conseguir criar uma conta e autenticar-se (E-mail/Senha ou Provider Social).
- **FR-03.2:** O roadmap gerado fica vinculado à conta do usuário autenticado.
- **FR-03.3:** O usuário pode marcar/desmarcar tópicos do roadmap como concluídos (progresso em porcentagem).

### FR-04: Reajuste Dinâmico de Ritmo
- **FR-04.1:** O usuário pode solicitar o reajuste do roadmap ativo (ex: "Tenho menos tempo esta semana", "Quero acelerar o módulo atual").
- **FR-04.2:** A IA recalcula o cronograma do roadmap mantendo o progresso já efetuado pelo usuário.

---

## 4. Requisitos Não Funcionais (NFR)

- **NFR-01 (Performance):** Respostas da IA devem ser estruturadas em JSON rigoroso para renderização imediata do frontend sem necessidade de parsing manual complexo.
- **NFR-02 (Escalabilidade):** Estrutura de Monorepo com desacoplamento total entre Next.js e NestJS.
- **NFR-03 (Experiência de Uso):** Interface responsiva, moderna e intuitiva com transições suaves entre os passos do formulário.
