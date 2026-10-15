// SÉCURITÉ DU COMPTE (15/10) : mot de passe, déconnexion, scripts externes, identifiant, formulaire.
//
// ⚠️ LE CONTEXTE
// Des chaînes en forme de mots de passe ont été publiées par erreur dans ce dépôt PUBLIC (retirées le 15/10 ;
// l'historique git les garde). Les adresses de connexion finissent en .invalid : aucun e-mail n'y arrive, donc
// pas de « mot de passe oublié ». Chacun change le sien depuis le site : ce banc garde ce chemin honnête.
// Il ne contient AUCUN mot de passe ni identifiant réel : les identifiants sont comparés par EMPREINTE (sha256),
// les essais utilisent des prénoms et des valeurs INVENTÉS.
//
//     node test_securite_compte.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}
const prendre = (re, s = SRC) => { const m = re.exec(s); if (!m) throw new Error('introuvable dans la page : ' + re); return m[0]; };
const essayer = (titre, fn) => { try { fn(); } catch (e) { V(titre, false, String(e.message || e).slice(0, 160)); } };

console.log('\n-- S-4 : chaque script externe est FIGÉ et vérifié (empreinte SRI) --');
// Une version flottante (« @2 ») fait entrer chaque nouvelle version publiée, sans relecture, dans la page qui
// tient la session et écrit la comptabilité. L'empreinte fait refuser au navigateur tout fichier modifié.
const scripts = SRC.match(/<script\b[^>]*\bsrc="https?:[^"]+"[^>]*>/g) || [];
V('il y a des scripts externes à contrôler', scripts.length >= 2, String(scripts.length));
for (const s of scripts) {
  const src = /src="([^"]+)"/.exec(s)[1];
  V('empreinte + crossorigin : ' + src.split('/').slice(-3).join('/'),
    /\bintegrity="sha(384|512)-[A-Za-z0-9+/=]{40,}"/.test(s) && /\bcrossorigin="anonymous"/.test(s), s.slice(0, 160));
}
const sbjs = scripts.find((s) => /supabase-js/.test(s)) || '';
V('supabase-js en version EXACTE (x.y.z), fichier statique',
  /supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js"/.test(sbjs),
  'une version flottante ou un fichier généré par le CDN casse l’empreinte ou la contourne : ' + sbjs.slice(0, 120));
V('... et jamais « .min.js » généré (jsdelivr : « Do NOT use SRI with dynamically generated files »)', !/supabase\.min\.js/.test(sbjs));

console.log('\n-- S-7 : « Élodie », « ÉLODIE » = le compte sans accent --');
essayer('identVersMail se laisse extraire', () => {
  const code = prendre(/const DOMAINE_IDENT = '[^']*';/) + '\n' + prendre(/function identVersMail\(v\)\{[\s\S]*?\n\}/);
  const f = new Function(code + '\nreturn { identVersMail, DOMAINE_IDENT };')();
  const att = 'elodie@' + f.DOMAINE_IDENT;
  for (const e of ['elodie', 'Élodie', ' ÉLODIE ', 'élodie']) V('« ' + e + ' » -> le même compte', f.identVersMail(e) === att, f.identVersMail(e));
  const complete = 'Prenom.Exemple' + '@' + 'domaine.example';
  V('une adresse complète reste telle quelle (en minuscules)', f.identVersMail(complete) === complete.toLowerCase(), f.identVersMail(complete));
});

console.log('\n-- S-6 : montant, date, payeur d’une ligne relus par le formulaire : jamais du code --');
essayer('addAF / addLP se laissent extraire', () => {
  const code = [prendre(/const _ESC=\{[^\n]*\};/), prendre(/const esc=s=>[^\n]*;/), prendre(/function addAF\(n='',v='',pb='moi'\)\{[^\n]*\}/),
    prendre(/const _LP = \{[\s\S]*?\};/), prendre(/const _LP_PH = \{[^\n]*\};/), prendre(/function addLP\(k, n='', v='', pb='moi', dt=''\)\{[\s\S]*?\n\}/)].join('\n');
  const faits = [];
  const document = { createElement: () => { const d = { className: '', id: '', innerHTML: '' }; faits.push(d); return d; },
    getElementById: () => ({ appendChild() {}, value: '2026-10-01' }) };
  const f = new Function('document', 'ts', 'let afc=0, afs=[];\n' + code + '\nreturn { addAF, addLP };')(document, () => '2026-10-01');
  const PIEGE = '1"><img src=x onerror=alert(1)><i x="';
  f.addAF('nom', PIEGE, PIEGE);
  f.addLP('va', 'nom', PIEGE, PIEGE, PIEGE);
  const html = faits.map((d) => d.innerHTML).join('\n');
  V('aucune balise piégée ne sort du champ (montant, date, payeur)', !/<img/i.test(html), html.slice(0, 160));
  V('... elle est écrite comme du texte (échappée)', (html.match(/&quot;&gt;&lt;img/g) || []).length >= 5);
  const sain = []; const doc2 = { createElement: () => { const d = { innerHTML: '' }; sain.push(d); return d; }, getElementById: () => ({ appendChild() {}, value: '' }) };
  const g = new Function('document', 'ts', 'let afc=0, afs=[];\n' + code + '\nreturn { addAF, addLP };')(doc2, () => '2026-10-01');
  g.addLP('va', 'Virement', 1234.56, 'associe', '2026-10-05');
  V('un vrai montant / une vraie date passent à l’identique', /value="2026-10-05"/.test(sain[0].innerHTML) && /value="1234.56"/.test(sain[0].innerHTML) && /data-pb="associe"/.test(sain[0].innerHTML));
});

console.log('\n-- « Changer mon mot de passe » : vérifie l’actuel, ne garde rien --');
let BLOC = '';
essayer('le bloc du mot de passe existe', () => { BLOC = prendre(/var _MDP = \{[\s\S]*?\/\/ Les deux entrées :/); });
if (BLOC) {
  V('l’actuel est vérifié en se reconnectant avec l’adresse de la SESSION',
    /getSession\(\)[\s\S]*signInWithPassword\(\{ email: mail, password: a \}\)[\s\S]*updateUser\(\{ password: n \}\)/.test(BLOC));
  V('jamais en lecture seule (la fonction refuse)', /async function ouvrirChangementMdp\(\)\{\n  if \(document\.body\.classList\.contains\('readonly'\)\)/.test(BLOC));
  V('... et ses entrées sont cachées', /body\.readonly #mdp-btn,body\.readonly \.topbar \.export-menu \.mob-mdp\{display:none!important\}/.test(SRC));
  for (const [nom, re] of [['console', /console\./], ['stockage du navigateur', /(local|session)Storage/], ['Historique', /logEdit\(|editLog/],
    ['adresse', /location\.|history\.|pushState|replaceState/], ['export', /exportData|Blob\(/], ['envoi réseau', /fetch\(|apiFetch|XMLHttpRequest/]]) {
    V('aucun mot de passe vers : ' + nom, !re.test(BLOC), (BLOC.match(re) || [''])[0]);
  }
  V('champs type=password, autocomplete current-password / new-password',
    /type="password" autocomplete="' \+ auto/.test(BLOC) && /'current-password'/.test(BLOC) && (BLOC.match(/'new-password'/g) || []).length === 2);
  V('aucun attribut name sur les champs (un envoi raté ne mettrait rien dans l’adresse)', !/<input[^>]*\bname=/.test(BLOC));
  V('les champs sont vidés et remis en « masqué » à la fermeture et après réussite',
    /function _mdpVider\(\)\{[\s\S]*?i\.value = ''; i\.type = 'password';/.test(BLOC) && /_mdpVider\(\);\s+\/\/ les valeurs quittent la page/.test(BLOC));
  essayer('les règles se laissent extraire', () => {
    const code = prendre(/var _MDP_MIN = 10, _MDP_MAX = 72;/, BLOC) + '\n' + prendre(/function _mdpSansAccents\(s\)\{[^\n]*\}/, BLOC) + '\n'
      + prendre(/function _mdpRegles\(actuel, nouveau, confirmation, ident\)\{[\s\S]*?\n\}/, BLOC);
    const R = new Function(code + '\nreturn _mdpRegles;')();
    const A = 'exemple-invente-42', N = 'Nuit-violette-2031';
    const r = R(A, N, N, 'camille');
    V('bon nouveau : toutes les règles vertes', r.long && r.diff && r.prenom && r.pareil, JSON.stringify(r));
    V('9 caractères : refusé', !R(A, 'court-123', 'court-123', 'camille').long);
    V('identique à l’actuel : refusé', !R(A, A, A, 'camille').diff);
    V('contient le prénom (même avec accent / majuscules) : refusé', !R(A, 'CAMÏLLE-violet-2031', 'CAMÏLLE-violet-2031', 'camille').prenom);
    V('confirmation différente : refusée', !R(A, N, N + 'x', 'camille').pareil);
    V('73 caractères : refusé (limite de Supabase)', !R(A, 'x'.repeat(73), 'x'.repeat(73), 'camille').long);
  });
}

console.log('\n-- S-5 : « Se déconnecter » efface les copies des comptes de CE navigateur --');
V('doLogout vérifie AVANT de déconnecter, et n’efface que si tout est enregistré',
  /async function doLogout\(\) \{[\s\S]*?choix = await _decoVerifier\(\);[\s\S]*?if \(choix === 'attendre'\) return;[\s\S]*?signOut\(\)[\s\S]*?if \(choix === 'effacer'\) \{ try \{ _effacerCopiesLocales\(\); \}/.test(SRC));
essayer('l’effacement se laisse extraire', () => {
  const code = [prendre(/const SUPABASE_URL = '[^']+';/), "const SITE_FINANCES='noctra';", prendre(/function cleLocale\(nom\)\{[^\n]*\}/),
    prendre(/var _CLES_COPIES = \[[^\n]*\];/), prendre(/var _CLES_SESSION = \[[^\n]*\];/), prendre(/function _effacerCopiesLocales\(\)\{[\s\S]*?\n\}/)].join('\n');
  const m = new Map();
  const localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] || null, get length() { return m.size; } };
  const f = new Function('localStorage', code + '\nreturn { _effacerCopiesLocales, cleLocale, SUPABASE_URL };')(localStorage);
  const ref = 'sb-' + new URL(f.SUPABASE_URL).hostname.split('.')[0] + '-';
  const donnees = ['ents', 'vas', 'virements', 'modeles', 'editlog', 'snapshot_local'].map(f.cleLocale).concat(['ccn_token', 'ccn_mail', 'ccn_user', 'ccn_role', ref + 'auth-token']);
  const confort = ['masque', 'periode', 'recap_vue', 'rappel_bilan', 'pb_defaults', 'a_envoyer'].map(f.cleLocale)
    .concat(['ccn_theme', 'ccn_tab', 'ccn_ro', 'ccn_ident', 'fin_autre_ents', 'crm_ents', 'sb-autreprojet-auth-token']);
  donnees.concat(confort).forEach((k) => localStorage.setItem(k, '[1]'));
  f._effacerCopiesLocales();
  V('copies des comptes et session effacées', donnees.every((k) => !m.has(k)), donnees.filter((k) => m.has(k)).join(', '));
  V('thème, confort, file d’envoi, lecture seule et AUTRES sites gardés', confort.every((k) => m.has(k)), confort.filter((k) => !m.has(k)).join(', '));
});

console.log('\n-- S-1 : aucun identifiant de connexion écrit en clair (comparé par empreinte) --');
// Les deux identifiants ne sont PAS écrits ici : seulement leur empreinte sha256.
const EMPREINTES = new Set(['bd01b0b648c2c64eb1bddd9361d9972ea684b344fedc4d166654a85e8919e7ad', 'cbabe5c78b280e3c1a6303aae8589ddff01ea1f7a87f795e4e26811d05f90c3e']);
const h = (t) => crypto.createHash('sha256').update(t).digest('hex');
const trouves = (texte, emp) => [...new Set(texte.match(/[a-z]{3,}/g) || [])].filter((t) => emp.has(h(t)));
V('aucun identifiant de connexion dans la page (mots en minuscules)', trouves(SRC, EMPREINTES).length === 0, trouves(SRC, EMPREINTES).length + ' trouvé(s)');

console.log('\n-- les contrôles savent échouer --');
V('un identifiant inventé serait attrapé par son empreinte', trouves('// « camille » / « elodie »', new Set([h('camille')])).length === 1);
V('un script flottant sans empreinte serait attrapé',
  !/\bintegrity="sha(384|512)-/.test('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'));

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
