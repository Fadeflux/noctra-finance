// PLUS AUCUNE LIGNE DU JOURNAL NE DISPARAÎT (relecture du 16/10, J4).
//
// ⚠️ LE DÉFAUT : au-delà de 225 lignes, les plus anciennes du journal partent dans l'archive (`editlog_archive`) ; mais
// l'archive s'arrêtait à 3 000 lignes : au-delà, les plus anciennes n'étaient écrites NULLE PART (« les 3 000 dernières »,
// écrit sous l'Historique). Au rythme mesuré (~70 lignes par mois), dans ~4 ans.
// La règle : au-delà de 3 500 lignes d'archive, les plus anciennes vont dans le morceau de LEUR année
// (`editlog_archive_2026`…), écrit AVANT qu'elles quittent l'archive ; un morceau n'est lu qu'à la demande.
// Prouvé sur le VRAI `_saveVirements` et le VRAI `_optsJournal` de index.html, faux serveur en mémoire, lignes inventées.
//
//     node test_journal_archive.js [autre/index.html]      (sur final25.html : doit ÉCHOUER)
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
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
const CODE = ['_cleVirement', '_saveVirements', '_optsJournal'].map(extraire).join('\n');

function nouveauServeur(init) {
  const S = { donnees: {}, ecritures: [], octets: {} };
  for (const k of Object.keys(init || {})) S.donnees[k] = JSON.stringify(init[k]);
  S.fetch = async (url, o) => {
    if (!o || !o.method || o.method === 'GET') {
      const m = /[?&]cles=([^&]*)/.exec(url);
      const cles = m ? decodeURIComponent(m[1]).split(',') : Object.keys(S.donnees);
      const r = {}; cles.forEach((k) => { if (k in S.donnees) r[k] = S.donnees[k]; }); return r;
    }
    const b = JSON.parse(o.body); S.ecritures.push(b.key); S.donnees[b.key] = b.value;
    S.octets[b.key] = Math.max(S.octets[b.key] || 0, String(b.value).length); return { ok: true };
  };
  return S;
}
function appareil(S, journal) {
  const g = { journal: journal };
  const f = new Function('apiFetch', 'G',
    'var virements = [], _VIREMENTS_SUPPRIMES = new Set(), _dirty = {}, _currentUser = "Essai", editLog = G.journal;\n' +
    'function ecritureInterdite(){ return false; } function renderModelShare(){}\n' + CODE +
    '\nreturn { noter: function(l){ editLog.unshift(l); return _saveVirements("editlog", function(){ return editLog; }, _optsJournal()); }, lire: function(){ return editLog; } };');
  return f((u, x) => S.fetch(u, x), g);
}
const T0 = 1700000000000;                                       // 14/11/2023 : des lignes fictives, une par seconde
const ligne = (i, quoi) => ({ ts: T0 + i * 1000, action: 'Note', detail: quoi + ' ' + i });
const tout = (S) => Object.keys(S.donnees).filter((k) => /^editlog(_archive.*)?$/.test(k) && !/_supprimes$/.test(k))
  .reduce((l, k) => l.concat(JSON.parse(S.donnees[k] || '[]')), []);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n-- 1. le cas de la relecture (B4) : archive à 3 000, 225 lignes vivantes, une note de plus --');
  {
    const arch = []; for (let i = 0; i < 3000; i++) arch.push(ligne(i, 'archivée')); arch.reverse();
    const viv = []; for (let i = 0; i < 225; i++) viv.push(ligne(10000 + i, 'vivante')); viv.reverse();
    const S = nouveauServeur({ editlog: viv, editlog_archive: arch });
    const A = appareil(S, viv.slice());
    V((await A.noter(ligne(20000, 'nouvelle'))) === true, 'la note est écrite et vérifiée');
    const l = tout(S);
    V(l.some((x) => x.detail === 'archivée 0'), 'la PLUS VIEILLE ligne existe encore (quelque part)', 'disparue');
    V(new Set(l.map((x) => x.detail)).size === 3226, 'aucune ligne perdue : 3 000 + 225 + 1 = 3 226', new Set(l.map((x) => x.detail)).size);
  }

  console.log('\n-- 2. archive à son plafond, journal plein : rien ne se perd, l’archive reste bornée --');
  {
    const arch = []; for (let i = 0; i < 3500; i++) arch.push(ligne(i, 'archivée')); arch.reverse();
    const viv = []; for (let i = 0; i < 225; i++) viv.push(ligne(10000 + i, 'vivante')); viv.reverse();
    const S = nouveauServeur({ editlog: viv, editlog_archive: arch });
    const A = appareil(S, viv.slice());
    await A.noter(ligne(20000, 'nouvelle'));
    let l = tout(S);
    V(new Set(l.map((x) => x.detail)).size === 3726, 'archive 3 500 + 225 + 1 : les 3 726 lignes existent toutes', new Set(l.map((x) => x.detail)).size);
    V(l.some((x) => x.detail === 'archivée 0'), 'la plus vieille ligne existe encore');
    const ka = JSON.parse(S.donnees.editlog_archive || '[]');
    V(ka.length <= 3500, 'l’archive reste bornée (≤ 3 500 lignes)', ka.length);
    const morceaux = Object.keys(S.donnees).filter((k) => /^editlog_archive_\d{4}$/.test(k));
    V(morceaux.length >= 1 && morceaux.every((k) => JSON.parse(S.donnees[k]).every((x) => String(new Date(x.ts).getFullYear()) === k.slice(-4))),
      'les lignes sorties de l’archive sont dans le morceau de LEUR année', morceaux.join(', ') || 'aucun morceau');
    // 30 notes de plus : le journal vivant déborde encore une fois vers l’archive ; rien ne se perd jamais
    for (let i = 1; i <= 30; i++) await A.noter(ligne(20000 + i, 'nouvelle'));
    await attendre(2800);                                      // le « dernier regard » 2,5 s plus tard
    l = tout(S);
    V(new Set(l.map((x) => x.detail)).size === 3756, '30 notes de plus : 3 756 lignes, toutes là', new Set(l.map((x) => x.detail)).size);
    const vives = JSON.parse(S.donnees.editlog || '[]');
    V(vives.length <= 225 && vives[0].detail === 'nouvelle 20030', 'le journal vivant reste borné (≤ 225), la plus récente en tête', vives.length + ' / ' + (vives[0] || {}).detail);
    const max = Math.max.apply(null, Object.keys(S.octets).map((k) => S.octets[k]));
    V(max < 1.2e6, 'aucune écriture ne dépasse ~1 Mo (ici ' + Math.round(max / 1024) + ' Ko pour la plus grosse)', max);
  }

  console.log('\n-- 3. « Voir l’archive » lit aussi les morceaux par année ; la phrase dit la vérité --');
  {
    const voir = extraire('_voirArchiveJournal');
    V(/_clesArchiveAnnees\(\)/.test(voir), '« Voir l’archive » demande les morceaux par année');
    V(SRC.includes('function _clesArchiveAnnees(') && new Function(extraire('_clesArchiveAnnees') + '\nreturn _clesArchiveAnnees();')().includes('editlog_archive_2023'),
      'les clés lues couvrent les années passées (ex. 2023)');
    V(!/les 3\s000 dernières|les 3 000 dernières/.test(SRC), 'plus de « les 3 000 dernières » sous l’Historique');
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
