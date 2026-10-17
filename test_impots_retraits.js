// L'ARGENT DES IMPÔTS DÉJÀ RETIRÉ EN LIQUIDE (« J'ai déjà retiré l'argent », 16/10) est de l'ARGENT : la liste des retraits
// passe par LA fonction générale d'écriture des listes partagées (`_saveVirements(cle, liste, o)`, via `_listeDeclarer` /
// `_listeEcrire`), comme les impôts payés et les paiements à la modèle. Prouvé sur le VRAI code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec un faux serveur
// en mémoire. Il ne touche jamais la vraie base. (Règle de la maison : on ne teste jamais sur la base réelle.)
//
// Ce qu'il surveille :
//  0. UNE seule écriture (`_ecrireImpotsRetraits` → `_listeEcrire('impots_retraits')`), aucune écriture directe du réglage ;
//     la liste est DÉCLARÉE (identifiant, suppressions de cet appareil, titre et pluriel) : file d'attente, import, restauration.
//  1. DEUX APPAREILS (le vrai `_saveVirements`) : un retrait noté ici n'efface pas celui de l'autre ; une suppression laisse
//     une PIERRE TOMBALE partagée (`impots_retraits_supprimes`) ; un appareil ouvert avant ne la ressuscite pas.
//  2. LECTURE SEULE : aucune écriture.   3. RÉGLAGE ILLISIBLE : rien d'écrit par-dessus.
//  4. Le réglage suit tous les chemins des données (chargement, copie de l'appareil, copie de secours, sauvegarde datée,
//     déconnexion) ; « J'ai déjà retiré l'argent » et la suppression passent par la file et l'Historique.
//
// Lancer : node test_impots_retraits.js            (ou : node test_impots_retraits.js <autre_page.html> — elle doit y échouer)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.error('  KO  ' + quoi + (detail ? ' -> ' + String(detail).slice(0, 300) : '')); }
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

let CODE, BLOC;
try {
  CODE = ['_cleVirement', '_saveVirements', '_listeDeclarer', '_listeEcrire', '_impLire', '_irCle', '_irNouvelId', '_irValide', '_irRetraits',
          '_irCharger', '_irDeclarer', '_ecrireImpotsRetraits'].map(extraire).join('\n');
  const a = SRC.indexOf('// ══ feat8_impots_reels'), b = SRC.indexOf('// ══ fin feat8 · IMPÔTS RÉELS');
  if (a < 0 || b < a) throw new Error('bloc des impôts réels introuvable');
  BLOC = SRC.slice(a, b);
} catch (e) {
  console.error('  KO  les retraits (ou la fonction générale des listes) sont absents de la page : ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

function nouveauServeur(init) {
  const S = { donnees: Object.assign({}, init || {}), ecritures: [] };
  S.fetch = async (url, o) => {
    if (!o || !o.method || o.method === 'GET') {
      const m = /[?&]cles=([^&]*)/.exec(url);
      const cles = m ? decodeURIComponent(m[1]).split(',') : Object.keys(S.donnees);
      const r = {}; cles.forEach((k) => { if (k in S.donnees) r[k] = S.donnees[k]; }); return r;
    }
    const b = JSON.parse(o.body); S.ecritures.push(b.key); S.donnees[b.key] = b.value; return { ok: true };
  };
  return S;
}
function appareil(serveur, etat) {
  const G = { lecture: !!etat.lecture, rendus: 0 };
  const f = new Function('apiFetch', 'G', 'console',
    'var virements = [], _VIREMENTS_SUPPRIMES = new Set(), _dirty = {}, _currentUser = "Essai", _LISTES = {};\n' +
    'var impotsRetraits = ' + JSON.stringify(etat.liste || []) + ', _IR_SUPPRIMES = new Set(), _irIllisible = false;\n' +
    'function ecritureInterdite(){ return G.lecture; } function renderModelShare(){} function _impRedessiner(){ G.rendus++; }\n' +
    CODE + '\n_irDeclarer();\n' +
    'return { G: G, liste: function(){ return impotsRetraits; }, noter: function(x){ impotsRetraits.push(x); return _ecrireImpotsRetraits(); },' +
    ' supprimer: function(id){ _IR_SUPPRIMES.add(id); impotsRetraits = impotsRetraits.filter(function(x){ return _irCle(x) !== id; }); return _ecrireImpotsRetraits(); },' +
    ' ecrire: function(){ return _ecrireImpotsRetraits(); }, charger: function(t){ _irCharger(t); }, valides: function(){ return _irRetraits(); },' +
    ' declaree: function(){ return _LISTES.impots_retraits; } };');
  return f((u, x) => serveur.fetch(u, x), G, { warn() {}, info() {} });
}
const lireL = (S, k) => JSON.parse(S.donnees[k] || '[]');
const ids = (l) => l.map((p) => p.id).sort().join(',');
const dans = (nom, re, quoi) => { let c = ''; try { c = extraire(nom); } catch (e) {} V(re.test(c), quoi, nom); };

(async () => {
  const R1 = { id: 'r1', date: '2026-10-16', amount: 494, le: '2026-10-16T09:00:00.000Z' };
  const R2 = { id: 'r2', date: '2026-11-20', amount: 50, le: '2026-11-20T09:00:00.000Z' };
  const R3 = { id: 'r3', date: '2026-12-01', amount: 68, le: '2026-12-01T09:00:00.000Z' };

  console.log('\n-- 0. une seule écriture, par la fonction générale ; la liste est déclarée --');
  V(/_listeEcrire\('impots_retraits'\)/.test(extraire('_ecrireImpotsRetraits')) && !/_pushSetting\(\s*'impots_retraits'/.test(SRC) && !/key:\s*'impots_retraits'/.test(SRC),
    'le réglage impots_retraits n’est écrit QUE par _listeEcrire (aucune écriture directe dans la page)');
  const dec = extraire('_irDeclarer');
  V(/_listeDeclarer\('impots_retraits'/.test(dec) && /cleDe:/.test(dec) && /supprimes: _IR_SUPPRIMES/.test(dec) && /titre: 'retrait des impôts', titres: 'retraits des impôts'/.test(dec)
    && /\n_irDeclarer\(\);/.test(SRC), 'la liste est déclarée (identifiant, suppressions de cet appareil, titre et pluriel), au chargement de la page');

  console.log('\n-- 1. deux appareils (la vraie fonction générale) --');
  {
    const S = nouveauServeur({ impots_retraits: JSON.stringify([R1, R2]) });
    const tel = appareil(S, { liste: [R1, R2] });
    const pc = appareil(S, { liste: [R1, R2] });             // ouvert AVANT
    V(await tel.noter(R3) === true, 'téléphone : un retrait noté, écrit et VU en base');
    V(ids(lireL(S, 'impots_retraits')) === 'r1,r2,r3', 'en base : les trois retraits', ids(lireL(S, 'impots_retraits')));
    V(await pc.supprimer('r2') === true, 'ordinateur (liste périmée) supprime un retrait : écrit et vérifié');
    V(ids(lireL(S, 'impots_retraits')) === 'r1,r3', 'en base : le retrait du téléphone GARDÉ, celui supprimé parti', ids(lireL(S, 'impots_retraits')));
    V(lireL(S, 'impots_retraits_supprimes').some((t) => t.k === 'r2' && t.le && t.par), 'la suppression laisse une pierre tombale partagée (qui, quand)');
    V(ids(pc.liste()) === 'r1,r3' && pc.G.rendus >= 1, 'l’écran de l’ordinateur récupère le retrait du téléphone (et se redessine)', ids(pc.liste()));
    V(await tel.ecrire() === true && ids(lireL(S, 'impots_retraits')) === 'r1,r3', 'le téléphone (ouvert avant la suppression) réécrit : le retrait supprimé NE revient PAS', ids(lireL(S, 'impots_retraits')));
  }

  console.log('\n-- 2. lecture seule --');
  {
    const S = nouveauServeur({ impots_retraits: JSON.stringify([R1]) });
    const ro = appareil(S, { liste: [R1], lecture: true });
    const r = await ro.noter(R2);
    V(r === false && S.ecritures.length === 0 && ids(lireL(S, 'impots_retraits')) === 'r1', 'rien ne part, la base est intacte', String(r));
  }

  console.log('\n-- 3. réglage illisible au chargement : on refuse au lieu d’écraser --');
  {
    const S = nouveauServeur({ impots_retraits: '{pas du json' });
    const a = appareil(S, {});
    a.charger('{pas du json');
    V((await a.noter(R1)) === false && S.donnees.impots_retraits === '{pas du json' && S.ecritures.length === 0, 'false, rien écrit par-dessus');
    const b = appareil(S, {});
    b.charger(null);
    V(JSON.stringify(b.liste()) === '[]', 'réglage absent : liste vide (pas une erreur)');
    const c = appareil(S, { liste: [R1, { id: 'x', date: 'hier', amount: 5 }, { id: 'y', date: '2026-10-16', amount: -1 }, { id: 'z', date: '2026-10-16', amount: 'abc' }] });
    V(ids(c.valides()) === 'r1' && c.liste().length === 4, 'lignes illisibles gardées, jamais comptées (seul r1 compte)');
    V(c.declaree().cleDe(R1) === 'r1' && c.declaree().supprimes instanceof Set, 'la déclaration donne l’identifiant de chaque retrait');
  }

  console.log('\n-- 4. le réglage suit TOUS les chemins des données --');
  V(/_irCharger\(apiSettings && apiSettings\.impots_retraits\)/.test(SRC), 'lu au chargement (cloud)');
  dans('loadLocal', /cleLocale\('impots_retraits'\)/, 'lu hors ligne (copie de cet appareil)');
  dans('saveData', /cleLocale\('impots_retraits'\)/, 'copié sur l’appareil à chaque enregistrement');
  dans('exportData', /impots_retraits:/, 'mis dans la copie de secours (l’aperçu d’import reprend les listes déclarées)');
  V(/_snapContenu = function\(\)\{ var c = _scIr\.apply\(this, arguments\);[^\n]*c\.impots_retraits = /.test(BLOC), 'mis dans chaque sauvegarde datée (l’aperçu de restauration le reprend)');
  V(/var _CLES_COPIES = \[[^\]]*'impots_retraits'[^\]]*\];/.test(SRC), 'effacé de l’appareil à la déconnexion (_CLES_COPIES)');
  dans('ipRetraitEnregistrer', /_attenteNoter\('impots_retraits', 'aj'/, 'l’ajout est gardé dans la file d’attente tant qu’il n’est pas vu en base');
  dans('ipRetraitEnregistrer', /_ecrireImpotsRetraits\(\)/, 'l’ajout est écrit par la fonction générale');
  dans('ipRetraitEnregistrer', /logEdit\('Ajout retrait impots'/, 'l’ajout est journalisé (Historique)');
  dans('ipRetraitEnregistrer', /ecritureInterdite\(/, 'la garde « lecture seule » est là où l’écriture part');
  dans('ipRetraitEnregistrer', /lireMontant\(/, 'le montant est lu comme partout où l’argent est enregistré (lireMontant)');
  dans('ipRetraitEnregistrer', /_irVerifier\('retrait'/, 'le même montant dans les 48 h : la vérification (base relue) et la question avant d’écrire');
  dans('supprimerImpotRetrait', /showConfirm\(/, 'la suppression demande d’abord');
  dans('supprimerImpotRetrait', /_IR_SUPPRIMES\.add\(/, 'la suppression pose une pierre tombale (partagée par la fonction générale)');
  dans('supprimerImpotRetrait', /_attenteNoter\('impots_retraits', 'sup'/, 'la suppression est gardée dans la file d’attente');
  dans('supprimerImpotRetrait', /logEdit\('Suppression retrait impots'/, 'la suppression est journalisée');
  V(/if\(\/\^ajout retrait imp\/i\.test\(a\)\) return 'Argent des impôts retiré \(liquide\)';/.test(BLOC) && /if\(\/\^suppression retrait imp\/i\.test\(a\)\) return 'Retrait des impôts supprimé';/.test(BLOC),
    'l’Historique l’écrit en français clair');
  // (17/10) une seule lecture de la base est permise : la relecture de la liste avant la question « c'est un autre paiement ? »
  // (GET, sans option) ; aucune autre utilisation d'apiFetch, aucune écriture directe
  const LECTURE = "apiFetch('/api/settings?cles=' + cle + ',' + cle + '_supprimes')";
  const BLOC_SC = BLOC.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
  V(BLOC_SC.split(LECTURE).length === 2 && !/localStorage|sessionStorage|indexedDB|apiFetch\(|_pushSetting\(|method:/.test(BLOC_SC.split(LECTURE).join('')),
    'le bloc des impôts réels ne touche ni au stockage de l’appareil ni à la base directement (une seule LECTURE, la relecture avant la question ; écrire = la fonction générale)');

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
