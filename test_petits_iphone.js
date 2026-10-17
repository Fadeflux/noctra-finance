// AU TÉLÉPHONE, LA LISTE DU MOIS SE RESSERRE SANS RIEN CACHER (17/10, feat9_restes).
//
// ⚠️ LE DÉFAUT : un jour ordinaire où la carte de la liste est affichée (ex. 16 oct. : 2 lignes faites + impôts dus), le
// bouton du bilan du mois passait sous la barre d'onglets au premier écran (volet J de la sonde de la jauge).
// LA RÈGLE : seules les MARGES diminuent (dans la carte ; et, quand la carte est là, autour d'elle) ; rien n'est caché
// (aucun display:none, visibility, overflow, hauteur bloquée), la ligne à faire garde ses boutons de 44 px, aucun texte
// sous 12 px, le détail garde un interligne d'au moins 18 px ; ordinateur et tablette ne bougent pas (règles sous
// « max-width:640px ») ; sans carte, l'accueil ne bouge pas (règles « autour » conditionnées à la carte visible).
// Contrôle STATIQUE de la feuille de style du vrai index.html (la mesure, elle, est dans la sonde de la jauge).
//
//     node test_petits_iphone.js [autre/index.html]      (sur la version d'avant : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');
const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
const i = SRC.indexOf('/* ══ feat9_restes (17/10) : au téléphone, la liste du mois et le haut de l\'accueil se resserrent ══');
V(i >= 0, 'le bloc de style « feat9_restes » existe');
const bloc = i >= 0 ? SRC.slice(i, SRC.indexOf('\n}\n', i) + 3) : '';
const corps = bloc.replace(/\/\*[\s\S]*?\*\//g, '');
V(/@media \(max-width:640px\)\{/.test(corps) && (corps.match(/@media/g) || []).length === 1, 'tout est au téléphone seulement (≤ 640 px) : ordinateur et tablette ne bougent pas');
V(!/display\s*:\s*none|visibility|overflow|max-height|height\s*:\s*0|opacity|clip|position\s*:\s*absolute/.test(corps), 'rien n’est caché ni rogné (ni display:none, visibility, overflow, hauteur, opacité)', corps.match(/display\s*:\s*none|visibility|overflow|max-height|height\s*:\s*0|opacity|clip/));
V(!/font-size/.test(corps), 'aucune taille de texte changée (rien sous 12 px)');
V(!/\.lm-b[^{]*\{[^}]*min-height/.test(corps) && /@media \(max-width:640px\)\{[\s\S]*#liste-mois \.lm-b\{min-height:44px;font-size:15px\}/.test(SRC), 'les boutons de la ligne à faire gardent leurs 44 px au téléphone');
const lh = /#liste-mois \.lm-n\{line-height:(\d+)px\}/.exec(corps);
V(lh && +lh[1] >= 18, 'le détail de la ligne garde un interligne d’au moins 18 px (19 → ' + (lh && lh[1]) + ')');
const autour = corps.split('\n').filter((l) => /#page-ca/.test(l));
V(autour.length >= 4 && autour.every((l) => l.includes(':has(> #haut-mois > #liste-mois:not([hidden]))')), 'les marges AUTOUR de la carte ne changent que quand la carte est là', autour.filter((l) => !l.includes(':has(')).join(' | '));
V(/#liste-mois\{padding:10px 14px 0\}/.test(corps) && /#liste-mois \.lm-i\{padding:8px 0 10px\}/.test(corps), 'la carte se resserre (intérieur 12 → 10 px, lignes 10 → 8 px)');
V(!/!important/.test(corps.replace(/#insights-banner\{margin-bottom:8px!important\}/, '')), 'pas de !important, sauf la marge du bandeau (déjà en !important dans le Mélange)');
console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
