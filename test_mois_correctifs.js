// LES CORRECTIFS DU MOIS DU PROPRIÉTAIRE (feat7_mois, 16/10), prouvés sur le VRAI code de index.html : la période retenue, la carte
// du mois après « Finaliser », les mots d'un mois en perte (aucun montant nouveau), « / an » du Récap (mois terminés),
// la ligne d'un bilan jamais finalisé, la phrase des graphiques.
//
// ⚠️ Ce banc n'ouvre AUCUNE connexion : il extrait les fonctions du fichier et les fait tourner avec de fausses données en
// mémoire. (Règle de la maison : on ne teste jamais sur la base réelle.) Aucun mot de passe, aucun identifiant.
//
// Lancer : node test_mois_correctifs.js            (ou : node test_mois_correctifs.js <autre_page.html> — la page d'avant
//          les correctifs doit y ÉCHOUER : le banc n'est pas aveugle)
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
/** Découpe une fonction du fichier source par équilibrage des accolades (sa PREMIÈRE déclaration). */
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
function ligne(re, quoi) { const m = SRC.match(re); if (!m) throw new Error('introuvable : ' + quoi); return m[0]; }
function sansCommentaires(t) { return t.split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n'); }

let F;
try {
  const code = [ligne(/const fmt=v=>[^\n]*/, 'fmt'), ligne(/const fmtR=v=>[^\n]*/, 'fmtR'), ligne(/const fmtC=v=>[^\n]*/, 'fmtC'),
    'var _MOIS_FR=' + ligne(/\[\s*'janvier'[^\]]*\]/, 'mois') + ';',
    ['saMoitie', '_partModele', '_nomMois', '_deMois', 'ts', 'grafMoisLong', 'grafCap',
     '_f7CausePerte', '_f7DeLaPerte', '_f7PartPerte', '_f7DetailPart', '_f7SousPerte',
     '_f7MoisParAn', '_f7ParAn', '_f7Plage', '_f7SoitParAn', '_f7NoteParAn', '_f7NoteGraf', '_f7PerSig'].map(extraire).join('\n')].join('\n');
  // l'horloge du banc est fixée au 16 nov. 2026 (les noms de mois n'y prennent pas l'année : même année)
  class DateFixe extends Date { constructor(...a) { if (a.length) super(...a); else super('2026-11-16T12:00:00'); } static now() { return new DateFixe().getTime(); } }
  F = new Function('W', 'var Date = W.Date, ents = W.ents, virements = W.virements, ap = null, acd = null, acdEnd = null;\n' + code +
    '\nreturn { set: function(e, v){ ents = e; virements = v; }, _partModele, _f7CausePerte, _f7PartPerte, _f7DetailPart, _f7SousPerte,' +
    ' _f7MoisParAn, _f7ParAn, _f7SoitParAn, _f7NoteParAn, _f7NoteGraf, fmtC, saMoitie };')({ Date: DateFixe, ents: [], virements: [] });
} catch (e) {
  console.error('  KO  les correctifs du mois sont absents de la page : ' + e.message);
  console.log('\n1 ECHEC');
  process.exit(1);
}

// des bilans fictifs : un par mois, daté du dernier jour ; bénéfice tel quel, part de la modèle notée à part
const B = (date, profit, mo) => ({ date, profit, mo: mo || 0 });
const mc = '2026-11';

console.log('\n-- 1. D10 : un mois en perte n’est plus un « trop envoyé » (la règle, sur le vrai _partModele) --');
{
  // avril → septembre payés EXACTEMENT, octobre en perte, rien d'envoyé depuis : l'écart vient de la perte
  const e = [B('2026-04-30', 1000), B('2026-05-31', 2000), B('2026-06-30', 3000), B('2026-07-31', 4000), B('2026-08-31', 5000), B('2026-09-30', 6000), B('2026-10-31', -2644.2)];
  const paye = F.saMoitie(21000);
  F.set(e, [{ date: '2026-10-01', amount: paye }]);
  const P = F._partModele(mc);
  V(Math.abs(P.fin + 1322.1) < 0.005 && Math.abs(P.reste + 1322.1) < 0.005, 'le vrai calcul : mois terminés −$1,322.10 (la moitié de la perte)', JSON.stringify(P));
  const c = F._f7CausePerte(P, false);
  V(c && c.mois.join() === '2026-10', 'cause : la perte d’octobre', JSON.stringify(c));
  const t = F._f7PartPerte(P, 'trop');
  V(t && t.rl === 'À déduire' && t.rs === "sa part de la perte d'octobre : à retirer de ton prochain envoi", 'tuile : « À déduire » · « sa part de la perte d’octobre : à retirer de ton prochain envoi »', JSON.stringify(t));
  V(F._f7SousPerte(P, P.fin) === "sa part de la perte d'octobre : <b>$1,322.10</b> à déduire de ton prochain envoi", 'liste du mois : le montant est EXACTEMENT fmtC(−fin)', F._f7SousPerte(P, P.fin));
  // novembre en cours positif : le détail dit « moins sa part de novembre en cours », de signe juste
  F.set(e.concat([B('2026-11-01', 606.26)]), [{ date: '2026-10-01', amount: paye }]);
  const P2 = F._partModele(mc);
  const d = F._f7DetailPart(P2, 'trop', 'novembre', P2.cours, P2.fin);
  V(d === '<div class="ms-det"><span>mois terminés : sa part de la perte d\'octobre, <b>' + F.fmtC(-P2.fin) + '</b></span><span>moins sa part de novembre en cours : <b>' + F.fmtC(P2.cours) + '</b></span></div>',
    'détail : « mois terminés : sa part de la perte d’octobre, $1,322.10 » puis « moins sa part de novembre en cours : $303.13 »', d);
  const t2 = F._f7PartPerte(P2, 'trop');
  V(t2 && t2.rl === 'À déduire' && t2.rs === 'de ton prochain envoi', 'tuile avec détail : « À déduire » · « de ton prochain envoi »', JSON.stringify(t2));
}
{
  // GARDE : le propriétaire a VRAIMENT envoyé plus que sa part (aucune perte) : « Trop envoyé » reste le bon mot
  const e = [B('2026-08-31', 5000), B('2026-09-30', 6000), B('2026-10-31', 4000)];
  F.set(e, [{ date: '2026-11-01', amount: 9000 }]);
  const P = F._partModele(mc);
  V(P.fin < 0 && F._f7CausePerte(P, false) === null && F._f7PartPerte(P, 'trop') === null && F._f7SousPerte(P, P.fin) === '',
    'vrai trop envoyé ($9,000 pour une part de $7,500) : aucun mot de perte', JSON.stringify(P));
  const d = F._f7DetailPart(Object.assign({}, P, { cours: 100, fin: P.fin }), 'trop', 'novembre', 100, P.fin);
  V(/tu as envoyé <b>\$1,500<\/b> de plus que sa part/.test(d) && /moins sa part de novembre en cours/.test(d), '… et son détail garde « tu as envoyé … de plus que sa part » (signe du mois en cours corrigé)', d);
}
{
  // GARDE : mélange (envoyé trop AVANT la perte) : on ne peut pas dire « c'est la perte » → les mots d'avant
  const e = [B('2026-08-31', 5000), B('2026-09-30', 6000), B('2026-10-31', -2000)];
  F.set(e, [{ date: '2026-10-01', amount: 6000 }]);
  const P = F._partModele(mc);
  V(P.fin < 0 && F._f7CausePerte(P, false) === null, 'envoyé plus que sa part ne l’a jamais été (6 000 > 5 500), puis perte : « trop envoyé » gardé', JSON.stringify(P));
}
{
  // la perte vient du MOIS EN COURS (finis réglés) : la tuile le dit, « (en cours) »
  const e = [B('2026-09-30', 6000), B('2026-10-31', 4000), B('2026-11-05', -1000)];
  F.set(e, [{ date: '2026-11-01', amount: 5000 }]);
  const P = F._partModele(mc);
  const t = F._f7PartPerte(P, 'trop');
  V(P.reste < 0 && t && /perte de novembre \(en cours\)/.test(t.rs), 'perte du mois en cours : « sa part de la perte de novembre (en cours) »', JSON.stringify(t));
}
{
  // aucun calcul d'argent dans le code D10 : seulement fmtC des champs de _partModele
  const code = sansCommentaires(['_f7PartPerte', '_f7DetailPart', '_f7SousPerte', '_f7DeLaPerte'].map(extraire).join('\n'));
  const montants = (code.match(/fmtC\([^)]*\)/g) || []).sort();
  V(JSON.stringify([...new Set(montants)]) === JSON.stringify(['fmtC(-X)', 'fmtC(-fin)', 'fmtC(cours)']), 'les SEULS montants écrits : fmtC(-fin), fmtC(cours), fmtC(-X)', montants.join(' '));
  V(/_partModele\(\)/.test(extraire('renderModelShare')) && /_f7PartPerte\(_P,st\)/.test(extraire('renderModelShare')), 'renderModelShare passe SON _partModele() aux mots (aucun autre calcul)');
}

console.log('\n-- 2. D12 : « / an » = moyenne des mois TERMINÉS qui ont un bilan × 12 --');
{
  F.set([B('2026-06-30', 1), B('2026-07-31', 1), B('2026-08-31', 1), B('2026-09-30', 1), B('2026-10-31', 1), B('2026-11-01', 1)], []);
  const mois = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  V(JSON.stringify(F._f7MoisParAn(mois, '2026-11', '2026-10')) === JSON.stringify(['2026-06', '2026-07', '2026-08', '2026-09']), '2 nov. : juin → septembre (ni novembre en cours, ni octobre à finaliser)');
  V(JSON.stringify(F._f7MoisParAn(mois, '2026-11', null)) === JSON.stringify(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']), '16 nov. : juin → octobre');
  const par = { '2026-06': 100, '2026-07': 200, '2026-08': 300, '2026-09': 400, '2026-10': 999, '2026-11': 50 };
  V(F._f7ParAn(par, mois, '2026-11', '2026-10') === Math.round((100 + 200 + 300 + 400) / 4 * 12), 'une ligne : (100+200+300+400) ÷ 4 × 12 = 3 000', F._f7ParAn(par, mois, '2026-11', '2026-10'));
  F.set([B('2026-09-30', 1), B('2026-11-01', 1)], []);
  V(JSON.stringify(F._f7MoisParAn(mois, '2026-11', null)) === JSON.stringify(['2026-09', '2026-10'].filter((m) => m === '2026-09')), 'un mois SANS bilan (octobre) ne compte pas (avant : il comptait pour zéro)');
  F.set([B('2026-11-01', 1)], []);
  V(F._f7ParAn(par, mois, '2026-11', null) === null && F._f7SoitParAn([{ par }], mois, '2026-11', null) === '', 'aucun mois terminé : « — », pas de « soit … / an »');
  F.set([B('2026-06-30', 1), B('2026-07-31', 1), B('2026-08-31', 1), B('2026-09-30', 1), B('2026-11-01', 1)], []);
  V(F._f7SoitParAn([{ par }, { par: { '2026-09': 600 } }], mois, '2026-11', '2026-10') === ' · soit $4,800 / an au rythme de juin à septembre',
    'la phrase : « · soit $4,800 / an au rythme de juin à septembre »', F._f7SoitParAn([{ par }, { par: { '2026-09': 600 } }], mois, '2026-11', '2026-10'));
  V(F._f7NoteParAn(mois, '2026-11', '2026-10') === ' « / an » : la moyenne de juin à septembre × 12, sans le mois en cours ni le mois à finaliser.', 'la note dit ce que compte « / an »', F._f7NoteParAn(mois, '2026-11', '2026-10'));
  V(/_f7ParAn\(r\.par, moisList, dernier, _af\)/.test(extraire('renderDepensesParMois')), 'renderDepensesParMois s’en sert (ses lignes, ses mois, son « à finaliser »)');
}

console.log('\n-- 3. D2 / D11 / D13 : la règle partagée « pas encore finalisé » --');
{
  const ms = extraire('_majSaisie');
  V(/var prec=_bilanNonFinalise\(\);/.test(ms) && !/_bilanAFinaliser\(\)/.test(ms), 'la carte du mois lit _bilanNonFinalise (plus de « Finaliser » une fois finalisé)');
  V(/Finaliser le bilan /.test(ms) && /_f7Finalisation\(dF\)/.test(ms), 'le formulaire ouvert sur le mois à finaliser s’appelle « Finaliser le bilan … »');
  const an = extraire('_annoncerBilan');
  V(/_f7fin\?' finalisé':' mis à jour'/.test(an), 'la réponse dit « finalisé » après une finalisation');
  const lb = extraire('_lmLigneBilan');
  V(/'pas finalisé'/.test(lb) && /L\.neutre=true/.test(lb) && !/: 'à jour'; L\.court='Bilan '\+L\.etat;/.test(lb), 'un bilan jamais finalisé (après le 7) : « pas finalisé », signe neutre (plus « à jour » vert)');
  V(/_rappelBilan\(\)/.test(lb) && /_bilanNonFinalise\(\)/.test(lb), '… avec la règle du rappel, inchangée');
}

console.log('\n-- 4. D14 : la phrase sous les graphiques --');
{
  const k = ['2026-09', '2026-10', '2026-11'];
  const t = F._f7NoteGraf('ligne', [{}, { aFin: true, enCours: true }, { enCours: true }], (i) => k[i]);
  V(t && t.type === 'ligne' && t.texte === 'Octobre est à finaliser et novembre est en cours : leurs chiffres bougeront encore.', '« Octobre est à finaliser et novembre est en cours : leurs chiffres bougeront encore. »', JSON.stringify(t));
  const t2 = F._f7NoteGraf('barre', [{}, { aFin: true, enCours: true }], (i) => k[i]);
  V(t2 && t2.texte === 'Octobre est à finaliser : son chiffre bougera encore.', '« Octobre est à finaliser : son chiffre bougera encore. »', JSON.stringify(t2));
  const t3 = F._f7NoteGraf('ligne', [{}, {}, { enCours: true }], (i) => k[i]);
  V(t3 && t3.texte === 'Novembre est en cours : son chiffre bougera encore.', 'GARDE : le mois en cours seul garde la phrase d’avant, mot pour mot', JSON.stringify(t3));
  V(F._f7NoteGraf('ligne', [{}, {}], (i) => k[i]) === null, 'rien de provisoire : pas de phrase');
}

console.log('\n-- 5. D1 : seul un toucher du propriétaire est retenu ; aucun stockage nouveau --');
{
  const js = SRC.slice(SRC.indexOf('// ══ feat7_mois'));
  V(/_memoPeriode = function\(v\)\{ if \(!_f7ChoixEnCours\) return;/.test(js), 'la période n’est retenue que pendant un toucher sur une des quatre périodes');
  V(/closest\('#page-ca \.pbtn'\)/.test(js), '… le toucher est reconnu sur les boutons de période de l’accueil');
  V(!/localStorage|sessionStorage|indexedDB|apiFetch\(|_pushSetting\(|_listeEcrire\(|saveData\(|logEdit\(/.test(sansCommentaires(js)), 'le correctif n’écrit rien et ne stocke rien (ni base, ni appareil)');
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
