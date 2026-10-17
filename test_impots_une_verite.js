// (ADAPTÉ le 16/10 par feat8_impots_reels — original : bancs_final/test_impots_une_verite.js. La règle de CE banc ne change
//  pas : une seule vérité, le relevé ferme le compte au centime, aucun impôt recalculé. Ce qui change avec les impôts réels :
//  le suivi part du PREMIER BILAN (plus de « dont avant le suivi, comptés comme payés » : seul un écart d'arrondi mois par
//  mois peut rester) ; un paiement « tout ce qui est dû » couvre du plus ancien au plus récent et ce qui dépasse passe au
//  mois suivant (« moins payé d'avance », au lieu du trop-payé « pas déduit du reste ») ; l'argent déjà retiré en liquide
//  est dit dans la tuile ; l'attendu (§2) est recalculé ICI avec ces règles.)
// « IMPÔTS À GARDER DE CÔTÉ » : UNE SEULE VÉRITÉ (O1, relecture du 16/10). Dès qu'un paiement d'impôts est noté (le
// suivi a commencé), la grande tuile « À garder en crypto » dit ce qu'il reste à garder pour ce qui reste à payer — le
// MÊME chiffre que le geste ② et la ligne repliée du téléphone — et plus le total « depuis le début » (déjà payés
// compris) qui la contredisait (« $504.08 à garder » à côté de « Rien à garder : tout est payé »). Prouvé sur le VRAI
// code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des bilans et des
// paiements FICTIFS, une date figée et un faux document en mémoire. (Règle de la maison : jamais la base réelle.)
//
// Ce qu'il surveille :
//  1. Les MÊMES variables : renderImpots garde son objet I (T « depuis le début », P la période) sur le bloc ; _impDecorer
//     passe SON S (le suivi) à _ipVerite, après la ligne repliée, dans un try/catch ; aucun calcul dans _ipVerite /
//     _ipVeriteHtml (ni taux, ni ÷ 0,98, ni arrondi) : seulement fmtC / saMoitie de T, S et P.
//  2. Les montants (vrais _chFrais et _impSuivi, attendu recalculé ICI à part) : tuile = reste ÷ 0,98 ; sa moitié au
//     centime (le demi-centime va à elle) ; période = les impôts de la période, sans « à payer / à garder » ; tout
//     payé : « tout ce qui est dû est payé » ; (17/10) le relevé FERME LE COMPTE au centime : impôts depuis le début =
//     avant le suivi (comptés comme payés) + déjà payés − trop-payé (pas déduit du reste) + reste ; sans bilan
//     OnlyFans avant le suivi, l'écart d'arrondi des mois s'écrit « arrondi au centime, mois par mois ».
//  3. Sans suivi (ou sans OnlyFans) : RIEN n'est touché.
//  4. Dans un faux document : la tuile, son relevé et la ligne de période sont réécrits, l'étiquette est gardée,
//     l'ancien relevé (impôts à payer, coût réel, partagé) est retiré.
//
// Lancer : node test_impots_une_verite.js            (ou : node test_impots_une_verite.js <autre_page.html>)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) console.log('  OK  ' + quoi);
  else { ko++; console.error('  KO  ' + quoi + (detail !== undefined ? ' -> ' + String(detail).slice(0, 400) : '')); }
}
function extraire(nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}
function ligneDe(re, quoi) { const m = SRC.match(re); if (!m) throw new Error('introuvable : ' + quoi); return m[0]; }

let R_IMP, R_DEC, R_VER, R_VERH, CODE;
try {
  R_IMP = extraire('renderImpots');
  R_DEC = extraire('_impDecorer');
  R_VER = extraire('_ipVerite');
  R_VERH = extraire('_ipVeriteHtml');
  CODE = [ligneDe(/const _TAUX=[^;\n]*;/, '_TAUX'), ligneDe(/const _IMPOTS_OF=[^;\n]*;/, '_IMPOTS_OF'),
    ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'), ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'),
    extraire('_mtS'), extraire('_nomMois'),
    extraire('_ymd'), extraire('_aujLocal'), extraire('_ymLocal'), extraire('_lmSuivant'), extraire('_lmJour'), extraire('_lmNomComplet'),
    extraire('_bilansMois'), extraire('_chNb'), extraire('_chCtsAff'), extraire('centimesBilan'), extraire('centimesBilans'), extraire('_chFrais'),
    extraire('saMoitie'), extraire('_impValide'), extraire('_impPayeCts'), extraire('_impGlobal'), extraire('_irValide'), extraire('_irRetraits'),
    extraire('_impSuivi'), extraire('_irEcheance'), extraire('_irFenTxt'), R_VERH, R_VER].join('\n');
} catch (e) {
  console.error('  KO  une seule vérité : fonction absente de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

// ── 1. Les MÊMES variables, aucun calcul ─────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. les mêmes variables, aucun calcul parallèle --');
V(/var I = chImpots\(\), T = I\.total; el\._ipI = I;/.test(R_IMP), 'renderImpots garde SON objet I (T, P) sur le bloc, au moment où il le calcule');
V(!/_ipI/.test(R_IMP.replace('el._ipI = I;', '')), 'renderImpots ne fait rien d’autre de I pour le suivi');
const iS = R_DEC.indexOf('var S=_impSuivi()'), iRep = R_DEC.indexOf('_ipRepliSuivi(el, S)'), iVer = R_DEC.indexOf('_ipVerite(el, S)');
V(iS >= 0 && iRep > iS && iVer > iRep, '_impDecorer passe SON S (celui du geste ② et de la ligne repliée) à _ipVerite, après la ligne repliée');
V(/try\{ _ipVerite\(el, S\); \}catch\(e\)/.test(R_DEC), '_impDecorer : une faute ici ne peut pas casser le suivi (try/catch)');
V(/var I = el\._ipI, T = I && I\.total;/.test(R_VER) && !/chImpots|_chFrais|_impSuivi/.test(R_VER), '_ipVerite relit le MÊME I (pas de nouveau calcul)');
const sansCom = (R_VER + '\n' + R_VERH).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const interdits = ['_TAUX', '_IMPOTS_OF', '_RETRAIT_LIQUIDE', '_PAXUM_OF', '0.98', '0.01', '0.8', 'Math.round', 'Math.floor', 'toFixed', '_chFrais', '_impSuivi', 'chImpots'];
const trouves = interdits.filter((x) => sansCom.includes(x));
V(!trouves.length, 'aucun taux, arrondi ni calcul d’impôts dans _ipVerite / _ipVeriteHtml', trouves.join(', '));
const montants = (sansCom.match(/fmtC\((?:[^()]|\([^()]*\))*\)/g) || []).sort();
V(JSON.stringify(montants) === JSON.stringify(['fmtC(P.imp)', 'fmtC(S.crypto / 100)', 'fmtC(S.garde)', 'fmtC(S.liquide / 100)', 'fmtC(S.paye / 100)', 'fmtC(S.reste / 100)', 'fmtC(T.imp)', 'fmtC(liq / 100)', 'fmtC(saMoitie(S.garde))']),
  'les SEULS montants écrits par fmtC : fmtC(S.garde), fmtC(saMoitie(S.garde)), fmtC(S.liquide / 100), fmtC(T.imp), fmtC(S.paye / 100), fmtC(S.reste / 100), fmtC(liq / 100), fmtC(S.crypto / 100), fmtC(P.imp)', montants.join(' '));
// (17/10) les deux lignes qui ferment le compte : écrites par _mtS (le signe du site), tirées des MÊMES T et S
const signes = (sansCom.match(/_mtS\([^)]*\)/g) || []).sort();
V(JSON.stringify(signes) === JSON.stringify(['_mtS(-avance / 100)', '_mtS(arrondi / 100)']), 'les lignes « arrondi » et « payé d’avance » : _mtS(arrondi / 100), _mtS(-avance / 100)', signes.join(' '));
V(/var total = _chCtsAff\(T\.imp\);/.test(R_VERH) && /var dusSuivis = S\.rows\.reduce\(function\(s, r\)\{ return s \+ r\.du; \}, 0\);/.test(R_VERH)
  && /var arrondi = total - dusSuivis;/.test(R_VERH) && /var avance = S\.avance;/.test(R_VERH),
  'arrondi = le total affiché − les impôts des lignes du suivi ; payé d’avance = S.avance (celui du suivi) : aucun impôt recalculé');
V(!/avant le suivi|comptés comme payés|pas déduit du reste/.test(sansCom), 'plus de « avant le suivi, comptés comme payés » ni de trop-payé « pas déduit du reste »');
V(!/Le total du haut compte tout/.test(R_DEC) && /« Impôts depuis le début » compte tout/.test(R_DEC),
  'la note du bas (suivi commencé) ne parle plus d’un « total du haut » qui compterait tout');
V(!/à garder|à payer/.test((R_VERH.match(/periode:[^\n]*/) || [''])[0]), 'la ligne de période (suivi commencé) ne dit plus « à payer / à garder »');

// ── 2. Les montants (recalcul à part) ────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. les montants, recalculés ici à part --');
const RealDate = Date;
function charger(maintenant, ents, impots, doc) {
  const NOW = new RealDate(maintenant).getTime();
  function FauxDate(...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); }
  FauxDate.now = () => NOW; FauxDate.prototype = RealDate.prototype;
  return new Function('Date', 'ents', 'impotsPayes', 'impotsRetraits', 'document', 'console',
    CODE + '\nfunction profitEntree(){ return 0; }\n' +
    'return { frais: _chFrais, suivi: function(){ return _impSuivi(); }, html: _ipVeriteHtml, verite: _ipVerite, fmtC: fmtC, bilansMois: _bilansMois };')(
    FauxDate, ents, impots, charger.retraits || [], doc || { body: { classList: { contains: () => false } } }, { warn() {} });
}
function bilan(date, netOF) { return { date: date, brut: netOF / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: netOF * 0.95 }; }
function ip(mois, date, amount) { return { id: 'x' + mois + date + amount, mois: mois, date: date, amount: amount }; }
// l'attendu, à part : impôts d'un mois = 1 % du net OnlyFans au centime ; reste = somme des (impôt − payé) positifs
// depuis le 1er mois noté jusqu'au mois en cours ; à garder = reste ÷ 0,98 ; sa moitié : le demi-centime monte
function attendu(ents, impots, ymCour, retraits) {
  // (feat8) le suivi part du PREMIER BILAN ; « pour un mois » : son mois, ce qui dépasse passe au suivant ; « tout ce qui est
  // dû » : du plus ancien au plus récent ; ce qui reste après le dernier mois = d'avance ; liquide = retraits − paiements faits ensuite
  const parMois = {}; let tot = 0;
  ents.forEach((e) => { const k = e.date.slice(0, 7); const n = e.brut * 0.8; parMois[k] = (parMois[k] || 0) + n; tot += n; });
  const mens = impots.filter((p) => p.amount > 0 && !p.global), glob = impots.filter((p) => p.amount > 0 && p.global).sort((a, b) => (a.date + (a.le || '')).localeCompare(b.date + (b.le || '')));
  const suiv = (k) => { const a = +k.slice(0, 4), m = +k.slice(5, 7); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); };
  const cts = (v) => Math.round(v * 100);
  const m0 = ents.map((e) => e.date.slice(0, 7)).concat(mens.map((p) => p.mois)).sort()[0];
  let fin = ymCour; mens.forEach((p) => { if (p.mois > fin) fin = p.mois; });
  const rows = [];
  for (let k = m0; k <= fin; k = suiv(k)) {
    const du = Math.round((parMois[k] || 0) * 0.01 * 100), pa = mens.filter((p) => p.mois === k).reduce((s, p) => s + cts(p.amount), 0);
    if (du > 0 || pa > 0) rows.push({ k, du, pa, pg: 0 });
  }
  let rep = 0;
  rows.forEach((r) => { const d = r.pa + rep; r.pm = Math.min(r.du, d); rep = d - r.pm; });
  let avanceG = 0;
  glob.forEach((p) => { let reste = cts(p.amount); rows.forEach((r) => { const b = r.du - r.pm - r.pg; if (reste <= 0 || b <= 0) return; const t = Math.min(b, reste); r.pg += t; reste -= t; }); avanceG += reste; });
  const reste = rows.reduce((s, r) => s + (r.du - r.pm - r.pg), 0), paye = impots.filter((p) => p.amount > 0).reduce((s, p) => s + cts(p.amount), 0);
  const ev = (retraits || []).map((x) => [x.date, 0, cts(x.amount)]).concat(impots.filter((p) => p.amount > 0).map((p) => [p.date, 1, cts(p.amount)])).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  let liq = 0; ev.forEach((e) => { if (e[1] === 0) liq += e[2]; else liq -= Math.min(liq, e[2]); });
  const crypto = Math.max(0, reste - liq), gardeCts = Math.round(crypto / 0.98), imp = Math.round(tot * 0.01 * 100);
  return { imp, paye, reste, garde: gardeCts, moitie: Math.round(gardeCts / 2), m0, arrondi: imp - rows.reduce((s, r) => s + r.du, 0), avance: rep + avanceG, liq, crypto };
}
function attenduVieux(ents, impots, ymCour) {
  const parMois = {}; let tot = 0;
  ents.forEach((e) => { const k = e.date.slice(0, 7); const n = e.brut * 0.8; parMois[k] = (parMois[k] || 0) + n; tot += n; });
  const valides = impots.filter((p) => p.amount > 0);
  const m0 = valides.map((p) => p.mois).sort()[0];
  const mx = valides.map((p) => p.mois).sort().slice(-1)[0];
  const fin = ymCour > mx ? ymCour : mx;
  let reste = 0, paye = 0, dus = 0, trop = 0;
  const moisTrop = [], MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  for (let k = m0; k <= fin; k = (() => { const a = +k.slice(0, 4), m = +k.slice(5, 7); return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0'); })()) {
    const du = Math.round((parMois[k] || 0) * 0.01 * 100), pa = valides.filter((p) => p.mois === k).reduce((s, p) => s + Math.round(p.amount * 100), 0);
    reste += Math.max(0, du - pa); paye += pa; dus += du;
    if (pa > du) { trop += pa - du; moisTrop.push(MOIS[+k.slice(5, 7) - 1] + (k.slice(0, 4) === ymCour.slice(0, 4) ? '' : ' ' + k.slice(0, 4))); }
  }
  const gardeCts = Math.round(reste / 0.98), imp = Math.round(tot * 0.01 * 100);
  return { imp: imp, paye: paye, reste: reste, garde: gardeCts, moitie: Math.round(gardeCts / 2), m0: m0,
    avant: imp - dus, trop: trop, moisTrop: moisTrop, ofAvant: ents.some((e) => e.date.slice(0, 7) < m0 && e.brut > 0) };
}
const $ = (c) => { const e = Math.floor(Math.abs(c) / 100), d = Math.abs(c) % 100; return '$' + e.toLocaleString('en-US') + (d ? '.' + String(d).padStart(2, '0') : ''); };
const $s = (c) => (c < 0 ? '−' : '') + $(c);
const NOM = (ym) => ({ '07': 'juillet', '08': 'août', '09': 'septembre', '10': 'octobre' }[ym.slice(5, 7)]) + ' ' + ym.slice(0, 4);
// (17/10) le relevé attendu, écrit ICI : il ferme le compte (total = avant + déjà payés − trop-payé + reste)
function releveAttendu(A) {
  return (A.liq > 0 ? 'En liquide, de côté : ' + $(A.liq) + (A.reste > 0 ? ' · à payer au bureau ' + A.fen : ' · rien à payer pour l’instant') : '')
    + 'Impôts depuis le début' + $(A.imp)
    + (A.arrondi !== 0 ? 'dont arrondi au centime, mois par mois' + $s(A.arrondi) : '')
    + 'dont déjà payés' + $(A.paye)
    + (A.avance > 0 ? 'moins payé d’avance (passe au mois suivant)' + $s(-A.avance) : '')
    + 'dont reste à payer, en liquide' + $(A.reste)
    + (Math.min(A.liq, A.reste) > 0 ? 'sur ce reste : ' + $(Math.min(A.liq, A.reste)) + ' déjà retirés en liquide' + (A.crypto > 0 ? ', ' + $(A.crypto) + ' encore en crypto' : '') : '');
}
// les montants du relevé, signés, en centimes : le premier (le total) = la somme des suivants ?
function ferme(html) {
  const v = [...String(html).matchAll(/<dd>([^<]*)<\/dd>/g)].map((m) => (/−/.test(m[1]) ? -1 : 1) * Math.round(parseFloat(m[1].replace(/[^0-9.]/g, '')) * 100));
  return v.length >= 3 && v[0] === v.slice(1).reduce((s, x) => s + x, 0) ? true : v.join(' / ');
}
const texte = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

const ENTS = [bilan('2026-07-31', 7900), bilan('2026-08-31', 9400), bilan('2026-09-30', 11200), bilan('2026-10-01', 6800)];
const tg = (date, amount, le) => ({ id: 'g' + date + amount, global: true, date: date, amount: amount, le: le || date + 'T09:00:00.000Z' });
const rt = (date, amount) => ({ id: 'r' + date + amount, date: date, amount: amount, le: date + 'T08:00:00.000Z' });
const JEUX = [
  ['payé en partie (août, puis 60 sur septembre ; juillet reste dû : suivi depuis le premier bilan)', '2026-10-16T10:00:00', [ip('2026-08', '2026-09-15', 94), ip('2026-09', '2026-10-15', 60)]],
  ['tout payé « pour un mois », juillet compris', '2026-10-16T18:00:00', [ip('2026-07', '2026-08-15', 79), ip('2026-08', '2026-09-15', 94), ip('2026-09', '2026-10-15', 112), ip('2026-10', '2026-10-16', 68)]],
  ['payé en trop un mois (report : août 200 couvre août, puis septembre)', '2026-10-16T10:00:00', [ip('2026-08', '2026-09-14', 200), ip('2026-10', '2026-10-10', 100)]],
  ['deux mois en retard (20 nov.)', '2026-11-20T10:00:00', [ip('2026-08', '2026-09-15', 94)]],
  ['à garder au centime impair (sa moitié monte)', '2026-10-16T10:00:00', [ip('2026-09', '2026-10-15', 100.02)]],
  ['« tout ce qui est dû » exact (353)', '2026-11-10T18:00:00', [tg('2026-11-10', 353)]],
  ['« tout ce qui est dû » en partie (200 : juillet, août, 27 sur septembre)', '2026-11-10T18:00:00', [tg('2026-11-10', 200)]],
  ['« tout ce qui est dû » avec surplus (380 : 27 d’avance)', '2026-11-10T18:00:00', [tg('2026-11-10', 380)]],
  ['« pour un mois » ancien + « tout ce qui est dû »', '2026-11-10T18:00:00', [ip('2026-08', '2026-09-15', 94), tg('2026-11-10', 100)]],
  ['retrait en liquide de tout (353), rien payé', '2026-10-16T18:00:00', [], [rt('2026-10-16', 353)]],
  ['retrait en partie (200), rien payé', '2026-11-02T10:00:00', [], [rt('2026-10-16', 200)]],
  ['retrait (353), puis payé (353)', '2026-11-10T18:00:00', [tg('2026-11-10', 353)], [rt('2026-10-16', 353)]],
];
for (const [nom, quand, imps, rets] of JEUX) {
  charger.retraits = rets || [];
  const F = charger(quand, ENTS, imps);
  const T = F.frais(ENTS), S = F.suivi(), P = F.frais(F.bilansMois(quand.slice(0, 7)));
  const A = attendu(ENTS, imps, quand.slice(0, 7), rets);
  A.fen = 'du 1er au 15 novembre';
  const H = F.html(T, S, P);
  V(!!H, nom + ' : le bloc a quelque chose à dire');
  if (!H) continue;
  V(H.valeur === $(A.garde), nom + ' : tuile « À garder en crypto » = (reste − liquide) ÷ 0,98 = ' + $(A.garde), H.valeur);
  const pAtt = A.crypto > 0 ? 'dont sa moitié : ' + $(A.moitie) : (A.reste > 0 ? 'tout est déjà retiré en liquide' : 'tout ce qui est dû est payé');
  V(texte(H.pastille) === pAtt, nom + ' : « ' + pAtt + ' »', texte(H.pastille));
  const rAtt = releveAttendu(A);
  V(texte(H.releve).replace(/[ \u00a0]/g, '') === rAtt.replace(/[ \u00a0]/g, ''), nom + ' : relevé « depuis le début ' + $(A.imp) + ' = arrondi ' + $s(A.arrondi) + ' + déjà payés ' + $(A.paye)
    + (A.avance ? ' − payé d’avance ' + $(A.avance) : '') + ' + reste ' + $(A.reste) + ' »' + (A.liq ? ' (liquide ' + $(A.liq) + ')' : ''), texte(H.releve) + ' / attendu ' + rAtt);
  const f = ferme(H.releve);
  V(f === true, nom + ' : le relevé ferme le compte, au centime (total = somme signée des lignes)', f);
  const nP = ENTS.filter((e) => e.date.slice(0, 7) === quand.slice(0, 7)).reduce((s, e) => s + e.brut * 0.8, 0);
  if (nP > 0) V(texte(H.periode) === 'impôts : ' + $(Math.round(nP * 0.01 * 100)), nom + ' : période « impôts : ' + $(Math.round(nP * 0.01 * 100)) + ' », ni « à payer » ni « à garder »', texte(H.periode));
  else V(H.periode === null, nom + ' : période sans OnlyFans : la ligne de période n’est pas touchée', H.periode);
  V(H.valeur === F.fmtC(S.garde) && H.releve.includes(F.fmtC(S.reste / 100)), nom + ' : = les MÊMES S.garde / S.reste que le geste ② et la ligne repliée');
  V(S.paye - S.avance === S.rows.reduce((s, r) => s + r.couvert, 0), nom + ' : rien ne se perd : payé − d’avance = ce qui couvre les mois', [S.paye, S.avance]);
}
{
  // (17/10) aucun bilan avant le suivi, des impôts d'un tiers de centime par mois : le total arrondi ($24.01) et les
  // trois mois arrondis ($8 chacun) diffèrent d'un centime -> « dont arrondi au centime, mois par mois : $0.01 »
  const E2 = [bilan('2026-08-31', 800.40), bilan('2026-09-30', 800.40), bilan('2026-10-10', 800.40)];
  const imps = [ip('2026-08', '2026-09-15', 8)];
  charger.retraits = [];
  const F = charger('2026-10-16T10:00:00', E2, imps);
  const T = F.frais(E2), S = F.suivi(), P = F.frais(F.bilansMois('2026-10'));
  const A = attendu(E2, imps, '2026-10'), H = F.html(T, S, P);
  V(A.arrondi === 1, 'jeu « arrondi » : 1 centime d’écart entre le total arrondi et les mois arrondis (contrôle du banc)', A.arrondi);
  V(texte(H.releve).replace(/ /g, '') === releveAttendu(A).replace(/ /g, ''), 'sans bilan avant le suivi : « dont arrondi au centime, mois par mois $0.01 »', texte(H.releve));
  const f = ferme(H.releve);
  V(f === true, 'sans bilan avant le suivi : le relevé ferme quand même le compte, au centime', f);
}
{
  charger.retraits = [];
  const F = charger('2026-10-16T10:00:00', ENTS, []);
  const T = F.frais(ENTS);
  V(F.suivi() === null && F.html(T, null, null) === null, 'aucun paiement ni retrait noté : pas de suivi, rien à réécrire (le bloc d’avant, tel quel)');
  const F0 = charger('2026-10-16T10:00:00', [{ date: '2026-09-30', brut: 0, tgNet: 3000, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: 3000 }], [ip('2026-09', '2026-10-15', 20)]);
  V(F0.html(F0.frais([]), F0.suivi(), null) === null, 'aucun OnlyFans (bloc « Aucun impôt à garder ») : rien à réécrire');
}

// ── 3 et 4. Dans un faux document ───────────────────────────────────────────────────────────────────────────────
console.log('\n-- 3. sans suivi : rien ; 4. avec suivi : la tuile, son relevé et la période réécrits --');
function noeud(cls, txt) {
  const n = { cls: new Set(cls), texte: txt || '', html: txt || '', enfants: [], parent: null };
  n.classList = { contains: (c) => n.cls.has(c), add: (c) => n.cls.add(c) };
  Object.defineProperty(n, 'textContent', { get: () => n.texte, set: (v) => { n.texte = String(v); n.html = String(v); } });
  Object.defineProperty(n, 'innerHTML', { get: () => n.html, set: (v) => { n.html = String(v); n.texte = texte(v); } });
  Object.defineProperty(n, 'children', { get: () => n.enfants.slice() });
  n.removeChild = (c) => { n.enfants = n.enfants.filter((x) => x !== c); };
  n.insertAdjacentHTML = (ou, h) => { const x = noeud(['ajout']); x.innerHTML = h; n.enfants.push(x); };
  return n;
}
function monde() {
  const l = noeud(['ip-l'], 'À garder en crypto'), v = noeud(['ip-v'], '$504.08'), s = noeud(['ip-s'], 'dont sa moitié : $252.04');
  const r1 = noeud(['ip-rel'], 'Impôts à payer, en liquide $494'), d1 = noeud(['ip-cout-det'], '= $494 + …'), r2 = noeud(['ip-rel', 'ip-rel-2'], 'Partagé'), d2 = noeud(['ip-cout-det', 'ip-chacun-det'], 'sa moitié');
  const tot = noeud(['ip-c', 'ip-tot']); tot.enfants = [l, v, s, r1, d1, r2, d2];
  tot.querySelector = (q) => (q === '.ip-v' ? v : q === '.ip-s' ? s : null);
  const pv = noeud(['ip-per-v'], 'impôts à payer : $68 · à garder en crypto : $69.39, dont sa moitié $34.70');
  const el = noeud(['panel', 'ip-panel']);
  el.querySelector = (q) => (q === '.ip-eq .ip-tot' ? tot : q === '.ip-per-v' ? pv : null);
  return { el, tot, l, v, s, pv };
}
{
  const imps = [ip('2026-08', '2026-09-15', 94), ip('2026-09', '2026-10-15', 60)];
  charger.retraits = [];
  const F = charger('2026-10-16T10:00:00', ENTS, imps);
  const T = F.frais(ENTS), S = F.suivi(), P = F.frais(F.bilansMois('2026-10'));
  let W = monde(); W.el._ipI = { total: T, periode: P };
  F.verite(W.el, null);
  V(W.v.texte === '$504.08' && W.tot.enfants.length === 7 && /à garder/.test(W.pv.texte), 'sans suivi : RIEN n’est touché (tuile, relevé, période)');
  W = monde(); W.el._ipI = { total: T, periode: P }; W.el.cls.add('ip-0');
  F.verite(W.el, S);
  V(W.v.texte === '$504.08', 'bloc sans OnlyFans (ip-0) : rien n’est touché');
  W = monde(); W.el._ipI = { total: T, periode: P };
  F.verite(W.el, S);
  const A = attendu(ENTS, imps, '2026-10');
  V(W.v.texte === $(A.garde), 'avec suivi : la tuile dit ' + $(A.garde) + ' (reste ' + $(A.reste) + ' ÷ 0,98)', W.v.texte);
  V(texte(W.s.html) === 'dont sa moitié : ' + $(A.moitie), 'avec suivi : sa moitié ' + $(A.moitie), W.s.html);
  const restes = W.tot.enfants.map((x) => [...x.cls].join(' '));
  V(JSON.stringify(restes) === JSON.stringify(['ip-l', 'ip-v', 'ip-s', 'ajout']), 'l’étiquette est gardée ; l’ancien relevé (impôts à payer, coût réel, partagé) est retiré ; le nouveau est ajouté', restes.join(' | '));
  V(/Impôts depuis le début/.test(W.tot.enfants[3].texte) && !/Impôts à payer|Coût réel|Partagé/.test(W.tot.enfants.map((x) => x.texte).join(' ')), 'le relevé ne dit plus « Impôts à payer » (le total depuis le début, déjà payés compris)');
  V(W.pv.texte === 'impôts : $68', 'la ligne de période : « impôts : $68 »', W.pv.texte);
  V(W.tot.cls.has('ip-tot-sv'), 'la tuile est marquée (ip-tot-sv)');
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
