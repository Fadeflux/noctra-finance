// LA LISTE DU MOIS QUAND LE MOIS FINI N'A AUCUN BILAN, MAIS QUE DES IMPÔTS RESTENT DUS (17/10, feat9_restes).
//
// ⚠️ LE DÉFAUT : « mois fini sans aucun bilan : rien à clore » — la carte n'apparaissait pas du tout, même si des impôts des
// mois d'avant restaient à payer au bureau (signalé par feat8_impots_reels, « décision pour le propriétaire »).
// LA RÈGLE CHOISIE : la carte est RÉDUITE à ce qui se fait : la seule ligne des impôts (la même fonction que d'habitude,
// _lmLigneImpots : aucun chiffre nouveau), et seulement s'il en reste à payer ; jamais de ligne « bilan » (aucun bilan n'est
// inventé) ni « part de la modèle » ; tout payé : le résumé du mois seulement si le paiement a été noté depuis la fin du mois
// (le geste vient d'être fait) ; sinon rien, comme avant. Un mois AVEC bilan : rien ne change.
// Prouvé sur le VRAI code de index.html (fonctions extraites), le reste remplacé par des fonctions locales. Aucune connexion.
//
//     node test_liste_sans_bilan.js [autre/index.html]      (sur la version d'avant : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
function extraire(nom) {
  let i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  let p = SRC.indexOf('(', i), d = 0, k = p;
  for (; k < SRC.length; k++) { if (SRC[k] === '(') d++; else if (SRC[k] === ')' && --d === 0) break; }
  let prof = 0;
  for (let q = SRC.indexOf('{', k); q < SRC.length; q++) {
    if (SRC[q] === '{') prof++;
    else if (SRC[q] === '}' && --prof === 0) return SRC.slice(i, q + 1);
  }
  throw new Error('fin introuvable : ' + nom);
}
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
const NOMS = ['_lmEtat', '_lmSuivant', '_lmJour', '_ymd', '_impValide', '_impGlobal'];
let CODE = null;
try { CODE = NOMS.map(extraire).join('\n'); } catch (e) { V(false, 'les fonctions de la liste sont extraites', e.message); }
let SANS = '';
try { SANS = extraire('_lmImpotsSansBilan'); } catch (e) { V(false, 'la règle « mois fini sans bilan » existe (_lmImpotsSansBilan)', e.message); }

function jouer(o) {
  const W = { appels: [] };
  const f = new Function('document', 'ents', '_panneauOuvert', '_lmFenetre', '_bilansMois', '_lmLigneBilan', '_lmLigneModele', '_lmLigneImpots', 'impotsPayes',
    CODE + '\n' + SANS + '\nreturn _lmEtat();');
  return f({ body: { classList: { contains: (c) => !!(o.ro && c === 'readonly') } } }, [{ date: '2026-09-30' }], () => false,
    () => ({ ym: '2026-10', fin: !!o.fin, reste: o.fin ? 1 : null }), (ym) => (o.bilans && ym === '2026-10') ? [{ date: '2026-10-31' }] : [],
    () => { W.appels.push('bilan'); return o.fin ? { cle: 'bilan', fait: false } : { cle: 'bilan', fait: true }; },
    () => { W.appels.push('modele'); return { cle: 'modele', fait: false }; },
    () => { W.appels.push('impots'); return Object.assign({ cle: 'impots', ym: '2026-10' }, o.impots); }, o.payes || []);
}
const DU = { fait: false, titre: 'Impôts dus', montant: 285 };
const PAYE = { fait: true, titre: 'Impôts payés jusqu’à octobre', court: 'Impôts payés', montant: 285 };
const AUCUN = { fait: true, titre: 'Pas d’impôts d’octobre', court: 'Pas d’impôts' };
if (CODE) {
  console.log('\n-- un mois AVEC bilan : rien ne change --');
  let E = jouer({ bilans: true, impots: DU });
  V(E && E.lignes.length === 3 && E.lignes.map((l) => l.cle).join() === 'bilan,modele,impots' && !E.sansBilan, 'les 3 lignes, comme avant', E && JSON.stringify(E.lignes));
  console.log('\n-- un mois fini SANS bilan --');
  E = jouer({ impots: DU });
  V(E && E.lignes.length === 1 && E.lignes[0].cle === 'impots' && E.sansBilan === true, 'impôts dus : la carte avec la SEULE ligne des impôts', E && JSON.stringify(E));
  V(E && E.faites === 0 && E.tout === false, '… 0 faite sur 1');
  E = jouer({ impots: PAYE, payes: [{ global: true, date: '2026-11-03', amount: 285 }] });
  V(E && E.lignes.length === 1 && E.tout === true, 'tout payé le 3 nov. (depuis la fin du mois) : le résumé du mois', E && JSON.stringify(E));
  E = jouer({ impots: PAYE, payes: [{ mois: '2026-09', date: '2026-11-02', amount: 285 }] });
  V(E && E.tout === true, '… aussi pour un paiement noté pour un mois');
  E = jouer({ impots: PAYE, payes: [{ global: true, date: '2026-10-20', amount: 285 }] });
  V(E === null, 'tout payé le 20 oct. (avant la fin du mois) : rien à faire, rien à montrer', JSON.stringify(E));
  E = jouer({ impots: PAYE, payes: [{ global: true, date: '2026-11-03', amount: 285, supprime: true }] });
  V(E === null, 'un paiement supprimé ne compte pas', JSON.stringify(E));
  E = jouer({ impots: AUCUN });
  V(E === null, 'aucun impôt (« Pas d’impôts ») : rien, comme avant', JSON.stringify(E));
  console.log('\n-- jamais --');
  V(jouer({ impots: DU, ro: true }) === null, 'lecture seule : jamais');
  E = jouer({ impots: DU });
  V(!!E && !JSON.stringify(E.lignes).includes('bilan') && !JSON.stringify(E.lignes).includes('modele'), 'la carte est là, sans aucune ligne « bilan » ni « part de la modèle » inventée pour un mois vide', JSON.stringify(E));
  console.log('\n-- fin du mois (le mois en cours) : rien ne change --');
  E = jouer({ fin: true, impots: DU });
  V(E && E.lignes.length === 3 && !E.sansBilan, 'fin du mois sans bilan : les 3 lignes (dont « bilan à saisir »), comme avant', E && JSON.stringify(E.lignes));
}
console.log('\n-- le sous-titre dit pourquoi --');
let H = ''; try { H = extraire('_lmHtml'); } catch (e) {}
V(/E\.sansBilan \? 'aucun bilan en '\+_nomMois\(F\.ym\)\+' : il reste les impôts' : 'pour clore '\+_nomMois\(F\.ym\)/.test(H), '« aucun bilan en octobre : il reste les impôts » (au lieu de « pour clore octobre »)');
console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
