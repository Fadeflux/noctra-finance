// « CE PAIEMENT EST-IL DÉJÀ NOTÉ ? » — prouvé sur le VRAI code de index.html (addModelPayment, l'écriture fusionnée
// _saveVirements, les identifiants des paiements, et le bloc « feat8 · DOUBLON »), avec un faux serveur en mémoire.
// Aucune connexion, données inventées, aucun identifiant de connexion.
//
// ⚠️ LE DÉFAUT : le même paiement à la modèle pouvait être noté DEUX fois sans un mot — depuis deux appareils (le
// formulaire proposait la même part des deux côtés), ou deux fois par erreur — et « Reste à envoyer » le comptait deux
// fois. La règle : si un paiement du MÊME montant (au centime) a été NOTÉ dans les 48 h d'avant (base relue juste avant,
// mémoire de la page, file d'attente de l'appareil), une fenêtre demande « c'est un autre paiement ? » AVANT d'écrire.
// « Annuler » (le choix par défaut) n'écrit RIEN ; « Oui, le noter » écrit exactement comme avant. Les 48 h se comptent
// depuis l'HEURE DE SAISIE (dans l'identifiant « v… » du paiement), pas depuis la date choisie dans le formulaire.
//
//     node test_doublon_paiement.js [autre/index.html]      (sur la version d'avant : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

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
const ligne = (debut) => { const i = SRC.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut); return SRC.slice(i, SRC.indexOf('\n', i)); };

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}

// le bloc « feat8 · DOUBLON » tel qu'il est dans la page (absent d'une version d'avant : le banc doit alors échouer)
const D0 = SRC.indexOf('// ══ feat8 · DOUBLON'), D1 = SRC.indexOf('// ══ fin feat8 · DOUBLON ══');
const BLOC = (D0 >= 0 && D1 > D0) ? SRC.slice(D0, D1) : '';
const AIDES = ['_virSig', '_virIds', '_virAncien', '_virVieilleCle', '_virAppliquerTombes', '_virTombe'].filter((x) => SRC.includes('function ' + x + '('));
const CODE = [ligne('const fmtC='), extraire('ts'), extraire('dl'), extraire('_sansZero'), extraire('_ymd'), extraire('_jourCourt'), ligne('var _NB = '), extraire('_insecable'),
  extraire('lireMontant'), extraire('ecritureInterdite'), extraire('_cleVirement'), extraire('_nouvelIdVirement'), extraire('_saveVirements'),
  extraire('addModelPayment')].concat(AIDES.map(extraire)).join('\n') + '\n' + BLOC;

// ── Faux monde : UNE base (un objet en mémoire), des appareils (chacun ses globales, sa mémoire, sa file, son heure) ──
function nouveauServeur(init) {
  const S = { donnees: {}, ecritures: [], lectures: 0, coupe: false, muet: false };
  for (const k of Object.keys(init || {})) S.donnees[k] = JSON.stringify(init[k]);
  S.fetch = async (url, o) => {
    if (S.coupe) throw new Error('TypeError: Failed to fetch');
    if (!o || !o.method || o.method === 'GET') {
      if (S.muet) return new Promise(() => {});                 // la base ne répond jamais
      S.lectures++;
      const m = /[?&]cles=([^&]*)/.exec(url);
      const cles = m ? decodeURIComponent(m[1]).split(',') : Object.keys(S.donnees);
      const r = {}; cles.forEach((k) => { if (k in S.donnees) r[k] = S.donnees[k]; }); return r;
    }
    const b = JSON.parse(o.body); S.ecritures.push(b.key); S.donnees[b.key] = b.value; return { ok: true };
  };
  return S;
}
const H = { t: 0 };
class FauxDate extends Date {
  constructor(...a) { if (a.length) super(...a); else super(H.t); }
  static now() { return H.t; }
}
const local = (s) => new Date(s).getTime();                       // « 2026-11-01T10:00:00 » = heure locale
function idA(ms) { return 'v' + ms.toString(36) + 'essai0'; }    // un identifiant comme _nouvelIdVirement l'aurait fait à cette heure
function appareil(S, o) {
  o = o || {};
  const G = { file: [], journal: [], messages: [], fenetres: [], reponses: o.reponses || [], enveloppe: 0, lecture: !!o.lecture };
  const champ = () => ({ value: '' });
  const els = { 'mp-amount': champ(), 'mp-date': champ(), 'mp-note': champ(), 'mp-msg': champ() };
  let ouverte = false, titreOuvert = '';
  els['bilan-dlg'] = { classList: { contains: (c) => c === 'open' && ouverte }, querySelector: () => ({ textContent: titreOuvert }) };
  const doc = { getElementById: (id) => els[id] || null, body: { classList: { contains: (c) => c === 'readonly' && G.lecture } } };
  const f = new Function('apiFetch', 'G', 'document', 'Date', 'navigator',
    'var virements = [], _VIREMENTS_SUPPRIMES = new Set(), _dirty = {}, _tombes = {}, _currentUser = "Essai", _donneesChargees = true;\n' +
    'function _pasCharge(){ return false; } function showSaveStatus(){} function renderModelShare(){} function saveData(){}\n' +
    'function flashMsg(id, m){ G.messages.push(m); }\n' +
    'function logEdit(a, d){ G.journal.push(a + " · " + d); }\n' +
    'function _attenteNoter(cle, genre, x){ if (cle === "virements") G.file.push({ t: "liste", cle: cle, aj: genre === "aj" ? [JSON.parse(JSON.stringify(x))] : [], sup: genre === "sup" ? [x] : [] }); }\n' +
    'function _fileLire(){ return G.file.slice(); }\n' +
    'function _fenetre(o){ G.fenetres.push(o); G.ouvrir(o); var r = G.reponses.shift(); if (r === "erreur") throw new Error("fenêtre en panne");\n' +
    '  return new Promise(function(fin){ setTimeout(function(){ G.fermer(); fin({ choix: r || "annuler" }); }, 30); }); }\n' +
    CODE +
    '\n_DB_ATTENTE = 60;\n' +
    // une enveloppe comme celle de feat7_mois (elle doit voir le paiement noté après « Oui »)
    'var _env = addModelPayment; addModelPayment = function(){ var avant = virements.length; var r = _env.apply(this, arguments); if (virements.length > avant) G.enveloppe++; return r; };\n' +
    'return { noter: function(){ return addModelPayment(); }, lire: function(){ return virements; }, poser: function(l){ virements = l; },' +
    ' tombes: function(s){ _VIREMENTS_SUPPRIMES = s; }, ids: (typeof _virIds === "function") ? _virIds : function(l){ return l; },' +
    ' bloc: typeof _dbIntercepter === "function" };');
  G.ouvrir = (x) => { ouverte = true; titreOuvert = x.titre; };
  G.fermer = () => { ouverte = false; };
  const A = f((u, x) => S.fetch(u, x), G, doc, FauxDate, { onLine: true });
  A.G = G; A.els = els;
  A.charger = () => { A.poser(A.ids(JSON.parse(S.donnees.virements || '[]'))); };
  A.taper = (montant, note, date) => { els['mp-amount'].value = String(montant); els['mp-note'].value = note || ''; els['mp-date'].value = date || ''; };
  return A;
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const DEPART = () => [{ id: 'vfictif-a', date: '2026-10-05', amount: 2600, note: 'septembre (fictif)' }];
const P = 1090.81;
const nP = (l) => l.filter((v) => Math.round(Number(v.amount) * 100) === Math.round(P * 100)).length;
const lireS = (S) => JSON.parse(S.donnees.virements || '[]');

async function scenario(nom, init, avant, geste, rep) {
  // avant(A, S) prépare ; geste(A) tape ; rend ce qui s'est passé PENDANT la question et APRÈS la réponse
  const S = nouveauServeur(init);
  const A = appareil(S, { reponses: rep ? [rep] : [] });
  A.charger();
  if (avant) await avant(A, S);
  const e0 = S.ecritures.length, f0 = A.G.file.length, j0 = A.G.journal.length, m0 = JSON.stringify(A.lire());
  geste(A);
  A.noter();
  await attendre(15);                                             // la base a été relue ; la fenêtre est ouverte (30 ms)
  const pendant = { ecritures: S.ecritures.length - e0, file: A.G.file.length - f0, journal: A.G.journal.length - j0, memoire: JSON.stringify(A.lire()) === m0 };
  await attendre(250);
  return { A, S, pendant, fenetre: A.G.fenetres[0] || null, apres: { ecritures: S.ecritures.slice(e0), file: A.G.file.length - f0, journal: A.G.journal.length - j0 }, base: lireS(S) };
}

(async () => {
  console.log('\n-- 0. le bloc « feat8 · DOUBLON » est dans la page, et branché dans addModelPayment --');
  V(BLOC.length > 0, 'le bloc existe', 'absent');
  V(/_dbIntercepter\(amount,date,note\)\) return;\n {2}const _nv=\{id:_nouvelIdVirement\(\)/.test(extraire('addModelPayment')),
    'addModelPayment demande AVANT de fabriquer et pousser le paiement (aucune écriture avant la réponse)');

  console.log('\n-- 1. le TÉMOIN du banc : un premier paiement (aucun doublon) s’écrit sans question --');
  H.t = local('2026-11-01T10:00:00');
  {
    const r = await scenario('premier', { virements: DEPART() }, null, (A) => A.taper(P, 'sa part d’octobre (fictif)', '2026-11-01'));
    V(!r.fenetre, 'aucune fenêtre', r.fenetre && r.fenetre.titre);
    V(nP(r.base) === 1 && r.apres.ecritures.includes('virements'), 'le paiement est en base', JSON.stringify(r.apres.ecritures));
    V(r.apres.journal === 1 && r.apres.file === 1, 'une ligne d’Historique, une entrée en file (comme avant)', JSON.stringify(r.apres));
    V(r.A.G.enveloppe === 1, 'l’enveloppe d’addModelPayment voit le paiement noté');
  }

  console.log('\n-- 2. même montant 10 min après : la question AVANT d’écrire ; « Annuler » n’écrit rien ; « Oui » écrit comme avant --');
  const deja10 = () => DEPART().concat([{ id: idA(local('2026-11-01T10:00:00')), date: '2026-11-01', amount: P, note: 'sa part d’octobre (fictif)' }]);
  H.t = local('2026-11-01T10:10:00');
  for (const rep of ['annuler', 'oui']) {
    const r = await scenario('10min', { virements: deja10() }, null, (A) => A.taper(P, 'encore (fictif)', '2026-11-01'), rep);
    const t = r.fenetre ? r.fenetre.titre : '';
    V(!!r.fenetre, '[' + rep + '] une fenêtre s’ouvre', 'aucune fenêtre : le paiement est écrit sans question');
    V(r.pendant.ecritures === 0 && r.pendant.file === 0 && r.pendant.journal === 0 && r.pendant.memoire,
      '[' + rep + '] pendant la question : 0 écriture, rien en file, rien au journal, mémoire inchangée', JSON.stringify(r.pendant));
    V(/^Un paiement de \$1,090\.81 a déjà été noté aujourd’hui à 10:00 .*— c’est un autre paiement \?$/.test(t), '[' + rep + '] le titre dit le montant, le jour et l’heure de saisie', t);
    V(r.fenetre && JSON.stringify(r.fenetre.boutons.map((b) => [b.l, b.v, b.cls || ''])) === JSON.stringify([['Oui, le noter', 'oui', ''], ['Annuler', 'annuler', 'pri']]),
      '[' + rep + '] « Oui, le noter » / « Annuler » (mis en avant = choix par défaut)', r.fenetre && JSON.stringify(r.fenetre.boutons));
    if (rep === 'annuler') {
      V(r.apres.ecritures.length === 0 && r.apres.file === 0 && r.apres.journal === 0 && nP(r.base) === 1, '« Annuler » : RIEN n’est écrit (base, file, journal)', JSON.stringify(r.apres));
      V(r.A.els['mp-amount'].value === String(P), '« Annuler » : le montant reste dans le formulaire');
    } else {
      V(nP(r.base) === 2 && r.apres.ecritures.includes('virements') && r.apres.journal === 1 && r.apres.file === 1,
        '« Oui, le noter » : écrit comme avant (paiement en base, une ligne d’Historique, une entrée en file)', JSON.stringify(r.apres));
      V(r.A.G.enveloppe === 1, '« Oui » passe par l’enveloppe d’addModelPayment (rien n’est réaffecté)');
      V(r.A.lire().filter((v) => v.note === 'encore (fictif)').length === 1, '« Oui » note le paiement tapé, une seule fois');
    }
  }

  console.log('\n-- 3. pas de question pour un autre montant, ni au-delà de 48 h --');
  {
    H.t = local('2026-11-01T10:10:00');
    let r = await scenario('1ct', { virements: deja10() }, null, (A) => A.taper(1090.80, '', '2026-11-01'));
    V(!r.fenetre && nP(r.base) === 1 && r.base.length === 3, '1 centime de moins : aucune fenêtre, écrit', r.fenetre && r.fenetre.titre);
    for (const [h, attendu] of [['2026-11-03T11:00:00', false], ['2026-11-03T09:59:00', true], ['2026-11-03T10:01:00', false]]) {
      H.t = local(h);
      r = await scenario('48h', { virements: deja10() }, null, (A) => A.taper(P, '', '2026-11-03'));
      V(!!r.fenetre === attendu, h.slice(5, 16) + ' (' + (attendu ? '< 48 h' : '> 48 h') + ') : ' + (attendu ? 'fenêtre' : 'aucune fenêtre'), r.fenetre && r.fenetre.titre);
    }
  }

  console.log('\n-- 4. l’HEURE DE SAISIE compte, pas la date du formulaire : noté le 2 « pour le 1er », revu le 3 --');
  {
    H.t = local('2026-11-03T14:00:00');
    const init = { virements: DEPART().concat([{ id: idA(local('2026-11-02T15:00:00')), date: '2026-11-01', amount: P, note: 'pour le 1er (fictif)' }]) };
    const r = await scenario('le2', init, null, (A) => A.taper(P, '', '2026-11-01'));
    V(!!r.fenetre && /hier à 15:00/.test(r.fenetre.titre), 'daté du 1er (62 h avant) mais noté hier à 15:00 (23 h) : fenêtre « hier à 15:00 »', r.fenetre && r.fenetre.titre);
  }

  console.log('\n-- 5. noté sur un AUTRE appareil (vu seulement dans la base relue) --');
  {
    H.t = local('2026-11-01T10:01:00');
    const S = nouveauServeur({ virements: DEPART() });
    const B = appareil(S, { reponses: ['annuler'] }); B.charger();                       // B ouvert avant
    S.donnees.virements = JSON.stringify(deja10());                                      // A note entre-temps
    B.taper(P, 'sa part d’octobre (fictif)', '2026-11-01'); B.noter(); await attendre(260);
    const t = B.G.fenetres[0] ? B.G.fenetres[0].titre : '';
    V(/noté aujourd’hui à 10:00 \(sur un autre appareil\)/.test(t), 'fenêtre chez B : « …à 10:00 (sur un autre appareil) »', t);
    V(nP(lireS(S)) === 1 && !S.ecritures.length, '« Annuler » chez B : la base garde UN paiement', JSON.stringify(S.ecritures));
  }

  console.log('\n-- 6. hors ligne : comparé à ce que l’appareil connaît + sa file ; la fenêtre le dit --');
  {
    H.t = local('2026-11-01T10:10:00');
    let r = await scenario('horsligne', { virements: deja10() }, (A, S) => { S.coupe = true; }, (A) => A.taper(P, '', '2026-11-01'));
    V(!!r.fenetre && /^Pas de réseau : l’autre appareil n’a pas pu être vérifié/.test(r.fenetre.texte), 'hors ligne + même montant en mémoire : fenêtre « Pas de réseau : l’autre appareil n’a pas pu être vérifié… »', r.fenetre && r.fenetre.texte);
    V(r.pendant.file === 0 && r.apres.file === 0, 'hors ligne, « Annuler » : rien en file');
    r = await scenario('horsligne2', { virements: deja10() }, (A, S) => { S.coupe = true; }, (A) => A.taper(123.45, '', '2026-11-01'));
    V(!r.fenetre && r.apres.file === 1, 'hors ligne + autre montant : aucune fenêtre, gardé en file comme avant', r.fenetre && r.fenetre.titre);
    r = await scenario('muet', { virements: deja10() }, (A, S) => { S.muet = true; }, (A) => A.taper(P, '', '2026-11-01'));
    await attendre(120);
    V(!!r.A.G.fenetres[0] && /^Pas de réseau/.test(r.A.G.fenetres[0].texte), 'base muette (délai dépassé) : même chose que hors ligne', r.A.G.fenetres[0] && r.A.G.fenetres[0].texte);
    // file d'attente seulement (noté hors ligne, pas encore dans le cloud)
    const S = nouveauServeur({ virements: DEPART() });
    const A = appareil(S, { reponses: [undefined, 'annuler'] }); A.charger();
    S.coupe = true; H.t = local('2026-11-01T10:00:00');
    A.taper(P, 'hors ligne (fictif)', '2026-11-01'); A.noter(); await attendre(260);
    V(A.G.file.length === 1 && !A.G.fenetres.length, 'noté hors ligne : en file, aucune fenêtre', A.G.fenetres.length);
    H.t = local('2026-11-01T10:05:00');
    A.taper(P, 'encore (fictif)', '2026-11-01'); A.noter(); await attendre(260);
    const fz = A.G.fenetres[0];
    V(!!fz && /sur cet appareil\)/.test(fz.titre) && /pas encore dans le cloud/.test(fz.detail), 'encore hors ligne : fenêtre « sur cet appareil », « pas encore dans le cloud »', fz && (fz.titre + ' | ' + fz.detail));
    V(A.G.file.length === 1, '« Annuler » : la file garde UN paiement');
  }

  console.log('\n-- 7. paiement ancien sans heure de saisie (« L-… ») : sa date compte, toute la journée --');
  {
    H.t = local('2026-11-01T10:00:00');
    const anc = (d) => ({ virements: DEPART().concat([{ date: d, amount: P, note: 'ancien (fictif)' }]) });
    let r = await scenario('L-jour', anc('2026-11-01'), null, (A) => A.taper(P, '', '2026-11-01'));
    V(r.A.lire().some((v) => String(v.id).startsWith('L-2026-11-01|')), 'le paiement ancien a un identifiant « L-… » (aucune heure)');
    V(!!r.fenetre && /^Un paiement de \$1,090\.81 daté du 1er nov\. est déjà noté/.test(r.fenetre.titre), 'daté du jour : fenêtre « daté du 1er nov. est déjà noté » (aucune heure inventée)', r.fenetre && r.fenetre.titre);
    r = await scenario('L-29', anc('2026-10-29'), null, (A) => A.taper(P, '', '2026-11-01'));
    V(!r.fenetre, 'daté du 29 oct. (fini plus de 48 h avant) : aucune fenêtre', r.fenetre && r.fenetre.titre);
    r = await scenario('vieil-id', { virements: DEPART().concat([{ id: 'vfictif00', date: '2026-11-01', amount: P, note: '' }]) }, null, (A) => A.taper(P, '', '2026-11-01'));
    V(!!r.fenetre && /daté du/.test(r.fenetre.titre), 'identifiant qui ne porte pas d’heure plausible : traité comme ancien (sa date)', r.fenetre && r.fenetre.titre);
  }

  console.log('\n-- 8. un paiement SUPPRIMÉ ne compte pas ; la lecture seule ne change rien --');
  {
    H.t = local('2026-11-01T10:10:00');
    const init = { virements: deja10(), virements_supprimes: [{ k: idA(local('2026-11-01T10:00:00')), le: '2026-11-01T09:05:00.000Z', par: 'Essai' }] };
    let r = await scenario('supprime', init, null, (A) => A.taper(P, '', '2026-11-01'));
    V(!r.fenetre && nP(r.base) === 1, 'supprimé (pierre tombale en base) puis renoté : aucune fenêtre', r.fenetre && r.fenetre.titre);
    const S = nouveauServeur({ virements: deja10() });
    const A = appareil(S, { lecture: true }); A.charger();
    const l0 = S.lectures;
    A.taper(P, '', '2026-11-01'); A.noter(); await attendre(120);
    V(!A.G.fenetres.length && !S.ecritures.length && S.lectures === l0, 'lecture seule : aucune fenêtre, aucune lecture en plus, 0 écriture (refusé comme avant)', S.ecritures.length);
  }

  console.log('\n-- 9. une panne ici ne bloque JAMAIS un paiement : on retombe sur l’enregistrement d’avant --');
  {
    H.t = local('2026-11-01T10:10:00');
    const r = await scenario('panne', { virements: deja10() }, null, (A) => A.taper(P, 'fenêtre en panne (fictif)', '2026-11-01'), 'erreur');
    V(nP(r.base) === 2, 'la fenêtre ne peut pas s’ouvrir : le paiement est écrit comme avant', nP(r.base));
  }

  console.log('\n-- 10. deux touchers pendant la vérification : UNE seule question --');
  {
    H.t = local('2026-11-01T10:10:00');
    const S = nouveauServeur({ virements: deja10() });
    const A = appareil(S, { reponses: ['annuler', 'annuler'] }); A.charger();
    A.taper(P, '', '2026-11-01'); A.noter(); A.noter(); await attendre(260);
    V(A.G.fenetres.length === 1 && !S.ecritures.length, 'deux touchers : une seule fenêtre, rien d’écrit', A.G.fenetres.length);
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
