// REGLE DU PROPRIÉTAIRE (12/10, circuit precise le 14/10) : sur l'argent ONLYFANS seulement.
//   OnlyFans verse le net sur Paxum (0,25 $ fixe par virement : ignore) ; 1 % de ce qui arrive sur
//   Paxum est declare aux impots ; TOUT passe ensuite en crypto (Paxum prend 3,5 %) ; partage 50/50
//   en crypto ; les impots se paient EN LIQUIDE et retirer la crypto en liquide coute 2 % : pour
//   100 $ d'impots il faut garder 100 / 0,98 = 102,04 $ en crypto.
//   Frais = net x 3,5 % + net x 1 % / 0,98, retires AVANT le partage (moitie chacun).
// Telegram n'a aucun frais. Appliquee DEPUIS LE DEBUT : le profit de chaque saisie est
// recalcule a la lecture (le profit stocke suivait l'ancienne formule).
//
// EXEMPLE DE REFERENCE (14/10) : net OnlyFans 10 000 $, aucune depense, pas de Telegram
//   -> Paxum 350 $ + impots gardes en crypto 102,04 $ = 452,04 $ de frais ; benefice 9 547,96 $
//      (15/10 : la page l'enregistre AU CENTIME, 9 547,96 $ — avant : au dollar, 9 548 $) ;
//      sa part 4 773,98 $ ; cout reel des impots 105,74 $, partage moitie-moitie : 52,87 $ chacun.
//
// ⚠️ Aucune connexion : les fonctions sont extraites du VRAI index.html et tournent en
// memoire. (Regle de la maison : on ne teste jamais sur la base reelle.)
//
// Lancer : node test_frais_of.js
// Sur l'ancienne version (doit ECHOUER) : node test_frais_of.js vieux.html
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');

let ko = 0;
function V(nom, cond, detail) {
  if (cond) console.log('  OK  ' + nom);
  else { ko++; console.log('  KO  ' + nom + ' -> ' + detail); }
}
const proche = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol || 1e-9);
const cts = (v) => Math.round(v * 100);   // au centime, comme l'affichage

function extraire(nom) {
  const tete = 'function ' + nom + '(';
  const i = SRC.indexOf(tete);
  if (i < 0) return null;
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  return null;
}

const consts = (SRC.match(/const _TAUX=[^;]+;/) || [''])[0] + '\n' + (SRC.match(/const _IMPOTS_OF=[^;]+;/) || [''])[0];
const morceaux = ['fraisOF', 'profitEntree', 'entryFromDb'].map(extraire);
V('les fonctions de la regle existent (garde-fou du banc)', morceaux.every(Boolean) && /_IMPOTS_OF/.test(consts),
  'absentes : ' + ['fraisOF', 'profitEntree', 'entryFromDb'].filter((n, i) => !morceaux[i]).join(', '));

// Les trois taux sont des CONSTANTES NOMMEES, avec les valeurs du propriétaire (une valeur recopiee a la main derive).
const taux = {};
for (const [nom, attendu] of [['_IMPOTS_OF', 0.01], ['_PAXUM_OF', 0.035], ['_RETRAIT_LIQUIDE', 0.02]]) {
  const m = consts.match(new RegExp('\\b' + nom + '=([0-9.]+)'));
  taux[nom] = m ? Number(m[1]) : null;
  V('constante ' + nom + ' = ' + attendu, taux[nom] === attendu, 'lu : ' + (m ? m[1] : 'absente'));
}
const fr = morceaux[0] || '';
V('fraisOF se sert des trois constantes (aucun taux ecrit en dur)',
  /_PAXUM_OF/.test(fr) && /_IMPOTS_OF/.test(fr) && /_RETRAIT_LIQUIDE/.test(fr) && !/0\.0(45|35|1|2)\b/.test(fr),
  fr.replace(/\s+/g, ' ').slice(0, 160));
V('plus l’ancienne formule « 1 % + 3,5 % » (4,5 % du net) dans fraisOF',
  !/_IMPOTS_OF\s*\+\s*_PAXUM_OF/.test(fr) && !/0\.045/.test(fr), fr.replace(/\s+/g, ' ').slice(0, 160));

let api = null;
try {
  api = new Function(consts + '\n' + morceaux.join('\n') + '\nreturn { fraisOF, profitEntree, entryFromDb };')();
} catch (e) { api = null; }

if (api) {
  // ── L'EXEMPLE DU PROPRIÉTAIRE : 10 000 $ nets OnlyFans (brut 12 500), rien d'autre ──
  const f10k = api.fraisOF(10000);
  V('exemple : 10 000 $ nets -> 452,04 $ de frais (350 $ Paxum + 102,04 $ d’impots gardes en crypto)',
    proche(f10k, 350 + 100 / 0.98) && cts(f10k) === 45204, 'fraisOF(10000) = ' + f10k + ' (attendu 452,0408…)');
  V('exemple : la part Paxum est 3,5 % = 350 $', proche(10000 * taux._PAXUM_OF, 350), 'Paxum = ' + 10000 * taux._PAXUM_OF);
  const garde = 10000 * taux._IMPOTS_OF / (1 - taux._RETRAIT_LIQUIDE);
  V('exemple : impots a garder en crypto = 100 / 0,98 = 102,04 $', cts(garde) === 10204 && proche(f10k - 350, garde),
    'garde = ' + garde);
  const cout = garde / (1 - taux._PAXUM_OF);
  V('exemple : cout reel des impots = 105,74 $ (100 $ + 2,04 $ de retrait + 3,70 $ de Paxum)',
    cts(cout) === 10574 && cts(garde) - 10000 === 204 && cts(cout) - cts(garde) === 370,
    'cout = ' + cout + ' ; retrait ' + (cts(garde) - 10000) + ' cts ; Paxum ' + (cts(cout) - cts(garde)) + ' cts');
  const pEx = api.profitEntree({ brut: 12500 });
  V('exemple : benefice 9 547,96 $, enregistre AU CENTIME (15/10 ; avant : 9 548 $)', pEx === 9547.96,
    'profit = ' + pEx + ' (attendu 9 547,96 ; au dollar : 9 548 ; ancienne regle des frais : 9 550)');
  V('exemple : sa part (moitie) = 4 773,98 $', pEx * 0.5 === 4773.98, 'moitie = ' + pEx * 0.5);
  V('exemple : cout reel des impots partage moitie-moitie = 52,87 $ chacun (51,02 $ gardes en crypto + 1,85 $ de Paxum)',
    Math.round(cts(cout) / 2) === 5287 && Math.round(cts(garde) / 2) === 5102 && Math.round(cts(cout) / 2) - Math.round(cts(garde) / 2) === 185,
    'chacun ' + Math.round(cts(cout) / 2) + ' cts');

  // ── Le benefice d'un bilan : AU CENTIME, jamais plus (15/10) ──
  const deux = (x) => typeof x === 'number' && Math.abs(Math.round(x * 100) - x * 100) < 1e-6;
  V('le benefice garde ses centimes : 17,50 $ de depenses restent 17,50 $ (1 000 $ Telegram -> 982,50 $, pas 983 $)',
    api.profitEntree({ brut: 0, tgNet: 1000, alT: 17.5 }) === 982.5, 'profit = ' + api.profitEntree({ brut: 0, tgNet: 1000, alT: 17.5 }));
  V('une perte garde ses centimes (99,99 $ de VA seuls -> −99,99 $)', api.profitEntree({ va: 99.99 }) === -99.99,
    'profit = ' + api.profitEntree({ va: 99.99 }));
  V('jamais plus de 2 decimales (le reste est arrondi au centime : 9 547,959… -> 9 547,96)',
    [12500, 8500, 1250, 777.77, 123456.78, 3.33].every((b) => deux(api.profitEntree({ brut: b, va: 0.01 }))),
    [12500, 8500, 1250, 777.77, 123456.78, 3.33].map((b) => api.profitEntree({ brut: b, va: 0.01 })).join(' ; '));

  // ── D'autres valeurs explicites ──
  // 1 000 $ nets OnlyFans (brut 1 250), 200 $ Telegram, 100 $ de VA :
  //   Paxum 35 + impots 10 / 0,98 = 10,204… -> frais 45,204… -> profit 1 000 - 45,204… + 200 - 100 = 1 054,795… -> 1 054,80
  V('1 000 $ nets -> 45,20 $ de frais (35 + 10,20)', proche(api.fraisOF(1000), 35 + 10 / 0.98) && cts(api.fraisOF(1000)) === 4520,
    'fraisOF(1000) = ' + api.fraisOF(1000));
  const p = api.profitEntree({ brut: 1250, tgNet: 200, va: 100 });
  V('profit d’un bilan mixte : 1 000 $ OF + 200 $ Telegram - 100 $ VA -> 1 054,80 $ (au dollar : 1 055 $)', p === 1054.8,
    'profit = ' + p + ' (attendu 1 054,80)');
  // Le bilan de demonstration d'octobre :
  //   6 800 $ nets : 238 + 69,39 = 307,39 $ de frais -> profit 7 310 - 790 - 699 - 1 129,70 - 307,387… = 4 383,912… -> 4 383,91
  const pOct = api.profitEntree({ brut: 8500, tgNet: 510, va: 790, ci: 699, alT: 1129.7 });
  V('bilan de demonstration d’octobre : 6 800 $ nets -> 307,39 $ de frais, profit 4 383,91 $ (au dollar : 4 384 $)',
    cts(api.fraisOF(6800)) === 30739 && pOct === 4383.91, 'fraisOF(6800) = ' + api.fraisOF(6800) + ' ; profit = ' + pOct);
  V('Telegram n’a aucun frais (500,25 $ Telegram -> 500,25 $)', api.profitEntree({ brut: 0, tgNet: 500.25 }) === 500.25 && api.fraisOF(0) === 0,
    'profit Telegram seul = ' + api.profitEntree({ brut: 0, tgNet: 500.25 }));
  V('les frais suivent l’argent OnlyFans (proportionnels : 2 x le net -> 2 x les frais)',
    proche(api.fraisOF(20000), 2 * api.fraisOF(10000), 1e-9), 'fraisOF(20000) = ' + api.fraisOF(20000));
  V('un montant illisible ne casse rien (fraisOF(undefined) = 0)', api.fraisOF(undefined) === 0 && api.fraisOF('abc') === 0,
    'fraisOF(undefined) = ' + api.fraisOF(undefined));
  // Depuis le debut : une saisie ancienne dont le profit STOCKE suivait l'ANCIENNE formule (4,5 %)
  const e = api.entryFromDb({ id: 1, date: '2026-07-30', brut: 12500, va: 0, mo: 0, ci: 0, ch: 0, al_total: 0,
    profit: 9550, tg_net: 0, of_net: 10000 });
  V('une saisie ancienne est recalculee a la lecture (depuis le debut) : stocke 9 550 -> lu 9 547,96', e.profit === 9547.96,
    'profit lu = ' + e.profit + ' (stocke 9 550)');
  // Un bilan enregistre au dollar (avant le 15/10) prend ses centimes A LA LECTURE, sans rien reecrire en base
  const e2 = api.entryFromDb({ id: 2, date: '2026-10-01', brut: 8500, va: 790, mo: 0, ci: 699, ch: 0, al_total: 1129.7,
    profit: 4384, tg_net: 510, of_net: 6800 });
  V('un bilan enregistre au dollar (4 384 $) est relu au centime : 4 383,91 $', e2.profit === 4383.91, 'profit lu = ' + e2.profit);
}

V('les trois enregistrements utilisent la regle (plus de profit calcule a la main)',
  !/const profit=Math\.round\(br\*\.?0?\.?80\+tg-/.test(SRC) && (SRC.match(/profitEntree\(\{brut:br/g) || []).length >= 3,
  'un enregistrement calcule encore le profit sans les frais');

console.log(ko ? '\n' + ko + ' ECHEC(S)' : '\nTOUT PASSE');
process.exit(ko ? 1 : 0);
