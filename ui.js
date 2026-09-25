// Interface : rendu HTML, illustrations des haricots, écouteurs d'évènements.
// Dépend de engine.js et network.js (G, ME, send, act, BEANS, ...).
/* ============ ILLUSTRATIONS (haricots dessinés en SVG) ============ */
const BEAN_UI = {
  cafe:   { c: '#8a5a3b', ink: '#fff', body: '#8a5a3b', extra: '<path d="M17 14C33 24 35 42 24 58" stroke="#5a3420" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>' },
  cire:   { c: '#e8c22a', ink: '#3a2c00', body: '#f6d94f', extra: '<ellipse cx="46" cy="44" rx="4" ry="8" fill="#fff" opacity=".28" transform="rotate(20 46 44)"/>' },
  bleu:   { c: '#3f74d6', ink: '#fff', body: '#5b8ee8', extra: '<path d="M18 26q3-4 7 0M37 24q3-4 7 0" stroke="#1d3f86" stroke-width="2" fill="none"/>' },
  piment: { c: '#d63b25', ink: '#fff', body: '#ea4c33', extra: '<path d="M42 6q8-8 16-2q-5 8-13 9z" fill="#3f9b3d"/><path d="M55 32q2 12-6 20" stroke="#a52512" stroke-width="3" fill="none" opacity=".5"/>' },
  puant:  { c: '#8a962f', ink: '#fff', body: '#a9b647', extra: '<path d="M14 8q-5-3 0-6t0-6M28 6q-5-3 0-6t0-6M42 8q-5-3 0-6t0-6" stroke="#6fa83a" stroke-width="2.4" fill="none" stroke-linecap="round" transform="translate(0 6)"/><circle cx="20" cy="38" r="4" fill="#c86aa0" opacity=".55"/><circle cx="46" cy="36" r="4" fill="#c86aa0" opacity=".55"/>' },
  vert:   { c: '#3f9d4c', ink: '#fff', body: '#58bd66', extra: '<path d="M36 10q11-9 22-1-10 9-22 1z" fill="#2b7d38"/><path d="M38 10l16-2" stroke="#1d5c28" stroke-width="1.4"/>' },
  soja:   { c: '#c9b26c', ink: '#3a2c00', body: '#e6d29c', extra: '<circle cx="20" cy="44" r="1.6" fill="#b09a5e"/><circle cx="47" cy="47" r="1.6" fill="#b09a5e"/><circle cx="34" cy="52" r="1.6" fill="#b09a5e"/><circle cx="50" cy="22" r="1.6" fill="#b09a5e"/>' },
  oeil:   { c: '#b8a06a', ink: '#2b1d10', body: '#f3e8cb', extra: '<ellipse cx="25" cy="31" rx="9.5" ry="8.5" fill="#1d1d1d" transform="rotate(-12 25 31)"/>' },
  rouge:  { c: '#a01d36', ink: '#fff', body: '#bf2a45', extra: '<circle cx="18" cy="42" r="1.7" fill="#fff" opacity=".5"/><circle cx="48" cy="46" r="1.7" fill="#fff" opacity=".5"/><circle cx="32" cy="54" r="1.7" fill="#fff" opacity=".5"/>' },
  jardin: { c: '#d9679d', ink: '#3a0f26', body: '#f59cc4', extra: '<g transform="translate(48 13)"><circle cx="0" cy="-6" r="4.2" fill="#fff4a8"/><circle cx="6" cy="0" r="4.2" fill="#fff4a8"/><circle cx="0" cy="6" r="4.2" fill="#fff4a8"/><circle cx="-6" cy="0" r="4.2" fill="#fff4a8"/><circle r="3.4" fill="#f0a020"/></g>' },
  cacao:  { c: '#5a3423', ink: '#fff', body: '#6b3f2b', extra: '<path d="M32 8v52M20 12c-6 14-6 32 0 44M44 12c6 14 6 32 0 44" stroke="#3b2013" stroke-width="2.4" fill="none" opacity=".6"/>' }
};
function svgBean(b) {
  const u = BEAN_UI[b];
  return `<svg viewBox="0 0 64 70" aria-hidden="true"><g transform="translate(0 6)">
    <path d="M32 4C49 2 61 17 57 36 53 54 37 62 22 56 8 50 5 30 14 17 19 9 25 5 32 4Z" fill="${u.body}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    <ellipse cx="22" cy="17" rx="7" ry="3" fill="#fff" opacity=".33" transform="rotate(-25 22 17)"/>${u.extra}
    <circle cx="26" cy="31" r="4.3" fill="#fff"/><circle cx="40" cy="29" r="4.3" fill="#fff"/>
    <circle cx="27" cy="32" r="2.1" fill="#222"/><circle cx="41" cy="30" r="2.1" fill="#222"/>
    <path d="M27 42Q33 48 40 41" stroke="#3b2313" stroke-width="2.4" fill="none" stroke-linecap="round"/></g></svg>`;
}

/* ============ INTERFACE ============ */
const $ = s => document.querySelector(s);
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sel3 = null;          // carte sélectionnée dans « à planter »
let C = null;             // brouillon d'offre en cours
let lastRound = '';
const seen = new Set();

function readName() { const v = ($('#name').value || '').trim().slice(0, 16); if (v) localStorage.bzName = v; return v; }
function setErr(msg, info) { const e = $('#err'); if (e) { e.textContent = msg; e.style.color = info ? 'var(--muted)' : ''; } }

function cardHTML(b, cls = '', attrs = '', key = '') {
  const u = BEAN_UI[b], d = BEANS[b];
  let pop = '';
  if (key) { pop = seen.has(key) ? '' : ' pop'; seen.add(key); }
  return `<div class="bc ${cls}${pop}" style="--c:${u.c}" ${attrs}>
    <div class="bc-top"><span>${d.name}</span><em>${d.n}</em></div>
    <div class="bc-art">${svgBean(b)}</div>
    <div class="bm">${d.lv.map(([m, k]) => `<i><b>${m}</b><s>${k}</s></i>`).join('')}</div></div>`;
}
function chipHTML(b, n) {
  const u = BEAN_UI[b];
  return `<span class="chip" style="--c:${u.c};--ink:${u.ink}"><span class="chip-ic">${svgBean(b)}</span>${esc(BEANS[b].name)}${n > 1 ? ' ×' + n : ''}</span>`;
}
const countBy = arr => { const c = {}; arr.forEach(x => { c[x.bean] = (c[x.bean] || 0) + 1; }); return c; };
const priorAvail = g => { const a = {}; g.beans.forEach(b => { a[b] = BEANS[b].n; }); return a; };
const netBanner = () => netMsg ? `<div class="net" role="alert">${esc(netMsg)}</div>` : '';
const shareLink = () => location.href.split('?')[0].split('#')[0] + '?s=' + G.code;

function logoHTML() {
  const bs = ['rouge', 'cire', 'vert', 'bleu', 'puant'];
  return `<div class="logo"><div class="beans">${bs.map((b, i) => `<span style="--r:${(i - 2) * 9}deg">${svgBean(b)}</span>`).join('')}</div>
    <span class="disp">Bohnanza</span><small>Plante, échange, récolte : le jeu des haricots en ligne</small></div>`;
}
function homeHTML() {
  const code = (new URLSearchParams(location.search).get('s') || '').toUpperCase().slice(0, 5);
  return `<div class="home">${logoHTML()}
    <div class="panel"><label class="field-in">Ton prénom
      <input type="text" id="name" maxlength="16" autocomplete="off" value="${esc(localStorage.bzName || '')}" placeholder="Ex. Camille"></label></div>
    <div class="panel"><h2>Créer une session</h2>
      <p class="hint">Tu deviens l'hôte : tu reçois un code à partager avec 2 à 7 autres joueurs (les robots comptent).</p>
      <button class="btn go big" data-a="create">Créer la session</button></div>
    <div class="panel"><h2>Rejoindre une session</h2>
      <input type="text" id="code" class="code" maxlength="5" autocomplete="off" placeholder="CODE" value="${esc(code)}">
      <button class="btn sun big" data-a="join">Rejoindre</button></div>
    <div class="err" id="err" role="status"></div></div>`;
}

function lobbyHTML() {
  const g = G, host = g.you === 0;
  const n = g.players.length;
  const notes = n === 3 ? 'À 3 joueurs : 3 champs d\'office, sans les fèves de cacao, la partie s\'arrête à la 2e pioche épuisée.'
    : n <= 5 ? 'À 4 ou 5 joueurs : on retire les haricots café.'
    : 'À 6 à 8 joueurs : sans cacao ni haricots de jardin, mains de départ réduites, 4 cartes piochées par tour et 3e champ à 2 pièces. Au-delà de 7, c\'est une extension maison (le jeu officiel s\'arrête à 7) : parties plus rapides et scores plus serrés, faute de plus de cartes.';
  return `<div class="wrap">${netBanner()}<div class="lobby">
    <div class="top"><span class="sp"></span><button class="btn sm" data-a="leave">Quitter</button></div>
    <div class="panel codebox"><div class="hint">Code de la session</div><div class="codebig disp">${esc(g.code)}</div>
      <button class="btn sm" data-a="copy">Copier le lien d'invitation</button>
      <div class="hint" style="word-break:break-all">${esc(shareLink())}</div></div>
    <div class="panel"><h2>Joueurs (${n}/8)</h2>
      <div class="plist">${g.players.map((p, i) => `<div class="prow"><span>${p.bot ? '🤖' : p.host ? '👑' : '🧑‍🌾'}</span>
        <span>${esc(p.name)}${i === g.you ? ' <span class="tag">(toi)</span>' : ''}</span><span class="sp"></span>
        ${host && p.bot ? `<button class="btn sm" data-a="rm" data-i="${i}" aria-label="Retirer ${esc(p.name)}">Retirer</button>` : ''}</div>`).join('')}</div>
      ${host ? `<div class="actions"><button class="btn" data-a="addBot" ${n >= 8 ? 'disabled' : ''}>Ajouter un robot</button>
          <button class="btn go big" data-a="start" ${n < 3 ? 'disabled' : ''}>Lancer la partie</button></div>
        ${n < 3 ? '<p class="hint">Il faut au moins 3 joueurs (les robots comptent). Les robots négocient : ils évaluent chaque offre et expliquent leur réponse.</p>' : `<p class="hint">${notes}</p>`}
        <p class="hint">Garde cet onglet ouvert pendant toute la partie : c'est lui qui fait tourner le jeu.</p>`
      : '<p class="hint">En attente du lancement par l\'hôte…</p>'}</div>
    <details><summary>Rappel des règles</summary><ul>
      <li>Chaque champ ne contient qu'une variété de haricots. Tu n'as que 2 champs (un 3e coûte 3 pièces).</li>
      <li><b>Ton tour :</b> 1) plante la 1re carte de ta main (et si tu veux la 2e) ; 2) deux cartes sont retournées : garde-les, échange-les ou offre-les, comme des cartes de ta main ; 3) tout le monde plante ce qu'il a reçu ; 4) tu piochez 3 cartes, derrière ta main.</li>
      <li>L'ordre de ta main ne change jamais. Les échanges impliquent toujours le joueur actif.</li>
      <li>Tu peux récolter à tout moment : tout le champ part, et le tableau en bas de la carte donne les pièces. Un champ d'1 carte ne se récolte que si aucun autre champ n'a 2 cartes ou plus.</li>
      <li>La partie s'arrête quand la pioche est épuisée pour la 3e fois. Le plus de pièces gagne.</li></ul></details>
  </div></div>`;
}

/* ---- aides d'affichage ---- */
function harvestable(P, k) {
  const f = P.fields[k];
  if (!f || !f.count) return false;
  return f.count >= 2 || !P.fields.some(x => x.count >= 2);
}
function miniFields(P) {
  return P.fields.map(f => f.bean
    ? `<div class="mf"><div class="bc tiny" style="--c:${BEAN_UI[f.bean].c}"><div class="bc-top"><span>${BEANS[f.bean].name}</span></div><div class="bc-art">${svgBean(f.bean)}</div></div><span class="cnt">${f.count}</span></div>`
    : '<div class="mfe" title="Champ vide"></div>').join('');
}
function oppHTML(p, i) {
  const g = G, acting = g.phase === 'playing' && g.turn === i;
  return `<div class="opp${acting ? ' turn' : ''}"><div class="opp-h">
      <span class="nm">${p.bot ? '🤖 ' : p.host ? '👑 ' : ''}${esc(p.name)}</span><span class="sp"></span>
      <span class="coin" title="Pièces">${p.coins}</span><span class="pill" title="Cartes en main">✋ ${p.handN}</span></div>
    <div class="opp-f">${miniFields(p)}</div>
    <div class="row">${acting ? '<span class="pill turn">son tour</span>' : ''}
      ${p.toPlantN && g.step === 'plant3' ? `<span class="pill warn">doit planter ${p.toPlantN}</span>` : ''}
      ${!p.connected ? '<span class="pill warn">hors ligne</span>' : ''}</div></div>`;
}

function stepBanner() {
  const g = G, A = g.players[g.turn], isA = g.you === g.turn, P = g.players[g.you];
  const nm = esc(A.name);
  switch (g.step) {
    case 'plant1': return isA ? ['Plante ta première carte', 'Touche un champ libre ou de la même variété. Sinon, récolte un champ.'] : [`${nm} plante ses cartes`, ''];
    case 'plant2': return isA ? ['Planter la carte suivante ?', 'Tu peux planter aussi la 2e carte de ta main, ou passer.'] : [`${nm} plante ses cartes`, ''];
    case 'trade': {
      if (isA) return ['Échanges', 'Garde, échange ou offre les cartes retournées et celles de ta main. Termine quand tu as fini.'];
      if (A.bot) return [`${nm} attend vos propositions`, `Prends ton temps : propose un échange (le robot évalue ce qu'il y gagne). Quand tu as fini, clique « Pas (plus) d'échange ».`];
      return [`${nm} négocie`, 'Propose-lui un échange : tu peux donner des cartes de ta main ou demander une carte retournée.'];
    }
    case 'plant3': return P.toPlantN || g.toPlant.length ? ['Plante les cartes reçues', 'Choisis une carte dans « À planter », puis touche un champ.'] : ['En attente des autres joueurs…', ''];
  }
  return ['', ''];
}

function offerHTML(o) {
  const g = G, me = g.you, A = g.turn;
  const from = g.players[o.from], mineO = o.from === me;
  const toName = o.to === -1 ? 'tout le monde' : (o.to === me ? 'toi' : g.players[o.to].name);
  const giveC = countBy(o.give);
  const give = Object.keys(giveC).map(b => chipHTML(b, giveC[b])).join('') + (o.give.some(x => x.table) ? '<span class="tag">(dont retournée)</span>' : '');
  const want = [...o.wantTypes.map(w => chipHTML(w.bean, w.n)), ...o.wantTable.map(x => chipHTML(x.bean, 1) + '<span class="tag">(retournée)</span>')].join('');
  let btns = '';
  if (mineO) btns = `<button class="btn sm" data-a="withdraw" data-id="${o.id}">Retirer</button>`;
  else if (o.to === me) btns = `<button class="btn sm go" data-a="accept" data-id="${o.id}">Accepter</button><button class="btn sm" data-a="decline" data-id="${o.id}">Refuser</button>`;
  else if (o.to === -1 && me !== A) btns = `<button class="btn sm go" data-a="accept" data-id="${o.id}">Accepter</button>`;
  return `<div class="offer${mineO ? ' mine' : ''}"><div class="who">${mineO ? 'Tu proposes' : esc(from.name) + ' propose'} à ${esc(toName)}</div>
    <div class="chips">${give}</div><span class="arrow">${want ? '⇄' : '→ en cadeau'}</span><div class="chips">${want}</div><span class="sp"></span>${btns}</div>`;
}

function meHTML() {
  const g = G, me = g.you, P = g.players[me], isA = g.turn === me, playing = g.phase === 'playing';
  const first = g.hand[0];
  const plantNow = playing && isA && (g.step === 'plant1' || g.step === 'plant2') && first;
  const tray3 = playing && g.step === 'plant3' && g.toPlant.length;
  if (tray3 && !g.toPlant.some(c => c.uid === sel3)) sel3 = g.toPlant[0].uid;
  const selCard = tray3 ? g.toPlant.find(c => c.uid === sel3) : null;
  const target = plantNow ? first.bean : selCard ? selCard.bean : null;
  const action = plantNow ? 'plant' : 'plant3';
  const canBuyNow = playing && !g.fixedThree && P.fields.length === 2 && P.coins >= g.cost;
  const fields = P.fields.map((f, k) => {
    const ok = target && (f.bean === null || f.bean === target);
    const gain = f.bean ? coinsFor(f.bean, f.count) : 0;
    return `<div class="field${ok ? ' ok' : ''}" ${ok ? `data-a="${action}" data-f="${k}"` : ''}>
      <div class="lbl"><span>Champ ${k + 1}</span>${f.bean ? `<span class="gain">récolte <span class="coin">${gain}</span></span>` : ''}</div>
      ${f.bean ? `<div class="stack k${Math.min(f.count, 4)}">${cardHTML(f.bean)}<span class="cnt">${f.count}</span></div>
        <button class="btn sm" data-a="harvest" data-f="${k}" ${harvestable(P, k) ? '' : 'disabled'}>Récolter</button>`
      : `<div class="empty">${ok ? 'Touche pour planter ici' : 'Champ vide'}</div>`}</div>`;
  }).join('');
  const handHTML = g.hand.length
    ? g.hand.map((c, i) => cardHTML(c.bean, i === 0 && playing ? 'first' : '', '', 'h' + c.uid)).join('')
    : '<span class="hand-empty">Ta main est vide.</span>';
  return `<div class="me${playing && isA ? ' turn' : ''}">
    <div class="me-h"><h3>${esc(P.name)}</h3><span class="coin" title="Pièces">${P.coins}</span><span class="tag">pièces</span><span class="sp"></span>
      ${canBuyNow ? `<button class="btn sm sun" data-a="buy">Acheter un 3e champ (${g.cost} pièces)</button>` : ''}</div>
    <div class="fields">${fields}</div>
    ${g.toPlant.length ? `<div><div class="tag">À planter (${g.toPlant.length})</div><div class="tray">${g.toPlant.map(c =>
      cardHTML(c.bean, 'tap' + (c.uid === sel3 ? ' sel' : ''), `data-a="sel3" data-u="${c.uid}"`, 't' + c.uid)).join('')}</div></div>` : ''}
    <div><div class="tag">Ma main (${g.hand.length}) — l'ordre est fixe, la carte en surbrillance sera plantée en premier</div><div class="hand">${handHTML}</div></div></div>`;
}

function barHTML() {
  const g = G, me = g.you, isA = g.turn === me;
  let inner = '';
  if (g.phase !== 'playing') return '';
  if (g.step === 'trade') {
    inner = `<button class="btn sun" data-a="cnew">Proposer un échange</button>` +
      (isA ? `<button class="btn go big" data-a="endTrade">Terminer les échanges</button>`
        : g.players[g.turn].bot ? `<button class="btn ${g.iReady ? 'go' : ''}" data-a="ready" ${g.iReady ? 'disabled' : ''}>${g.iReady ? '✔ ' : ''}Pas (plus) d'échange</button>` : '');
  } else if (g.step === 'plant2' && isA) {
    inner = `<div class="bar-msg">Planter une 2e carte ?<small>Touche un champ, ou passe.</small></div><button class="btn go big" data-a="skip">Passer</button>`;
  } else {
    const [t, s] = stepBanner();
    if (t) inner = `<div class="bar-msg">${t}${s ? `<small>${s}</small>` : ''}</div>`;
  }
  return inner ? `<div class="bar"><div class="bar-in">${inner}</div></div>` : '';
}

/* Indicateur d'équité (valeurs de marché avec la composition initiale de la pioche) */
function fairnessHTML(g) {
  MODEL.SCALE = g.scale || MODEL.SCALE;
  const prior = {}; g.beans.forEach(b => { prior[b] = BEANS[b].n; });
  const beanOf = u => (g.hand.find(c => c.uid === u) || g.faceUp.find(c => c.uid === u) || {}).bean;
  let vg = 0, vw = 0;
  C.give.forEach(u => { const b = beanOf(u); if (b) vg += marketVal(b, prior); });
  Object.keys(C.want).forEach(b => { vw += C.want[b] * marketVal(b, prior); });
  C.wt.forEach(u => { const b = beanOf(u); if (b) vw += marketVal(b, prior); });
  if (!vg) return '<div class="fair">Choisis au moins une carte à donner.</div>';
  if (!vw) return `<div class="fair ok">🎁 Cadeau : ce que tu donnes vaut ≈ ${pts(vg)}.</div>`;
  const r = vw / vg, s = `Tu donnes ≈ ${pts(vg)} et tu demandes ≈ ${pts(vw)} (×${fmt(r)}).`;
  if (r > MODEL.FAIR_MAX) return `<div class="fair bad">⚠️ Trop demandeur : ${s} Un robot pourrait refuser, sauf si l'échange sert quand même sa stratégie.</div>`;
  if (r < MODEL.FAIR_MIN) return `<div class="fair ok">💝 Généreux : ${s} Tu donnes nettement plus que tu ne demandes.</div>`;
  return `<div class="fair ok">✔ Échange équitable : ${s}</div>`;
}

function composerHTML() {
  const g = G, me = g.you, isA = me === g.turn;
  if (!C || g.step !== 'trade') return '';
  const targets = isA ? [{ i: -1, n: 'Tout le monde' }].concat(g.players.map((p, i) => ({ i, n: (p.bot ? '🤖 ' : '') + p.name })).filter(x => x.i !== me)) : null;
  const give = g.hand.map(c => cardHTML(c.bean, 'mini tap' + (C.give.has(c.uid) ? ' sel' : ''), `data-a="cg" data-u="${c.uid}"`)).join('');
  const table = isA ? g.faceUp.map(c => cardHTML(c.bean, 'mini tap' + (C.give.has(c.uid) ? ' sel' : ''), `data-a="cg" data-u="${c.uid}"`)).join('') : '';
  const wtable = !isA ? g.faceUp.map(c => cardHTML(c.bean, 'mini tap' + (C.wt.has(c.uid) ? ' sel' : ''), `data-a="cw" data-u="${c.uid}"`)).join('') : '';
  MODEL.SCALE = g.scale || MODEL.SCALE;
  const steps = g.beans.map(b => `<div class="stp${C.want[b] ? ' on' : ''}"><button data-a="cwm" data-b="${b}" aria-label="Moins">−</button>
      ${chipHTML(b, 1)}<small class="val" title="Valeur de marché estimée (100 pts = 1 pièce)">${pts(marketVal(b, priorAvail(g))).replace(' pts', '')}</small><span class="n">${C.want[b] || 0}</span><button data-a="cwp" data-b="${b}" aria-label="Plus">+</button></div>`).join('');
  const ok = C.give.size > 0;
  const botTarget = isA ? (C.to >= 0 ? g.players[C.to].bot : g.players.some((p, i) => p.bot && i !== me)) : g.players[g.turn].bot;
  return `<div class="ov"><div class="modal" role="dialog" aria-modal="true"><h2>Proposer un échange</h2>
    ${isA ? `<div class="sec"><b>À qui ?</b><div class="row">${targets.map(t => `<button class="tgl${C.to === t.i ? ' on' : ''}" data-a="cto" data-i="${t.i}">${esc(t.n)}</button>`).join('')}</div></div>`
      : `<div class="hint">Ton offre s'adresse à ${esc(g.players[g.turn].name)}, le joueur actif.</div>`}
    <div class="sec"><b>Je donne (touche les cartes)</b>
      ${isA && g.faceUp.length ? `<div class="hint">Cartes retournées</div><div class="row">${table}</div>` : ''}
      <div class="hint">Ma main</div><div class="row">${give || '<span class="hint">Ta main est vide.</span>'}</div></div>
    <div class="sec"><b>Je demande (facultatif : sans demande, c'est un cadeau)</b>
      ${wtable ? `<div class="hint">Cartes retournées</div><div class="row">${wtable}</div>` : ''}
      <div class="hint">Cartes de la main de ${isA ? (C.to === -1 ? 'l\'acceptant' : esc(g.players[C.to].name)) : esc(g.players[g.turn].name)}</div>
      <div class="steps">${steps}</div></div>
    ${fairnessHTML(g)}
    ${botTarget ? '<div class="hint">🤖 Un robot accepte si l\'offre lui rapporte au moins autant qu\'il cède (valeur estimée en pièces) et si l\'échange est équitable. Il t\'expliquera sa décision.</div>' : ''}
    <div class="row"><span class="sp"></span><button class="btn" data-a="ccancel">Annuler</button>
      <button class="btn go" data-a="csend" ${ok ? '' : 'disabled'}>Envoyer l'offre</button></div></div></div>`;
}

function resultHTML() {
  const g = G, r = g.result;
  if (g.phase !== 'over' || !r) return '';
  const w = r.winners;
  return `<div class="ov"><div class="modal"><div class="crown">🏆</div>
    <h2 style="text-align:center">${w.length > 1 ? 'Égalité : ' + w.map(esc).join(' et ') : esc(w[0]) + ' remporte la partie !'}</h2>
    ${r.tieBreak ? '<div class="hint" style="text-align:center">Égalité de pièces : le plus de cartes en main l\'emporte.</div>' : ''}
    <div><div class="trow head"><span>Joueur</span><span class="n">Pièces</span><span class="n">En main</span></div>
      ${r.rows.map(x => `<div class="trow"><span>${esc(x.name)}</span><span class="n">${x.coins}</span><span class="n">${x.hand}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:center"><button class="btn go" data-a="again">Nouvelle partie</button></div></div></div>`;
}

function gameHTML() {
  const g = G, me = g.you, isA = g.turn === me;
  const [bt, bs] = stepBanner();
  return `<div class="wrap">${netBanner()}
    <div class="top"><span class="chip2">Session <b>${esc(g.code)}</b></span><span class="chip2">Pioche ${g.deck}</span><span class="chip2">Défausse ${g.disc}</span>
      <span class="chip2" title="La partie s'arrête quand la pioche est épuisée ${g.limit} fois">Pioche épuisée ${g.exhaust}/${g.limit}${g.endFlag ? ' — fin proche !' : ''}</span>
      <span class="sp"></span><button class="btn sm" data-a="leave">Quitter</button></div>
    <div class="opps">${g.players.map((p, i) => i === me ? '' : oppHTML(p, i)).join('')}</div>
    <div class="table"><div class="banner">${g.phase === 'playing' ? `${isA ? '👉 ' : ''}${bt}${bs ? `<small>${bs}</small>` : ''}` : 'Partie terminée'}
      ${g.phase === 'playing' ? `<small>Tour de ${esc(g.players[g.turn].name)}</small>` : ''}</div>
      ${g.faceUp.length ? `<div class="faceup">${g.faceUp.map(c => cardHTML(c.bean, '', '', 'f' + c.uid)).join('')}</div>` : ''}
      ${g.offers.length ? `<div class="offers">${g.offers.map(offerHTML).join('')}</div>` : ''}
      ${g.notes && g.notes.length ? `<div class="notes">${g.notes.map(n => `<div>💬 ${esc(n)}</div>`).join('')}</div>` : ''}</div>
    ${meHTML()}
    <div class="log" aria-live="polite">${g.log.slice(0, 14).map(l => `<div>${esc(l)}</div>`).join('')}</div>
  </div>${barHTML()}${composerHTML()}${resultHTML()}`;
}

function render() {
  if (!G) { app.innerHTML = homeHTML(); return; }
  const key = G.code + ':' + G.phase;
  if (key !== lastRound) { seen.clear(); lastRound = key; C = null; }
  if (G.step !== 'trade') C = null;
  const y = window.scrollY;
  app.innerHTML = G.phase === 'lobby' ? lobbyHTML() : gameHTML();
  window.scrollTo(0, y);
}

function newComposer() { return { to: G.you === G.turn ? -1 : G.turn, give: new Set(), want: {}, wt: new Set() }; }
function sendComposer() {
  if (!C || !C.give.size) return;
  send({ t: 'offer', to: C.to, give: [...C.give],
    wantTypes: Object.keys(C.want).filter(b => C.want[b] > 0).map(b => ({ bean: b, n: C.want[b] })), wantTable: [...C.wt] });
  C = null; render();
}
async function copyLink() {
  const l = shareLink();
  try { await navigator.clipboard.writeText(l); alert('Lien copié !'); } catch (e) { prompt('Copie ce lien :', l); }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, d = el.dataset;
  const tog = (set, u) => { if (set.has(u)) set.delete(u); else set.add(u); render(); };
  switch (a) {
    case 'create': return create();
    case 'join': return joinFromForm();
    case 'copy': return copyLink();
    case 'leave': return leave();
    case 'rm': return send({ t: 'rmPlayer', idx: +d.i });
    case 'plant': return send({ t: 'plant', field: +d.f });
    case 'plant3': return send({ t: 'plant3', uid: sel3, field: +d.f });
    case 'sel3': sel3 = +d.u; return render();
    case 'harvest': return send({ t: 'harvest', field: +d.f });
    case 'buy': return send({ t: 'buyField' });
    case 'accept': case 'decline': case 'withdraw': return send({ t: a, id: +d.id });
    case 'cnew': C = newComposer(); return render();
    case 'ccancel': C = null; return render();
    case 'cto': C.to = +d.i; return render();
    case 'cg': return tog(C.give, +d.u);
    case 'cw': return tog(C.wt, +d.u);
    case 'cwp': C.want[d.b] = Math.min(6, (C.want[d.b] || 0) + 1); return render();
    case 'cwm': C.want[d.b] = Math.max(0, (C.want[d.b] || 0) - 1); return render();
    case 'csend': return sendComposer();
    default: return send({ t: a });   // start, addBot, skip, endTrade, again
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'code') joinFromForm(); });

/* Démarrage : reconnexion automatique après un rafraîchissement */
render();
try {
  const saved = JSON.parse(sessionStorage.bzGuest || 'null');
  if (saved && saved.code) join(saved.code, saved.name);
} catch (e) {}
