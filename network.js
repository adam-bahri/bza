// Couche réseau : sessions PeerJS, hôte autoritaire, synchronisation de l'état vers chaque joueur.
// Dépend de engine.js (S, act, newState, newPlayer, ...) et de la librairie globale Peer (PeerJS).
/* ============ RÉSEAU (PeerJS) ============ */
const PREFIX = 'bohnanza-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const TOKEN = sessionStorage.bzTok || (sessionStorage.bzTok = rid());

let ROLE = null, CODE = '', peer = null, conn = null;
let G = null, netMsg = '', MYNAME = '';
let autoTimer = null, retryTimer = null;
const conns = {};   // hôte : id joueur -> connexion

/* Vue personnalisée : chaque joueur ne voit que sa propre main. */
function viewFor(i) {
  const me = S.players[i];
  const info = b => ({ bean: b.bean, uid: b.uid });
  const findGive = (o, u) => {
    const g = S.players[o.from];
    const inHand = g.hand.find(c => c.uid === u);
    if (inHand) return { bean: inHand.bean, table: false };
    const t = S.faceUp.find(c => c.uid === u);
    return t ? { bean: t.bean, table: true, uid: t.uid } : null;
  };
  return {
    code: CODE, phase: S.phase, step: S.step, turn: S.turn, you: i,
    deck: S.deck.length, disc: S.discard.length, exhaust: S.exhaust, limit: S.cfg.limit, cost: S.cfg.cost,
    fixedThree: S.cfg.fixedThree, endFlag: S.endFlag, beans: S.cfg.beans, scale: MODEL.SCALE,
    faceUp: S.faceUp.map(info),
    hand: me.hand.map(info), toPlant: me.toPlant.map(info),
    players: S.players.map(p => ({
      name: p.name, bot: p.bot, host: p.host, connected: p.connected, coins: p.coins.length, handN: p.hand.length,
      toPlantN: p.toPlant.length, fields: p.fields.map(f => ({ bean: f.bean, count: f.cards.length }))
    })),
    offers: S.offers.map(o => ({
      id: o.id, from: o.from, to: o.to,
      give: o.give.map(u => findGive(o, u)).filter(Boolean),
      wantTypes: o.wantTypes, wantTable: o.wantTable.map(u => S.faceUp.find(c => c.uid === u)).filter(Boolean).map(info)
    })),
    notes: S.notes, iReady: S.ready.includes(i),
    log: S.log.slice(-40).reverse(), result: S.result
  };
}

function pump() {
  if (!S) return;
  S.players.forEach((p, i) => { const c = conns[p.id]; if (c && c.open) { try { c.send({ t: 'state', s: viewFor(i) }); } catch (e) {} } });
  G = viewFor(0); render();
  scheduleAuto();
}
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!S) return;
  const pl = autoPlan();
  if (!pl || pl.wait) return;                    // en attente d'un humain : le prochain changement d'état relancera la planification
  autoTimer = setTimeout(autoStep, Math.max(50, pl.delay * 1000));
}

function onGuestData(c, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'join') return handleJoin(c, d);
  const i = S.players.findIndex(p => conns[p.id] === c);
  if (i >= 0) act(i, d);
}
function handleJoin(c, d) {
  const tok = String(d.token || '').slice(0, 40);
  const name = String(d.name || 'Joueur').trim().slice(0, 16) || 'Joueur';
  const known = S.players.find(p => p.token === tok && !p.bot);
  if (known) {
    const old = conns[known.id];
    conns[known.id] = c;
    if (!known.connected) { known.connected = true; if (S.phase !== 'lobby') log(`${known.name} est de retour.`); }
    if (old && old !== c) { try { old.close(); } catch (e) {} }
    pump(); return;
  }
  if (S.phase !== 'lobby' || S.players.length >= MAX_PLAYERS) {
    try { c.send({ t: 'err', msg: S.phase !== 'lobby' ? 'La partie a déjà commencé.' : 'La session est pleine (8 joueurs maximum).' }); } catch (e) {}
    setTimeout(() => { try { c.close(); } catch (e) {} }, 400); return;
  }
  let nm = name, k = 2;
  while (S.players.some(p => p.name === nm)) nm = name + ' ' + k++;
  const p = newPlayer(nm, false); p.token = tok;
  conns[p.id] = c; S.players.push(p);
  pump();
}
function onGuestClose(c) {
  const i = S.players.findIndex(p => conns[p.id] === c);
  if (i < 0) return;
  const p = S.players[i];
  delete conns[p.id];
  if (S.phase === 'lobby') S.players.splice(i, 1);
  else { p.connected = false; log(`⚠️ ${p.name} a perdu la connexion.`); }
  pump();
}

function create() {
  const name = readName(); if (!name) return setErr('Entre ton prénom pour commencer.');
  ROLE = 'host'; MYNAME = name; setErr('Création de la session…', true);
  tryHost(0);
}
function tryHost(attempt) {
  const code = genCode();
  const pr = new Peer(PREFIX + code);
  pr.on('open', () => {
    peer = pr; CODE = code; S = newState();
    const me = newPlayer(MYNAME, false); me.host = true; me.token = TOKEN; S.players.push(me);
    history.replaceState(null, '', location.pathname);
    pump();
  });
  pr.on('error', e => {
    if (e.type === 'unavailable-id' && attempt < 6) { try { pr.destroy(); } catch (x) {} return tryHost(attempt + 1); }
    if (!S) { ROLE = null; setErr('Impossible de créer la session (' + e.type + '). Vérifie ta connexion.'); }
    else console.warn('PeerJS', e);
  });
  pr.on('connection', c => {
    c.on('data', d => onGuestData(c, d));
    c.on('close', () => onGuestClose(c));
    c.on('error', () => onGuestClose(c));
  });
  pr.on('disconnected', () => { try { pr.reconnect(); } catch (e) {} });
}
function joinFromForm() {
  const name = readName(); if (!name) return setErr('Entre ton prénom.');
  const code = ($('#code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) return setErr('Le code de session comporte 5 caractères.');
  join(code, name);
}
function join(code, name) {
  ROLE = 'guest'; CODE = code; MYNAME = name; setErr('Connexion à la session…', true);
  peer = new Peer();
  peer.on('open', connectHost);
  peer.on('error', e => {
    if (e.type === 'peer-unavailable') {
      if (G) { netMsg = 'Hôte injoignable, nouvelle tentative…'; render(); retryTimer = setTimeout(connectHost, 3000); }
      else fail('Session introuvable : vérifie le code.');
    } else if (!G) fail('Erreur réseau (' + e.type + ').');
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
}
function connectHost() {
  clearTimeout(retryTimer);
  const c = conn = peer.connect(PREFIX + CODE, { reliable: true });
  const to = setTimeout(() => { if (!c.open) { try { c.close(); } catch (e) {} if (!G) fail('Impossible de joindre la session (délai dépassé).'); } }, 12000);
  c.on('open', () => {
    clearTimeout(to);
    c.send({ t: 'join', name: MYNAME, token: TOKEN });
    sessionStorage.bzGuest = JSON.stringify({ code: CODE, name: MYNAME });
  });
  c.on('data', onHostData);
  c.on('close', () => {
    if (conn !== c || ROLE !== 'guest') return;
    if (!G) return fail('Connexion refusée ou interrompue.');
    netMsg = 'Connexion perdue… reconnexion en cours'; render();
    retryTimer = setTimeout(() => { if (peer && peer.disconnected) { try { peer.reconnect(); } catch (e) {} } connectHost(); }, 2500);
  });
}
function onHostData(d) {
  if (!d) return;
  if (d.t === 'state') { G = d.s; netMsg = ''; render(); }
  else if (d.t === 'err') fail(d.msg);
}
function fail(msg) {
  clearTimeout(retryTimer);
  try { peer && peer.destroy(); } catch (e) {}
  peer = conn = null; ROLE = null; G = null;
  sessionStorage.removeItem('bzGuest');
  render(); setErr(msg);
}
function send(m) { if (ROLE === 'host') act(0, m); else if (conn && conn.open) conn.send(m); }
function leave() {
  if (!confirm(ROLE === 'host' ? 'Quitter met fin à la session pour tout le monde. Continuer ?' : 'Quitter la partie ?')) return;
  sessionStorage.removeItem('bzGuest'); location.href = location.pathname;
}

