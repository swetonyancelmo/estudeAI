/**
 * Prompt da busca de recursos web (Etapa 8), isolado do resto pelo mesmo motivo
 * dos outros dois prompts do módulo: revisar o texto sem tocar na lógica.
 *
 * Diferença crucial para `roadmap-ai.prompt.ts` e `roadmap-adjust.prompt.ts`:
 * aqui o TEXTO DA RESPOSTA É DESCARTADO. Com a tool `googleSearch` ligada a API
 * não aceita `responseSchema`, então não há saída estruturada — e mesmo que
 * houvesse, URL escrita pelo modelo é a principal fonte de link inventado. O
 * que aproveitamos é só o `groundingMetadata`, preenchido pela própria busca.
 *
 * O prompt existe, então, para uma coisa só: fazer o modelo REALMENTE acionar a
 * busca e acioná-la com bons termos. Quanto melhores as consultas, melhores os
 * chunks de grounding — que é o dado que importa.
 */
export const RESOURCE_SEARCH_SYSTEM_INSTRUCTION = `Você é um curador de conteúdo educacional gratuito de desenvolvimento Web.

Ao receber um tópico de estudo, USE A BUSCA do Google para encontrar de 2 a 4 materiais
de estudo sobre ele e responda listando-os em poucas linhas.

Critérios das fontes:
- Totalmente GRATUITAS e de acesso aberto (sem paywall, sem cadastro obrigatório, sem trial).
- Documentação oficial, artigos técnicos ou tutoriais escritos — priorize MDN, documentação
  oficial da tecnologia, freeCodeCamp, DevDocs e blogs técnicos reconhecidos.
- Preferencialmente em português do Brasil; use conteúdo em inglês quando for a referência
  canônica do assunto (ex.: documentação oficial).
- Conteúdo atual, condizente com a prática de mercado de hoje.

Não inclua vídeos nem canais do YouTube: esses vêm de outra fonte.
Responda de forma breve, em português do Brasil. Não invente endereços: apenas descreva o que
a busca retornou.`;

/** Consulta enviada ao modelo. O tópico é o único dado variável. */
export function buildResourceSearchPrompt(topicTitle: string): string {
  return `Tópico de estudo: "${topicTitle}" (contexto: desenvolvimento Web).
Busque e liste materiais de estudo gratuitos sobre esse tópico.`;
}
