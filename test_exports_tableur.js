// LES TABLEURS TÉLÉCHARGÉS PARLENT COMME LE SITE ET REFONT LE BÉNÉFICE TOUT SEULS (15/10, F8 + E5).
//
// ⚠️ Aucune connexion : exportCSV / exportRecapCSV sont extraits du VRAI index.html ; le « téléchargement » est
// intercepté ici (faux document, faux Blob) : on relit le fichier produit. Bilans FICTIFS.
//
// LE DÉFAUT. « Télécharger mes bilans » : colonnes « CA Brut, Telegram, VA, Modèle, Chat IA, Chat Hum., Dépenses,
// Profit » — « Dépenses » = les dépenses DIVERSES seules, ni Net ni Impôts + Paxum : avec le fichier seul, impossible de
// refaire le bénéfice (85 lignes sur 87 dans les jeux de l'analyste) ; « CA Brut » écrit tel que stocké
// (1500.1249999999998). « Télécharger le récap » : « Oct 2026 », « Profit », « Avancé Moi ». Fichiers « crm-… ».
// LA RÈGLE : les mots du site, au centime (centimesBilan, la règle de tout le site), Net total − Total dépenses =
// Bénéfice sur chaque ligne ; fichiers « noctra-finance-… ».
//
// Lancer : node test_exports_tableur.js        Témoin (doit ÉCHOUER) : node test_exports_tableur.js ../../../final17.html
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
let echecs = 0, oks = 0;
function V(titre, cond, detail) {
  if (cond) { oks++; console.log('  OK  ' + titre); } else { echecs++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}
function extraire(nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  return null;
}
const ligne = (re) => { const m = SRC.match(re); if (!m) throw new Error('introuvable ' + re); return m[0]; };

let code = ligne(/const _TAUX=[0-9.]+;/) + '\n' + ligne(/const _IMPOTS_OF=[0-9.]+, _PAXUM_OF=[0-9.]+(?:, _RETRAIT_LIQUIDE=[0-9.]+)?;/) + '\n';
for (const f of ['fraisOF', 'profitEntree', 'getMonthlyRecap', 'exportCSV', 'exportRecapCSV', 'exportData', 'ts', '_rcMois', '_rcPct',
  'centimesBilan', 'centimesBilans']) { const c = extraire(f); if (c) code += c + '\n'; }

// faux navigateur : on garde le fichier « téléchargé »
const FICHIERS = [];
const faux = {
  document: { createElement: () => { const a = { click() { FICHIERS.push({ nom: a.download, corps: a.href }); } }; return a; } },
  Blob: function (parts) { this.texte = parts.join(''); },
  URL: { createObjectURL: (b) => b.texte },
};
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monde = new Function('ents', 'vas', 'virements', 'modeles', 'avancesLigne', 'document', 'Blob', 'URL',
  'grafMoisCourt', 'grafMoisLong', 'grafCap',
  code + '\nreturn { exportCSV, exportRecapCSV, exportData, profitEntree, getMonthlyRecap };');
const ENTS = [];
const P = monde(ENTS, [], [], [], (e, k) => ({ moi: e[k] || 0, asso: 0 }), faux.document, faux.Blob, faux.URL,
  (m) => MOIS[m].slice(0, 4) + '.', (m) => MOIS[m], (s) => s.charAt(0).toUpperCase() + s.slice(1));

function bilan(id, date, of, o) {
  const e = Object.assign({ id, date, brut: of ? of / 0.8 : 0, ofNet: of, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, alI: [] }, o || {});
  e.profit = P.profitEntree(e); return e;
}
ENTS.push(bilan('a', '2026-10-01', 6543.21, { tgNet: 432.1, va: 790.4, ci: 699, alT: 668.17 }));
ENTS.push(bilan('b', '2026-09-30', 900, { va: 900, ci: 499, alT: 120 }));                       // perte
ENTS.push(bilan('c', '2026-08-31', 1200.1, { va: 900, ci: 499, ch: 450, alT: 399.99 }));        // brut 1500.1249999999998
ENTS.push(bilan('d', '2026-07-31', 0, { tgNet: 1850.4, va: 250, alT: 80.1 }));                  // Telegram seul
ENTS.push(bilan('e', '2026-05-31', 4949, { tgNet: 120.5, va: 600, ci: 299, alT: 98.12 }));      // frais à demi-centime
ENTS.push(bilan('f', '2026-06-15', 2345.67, { va: 300, alT: 150.55 }));
ENTS.push(bilan('g', '2026-06-30', 3210.98, { tgNet: 75.25, va: 300.5, ch: 150, alT: 12.99 }));
const anc = { id: 'h', date: '2026-04-30', brut: 4166.66, ofNet: 0, tgNet: 0, va: 500, mo: 0, ci: 299, ch: 0, alT: 0, alI: [] };   // ancien : brut seul
anc.profit = P.profitEntree(anc); ENTS.push(anc);

const lire = (corps) => corps.replace(/^﻿/, '').split('\n').map((l) => l.split('","').map((x) => x.replace(/^"|"$/g, '')));
const C = (x) => Math.round(parseFloat(x) * 100);

console.log('\n-- « Télécharger mes bilans (tableur) » --');
P.exportCSV();
const fB = FICHIERS.pop();
V('nom du fichier : noctra-finance-bilans-AAAA-MM-JJ.csv', /^noctra-finance-bilans-\d{4}-\d\d-\d\d\.csv$/.test(fB.nom), fB.nom);
const B = lire(fB.corps), hB = B[0];
const attB = ['Date', 'Net OnlyFans', 'Net Telegram', 'Net total', 'VA', 'Modèle', 'Chat IA', 'Chat humain', 'Dépenses diverses',
  'Impôts + Paxum', 'Total dépenses', 'Bénéfice', 'Brut OnlyFans'];
V('colonnes = les mots du site (Net, Dépenses diverses, Impôts + Paxum, Total dépenses, Bénéfice ; Brut OnlyFans en dernier)',
  JSON.stringify(hB) === JSON.stringify(attB), JSON.stringify(hB));
if (JSON.stringify(hB) === JSON.stringify(attB)) {
  const i = (n) => hB.indexOf(n);
  let koF = 0, koN = 0, koD = 0, koB = 0, koV = 0;
  for (const r of B.slice(1)) {
    if (!r.slice(1).every((x) => /^-?\d+\.\d\d$/.test(x))) koF++;
    if (C(r[i('Net OnlyFans')]) + C(r[i('Net Telegram')]) !== C(r[i('Net total')])) koN++;
    const post = ['VA', 'Modèle', 'Chat IA', 'Chat humain', 'Dépenses diverses', 'Impôts + Paxum'].reduce((s, n) => s + C(r[i(n)]), 0);
    if (post !== C(r[i('Total dépenses')])) koD++;
    if (C(r[i('Net total')]) - C(r[i('Total dépenses')]) !== C(r[i('Bénéfice')])) koB++;
    const e = ENTS.find((x) => x.date === r[0]);
    if (!e || C(r[i('Bénéfice')]) !== Math.round(e.profit * 100)) koV++;
  }
  V('chaque montant au centime (2 décimales, plus de « 1500.1249999999998 »)', koF === 0, koF + ' lignes');
  V('Net OnlyFans + Net Telegram = Net total, sur chaque ligne', koN === 0, koN + ' lignes');
  V('VA + Modèle + Chat IA + Chat humain + Dépenses diverses + Impôts + Paxum = Total dépenses, sur chaque ligne', koD === 0, koD + ' lignes');
  V('le fichier REFAIT le bénéfice : Net total − Total dépenses = Bénéfice, sur chaque ligne', koB === 0, koB + ' lignes');
  V('Bénéfice = le bénéfice du bilan sur le site (aucun bénéfice ne bouge)', koV === 0, koV + ' lignes');
  const rA = B.find((r) => r[0] === '2026-04-30'), rC = B.find((r) => r[0] === '2026-08-31'), rE = B.find((r) => r[0] === '2026-05-31');
  V('ancien bilan (brut 4 166,66 $) : Net OnlyFans 3333.33, Brut OnlyFans 4166.66', rA && rA[i('Net OnlyFans')] === '3333.33' && rA[i('Brut OnlyFans')] === '4166.66', JSON.stringify(rA));
  V('net 1 200,10 $ : Brut OnlyFans 1500.12 (plus 1500.1249999999998)', rC && rC[i('Brut OnlyFans')] === '1500.12', JSON.stringify(rC));
  V('mai (frais à demi-centime) : 5069.50 − 1220.83 = 3848.67', rE && rE[i('Net total')] === '5069.50' && rE[i('Total dépenses')] === '1220.83' && rE[i('Bénéfice')] === '3848.67', JSON.stringify(rE));
}

console.log('\n-- « Télécharger le récap (tableur) » --');
P.exportRecapCSV();
const fR = FICHIERS.pop();
V('nom du fichier : noctra-finance-recap-AAAA-MM-JJ.csv', /^noctra-finance-recap-\d{4}-\d\d-\d\d\.csv$/.test(fR.nom), fR.nom);
const R = lire(fR.corps), hR = R[0];
const attR = ['Mois', 'Bilans', 'Net OnlyFans', 'Net Telegram', 'Net total', 'VA', 'Modèle', 'Chat IA', 'Chat humain', 'Dépenses diverses',
  'Impôts + Paxum', 'Total dépenses', 'Bénéfice', 'Brut OnlyFans'];
V('colonnes = les mots du Récap (« Bilans », « Dépenses diverses » ET « Total dépenses », « Bénéfice » ; plus d\'« Avancé Moi »)',
  JSON.stringify(hR) === JSON.stringify(attR), JSON.stringify(hR));
if (JSON.stringify(hR) === JSON.stringify(attR)) {
  const i = (n) => hR.indexOf(n);
  let koM = 0, koB = 0, koD = 0, koP = 0;
  const data = P.getMonthlyRecap();
  for (const r of R.slice(1)) {
    if (!/^[A-ZÉ][a-zéû]+ \d{4}$/.test(r[0]) || MOIS.indexOf(r[0].split(' ')[0].toLowerCase()) < 0) koM++;
    if (C(r[i('Net total')]) - C(r[i('Total dépenses')]) !== C(r[i('Bénéfice')])) koB++;
    const post = ['VA', 'Modèle', 'Chat IA', 'Chat humain', 'Dépenses diverses', 'Impôts + Paxum'].reduce((s, n) => s + C(r[i(n)]), 0);
    if (post !== C(r[i('Total dépenses')])) koD++;
    const k = r[0].split(' ')[1] + '-' + String(MOIS.indexOf(r[0].split(' ')[0].toLowerCase()) + 1).padStart(2, '0');
    const m = data.find((x) => x.key === k);
    if (!m || C(r[i('Bénéfice')]) !== Math.round(m.profit * 100) || +r[i('Bilans')] !== m.count) koP++;
  }
  V('mois en français (« Octobre 2026 », plus « Oct 2026 »)', koM === 0, koM + ' lignes');
  V('le fichier REFAIT le bénéfice du mois : Net total − Total dépenses = Bénéfice', koB === 0, koB + ' lignes');
  V('postes + Impôts et Paxum = Total dépenses', koD === 0, koD + ' lignes');
  V('Bénéfice et nombre de bilans = ceux du Récap', koP === 0, koP + ' lignes');
}

console.log('\n-- « Télécharger une copie de secours » --');
P.exportData();
const fD = FICHIERS.pop();
V('nom du fichier : noctra-finance-copie-de-secours-AAAA-MM-JJ.json', /^noctra-finance-copie-de-secours-\d{4}-\d\d-\d\d\.json$/.test(fD.nom), fD.nom);
let d = null; try { d = JSON.parse(fD.corps); } catch (e) {}
V('structure INCHANGÉE (l\'import la relit) : ents, vas, virements, modeles, exportedAt', d && Array.isArray(d.ents) && d.ents.length === ENTS.length
  && Array.isArray(d.vas) && Array.isArray(d.virements) && Array.isArray(d.modeles) && typeof d.exportedAt === 'string');

console.log('\n' + (echecs ? echecs + ' ECHEC(S)' : 'TOUT PASSE (' + oks + ' contrôles)') + '\n');
process.exit(echecs ? 1 : 0);
