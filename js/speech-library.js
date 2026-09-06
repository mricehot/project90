/* ═══════════════════════════════════════════════
   PROJECT 90 — BIBLIOTECA DE DICÇÃO (gerador)

   window.buildSpeechLibrary() devolve ~1000 exercícios de fala:
     • 2/3  → foco em palavras iniciadas por "se" / "ce" (som /s/ no
              ataque — a dificuldade principal do usuário);
     • 1/3  → outros sons: R/RR, encontros consonantais, LH/NH,
              pares mínimos (S/SS/Ç/Z/C), CH/J e exercícios gerais
              de articulação / respiração / projeção / ritmo.

   Gerado de forma determinística a partir de bancos de palavras +
   moldes de frase, para não pesar o repositório com 1000 linhas fixas.
═══════════════════════════════════════════════ */

window.buildSpeechLibrary = function () {
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dedupe(list) {
    const seen = Object.create(null); const out = [];
    for (const it of list) { if (!seen[it.body]) { seen[it.body] = 1; out.push(it); } }
    return out;
  }
  // Escolhe `count` palavras distintas de `bank`, de forma determinística
  // a partir de `seed` (LCG simples). Evita repetição na mesma linha.
  function pickN(bank, count, seed) {
    let s = (seed * 2654435761) >>> 0;
    const used = new Set(), out = [];
    let guard = 0;
    while (out.length < count && guard++ < 500) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const idx = s % bank.length;
      if (!used.has(idx)) { used.add(idx); out.push(bank[idx]); }
    }
    return out;
  }

  /* ──────────────── BANCOS SE / CE ──────────────── */
  const SE_S = ('cebola cenoura cereja cerca cesto cesta cera cena centavo cenário cereal cerveja ' +
    'certeza cerimônia célula celeiro sela selo seda sede semente semana segredo seguro senha senhor ' +
    'senso sensação série serra serpente serviço sessão seta setor seiva seleção selva sermão sereia ' +
    'seringa semáforo seminário senado semestre sequência').split(' ');
  const SE_P = ('cebolas cenouras cerejas cercas cestos cestas ceras cenas centavos cenários cereais ' +
    'cervejas certezas cerimônias células celeiros selas selos sedas sedes sementes semanas segredos ' +
    'seguros senhas senhores sensos sensações séries serras serpentes serviços sessões setas setores ' +
    'seivas seleções selvas sermões sereias seringas semáforos seminários senados semestres sequências').split(' ');
  const SE_NUM = ['Seis', 'Sete', 'Sessenta', 'Setenta', 'Cem'];
  const SE_NOMES = ['Serafim', 'Sérgio', 'Celso', 'Cecília', 'Selma', 'Celina', 'Sebastião', 'César', 'Célia', 'Severino', 'Cesário', 'Serena'];

  const TE = [
    'Seis cestos secos, sete selos certos, sessenta sementes serenas.',
    'A cerca cerca o cerco certo sem cessar.',
    'Cecília cede a cesta sem cerimônia, e segue serena.',
    'Sem sede, sem sono, o senhor Serafim serra sereno.',
    'Semeei sementes secas na semana passada, sem sossego.',
    'O centavo certo cabe no cesto certo, sem sobra.',
    'Sérgio selou a sela, segurou o selo e seguiu sem cessar.',
    'Cedo se sai, cedo se serve, cedo se segue sereno.',
    'A serpente serena segue sem sussurro pela serra seca.',
    'Setenta selos, sessenta sementes, seis cestos: some tudo sem se enganar.',
    'Cena a cena, cede-se o cenário sem cerimônia.',
    'Se seca a seiva, seca a semente; se seca a semente, seca a série.',
    'O senso certo separa o segredo seguro do segredo sem senha.',
    'Cerveja sem sede não serve; sede sem cerveja se sente.',
    'Célia celebra a cerimônia certa, sereníssima, sem cessar.',
    'Sebastião sentou-se, sentiu sede e serviu-se sem cerimônia.',
    'Seis serpentes serenas seguem sem sessão pela selva seca.',
    'Cerca certa, cerco certo, cesto certo: seleção certeira.',
    'O seminário de sexta seguiu sério, sem sossego e sem sono.',
    'Semear cedo, secar sereno, colher certo.',
    'Cético, o senhor Celso cede sem certeza.',
    'A secretária selou setenta selos sem se sujar.',
    'Sereia serena, seda sem sal, serra sem sombra.',
    'Cedilha, cenoura, cebola, cereja: soletre o som do C com calma.',
    'Se cerco a cerca, cerco certo; se cedo a cesta, cedo cedo.',
    'O centavo, o cento e o censo: conte o C com cuidado.',
    'Sensação sem senso, sessão sem sentido, sermão sem cerne.',
    'Cesário semeia salsa? Não: Cesário semeia semente selecionada.',
    'Seguro seguro, segredo seguro, senha segura: sistema sem senão.',
    'A célula, no seminário, seguiu sob sério sigilo.',
    'Sete setores, seis serviços, sessenta senhas — separe sem se perder.',
    'Cedo o passo, cedo a vez, sem cerimônia e sem cessar.',
    'Serafim serrou a serra, selou a sela e semeou sereno.',
    'Se o cesto cede, a cesta segura; se a cesta cede, o cesto separa.',
    'Ceia servida, sede saciada, senhor sereno.',
    'Serpente serena sobre a serra seca, sem se assustar.',
    'O ceticismo do cético Celso cessa sem certeza.',
    'Semana sim, semana não, semeio sementes selecionadas.',
    'Cerne certo, cerco certo, senso certo: seleção sem senão.',
    'Cinquenta? Não: sessenta cestos secos, servidos sem cerimônia.',
  ];

  const TD = [
    '{N}, sério e sereno, semeia sem cessar.',
    'Seu {N} cede a cesta, cerca o cerco e segue sem sessão.',
    '{N} selou a sela, serrou a serra e seguiu sereno.',
    'Cedo {N} sente sede; cedo {N} serve a ceia.',
    '{N} separou seis selos, sessenta sementes e sete cestos.',
  ];

  // Empurrados por prioridade (curados primeiro, pares-drill como preenchimento),
  // porque no fim só os primeiros ~667 entram na biblioteca.
  let seCe = [];

  // TE — frases curadas
  for (let e = 0; e < TE.length; e++) {
    seCe.push({
      title: 'Frase se/ce nº ' + (e + 1),
      body: TE[e], kind: (e % 2 ? 'ritmo' : 'articulacao'),
      focus: 'palavras iniciadas em se/ce',
    });
  }

  // TD — frases com nomes
  for (let t = 0; t < TD.length; t++) {
    for (let m = 0; m < SE_NOMES.length; m++) {
      seCe.push({
        title: 'Nome se/ce: ' + SE_NOMES[m] + ' (' + (t + 1) + ')',
        body: TD[t].replace(/\{N\}/g, SE_NOMES[m]),
        kind: 'articulacao', focus: 'sequência densa de /s/',
      });
    }
  }

  // TB — cadeias de 6 palavras se/ce
  for (let n = 0; n < 200; n++) {
    const w = pickN(SE_S, 6, n + 1);
    seCe.push({
      title: 'Cadeia se/ce nº ' + (n + 1),
      body: 'Diga devagar, marcando o S inicial de cada palavra: ' + w.join(', ') + '.',
      kind: 'articulacao', focus: 'repetição do /s/ inicial',
    });
  }

  // TC — contagem se/ce
  for (let n = 0; n < 110; n++) {
    const A = SE_P[(n * 3) % SE_P.length];
    const B = SE_P[(n * 3 + 5) % SE_P.length];
    const C = SE_P[(n * 3 + 11) % SE_P.length];
    const x = SE_NUM[n % SE_NUM.length];
    const y = SE_NUM[(n + 1) % SE_NUM.length];
    const z = SE_NUM[(n + 2) % SE_NUM.length];
    seCe.push({
      title: 'Contagem se/ce nº ' + (n + 1),
      body: x + ' ' + A + ', ' + y + ' ' + B + ', ' + z + ' ' + C + ' — tudo começando com o som do S.',
      kind: 'ritmo', focus: 'cadência com /s/ no ataque',
    });
  }

  // TA — pares "X sem Y, Y sem X" (preenchimento até bater ~667)
  let ta = 0;
  outerTA:
  for (let i = 0; i < SE_S.length; i++) {
    for (let j = i + 1; j < SE_S.length; j++) {
      seCe.push({
        title: 'Par se/ce: ' + SE_S[i] + ' / ' + SE_S[j],
        body: cap(SE_S[i]) + ' sem ' + SE_S[j] + ', ' + SE_S[j] + ' sem ' + SE_S[i] + '.',
        kind: 'articulacao', focus: 'ataque do /s/ em palavras com se/ce',
      });
      if (++ta >= 450) break outerTA;
    }
  }

  seCe = dedupe(seCe);

  /* ──────────────── DEMAIS (outros sons) ──────────────── */
  const CLASSICS = [
    'O rato roeu a roupa do rei de Roma.',
    'A aranha arranha a rã. A rã arranha a aranha.',
    'O peito do pé de Pedro é preto.',
    'Um ninho de mafagafos, com sete mafagafinhos; quem os desmafagafizar bom desmafagafizador será.',
    'Bagre branco, branco bagre.',
    'A vaca malhada foi molhada por outra vaca malhada e molhada.',
    'O tempo perguntou ao tempo quanto tempo o tempo tem.',
    'Trinta e três traidores traíram trinta e três tribunais.',
    'Larga a larva, lava a larva, e a lavra larga a larva.',
    'O doce perguntou pro doce qual é o doce mais doce que o doce de batata-doce.',
    'O rei de Roma ripou a rolha da garrafa do rei de Roma.',
    'Pedro tem um par de pé preto; Pedro Paulo pinta o pé preto de Pedro.',
    'Casa suja, chão sujo; larga o bujão, some com a sujeira.',
    'Trinta tigres tímidos tropeçaram no trigo trocado.',
    'Quem a paca cara compra, paca cara pagará.',
    'O caju do Juca e o caju do Juquinha.',
    'O rato roeu a rolha da garrafa do rei da Rússia.',
    'Atrás da porta torta trota o gato preto.',
    'O pinto pia, a pipa pinga; pinga a pipa e o pinto pia.',
    'Lá em cima daquele morro tem um pé de amora amarela.',
    'O sapo dentro do saco, o saco com o sapo dentro, o sapo batendo papo e o papo soltando vento.',
    'Paulo, para de parar na porta do parque.',
    'O rato roeu a roda da carroça do rei.',
    'Farofa feita com muita farinha fica fofa.',
    'O prato de prata para o gato de Platão.',
    'Quatro quartos, quatro quintos, quatro quilos de quiabo.',
    'A galinha da vizinha choca melhor que a galinha minha.',
    'O que é que o queijo tem que o quero-quero quer que o queijo dê?',
    'Trigo, tigre; tigre, trigo. Trinta tigres no trigo.',
    'Chácara suja, chuchu sujo, chinelo sujo no chão da chácara.',
    'A babá boba baba; a boba babá baba mais.',
    'Três pratos de trigo para três tigres tristes.',
    'Num pretendo tender a tenda que pretendo tender.',
    'O grilo grita, a rã ralha e a aranha arranha.',
    'Debaixo da cama tem um copo; o copo cai, a cama treme.',
    'Bode magro, mato ruim; mato ruim, bode magro.',
    'O peru do Pedro é preto; o pato do Pedro é branco.',
    'A rua do Rui é reta; a reta do Rui é rua.',
    'Frasco de vidro fino, frágil, fica firme no fundo.',
    'Gato pardo, prato fundo, pinga pouca, pena grande.',
  ];

  const R_W = ('rato roupa rei rua carro cachorro ferro barro morro terra garrafa guerra serrote arara ' +
    'jarra murro torre corredor tesoura carreira roda rolha remo régua'.split(' '));
  const CL_W = ('trigo prato braço grade drama cravo fruta trem praia brasa grão prego trapo prancha ' +
    'branco grude grave trinco brinco grito preto'.split(' '));
  const LN_W = ('milho palha folha orvalho ninho banho lenha telha malha aranha montanha campanha ' +
    'vergonha rolha agulha rainha galho ralho'.split(' '));
  const CHJ_W = ('chave chuva chão cheiro chinelo chácara jarra jogo gente girafa jeito gelo jaca ' +
    'gengibre chumbo chifre janela jibóia'.split(' '));

  const MINPAIRS = [
    'casa — caça', 'coser — cozer', 'cassar — caçar', 'cela — sela', 'senso — censo',
    'cerrar — serrar', 'cede — sede', 'acento — assento', 'concerto — conserto', 'paço — passo',
    'caçar — casar', 'ruço — russo', 'poço — posso', 'aço — asso', 'laço — lasso',
    'moça — mossa', 'caçado — cassado', 'zelo — selo', 'zinco — cinco', 'cinto — sinto',
    'assar — açar', 'peça — pesa', 'braço — braso', 'maçã — massa', 'caço — caso',
    'roça — rosa', 'faça — fase', 'louça — lousa', 'traço — trás', 'preço — presa',
  ];

  const GEN = [
    ['Sopro contado', 'respiracao', 'apoio respiratório', 'Inspire em 4 tempos, segure por 4, e leia esta frase inteira num sopro só, sem forçar a garganta.'],
    ['Bocejo sonoro', 'articulacao', 'abertura da garganta', 'Simule cinco bocejos longos e sonoros, abrindo bem a garganta, antes de começar a falar.'],
    ['Trinado de lábios', 'articulacao', 'relaxamento da boca', 'Faça o trinado de lábios (brrr) por dez segundos e, sem parar, emende numa frase qualquer.'],
    ['Mandíbula solta', 'articulacao', 'mobilidade da mandíbula', 'Fale mastigando um chiclete imaginário, exagerando o movimento da mandíbula em cada palavra.'],
    ['Contar num sopro', 'respiracao', 'controle de ar', 'Conte de 1 a 20 em voz alta num único sopro, mantendo o volume igual até o fim.'],
    ['Três volumes', 'projecao', 'projeção sem gritar', 'Leia a mesma frase três vezes: sussurrando, em voz média e projetando para o fundo da sala.'],
    ['Uma sílaba por batida', 'ritmo', 'cadência constante', 'Marque uma batida do dedo na mesa por sílaba e leia mantendo o ritmo do começo ao fim.'],
    ['Lápis entre os dentes', 'articulacao', 'precisão articulatória', 'Prenda um lápis entre os dentes e leia um parágrafo mantendo tudo compreensível; depois leia sem o lápis.'],
    ['Aquecer a língua', 'articulacao', 'ápice da língua', 'Toque cada dente com a ponta da língua, de trás para frente, três vezes; depois diga: la-le-li-lo-lu.'],
    ['Estalos de língua', 'articulacao', 'agilidade da língua', 'Estale a língua vinte vezes e emende: ta-te-ti-to-tu, da-de-di-do-du, na-ne-ni-no-nu.'],
    ['Ressoar o M', 'projecao', 'ressonância', 'Faça "mmmm" sentindo os lábios vibrarem, depois fale: ma-me-mi-mo-mu bem apoiado.'],
    ['Voz na parede', 'projecao', 'projeção', 'Fale de costas para a parede, projetando a voz para o outro lado da sala, sem gritar.'],
    ['Respirar nas pausas', 'respiracao', 'fôlego e pausa', 'Leia um parágrafo respirando somente nas vírgulas e nos pontos finais.'],
    ['Vogais gigantes', 'articulacao', 'abertura das vogais', 'Alongue as vogais: aaa-eee-iii-ooo-uuu, bem abertas, duas vezes, antes de falar.'],
    ['Sílabas rápidas', 'ritmo', 'nitidez em velocidade', 'Diga "papapapa", "tatatata", "kakakaka" o mais rápido que conseguir sem perder a nitidez.'],
    ['Câmera lenta', 'ritmo', 'duração das sílabas', 'Leia em câmera lenta, dobrando a duração de cada sílaba tônica.'],
    ['Apagar a vela', 'respiracao', 'sopro dirigido', 'Sopre uma vela imaginária dez vezes, firme e curto, e depois fale a frase seguinte.'],
    ['Boca bem aberta', 'articulacao', 'amplitude articulatória', 'Fale com a boca bem aberta, como se cada vogal fosse enorme, por um minuto.'],
    ['Escada de velocidade', 'ritmo', 'controle de ritmo', 'Repita "vermelho, amarelo, paralelepípedo" três vezes, cada vez um pouco mais rápido, sem engolir sílaba.'],
    ['Cavalo relaxado', 'articulacao', 'soltar a boca', 'Bufe como um cavalo, com os lábios soltos, por quinze segundos, para relaxar a boca antes de falar.'],
  ];

  let demais = [];

  // classics
  for (let i = 0; i < CLASSICS.length; i++) {
    demais.push({ title: 'Trava-língua clássico nº ' + (i + 1), body: CLASSICS[i], kind: 'trava-lingua', focus: 'trava-língua tradicional' });
  }
  // R pares + cadeias
  let rp = 0;
  outerR:
  for (let i = 0; i < R_W.length; i++) {
    for (let j = i + 1; j < R_W.length; j++) {
      demais.push({ title: 'Par R: ' + R_W[i] + ' / ' + R_W[j], body: cap(R_W[i]) + ' com ' + R_W[j] + ', ' + R_W[j] + ' com ' + R_W[i] + '.', kind: 'articulacao', focus: 'som do R / RR' });
      if (++rp >= 75) break outerR;
    }
  }
  for (let n = 0; n < 60; n++) {
    const w = pickN(R_W, 6, n + 101);
    demais.push({ title: 'Cadeia R nº ' + (n + 1), body: 'Marque bem o erre em cada palavra: ' + w.join(', ') + '.', kind: 'articulacao', focus: 'vibração do R' });
  }
  // encontros consonantais
  let cp = 0;
  outerCL:
  for (let i = 0; i < CL_W.length; i++) {
    for (let j = i + 1; j < CL_W.length; j++) {
      demais.push({ title: 'Par de encontro: ' + CL_W[i] + ' / ' + CL_W[j], body: cap(CL_W[i]) + ' e ' + CL_W[j] + '; ' + CL_W[j] + ' e ' + CL_W[i] + '.', kind: 'articulacao', focus: 'encontro consonantal (tr, pr, br, gr, dr)' });
      if (++cp >= 45) break outerCL;
    }
  }
  // LH / NH
  let lp = 0;
  outerLN:
  for (let i = 0; i < LN_W.length; i++) {
    for (let j = i + 1; j < LN_W.length; j++) {
      demais.push({ title: 'Par LH/NH: ' + LN_W[i] + ' / ' + LN_W[j], body: cap(LN_W[i]) + ', ' + LN_W[j] + ', ' + LN_W[i] + ', ' + LN_W[j] + ' — devagar.', kind: 'articulacao', focus: 'sons LH e NH' });
      if (++lp >= 45) break outerLN;
    }
  }
  // pares mínimos
  for (let i = 0; i < MINPAIRS.length; i++) {
    demais.push({ title: 'Par mínimo nº ' + (i + 1), body: 'Leia o par sem confundir os sons: ' + MINPAIRS[i] + '. Repita devagar três vezes.', kind: 'articulacao', focus: 'discriminar S / SS / Ç / Z / C' });
  }
  // CH / J
  let hp = 0;
  outerCHJ:
  for (let i = 0; i < CHJ_W.length; i++) {
    for (let j = i + 1; j < CHJ_W.length; j++) {
      demais.push({ title: 'Par CH/J: ' + CHJ_W[i] + ' / ' + CHJ_W[j], body: cap(CHJ_W[i]) + ' e ' + CHJ_W[j] + '; ' + CHJ_W[j] + ' e ' + CHJ_W[i] + '.', kind: 'articulacao', focus: 'sons do CH e do J/G' });
      if (++hp >= 45) break outerCHJ;
    }
  }
  // gerais
  for (let i = 0; i < GEN.length; i++) {
    demais.push({ title: GEN[i][0], kind: GEN[i][1], focus: GEN[i][2], body: GEN[i][3] });
  }

  demais = dedupe(demais);

  /* ──────────────── montagem final: 2/3 se/ce + 1/3 demais ──────────────── */
  const TOTAL = 1000;
  const wantSeCe = Math.round(TOTAL * 2 / 3);   // 667
  const wantOther = TOTAL - wantSeCe;           // 333
  const a = seCe.slice(0, Math.min(wantSeCe, seCe.length));
  const b = demais.slice(0, Math.min(wantOther, demais.length));
  return a.concat(b);
};
