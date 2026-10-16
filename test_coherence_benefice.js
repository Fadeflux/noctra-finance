// « NET − DÉPENSES = BÉNÉFICE », AU CENTIME ÉCRIT, PARTOUT (15/10, F1) — et les moitiés (F5).
//
// ⚠️ Aucune connexion : les fonctions sont extraites du VRAI index.html et tournent sur des bilans FICTIFS
// fabriqués ici (graine fixe). Règle de la maison : jamais la base réelle.
//
// LE DÉFAUT (F1, équipe du 15/10). Depuis le 15/10, le bénéfice de CHAQUE bilan est arrondi au centime, et le
// bénéfice d'un mois / d'une période est la somme de ces bénéfices. Mais les impôts + Paxum restaient calculés
// d'un bloc (fraisOF de la somme des nets) : « Net $29,410 − Dépenses $11,176.99 ≠ Bénéfice $18,233 » (démo,
// 3 mois), « Net $5,069.50 · Dépenses $1,220.84 · Bénéfice $3,848.67 » (un seul bilan à demi-centime).
// LA RÈGLE : centimesBilan(e) — frais d'un bilan = ce que SON bénéfice arrondi a retiré (net − dépenses − bénéfice),
// en centimes entiers ; toute somme se fait en centimes. Aucun bénéfice ne change.
//
// Partie A (existe dans toutes les versions) : getMonthlyRecap — pour chaque mois et pour le total, les montants
//   ÉCRITS (fmtC) tombent juste : Net − Dépenses = Bénéfice ; somme des mois écrits = total écrit.
// Partie B (la règle elle-même) : centimesBilan / centimesBilans / fraisBilan / depensesBilan ; saMoitie + taMoitie =
//   le montant ; evolutionPct (règle de l'accueil) ; aucun bénéfice ne bouge.
//
// Lancer : node test_coherence_benefice.js            (index.html de ce dossier)
// Témoin (doit ÉCHOUER) : node test_coherence_benefice.js ../../../final17.html
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
let echecs = 0, oks = 0;
function V(titre, cond, detail) {
  if (cond) { oks++; if (oks <= 400) console.log('  OK  ' + titre); }
  else { echecs++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

function extraire(nom) {
  for (const tete of ['function ' + nom + '(']) {
    const i = SRC.indexOf(tete);
    if (i < 0) continue;
    let prof = 0;
    for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
      if (SRC[k] === '{') prof++;
      else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
    }
  }
  return null;
}
function ligne(re, nom) {
  const m = SRC.match(re);
  if (!m) throw new Error(nom + ' introuvable dans la page');
  return m[0];
}

// --- la couche de calcul de la PAGE (pas une copie : une valeur recopiée dérive) ---
let code = '';
code += ligne(/const _TAUX=[0-9.]+;/, '_TAUX') + '\n';
code += ligne(/const _IMPOTS_OF=[0-9.]+, _PAXUM_OF=[0-9.]+(?:, _RETRAIT_LIQUIDE=[0-9.]+)?;/, 'taux') + '\n';
code += ligne(/const fmt=v=>[^\n]*/, 'fmt') + '\n';
code += ligne(/const fmtR=v=>[^\n]*/, 'fmtR') + '\n';
code += ligne(/const fmtC=v=>[^\n]*/, 'fmtC') + '\n';
for (const f of ['fraisOF', 'profitEntree', 'getMonthlyRecap']) {
  const c = extraire(f); if (!c) throw new Error(f + ' introuvable'); code += c + '\n';
}
const REGLE = ['centimesBilan', 'centimesBilans', 'fraisBilan', 'depensesBilan', 'saMoitie', 'taMoitie', 'evolutionPct'];
const presentes = REGLE.filter((f) => { const c = extraire(f); if (c) code += c + '\n'; return !!c; });
const monde = new Function('ents', 'avancesLigne',
  code + '\nreturn { fraisOF, profitEntree, getMonthlyRecap, fmtC, fmtR, '
  + presentes.map((f) => f + ': ' + f).join(', ') + ' };');
const ENTS = [];
const avancesLigne = (e, k) => ({ moi: e[k] || 0, asso: 0 });
const P = monde(ENTS, avancesLigne);

// --- bilans FICTIFS (graine fixe) ---
let graine = 20261015;
const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
const cents = (max) => Math.round(alea() * max * 100) / 100;
function bilanFictif(i) {
  const m = 1 + Math.floor(alea() * 12), j = 1 + Math.floor(alea() * 28);
  const date = '2026-' + String(m).padStart(2, '0') + '-' + String(j).padStart(2, '0');
  const sorte = alea();
  let ofNet = 0, brut = 0;
  if (sorte < 0.25) { ofNet = 49 * (2 * Math.floor(alea() * 150) + 1); brut = ofNet / 0.8; }   // frais à demi-centime
  else if (sorte < 0.40) { brut = cents(9000); ofNet = 0; }                                    // ancien bilan : brut seul
  else if (sorte < 0.50) { ofNet = 0; brut = 0; }                                               // Telegram seul
  else if (sorte < 0.55) { ofNet = cents(1500000); brut = ofNet / 0.8; }                        // énorme
  else { ofNet = cents(15000); brut = ofNet / 0.8; }
  const tg = alea() < 0.4 || !brut ? cents(2500) : 0;
  const e = { id: 'f' + i, date, brut, ofNet, tgNet: tg, va: alea() < 0.7 ? cents(1500) : 0, mo: alea() < 0.3 ? cents(3000) : 0,
    ci: alea() < 0.6 ? cents(700) : 0, ch: alea() < 0.3 ? cents(600) : 0, alT: alea() < 0.8 ? cents(alea() < 0.15 ? 9000 : 900) : 0 };
  e.profit = P.profitEntree(e);   // comme entryFromDb : le bénéfice de la règle, au centime
  return e;
}
const cts = (t) => { const m = /^(−|-)?\$([\d,]+(?:\.\d+)?)$/.exec(t); if (!m) throw new Error('montant illisible ' + t); return (m[1] ? -1 : 1) * Math.round(parseFloat(m[2].replace(/,/g, '')) * 100); };
const ecrit = (v) => (v < 0 ? '−' : '') + P.fmtC(v);

console.log('\n-- A. Récap (getMonthlyRecap) : Net − Dépenses = Bénéfice, au centime écrit --');
let koA = 0, nA = 0, koT = 0;
for (let jeu = 0; jeu < 60; jeu++) {
  ENTS.length = 0;
  const n = 1 + Math.floor(alea() * 14);
  for (let i = 0; i < n; i++) ENTS.push(bilanFictif(jeu * 100 + i));
  const data = P.getMonthlyRecap();
  const T = { net: 0, dep: 0, profit: 0 };
  let sNet = 0, sDep = 0, sPr = 0;
  for (const r of data) {
    const dep = r.va + r.mo + r.ci + r.ch + r.al + (r.fr || 0);
    nA++;
    if (cts(ecrit(r.net)) - cts(ecrit(dep)) !== cts(ecrit(r.profit))) {
      koA++; if (koA <= 6) console.log('      ' + r.key + ' : ' + ecrit(r.net) + ' − ' + ecrit(dep) + ' ≠ ' + ecrit(r.profit));
    }
    T.net += r.net; T.dep += dep; T.profit += r.profit;
    sNet += cts(ecrit(r.net)); sDep += cts(ecrit(dep)); sPr += cts(ecrit(r.profit));
  }
  if (cts(ecrit(T.net)) - cts(ecrit(T.dep)) !== cts(ecrit(T.profit)) || cts(ecrit(T.net)) !== sNet || cts(ecrit(T.dep)) !== sDep || cts(ecrit(T.profit)) !== sPr) {
    koT++; if (koT <= 4) console.log('      total : ' + ecrit(T.net) + ' − ' + ecrit(T.dep) + ' / ' + ecrit(T.profit) + ' ; sommes des mois écrits ' + [sNet, sDep, sPr].join(' / '));
  }
}
V('chaque mois du Récap : Net − Dépenses = Bénéfice au centime écrit (' + nA + ' mois, 60 jeux fictifs)', koA === 0, koA + ' mois faux');
V('total du Récap : Net − Dépenses = Bénéfice, et chaque total = la somme des mois écrits (60 jeux)', koT === 0, koT + ' totaux faux');

// exemples de la trouvaille F1 (un seul bilan, net OnlyFans 4 949 $ : frais à demi-centime)
ENTS.length = 0;
const mai = { id: 'mai', date: '2026-05-31', brut: 4949 / 0.8, ofNet: 4949, tgNet: 120.5, va: 600, mo: 0, ci: 299, ch: 0, alT: 98.12 };
mai.profit = P.profitEntree(mai); ENTS.push(mai);
const rM = P.getMonthlyRecap()[0], depM = rM.va + rM.mo + rM.ci + rM.ch + rM.al + rM.fr;
V('exemple de la trouvaille : mai « Net $5,069.50 − Dépenses = Bénéfice $3,848.67 »', ecrit(rM.net) === '$5,069.50' && ecrit(rM.profit) === '$3,848.67' && ecrit(depM) === '$1,220.83',
  ecrit(rM.net) + ' − ' + ecrit(depM) + ' / ' + ecrit(rM.profit));

console.log('\n-- B. La règle : centimesBilan, moitiés, évolution --');
V('centimesBilan / centimesBilans / fraisBilan / depensesBilan / saMoitie / taMoitie / evolutionPct existent dans la page',
  presentes.length === REGLE.length, 'absentes : ' + REGLE.filter((f) => presentes.indexOf(f) < 0).join(', '));
if (presentes.length === REGLE.length) {
  let koB = 0, koF = 0, koP = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    const e = bilanFictif(10000 + i), c = P.centimesBilan(e);
    n++;
    const entiers = ['of', 'tg', 'net', 'va', 'mo', 'ci', 'ch', 'al', 'aut', 'p', 'fr', 'dep'].every((k) => Number.isInteger(c[k]));
    if (!entiers || c.net - c.dep !== c.p || c.aut + c.fr !== c.dep || c.of + c.tg !== c.net) { koB++; if (koB <= 3) console.log('      ' + JSON.stringify(c)); }
    if (Math.abs(c.fr - P.fraisOF((e.brut || 0) * 0.8) * 100) > 1.0000001) { koF++; if (koF <= 3) console.log('      frais ' + c.fr + ' / ' + P.fraisOF((e.brut || 0) * 0.8)); }
    if (c.p !== Math.round(e.profit * 100)) koP++;
  }
  V('chaque bilan (' + n + ' fictifs) : centimes ENTIERS, Net − Dépenses = Bénéfice, postes + frais = Dépenses, OnlyFans + Telegram = Net', koB === 0, koB + ' faux');
  V('impôts + Paxum d\'un bilan à 1 centime au plus de net × 3,5 % + net × 1 % ÷ 0,98 (la règle d\'André)', koF === 0, koF + ' faux');
  V('AUCUN bénéfice ne bouge : p = le bénéfice enregistré du bilan', koP === 0, koP + ' faux');
  // somme de bilans (une période) : écrite, elle tombe juste
  let koS = 0;
  for (let k = 0; k < 500; k++) {
    const es = []; const nb = 1 + Math.floor(alea() * 20);
    for (let i = 0; i < nb; i++) es.push(bilanFictif(20000 + k * 50 + i));
    const t = P.centimesBilans(es);
    const pr = es.reduce((s, e) => s + e.profit, 0);
    if (cts(ecrit(t.net / 100)) - cts(ecrit(t.dep / 100)) !== cts(ecrit(Math.round(pr * 100) / 100)) || t.p !== Math.round(pr * 100)) koS++;
  }
  V('500 périodes fictives (1 à 20 bilans) : Net − Dépenses = Bénéfice au centime écrit, bénéfice = somme des bilans', koS === 0, koS + ' fausses');
  // ancien bilan : brut seul (net 3 333,328 $) — le net du bilan s'écrit au centime et l'égalité tient
  const anc = { brut: 4166.66, ofNet: 0, tgNet: 0, va: 500, mo: 0, ci: 299, ch: 0, alT: 0 }; anc.profit = P.profitEntree(anc);
  const ca = P.centimesBilan(anc);
  V('ancien bilan (brut 4 166,66 $, net 3 333,328 $) : net 3 333,33 $ ; Net − Dépenses = Bénéfice', ca.net === 333333 && ca.net - ca.dep === ca.p, JSON.stringify(ca));
  // brouillon sans bénéfice enregistré : le bénéfice de la règle (profitEntree)
  const br = { brut: 10000 / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0 };
  V('exemple d\'André (10 000 $ nets) : impôts + Paxum 452,04 $, bénéfice 9 547,96 $', P.fraisBilan(br) === 452.04 && P.centimesBilan(br).p === 954796 && P.depensesBilan(br) === 452.04,
    P.fraisBilan(br) + ' / ' + P.centimesBilan(br).p);
  // moitiés
  let koM = 0;
  for (let i = 0; i < 20000; i++) {
    const v = Math.round((alea() - 0.3) * 2e7) / 100;
    const s = P.saMoitie(v), t = P.taMoitie(v);
    if (Math.round(s * 100) + Math.round(t * 100) !== Math.round(v * 100) || Math.abs(Math.round(s * 100) - Math.round(t * 100)) > 1
      || !Number.isInteger(Math.round(s * 100)) || Math.round(s * 100) < Math.round(t * 100)) koM++;
  }
  V('20 000 montants : sa moitié + ta moitié = le montant au centime ; les deux à 1 centime l\'une de l\'autre ; le demi-centime va à SA moitié', koM === 0, koM + ' faux');
  V('6 343,75 $ -> sa moitié $3,171.88, ta moitié $3,171.87 (la trouvaille : 3 171,88 + 3 171,88 = 6 343,76)',
    P.fmtC(P.saMoitie(6343.75)) === '$3,171.88' && P.fmtC(P.taMoitie(6343.75)) === '$3,171.87', P.saMoitie(6343.75) + ' / ' + P.taMoitie(6343.75));
  V('14 599,91 $ -> 7 299,96 + 7 299,95', P.saMoitie(14599.91) === 7299.96 && P.taMoitie(14599.91) === 7299.95);
  // évolution (règle de l'accueil)
  const ev = (x, y) => Math.round(P.evolutionPct(x, y));
  V('−1 093,70 -> −367,31 : +66 % (comme l\'accueil ; le Récap disait « = »)', ev(-367.31, -1093.70) === 66, String(P.evolutionPct(-367.31, -1093.70)));
  V('−1 093,70 -> +2 999,46 : +374 % (le Récap disait « +100 % »)', ev(2999.46, -1093.70) === 374, String(P.evolutionPct(2999.46, -1093.70)));
  V('7 786,48 -> 4 383,91 : −44 %', ev(4383.91, 7786.48) === -44);
  V('mois d\'avant à zéro : rien à comparer (pas un faux « +100 % »)', Number.isNaN(P.evolutionPct(500, 0)) && P.evolutionPct(0, 0) === 0);
}

console.log('\n' + (echecs ? echecs + ' ECHEC(S)' : 'TOUT PASSE (' + oks + ' contrôles)') + '\n');
process.exit(echecs ? 1 : 0);
