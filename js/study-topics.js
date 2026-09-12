/* ============================================================================
 *  PROJECT 90 — Banco de temas de "Reflexões" (filosofia, psicologia,
 *  meditação sobre a vida)
 *
 *  O tema de cada dia é escolhido de forma DETERMINÍSTICA pelo número do dia
 *  do desafio, igual ao "Pergunta do dia" do Diário:
 *      TOPICS[(dia - 1) % TOPICS.length]  — ver topicForDay() em reflexoes.html
 *
 *  Em vez de digitar 1000 frases à mão (impraticável de manter/revisar), a
 *  lista é gerada combinando 50 TEMAS × 20 PERSPECTIVAS = exatamente 1000
 *  combinações únicas, cada uma um convite de estudo/meditação razoável
 *  ("Liberdade na filosofia estoica", "Sentido da vida na neurociência"...).
 *
 *  IMPORTANTE: não reordene nem remova itens de TEMAS ou PERSPECTIVAS, e não
 *  mude a ordem dos laços abaixo — a posição de cada tema no array final
 *  (TOPICS) é o que fixa qual dia mostra qual tema. Só ACRESCENTE no fim de
 *  cada lista se quiser mais variedade; isso não afeta os dias já vistos.
 * ========================================================================== */
(function () {
  var TEMAS = [
    'Liberdade', 'Justiça', 'Felicidade', 'Sofrimento', 'Morte', 'Tempo', 'Identidade',
    'Consciência', 'Livre-arbítrio', 'Ética', 'Virtude', 'Verdade', 'Conhecimento', 'Dúvida',
    'Medo', 'Coragem', 'Amor', 'Solidão', 'Amizade', 'Poder', 'Trabalho', 'Dinheiro',
    'Sucesso', 'Fracasso', 'Propósito', 'Sentido da vida', 'Mudança', 'Impermanência',
    'Desejo', 'Apego', 'Ego', 'Autoconhecimento', 'Empatia', 'Compaixão', 'Perdão', 'Raiva',
    'Culpa', 'Vergonha', 'Gratidão', 'Humildade', 'Orgulho', 'Autoestima', 'Ansiedade',
    'Controle', 'Aceitação', 'O momento presente', 'Memória', 'Imaginação', 'Linguagem',
    'A natureza humana',
  ];

  var PERSPECTIVAS = [
    'na filosofia estoica', 'na filosofia existencialista', 'na ética kantiana',
    'no utilitarismo', 'na filosofia oriental (budismo e taoísmo)', 'na psicologia positiva',
    'na psicanálise', 'na terapia cognitivo-comportamental', 'na neurociência',
    'na mitologia grega', 'na literatura', 'no cotidiano', 'na infância',
    'nas relações interpessoais', 'no ambiente de trabalho', 'sob a perspectiva do tempo',
    'na velhice', 'em momentos de crise', 'na criação artística', 'na espiritualidade',
  ];

  var TOPICS = [];
  for (var t = 0; t < TEMAS.length; t++) {
    for (var p = 0; p < PERSPECTIVAS.length; p++) {
      TOPICS.push(TEMAS[t] + ' ' + PERSPECTIVAS[p]);
    }
  }

  window.P90_STUDY_TOPICS = TOPICS;
})();
