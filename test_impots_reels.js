// LES IMPÔTS TELS QU'ILS SONT VRAIMENT PAYÉS (16/10) : aucun impôt n'a encore été payé ; TOUT ce qui est dû depuis le début
// d'OnlyFans se paie en une fois, au bureau, du 1er au 15 du mois suivant ; l'argent a déjà été retiré en liquide. Prouvé
// sur le VRAI code de index.html, chaque montant attendu étant écrit ICI À LA MAIN (pas recalculé par le même calcul).
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des bilans, des
// paiements et des retraits FICTIFS, une date figée. (Règle de la maison : jamais la base réelle.)
//
// Ce qu'il surveille :
//  1. Le suivi part du PREMIER BILAN (plus aucun mois « compté comme payé ») ; sans rien de noté, pas de suivi (le bloc
//     d'avant, tel quel) ; avec `tout`, les mêmes chiffres quand même (la liste du mois).
//  2. Un paiement « tout ce qui est dû » couvre du plus ancien mois au plus récent ; ce qui dépasse est « d'avance ».
//     Un paiement « pour un mois » (ancienne forme) couvre son mois, ce qui dépasse passe au mois suivant (report).
//     Rien ne se perd : payé − d'avance = ce qui couvre les mois.
//  3. Le liquide de côté : les retraits, moins les paiements faits ENSUITE (le même jour, le retrait d'abord) ; à garder en
//     crypto = (reste − liquide) ÷ 0,98, jamais négatif.
//  4. La ligne des impôts de la liste du mois : le total dû jusqu'au mois de la liste, la fenêtre de paiement (« du 1er
//     au 15 nov. », « jusqu'au 15 nov. », « aujourd'hui · 15 nov. »), le retard dit sobrement (jamais « en retard », jamais
//     la classe rouge), les gestes « J'ai payé les impôts » (mois terminés dus) et « J'ai déjà retiré l'argent ».
//  5. (idée 10) Tout fait : la carte devient UNE ligne de résumé du mois ; elle n'est plus cachée.
//
// Lancer : node test_impots_reels.js            (ou : node test_impots_reels.js <autre_page.html> — elle doit y échouer)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.error('  KO  ' + quoi + (detail !== undefined ? ' -> ' + String(detail).slice(0, 400) : '')); }
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

let CODE, R_ETAT, R_HTML;
try {
  R_ETAT = extraire('_lmEtat'); R_HTML = extraire('_lmHtml');
  CODE = [ligneDe(/const _TAUX=[^;\n]*;/, '_TAUX'), ligneDe(/const _IMPOTS_OF=[^;\n]*;/, '_IMPOTS_OF'),
    ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'), ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'),
    ligneDe(/var _LM_I=\(function\(\)\{[\s\S]*?\n\}\)\(\);/, '_LM_I'),
    ['_ymd', '_aujLocal', '_ymLocal', '_lmSuivant', '_lmJour', '_lmNomComplet', '_nomMois', '_deMois', '_sansZero', '_jourCourt', '_majuscule',
     '_mtS', '_bilansMois', '_chCtsAff', 'centimesBilan', 'centimesBilans', '_chFrais', '_impValide', '_impGlobal', '_cleImpot', '_irValide',
     '_irRetraits', '_impSuivi', '_irEcheance', '_irFenTxt', '_irPuce', '_irRetardTxt', '_irDuAvant', '_lmLigneImpots', '_irResumeMois'].map(extraire).join('\n')].join('\n');
} catch (e) {
  console.error('  KO  les impôts réels (suivi depuis le début, paiement global, liquide de côté) sont absents de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

const RealDate = Date;
function charger(maintenant, ents, impots, retraits, recap, virements) {
  const NOW = new RealDate(maintenant).getTime();
  function FauxDate(...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); }
  FauxDate.now = () => NOW; FauxDate.prototype = RealDate.prototype;
  return new Function('Date', 'ents', 'impotsPayes', 'impotsRetraits', 'RECAP', 'virements', 'console',
    CODE + '\nfunction profitEntree(){ return 0; } function getMonthlyRecap(){ return RECAP; }\n' +
    'return { suivi: _impSuivi, ligne: _lmLigneImpots, puce: _irPuce, du: _irDuAvant, resume: _irResumeMois, fmtC: fmtC };')(
    FauxDate, ents, impots, retraits || [], recap || [], virements || [], { warn() {} });
}
function bilan(date, netOF) { return { date: date, brut: netOF / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: netOF * 0.95 }; }
// impôts (1 % du net OnlyFans) : juillet $79, août $94, septembre $112, octobre $68 — total $353
const ENTS = [bilan('2026-07-31', 7900), bilan('2026-08-31', 9400), bilan('2026-09-30', 11200), bilan('2026-10-01', 6800)];
const mois = (ym, date, amount, le) => ({ id: 'm' + ym + amount, mois: ym, date: date, amount: amount, le: le || date + 'T09:00:00.000Z' });
const tout = (date, amount, le) => ({ id: 'g' + date + amount, global: true, date: date, amount: amount, le: le || date + 'T09:00:00.000Z' });
const ret = (date, amount, le) => ({ id: 'r' + date + amount, date: date, amount: amount, le: le || date + 'T08:00:00.000Z' });
const txt = (h) => String(h).replace(/<[^>]+>/g, '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const row = (S, ym) => S.rows.filter((r) => r.ym === ym)[0] || {};
const fen = { fin: false };

// ── 1. depuis le premier bilan ─────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. le suivi part du premier bilan ; rien de noté : pas de suivi --');
let F = charger('2026-11-10T10:00:00', ENTS, []);
V(F.suivi() === null, 'rien de noté (ni paiement ni retrait) : pas de suivi, le bloc d’avant tel quel');
let S = F.suivi(true);
V(S && S.m0 === '2026-07' && S.rows.length === 4 && S.reste === 35300 && S.paye === 0 && S.liquide === 0 && S.crypto === 35300 && S.avance === 0,
  'avec « tout » : juillet → octobre, reste $353, rien de payé', S && JSON.stringify([S.m0, S.rows.length, S.reste, S.paye, S.liquide, S.crypto]));
V(Math.abs(S.garde - 353 / 0.98) < 1e-9, 'à garder en crypto = $353 ÷ 0,98', S.garde);
F = charger('2026-10-16T10:00:00', ENTS, [mois('2026-09', '2026-10-15', 112)]);
S = F.suivi();
V(S.m0 === '2026-07' && row(S, '2026-07').reste === 7900 && row(S, '2026-08').reste === 9400 && row(S, '2026-09').reste === 0 && S.reste === 7900 + 9400 + 6800,
  'septembre payé « pour un mois » : juillet et août restent DUS (plus « comptés comme payés »), reste $241', JSON.stringify(S.rows.map((r) => [r.ym, r.reste])));

// ── 2. paiements ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. « tout ce qui est dû » : du plus ancien au plus récent ; « pour un mois » : report --');
F = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 200)]);
S = F.suivi();
V(row(S, '2026-07').couvert === 7900 && row(S, '2026-08').couvert === 9400 && row(S, '2026-09').couvert === 2700 && row(S, '2026-10').couvert === 0 && S.reste === 15300,
  '$200 : juillet $79, août $94, septembre $27 (reste $85), octobre $68 → reste $153', JSON.stringify(S.rows.map((r) => [r.ym, r.couvert, r.reste])));
V(JSON.stringify(S.globaux[0].mois) === JSON.stringify(['2026-07', '2026-08', '2026-09']) && S.globaux[0].avance === 0, 'le paiement sait quels mois il couvre : juillet à septembre');
F = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 380)]);
S = F.suivi();
V(S.reste === 0 && S.avance === 2700 && S.paye === 38000, '$380 pour $353 : tout payé, $27 d’avance', JSON.stringify([S.reste, S.avance, S.paye]));
F = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 100, '2026-11-10T09:00:00.000Z'), tout('2026-11-09', 100, '2026-11-12T09:00:00.000Z')]);
S = F.suivi();
V(S.globaux[0].p.date === '2026-11-09' && JSON.stringify(S.globaux[0].mois) === JSON.stringify(['2026-07', '2026-08']) && JSON.stringify(S.globaux[1].mois) === JSON.stringify(['2026-08', '2026-09']),
  'deux paiements : dans l’ordre de leur date (le 9 nov. couvre juillet et le début d’août, le 10 la suite)', JSON.stringify(S.globaux.map((g) => [g.p.date, g.mois])));
F = charger('2026-10-16T10:00:00', ENTS, [mois('2026-08', '2026-09-14', 200)]);
S = F.suivi();
V(row(S, '2026-08').couvert === 9400 && row(S, '2026-08').passe === 10600 && row(S, '2026-09').couvert === 10600 && row(S, '2026-09').reste === 600 && row(S, '2026-07').reste === 7900,
  'août payé $200 « pour un mois » : août couvert, $106 passent à septembre (reste $6) ; juillet reste dû', JSON.stringify(S.rows.map((r) => [r.ym, r.couvert, r.passe])));
F = charger('2026-11-16T10:00:00', ENTS, [mois('2026-10', '2026-10-10', 100)]);
S = F.suivi();
V(row(S, '2026-10').couvert === 6800 && S.avance === 3200 && S.reste === 7900 + 9400 + 11200,
  'octobre payé $100 « pour un mois » : octobre couvert, $32 d’avance (rien après octobre) ; juillet à septembre restent dus', JSON.stringify([S.avance, S.reste]));
F = charger('2026-11-10T18:00:00', ENTS, [mois('2026-08', '2026-09-15', 94), tout('2026-11-10', 100)]);
S = F.suivi();
V(row(S, '2026-08').couvert === 9400 && row(S, '2026-07').couvert === 7900 && row(S, '2026-09').couvert === 2100 && S.reste === 9100 + 6800,
  '« pour un mois » (août) puis « tout ce qui est dû » ($100) : juillet, puis $21 de septembre', JSON.stringify(S.rows.map((r) => [r.ym, r.couvert])));
for (const [nom, l] of [['global exact', [tout('2026-11-10', 353)]], ['global en partie', [tout('2026-11-10', 200)]], ['surplus', [tout('2026-11-10', 380)]],
  ['report', [mois('2026-08', '2026-09-14', 200), mois('2026-10', '2026-10-10', 100)]], ['mélange', [mois('2026-08', '2026-09-15', 94), tout('2026-11-10', 100)]]]) {
  S = charger('2026-11-10T18:00:00', ENTS, l).suivi();
  V(S.paye - S.avance === S.rows.reduce((s, r) => s + r.couvert, 0) && S.rows.every((r) => r.reste >= 0 && r.couvert <= r.du), 'rien ne se perd (' + nom + ') : payé − d’avance = ce qui couvre les mois');
}
F = charger('2026-11-10T18:00:00', ENTS, [{ id: 'x', global: true, date: 'pas une date', amount: 50 }, { id: 'y', global: true, date: '2026-11-10', amount: -5 }, { mois: 'n/a', amount: 9 }]);
V(F.suivi() === null, 'lignes illisibles (date fausse, montant négatif, mois inconnu) : gardées, jamais comptées');

// ── 3. le liquide de côté ──────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. le liquide de côté : les retraits, moins les paiements faits ensuite --');
S = charger('2026-11-02T10:00:00', ENTS, [], [ret('2026-10-16', 353)]).suivi();
V(S && S.liquide === 35300 && S.crypto === 0 && S.garde === 0 && S.reste === 35300, 'retiré $353, rien payé : $353 de côté, rien à garder en crypto', S && JSON.stringify([S.liquide, S.crypto]));
S = charger('2026-11-02T10:00:00', ENTS, [], [ret('2026-10-16', 200)]).suivi();
V(S.liquide === 20000 && S.crypto === 15300 && Math.abs(S.garde - 153 / 0.98) < 1e-9, 'retiré $200 : à garder en crypto = ($353 − $200) ÷ 0,98', JSON.stringify([S.liquide, S.crypto]));
S = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 353)], [ret('2026-10-16', 353)]).suivi();
V(S.liquide === 0 && S.reste === 0, 'retiré puis payé : le liquide de côté diminue d’autant ($0)', JSON.stringify([S.liquide, S.reste]));
S = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 353)], [ret('2026-10-16', 360)]).suivi();
V(S.liquide === 700, 'retiré $360, payé $353 : $7 restent de côté', S.liquide);
S = charger('2026-11-20T18:00:00', ENTS, [tout('2026-11-10', 353)], [ret('2026-11-20', 50)]).suivi();
V(S.liquide === 5000, 'un paiement fait AVANT le retrait ne le diminue pas', S.liquide);
S = charger('2026-11-10T18:00:00', ENTS, [tout('2026-11-10', 100, '2026-11-10T07:00:00.000Z')], [ret('2026-11-10', 100, '2026-11-10T19:00:00.000Z')]).suivi();
V(S.liquide === 0, 'le même jour, le retrait passe avant le paiement (noté avant ou après)', S.liquide);
S = charger('2026-11-02T10:00:00', ENTS, [], [ret('2026-10-16', 400)]).suivi();
V(S.liquide === 40000 && S.crypto === 0 && S.garde === 0, 'retiré plus que le reste : rien à garder en crypto, jamais négatif', JSON.stringify([S.liquide, S.crypto, S.garde]));

// ── 4. la ligne des impôts de la liste du mois ─────────────────────────────────────────────────────────────────
console.log('\n-- 4. la liste du mois : le total dû, la fenêtre, le retard dit sobrement --');
function L(quand, impots, retraits, F0) {
  const G = charger(quand, ENTS, impots || [], retraits || []);
  const d = new RealDate(quand), ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const fin = d.getDate() > new RealDate(d.getFullYear(), d.getMonth() + 1, 0).getDate() - 3;
  const prev = new RealDate(d.getFullYear(), d.getMonth() - 1, 1), pym = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  const x = G.ligne(F0 || { ym: fin ? ym : pym, fin: fin });
  x.puceTxt = x.fenetre ? txt(G.puce(x)) : null;      // (les espaces insécables de _jourCourt, normalisés)
  return x;
}
let x = L('2026-10-16T10:00:00');
V(x.titre === 'Impôts dus' && x.montant === 285 && x.puceTxt === 'du 1er au 15 nov.' && !x.retard && !x.fait, '16 oct. : « Impôts dus » $285 (juillet à septembre), « du 1er au 15 nov. », pas en rouge', JSON.stringify([x.titre, x.montant, x.puceTxt, x.retard]));
V(txt(x.sous) === 'tout ce qui est dû depuis juillet, chacun prévu le 15 du mois suivant', '… « tout ce qui est dû depuis juillet, chacun prévu le 15 du mois suivant »', txt(x.sous));
V(x.action && x.action.l === 'J’ai payé les impôts' && x.action.court === 'J’ai payé' && x.action2 && x.action2.l === 'J’ai déjà retiré l’argent' && x.action2.court === 'J’ai retiré',
  '… gestes « J’ai payé les impôts » et « J’ai déjà retiré l’argent » (titres courts « J’ai payé », « J’ai retiré »)');
x = L('2026-10-30T10:00:00');
V(x.montant === 353 && x.puceTxt === 'du 1er au 15 nov.' && txt(x.sous) === 'à ce jour · tout ce qui est dû depuis juillet · dont juillet à septembre, prévus le 15 du mois suivant',
  '30 oct. (fin du mois) : $353 à ce jour, octobre pas encore en retard', JSON.stringify([x.montant, x.puceTxt, txt(x.sous)]));
V(!x.action && !x.action2, '… fin du mois (les 3 derniers jours, jour du rappel) : aucun bouton dans la liste, comme avant (les gestes restent dans le bloc impôts ; la carte ne grandit pas)');
x = L('2026-11-02T10:00:00');
V(x.montant === 353 && x.puceTxt === 'jusqu’au 15 nov.', '2 nov. : $353, « jusqu’au 15 nov. » (la fenêtre est ouverte)', JSON.stringify([x.montant, x.puceTxt]));
x = L('2026-11-15T10:00:00');
V(x.aujourdhui === true && x.puceTxt === 'aujourd’hui · 15 nov.', '15 nov. : « aujourd’hui · 15 nov. »', x.puceTxt);
x = L('2026-11-16T10:00:00');
V(x.puceTxt === 'du 1er au 15 déc.' && txt(x.sous) === 'tout ce qui est dû depuis juillet, chacun prévu le 15 du mois suivant' && !x.retard,
  '16 nov., rien payé : la fenêtre suivante (« du 1er au 15 déc. »), le retard dit sobrement, pas en rouge', JSON.stringify([x.puceTxt, txt(x.sous)]));
x = L('2026-11-10T18:00:00', [tout('2026-11-10', 200)]);
V(x.titre === 'Reste des impôts' && x.montant === 153 && txt(x.sous) === 'tout ce qui est dû depuis septembre · dont septembre, prévu le 15 oct. · déjà payé $200 sur $353',
  'payé $200 : « Reste des impôts » $153, « dont septembre, prévu le 15 oct. », « déjà payé $200 sur $353 »', JSON.stringify([x.titre, x.montant, txt(x.sous)]));
x = L('2026-11-10T18:00:00', [tout('2026-11-10', 380)]);
V(x.fait && x.titre === 'Impôts payés jusqu’à octobre' && x.court === 'Impôts payés' && x.montant === 380 && txt(x.sous) === 'payé le 10 nov. · $27 d’avance, pour les mois suivants',
  'payé $380 : faite, « Impôts payés jusqu’à octobre » $380, « payé le 10 nov. · $27 d’avance »', JSON.stringify([x.titre, x.montant, txt(x.sous)]));
x = L('2026-11-02T10:00:00', [], [ret('2026-10-16', 353)]);
V(txt(x.sous).endsWith('· $353 déjà en liquide, de côté') && x.action && !x.action2 && x.action.l === 'J’ai payé les impôts',
  'retiré $353 : « $353 déjà en liquide, de côté », plus de « J’ai retiré »', txt(x.sous));
const sansOF = [bilan('2026-09-30', 0), bilan('2026-10-01', 0)];
x = charger('2026-11-02T10:00:00', sansOF, []).ligne({ ym: '2026-10', fin: false });
V(x.fait && x.titre === "Pas d’impôts d'octobre" && x.court === 'Pas d’impôts', 'aucun OnlyFans : « Pas d’impôts d’octobre » (comme avant)', x.titre);
const avecSeptSansOF = [bilan('2026-08-31', 9400), bilan('2026-09-30', 0), bilan('2026-10-01', 6800)];
x = charger('2026-10-16T10:00:00', avecSeptSansOF, []).ligne({ ym: '2026-09', fin: false });
V(!x.fait && x.montant === 94, 'septembre sans OnlyFans mais août dû : la ligne n’est PAS « Pas d’impôts » (août $94 reste dû)', JSON.stringify([x.fait, x.montant]));
V(!/en retard/.test(extraire('_lmLigneImpots').replace(/\/\/.*$/gm, '')) && /L\.retard=false/.test(extraire('_lmLigneImpots')), 'jamais « en retard » ni la classe rouge sur la ligne des impôts');
V(/_chFrais\(_bilansMois\(/.test(extraire('_impSuivi')) && /_RETRAIT_LIQUIDE/.test(extraire('_impSuivi')) && !/0\.98|0\.01/.test(extraire('_impSuivi')),
  'l’impôt de chaque mois : le calcul du bloc (_chFrais), à garder : ÷ (1 − _RETRAIT_LIQUIDE) — aucun taux écrit en dur');

// ── 5. tout fait : UNE ligne de résumé du mois ─────────────────────────────────────────────────────────────────
console.log('\n-- 5. (idée 10) tout fait : la ligne de résumé du mois --');
F = charger('2026-11-10T18:00:00', ENTS, [], [], [{ key: '2026-10', profit: 4383.91 }], [{ date: '2026-10-05', amount: 3400 }, { date: '2026-11-01', amount: 1209.27 }]);
const E = { F: { ym: '2026-10', fin: false }, lignes: [{ cle: 'bilan', fait: true, court: 'Bilan pas finalisé' }, { cle: 'modele', fait: true, court: 'Part envoyée' }, { cle: 'impots', fait: true, court: 'Impôts payés', montant: 353 }], tout: true };
V(txt(F.resume(E)) === 'Octobre : bénéfice $4,383.91 · part envoyée $1,209.27 · impôts payés $353 (tout est fait)', '« Octobre : bénéfice $4,383.91 · part envoyée $1,209.27 · impôts payés $353 ✓ »', txt(F.resume(E)));
const E2 = { F: E.F, lignes: [E.lignes[0], { cle: 'modele', fait: true, court: 'Rien à envoyer' }, { cle: 'impots', fait: true, court: 'Pas d’impôts', montant: null }], tout: true };
F = charger('2026-11-10T18:00:00', ENTS, [], [], [{ key: '2026-10', profit: -659.68 }], []);
V(txt(F.resume(E2)) === 'Octobre : bénéfice −$659.68 · rien à envoyer · pas d’impôts (tout est fait)', 'perte, rien à envoyer, pas d’impôts : « bénéfice −$659.68 · rien à envoyer · pas d’impôts »', txt(F.resume(E2)));
V(!/if\(tout && !_lmFaitAujourdhui\(F\)/.test(R_ETAT), 'la carte n’est plus cachée quand tout est fait (gardée jusqu’à la fin de la fenêtre de la liste)');
V(/if\(E\.tout\)\{[\s\S]*_irResumeMois\(E\)/.test(R_HTML), 'tout fait : _lmHtml écrit la ligne de résumé (_irResumeMois)');
V(!/fmtC\((?!r\.profit|env|I\.montant)|_mtS\((?!r\.profit)/.test(extraire('_irResumeMois').replace(/\/\/.*$/gm, '')), 'le résumé n’écrit que des montants déjà affichés (bénéfice du Récap, paiements, ligne des impôts)');

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
