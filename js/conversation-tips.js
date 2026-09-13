/* ============================================================================
 *  PROJECT 90 — Banco de dicas de "Conversação" (Dicção)
 *
 *  Biblioteca curada de dicas sobre comunicação interpessoal: como puxar e
 *  manter uma conversa, escuta ativa, postura e linguagem corporal, contato
 *  visual, e como encerrar bem. Cada dica tem um índice fixo (a posição no
 *  array) — é isso que fica salvo em conversation_tips_read.tip_idx quando
 *  o usuário marca como lida, então:
 *
 *  IMPORTANTE: não reordene nem remova itens — só ACRESCENTE no fim de cada
 *  categoria (ou uma categoria nova no fim do array). Reordenar faz uma
 *  dica já marcada como lida "virar" outra pros usuários que já marcaram.
 * ========================================================================== */
window.P90_CONVERSATION_TIPS = [
  // ── INICIAR CONVERSAS ──
  { category: 'Iniciar conversas', title: 'Comente o ambiente, não o clima',
    body: 'Um comentário genérico sobre o tempo morre rápido. Comente algo específico do lugar — a fila, a música, o evento — é mais fácil de continuar porque dá um gancho concreto pra outra pessoa responder.' },
  { category: 'Iniciar conversas', title: 'Pergunta aberta em vez de sim/não',
    body: '"Você gostou do evento?" trava em uma palavra. "O que achou do evento?" convida a pessoa a falar de verdade — e te dá material pra continuar.' },
  { category: 'Iniciar conversas', title: 'Apresente-se antes de perguntar',
    body: 'Dizer seu nome primeiro ("Oi, eu sou o Atos") baixa a guarda de quem você está abordando — fica mais natural que ela retribua com o dela do que se você só disparar uma pergunta.' },
  { category: 'Iniciar conversas', title: 'Use o que está à vista',
    body: 'Um livro na mesa, uma camiseta de banda, um crachá de evento — são convites que a pessoa já deixou visíveis. Comentar sobre isso é menos invasivo que puxar um assunto do nada.' },
  { category: 'Iniciar conversas', title: 'Aceite o silêncio inicial',
    body: 'As primeiras trocas de frase quase sempre são desconfortáveis — isso é normal, não um sinal de que está indo mal. Não force um assunto grande logo de cara; deixe a conversa esquentar.' },
  { category: 'Iniciar conversas', title: 'Prepare 2-3 aberturas genéricas',
    body: 'Ter na manga perguntas como "o que te trouxe aqui?" ou "como você conhece o pessoal?" tira o peso de precisar improvisar toda vez do zero.' },
  { category: 'Iniciar conversas', title: 'Sorria antes de falar',
    body: 'Um sorriso genuíno de um ou dois segundos antes da primeira frase sinaliza intenção amigável — a pessoa relaxa antes mesmo de você terminar a frase.' },
  { category: 'Iniciar conversas', title: 'Errar a abertura não é o fim',
    body: 'Se a primeira frase saiu estranha, uma risada de si mesmo ("desculpa, isso soou mais estranho na minha cabeça") geralmente quebra o gelo melhor do que fingir que não aconteceu.' },

  // ── ESCUTA ATIVA ──
  { category: 'Escuta ativa', title: 'Repita a última palavra-chave',
    body: 'Repetir de volta a última coisa importante que a pessoa disse ("...mudou de cidade?") mostra que você acompanhou e convida ela a expandir, sem você precisar inventar uma pergunta nova.' },
  { category: 'Escuta ativa', title: 'Não prepare a resposta enquanto ouve',
    body: 'É tentador já pensar no que vai dizer assim que a outra pessoa começa a falar — mas isso faz você perder metade do que ela disse. Ouça até o fim, depois pense.' },
  { category: 'Escuta ativa', title: 'Confirme antes de opinar',
    body: '"Deixa eu ver se entendi..." antes de dar sua opinião evita responder a algo que a pessoa não disse, e mostra que você estava prestando atenção de verdade.' },
  { category: 'Escuta ativa', title: 'Pergunte "e depois?"',
    body: 'Quando alguém conta uma história, perguntar "e aí, o que aconteceu?" custa quase nada e mostra interesse genuíno — muita gente para de contar histórias por achar que ninguém quer ouvir o resto.' },
  { category: 'Escuta ativa', title: 'Deixe pausas existirem',
    body: 'Preencher todo silêncio com uma pergunta nova pode parecer ansiedade. Uma pausa de um ou dois segundos dá espaço pra pessoa completar o próprio pensamento.' },
  { category: 'Escuta ativa', title: 'Valide o sentimento, não só o fato',
    body: 'Além de reagir ao que aconteceu, nomeie o que a pessoa deve ter sentido ("nossa, deve ter sido frustrante") — isso comunica empatia de um jeito que só "que chato" não comunica.' },
  { category: 'Escuta ativa', title: 'Guarde detalhes pra usar depois',
    body: 'Lembrar de um nome, um projeto ou um plano que a pessoa mencionou numa conversa anterior — e perguntar sobre isso depois — é uma das formas mais simples de fazer alguém se sentir ouvido.' },
  { category: 'Escuta ativa', title: 'Celular fora da mesa',
    body: 'Só o aparelho visível, mesmo sem tocar nele, já reduz o quanto a outra pessoa sente que tem sua atenção — segundo estudos de psicologia social sobre "phubbing".' },

  // ── POSTURA E LINGUAGEM CORPORAL ──
  { category: 'Postura e linguagem corporal', title: 'Ombros abertos, não curvados',
    body: 'Curvar os ombros pra frente passa insegurança mesmo sem você perceber. Manter o peito levemente aberto e os ombros relaxados (não travados pra trás) já muda a leitura que as pessoas fazem de você.' },
  { category: 'Postura e linguagem corporal', title: 'Vire o corpo pra quem fala',
    body: 'Manter os pés e o tronco virados pra pessoa (não só o rosto) sinaliza presença. Virar o corpo pra saída é um dos primeiros sinais, muitas vezes inconsciente, de que alguém quer encerrar.' },
  { category: 'Postura e linguagem corporal', title: 'Mãos visíveis e relaxadas',
    body: 'Mãos escondidas nos bolsos ou cruzadas com força passam desconforto. Gestos naturais com as mãos, nem contidos nem exagerados, tendem a passar mais confiança.' },
  { category: 'Postura e linguagem corporal', title: 'Espelhe sutilmente',
    body: 'Adaptar seu ritmo de fala e postura ao da outra pessoa (sem imitar de forma óbvia) cria uma sensação inconsciente de sintonia — é uma técnica chamada "rapport" na psicologia.' },
  { category: 'Postura e linguagem corporal', title: 'Cuidado com braços cruzados',
    body: 'Mesmo quando é só uma questão de estar com frio, braços cruzados costumam ser lidos como fechamento ou desinteresse. Se notar que fez isso, é fácil descruzar naturalmente.' },
  { category: 'Postura e linguagem corporal', title: 'Respire antes de responder',
    body: 'Responder rápido demais pode parecer ansiedade; uma pausa curta pra respirar antes de falar passa calma e dá tempo de organizar o que você quer dizer.' },
  { category: 'Postura e linguagem corporal', title: 'Ritmo de voz conta tanto quanto palavra',
    body: 'Falar rápido demais soa nervoso; devagar demais soa monótono. Variar o ritmo — desacelerar num ponto importante, por exemplo — prende mais atenção do que qualquer palavra escolhida.' },
  { category: 'Postura e linguagem corporal', title: 'Caminhe com propósito',
    body: 'Como você entra numa sala — passos firmes, olhar à frente, em vez de olhar pro chão — já comunica algo antes de você dizer qualquer palavra.' },

  // ── MANTER O PAPO FLUINDO ──
  { category: 'Manter o papo fluindo', title: 'Divida em vez de só responder',
    body: 'Quando alguém pergunta algo sobre você, responda e devolva uma pergunta parecida. Conversa que só vai numa direção (você respondendo perguntas) cansa rápido.' },
  { category: 'Manter o papo fluindo', title: 'Puxe um fio que ficou solto',
    body: 'Se a pessoa mencionou algo de passagem sem detalhar, voltar nesse ponto ("você falou que ia viajar, pra onde?") costuma abrir mais assunto do que insistir no tópico atual.' },
  { category: 'Manter o papo fluindo', title: 'Tenha 3 histórias na manga',
    body: 'Ter algumas histórias curtas e interessantes já pensadas de antemão (uma viagem, um perrengue, algo engraçado que aconteceu) evita aquele branco de "não tenho nada pra contar".' },
  { category: 'Manter o papo fluindo', title: 'Concorde antes de discordar',
    body: 'Quando for discordar de algo, comece validando a parte que faz sentido ("entendo esse ponto, mas...") — a conversa continua fluindo em vez de virar um confronto.' },
  { category: 'Manter o papo fluindo', title: 'Não sequestre a história',
    body: 'É tentador responder "isso me lembra de uma vez que eu..." — mas fazer isso toda vez impede a pessoa de terminar o que estava contando. Deixe ela fechar o assunto primeiro.' },
  { category: 'Manter o papo fluindo', title: 'Assuntos-ponte',
    body: 'Trabalho, viagens, comida, séries/filmes e planos de fim de semana são temas que praticamente todo mundo tem algo pra dizer — bons pra resgatar uma conversa que travou.' },
  { category: 'Manter o papo fluindo', title: 'Humor autodepreciativo com moderação',
    body: 'Rir de si mesmo com leveza aproxima; fazer isso o tempo todo passa insegurança. Use pra quebrar tensão, não como a personalidade inteira da conversa.' },
  { category: 'Manter o papo fluindo', title: 'É ok admitir que não sabe',
    body: '"Não faço ideia, me conta mais" é uma resposta completamente válida e geralmente abre mais conversa do que fingir que entende de um assunto que você não domina.' },

  // ── CONTATO VISUAL E PRESENÇA ──
  { category: 'Contato visual e presença', title: 'Regra dos 50/70',
    body: 'Uma referência comum: manter contato visual em cerca de 50% do tempo enquanto você fala e 70% enquanto escuta. Olhar fixo demais incomoda; olhar de menos passa desinteresse.' },
  { category: 'Contato visual e presença', title: 'Quebre o olhar pro lado, não pra baixo',
    body: 'Quando for desviar o olhar naturalmente, olhar de lado passa mais naturalidade do que olhar pro chão, que costuma ser lido como insegurança ou estar escondendo algo.' },
  { category: 'Contato visual e presença', title: 'Triângulo dos olhos',
    body: 'Alternar o olhar entre os dois olhos e a boca da pessoa (formando um triângulo imaginário) evita aquele olhar fixo e parado que deixa qualquer um desconfortável.' },
  { category: 'Contato visual e presença', title: 'Esteja onde seus pés estão',
    body: 'Presença é notar quando sua cabeça foi embora da conversa (pensando em outra coisa) e trazer a atenção de volta — isso é mais perceptível pros outros do que parece.' },
  { category: 'Contato visual e presença', title: 'Contato visual em grupo',
    body: 'Em conversas com mais de duas pessoas, distribua o olhar entre todo mundo, não só em quem está falando — isso inclui quem está mais quieto na roda.' },
  { category: 'Contato visual e presença', title: 'Aceno de cabeça com moderação',
    body: 'Balançar a cabeça enquanto ouve mostra acompanhamento — mas fazer isso rápido demais ou sem parar passa impaciência, como se você quisesse que a pessoa terminasse logo.' },

  // ── ENCERRAR CONVERSAS BEM ──
  { category: 'Encerrar conversas bem', title: 'Termine no pico, não na queda',
    body: 'Encerrar uma conversa enquanto ainda está boa (em vez de deixar ela morrer sozinha) deixa uma impressão melhor e mais memória positiva do que esticar até ficar sem assunto.' },
  { category: 'Encerrar conversas bem', title: 'Nomeie o que você gostou',
    body: '"Gostei muito de saber sobre seu projeto" antes de se despedir é mais genuíno e memorável do que um "foi bom te ver" genérico.' },
  { category: 'Encerrar conversas bem', title: 'Proponha o próximo passo',
    body: 'Se fizer sentido, termine com algo concreto ("bora marcar um café" ou "me manda esse link depois") em vez de deixar em aberto — dá continuidade real à conversa.' },
  { category: 'Encerrar conversas bem', title: 'Está tudo bem sair de uma roda',
    body: 'Você não precisa de uma desculpa elaborada pra sair de uma conversa em grupo — "vou circular um pouco, já volto" é suficiente e ninguém vai questionar.' },
  { category: 'Encerrar conversas bem', title: 'Feche com o corpo antes das palavras',
    body: 'Virar levemente o corpo na direção da saída enquanto ainda fala a última frase prepara a outra pessoa pro fim da conversa de um jeito mais suave do que uma despedida abrupta.' },
  { category: 'Encerrar conversas bem', title: 'Agradeça especificamente',
    body: 'Em vez de um "valeu, até mais" automático, agradecer por algo específico da conversa fecha com mais calor e é mais fácil de lembrar depois.' },
];
