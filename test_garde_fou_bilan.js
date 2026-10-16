// TOUS LES MONTANTS DU BILAN PASSENT PAR LE GARDE-FOU (relecture du 16/10, R1) — et l'objectif du mois aussi.
//
// ⚠️ LE DÉFAUT : `se()` contrôlait ['ib','itg','ici','ich'] + les dépenses diverses. `ici` et `ich` n'existaient plus
// (les postes sont devenus des LIGNES `lv-va-*`, `lv-mo-*`, `lv-ci-*`, `lv-ch-*`) : verifierMontants les sautait sans
// bruit. Dans un navigateur en français, « 1,000 » tapé arrive « 1.000 » : une ligne VA « 1,250 » enregistrait 1,25 $
// (bénéfice gonflé de 1 248,75 $, 624 $ de trop envoyés à la modèle) ; une ligne à −500 retirait 500 du total VA.
// Frère : l'objectif du mois (`saveMonthlyGoal`, parseFloat) : « 15,000 » devenait 15 $.
//
// Prouvé sur le VRAI code de index.html : `se()` et `saveMonthlyGoal()` tournent dans un faux monde (aucune connexion,
// valeurs inventées). Dans `se()`, la suite du chemin (après le garde-fou) est remplacée par un témoin : s'il est
// atteint, le montant a été ACCEPTÉ.
//
//     node test_garde_fou_bilan.js [autre/index.html]      (sur final25.html : doit ÉCHOUER)
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
const a = (nom) => SRC.includes('function ' + nom + '(');

// ── 1. le formulaire du bilan : se() ────────────────────────────────────────────────────────────────────────────
const CODE_SE = ['lireMontant', 'verifierMontants', 'gv', 'se'].map(extraire).join('\n');
function essaiBilan(champs, lignes) {
  // champs : id -> valeur ; lignes : { va: [n…], mo: […], ci: […], ch: […] } (les lignes affichées) ; afs : dépenses diverses
  const msgs = [], notes = [];
  const doc = { getElementById: (id) => (id in champs ? { id: id, value: champs[id], focus() {} } : (id === 'entry-date-input' ? { id: id, value: '2026-10-01', focus() {} } : null)) };
  const LP = { va: { ids: (lignes.va || []) }, mo: { ids: (lignes.mo || []) }, ci: { ids: (lignes.ci || []) }, ch: { ids: (lignes.ch || []) } };
  const f = new Function('document', '_LP', 'afs', 'flashMsg', '_fmNoter', '_TAUX', 'totLP',
    'var _dlgOuvert = false, _seVerif = false, _editingId = "e-banc", acd = null;\n' +
    'function _pasCharge(){ return false; } function _kpiNum(){ return 0; } function ts(){ return "2026-10-16"; }\n' +
    CODE_SE + '\nreturn se;');
  const se = f(doc, LP, lignes.afs || [], (id, m) => msgs.push([id, String(m)]), (e) => notes.push(e ? e.id : null), 0.8,
    () => { throw new Error('SUITE'); });
  let suite = false;
  try { se(); } catch (e) { if (String(e && e.message) === 'SUITE') suite = true; else throw e; }
  const refus = msgs.filter((m) => /^⚠/.test(m[1]));
  return { accepte: suite && !refus.length, refuse: !suite && refus.length > 0, message: refus.length ? refus[0][1] : '', champ: notes.filter(Boolean).pop() || null };
}

console.log('\n-- 1. témoins : la règle elle-même, et un montant propre passe --');
{
  const t = essaiBilan({ ib: '7310', itg: '', 'lv-va-1': '790' }, { va: [1] });
  V(t.accepte, 'témoin : une ligne VA « 790 » est ACCEPTÉE (le chemin après le garde-fou est atteint)', JSON.stringify(t));
  const t2 = essaiBilan({ ib: '1.000', itg: '' }, {});
  V(t2.refuse && /3 décimales/.test(t2.message), 'témoin : « 1,000 » dans Net OnlyFans est refusé (règle existante)', JSON.stringify(t2));
  const t3 = essaiBilan({ ib: '5000', 'av-1': '-500' }, { afs: [1] });
  V(t3.refuse && /négatif/i.test(t3.message), 'témoin : −500 dans une dépense diverse est refusé (règle existante)', JSON.stringify(t3));
}

console.log('\n-- 2. chaque ligne VA / Modèle / Chat IA / Chat humain passe par le garde-fou --');
for (const [k, nom] of [['va', 'VA'], ['mo', 'Modèle'], ['ci', 'Chat IA'], ['ch', 'Chat humain']]) {
  const L = {}; L[k] = [1, 2];
  const c = {}; c.ib = '7310'; c['lv-' + k + '-1'] = '200'; c['lv-' + k + '-2'] = '1.000';
  const r = essaiBilan(c, L);
  V(r.refuse && /3 décimales/.test(r.message), nom + ' : « 1,000 » (navigateur : « 1.000 ») dans la 2e ligne est REFUSÉ', JSON.stringify(r));
  V(r.champ === 'lv-' + k + '-2', nom + ' : … et c’est CETTE ligne qui est désignée (le message va sous elle)', r.champ);
  const c2 = {}; c2.ib = '7310'; c2['lv-' + k + '-1'] = '-500';
  const r2 = essaiBilan(c2, (() => { const o = {}; o[k] = [1]; return o; })());
  V(r2.refuse && /négatif/i.test(r2.message), nom + ' : −500 est REFUSÉ', JSON.stringify(r2));
  const c3 = {}; c3.ib = '7310'; c3['lv-' + k + '-1'] = '12.50';
  const r3 = essaiBilan(c3, (() => { const o = {}; o[k] = [1]; return o; })());
  V(r3.accepte, nom + ' : « 12.50 » (deux décimales : un vrai montant) est accepté', JSON.stringify(r3));
}

console.log('\n-- 3. l’ordre de l’écran : le premier champ fautif est désigné --');
{
  const r = essaiBilan({ ib: '1.000', 'lv-va-1': '1.000' }, { va: [1] });
  V(r.champ === 'ib', 'Net OnlyFans et une ligne VA fautifs : Net OnlyFans d’abord (en haut)', r.champ);
  const r2 = essaiBilan({ ib: '5000', 'lv-ch-1': '-1', 'av-1': '1.000' }, { ch: [1], afs: [1] });
  V(r2.champ === 'lv-ch-1', 'Chat humain puis dépense diverse fautifs : la ligne Chat humain d’abord', r2.champ);
}

console.log('\n-- 4. plus d’identifiant mort dans la liste contrôlée --');
{
  const corps = extraire('se');
  V(!/'ici'|'ich'/.test(corps), 'se() ne contrôle plus « ici » / « ich » (cases disparues)', (corps.match(/\[[^\]]*'ici'[^\]]*\]/) || [''])[0]);
}

// ── 2. l'objectif du mois : saveMonthlyGoal() ───────────────────────────────────────────────────────────────────
console.log('\n-- 5. l’objectif du mois : « 15,000 » n’est plus enregistré 15 $ --');
const CODE_OBJ = ['lireMontant', 'verifierMontants', 'gv', 'saveMonthlyGoal'].concat(a('objectifDuChamp') ? ['objectifDuChamp'] : []).map(extraire).join('\n');
async function essaiObjectif(valeur, cache) {
  const ecritures = [], msgs = [], gardes = [];
  const doc = { getElementById: (id) => (id === 'monthly-goal' ? { id: id, value: valeur, focus() {} } : null) };
  const f = new Function('document', 'apiFetch', 'flashMsg', 'showSaveStatus', '_fileReglageNoter', '_fileReglageFait', '_settingsCache',
    'var _apiConnected = true, _objEnregistre = null; function ecritureInterdite(){ return false; } function _fmNoter(){}\n' + CODE_OBJ +
    '\nreturn { sauver: saveMonthlyGoal, lu: (typeof objectifDuChamp === "function") ? objectifDuChamp : null };');
  const o = f(doc, async (u, x) => { if (x && x.method === 'POST') ecritures.push(JSON.parse(x.body)); return { ok: true }; },
    (id, m) => msgs.push([id, String(m)]), () => {}, (k, v) => gardes.push([k, v]), () => {}, cache || {});
  await o.sauver();
  return { ecritures, msgs, gardes, lu: o.lu ? o.lu() : null };
}
(async () => {
  const t = await essaiObjectif('15000');
  V(t.ecritures.length === 1 && t.ecritures[0].key === 'monthly_goal' && t.ecritures[0].value === 15000, 'témoin : « 15000 » est enregistré 15 000', JSON.stringify(t.ecritures));
  const r = await essaiObjectif('15.000');
  V(r.ecritures.length === 0, '« 15,000 » (navigateur : « 15.000 ») : RIEN n’est enregistré', JSON.stringify(r.ecritures));
  V(r.gardes.length === 0, '… ni gardé sur l’appareil pour être renvoyé', JSON.stringify(r.gardes));
  V(r.msgs.some((m) => m[0] === 'goal-msg' && /^⚠/.test(m[1]) && /3 décimales/.test(m[1])), '… et le refus est DIT sous le champ de l’objectif', JSON.stringify(r.msgs));
  const r2 = await essaiObjectif('-5');
  V(r2.ecritures.length === 0 && r2.msgs.some((m) => /négatif/i.test(m[1])), 'un objectif négatif est refusé', JSON.stringify([r2.ecritures, r2.msgs]));
  const r3 = await essaiObjectif('');
  V(r3.ecritures.length === 1 && r3.ecritures[0].value === 0, 'champ vidé : « pas d’objectif » (0) enregistré comme avant', JSON.stringify(r3.ecritures));
  const r4 = await essaiObjectif('20000.5');
  V(r4.ecritures.length === 1 && r4.ecritures[0].value === 20000.5, '« 20000.5 » : enregistré tel quel (aucun montant valide ne change)', JSON.stringify(r4.ecritures));

  console.log('\n-- 6. à l’écran, un objectif refusé ne devient jamais 15 $ (l’objectif enregistré reste) --');
  if (a('objectifDuChamp')) {
    V((await essaiObjectif('15.000', { monthly_goal: '20000' })).lu === 20000, 'champ « 15.000 » refusé : l’objectif qui compte reste 20 000 (enregistré)');
    V((await essaiObjectif('8000', { monthly_goal: '20000' })).lu === 8000, 'champ « 8000 » (valide) : 8 000, lu comme avant');
    V((await essaiObjectif('', { monthly_goal: '20000' })).lu === 0, 'champ vide : pas d’objectif (comme avant)');
  } else V(false, 'objectifDuChamp absente : la Prévision et la jauge lisaient « 15.000 » = 15 $ (parseFloat)');
  V(/id="goal-msg"/.test(SRC), 'la carte Prévision a la place du refus (#goal-msg)');
  for (const [nom, re] of [['renderForecast', /const goal=parseFloat\(document\.getElementById\('monthly-goal'\)\?\.value\)\|\|0;/],
                           ['_objEtat', /var goal = parseFloat\(gi && gi\.value\) \|\| 0;/]]) {
    const corps = extraire(nom);
    V(!re.test(corps), nom + ' ne lit plus l’objectif au parseFloat brut');
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
