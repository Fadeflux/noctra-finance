// (ADAPTÉ le 16/10 par feat8_impots_reels — original : bancs_final/test_impots_repli.js. La règle de CE banc ne change pas :
//  la ligne repliée dit les chiffres du bloc, pris aux MÊMES variables. Ce qui change : le geste ② est écrit par _irGeste2(S)
//  (le même S) ; avec de l'argent déjà retiré en liquide, la ligne le dit (fmtC(S.liquide / 100)) et ne garde en crypto que
//  le reste (fmtC(S.crypto / 100)) ; trois cas « liquide de côté » sont ajoutés au §3.)
// « IMPÔTS À GARDER DE CÔTÉ » REPLIÉ AU TÉLÉPHONE (P4, 16/10) : la ligne repliée dit EXACTEMENT les chiffres du bloc,
// pris aux MÊMES variables, et « Voir le calcul » ne recalcule rien. Prouvé sur le VRAI code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec un faux document
// en mémoire. (Règle de la maison : on ne teste jamais sur la base réelle.)
//
// Ce qu'il surveille :
//  1. La ligne est écrite là où les chiffres le sont : renderImpots passe T (l'objet de la tuile « À garder en crypto »)
//     à _ipRepliHtml ; _impDecorer passe S (l'objet du geste ②) à _ipRepliSuivi, après avoir posé le suivi.
//     (16/10, feat7_impots, O1 : la tuile écrit T SANS suivi seulement ; dès qu'un paiement d'impôts est noté,
//      _impDecorer → _ipVerite y écrit le MÊME S que la ligne et le geste ② — une seule vérité, prouvée par
//      test_impots_une_verite.js. La règle de CE banc ne change pas : la ligne dit toujours les chiffres du bloc.)
//  2. Aucun calcul parallèle dans le code P4 : ni taux, ni 1 %, ni ÷ 0,98, ni arrondi (seulement fmtC de T / S).
//  3. Les montants : T fabriqué par le VRAI _chFrais sur des bilans fictifs → la ligne = les montants recalculés ICI à
//     part (1 % × 0,80 × bruts ÷ 0,98, sa moitié au centime qui monte) ; suivi : S.garde et S.reste ; « rien à garder ».
//  4. « Voir le calcul » : une classe, aria-expanded, le libellé, le choix gardé sur l'appareil — aucun dessin, aucun
//     calcul ; stockage refusé : ça marche quand même ; sans bouton, jamais replié.
//  5. Le CSS : ligne et bouton cachés par défaut, montrés seulement au téléphone ; le relevé caché seulement là.
//
// Lancer : node test_impots_repli.js            (ou : node test_impots_repli.js <autre_page.html> — elle doit y échouer
//          si la page n'a pas le bloc replié)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0;
function V(cond, quoi, detail) {
  if (cond) console.log('  OK  ' + quoi);
  else { ko++; console.error('  KO  ' + quoi + (detail ? ' -> ' + String(detail).slice(0, 300) : '')); }
}

/** Découpe une fonction du fichier source par équilibrage des accolades. */
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

const P4 = ['_ipCalcOuvert', '_ipRepliHtml', '_ipRepliSuivi', '_ipRepliControles', '_ipRepliFocus', '_ipRepliAppliquer', 'ipCalcBasculer'];
let CODE_P4, CODE_CALC, R_IMP, R_DEC;
try {
  CODE_P4 = P4.map(extraire).join('\n');
  CODE_CALC = [ligneDe(/const _TAUX=[^;\n]*;/, '_TAUX'), ligneDe(/const _IMPOTS_OF=[^;\n]*;/, '_IMPOTS_OF'),
    ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const SITE_FINANCES=[^;\n]*;/, 'SITE_FINANCES'), extraire('cleLocale'), extraire('_chNb'), extraire('_chCtsAff'),
    extraire('centimesBilan'), extraire('centimesBilans'), extraire('_chFrais')].join('\n');
  R_IMP = extraire('renderImpots');
  R_DEC = extraire('_impDecorer');
} catch (e) {
  console.error('  KO  le bloc replié (ou les calculs du bloc impôts) est absent de la page : ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

// ── Faux document : juste ce que le code P4 touche ─────────────────────────────────────────────────────────────
function classes(init) {
  const s = new Set(init || []);
  return { contains: (c) => s.has(c), add: (c) => s.add(c), remove: (c) => s.delete(c),
    toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; }, liste: () => [...s] };
}
function noeud(cls, id) {
  const n = { id: id || '', classList: classes(cls), attrs: {}, html: '', texte: '', enfants: {}, focus: function () { M.actif = this; } };
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  n.querySelector = (s) => n.enfants[s] || null;
  Object.defineProperty(n, 'innerHTML', { get: () => n.html, set: (v) => { n.html = String(v); M.ecrits++; } });
  Object.defineProperty(n, 'textContent', { get: () => n.texte, set: (v) => { n.texte = String(v); } });
  return n;
}
const M = { actif: null, ecrits: 0, dessins: 0, stock: new Map(), refus: false };
function monde() {
  M.actif = null; M.ecrits = 0; M.dessins = 0;
  const bt = noeud(['ip-repli-bt']); bt.texte = 'Voir le calcul';
  const b = noeud(['btn-sec', 'ip-repli-b'], 'ip-repli-b'); b.enfants['.ip-repli-bt'] = bt; b.attrs['aria-expanded'] = 'false';
  const l = noeud(['ip-repli-l'], 'ip-repli-l');
  const parts = [noeud(['ip-tete']), noeud(['ip-repli']), noeud(['ip-eq']), noeud(['ip-suivi'], 'ip-suivi'), noeud(['ip-phrase', 'ip-etapes']), noeud(['ip-per']), noeud(['ip-note'])];
  const el = noeud(['panel', 'ip-panel'], 'impots-panel');
  el.children = parts; el.enfants['#ip-repli-b'] = b; el.enfants['#ip-repli-l'] = l;
  return { el, b, l, parts, bt };
}
const localStorage = {
  getItem: (k) => { if (M.refus) throw new Error('refusé'); return M.stock.has(k) ? M.stock.get(k) : null; },
  setItem: (k, v) => { if (M.refus) throw new Error('refusé'); M.stock.set(k, String(v)); },
  removeItem: (k) => { if (M.refus) throw new Error('refusé'); M.stock.delete(k); },
};
let W;
function charger() {
  const document = { activeElement: null, getElementById: (id) => (id === 'impots-panel' ? W.el : id === 'ip-repli-b' ? W.b : null) };
  Object.defineProperty(document, 'activeElement', { get: () => M.actif });
  const espions = 'function renderImpots(){ M.dessins++; } function uk(){ M.dessins++; } function renderChiffres(){ M.dessins++; } function _impRedessiner(){ M.dessins++; }\n';
  // « var _ipCalcEtat; » comme dans la page : chaque chargement part d'un état neuf (une page rouverte)
  return new Function('document', 'localStorage', 'M', 'console',
    CODE_CALC + '\nvar ICO = {chev: "<svg></svg>", recu: "<svg></svg>"};\nvar _ipCalcEtat;\n' + espions +
    'function _irEcheance(r){ return (r && r.length) ? {fen: "2026-11"} : null; } function _irFenTxt(w){ return "du 1er au 15 novembre"; }\n' + CODE_P4 + '\n' +
    'return { html: _ipRepliHtml, suivi: _ipRepliSuivi, appliquer: _ipRepliAppliquer, basculer: ipCalcBasculer, frais: _chFrais, fmtC: fmtC,' +
    ' ouvert: _ipCalcOuvert, remettre: function(){ _ipCalcEtat = undefined; } };')(document, localStorage, M, { warn() {} });
}
const texte = (h) => h.replace(/<[^>]+>/g, '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

// ── 1. La ligne est écrite là où les chiffres le sont ───────────────────────────────────────────────────────────
console.log('\n-- 1. la ligne prend les variables du bloc, là où il les écrit --');
V(/var I = chImpots\(\), T = I\.total;/.test(R_IMP) && /tuile\('ip-tot', 'À garder en crypto', fmtC\(T\.garde\)/.test(R_IMP)
  && /dont sa moitié : <b>' \+ fmtC\(T\.moitie\)/.test(R_IMP), 'renderImpots : SANS suivi, la tuile « À garder en crypto » écrit fmtC(T.garde) et sa pastille fmtC(T.moitie) (avec suivi : S, voir test_impots_une_verite.js)');
V(/el\.innerHTML = _chNb\(tete \+ _ipRepliHtml\(T\) \+ eq \+ etapes \+ per \+ note\); _ipRepliAppliquer\(el, _ipFoc\);/.test(R_IMP),
  'renderImpots : la ligne est écrite avec CE T, dans le même innerHTML, puis le repli est appliqué');
const brancheVide = (R_IMP.split("el.innerHTML = _chNb(tete + '<div class=\"ip-vide\">")[1] || '').split('return;')[0];
V(brancheVide !== '' && !/_ipRepliHtml/.test(brancheVide), 'sans OnlyFans (« Aucun impôt à garder ») : ni ligne ni bouton');
V(/\nvar _ipCalcEtat;/.test(SRC), 'l’état ouvert / fermé est une variable de la page, lue sur l’appareil au premier besoin');
const iIns = R_DEC.indexOf("el.insertBefore(d, el.querySelector('.ip-per') || note || null);"), iSuivi = R_DEC.indexOf('_ipRepliSuivi(el, S)');
const G2 = (() => { try { return extraire('_irGeste2'); } catch (e) { return ''; } })();
V(iIns > 0 && iSuivi > iIns && /var S=_impSuivi\(\)/.test(R_DEC) && /li\.innerHTML=_chNb\(_irGeste2\(S\)\)/.test(R_DEC) && /fmtC\(S\.garde\)/.test(G2) && /fmtC\(S\.reste \/ 100\)/.test(G2),
  '_impDecorer : le geste ② (_irGeste2) écrit fmtC(S.garde) / fmtC(S.reste / 100) du MÊME S, et la ligne reçoit CE S, après le suivi');
V(/try\{ _ipRepliSuivi\(el, S\); \}catch\(e\)/.test(R_DEC), '_impDecorer : une faute de la ligne ne peut pas casser le suivi (try/catch)');

// ── 2. Aucun calcul parallèle ───────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. aucun calcul parallèle dans le code P4 --');
const sansCommentaires = CODE_P4.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const interdits = ['_TAUX', '_IMPOTS_OF', '_RETRAIT_LIQUIDE', '_PAXUM_OF', '0.98', '0.01', '0.8', 'Math.round', 'Math.floor', 'toFixed', '_chFrais', '_impSuivi', 'chImpots', 'saMoitie'];
const trouves = interdits.filter((x) => sansCommentaires.includes(x));
V(!trouves.length, 'aucun taux, arrondi ni calcul d’impôts dans les fonctions P4 (seulement fmtC(T.…) / fmtC(S.…))', trouves.join(', '));
const montantsP4 = (sansCommentaires.match(/fmtC\([^)]*\)/g) || []).sort();
V(JSON.stringify([...new Set(montantsP4)]) === JSON.stringify(['fmtC(S.crypto / 100)', 'fmtC(S.garde)', 'fmtC(S.liquide / 100)', 'fmtC(S.reste / 100)', 'fmtC(T.garde)', 'fmtC(T.moitie)']),
  'les SEULS montants écrits : fmtC(T.garde), fmtC(T.moitie), fmtC(S.garde), fmtC(S.reste / 100), fmtC(S.liquide / 100), fmtC(S.crypto / 100)', montantsP4.join(' '));
const bascule = extraire('ipCalcBasculer');
V(!/renderImpots|uk\(|renderChiffres|_impRedessiner|innerHTML|fmtC/.test(bascule), '« Voir le calcul » ne redessine rien et n’écrit aucun montant');

// ── 3. Les montants, recalculés ici à part ──────────────────────────────────────────────────────────────────────
console.log('\n-- 3. la ligne dit les bons montants (recalcul à part) --');
const r2 = (x) => Math.round(x * 100) / 100;
function attendu(bruts) {            // à part : 1 % × 0,80 × somme des bruts ÷ 0,98 ; sa moitié = arrondi des centimes ÷ 2
  let br = 0; bruts.forEach((b) => { br += b; });
  const garde = br * 0.8 * 0.01 / 0.98;
  const cg = Math.round(Number(garde.toFixed(2)) * 100);
  return { garde: garde, moitie: Math.round(cg / 2) / 100 };
}
const JEUX = [[12345.67, 9876.54, 4321.09], [9000, 6000, 3900.5], [2471234.56, 2471234.56], [0.01], [61250.33, 8.17], [100, 200, 300.13]];
let F = charger();
for (const bruts of JEUX) {
  W = monde();
  const es = bruts.map((b, i) => ({ date: '2026-1' + (i % 3) + '-01', brut: b, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: r2(b * 0.8 * 0.95) }));
  const T = F.frais(es);
  const A = attendu(bruts);
  const h = F.html(T);
  const att = T.imp > 0 ? 'Garde ' + F.fmtC(A.garde) + ' en crypto pour les impôts (dont sa moitié ' + F.fmtC(A.moitie) + ')Voir le calcul' : '';
  V(texte(h) === att, 'bruts ' + bruts.join(' + ') + ' : « ' + texte(h).replace('Voir le calcul', ' | Voir le calcul') + ' »', 'attendu « ' + att + ' »');
  if (T.imp > 0) V(h.includes(F.fmtC(T.garde)) && h.includes(F.fmtC(T.moitie)), '   … = fmtC(T.garde) et fmtC(T.moitie) du bloc');
}
W = monde();
V(F.html({ imp: 0, garde: 0, moitie: 0 }) === '' && F.html(null) === '', 'pas d’impôts (ou rien) : pas de ligne');
W = monde();
F.suivi(W.el, { reste: 12400, garde: 12400 / 100 / 0.98, liquide: 0, crypto: 12400, rows: [] });
V(texte(W.l.html) === 'Garde ' + F.fmtC(124 / 0.98) + ' en crypto pour les ' + F.fmtC(124) + ' d’impôts qu’il reste à payer', 'suivi : « ' + texte(W.l.html) + ' »');
F.suivi(W.el, { reste: 0, garde: 0, liquide: 0, crypto: 0, rows: [] });
V(texte(W.l.html) === 'Rien à garder pour les impôts en ce moment : tout ce qui est dû est payé', 'suivi, tout payé : « ' + texte(W.l.html) + ' »');
F.suivi(W.el, null);
V(texte(W.l.html) === 'Rien à garder pour les impôts en ce moment : tout ce qui est dû est payé', 'sans suivi : la ligne n’est pas touchée');
// (feat8) l'argent déjà retiré en liquide : dit à la place de « garde … en crypto », pour sa part
F.suivi(W.el, { reste: 49400, garde: 0, liquide: 49400, crypto: 0, rows: [{ reste: 49400 }] });
V(texte(W.l.html) === 'En liquide, de côté : $494 · à payer au bureau du 1er au 15 novembre', 'tout retiré : « ' + texte(W.l.html) + ' »');
F.suivi(W.el, { reste: 49400, garde: 19400 / 100 / 0.98, liquide: 30000, crypto: 19400, rows: [{ reste: 49400 }] });
V(texte(W.l.html) === 'En liquide, de côté : $300 · garde ' + F.fmtC(194 / 0.98) + ' en crypto pour les $194 qui restent', 'retiré en partie : « ' + texte(W.l.html) + ' »');
F.suivi(W.el, { reste: 0, garde: 0, liquide: 600, crypto: 0, rows: [] });
V(texte(W.l.html) === 'Rien à garder pour les impôts en ce moment : tout ce qui est dû est payé · $6 en liquide, de côté', 'tout payé, du liquide reste : « ' + texte(W.l.html) + ' »');

// ── 4. « Voir le calcul » ───────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. « Voir le calcul » : une classe, rien d’autre --');
M.stock.clear(); M.refus = false; F = charger(); W = monde();
F.appliquer(W.el, false);
V(W.el.classList.contains('ip-replie') && W.b.getAttribute('aria-expanded') === 'false', 'replié par défaut, aria-expanded="false"');
V(W.b.getAttribute('aria-controls') === 'ip-calc-tuiles ip-suivi ip-calc-gestes ip-calc-periode ip-calc-note', 'aria-controls : les parties du relevé', W.b.getAttribute('aria-controls'));
const avant = M.ecrits;
F.basculer();
V(!W.el.classList.contains('ip-replie') && W.b.getAttribute('aria-expanded') === 'true' && W.bt.texte === 'Masquer le calcul', 'déplié : classe ôtée, aria-expanded="true", « Masquer le calcul »');
V(M.dessins === 0 && M.ecrits === avant, 'aucun dessin, aucun innerHTML pendant le geste');
V(M.stock.get('fin_noctra_impots_calcul') === '1', 'le choix est gardé sur l’appareil (fin_noctra_impots_calcul)');
F = charger(); W = monde(); F.appliquer(W.el, false);
V(!W.el.classList.contains('ip-replie') && W.b.getAttribute('aria-expanded') === 'true', 'page rouverte : toujours déplié');
F.basculer();
V(W.el.classList.contains('ip-replie') && W.bt.texte === 'Voir le calcul' && !M.stock.has('fin_noctra_impots_calcul'), 'replié de nouveau : choix effacé');
M.refus = true; F = charger(); W = monde();
let ok = true; try { F.appliquer(W.el, false); F.basculer(); } catch (e) { ok = false; }
V(ok && !W.el.classList.contains('ip-replie') && W.b.getAttribute('aria-expanded') === 'true', 'stockage refusé : replié par défaut puis « Voir le calcul » marche');
M.refus = false; M.stock.clear(); F = charger(); W = monde();
W.el.enfants['#ip-repli-b'] = null; W.el.classList.add('ip-replie');
F.appliquer(W.el, false);
V(!W.el.classList.contains('ip-replie'), 'sans bouton : jamais replié (rien de caché sans moyen de l’ouvrir)');
W = monde(); M.actif = null; F.appliquer(W.el, true);
V(M.actif === W.b, 'après un redessin, le bouton retrouve le focus qu’il avait');

// ── 5. Le CSS ───────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 5. le CSS : seulement au téléphone --');
const css = (SRC.match(/<style>[\s\S]*<\/style>/) || [''])[0];
const iP4 = css.indexOf('#impots-panel .ip-repli{display:none}');
const blocP4 = iP4 >= 0 ? css.slice(iP4, css.indexOf('\n}', css.indexOf('@media (max-width:640px)', iP4)) + 2) : '';
V(iP4 >= 0, 'ligne et bouton cachés par défaut (ordinateur, tablette)');
const horsMedia = blocP4.split('@media (max-width:640px)')[0];
V(blocP4.includes('@media (max-width:640px)') && !/display:flex|ip-replie/.test(horsMedia),
  'ils ne s’affichent, et le relevé ne se cache, qu’à 640 px et moins');
V(/#impots-panel\.ip-replie:not\(\.ip-0\) > :not\(\.ip-tete\):not\(\.ip-repli\)\{display:none\}/.test(blocP4), 'replié : tout le relevé caché, titre et ligne gardés');
// déplié, RIEN n'est caché : la seule règle « display:none » hors repli est celle de la ligne à l'ordinateur
const finP4 = css.indexOf('/* ── ', iP4) > 0 ? css.indexOf('/* ── ', iP4) : css.length;
const caches = (css.slice(iP4, finP4).match(/[^{}]+\{[^}]*display:none[^}]*\}/g) || []).map((r) => r.split('{')[0].trim());
const horsRepli = caches.filter((s) => s !== '#impots-panel .ip-repli' && !/\.ip-replie/.test(s));
V(caches.length >= 2 && !horsRepli.length, 'déplié, le relevé est entier : aucune partie cachée hors de l’état replié', horsRepli.join(' | '));
V(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(blocP4.replace(/#impots-panel|#ip-[a-z-]+/g, '')), 'aucune couleur en dur (jetons du thème)');

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
