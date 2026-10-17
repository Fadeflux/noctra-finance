// IMPÔTS DÉJÀ DUS : TOUJOURS NOTABLES DEPUIS LE SUIVI (O4, revu le 16/10 avec les impôts réels). Les impôts se paient en
// UNE fois, au bureau, du 1er au 15, pour TOUT ce qui est dû : le suivi du bloc impôts n'a plus un bouton par mois mais UN
// geste « J'ai payé les impôts » (le MÊME formulaire que la liste du mois : « Tout ce qui est dû : $X » ou un autre
// montant), et « J'ai déjà retiré l'argent » tant qu'il reste quelque chose en crypto. « Enregistrer » passe par la
// fonction GLOBALE de la liste (et ses enveloppes). Prouvé sur le VRAI code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des bilans et des
// paiements FICTIFS, une date figée et un faux document en mémoire. (Règle de la maison : jamais la base réelle.)
//
// Ce qu'il surveille :
//  1. Les gestes du suivi : « J'ai payé les impôts » s'il reste des impôts dus des mois TERMINÉS (jamais pour le seul
//     mois en cours), « J'ai déjà retiré l'argent » s'il reste quelque chose en crypto ; jamais en lecture seule, ni pour
//     l'associé ; UN de chaque, plus aucun bouton par mois.
//  2. ipSuiviPayer ouvre le formulaire dans le suivi (_lmForm = {ym: mois en cours, ou: 'suivi'}) et rien d'autre ; il
//     refuse quand rien n'est dû, en lecture seule ; un formulaire ouvert dans la liste se referme d'abord.
//  3. Le MÊME formulaire (_lmFormHtml : « Impôts payés au bureau », « Tout ce qui est dû : $X » coché et proposé, un autre
//     montant possible, « Annuler » / « Enregistrer ») ; le message après « Enregistrer » s'écrit dans le suivi.
//  4. La MÊME écriture : « Enregistrer » = ipPaieEnregistrer → listeImpotsEnregistrer (la globale, enveloppée par
//     feat7_impots et feat7_mois, jamais réaffectée ici) : lireMontant, refus en lecture seule, file d'attente,
//     _ecrireImpotsPayes, Historique ; le paiement écrit est « tout ce qui est dû » ({id, global, date, amount, le}).
//
// Lancer : node test_impots_suivi_noter.js            (ou : node test_impots_suivi_noter.js <autre_page.html>)
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

let CODE, R_ENR, R_PAIE, R_SVH, ENVELOPPE;
try {
  R_ENR = extraire('listeImpotsEnregistrer'); R_PAIE = extraire('ipPaieEnregistrer'); R_SVH = extraire('_impSuiviHtml');
  const i = SRC.indexOf('listeImpotsEnregistrer = function(){');
  if (i < 0) throw new Error('enveloppe de « Enregistrer » introuvable');
  ENVELOPPE = SRC.slice(i, SRC.indexOf('\n    };', i));
  CODE = [ligneDe(/const _TAUX=[^;\n]*;/, '_TAUX'), ligneDe(/const _IMPOTS_OF=[^;\n]*;/, '_IMPOTS_OF (et _RETRAIT_LIQUIDE)'),
    ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'), ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'),
    ligneDe(/var _LM_I=\(function\(\)\{[\s\S]*?\n\}\)\(\);/, '_LM_I'), ligneDe(/var _IR_I = \(function\(\)\{[\s\S]*?\n\}\)\(\);/, '_IR_I'),
    extraire('_ymd'), extraire('_aujLocal'), extraire('_ymLocal'), extraire('_lmSuivant'), extraire('_lmJour'), extraire('_lmNomComplet'),
    extraire('_lmDeComplet'), extraire('_nomMois'), extraire('_deMois'), extraire('_sansZero'), extraire('dl'), extraire('dlA'), extraire('_jourCourt'),
    extraire('grafCap'), extraire('_bilansMois'), extraire('_chNb'), extraire('_chCtsAff'), extraire('centimesBilan'), extraire('centimesBilans'),
    extraire('_chFrais'), extraire('_impValide'), extraire('_impGlobal'), extraire('_cleImpot'), extraire('_irValide'), extraire('_irRetraits'), extraire('_irCle'),
    extraire('_impSuivi'), extraire('_irEcheance'), extraire('_irFenTxt'), extraire('_irDuAvant'), extraire('_irSvFlash'), extraire('_irSvGestes'),
    extraire('_irFormRetraitHtml'), R_SVH, extraire('_lmMontantChamp'), extraire('_lmFormHtml'), extraire('_irOuvrirForm'), extraire('ipSuiviPayer')].join('\n');
} catch (e) {
  console.error('  KO  les gestes du suivi (impôts réels) sont absents de la page -> ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

const RealDate = Date;
function charger(maintenant, ents, impots, o) {
  o = o || {};
  const NOW = new RealDate(maintenant).getTime();
  function FauxDate(...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); }
  FauxDate.now = () => NOW; FauxDate.prototype = RealDate.prototype;
  const M = { redessins: 0, listes: 0 };
  const document = { body: { classList: { contains: (c) => c === 'readonly' && !!o.ro } }, getElementById: () => null };
  const F = new Function('Date', 'ents', 'impotsPayes', 'impotsRetraits', 'document', 'console', 'M', 'requestAnimationFrame', 'ROLE',
    CODE + '\nfunction profitEntree(){ return 0; }\nvar _lmForm=null, _lmFlash=null, _lmEnCours=false; var _lmFlashOu, _ipSvFlashYm; var _role = ROLE;\n' +
    'function _impRedessiner(){ M.redessins++; } function _majListe(){ M.listes++; } function _fmAmener(){} function _lmFenetre(){ return {ym: _ymLocal(), fin: false}; }\n' +
    'return { suivi: function(){ return _impSuivi(); }, html: _impSuiviHtml, payer: ipSuiviPayer, du: _irDuAvant, etat: function(){ return {form: _lmForm, flash: _lmFlash}; },' +
    ' poser: function(f, fl, ou){ _lmForm = f; _lmFlash = fl; _lmFlashOu = ou; } };')(
    FauxDate, ents, impots, o.retraits || [], document, { warn() {} }, M, () => 0, o.role || 'proprio');
  F.M = M;
  return F;
}
function bilan(date, netOF) { return { date: date, brut: netOF / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: netOF * 0.95 }; }
// impôts : août $94, septembre $112, octobre $68
const ENTS = [bilan('2026-08-31', 9400), bilan('2026-09-30', 11200), bilan('2026-10-01', 6800)];
const AOUT = { id: 'a', mois: '2026-08', date: '2026-09-15', amount: 94, le: '2026-09-15T09:00:00.000Z' };
const TOUT = { id: 'g', global: true, date: '2026-11-10', amount: 274, le: '2026-11-10T09:00:00.000Z' };
const RET = { id: 'r', date: '2026-10-16', amount: 274, le: '2026-10-16T09:00:00.000Z' };
const payer = (h) => [...h.matchAll(/id="ip-sv-b-(\d{4}-\d{2})"/g)].map((m) => m[1]);
const retirer = (h) => [...h.matchAll(/id="ip-sv-r-(\d{4}-\d{2})"/g)].map((m) => m[1]);
const texte = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

// ── 1. Les gestes du suivi ─────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. les gestes du suivi : UN « J’ai payé les impôts », UN « J’ai déjà retiré l’argent » --');
let F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
let S = F.suivi(), H = F.html(S);
V(JSON.stringify(payer(H)) === JSON.stringify(['2026-11']) && (H.match(/class="lm-b lm-b-pri ip-sv-noter"/g) || []).length === 1,
  '16 nov. : UN bouton « J’ai payé les impôts » (septembre et octobre restent dus), plus un par mois', payer(H));
V(/onclick="ipSuiviPayer\(\)"/.test(H) && /<span>J’ai payé les impôts<\/span>/.test(H), 'il ouvre le formulaire du paiement (ipSuiviPayer)');
V(JSON.stringify(retirer(H)) === JSON.stringify(['2026-11']) && /onclick="ipRetraitOuvrir\('suivi'\)"/.test(H) && /<span>J’ai déjà retiré l’argent<\/span>/.test(H),
  'et UN « J’ai déjà retiré l’argent » (il reste quelque chose en crypto)');
V(!/ip-sv-b-2026-09|ip-sv-b-2026-10|Noter un paiement/.test(H), 'plus aucun bouton par mois');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { retraits: [RET] });
H = F.html(F.suivi());
V(payer(H).length === 1 && retirer(H).length === 0, 'tout l’argent dû est déjà retiré en liquide : « J’ai payé » reste, « J’ai retiré » part', [payer(H), retirer(H)]);
F = charger('2026-11-16T10:00:00', ENTS, [TOUT]);
H = F.html(F.suivi());
V(payer(H).length === 0 && retirer(H).length === 0 && /rien à garder : tout ce qui est dû est payé/.test(texte(H)), 'tout est payé : aucun geste');
F = charger('2026-10-16T10:00:00', [bilan('2026-10-01', 6800)], [{ id: 'x', global: true, date: '2026-10-02', amount: 1, le: '2026-10-02T09:00:00.000Z' }]);
H = F.html(F.suivi());
V(payer(H).length === 0 && retirer(H).length === 1, 'seul le mois en cours reste (à payer le mois prochain) : pas de « J’ai payé », « J’ai retiré » oui', [payer(H), retirer(H)]);
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { ro: true });
H = F.html(F.suivi());
V(payer(H).length === 0 && retirer(H).length === 0, 'lecture seule : aucun geste');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { role: 'assoc' });
H = F.html(F.suivi());
V(payer(H).length === 0 && retirer(H).length === 0, 'associé : aucun geste (comme la liste du mois, cachée pour lui)');

// ── 2. Le geste ────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. ipSuiviPayer : le formulaire dans le suivi, rien d’autre --');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
F.payer();
V(JSON.stringify(F.etat().form) === JSON.stringify({ ym: '2026-11', ou: 'suivi' }) && F.M.redessins >= 1, '_lmForm = {ym:"2026-11", ou:"suivi"}, un redessin', JSON.stringify(F.etat()));
F = charger('2026-11-16T10:00:00', ENTS, [TOUT]);
F.payer();
V(F.etat().form === null, 'rien de dû : refusé, rien ouvert');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { ro: true });
F.payer();
V(F.etat().form === null, 'lecture seule : refusé');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
F.poser({ ym: '2026-10' }, null, ''); F.M.redessins = 0;
F.payer();
V(F.M.redessins >= 2 && JSON.stringify(F.etat().form) === JSON.stringify({ ym: '2026-11', ou: 'suivi' }), 'le formulaire ouvert dans la liste se referme d’abord (un seul ouvert)');

// ── 3. Le MÊME formulaire, dans le suivi ───────────────────────────────────────────────────────────────────────
console.log('\n-- 3. le même formulaire, dans le suivi ; le message aussi --');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
F.poser({ ym: '2026-11', ou: 'suivi' }, null, '');
H = F.html(F.suivi());
V(/id="lm-f-t">Impôts payés au bureau</.test(H) && /Tout ce qui est dû : <b>\$180<\/b><small>septembre à octobre<\/small>/.test(H) && /id="lm-f-mt"[^>]*value="180"/.test(H),
  'le formulaire : « Impôts payés au bureau », « Tout ce qui est dû : $180 » (septembre à octobre), 180 proposé');
V(/id="lm-f-tout" value="tout" checked/.test(H) && /id="lm-f-libre" value="libre"/.test(H), '« Tout ce qui est dû » coché, « Un autre montant » possible');
V(/onclick="ipPaieEnregistrer\(\)"/.test(H) && /onclick="listeImpotsFermer\(\)"/.test(H), '« Enregistrer » : ipPaieEnregistrer ; « Annuler » : la fonction de la liste');
V((H.match(/id="lm-f"/g) || []).length === 1 && payer(H).length === 0, 'UN formulaire, à la place des gestes');
F.poser({ ym: '2026-10' }, null, '');
H = F.html(F.suivi());
V(!/id="lm-f"/.test(H) && payer(H).length === 1, 'formulaire ouvert dans la LISTE : le suivi ne l’ouvre pas en double');
F.poser({ ym: '2026-11', ou: 'suivi', genre: 'retrait' }, null, '');
H = F.html(F.suivi());
V(/id="lm-f-t">Argent des impôts retiré en liquide</.test(H) && /id="lm-f-mt"[^>]*value="180"/.test(H) && /onclick="ipRetraitEnregistrer\(\)"/.test(H),
  'le formulaire du retrait, dans le suivi : proposé = ce qui reste à payer (180), « Enregistrer » = ipRetraitEnregistrer');
F.poser(null, { cls: 'ok', t: 'Paiement d’impôts noté : <b>$180</b> payés le 16 nov.' }, 'suivi');
H = F.html(F.suivi());
V(/ip-sv-flash ip-sv-flash-ok/.test(H), 'après « Enregistrer » : le message dans le suivi');
F.poser(null, { cls: 'ok', t: 'Impôts notés' }, '');
V(!/ip-sv-flash/.test(F.html(F.suivi())), 'un message de la liste du mois reste dans la carte (pas dans le suivi)');
V(/_irSvGestes\(S\)/.test(R_SVH) && !/_ipSvAction\(/.test(R_SVH), '_impSuiviHtml pose les gestes du suivi (et plus le bouton par mois)');

// ── 4. La MÊME écriture ────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. « Enregistrer » : la fonction globale de la liste, la même écriture --');
V(/var r = await listeImpotsEnregistrer\(\);/.test(R_PAIE) && !/_ecrireImpotsPayes|impotsPayes\.push|_attenteNoter|apiFetch|saveData|logEdit/.test(R_PAIE),
  'ipPaieEnregistrer : vérifie (et demande) s’il le faut, puis appelle la fonction GLOBALE listeImpotsEnregistrer ; elle n’écrit rien elle-même');
V(!/listeImpotsEnregistrer\s*=/.test(R_PAIE) && !/\blisteImpotsEnregistrer\s*=\s*(async\s*)?function/.test(SRC.slice(SRC.indexOf('// ══ feat8_impots_reels'), SRC.indexOf('// ══ fin feat8 · IMPÔTS RÉELS'))),
  'le bloc des impôts réels ne réaffecte PAS listeImpotsEnregistrer (feat7_impots et feat7_mois l’enveloppent)');
V(/var ym=_lmForm && _lmForm\.ym;/.test(R_ENR) && /ecritureInterdite\('impôts payés'\)/.test(R_ENR) && /lireMontant\(/.test(R_ENR)
  && /_attenteNoter\('impots_payes', 'aj', p\)/.test(R_ENR) && /var envoi=_ecrireImpotsPayes\(\);/.test(R_ENR),
  'listeImpotsEnregistrer : refus en lecture seule, lireMontant, file d’attente, _ecrireImpotsPayes');
V(/var p=\{id:_nouvelIdImpot\(\), global:true, date:date, amount:Math\.round\(lu\.valeur\*100\)\/100, le:new Date\(\)\.toISOString\(\)\};/.test(R_ENR) && !/mois:ym/.test(R_ENR),
  'le paiement écrit est « tout ce qui est dû » : {id, global: true, date, amount, le}, sans mois');
V(/if\(_lmForm && _lmForm\.genre==='retrait'\) return;/.test(R_ENR), 'le formulaire du retrait ouvert : listeImpotsEnregistrer n’écrit pas de paiement');
V(/var _lie = listeImpotsEnregistrer;/.test(SRC) && /var p = _lie\.apply\(this, arguments\);/.test(ENVELOPPE), 'l’enveloppe (feat7_impots) appelle la fonction de la liste TELLE QUELLE');
V(!/_ecrireImpotsPayes|impotsPayes\.push|_attenteNoter|apiFetch|saveData|logEdit/.test(ENVELOPPE), 'l’enveloppe n’écrit rien elle-même', ENVELOPPE);

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
