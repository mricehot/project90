/* ═══════════════════════════════════════════════
   PROJECT 90 — TEXTOS PARA LEITURA EM VOZ ALTA (Dicção)

   window.READING_TEXTS: ~25 textos mais longos que as frases da
   biblioteca de dicção — pra ler em voz alta, gravar e se ouvir.

   Conteúdo: trechos de domínio público (autores falecidos há mais de
   70 anos) + textos originais para os registros modernos (notícia,
   diálogo, discurso, instrução). Categorias:
     prosa · poesia · noticia · dialogo · discurso · instrucao · historico
═══════════════════════════════════════════════ */

window.READING_TEXTS = [

  /* ── PROSA (domínio público) ── */
  {
    title: 'Dom Casmurro — o título',
    category: 'prosa',
    source: 'Machado de Assis, 1899',
    body:
`Uma noite destas, vindo da cidade para o Engenho Novo, encontrei num trem da Central um rapaz aqui do bairro, que eu conheço de vista e de chapéu. Cumprimentou-me, sentou-se ao pé de mim, falou da lua e dos ministros, e acabou recitando-me versos.

A viagem era curta, e os versos pode ser que não fossem inteiramente maus. Sucedeu, porém, que, como eu estava cansado, fechei os olhos três ou quatro vezes; tanto bastou para que ele interrompesse a leitura e metesse os versos no bolso.`
  },
  {
    title: 'Memórias Póstumas — ao leitor',
    category: 'prosa',
    source: 'Machado de Assis, 1881',
    body:
`Algum tempo hesitei se devia abrir estas memórias pelo princípio ou pelo fim, isto é, se poria em primeiro lugar o meu nascimento ou a minha morte. Suposto o uso vulgar seja começar pelo nascimento, duas considerações me levaram a adotar diferente método: a primeira é que eu não sou propriamente um autor defunto, mas um defunto autor, para quem a campa foi outro berço; a segunda é que o escrito ficaria assim mais galante e mais novo.`
  },
  {
    title: 'Iracema — abertura',
    category: 'prosa',
    source: 'José de Alencar, 1865',
    body:
`Verdes mares bravios de minha terra natal, onde canta a jandaia nas frondes da carnaúba;

verdes mares que brilhais como líquida esmeralda aos raios do sol nascente, perlongando as alvas praias ensombradas de coqueiros;

serenai, verdes mares, e alisai docemente a vaga impetuosa, para que o barco aventureiro manso resvale à flor das águas.`
  },
  {
    title: 'Triste Fim de Policarpo Quaresma — trecho',
    category: 'prosa',
    source: 'Lima Barreto, 1915',
    body:
`Havia bem uns quatro anos que o major Policarpo Quaresma, cidadão brasileiro, funcionário público, morava naquele arrabalde de São Januário. Vivia só, sem mulher, sem filhos, com uma irmã já madura, e todas as manhãs, às oito horas em ponto, saía de casa a caminho da repartição.

Era pontual como um relógio e tão certo nos seus hábitos que os vizinhos ajustavam por ele o andamento do dia.`
  },

  /* ── POESIA (domínio público) ── */
  {
    title: 'Canção do Exílio',
    category: 'poesia',
    source: 'Gonçalves Dias, 1843',
    body:
`Minha terra tem palmeiras,
Onde canta o Sabiá;
As aves, que aqui gorjeiam,
Não gorjeiam como lá.

Nosso céu tem mais estrelas,
Nossas várzeas têm mais flores,
Nossos bosques têm mais vida,
Nossa vida mais amores.

Em cismar, sozinho, à noite,
Mais prazer encontro eu lá;
Minha terra tem palmeiras,
Onde canta o Sabiá.`
  },
  {
    title: 'Amor é fogo que arde sem se ver',
    category: 'poesia',
    source: 'Luís de Camões',
    body:
`Amor é fogo que arde sem se ver;
É ferida que dói e não se sente;
É um contentamento descontente;
É dor que desatina sem doer.

É um não querer mais que bem querer;
É solitário andar por entre a gente;
É nunca contentar-se de contente;
É cuidar que se ganha em se perder.`
  },
  {
    title: 'Língua Portuguesa',
    category: 'poesia',
    source: 'Olavo Bilac, 1919',
    body:
`Última flor do Lácio, inculta e bela,
És, a um tempo, esplendor e sepultura:
Ouro nativo, que na ganga impura
A bruta mina entre os cascalhos vela.

Amo-te assim, desconhecida e obscura,
Tuba de alto clangor, lira singela,
Que tens o trom e o silvo da procela
E o arrolo da saudade e da ternura!`
  },
  {
    title: 'Meus oito anos',
    category: 'poesia',
    source: 'Casimiro de Abreu, 1857',
    body:
`Oh! que saudades que tenho
Da aurora da minha vida,
Da minha infância querida
Que os anos não trazem mais!
Que amor, que sonhos, que flores,
Naquelas tardes fagueiras
À sombra das bananeiras,
Debaixo dos laranjais!`
  },
  {
    title: 'O Navio Negreiro — trecho',
    category: 'poesia',
    source: 'Castro Alves, 1869',
    body:
`'Stamos em pleno mar... Doudo no espaço
Brinca o luar — dourada borboleta;
E as vagas após ele correm... cansam
Como turba de infantes inquieta.

'Stamos em pleno mar... Do firmamento
Os astros saltam como espumas de ouro...
O mar em troca acende as ardentias,
— Constelações do líquido tesouro...`
  },
  {
    title: 'Soneto — Cruz e Sousa',
    category: 'poesia',
    source: 'Cruz e Sousa, 1893',
    body:
`Ó Formas alvas, brancas, Formas claras
De luares, de neves, de neblinas!...
Ó Formas vagas, fluidas, cristalinas...
Incensos dos turíbulos das aras...

Formas do Amor, consteladamente puras,
De Virgens e de Santas vaporosas...
Brilhos errantes, mádidas frescuras
E dolências de lírios e de rosas...`
  },

  /* ── HISTÓRICO / ENSAIO (domínio público) ── */
  {
    title: 'O sertanejo é um forte',
    category: 'historico',
    source: 'Euclides da Cunha, Os Sertões, 1902',
    body:
`O sertanejo é, antes de tudo, um forte. Não tem o raquitismo exaustivo dos mestiços neurastênicos do litoral.

A sua aparência, entretanto, ao primeiro lance de vista, revela o contrário. Falta-lhe a plástica impecável, o desempeno, a estrutura corretíssima das organizações atléticas.

É desgracioso, desengonçado, torto. Reflete no andar cansado uma displicência de invertebrado. Mas toda esta aparência de cansaço ilude. Nada é mais surpreendedor do que vê-la desaparecer de improviso.`
  },
  {
    title: 'Oração aos Moços — trecho',
    category: 'discurso',
    source: 'Rui Barbosa, 1920',
    body:
`De tanto ver triunfar as nulidades, de tanto ver prosperar a desonra, de tanto ver crescer a injustiça, de tanto ver agigantarem-se os poderes nas mãos dos maus, o homem chega a desanimar-se da virtude, a rir-se da honra, a ter vergonha de ser honesto.

Não é assim, moços. A regeneração dos costumes públicos é obra de coragem e de fé. Servi ao vosso país com desinteresse, e o vosso país vos dará em glória o que vos negar em proveito.`
  },

  /* ── NOTÍCIA (originais) ── */
  {
    title: 'Boletim do tempo',
    category: 'noticia',
    source: 'texto original',
    body:
`A previsão para esta semana indica tempo instável na maior parte do país. Entre segunda e quarta-feira, áreas de baixa pressão avançam pelo litoral e devem provocar pancadas de chuva no fim da tarde, com raios e rajadas de vento.

As temperaturas ficam amenas, entre dezoito e vinte e seis graus. A partir de quinta-feira, uma massa de ar seco se aproxima, o céu abre e a umidade do ar cai bastante. Recomenda-se hidratação reforçada e cuidado com a exposição ao sol no período da tarde.`
  },
  {
    title: 'Nota esportiva',
    category: 'noticia',
    source: 'texto original',
    body:
`O time da casa venceu a partida de ontem por três a um, diante de um estádio quase lotado. O primeiro tempo foi equilibrado, com as duas equipes trocando ataques sem grande perigo.

Na etapa final, o meia camisa dez comandou a virada: marcou de falta aos doze minutos e serviu o atacante duas vezes. O adversário descontou nos acréscimos, mas já não havia tempo para reação. Com o resultado, a equipe assume a liderança provisória e chega a três vitórias seguidas.`
  },
  {
    title: 'Descoberta científica',
    category: 'noticia',
    source: 'texto original',
    body:
`Pesquisadores anunciaram nesta semana o registro de uma nova espécie de anfíbio em uma área de floresta preservada. O animal, de coloração âmbar e menos de três centímetros, vive junto a bromélias e só canta depois das primeiras chuvas.

Segundo a equipe, o achado reforça a importância de proteger fragmentos florestais, mesmo os pequenos, que funcionam como abrigo para populações isoladas. O estudo completo será publicado em uma revista internacional no próximo mês.`
  },

  /* ── DIÁLOGO (originais) ── */
  {
    title: 'Cena — a chave perdida',
    category: 'dialogo',
    source: 'texto original',
    body:
`— Você viu minha chave? Jurava que tinha deixado na mesa.

— Na mesa não está. Olhou no bolso do casaco?

— Olhei. Olhei duas vezes. E na fruteira, e embaixo do jornal.

— Respira. Toda vez que você se apressa, some alguma coisa. Ontem foi o óculos, que estava na sua cabeça.

— Não compara. O óculos eu achei rindo. A chave não tem graça nenhuma.

— Então procura devagar. Começa pela porta de entrada. Aposto que ficou na fechadura a noite inteira.`
  },
  {
    title: 'Entrevista de emprego',
    category: 'dialogo',
    source: 'texto original',
    body:
`— Bom dia. Pode me contar, em poucas palavras, por que se candidatou a esta vaga?

— Bom dia. Trabalho com atendimento há cinco anos e sinto que aprendi tudo o que essa função podia me ensinar. Procuro um lugar onde eu possa assumir mais responsabilidade e liderar uma equipe pequena.

— E o que você faz quando um cliente está claramente irritado?

— Primeiro escuto até o fim, sem interromper. Depois repito o problema com minhas palavras, para mostrar que entendi, e só então proponho uma solução com prazo.`
  },
  {
    title: 'Conversa no balcão',
    category: 'dialogo',
    source: 'texto original',
    body:
`— Me vê um café e um pão na chapa, por favor.

— O café é com leite ou puro?

— Puro, e bem forte. Noite curta.

— Essa eu conheço. Trabalhou até tarde?

— Estudei. Prova amanhã cedo. Se eu passar, volto aqui e pago um café pra todo mundo do balcão.

— Fica combinado. Vou lembrar. E anota aí: da próxima vez, dorme primeiro e estuda de manhã. Rende o dobro.`
  },

  /* ── DISCURSO (originais) ── */
  {
    title: 'Abertura de cerimônia',
    category: 'discurso',
    source: 'texto original',
    body:
`Boa noite a todas e a todos. É uma alegria abrir esta cerimônia diante de tanta gente que dedicou meses de esforço a este projeto.

O que nos reúne aqui não é apenas o resultado, embora ele seja motivo de orgulho. É o processo: as reuniões longas, as ideias descartadas, os começos de novo. Nada disso aparece no palco, mas é o que sustenta tudo o que vamos ver.

Agradeço a cada pessoa que acreditou quando ainda não havia nada para mostrar. Que a noite seja à altura do trabalho.`
  },
  {
    title: 'Homenagem a um mestre',
    category: 'discurso',
    source: 'texto original',
    body:
`Foi na sala dele que muitos de nós entendemos, pela primeira vez, que uma pergunta bem feita vale mais do que dez respostas prontas.

Ele nunca teve pressa de corrigir. Deixava o erro ficar um tempo no ar, olhava para a turma e esperava. Quase sempre alguém se adiantava e resolvia sozinho. Era o método dele: fazer com que a gente não precisasse mais dele.

Hoje, ao homenageá-lo, devolvemos um pouco dessa paciência. Obrigado, professor, por ter apostado na nossa capacidade antes de nós mesmos.`
  },
  {
    title: 'Antes da largada',
    category: 'discurso',
    source: 'texto original',
    body:
`Vocês treinaram para este dia quando ninguém estava vendo. Nas manhãs frias, nas noites em que era mais fácil desistir, na semana em que tudo deu errado e vocês foram assim mesmo.

A prova de hoje é só a parte visível de um trabalho que já está feito. Não corram atrás do tempo dos outros. Corram o seu ritmo, o que vocês ensaiaram, e confiem nele.

Respirem fundo. Olhem para a linha. E lembrem: a versão de vocês que começou lá atrás não chegaria nem perto daqui.`
  },

  /* ── INSTRUÇÃO (originais) ── */
  {
    title: 'Receita — arroz soltinho',
    category: 'instrucao',
    source: 'texto original',
    body:
`Lave duas xícaras de arroz até a água sair quase transparente e escorra bem. Numa panela, aqueça um fio de óleo em fogo médio e refogue meia cebola picada e um dente de alho até dourarem.

Junte o arroz e mexa por um minuto, para envolver cada grão na gordura. Acrescente três xícaras e meia de água fervente e sal a gosto. Quando levantar fervura, abaixe o fogo, tampe pela metade e deixe cozinhar sem mexer por cerca de quinze minutos, até secar. Desligue, tampe por completo e espere cinco minutos antes de servir.`
  },
  {
    title: 'Montagem de uma prateleira',
    category: 'instrucao',
    source: 'texto original',
    body:
`Separe todas as peças sobre uma superfície plana e confira a lista de parafusos antes de começar. Identifique as duas laterais, o fundo e as três tábuas horizontais.

Encaixe primeiro a tábua de baixo entre as laterais e fixe com dois parafusos de cada lado, sem apertar até o fim. Repita com a tábua do meio e a de cima. Só depois de tudo alinhado, aperte todos os parafusos com firmeza.

Por último, prenda o fundo com os preguinhos menores e verifique se a estrutura não balança antes de colocar qualquer peso.`
  },
  {
    title: 'Procedimento em caso de tremor',
    category: 'instrucao',
    source: 'texto original',
    body:
`Ao sentir um tremor forte, mantenha a calma e não corra para as escadas nem para o elevador. Se estiver dentro de casa, agache-se ao lado de um móvel resistente, proteja a cabeça e o pescoço com os braços e afaste-se de janelas e objetos altos.

Permaneça nessa posição até o movimento parar por completo. Só então saia com cuidado, evitando fios soltos e vidros no chão. Do lado de fora, dirija-se a uma área aberta, longe de muros, postes e árvores, e aguarde novas instruções.`
  }
];
