// LES IMPÔTS PAYÉS (« J'ai payé les impôts », liste du mois) sont de l'ARGENT : ils passent par LA fonction générale
// d'écriture des listes partagées (`_saveVirements(cle, liste, o)`, via `_listeDeclarer` / `_listeEcrire`), comme les
// paiements à la modèle. Prouvé sur le VRAI code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec un faux serveur
// en mémoire. Il ne touche jamais Supabase. (Règle de la maison : on ne teste jamais sur la base réelle — des essais
// d'aperçu ont déjà DÉTRUIT de vrais virements, deux fois.)
//
// Ce qu'il surveille :
//  0. UNE seule écriture (`_ecrireImpotsPayes` → `_listeEcrire('impots_payes')`), aucune écriture directe du réglage ;
//     la liste est DÉCLARÉE (identifiant, suppressions de cet appareil, titre) : file d'attente, import, restauration.
//  1. DEUX APPAREILS (le vrai `_saveVirements`) : le téléphone note les impôts d'octobre pendant que l'ordinateur, ouvert
//     avant, en supprime un autre : rien ne disparaît sans qu'on l'ait demandé, la suppression laisse une PIERRE TOMBALE
//     partagée (`impots_payes_supprimes`) et un appareil ouvert avant ne la ressuscite pas.
//  2. LECTURE SEULE : aucune écriture ne part.   3. RÉGLAGE ILLISIBLE au chargement : rien n'est écrit par-dessus.
//  4. Les montants qui cochent la ligne.          5. Le réglage suit tous les chemins des données.
//  6. Aucune règle parallèle : la liste lit le calcul de la Part de la modèle, du bloc impôts et du rappel.
//
// Lancer : node test_impots_payes.js            (ou : node test_impots_payes.js <autre_page.html> — elle doit y échouer
//          si la page ne sait pas noter les impôts payés)
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

/** Découpe une fonction du fichier source par équilibrage des accolades. */
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

let CODE;
try {
  CODE = ['_cleVirement', '_saveVirements', '_listeDeclarer', '_listeEcrire', '_cleImpot', '_nouvelIdImpot', '_impLire',
          '_impCharger', '_impValide', '_impPayeCts', '_impDeclarer', '_ecrireImpotsPayes'].map(extraire).join('\n');
} catch (e) {
  console.error('  KO  les fonctions des impôts payés (ou la fonction générale) sont absentes de la page : ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

// ── Faux monde : UNE base (objet), des appareils (chacun ses globales), le journal des écritures ────────────────
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
    'var impotsPayes = ' + JSON.stringify(etat.liste || []) + ', _IMPOTS_SUPPRIMES = new Set(), _impIllisible = false;\n' +
    'function ecritureInterdite(){ return G.lecture; } function renderModelShare(){} function _impRedessiner(){ G.rendus++; }\n' +
    CODE + '\n_impDeclarer();\n' +
    'return { G: G, liste: function(){ return impotsPayes; }, noter: function(p){ impotsPayes.push(p); return _ecrireImpotsPayes(); },' +
    ' supprimer: function(id){ _IMPOTS_SUPPRIMES.add(id); impotsPayes = impotsPayes.filter(function(x){ return _cleImpot(x) !== id; }); return _ecrireImpotsPayes(); },' +
    ' ecrire: function(){ return _ecrireImpotsPayes(); }, charger: function(t){ _impCharger(t); }, paye: function(ym){ return _impPayeCts(ym); },' +
    ' declaree: function(){ return _LISTES.impots_payes; } };');
  return f((u, x) => serveur.fetch(u, x), G, { warn() {}, info() {} });
}
const lireL = (S, k) => JSON.parse(S.donnees[k] || '[]');
const ids = (l) => l.map((p) => p.id).sort().join(',');

(async () => {
  const OCT = { id: 'i1', mois: '2026-10', date: '2026-11-15', amount: 100, le: '2026-11-15T09:00:00.000Z' };
  const SEP = { id: 'i2', mois: '2026-09', date: '2026-10-15', amount: 112, le: '2026-10-15T09:00:00.000Z' };
  const AOU = { id: 'i3', mois: '2026-08', date: '2026-09-15', amount: 94, le: '2026-09-15T09:00:00.000Z' };

  console.log('\n-- 0. une seule écriture, par la fonction générale ; la liste est déclarée --');
  const corps = extraire('_ecrireImpotsPayes');
  V(/_listeEcrire\('impots_payes'\)/.test(corps) && !/_pushSetting\(\s*'impots_payes'/.test(SRC) && !/key:\s*'impots_payes'/.test(SRC),
    'le réglage impots_payes n’est écrit QUE par _listeEcrire (aucune écriture directe dans la page)');
  const dec = extraire('_impDeclarer');
  V(/_listeDeclarer\('impots_payes'/.test(dec) && /cleDe:/.test(dec) && /supprimes:\s*_IMPOTS_SUPPRIMES/.test(dec) && /titre:/.test(dec)
    && /\n_impDeclarer\(\);/.test(SRC), 'la liste est déclarée (identifiant, suppressions de cet appareil, titre), au chargement de la page');

  console.log('\n-- 1. deux appareils (la vraie fonction générale) --');
  {
    const S = nouveauServeur({ impots_payes: JSON.stringify([SEP, AOU]) });
    const tel = appareil(S, { liste: [SEP, AOU] });
    const pc = appareil(S, { liste: [SEP, AOU] });            // ouvert AVANT
    V(await tel.noter(OCT) === true, 'téléphone : octobre noté, écrit et VU en base');
    V(ids(lireL(S, 'impots_payes')) === 'i1,i2,i3', 'en base : août, septembre, octobre', ids(lireL(S, 'impots_payes')));
    V(await pc.supprimer('i3') === true, 'ordinateur (liste périmée, sans octobre) supprime août : écrit et vérifié');
    V(ids(lireL(S, 'impots_payes')) === 'i1,i2', 'en base : octobre GARDÉ, août parti', ids(lireL(S, 'impots_payes')));
    V(lireL(S, 'impots_payes_supprimes').some((t) => t.k === 'i3' && t.le && t.par), 'la suppression laisse une pierre tombale partagée (qui, quand)');
    V(ids(pc.liste()) === 'i1,i2' && pc.G.rendus >= 1, 'l’écran de l’ordinateur récupère octobre (et se redessine)', ids(pc.liste()));
    V(await tel.ecrire() === true && ids(lireL(S, 'impots_payes')) === 'i1,i2', 'le téléphone (ouvert avant la suppression, avec août) réécrit : août NE revient PAS', ids(lireL(S, 'impots_payes')));
    S.ecritures = [];
    await pc.ecrire();
    V(!S.ecritures.includes('impots_payes'), 'rien de nouveau : la liste n’est pas réécrite', S.ecritures.join(','));
  }

  console.log('\n-- 2. lecture seule --');
  {
    const S = nouveauServeur({ impots_payes: JSON.stringify([SEP]) });
    const ro = appareil(S, { liste: [SEP], lecture: true });
    const r = await ro.noter(OCT);
    V(r === false && S.ecritures.length === 0 && ids(lireL(S, 'impots_payes')) === 'i2', 'rien ne part, la base est intacte', String(r));
  }

  console.log('\n-- 3. réglage illisible au chargement : on refuse au lieu d’écraser --');
  {
    const S = nouveauServeur({ impots_payes: '{pas du json' });
    const a = appareil(S, {});
    a.charger('{pas du json');
    V((await a.noter(OCT)) === false && S.donnees.impots_payes === '{pas du json' && S.ecritures.length === 0, 'false, rien écrit par-dessus');
    const b = appareil(S, {});
    b.charger(null);
    V(JSON.stringify(b.liste()) === '[]', 'réglage absent : liste vide (pas une erreur)');
  }

  console.log('\n-- 4. montants : ce qui coche la ligne des impôts --');
  {
    const a = appareil(nouveauServeur({}), { liste: [OCT, { id: 'i4', mois: '2026-10', date: '2026-11-16', amount: 0.5 }, { mois: '2026-10', amount: 'abc' },
      { mois: 'octobre', amount: 9 }, SEP] });
    V(a.paye('2026-10') === 10050, 'octobre : 100 $ + 0,50 $ = 10 050 centimes (les lignes illisibles ne comptent pas)', a.paye('2026-10'));
    V(a.paye('2026-09') === 11200 && a.paye('2026-07') === 0, 'chaque mois compte seulement ses paiements');
    const d = a.declaree();
    V(d && d.cleDe(OCT) === 'i1' && d.titre && d.supprimes instanceof Set, 'la déclaration donne l’identifiant de chaque paiement');
  }

  console.log('\n-- 5. le réglage suit TOUS les chemins des données --');
  const dans = (nom, re, quoi) => { let c = ''; try { c = extraire(nom); } catch (e) {} V(re.test(c), quoi, nom); };
  V(/_impCharger\(apiSettings && apiSettings\.impots_payes\)/.test(SRC), 'lu au chargement (cloud)');
  dans('loadLocal', /cleLocale\('impots_payes'\)/, 'lu hors ligne (copie de cet appareil)');
  dans('saveData', /cleLocale\('impots_payes'\)/, 'copié sur l’appareil à chaque enregistrement');
  dans('exportData', /impots_payes:/, 'mis dans la copie de secours (l’aperçu d’import reprend les listes déclarées)');
  dans('_snapContenu', /impots_payes:/, 'mis dans chaque point de restauration (l’aperçu de restauration le reprend)');
  dans('listeImpotsEnregistrer', /_attenteNoter\('impots_payes', 'aj'/, 'l’ajout est gardé dans la file d’attente tant qu’il n’est pas vu en base');
  dans('listeImpotsEnregistrer', /_ecrireImpotsPayes\(\)/, 'l’ajout est écrit par la fonction générale');
  dans('listeImpotsEnregistrer', /logEdit\('Ajout paiement impots'/, 'l’ajout est journalisé (Historique)');
  dans('listeImpotsEnregistrer', /ecritureInterdite\(/, 'la garde « lecture seule » est là où l’écriture part');
  dans('listeImpotsEnregistrer', /lireMontant\(/, 'le montant est lu comme partout où l’argent est enregistré (lireMontant)');
  dans('supprimerImpotPaye', /showConfirm\(/, 'la suppression demande d’abord');
  dans('supprimerImpotPaye', /_IMPOTS_SUPPRIMES\.add\(/, 'la suppression pose une pierre tombale (partagée par la fonction générale)');
  dans('supprimerImpotPaye', /_attenteNoter\('impots_payes', 'sup'/, 'la suppression est gardée dans la file d’attente');
  dans('supprimerImpotPaye', /logEdit\('Suppression paiement impots'/, 'la suppression est journalisée');
  dans('_hlTitre', /ajout paiement imp/, 'l’Historique l’écrit en français clair');

  console.log('\n-- 6. aucune règle parallèle : la liste lit le calcul de la Part de la modèle --');
  dans('renderModelShare', /_partModele\(\)/, 'la Part de la modèle calcule par _partModele');
  dans('_partModele', /saMoitie\(/, 'qui est le calcul au centime des calculs (saMoitie)');
  dans('_lmLigneModele', /_partModele\(/, 'la liste du mois aussi');
  dans('_lmLigneImpots', /_chFrais\(_bilansMois\(/, 'les impôts du mois : le calcul du bloc « Impôts à garder de côté »');
  dans('_lmLigneBilan', /_rappelBilan\(\)/, 'le bilan : la règle du rappel (fin de mois)');
  dans('_lmLigneBilan', /_bilanNonFinalise\(\)/, 'le bilan : la règle du rappel (début de mois)');

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + ' — ' + n + ' contrôles');
  process.exit(ko ? 1 : 0);
})();
