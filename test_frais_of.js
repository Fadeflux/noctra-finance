// REGLE D'ANDRE (12/10) : sur l'argent ONLYFANS seulement, 1 % d'impots + 3,5 % de
// frais Paxum -> crypto, payes par l'AGENCE avant le partage 50/50 avec la modele.
// Telegram n'a aucun frais. Appliquee DEPUIS LE DEBUT : le profit de chaque saisie est
// recalcule a la lecture (le profit stocke suivait l'ancienne formule).
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

let api = null;
try {
  api = new Function(consts + '\n' + morceaux.join('\n') + '\nreturn { fraisOF, profitEntree, entryFromDb };')();
} catch (e) { api = null; }

if (api) {
  // 1 000 $ nets OnlyFans (brut 1 250), 200 $ Telegram, 100 $ de VA
  //   impôts 10 + Paxum 35 = 45 -> profit 1 000 - 45 + 200 - 100 = 1 055
  const p = api.profitEntree({ brut: 1250, tgNet: 200, va: 100 });
  V('1 % + 3,5 % sont retires de l’argent OnlyFans (1 000 $ nets -> 45 $ de frais)', p === 1055, 'profit = ' + p + ' (attendu 1 055)');
  V('Telegram n’a aucun frais', api.profitEntree({ brut: 0, tgNet: 500 }) === 500,
    'profit Telegram seul = ' + api.profitEntree({ brut: 0, tgNet: 500 }));
  V('les frais suivent l’argent OnlyFans (4,5 % du net)', Math.abs(api.fraisOF(1000) - 45) < 1e-9, 'fraisOF(1000) = ' + api.fraisOF(1000));
  // Depuis le debut : une saisie ancienne dont le profit STOCKE suivait l'ancienne formule
  const e = api.entryFromDb({ id: 1, date: '2026-07-30', brut: 1250, va: 100, mo: 0, ci: 0, ch: 0, al_total: 0,
    profit: 1100, tg_net: 200, of_net: 1000 });
  V('une saisie ancienne est recalculee a la lecture (depuis le debut)', e.profit === 1055, 'profit lu = ' + e.profit + ' (stocke 1 100)');
}

V('les trois enregistrements utilisent la regle (plus de profit calcule a la main)',
  !/const profit=Math\.round\(br\*\.?0?\.?80\+tg-/.test(SRC) && (SRC.match(/profitEntree\(\{brut:br/g) || []).length >= 3,
  'un enregistrement calcule encore le profit sans les frais');

console.log(ko ? '\n' + ko + ' ECHEC(S)' : '\nTOUT PASSE');
process.exit(ko ? 1 : 0);
