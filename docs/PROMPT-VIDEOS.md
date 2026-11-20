# Videoaulas das trilhas: prompt e fluxo

As videoaulas gratuitas do YouTube de cada tópico são **curadas**: o Claude web sugere, o script `pnpm videos` confere cada link de verdade e só então grava no JSON da trilha (`apps/api/src/tracks/content/<trilha>.json`, campo `videos` de cada tópico).

## Fluxo, módulo por módulo

Faça um módulo por conversa. Uma trilha inteira tem uns 52 tópicos, e a qualidade da busca cai quando a lista é longa.

1. **Liste os tópicos do módulo** (na pasta `apps/api`):

   ```bash
   pnpm videos list frontend --module fundamentos-da-web
   ```

   Sem `--module` ele lista a trilha toda, e dá para ver os slugs dos módulos nos títulos `## … (módulo: <slug>)`. Com `--missing` mostra só os tópicos com menos de 2 vídeos, útil para completar depois.

2. **Abra uma conversa nova no Claude web** (com a busca na web ligada), cole o prompt abaixo e troque `{{LISTA}}` pela saída do passo 1.

3. **Salve a resposta** (só o JSON) num arquivo, por exemplo `aulas-fundamentos.json`. Pode estar dentro de uma cerca ```` ```json ````: o script limpa.

4. **Confira sem gravar:**

   ```bash
   pnpm videos import frontend aulas-fundamentos.json --dry-run
   ```

5. **Grave:**

   ```bash
   pnpm videos import frontend aulas-fundamentos.json
   ```

6. **Revise o diff** de `src/tracks/content/frontend.json` (só aparecem blocos `videos`) e commite.

Repita para os outros módulos e trilhas. Se o relatório disser "não verificados", foi falha de rede: rode o mesmo comando de novo.

## O que o script garante

| Situação | O que acontece |
|---|---|
| Vídeo existe e incorpora | Grava a URL canônica (`watch?v=<id>`), o **título real** do vídeo e o canal. O título que a IA escreveu é descartado. |
| Vídeo existe, mas o dono bloqueou a incorporação | Mantido, depois dos que tocam no site. A tela mostra "Assistir no YouTube". Exige que a IA tenha informado o título. |
| Removido, privado ou id inventado | Recusado. |
| Link que não é de vídeo (playlist, canal, outro site) | Recusado. |
| Falha de rede | Não decide nada: o link fica de fora e aparece como "não verificado". |
| Mais de 4 vídeos num tópico | Os 4 primeiros ficam. |

Por padrão, vídeos novos **somam** aos que o tópico já tem (sem repetir). Use `--replace` para trocar tudo. A meta é ter **2 ou mais vídeos por tópico**: se um sumir com o tempo, os outros seguram o tópico. No fim, o relatório diz quantos tópicos ainda estão abaixo disso.

## Prompt

Copie tudo abaixo e troque `{{LISTA}}`.

````text
Você é curador de conteúdo de uma plataforma brasileira de estudos de programação. Preciso de videoaulas GRATUITAS do YouTube, em português do Brasil, para cada tópico da lista abaixo.

USE A BUSCA NA WEB para achar vídeos que existem de verdade. Não responda de memória.

REGRAS
1. De 2 a 3 vídeos por tópico, em ordem de preferência (o melhor primeiro). Se só achar um vídeo bom, indique um. Nunca complete com vídeo duvidoso só para bater o número.
2. Idioma: português do Brasil. Só use inglês se o assunto não tiver nenhuma aula boa em português, e nesse caso diga isso no campo "obs".
3. Tem que ser AULA: um vídeo que ensina o assunto do tópico do começo ao fim. Nada de reação, notícia, podcast, live gigante sem cortes, short/reels, vídeo de venda de curso ou "top 10".
4. Prefira vídeos de um canal educacional conhecido, com didática clara, e que NÃO estejam desatualizados para a tecnologia (confira o ano e a versão quando o assunto mudar rápido, como React, Next.js, Docker e Kubernetes).
5. Duração: de 10 minutos a 2 horas. Aula longa de curso completo só vale se for o melhor para o tópico.
6. Varie os canais dentro do mesmo tópico, para a pessoa ter mais de uma explicação.
7. Cada URL deve ser de UM VÍDEO: https://www.youtube.com/watch?v=<id de 11 caracteres>. Nada de playlist, canal ou link encurtado de outro site.
8. NUNCA invente um link, um id ou um título. Só indique um vídeo que você abriu ou viu nos resultados da busca. Na dúvida, indique menos vídeos ou nenhum. Um tópico sem vídeo é aceitável; um link falso não é.
9. Use exatamente os slugs da lista como chaves. Não crie, renomeie nem omita tópicos (se não achou nada, use uma lista vazia).

FORMATO DA RESPOSTA
Responda SOMENTE com um JSON válido, sem texto antes nem depois, neste formato:

{
  "<slug-do-topico>": [
    { "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "title": "título do vídeo como aparece no YouTube", "obs": "opcional: canal, ano ou aviso" }
  ]
}

TÓPICOS (formato: slug | título | nível | termo de busca sugerido)
{{LISTA}}
````

Se a resposta vier com texto fora do JSON, peça: "Devolva só o JSON, sem comentários." O campo `obs` é ignorado pelo script (serve só para você ler).

## Depois de importar

O campo `videos` do JSON chega à tela sozinho, no mesmo caminho da documentação oficial (`docs`):

- **Boot da API:** o sync detecta que o JSON mudou (hash), grava `track_topics.videos` e copia os vídeos para os tópicos dos roadmaps que já existem (`topic_resources`, type `video`, source `youtube`, com miniatura). Só acrescenta e reordena: vídeo tirado do JSON continua com quem já tinha.
- **Roadmaps novos:** a geração coloca as docs primeiro, depois as videoaulas curadas e depois o que a fila do YouTube achar, sem repetir URL.
- **Fila da YouTube API (opcional):** continua existindo. Os vídeos curados não contam como "já tem recursos", então ela ainda pode completar tópicos se houver `YOUTUBE_API_KEY`. Se achar o mesmo vídeo, vale o do JSON.
- **Player:** vídeo com incorporação bloqueada cai no botão "Assistir no YouTube", como antes.
