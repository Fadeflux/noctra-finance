// LE MÊME PAIEMENT D'IMPÔTS NOTÉ DEUX FOIS (16/10, aligné le 17/10 sur la question des paiements à la modèle) : si un
// paiement d'impôts du MÊME montant a été NOTÉ dans les 48 h — dans la base relue juste avant (l'autre appareil), dans la
// mémoire de la page ou dans sa file d'attente —, la page demande « c'est un autre paiement ? » AVANT d'écrire (même chose
// pour un retrait en liquide). « Annuler » (le choix par défaut, Échap, toucher à côté) : rien n'est écrit, le formulaire
// garde ce qui est tapé ; « Oui, le noter » : l'enregistrement passe par la fonction GLOBALE de la liste (et ses enveloppes).
// Prouvé sur le VRAI code.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des paiements FICTIFS,
// une date figée, une fausse base (apiFetch simulé, lecture seule) et un faux document. (On ne teste jamais sur la base réelle.)
//
// Ce qu'il surveille :
//  1. La détection : même montant au centime, NOTÉ (heure de saisie `le`, sinon l'identifiant ; sans heure : la date, toute
//     la journée) dans les 48 h ; paiements « pour un mois » et « tout ce qui est dû » ; retraits à part ; base relue, file
//     d'attente, pierres tombales (base et appareil) ; « sur cet appareil » / « sur un autre appareil ».
//  2. La question : les mêmes tournures et les mêmes boutons que pour les paiements à la modèle — « Oui, le noter »,
//     « Annuler » (le bouton principal, qui a le curseur) ; hors ligne ou base muette : la fenêtre le dit.
//  3. Le geste : la base est relue (une lecture, jamais une écriture) ; pas de doublon → enregistré sans question ;
//     « Annuler » → listeImpotsEnregistrer N'EST PAS appelée, le formulaire reste ; « Oui » → appelée UNE fois ; double toucher
//     pendant la question → rien de plus ; une panne de la vérification ne bloque jamais l'enregistrement.
//
// Lancer : node test_impots_doublon.js            (ou : node test_impots_doublon.js <autre_page.html> — elle doit y échouer)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.error('  KO  ' + quoi + (detail !== undefined ? ' -> ' + String(detail).slice(0, 500) : '')); }
}
function extraire(nom) {
  let i = SRC.indexOf('async function ' + nom + '(');
  if (i < 0) i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}
function ligneDe(re, quoi) { const m = SRC.match(re); if (!m) throw new Error('introuvable : ' + quoi); return m[0]; }
const sansCom = (t) => t.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

let CODE, R_RET;
try {
  R_RET = extraire('ipRetraitEnregistrer');
  CODE = [ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'), ligneDe(/var _IR_FENETRE = [^\n]*/, '_IR_FENETRE'),
    ['_ymd', '_aujLocal', '_ymLocal', '_sansZero', '_jourCourt', '_nomMois', 'lireMontant', '_cleImpot', '_impValide', '_impGlobal',
     '_irCle', '_irValide', '_irListeCle', '_irLireBase', '_irHeureSaisie', '_irChercher', '_irQuand', '_irQuoi', '_irTextes',
     '_irVerifier', '_irRemettre', 'ipPaieEnregistrer'].map(extraire).join('\n')].join('\n');
} catch (e) {
  console.error('  KO  la question « même montant noté dans les 48 h » (base relue) est absente de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

const RealDate = Date;
// o = { impots, retraits, base: {impots_payes, impots_payes_supprimes, ...} | 'panne' | 'muette', file: [...], supprimes: [...],
//       reponse: (question) => Promise<{choix}>, fenetrePanne }
function charger(maintenant, o) {
  o = o || {};
  const NOW = new RealDate(maintenant).getTime();
  function FauxDate(...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); }
  FauxDate.now = () => NOW; FauxDate.UTC = RealDate.UTC; FauxDate.prototype = RealDate.prototype;
  const M = { questions: [], enreg: 0, lectures: [], minuteurs: [], bouton: { disabled: false, attrs: {}, span: { textContent: 'Enregistrer' } },
    champs: { 'lm-f-mt': { value: '' }, 'lm-f-date': { value: '2026-11-10' } } };
  M.bouton.setAttribute = (k, v) => { M.bouton.attrs[k] = v; };
  M.bouton.getAttribute = (k) => (k in M.bouton.attrs ? M.bouton.attrs[k] : null);
  M.bouton.removeAttribute = (k) => { delete M.bouton.attrs[k]; };
  M.bouton.querySelector = () => M.bouton.span;
  const document = { body: { classList: { contains: () => false } },
    getElementById: (id) => (id === 'lm-f-ok' ? M.bouton : (M.champs[id] || null)) };
  const apiFetch = (url, opts) => {
    M.lectures.push([url, opts]);
    if (o.base === 'panne') return Promise.reject(new Error('réseau'));
    if (o.base === 'muette') return new Promise(() => {});
    const b = o.base || {};
    const r = {}; Object.keys(b).forEach((k) => { r[k] = JSON.stringify(b[k]); });
    return Promise.resolve(r);
  };
  const setTimeout = (fn, ms) => { M.minuteurs.push({ fn, ms }); return M.minuteurs.length; };
  const clearTimeout = (id) => { if (M.minuteurs[id - 1]) M.minuteurs[id - 1].fn = null; };
  const F = new Function('Date', 'impotsPayes', 'impotsRetraits', '_IMPOTS_SUPPRIMES', '_IR_SUPPRIMES', 'document', 'M', 'console',
    'apiFetch', 'setTimeout', 'clearTimeout', 'navigator', '_fileLire', '_fenetre',
    CODE + '\nvar _lmForm = {ym: "2026-10"}, _lmFlash = null, _lmEnCours = false, _lmFlashOu = "", _ipSvFlashYm = null, _irQuestion = false, _irMiens = {};\n' +
    'function listeImpotsEnregistrer(){ M.enreg++; return Promise.resolve(); }\n' +
    'return { chercher: _irChercher, textes: _irTextes, enregistrer: ipPaieEnregistrer, heure: _irHeureSaisie, ' +
    'etat: function(){ return {form: _lmForm, flash: _lmFlash, question: _irQuestion}; }, poser: function(f){ _lmForm = f; }, miens: function(){ return _irMiens; } };')(
    FauxDate, o.impots || [], o.retraits || [], new Set(o.supprimes || []), new Set(o.supRetraits || []), document, M, { warn() {} },
    apiFetch, setTimeout, clearTimeout, { onLine: true }, () => (o.file || []).slice(),
    (q) => { M.questions.push(q); if (o.fenetrePanne) throw new Error('fenêtre en panne'); return (o.reponse || (() => Promise.resolve({ choix: 'annuler' })))(q); });
  F.M = M;
  return F;
}
const tic = () => new Promise((r) => setImmediate(r));
const tout = (date, amount, le, id) => ({ id: id || ('g' + amount + le), global: true, date: date, amount: amount, le: le });
const mois = (ym, date, amount, le) => ({ id: 'm' + amount + le, mois: ym, date: date, amount: amount, le: le });
const ret = (date, amount, le) => ({ id: 'r' + amount + le, date: date, amount: amount, le: le });
const NB = (t) => String(t == null ? '' : t).replace(/[  ]/g, ' ');
const H = (iso) => new RealDate(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });   // l'heure locale de la machine
const MAINT = '2026-11-10T18:00:00Z', LE = '2026-11-10T12:00:00.000Z';

(async () => {
  console.log('\n-- 1. la détection : même montant, NOTÉ dans les 48 h --');
  let F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)] });
  let r = F.chercher('paie', 49400, null);
  V(r && r.x.amount === 494 && r.n === 1, 'même montant ($494) noté ce midi (mémoire de la page) : trouvé', JSON.stringify(r));
  V(F.chercher('paie', 49401, null) === null && F.chercher('paie', 49300, null) === null, 'un autre montant (au centime près) : rien');
  V(F.chercher('retrait', 49400, null) === null, 'les retraits sont à part : un paiement ne compte pas comme retrait');
  F = charger('2026-11-12T11:00:00Z', { impots: [tout('2026-11-10', 494, LE)] });
  V(F.chercher('paie', 49400, null) !== null, 'noté il y a 47 h : trouvé');
  F = charger('2026-11-12T13:00:00Z', { impots: [tout('2026-11-10', 494, LE)] });
  V(F.chercher('paie', 49400, null) === null, 'noté il y a 49 h : plus de question');
  F = charger(MAINT, { impots: [tout('2026-11-01', 494, '2026-11-10T16:00:00.000Z')] });
  V(F.chercher('paie', 49400, null) !== null, 'daté du 1er dans le formulaire mais NOTÉ il y a 2 h : trouvé (l’heure de saisie compte, pas le jour choisi)');
  F = charger(MAINT, { impots: [mois('2026-10', '2026-11-10', 68, LE)] });
  V(F.chercher('paie', 6800, null) !== null, 'un paiement « pour un mois » compte aussi');
  F = charger(MAINT, { retraits: [ret('2026-11-10', 300, LE)] });
  V(F.chercher('retrait', 30000, null) !== null && F.chercher('paie', 30000, null) === null, 'un retrait du même montant : trouvé pour un retrait seulement');
  F = charger(MAINT, { impots: [{ id: 'x', global: true, date: 'bof', amount: 494, le: LE }] });
  V(F.chercher('paie', 49400, null) === null, 'une ligne illisible ne déclenche pas la question');
  const idHeure = 'i' + new RealDate('2026-11-10T15:00:00Z').getTime().toString(36) + 'abc123';
  F = charger(MAINT, { impots: [{ id: idHeure, global: true, date: '2026-11-10', amount: 494 }] });
  V(F.heure({ id: idHeure }) === new RealDate('2026-11-10T15:00:00Z').getTime() && F.chercher('paie', 49400, null) !== null,
    'sans champ `le` : l’heure de saisie est lue dans l’identifiant (« i » + millisecondes en base 36)');
  F = charger(MAINT, { impots: [{ id: 'ancien', mois: '2026-10', date: '2026-11-07', amount: 494 }] });
  V(F.chercher('paie', 49400, null) === null, 'sans heure, daté d’il y a 3 jours : rien (la date compte, toute la journée)');
  F = charger(MAINT, { impots: [{ id: 'ancien', mois: '2026-10', date: '2026-11-08', amount: 494 }] });
  V(F.chercher('paie', 49400, null) !== null, 'sans heure, daté d’avant-hier (le soir de ce jour-là est dans les 48 h) : trouvé');
  F = charger(MAINT, { impots: [{ id: 'ancien', mois: '2026-10', date: '2026-11-09', amount: 494 }] });
  V(F.chercher('paie', 49400, null) !== null, 'sans heure, daté d’hier : trouvé (prudent : toute la journée compte)');

  console.log('\n-- 1 bis. la base relue, la file d’attente, les pierres tombales --');
  F = charger(MAINT, { impots: [] });
  r = F.chercher('paie', 49400, { impots_payes: JSON.stringify([tout('2026-11-10', 494, LE, 'iautre')]), impots_payes_supprimes: '[]' });
  V(r && r.ou === 'ailleurs', 'noté SEULEMENT dans la base relue (l’autre appareil, depuis le chargement) : trouvé, « sur un autre appareil »', JSON.stringify(r));
  r = F.chercher('paie', 49400, { impots_payes: [tout('2026-11-10', 494, LE, 'iautre')], impots_payes_supprimes: [{ k: 'iautre', le: LE }] });
  V(r === null, 'supprimé sur l’autre appareil (pierre tombale en base) : ne compte pas');
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE, 'iici')], supprimes: ['iici'] });
  V(F.chercher('paie', 49400, null) === null, 'supprimé ici (pierre tombale de cet appareil) : ne compte pas');
  F = charger(MAINT, { impots: [], file: [{ t: 'liste', cle: 'impots_payes', aj: [tout('2026-11-10', 494, LE, 'ifile')], sup: [] }] });
  r = F.chercher('paie', 49400, { impots_payes: [], impots_payes_supprimes: [] });
  V(r && r.ou === 'ici' && r.attente === true, 'en attente dans la file de cet appareil (pas encore dans le cloud) : trouvé, « sur cet appareil »', JSON.stringify(r));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE, 'imem')], file: [{ t: 'liste', cle: 'impots_payes', aj: [], sup: [tout('2026-11-10', 494, LE, 'imem')] }] });
  V(F.chercher('paie', 49400, null) === null, 'une suppression en attente dans la file : ne compte pas');
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE, 'imem')] });
  r = F.chercher('paie', 49400, { impots_payes: [tout('2026-11-10', 494, LE, 'imem'), tout('2026-11-10', 494, '2026-11-10T14:00:00.000Z', 'iautre2')] });
  V(r && r.n === 2 && r.x.id === 'iautre2', 'deux lignes du même montant : la plus récente, et le nombre', JSON.stringify(r));

  console.log('\n-- 2. la question --');
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)], base: { impots_payes: [tout('2026-11-10', 494, LE)], impots_payes_supprimes: [] } });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  let q = F.M.questions[0] || {};
  V(NB(q.titre) === 'Un paiement d’impôts de $494 a déjà été noté aujourd’hui à ' + H(LE) + ' — c’est un autre paiement ?',
    'titre : « Un paiement d’impôts de $494 a déjà été noté aujourd’hui à ' + H(LE) + ' — c’est un autre paiement ? »', q.titre);
  V(NB(q.texte) === 'Si c’est le même, choisis « Annuler » : rien ne sera noté.', 'texte : « Si c’est le même, choisis « Annuler » : rien ne sera noté. »', q.texte);
  V(NB(q.detail) === 'Déjà noté : payé le 10 nov. · tout ce qui est dû\nCelui-ci : payé le 10 nov. · tout ce qui est dû', 'détail : ce qui est déjà noté, et celui-ci', q.detail);
  V(JSON.stringify((q.boutons || []).map((b) => [b.l, b.v, b.cls || ''])) === JSON.stringify([['Oui, le noter', 'oui', ''], ['Annuler', 'annuler', 'pri']]),
    'boutons : « Oui, le noter », puis « Annuler » (le bouton principal, qui a le curseur) — comme les paiements à la modèle', JSON.stringify(q.boutons));
  V(q.ico === 'alerte' && q.ton === 'avert', 'la fenêtre de l’application (Échap, toucher à côté = « Annuler »)');
  V(F.M.lectures.length === 1 && F.M.lectures[0][0] === '/api/settings?cles=impots_payes,impots_payes_supprimes' && F.M.lectures[0][1] === undefined,
    'la base est RELUE avant de comparer : la liste et ses pierres tombales, une lecture (aucune option : jamais une écriture)', JSON.stringify(F.M.lectures));
  F = charger(MAINT, { impots: [tout('2026-11-09', 494, '2026-11-09T12:00:00.000Z')], base: 'panne' });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  q = F.M.questions[0] || {};
  V(/^Un paiement d’impôts de \$494 a déjà été noté hier à /.test(NB(q.titre)), 'noté hier : « … a déjà été noté hier à … »', q.titre);
  V(NB(q.texte) === 'Pas de réseau : l’autre appareil n’a pas pu être vérifié, seulement ce que celui-ci connaît. Si c’est le même, choisis « Annuler » : rien ne sera noté.',
    'hors ligne : la fenêtre dit que l’autre appareil n’a pas pu être vérifié', q.texte);
  F = charger(MAINT, { impots: [], base: { impots_payes: [mois('2026-10', '2026-11-10', 494, LE)] } });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  q = F.M.questions[0] || {};
  V(/\(sur un autre appareil\) — c’est un autre paiement \?$/.test(NB(q.titre)) && /^Déjà noté : payé le 10 nov\. · pour octobre\n/.test(NB(q.detail)),
    'noté sur l’autre appareil, « pour octobre » : la fenêtre le dit', JSON.stringify([q.titre, q.detail]));
  const T = F.textes('retrait', { amount: 300, date: '2026-10-16' }, { x: ret('2026-10-16', 300, LE), quand: null, ou: 'ici', attente: true, n: 2 }, false);
  V(NB(T.titre) === 'Un retrait de $300 daté du 16 oct. est déjà noté (sur cet appareil) — c’est un autre retrait ?'
    && NB(T.detail) === 'Déjà noté : retiré le 16 oct. · pas encore dans le cloud\nCelui-ci : retiré le 16 oct.\n2 retraits de $300 notés en 48 h',
    'retrait : « Un retrait de $300 … est déjà noté (sur cet appareil) — c’est un autre retrait ? », pas encore dans le cloud, 2 en 48 h', JSON.stringify(T));

  console.log('\n-- 3. le geste --');
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)] });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  V(F.M.questions.length === 1 && F.M.enreg === 0 && F.etat().form !== null && F.M.champs['lm-f-mt'].value === '494' && F.etat().question === false,
    '« Annuler » : listeImpotsEnregistrer N’EST PAS appelée, le formulaire reste avec ce qui est tapé', JSON.stringify([F.M.questions.length, F.M.enreg, F.etat()]));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)], reponse: () => Promise.resolve({ choix: 'oui' }) });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  V(F.M.questions.length === 1 && F.M.enreg === 1, '« Oui, le noter » : la question, puis listeImpotsEnregistrer appelée UNE fois', JSON.stringify([F.M.questions.length, F.M.enreg]));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)] });
  F.M.champs['lm-f-mt'].value = '495';
  await F.enregistrer();
  V(F.M.questions.length === 0 && F.M.enreg === 1 && F.M.lectures.length === 1, 'un autre montant : base relue, aucune question, enregistré directement', JSON.stringify([F.M.questions.length, F.M.enreg, F.M.lectures.length]));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)], reponse: () => new Promise(() => {}) });
  F.M.champs['lm-f-mt'].value = '494';
  F.enregistrer(); F.enregistrer(); await tic(); await tic(); F.enregistrer(); await tic();
  V(F.M.questions.length === 1 && F.M.enreg === 0 && F.M.lectures.length === 1, 'double toucher pendant la vérification et la question : une seule question, rien d’écrit',
    JSON.stringify([F.M.questions.length, F.M.enreg, F.M.lectures.length]));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)] });
  F.M.champs['lm-f-mt'].value = '1.000';
  await F.enregistrer();
  V(F.M.questions.length === 0 && F.M.enreg === 1 && F.M.lectures.length === 0, 'montant refusé (« 1.000 ») : ni relecture ni question, la fonction de la liste dit le refus (E1)',
    JSON.stringify([F.M.questions.length, F.M.enreg]));
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)], fenetrePanne: true });
  F.M.champs['lm-f-mt'].value = '494';
  await F.enregistrer();
  V(F.M.enreg === 1, 'la fenêtre en panne : enregistré comme sans question (une panne ne bloque jamais un paiement)', F.M.enreg);
  F = charger(MAINT, { impots: [tout('2026-11-10', 494, LE)], base: 'muette' });
  F.M.champs['lm-f-mt'].value = '494';
  const pr = F.enregistrer(); await tic();
  const lent = F.M.minuteurs.find((m) => m.ms === 800), muet = F.M.minuteurs.find((m) => m.ms === 6000);
  if (lent && lent.fn) lent.fn();
  V(F.M.bouton.disabled === true && F.M.bouton.span.textContent === 'Vérification…' && F.M.bouton.attrs['aria-busy'] === 'true', 'réseau lent (0,8 s) : le bouton dit « Vérification… » (rien n’est encore noté)',
    JSON.stringify([F.M.bouton.disabled, F.M.bouton.span.textContent]));
  if (muet && muet.fn) muet.fn();
  await tic(); await tic(); await pr;
  q = F.M.questions[0] || {};
  V(/^Pas de réseau/.test(NB(q.texte)) && F.M.enreg === 0 && F.M.bouton.disabled === false && F.M.bouton.span.textContent === 'Enregistrer',
    'base muette 6 s : la question est posée avec ce que l’appareil connaît (et le dit) ; le bouton revient', JSON.stringify([q.texte, F.M.bouton.disabled, F.M.bouton.span.textContent]));
  F = charger(MAINT, { impots: [], base: { impots_payes: [] }, reponse: () => Promise.resolve({ choix: 'oui' }) });
  F.M.champs['lm-f-mt'].value = '300';
  F.M.champs['lm-f-date'].value = '2026-11-10';
  const p2 = F.enregistrer(); F.M.champs['lm-f-mt'].value = '999'; await p2;
  V(F.M.enreg === 1 && F.M.champs['lm-f-mt'].value === '300', 'un champ changé pendant la relecture : c’est le montant vérifié qui est noté', F.M.champs['lm-f-mt'].value);
  const P = sansCom(extraire('ipPaieEnregistrer'));
  V(P.indexOf("_irVerifier('paie'") >= 0 && P.indexOf("_irVerifier('paie'") < P.indexOf('listeImpotsEnregistrer()') && !/impotsPayes\.push|_ecrireImpotsPayes|logEdit|_attenteNoter|listeImpotsEnregistrer\s*=/.test(P),
    '« Enregistrer » du paiement : la vérification AVANT la fonction globale ; rien n’est écrit ici, rien n’est réaffecté');
  const R = sansCom(R_RET);
  V(R.indexOf("_irVerifier('retrait'") > 0 && R.indexOf("_irVerifier('retrait'") < R.indexOf('impotsRetraits.push(x)') && /if\(!await _irVerifier\('retrait', s\)\) return;/.test(R),
    '« Enregistrer » du retrait : la vérification AVANT d’écrire ; « Annuler » : rien');
  const L = sansCom(extraire('_irLireBase') + extraire('_irVerifier') + extraire('_irChercher'));
  V(!/method|POST|_pushSetting|_saveVirements|_listeEcrire/.test(L), 'la vérification ne fait que LIRE (aucune écriture possible)');

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
