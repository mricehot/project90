/* ============================================================================
 *  PROJECT 90 — Banco de temas de "Reflexões" (filosofia, psicologia,
 *  meditação sobre a vida)
 *
 *  O tema de cada dia é escolhido de forma DETERMINÍSTICA pelo número do dia
 *  do desafio, igual ao "Pergunta do dia" do Diário:
 *      TOPICS[(dia - 1) % TOPICS.length]  — ver topicForDay() em reflexoes.html
 *
 *  Em vez de digitar 1000 frases à mão (impraticável de manter/revisar), a
 *  lista é gerada combinando 50 TEMAS × 20 MOLDES = exatamente 1000
 *  combinações únicas.
 *
 *  Ao contrário da primeira versão (TEMAS × "na filosofia X"), os MOLDES
 *  aqui NÃO são escolas de pensamento — são 20 formas de pergunta/frase
 *  genuinamente diferentes (prática, geracional, social, temporal...). Isso
 *  evita o efeito "mesmo tema, só troca o estilo de filosofia": dois temas
 *  vizinhos na lista nunca soam como a mesma pergunta reformulada.
 *
 *  IMPORTANTE: não reordene nem remova itens de TEMAS ou MOLDES, e não mude
 *  a ordem dos laços abaixo — a posição de cada combinação no array final
 *  (TOPICS) é o que fixa qual dia mostra qual tema; embaralhar quebra os
 *  dias já respondidos (cache.studyReflections guarda topicIdx). Só
 *  ACRESCENTE no fim de cada lista se quiser mais variedade.
 * ========================================================================== */
(function () {
  // { cap: forma no início de frase (maiúscula, sem artigo), art: artigo,
  //   low: forma minúscula sem artigo, pra encaixar nos moldes abaixo }
  var TEMAS = [
    { cap: 'Liberdade',          art: 'a', low: 'liberdade' },
    { cap: 'Justiça',            art: 'a', low: 'justiça' },
    { cap: 'Felicidade',         art: 'a', low: 'felicidade' },
    { cap: 'Sofrimento',         art: 'o', low: 'sofrimento' },
    { cap: 'Morte',              art: 'a', low: 'morte' },
    { cap: 'Tempo',              art: 'o', low: 'tempo' },
    { cap: 'Identidade',         art: 'a', low: 'identidade' },
    { cap: 'Consciência',        art: 'a', low: 'consciência' },
    { cap: 'Livre-arbítrio',     art: 'o', low: 'livre-arbítrio' },
    { cap: 'Ética',              art: 'a', low: 'ética' },
    { cap: 'Virtude',            art: 'a', low: 'virtude' },
    { cap: 'Verdade',            art: 'a', low: 'verdade' },
    { cap: 'Conhecimento',       art: 'o', low: 'conhecimento' },
    { cap: 'Dúvida',             art: 'a', low: 'dúvida' },
    { cap: 'Medo',               art: 'o', low: 'medo' },
    { cap: 'Coragem',            art: 'a', low: 'coragem' },
    { cap: 'Amor',               art: 'o', low: 'amor' },
    { cap: 'Solidão',            art: 'a', low: 'solidão' },
    { cap: 'Amizade',            art: 'a', low: 'amizade' },
    { cap: 'Poder',              art: 'o', low: 'poder' },
    { cap: 'Trabalho',           art: 'o', low: 'trabalho' },
    { cap: 'Dinheiro',           art: 'o', low: 'dinheiro' },
    { cap: 'Sucesso',            art: 'o', low: 'sucesso' },
    { cap: 'Fracasso',           art: 'o', low: 'fracasso' },
    { cap: 'Propósito',          art: 'o', low: 'propósito' },
    { cap: 'Sentido da vida',    art: 'o', low: 'sentido da vida' },
    { cap: 'Mudança',            art: 'a', low: 'mudança' },
    { cap: 'Impermanência',      art: 'a', low: 'impermanência' },
    { cap: 'Desejo',             art: 'o', low: 'desejo' },
    { cap: 'Apego',              art: 'o', low: 'apego' },
    { cap: 'Ego',                art: 'o', low: 'ego' },
    { cap: 'Autoconhecimento',   art: 'o', low: 'autoconhecimento' },
    { cap: 'Empatia',            art: 'a', low: 'empatia' },
    { cap: 'Compaixão',          art: 'a', low: 'compaixão' },
    { cap: 'Perdão',             art: 'o', low: 'perdão' },
    { cap: 'Raiva',              art: 'a', low: 'raiva' },
    { cap: 'Culpa',              art: 'a', low: 'culpa' },
    { cap: 'Vergonha',           art: 'a', low: 'vergonha' },
    { cap: 'Gratidão',           art: 'a', low: 'gratidão' },
    { cap: 'Humildade',          art: 'a', low: 'humildade' },
    { cap: 'Orgulho',            art: 'o', low: 'orgulho' },
    { cap: 'Autoestima',         art: 'a', low: 'autoestima' },
    { cap: 'Ansiedade',          art: 'a', low: 'ansiedade' },
    { cap: 'Controle',           art: 'o', low: 'controle' },
    { cap: 'Aceitação',          art: 'a', low: 'aceitação' },
    { cap: 'Momento presente',   art: 'o', low: 'momento presente' },
    { cap: 'Memória',            art: 'a', low: 'memória' },
    { cap: 'Imaginação',         art: 'a', low: 'imaginação' },
    { cap: 'Linguagem',          art: 'a', low: 'linguagem' },
    { cap: 'Natureza humana',    art: 'a', low: 'natureza humana' },
  ];

  // Cada molde é uma função(t) -> string, usando t.cap / t.art / t.low.
  // 20 formas de frase genuinamente diferentes — nenhuma nomeia escola de
  // pensamento (estoicismo, TCC, psicanálise etc.), só ângulos/contextos.
  var MOLDES = [
    function (t) { return 'O que é ' + t.art + ' ' + t.low + ', na prática?'; },
    function (t) { return 'Por que ' + t.art + ' ' + t.low + ' pesa tanto na vida adulta?'; },
    function (t) { return t.cap + ' no dia a dia: o que você faria diferente?'; },
    function (t) { return 'A relação entre ' + t.art + ' ' + t.low + ' e a felicidade'; },
    function (t) { return 'O que a falta de ' + t.low + ' revela sobre uma pessoa?'; },
    function (t) { return t.cap + ': escolha, hábito ou destino?'; },
    function (t) { return 'Como explicar ' + t.low + ' para uma criança?'; },
    function (t) { return t.cap + ' na era das redes sociais'; },
    function (t) { return 'O oposto de ' + t.low + ' também tem seu valor?'; },
    function (t) { return 'Uma manhã pensando em ' + t.low; },
    function (t) { return t.cap + ' muda quando ninguém está olhando?'; },
    function (t) { return 'O preço de ignorar ' + t.low; },
    function (t) { return t.cap + ' em um momento de crise'; },
    function (t) { return 'O que os mais velhos entendem sobre ' + t.low + ' que os mais jovens não?'; },
    function (t) { return t.cap + ' e o tempo que você tem'; },
    function (t) { return 'Uma conversa difícil sobre ' + t.low; },
    function (t) { return t.cap + ', visto de fora, por um estranho'; },
    function (t) { return 'O limite entre ' + t.low + ' e o seu oposto'; },
    function (t) { return t.cap + ' na solidão'; },
    function (t) { return 'O que fica de ' + t.low + ' depois que tudo passa?'; },
  ];

  var TOPICS = [];
  for (var i = 0; i < TEMAS.length; i++) {
    for (var j = 0; j < MOLDES.length; j++) {
      TOPICS.push(MOLDES[j](TEMAS[i]));
    }
  }

  window.P90_STUDY_TOPICS = TOPICS;
})();
