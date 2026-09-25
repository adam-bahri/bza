// Moteur de jeu : règles de Bohnanza, sans aucun accès au DOM.
// Exécuté uniquement chez l'hôte de la session ; les invités reçoivent l'état déjà calculé.
/*ENGINE-START*/
/* ============ MOTEUR (aucun accès au DOM, exécuté uniquement chez l'hôte) ============ */
const BEAN_ORDER = ['cafe', 'cire', 'bleu', 'piment', 'puant', 'vert', 'soja', 'oeil', 'rouge', 'jardin', 'cacao'];
/* n = nombre d'exemplaires ; lv = [[haricots nécessaires, pièces gagnées], ...] (le « beanometer ») */
const BEANS = {
  cafe:   { name: 'Café',     full: 'haricot café',      n: 24, lv: [[4, 1], [7, 2], [10, 3], [12, 4]] },
  cire:   { name: 'Cire',     full: 'haricot cire',      n: 22, lv: [[4, 1], [7, 2], [9, 3], [11, 4]] },
  bleu:   { name: 'Bleu',     full: 'haricot bleu',      n: 20, lv: [[4, 1], [6, 2], [8, 3], [10, 4]] },
  piment: { name: 'Piment',   full: 'haricot piment',    n: 18, lv: [[3, 1], [6, 2], [8, 3], [9, 4]] },
  puant:  { name: 'Puant',    full: 'haricot puant',     n: 16, lv: [[3, 1], [5, 2], [7, 3], [8, 4]] },
  vert:   { name: 'Vert',     full: 'haricot vert',      n: 14, lv: [[3, 1], [5, 2], [6, 3], [7, 4]] },
  soja:   { name: 'Soja',     full: 'fève de soja',      n: 12, lv: [[2, 1], [4, 2], [6, 3], [7, 4]] },
  oeil:   { name: 'Œil noir', full: 'haricot œil noir',  n: 10, lv: [[2, 1], [4, 2], [5, 3], [6, 4]] },
  rouge:  { name: 'Rouge',    full: 'haricot rouge',     n: 8,  lv: [[2, 1], [3, 2], [4, 3], [5, 4]] },
  jardin: { name: 'Jardin',   full: 'haricot de jardin', n: 6,  lv: [[2, 2], [3, 3]] },
  cacao:  { name: 'Cacao',    full: 'fève de cacao',     n: 4,  lv: [[2, 2], [3, 3], [4, 4]] }
};
const MIN_PLAYERS = 3, MAX_PLAYERS = 8;
const BOT_NAMES = ['Haricot', 'Fanette', 'Gousse', 'Pois', 'Lentille', 'Mochi', 'Fève'];

let S = null, seq = 0, offerSeq = 0;
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function coinsFor(bean, n) { let c = 0; for (const [m, k] of BEANS[bean].lv) if (n >= m) c = k; return c; }
const plural = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');

/* Adaptation aux nombres de joueurs (règle officielle) */
function removedBeans(n) { return n === 3 ? ['cacao'] : n <= 5 ? ['cafe'] : ['cacao', 'jardin']; }
function makeCfg(n) {
  return { limit: n === 3 ? 2 : 3,        // épuisements de la pioche avant la fin
           fixedThree: n === 3,           // à 3 : 3 champs d'office, pas d'achat
           cost: n >= 6 ? 2 : 3,          // prix du 3e champ
           drawN: n >= 6 ? 4 : 3,         // cartes piochées en fin de tour
           beans: BEAN_ORDER.filter(b => !removedBeans(n).includes(b)) };
}
function buildDeck(cfg) {
  const d = [];
  cfg.beans.forEach(b => { for (let i = 0; i < BEANS[b].n; i++) d.push({ uid: ++seq, bean: b }); });
  return shuffle(d);
}

function newState() {
  return { phase: 'lobby', players: [], deck: [], discard: [], turn: 0, step: '', faceUp: [], offers: [],
           exhaust: 0, endFlag: false, cfg: makeCfg(4), log: [], result: null, dealer: 0,
           ready: [], botMade: [], notes: [], rev: 0, fails: 0 };
}
function newPlayer(name, bot) {
  return { id: rid(), name, bot: !!bot, host: false, connected: true, token: '', hand: [], fields: [], coins: [], toPlant: [] };
}
function log(m) { S.log.push(m); if (S.log.length > 80) S.log.shift(); }
function note(m) { log(m); S.notes.push(m); if (S.notes.length > 4) S.notes.shift(); }   // messages mis en avant sur la table
const cardsText = cards => {
  const c = {}; cards.forEach(x => { c[x.bean] = (c[x.bean] || 0) + 1; });
  return Object.keys(c).map(b => (c[b] > 1 ? c[b] + ' ' : '1 ') + BEANS[b].full).join(' + ') || 'rien';
};

/* ---------- champs et récolte ---------- */
function fieldOK(p, k, bean) { const f = p.fields[k]; return !!f && (f.bean === null || f.bean === bean); }
function plantIn(p, k, card) { const f = p.fields[k]; f.bean = card.bean; f.cards.push(card); }
function canHarvest(p, k) {
  const f = p.fields[k];
  if (!f || !f.cards.length) return false;
  if (f.cards.length >= 2) return true;
  return !p.fields.some(x => x.cards.length >= 2);   // un champ d'1 seule carte : seulement si aucun autre n'a 2+
}
function harvest(p, k) {
  const f = p.fields[k], bean = f.bean, cards = f.cards, n = cards.length, c = coinsFor(bean, n);
  f.cards = []; f.bean = null;
  p.coins.push(...cards.slice(0, c));
  S.discard.push(...cards.slice(c));
  return { bean, n, c };
}
function canBuy(p) { return !S.cfg.fixedThree && p.fields.length === 2 && p.coins.length >= S.cfg.cost; }

/* ---------- pioche ---------- */
function drawOne() {
  if (!S.deck.length) return null;
  const c = S.deck.pop();
  if (!S.deck.length) {                       // pioche épuisée
    S.exhaust++;
    if (S.exhaust >= S.cfg.limit) { S.endFlag = true; log(`⏳ La pioche est épuisée pour la ${S.exhaust}e fois : dernière ligne droite !`); }
    else if (S.discard.length) { S.deck = shuffle(S.discard); S.discard = []; log('🔀 La pioche est épuisée : la défausse est remélangée.'); }
  }
  return c;
}

/* ---------- déroulé d'un tour ---------- */
function startGame() {
  const n = S.players.length;
  S.cfg = makeCfg(n); MODEL.SCALE = MODEL.SCALES[n];
  S.deck = buildDeck(S.cfg); S.discard = []; S.exhaust = 0; S.endFlag = false; S.faceUp = []; S.offers = []; S.result = null; S.log = [];
  S.players.forEach(p => {
    p.hand = []; p.coins = []; p.toPlant = [];
    p.fields = Array.from({ length: S.cfg.fixedThree ? 3 : 2 }, () => ({ bean: null, cards: [] }));
  });
  S.dealer = Math.floor(Math.random() * n);
  const starter = (S.dealer + 1) % n;
  for (let k = 0; k < n; k++) {
    const i = (starter + k) % n;
    const cnt = n >= 6 ? (k === 0 ? 3 : k === 1 ? 4 : k === 2 ? 5 : 6) : 5;   // variante 6 à 8 joueurs (paquet de 144 cartes, sans cacao ni jardin)
    for (let c = 0; c < cnt; c++) S.players[i].hand.push(S.deck.pop());
  }
  S.phase = 'playing'; S.turn = starter;
  log(`La partie commence à ${n} joueurs (${S.deck.length} cartes dans la pioche).`);
  startTurn();
}
function startTurn() {
  const p = S.players[S.turn];
  S.faceUp = []; S.offers = []; S.notes = []; S.step = 'plant1';
  log(`— Tour de ${p.name} —`);
  if (!p.hand.length) enterTrade();
}
function enterTrade() {
  S.step = 'trade'; S.offers = []; S.faceUp = [];
  for (let k = 0; k < 2; k++) { const c = drawOne(); if (c) S.faceUp.push(c); if (S.endFlag) break; }
  log(`${S.players[S.turn].name} retourne : ${cardsText(S.faceUp)}.`);
  S.ready = []; S.botMade = []; S.fails = 0;
}
function endTrade() {
  const A = S.players[S.turn];
  A.toPlant.push(...S.faceUp); S.faceUp = []; S.offers = [];
  S.step = 'plant3';
  log('Les échanges sont terminés : chacun plante ses cartes.');
  checkPlant3();
}
function checkPlant3() { if (S.players.every(p => !p.toPlant.length)) finishTurn(); }
function finishTurn() {
  const A = S.players[S.turn];
  if (S.endFlag) { finalize(); return; }
  let drawn = 0;
  for (let k = 0; k < S.cfg.drawN; k++) { const c = drawOne(); if (c) { A.hand.push(c); drawn++; } if (S.endFlag) break; }
  if (S.endFlag || (!S.deck.length && !S.discard.length)) { finalize(); return; }
  S.turn = (S.turn + 1) % S.players.length;
  startTurn();
}
function finalize() {
  log('🏁 Fin de partie : tout le monde récolte ses champs.');
  S.players.forEach(p => {
    p.fields.forEach((f, k) => {
      if (f.cards.length) { const r = harvest(p, k); log(`${p.name} récolte ${plural(r.n, BEANS[r.bean].full)} → ${plural(r.c, 'pièce')}.`); }
    });
  });
  const rows = S.players.map(p => ({ name: p.name, coins: p.coins.length, hand: p.hand.length }));
  rows.sort((a, b) => b.coins - a.coins || b.hand - a.hand);
  const top = rows[0];
  S.result = { rows, winners: rows.filter(r => r.coins === top.coins && r.hand === top.hand).map(r => r.name),
               tieBreak: rows.filter(r => r.coins === top.coins).length > 1 };
  S.phase = 'over'; S.step = ''; S.offers = []; S.faceUp = [];
}
function resetToLobby() {
  S.phase = 'lobby'; S.step = ''; S.deck = []; S.discard = []; S.faceUp = []; S.offers = []; S.result = null; S.log = [];
  S.players.forEach(p => { p.hand = []; p.fields = []; p.coins = []; p.toPlant = []; });
}

/* ---------- échanges ---------- */
function offerGiveOK(o) {
  const giver = S.players[o.from];
  return o.give.every(u => giver.hand.some(c => c.uid === u) || (o.from === S.turn && S.faceUp.some(c => c.uid === u))) &&
         o.wantTable.every(u => S.faceUp.some(c => c.uid === u));
}
function createOffer(i, m) {
  if (S.phase !== 'playing' || S.step !== 'trade') return false;
  const A = S.turn, p = S.players[i], isA = i === A;
  let to = A;
  if (isA) { to = Number.isInteger(m.to) ? m.to : -1; if (to !== -1 && (to === A || !S.players[to])) return false; }
  const give = Array.isArray(m.give) ? [...new Set(m.give.filter(Number.isInteger))].slice(0, 12) : [];
  if (!give.length) return false;
  for (const u of give) if (!p.hand.some(c => c.uid === u) && !(isA && S.faceUp.some(c => c.uid === u))) return false;
  const wantTypes = []; let total = 0;
  for (const w of (Array.isArray(m.wantTypes) ? m.wantTypes : [])) {
    if (!w || !BEANS[w.bean] || !S.cfg.beans.includes(w.bean) || !Number.isInteger(w.n) || w.n < 1 || w.n > 12) continue;
    const ex = wantTypes.find(x => x.bean === w.bean);
    if (ex) ex.n += w.n; else wantTypes.push({ bean: w.bean, n: w.n });
    total += w.n;
  }
  const wantTable = isA ? [] : [...new Set((Array.isArray(m.wantTable) ? m.wantTable : []).filter(Number.isInteger))].filter(u => S.faceUp.some(c => c.uid === u));
  if (total + wantTable.length > 12) return false;
  if (S.offers.filter(o => o.from === i).length >= 4) return false;
  const o = { id: ++offerSeq, from: i, to, give, wantTypes, wantTable };
  S.offers.push(o);
  log(`${p.name} propose un échange à ${to === -1 ? 'tout le monde' : S.players[to].name}.`);
  S.ready = S.ready.filter(x => x !== i);       // il négocie à nouveau : le robot doit l'attendre
  return true;
}
function acceptOffer(i, id, why) {
  if (S.phase !== 'playing' || S.step !== 'trade') return false;
  const o = S.offers.find(x => x.id === id);
  if (!o || i === o.from) return false;
  const A = S.turn, acc = S.players[i], giver = S.players[o.from];
  if (o.to >= 0) { if (i !== o.to) return false; } else if (i === A || o.from !== A) return false;
  if (!offerGiveOK(o)) { S.offers = S.offers.filter(x => x !== o); return true; }
  const cnt = {}; acc.hand.forEach(c => { cnt[c.bean] = (cnt[c.bean] || 0) + 1; });
  if (o.wantTypes.some(w => (cnt[w.bean] || 0) < w.n)) { note(`${acc.name} n'a pas les cartes demandées.`); return true; }
  const given = [];
  for (const u of o.give) {
    let k = giver.hand.findIndex(c => c.uid === u);
    if (k >= 0) given.push(giver.hand.splice(k, 1)[0]);
    else { k = S.faceUp.findIndex(c => c.uid === u); given.push(S.faceUp.splice(k, 1)[0]); }
  }
  const back = [];
  for (const w of o.wantTypes) for (let r = 0; r < w.n; r++) {       // cartes prises en fin de main
    let k = -1; for (let z = acc.hand.length - 1; z >= 0; z--) if (acc.hand[z].bean === w.bean) { k = z; break; }
    back.push(acc.hand.splice(k, 1)[0]);
  }
  for (const u of o.wantTable) { const k = S.faceUp.findIndex(c => c.uid === u); back.push(S.faceUp.splice(k, 1)[0]); }
  acc.toPlant.push(...given); giver.toPlant.push(...back);
  if (why) note(`🤖 ${acc.name} accepte — ${why}`);
  note(back.length
    ? `🤝 ${giver.name} donne ${cardsText(given)} à ${acc.name} contre ${cardsText(back)}.`
    : `🎁 ${giver.name} donne ${cardsText(given)} à ${acc.name}.`);
  S.offers = S.offers.filter(x => x !== o && offerGiveOK(x));
  return true;
}

/* ---------- actions des joueurs ---------- */
function act(i, m) {
  const p = S.players[i];
  if (!p || !m || typeof m !== 'object') return;
  const playing = S.phase === 'playing';
  const mine = playing && i === S.turn;
  switch (m.t) {
    case 'start':
      if (i !== 0 || S.phase !== 'lobby' || S.players.length < MIN_PLAYERS) return;
      startGame(); break;
    case 'again':
      if (S.phase !== 'over' || p.bot) return;
      resetToLobby(); break;
    case 'addBot': {
      if (i !== 0 || S.phase !== 'lobby' || S.players.length >= MAX_PLAYERS) return;
      const name = BOT_NAMES.find(n => !S.players.some(x => x.name === n)) || 'Bot' + S.players.length;
      S.players.push(newPlayer(name, true)); break;
    }
    case 'rmPlayer': {
      const k = m.idx;
      if (i !== 0 || S.phase !== 'lobby' || !Number.isInteger(k) || !S.players[k] || !S.players[k].bot) return;
      S.players.splice(k, 1); break;
    }
    case 'harvest': {
      if (!playing || !Number.isInteger(m.field) || !canHarvest(p, m.field)) return;
      const r = harvest(p, m.field);
      log(`${p.name} récolte ${plural(r.n, BEANS[r.bean].full)} → ${plural(r.c, 'pièce')}.`); break;
    }
    case 'buyField':
      if (!playing || !canBuy(p)) return;
      S.discard.push(...p.coins.splice(-S.cfg.cost));
      p.fields.push({ bean: null, cards: [] });
      log(`${p.name} achète un 3e champ (${plural(S.cfg.cost, 'pièce')}).`); break;
    case 'plant': {
      if (!mine || (S.step !== 'plant1' && S.step !== 'plant2') || !p.hand.length) return;
      const c = p.hand[0];
      if (!Number.isInteger(m.field) || !fieldOK(p, m.field, c.bean)) return;
      p.hand.shift(); plantIn(p, m.field, c);
      log(`${p.name} plante 1 ${BEANS[c.bean].full}.`);
      if (S.step === 'plant1' && p.hand.length) S.step = 'plant2'; else enterTrade();
      break;
    }
    case 'skip':
      if (!mine || S.step !== 'plant2') return;
      enterTrade(); break;
    case 'plant3': {
      if (!playing || S.step !== 'plant3') return;
      const k = p.toPlant.findIndex(c => c.uid === m.uid);
      if (k < 0 || !Number.isInteger(m.field) || !fieldOK(p, m.field, p.toPlant[k].bean)) return;
      const c = p.toPlant.splice(k, 1)[0]; plantIn(p, m.field, c);
      log(`${p.name} plante 1 ${BEANS[c.bean].full}.`);
      checkPlant3(); break;
    }
    case 'offer':
      if (p.bot && playing && Array.isArray(m.give)) S.botMade.push(...m.give);   // un robot ne retente pas la même offre
      if (!createOffer(i, m) && !p.bot) return;
      break;
    case 'accept':
      if (!acceptOffer(i, m.id, p.bot ? String(m.why || '').slice(0, 200) : '')) return; break;
    case 'decline': {
      const o = S.offers.find(x => x.id === m.id);
      if (!playing || !o || o.to !== i) return;
      S.offers = S.offers.filter(x => x !== o);
      note(p.bot ? `🤖 ${p.name} refuse l'offre de ${S.players[o.from].name} — ${String(m.why || '').slice(0, 200)}`
                 : `${p.name} refuse l'offre de ${S.players[o.from].name}.`);
      break;
    }
    case 'pass': {                                   // un robot examine une offre ouverte et n'en veut pas
      const o = S.offers.find(x => x.id === m.id);
      if (!playing || !p.bot || !o || o.to !== -1) return;
      o.botsDone = true;
      note(`🤖 ${p.name} n'est pas intéressé par l'offre de ${S.players[o.from].name} — ${String(m.why || '').slice(0, 200)}`); break;
    }
    case 'ready':                                    // « pas d'échange » quand un robot est le joueur actif
      if (!playing || S.step !== 'trade' || p.bot || i === S.turn) return;
      if (!S.ready.includes(i)) S.ready.push(i); break;
    case 'withdraw': {
      const o = S.offers.find(x => x.id === m.id);
      if (!playing || !o || o.from !== i) return;
      S.offers = S.offers.filter(x => x !== o); break;
    }
    case 'endTrade':
      if (!mine || S.step !== 'trade') return;
      endTrade(); break;
    default: return;
  }
  S.rev++;
  pump();
}

/* ============================================================================================
   MODÈLE STATISTIQUE DE VALEUR (unité : la pièce)
   --------------------------------------------------------------------------------------------
   Ce qui rend une carte précieuse, c'est la façon dont elle fait progresser un champ sur le tableau de
   gains (« beanometer ») et la probabilité de réunir assez de cartes de la même variété.

   Pour une variété b (n_b exemplaires) :
     • X = nombre de cartes b qui arriveront dans le champ pendant sa vie, X ~ Poisson(λ_b),
       avec  λ_b = SCALE × (exemplaires de b encore invisibles) / (exemplaires invisibles, toutes variétés).
       SCALE ≈ cartes plantées par tour × durée de vie d'un champ (calibré par simulation, cf. modele_valeurs.md).
     • Un champ qui contient déjà k cartes rapportera en moyenne  E[c(k + X)]  pièces, c(·) = tableau de gains.
     • Valeur marginale de la (k+1)e carte :  m(b,k) = E[c(k+1+X)] − E[c(k+X)].
     • « Valeur de marché » d'une carte (indépendante des champs de chacun) :  M_b = m(b, 0).
   Les cartes rares (jardin, cacao, rouge…) ont un M_b élevé ; les cartes abondantes (café, cire, bleu) un M_b faible.

   Un échange est ÉQUITABLE si la valeur de marché reçue est proche de la valeur cédée :
        FAIR_MIN ≤ V_reçue / V_cédée   (et symétriquement V_demandée / V_donnée ≤ FAIR_MAX pour celui qui demande).
   Il est ACCEPTABLE pour un robot s'il est équitable ET s'il l'avantage personnellement (Δ position ≥ 0),
   la position étant : pièces + Σ E[c(champ)] + valeur des champs libres − encombrement de la main.
   Ainsi un échange n'est conclu que s'il est bon pour les deux parties, pas seulement pour le robot.
   ============================================================================================ */
const MODEL = { SCALE: 6.2, HANDW: 0.8, SLOT: 0.3, BURDEN_FULL: 0.25, BURDEN_FREE: 0.05, FAIR_MIN: 0.6, FAIR_MAX: 1 / 0.6,
                SCALES: { 3: 8.4, 4: 6.2, 5: 6.5, 6: 6.9, 7: 7.4, 8: 7.0 },   // calibré par point fixe : robots qui négocient entre eux (cf. modele_valeurs.md ; 8 = extension maison)
                BOT_VS_BOT: false };   // true : les robots négocient aussi entre eux (utilisé pour calibrer le modèle par simulation)
const fmt = x => { const r = Math.round(x * 100) / 100; return String(r === 0 ? 0 : r).replace('.', ',').replace('-', '−'); };
const pts = x => Math.round(x * 100) + ' pts';        // valeur de marché affichée en points (100 pts = 1 pièce)

function poisson(l) { const p = [Math.exp(-l)]; for (let x = 1; x <= 36; x++) p.push(p[x - 1] * l / x); return p; }
function lambdaOf(avail, bean) {
  let tot = 0; for (const b in avail) tot += avail[b];
  return tot > 0 ? MODEL.SCALE * (avail[bean] || 0) / tot : 0;
}
/* E[c(base + X)], X ~ Poisson(lam) ; base fractionnaire admis (interpolation entre deux entiers) */
function expCoins(bean, base, lam) {
  const lo = Math.floor(base), fr = base - lo, pm = poisson(lam);
  let a = 0, b = 0;
  for (let x = 0; x < pm.length; x++) { a += pm[x] * coinsFor(bean, lo + x); b += pm[x] * coinsFor(bean, lo + 1 + x); }
  return a * (1 - fr) + b * fr;
}
const marginalVal = (bean, base, lam) => expCoins(bean, base + 1, lam) - expCoins(bean, base, lam);
const marketVal = (bean, avail) => marginalVal(bean, 0, lambdaOf(avail, bean));

/* exemplaires encore invisibles pour ce joueur (pub = true : on ignore sa main, que l'observateur ne connaît pas) */
function unseenFor(p, pub) {
  const a = {};
  S.cfg.beans.forEach(b => {
    let n = S.discard.filter(c => c.bean === b).length + S.faceUp.filter(c => c.bean === b).length;
    if (!pub) n += p.hand.filter(c => c.bean === b).length;
    S.players.forEach(q => q.fields.forEach(f => { if (f.bean === b) n += f.cards.length; }));
    a[b] = Math.max(0, BEANS[b].n - n);
  });
  return a;
}
function simOf(p, pub) {
  const hand = {};
  if (!pub) p.hand.forEach(c => { hand[c.bean] = (hand[c.bean] || 0) + 1; });
  return { fields: p.fields.map(f => ({ bean: f.bean, count: f.cards.length })), coins: p.coins.length, cost: S.cfg.cost,
           canBuy: !S.cfg.fixedThree && p.fields.length === 2, hand, avail: unseenFor(p, pub) };
}
const cloneSim = s => ({ fields: s.fields.map(f => ({ ...f })), coins: s.coins, cost: s.cost, canBuy: s.canBuy, hand: { ...s.hand }, avail: s.avail });
/* valeur d'une position : pièces + espérance des champs + champs libres − cartes de main qui ne trouveront pas de place */
function simTotal(s) {
  let v = s.coins, empty = 0;
  s.fields.forEach(f => {
    if (!f.count) { empty++; return; }
    v += expCoins(f.bean, f.count + MODEL.HANDW * (s.hand[f.bean] || 0), lambdaOf(s.avail, f.bean));
  });
  v += MODEL.SLOT * empty;
  for (const b in s.hand) if (!s.fields.some(f => f.bean === b && f.count)) v -= s.hand[b] * (empty ? MODEL.BURDEN_FREE : MODEL.BURDEN_FULL);
  return v;
}
function simCanHarvest(s, k) { const f = s.fields[k]; return f.count > 0 && (f.count >= 2 || !s.fields.some(x => x.count >= 2)); }
/* pour planter b alors qu'aucun champ ne convient : acheter le 3e champ ou récolter un champ (options simulées) */
function freeUpOptions(s, b) {
  const opts = [];
  if (s.canBuy && s.coins >= s.cost) { const u = cloneSim(s); u.coins -= u.cost; u.canBuy = false; u.fields.push({ bean: b, count: 1 }); opts.push({ u, m: { t: 'buyField' } }); }
  s.fields.forEach((f, j) => {
    if (!simCanHarvest(s, j)) return;
    const u = cloneSim(s); u.coins += coinsFor(f.bean, f.count); u.fields[j] = { bean: b, count: 1 };
    opts.push({ u, m: { t: 'harvest', field: j } });
  });
  return opts.sort((x, y) => simTotal(y.u) - simTotal(x.u));
}
/* Plante un LOT de cartes en cherchant la MEILLEURE façon de le faire, plutôt qu'un choix glouton
   carte par carte : quand planter une carte force une récolte, le choix du champ sacrifié doit tenir
   compte des cartes ENCORE à planter dans le même lot (sinon on peut récolter un champ presque abouti
   pour une carte, puis regretter ce choix à la carte suivante). Les lots sont petits (2-3 cartes, 2-3
   champs), une recherche exhaustive de toutes les façons de placer le lot est donc largement praticable.
   Planter une carte dans un champ existant de la même variété est toujours optimal ou neutre (la valeur
   espérée d'un champ ne peut que croître avec son nombre de cartes) : ce choix n'est donc jamais discuté,
   seul le sort des cartes SANS champ correspondant fait l'objet d'une recherche. */
function plantOneForced(s, b) {
  const opts = [];
  s.fields.forEach((f, j) => { if (!f.count) opts.push({ ...cloneSim(s), fields: s.fields.map((x, y) => y === j ? { bean: b, count: 1 } : x) }); });
  if (s.canBuy && s.coins >= s.cost) { const u = cloneSim(s); u.coins -= u.cost; u.canBuy = false; u.fields.push({ bean: b, count: 1 }); opts.push(u); }
  s.fields.forEach((f, j) => { if (simCanHarvest(s, j)) { const u = cloneSim(s); u.coins += coinsFor(f.bean, f.count); u.fields[j] = { bean: b, count: 1 }; opts.push(u); } });
  return opts;
}
function plantBatch(s, beans) {
  if (!beans.length) return s;
  const b = beans[0], rest = beans.slice(1);
  const k = s.fields.findIndex(f => f.bean === b && f.count > 0);
  if (k >= 0) { const u = cloneSim(s); u.fields[k] = { ...u.fields[k], count: u.fields[k].count + 1 }; return plantBatch(u, rest); }
  const opts = plantOneForced(s, b);
  if (!opts.length) return s;                                    // aucune place : la carte reste hypothétiquement non plantée
  let best = null, bv = -Infinity;
  for (const u of opts) { const r = plantBatch(u, rest); const v = simTotal(r); if (v > bv) { bv = v; best = r; } }
  return best;
}
const PLANT_CAP = 6;                                              // au-delà, la recherche exhaustive des permutations devient coûteuse
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => { const rest = arr.slice(0, i).concat(arr.slice(i + 1)); permutations(rest).forEach(p => out.push([x, ...p])); });
  return out;
}
function plantSim(s0, beans) {
  if (!beans.length) return cloneSim(s0);
  if (beans.length > PLANT_CAP) {                                 // repli glouton, cas extrême seulement
    let s = cloneSim(s0);
    for (const b of beans) s = plantBatch(s, [b]);
    return s;
  }
  let best = null, bv = -Infinity;
  for (const order of permutations(beans)) {
    const r = plantBatch(s0, order); const v = simTotal(r);
    if (v > bv) { bv = v; best = r; }
  }
  return best;
}
const simGain = (s, beans) => beans.length ? simTotal(plantSim(s, beans)) - simTotal(s) : 0;
/* ce que coûte, à celui qui donne, une carte de main de variété b (progrès perdu dans son champ) */
function giveCost(s, b) {
  const f = s.fields.find(x => x.bean === b && x.count);
  return f ? MODEL.HANDW * marginalVal(b, f.count, lambdaOf(s.avail, b)) : 0;
}

/* Jugement d'un robot sur une offre : { ok, delta, rho, why } */
function evalOffer(k, o) {
  const p = S.players[k], giver = S.players[o.from], A = S.turn;
  if (!offerGiveOK(o)) return { ok: false, delta: -9, why: "l'offre n'est plus valable" };
  const R = o.give.map(u => (giver.hand.find(c => c.uid === u) || S.faceUp.find(c => c.uid === u)).bean);
  const cnt = {}; p.hand.forEach(c => { cnt[c.bean] = (cnt[c.bean] || 0) + 1; });
  for (const w of o.wantTypes) if ((cnt[w.bean] || 0) < w.n) return { ok: false, delta: -9, why: "il n'a pas les cartes demandées" };
  const Gh = []; o.wantTypes.forEach(w => { for (let r = 0; r < w.n; r++) Gh.push(w.bean); });
  const Gt = o.wantTable.map(u => S.faceUp.find(c => c.uid === u).bean);
  const sim = simOf(p), av = sim.avail;
  // référence = ne rien faire (un robot actif planterait ses cartes retournées) ; scénario = après l'échange
  const face = k === A ? S.faceUp.map(c => c.bean) : [];
  const base = simTotal(plantSim(sim, face));
  const s2 = cloneSim(sim); Gh.forEach(b => { s2.hand[b] = Math.max(0, (s2.hand[b] || 0) - 1); });
  const kept = face.slice(); Gt.forEach(b => { const i = kept.indexOf(b); if (i >= 0) kept.splice(i, 1); });
  const delta = simTotal(plantSim(s2, kept.concat(R))) - base;                 // avantage personnel du robot
  const gives = Gh.concat(Gt);
  if (!gives.length) {                                                          // cadeau : jamais d'équité à juger, seulement l'embarras
    const forces = R.some(b => !sim.fields.some(f => f.bean === b && f.count) && !sim.fields.some(f => !f.count));   // aucun champ ne convient
    const ok = delta >= (forces ? -0.05 : -0.15);
    return { ok, delta, why: ok ? (delta >= 0 ? `cadeau bienvenu (avantage estimé ≈ +${fmt(delta)} pièce)` : `cadeau accepté (carte sans grand intérêt, coût ≈ ${fmt(-delta)} pièce)`)
      : forces ? `ce cadeau l'embarrasserait : il devrait sacrifier un champ (≈ ${fmt(delta)})` : `cette carte ne lui sert pas assez (≈ ${fmt(delta)})` };
  }
  const Vin = R.reduce((a, b) => a + marketVal(b, av), 0), Vout = gives.reduce((a, b) => a + marketVal(b, av), 0);
  const rho = Vout > 0 ? Vin / Vout : 9;
  const info = `valeur de marché reçue ≈ ${pts(Vin)} contre ${pts(Vout)} cédée (×${fmt(rho)})`;
  // Seul delta (l'avantage réel simulé sur sa position, y compris la concentration de sa main sur un
  // champ) décide. Le ratio de marché n'est qu'une indication affichée : une carte « chère » en moyenne
  // peut valoir peu pour CE robot précis (ex. variété qu'il ne cultive pas), et inversement une carte
  // « bon marché » peut compléter exactement le champ qu'il concentre. Bloquer sur le ratio l'empêchait
  // d'accepter des échanges avantageux à long terme.
  if (delta < -0.05) return { ok: false, delta, rho, why: `${info}, mais l'échange ne l'avantage pas (≈ ${fmt(delta)} pour sa position)` };
  const tag = rho < MODEL.FAIR_MIN ? 'avantageux pour sa stratégie malgré une valeur de marché plus faible (il concentre sa main)'
    : rho > MODEL.FAIR_MAX ? 'offre généreuse' : 'échange équitable';
  return { ok: true, delta, rho, why: `${info}, avantage pour lui ≈ +${fmt(delta)} → ${tag}` };
}

/* ---------- robots : plantation, récolte ---------- */
function firstPlantable(p, bean) {
  let k = p.fields.findIndex(f => f.bean === bean);
  if (k < 0) k = p.fields.findIndex(f => f.bean === null);
  return k;
}
function plantMove(p, card, t, extra) {
  const k = firstPlantable(p, card.bean);
  if (k >= 0) return Object.assign({ t, field: k }, extra);
  const o = freeUpOptions(simOf(p), card.bean);       // acheter ou récolter : l'option qui laisse la meilleure position
  return o.length ? o[0].m : { t: 'harvest', field: p.fields.findIndex((f, j) => canHarvest(p, j)) };
}
function botMove(i) {
  const p = S.players[i];
  if (S.step === 'plant3' && p.toPlant.length) return plantMove(p, p.toPlant[0], 'plant3', { uid: p.toPlant[0].uid });
  if (i !== S.turn) return null;
  if (S.step === 'plant1') return plantMove(p, p.hand[0], 'plant', {});
  if (S.step === 'plant2') {
    const k = p.fields.findIndex(f => f.bean === p.hand[0].bean);
    return k >= 0 ? { t: 'plant', field: k } : { t: 'skip' };
  }
  if (S.step === 'trade') return { t: 'endTrade' };
  return null;
}

/* ---------- robots : propositions d'échange équitables (gagnant-gagnant) ----------
   Pour chaque carte retournée dont le robot n'a pas l'usage, il cherche (variété w, quantité n) telle que :
     1) il demande autant ou un peu MOINS de valeur de marché qu'il n'en donne (FAIR_MIN ≤ ratio ≤ 1) ;
     2) w lui rapporte réellement quelque chose (avantage personnel ≥ 0,05) ;
     3) au moins un humain y gagne aussi (sa carte reçue lui est utile, d'après ses champs visibles).
   Parmi les candidats, il retient celui qui maximise le surplus commun. À défaut, s'il s'agit d'une carte
   qui l'encombrerait, il l'offre en cadeau ; sinon il la garde. */
function botOffersWanted(A) {
  const bot = S.players[A], sim = simOf(bot), av = sim.avail;
  const hsims = S.players.map((q, k) => k).filter(k => k !== A && (!S.players[k].bot || MODEL.BOT_VS_BOT) && S.players[k].connected)
                         .map(k => simOf(S.players[k], true));
  const faceBeans = S.faceUp.map(c => c.bean), out = [];
  const base = simTotal(plantSim(sim, faceBeans));
  S.faceUp.forEach(c => {
    const keepGain = simGain(sim, [c.bean]);
    if (keepGain >= 0.2) return;                                              // elle lui est utile : il la garde
    const Mc = marketVal(c.bean, av), rest = faceBeans.slice(); rest.splice(rest.indexOf(c.bean), 1);
    let best = null;
    if (Mc > 0.01) for (const w of S.cfg.beans) {
      if (w === c.bean) continue;
      const Mw = marketVal(w, av);
      for (let n = 1; n <= 3; n++) {
        const ratio = n * Mw / Mc;
        if (ratio < MODEL.FAIR_MIN || ratio > 1.0) continue;
        const mine = simTotal(plantSim(sim, rest.concat(Array(n).fill(w)))) - base;
        if (mine < 0.05) continue;
        let theirs = -1;
        hsims.forEach(hs => { const q = simGain(hs, [c.bean]) - n * giveCost(hs, w); if (q > theirs) theirs = q; });
        if (theirs < 0.05) continue;
        if (!best || mine + theirs > best.surplus) best = { w, n, surplus: mine + theirs };
      }
    }
    if (best) out.push({ t: 'offer', to: -1, give: [c.uid], wantTypes: [{ bean: best.w, n: best.n }], wantTable: [] });
    else if (keepGain < -0.05) out.push({ t: 'offer', to: -1, give: [c.uid], wantTypes: [], wantTable: [] });
  });
  return out;
}
/* Un robot doit-il répondre à une offre faite par un humain ? */
function botAnswerPlan() {
  const A = S.turn;
  for (const o of S.offers) {
    if (S.players[o.from].bot && !MODEL.BOT_VS_BOT) continue;
    const cands = [];
    if (o.to >= 0) { if (S.players[o.to].bot) cands.push(o.to); }
    else if (!o.botsDone) S.players.forEach((q, k) => { if (q.bot && k !== A && k !== o.from) cands.push(k); });
    if (!cands.length) continue;
    const evs = cands.map(k => ({ k, e: evalOffer(k, o) })).sort((a, b) => b.e.delta - a.e.delta);
    const good = evs.find(x => x.e.ok);
    if (good) return { i: good.k, m: { t: 'accept', id: o.id, why: good.e.why }, delay: 1.4 };
    const b = evs[0];
    return { i: b.k, m: { t: o.to >= 0 ? 'decline' : 'pass', id: o.id, why: b.e.why }, delay: 1.4 };
  }
  return null;
}
/* Robot actif pendant la phase d'échanges : propose, puis attend (sans limite de temps) que chaque humain ait fini */
function botTradePlan(A) {
  const humans = S.players.filter((q, k) => k !== A && !q.bot && q.connected);
  const partners = S.players.filter((q, k) => k !== A && q.connected && (!q.bot || MODEL.BOT_VS_BOT));
  if (!partners.length) return { i: A, m: { t: 'endTrade' }, delay: 0.9 };
  const todo = botOffersWanted(A).filter(w => !S.botMade.includes(w.give[0]));
  if (todo.length) return { i: A, m: todo[0], delay: 1.0 };
  if (!humans.length) return { i: A, m: { t: 'endTrade' }, delay: 0.9 };
  const allReady = S.players.every((q, k) => k === A || q.bot || !q.connected || S.ready.includes(k));
  if (allReady) return { i: A, m: { t: 'endTrade' }, delay: 0.4 };
  return { wait: true };                          // aucune minuterie : on attend le clic « Pas (plus) d'échange »
}
/* Prochaine action automatique (robot ou joueur déconnecté), ou null. delay en secondes. */
function autoPlan() {
  if (!S || S.phase !== 'playing') return null;
  if (S.step === 'plant3') {
    for (let i = 0; i < S.players.length; i++) {
      const q = S.players[i];
      if (q.toPlant.length && (q.bot || !q.connected)) return { i, m: botMove(i), delay: q.bot ? 0.9 : 15 };
    }
    return null;
  }
  const A = S.turn, a = S.players[A];
  if (S.step === 'trade') {
    const r = botAnswerPlan(); if (r) return r;
    if (a.bot) return botTradePlan(A);
    return a.connected ? null : { i: A, m: { t: 'endTrade' }, delay: 15 };
  }
  return (a.bot || !a.connected) ? { i: A, m: botMove(A), delay: a.bot ? 0.9 : 15 } : null;
}
function autoStep() {
  const pl = autoPlan();
  if (!pl) return;
  if (pl.wait) return;
  const r0 = S.rev;
  act(pl.i, pl.m);
  if (S.rev === r0) {                              // garde-fou : action refusée, on ne boucle pas indéfiniment
    S.fails++;
    if (S.fails >= 3 && S.phase === 'playing' && S.step === 'trade') { S.fails = 0; S.offers = []; endTrade(); S.rev++; pump(); }
    else scheduleAuto();
  } else S.fails = 0;
}
/*ENGINE-END*/
