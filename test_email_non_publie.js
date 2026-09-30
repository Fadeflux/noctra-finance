// L'adresse de connexion n'est pas ecrite sur une page PUBLIQUE.
//
// ⚠️ LE DÉFAUT (12/09)
// Ce dépôt est ouvert. L'adresse du projet Supabase et sa clé « anon » y sont —
// et c'est normal, cette clé est faite pour être publique. L'EMAIL, lui, ne
// l'est pas : publié à côté, il donne la moitié de la clef et désigne exactement
// quel compte essayer. Le mot de passe devient alors la seule chose entre
// n'importe qui et tous les chiffres.
//
// ⚠️ 30/09 — LE DESSIN A CHANGÉ, LA PROPRIÉTÉ NON.
// On ne tape plus une adresse mais un IDENTIFIANT (« andre », « manon ») ;
// l'adresse est DÉRIVÉE à l'exécution. Ce banc était rouge parce qu'il décrivait
// l'ancien écran, pas parce que le produit avait cassé. Il a donc été réécrit
// pour tester la même chose sur le nouvel écran — et non supprimé : ce qu'il
// garde (aucune adresse, aucun mot de passe publiés) vaut toujours.
//
//     node test_email_non_publie.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const FORME_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

console.log('\n-- rien qui ressemble a une adresse n est publie --');
// On cherche la FORME, pas une adresse en particulier : celle d'aujourd'hui
// n'est pas celle qu'on écrirait par accident demain.
const adresses = (SRC.match(new RegExp(FORME_MAIL.source, 'g')) || [])
  .filter((a) => !a.endsWith('.png') && !a.endsWith('.svg'));
V('aucune adresse e-mail dans le fichier servi', adresses.length === 0, adresses.join(', '));
V('SUPA_EMAIL a disparu du code', !/const SUPA_EMAIL\s*=/.test(SRC));

console.log('\n-- aucun mot de passe non plus (le depot est PUBLIC) --');
// Un identifiant publié ne coûte presque rien ; un mot de passe publié coûte tout.
const MOTS_INTERDITS = [/andre2026/i, /manon2026/i, /test12/, /password\s*[:=]\s*['"][^'"]{4,}['"]/];
const trouves = MOTS_INTERDITS.filter((r) => r.test(SRC)).map(String);
V('aucun mot de passe en clair dans la page', trouves.length === 0, trouves.join(', '));

console.log('\n-- on se connecte avec un IDENTIFIANT, l adresse est derivee --');
V('un champ identifiant existe', /id="login-ident"/.test(SRC));
V('... et il est visible (c est lui qu on remplit)',
  !/id="login-ident"[^>]*display:\s*none/.test(SRC),
  'un champ cache redonnerait un ecran qu on ne comprend pas');
V('l adresse est CONSTRUITE a partir de l identifiant',
  /function identVersMail\(/.test(SRC) && /'@'\s*\+\s*DOMAINE_IDENT/.test(SRC));
V('la connexion envoie cette adresse derivee',
  /signInWithPassword\(\{\s*email:\s*mail/.test(SRC),
  'si elle envoyait autre chose, la derivation ne servirait a rien');
V('l identifiant est retenu apres une connexion REUSSIE',
  /retenirIdent\(ident\)/.test(SRC),
  'sans ca, il serait redemande a chaque ouverture');
V('... et re-propose a l ouverture', /function prefillIdent\(/.test(SRC));

console.log('\n-- le domaine derive ne doit appartenir a PERSONNE --');
// Avec un vrai domaine, une demande de reinitialisation de mot de passe
// partirait vers une boite que quelqu un d autre pourrait posseder : il
// prendrait le compte sans jamais connaitre le mot de passe.
// `.invalid` est reserve par la RFC 2606 et ne peut pas etre enregistre.
const mDom = SRC.match(/DOMAINE_IDENT\s*=\s*'([^']+)'/);
V('le domaine de derivation est declare', !!mDom);
V('... et se termine par un suffixe reserve',
  !!mDom && /\.(invalid|test|example|localhost)$/.test(mDom[1]),
  mDom ? 'domaine trouve : ' + mDom[1] + ' -- un domaine reel ouvre un vol de compte par mot de passe oublie' : '');

console.log('\n-- on DIT quoi mettre, au lieu de laisser deviner --');
V('une aide sous le champ explique quoi taper',
  /id="login-aide"/.test(SRC) && /pr&#233;nom|prénom/.test(SRC),
  'un champ sans explication passe pour une panne');
V('le refus ne dit PAS lequel des deux est faux',
  /Identifiant ou mot de passe incorrect/.test(SRC),
  'distinguer les deux apprendrait a un inconnu quels comptes existent');

console.log('\n-- la cle « anon », elle, reste (et c est normal) --');
// Elle est faite pour être publique : la retirer donnerait l'illusion d'avoir
// corrigé quelque chose. Ce qui protège, c'est le mot de passe et les règles
// de ligne côté Supabase.
V('la cle anon est toujours la', /SUPABASE_ANON/.test(SRC),
  'la retirer serait du theatre, pas une correction');

console.log('\n-- les controles savent echouer --');
// Un banc qui ne peut pas devenir rouge ne mesure rien. On rejoue chaque forme
// surveillee sur un texte qui DOIT la declencher.
{
  V('la forme d avant serait attrapee',
    FORME_MAIL.test("const SUPA_EMAIL = 'quelquun@exemple.com';"),
    'si ce n est plus vrai, ce test ne mesure plus ce qu il surveille');
  V('un mot de passe en clair serait attrape',
    MOTS_INTERDITS.some((r) => r.test("const mdp = 'andre2026#';")));
  V('un domaine reel serait attrape',
    !/\.(invalid|test|example|localhost)$/.test('noctra.app'));
  V('un champ identifiant cache serait attrape',
    /id="login-ident"[^>]*display:\s*none/.test('<input id="login-ident" style="display:none">'));
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
