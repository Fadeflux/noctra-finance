// IMPÔTS D'UN MOIS PASSÉ : TOUJOURS NOTABLES (O4, relecture du 16/10). Avant, le seul bouton « J'ai payé les impôts »
// était dans la liste du mois, fixé au mois de la liste : septembre oublié le 15 octobre ne pouvait plus être noté à
// partir du 29 octobre (« en retard » et « à garder » faux pour toujours). Maintenant chaque mois PASSÉ du suivi qui a
// un reste (« en retard », « à payer le 15 … ») a « Noter un paiement », qui ouvre le MÊME formulaire pour CE mois ;
// « Enregistrer » est la MÊME fonction que la liste. Prouvé sur le VRAI code de index.html.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec des bilans et des
// paiements FICTIFS, une date figée et un faux document en mémoire. (Règle de la maison : jamais la base réelle.)
//
// Ce qu'il surveille :
//  1. Le bouton : exactement sur les mois passés qui ont un reste ; jamais sur le mois en cours, un mois payé (ou payé
//     en trop) ; jamais en lecture seule, ni pour l'associé (comme la liste du mois) ; nommé avec le mois.
//  2. Le geste : ipSuiviNoter(mois) ouvre le formulaire DE CE MOIS (_lmForm = {ym, ou:'suivi'}) et rien d'autre ;
//     il refuse un mois payé, le mois en cours, un mois inconnu, la lecture seule.
//  3. Le MÊME formulaire (_lmFormHtml : titre du mois, impôt ou reste proposé, « Annuler », « Enregistrer ») dans la
//     ligne du mois ; la carte de la liste ne l'ouvre pas en double ; le message après « Enregistrer » s'écrit dans la
//     ligne du mois, pas dans la carte.
//  4. La MÊME écriture : « Enregistrer » = listeImpotsEnregistrer (lireMontant, refus en lecture seule, _attenteNoter,
//     _ecrireImpotsPayes, Historique), appelée telle quelle ; l'enveloppe n'écrit rien elle-même.
//
// Lancer : node test_impots_suivi_noter.js            (ou : node test_impots_suivi_noter.js <autre_page.html>)
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

let CODE, R_ENR, R_FORM, R_LI, R_MAJ, R_ETAT, R_HTML, ENVELOPPE;
try {
  R_ENR = extraire('listeImpotsEnregistrer'); R_FORM = extraire('_lmFormHtml'); R_LI = extraire('_lmLi');
  R_MAJ = extraire('_majListe'); R_ETAT = extraire('_lmEtat'); R_HTML = extraire('_lmHtml');
  const i = SRC.indexOf('listeImpotsEnregistrer = function(){');
  if (i < 0) throw new Error('enveloppe de « Enregistrer » introuvable');
  ENVELOPPE = SRC.slice(i, SRC.indexOf('\n    };', i));
  CODE = [ligneDe(/const _TAUX=[^;\n]*;/, '_TAUX'), ligneDe(/const _IMPOTS_OF=[^;\n]*;/, '_IMPOTS_OF'),
    ligneDe(/const fmt=v=>[^\n]*/, 'fmt'), ligneDe(/const fmtR=v=>[^\n]*/, 'fmtR'), ligneDe(/const fmtC=v=>[^\n]*/, 'fmtC'),
    ligneDe(/const _ESC=[^\n]*/, '_ESC'), ligneDe(/const esc=s=>[^\n]*/, 'esc'), ligneDe(/var _MOIS_FR=\[[^\]]*\];/, '_MOIS_FR'),
    ligneDe(/var _LM_I=\(function\(\)\{[\s\S]*?\n\}\)\(\);/, '_LM_I'),
    extraire('_ymd'), extraire('_aujLocal'), extraire('_ymLocal'), extraire('_lmSuivant'), extraire('_lmJour'), extraire('_lmNomComplet'),
    extraire('_lmDeComplet'), extraire('_nomMois'), extraire('_deMois'), extraire('_sansZero'), extraire('dl'), extraire('dlA'), extraire('_jourCourt'),
    extraire('grafCap'), extraire('_bilansMois'), extraire('_chNb'), extraire('_chCtsAff'), extraire('centimesBilan'), extraire('centimesBilans'),
    extraire('_chFrais'), extraire('_impValide'), extraire('_impPayeCts'), extraire('_cleImpot'), extraire('_impSuivi'), extraire('_impSuiviHtml'),
    extraire('_lmMontantChamp'), R_FORM, extraire('_ipSvPeutNoter'), extraire('_ipSvFlashHtml'), extraire('_ipSvAction'), extraire('ipSuiviNoter')].join('\n');
} catch (e) {
  console.error('  KO  « Noter un paiement » dans le suivi : absent de la page -> ' + e.message);
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
  const F = new Function('Date', 'ents', 'impotsPayes', 'document', 'console', 'M', 'requestAnimationFrame', 'ROLE',
    CODE + '\nfunction profitEntree(){ return 0; }\nvar _lmForm=null, _lmFlash=null, _lmEnCours=false; var _lmFlashOu, _ipSvFlashYm; var _role = ROLE;\n' +
    'function _impRedessiner(){ M.redessins++; } function _majListe(){ M.listes++; } function _fmAmener(){}\n' +
    'return { suivi: _impSuivi, html: _impSuiviHtml, noter: ipSuiviNoter, etat: function(){ return {form: _lmForm, flash: _lmFlash}; },' +
    ' poser: function(f, fl, ou, ym){ _lmForm = f; _lmFlash = fl; _lmFlashOu = ou; _ipSvFlashYm = ym; } };')(
    FauxDate, ents, impots, document, { warn() {} }, M, () => 0, o.role || 'proprio');
  F.M = M;
  return F;
}
function bilan(date, netOF) { return { date: date, brut: netOF / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, profit: netOF * 0.95 }; }
const ENTS = [bilan('2026-08-31', 9400), bilan('2026-09-30', 11200), bilan('2026-10-01', 6800)];
const AOUT = { id: 'a', mois: '2026-08', date: '2026-09-15', amount: 94 };
const boutons = (h) => [...h.matchAll(/id="ip-sv-b-(\d{4}-\d{2})"/g)].map((m) => m[1]);
const ligne = (h, nom) => { const i = h.indexOf('<span class="ip-sv-m">' + nom + '</span>'); if (i < 0) return ''; const j = h.indexOf('<div class="ip-sv-r', i); return h.slice(i, j < 0 ? h.length : j); };
const texte = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

// ── 1. Le bouton ───────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 1. « Noter un paiement » : exactement sur les mois passés qui ont un reste --');
let F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
let S = F.suivi(), H = F.html(S);
V(JSON.stringify(boutons(H)) === JSON.stringify(['2026-10', '2026-09']), '16 nov. : octobre et septembre « en retard » ont le bouton ; août (payé) non', boutons(H));
V(/aria-label="Noter un paiement des impôts de septembre 2026"/.test(H) && /aria-label="Noter un paiement des impôts d&#39;octobre 2026"/.test(H),
  'chaque bouton est nommé avec son mois (lecteurs d’écran)');
V(/onclick="ipSuiviNoter\('2026-09'\)"/.test(H) && /<span>Noter un paiement<\/span>/.test(H), 'le bouton ouvre le formulaire de SON mois');
F = charger('2026-10-16T10:00:00', ENTS, [AOUT]);
H = F.html(F.suivi());
V(JSON.stringify(boutons(H)) === JSON.stringify(['2026-09']), '16 oct. : octobre en cours n’a PAS de bouton ; septembre en retard l’a', boutons(H));
F = charger('2026-11-02T10:00:00', ENTS, [AOUT]);
H = F.html(F.suivi());
V(JSON.stringify(boutons(H)) === JSON.stringify(['2026-10', '2026-09']) && /à payer le 15/.test(texte(ligne(H, 'Octobre'))), '2 nov. : octobre « à payer le 15 nov. » a aussi le bouton', boutons(H));
F = charger('2026-11-16T10:00:00', ENTS, [AOUT, { id: 's', mois: '2026-09', date: '2026-10-15', amount: 150 }]);
H = F.html(F.suivi());
V(JSON.stringify(boutons(H)) === JSON.stringify(['2026-10']), 'septembre payé EN TROP : pas de bouton (rien à payer)', boutons(H));
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { ro: true });
V(boutons(F.html(F.suivi())).length === 0, 'lecture seule : aucun bouton');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { role: 'assoc' });
V(boutons(F.html(F.suivi())).length === 0, 'associé : aucun bouton (comme la liste du mois, cachée pour lui)');

// ── 2. Le geste ────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 2. ipSuiviNoter : le formulaire de CE mois, rien d’autre --');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
F.noter('2026-09');
V(JSON.stringify(F.etat().form) === JSON.stringify({ ym: '2026-09', ou: 'suivi' }) && F.M.redessins === 1, 'septembre : _lmForm = {ym:"2026-09", ou:"suivi"}, un redessin', JSON.stringify(F.etat()));
F.poser(null, null, '', null); F.M.redessins = 0;
F.noter('2026-08'); F.noter('2026-13'); F.noter("2026-09');alert('x"); F.noter(null);
V(F.etat().form === null && F.M.redessins === 0, 'août (payé), un mois impossible, un texte piégé, rien : refusés, rien ouvert');
F.poser({ ym: '2026-10' }, null, '', null); F.M.listes = 0;
F.noter('2026-09');
V(F.M.listes === 1 && JSON.stringify(F.etat().form) === JSON.stringify({ ym: '2026-09', ou: 'suivi' }), 'le formulaire ouvert dans la liste se referme d’abord (un seul ouvert)');
F = charger('2026-10-16T10:00:00', ENTS, [AOUT]);
F.noter('2026-10');
V(F.etat().form === null, 'mois en cours (octobre, le 16 oct.) : refusé');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT], { ro: true });
F.noter('2026-09');
V(F.etat().form === null, 'lecture seule : refusé');

// ── 3. Le MÊME formulaire, dans la ligne du mois ───────────────────────────────────────────────────────────────
console.log('\n-- 3. le même formulaire, dans la ligne du mois ; le message aussi --');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT]);
F.poser({ ym: '2026-09', ou: 'suivi' }, null, '', null);
H = F.html(F.suivi());
const sept = ligne(H, 'Septembre');
V(/id="lm-f-t">Impôts de septembre payés au bureau</.test(sept) && /id="lm-f-mt"[^>]*value="112"/.test(sept), 'la ligne Septembre porte le formulaire : « Impôts de septembre payés au bureau », 112 proposé');
V(/onclick="listeImpotsEnregistrer\(\)"/.test(sept) && /onclick="listeImpotsFermer\(\)"/.test(sept), '« Enregistrer » et « Annuler » : les fonctions de la liste du mois');
V(!/ip-sv-b-2026-09/.test(H) && /ip-sv-b-2026-10/.test(H) && (H.match(/id="lm-f"/g) || []).length === 1, 'septembre : le formulaire à la place du bouton ; octobre garde son bouton ; UN formulaire');
F.poser({ ym: '2026-09' }, null, '', null);
H = F.html(F.suivi());
V(!/id="lm-f"/.test(H) && /ip-sv-b-2026-09/.test(H), 'formulaire ouvert dans la LISTE (même mois) : le suivi ne l’ouvre pas en double');
F = charger('2026-11-16T10:00:00', ENTS, [AOUT, { id: 'p', mois: '2026-09', date: '2026-10-15', amount: 60 }]);
F.poser({ ym: '2026-09', ou: 'suivi' }, null, '', null);
H = ligne(F.html(F.suivi()), 'Septembre');
V(/value="52"/.test(H) && /Proposé : le reste de l’impôt de septembre/.test(H), 'payé en partie : le reste (52) est proposé, comme dans la liste');
F.poser(null, { cls: 'ok', t: 'Impôts de septembre notés : <b>$52</b> payés le 15 oct.' }, 'suivi', '2026-09');
H = F.html(F.suivi());
V(/ip-sv-flash ip-sv-flash-ok/.test(ligne(H, 'Septembre')) && !/ip-sv-flash/.test(ligne(H, 'Octobre')), 'après « Enregistrer » : le message dans la ligne Septembre seulement');
F.poser(null, { cls: 'ok', t: 'Impôts d’octobre notés' }, '', null);
V(!/ip-sv-flash/.test(F.html(F.suivi())), 'un message de la liste du mois reste dans la carte (pas dans le suivi)');
V(/_lmForm\.ou!=='suivi'/.test(R_LI), 'la carte de la liste n’ouvre pas le formulaire quand il est ouvert dans le suivi');
V(/if\(!E\)\{ if\(!\(_lmForm && _lmForm\.ou==='suivi'\)\) _lmForm=null;/.test(R_MAJ), 'la carte cachée ne referme pas le formulaire ouvert dans le suivi');
V(/!\(_lmFlash && _lmFlashOu!=='suivi'\)/.test(R_ETAT) && /var flash=\(_lmFlash && _lmFlashOu!=='suivi'\)/.test(R_HTML), 'un message du suivi ne rouvre pas la carte et ne s’y écrit pas');

// ── 4. La MÊME écriture ────────────────────────────────────────────────────────────────────────────────────────
console.log('\n-- 4. « Enregistrer » : la même fonction, la même écriture --');
V(/var ym=_lmForm && _lmForm\.ym;/.test(R_ENR) && /ecritureInterdite\('impôts payés'\)/.test(R_ENR) && /lireMontant\(/.test(R_ENR)
  && /_attenteNoter\('impots_payes', 'aj', p\)/.test(R_ENR) && /var envoi=_ecrireImpotsPayes\(\);/.test(R_ENR),
  'listeImpotsEnregistrer : le mois du formulaire ouvert, refus en lecture seule, lireMontant, file d’attente, _ecrireImpotsPayes');
V(/var _lie = listeImpotsEnregistrer;/.test(SRC) && /var p = _lie\.apply\(this, arguments\);/.test(ENVELOPPE), 'l’enveloppe appelle la fonction de la liste TELLE QUELLE');
V(!/_ecrireImpotsPayes|impotsPayes\.push|_attenteNoter|apiFetch|saveData|logEdit/.test(ENVELOPPE), 'l’enveloppe n’écrit rien elle-même (elle dit seulement où écrire le message)', ENVELOPPE);

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
