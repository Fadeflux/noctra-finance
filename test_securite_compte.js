// SÉCURITÉ DU COMPTE (15/10, renforcé le 17/10) : mot de passe, autres sessions, déconnexion, scripts externes,
// identifiants, formulaire, pastille d'identité.
//
// ⚠️ LE CONTEXTE
// Des chaînes en forme de mots de passe ont été publiées par erreur dans ce dépôt PUBLIC (retirées le 15/10 ;
// l'historique git les garde). Les adresses de connexion finissent en .invalid : aucun e-mail n'y arrive, donc
// pas de « mot de passe oublié ». Chacun change le sien depuis le site : ce banc garde ce chemin honnête.
// Il ne contient AUCUN mot de passe ni identifiant réel : les identifiants sont comparés par EMPREINTE (sha256),
// les essais utilisent des prénoms et des valeurs INVENTÉS.
//
// (17/10) S-A : un identifiant écrit avec sa majuscule (« Prénom »), son accent, une entité HTML (&#233;) ou un
// échappement JS (é) échappait à l'ancienne recherche (mots tout en minuscules, page seule). Les mots sont
// maintenant NORMALISÉS (décodés, NFD, sans accents, minuscules, coupure camelCase) avant l'empreinte, et la
// recherche couvre la page ET chaque fichier publié à côté d'elle (les bancs, ce fichier compris).
// (17/10) S-D' : après un changement de mot de passe réussi, les AUTRES sessions du compte sont fermées.
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
const essayerA = async (titre, fn) => { try { await fn(); } catch (e) { V(titre, false, String(e.message || e).slice(0, 160)); } };

(async () => {

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

console.log('\n-- le nom affiché vient de l’identifiant de la SESSION (pastille, signature des bilans) --');
essayer('nomAffiche se laisse extraire', () => {
  const f = new Function(prendre(/function nomAffiche\(ident\)\{[\s\S]*?\n\}/) + '\nreturn nomAffiche;')();
  V('« camille@noctra.invalid » -> « Camille »', f('camille@' + 'noctra.invalid') === 'Camille', f('camille@' + 'noctra.invalid'));
  V('une ancienne adresse complète -> « Moi » (jamais le début de l’adresse)', f('Prenom.Exemple-Long' + '@' + 'domaine.example') === 'Moi');
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
  V('la règle affichée parle de l’IDENTIFIANT, jamais du « prénom » (S-A)',
    /_mdpRegle\('prenom', 'Sans ton identifiant'\)/.test(BLOC) && !/ton prénom|ton pr&#233;nom/i.test(BLOC));
  essayer('les règles se laissent extraire', () => {
    const code = prendre(/var _MDP_MIN = 10, _MDP_MAX = 72;/, BLOC) + '\n' + prendre(/function _mdpSansAccents\(s\)\{[^\n]*\}/, BLOC) + '\n'
      + prendre(/function _mdpRegles\(actuel, nouveau, confirmation, ident\)\{[\s\S]*?\n\}/, BLOC);
    const R = new Function(code + '\nreturn _mdpRegles;')();
    const A = 'exemple-invente-42', N = 'Nuit-violette-2031';
    const r = R(A, N, N, 'camille');
    V('bon nouveau : toutes les règles vertes', r.long && r.diff && r.prenom && r.pareil, JSON.stringify(r));
    V('9 caractères : refusé', !R(A, 'court-123', 'court-123', 'camille').long);
    V('identique à l’actuel : refusé', !R(A, A, A, 'camille').diff);
    V('contient l’identifiant (même avec accent / majuscules) : refusé', !R(A, 'CAMÏLLE-violet-2031', 'CAMÏLLE-violet-2031', 'camille').prenom);
    V('confirmation différente : refusée', !R(A, N, N + 'x', 'camille').pareil);
    V('73 caractères : refusé (limite de Supabase)', !R(A, 'x'.repeat(73), 'x'.repeat(73), 'camille').long);
  });
}

console.log('\n-- S-D’ : après un changement RÉUSSI, les AUTRES sessions du compte sont fermées (et c’est dit) --');
// Un appareil perdu ou une session volée restait ouvert après le changement. supabase-js 2.117.3 :
// signOut({ scope: 'others' }) = POST /auth/v1/logout?scope=others ; CETTE session reste ouverte. Si la fermeture
// échoue, le mot de passe reste changé et le message le dit (jamais « n'a PAS changé »).
if (BLOC) {
  const env = (prendre(/async function _mdpEnvoyer\(ev\)\{[\s\S]*?\n\}/, BLOC));
  const iUp = env.indexOf('updateUser({ password: n })'), iCatch = env.indexOf('} catch (e) {', iUp), iAutres = env.indexOf('_mdpFermerAutres(sb');
  V('la fermeture des autres sessions vient APRÈS updateUser réussi, hors du bloc d’erreurs du changement',
    iUp > 0 && iCatch > iUp && iAutres > iCatch && env.indexOf('_mdpFermerAutres(sb', iAutres + 1) < 0, [iUp, iCatch, iAutres].join(' / '));
  V('... et les valeurs tapées quittent la page AVANT d’attendre le serveur', env.lastIndexOf('_mdpVider();', iAutres) > iCatch);
  V('jamais signOut() sans portée dans le bloc (ce serait « global » : déconnecter AUSSI cet appareil)', !/signOut\(\s*\)/.test(BLOC));
  V('la vue de réussite a sa phrase sur les autres appareils', /class="md-fini-x md-fini-autres"/.test(BLOC) && /pa\.textContent = _mdpTexteAutres\(autres,/.test(env));
  await essayerA('_mdpFermerAutres / _mdpTexteAutres se laissent extraire', async () => {
    const code = prendre(/async function _mdpFermerAutres\(client, delai\)\{[\s\S]*?\n\}/, BLOC) + '\n' + prendre(/function _mdpTexteAutres\(ok, duree\)\{[\s\S]*?\n\}/, BLOC);
    const F = new Function(code + '\nreturn { _mdpFermerAutres, _mdpTexteAutres };')();
    const appels = [];
    const client = (rep) => ({ auth: { signOut: (o) => { appels.push(o); return typeof rep === 'function' ? rep() : Promise.resolve(rep); } } });
    V('confirmé par le serveur -> true, avec la portée « others »', (await F._mdpFermerAutres(client({ error: null }), 500)) === true && JSON.stringify(appels[0]) === '{"scope":"others"}', JSON.stringify(appels));
    V('refus du serveur -> false', (await F._mdpFermerAutres(client({ error: { message: 'refus' } }), 500)) === false);
    V('coupure (exception) -> false, sans erreur levée', (await F._mdpFermerAutres(client(() => Promise.reject(new Error('Failed to fetch'))), 500)) === false);
    const t0 = Date.now();
    V('pas de réponse -> false au bout du délai', (await F._mdpFermerAutres(client(() => new Promise(() => {})), 40)) === false && Date.now() - t0 < 1000);
    V('pas de bibliothèque -> false', (await F._mdpFermerAutres(null, 40)) === false && (await F._mdpFermerAutres({ auth: {} }, 40)) === false);
    const oui = F._mdpTexteAutres(true, 3600), non = F._mdpTexteAutres(false, 3600);
    V('réussite : « déconnectés », le nouveau mot de passe, et le délai honnête d’une page déjà ouverte (une heure)',
      /sont déconnectés/.test(oui) && /nouveau mot de passe/.test(oui) && /une heure/.test(oui), oui);
    V('échec : « pas pu être confirmée » + « bien changé » + ce qu’il faut faire', /pas pu être confirmée/.test(non) && /bien changé/.test(non) && /Se déconnecter/.test(non) && !/PAS changé/.test(non), non);
    V('durée inconnue : la phrase reste juste, sans délai inventé', !/jusqu/.test(F._mdpTexteAutres(true, undefined)));
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
  // (16/10) + 'impots_payes' : la copie locale des impôts payés notés (montants + dates), écrite par saveData depuis la
  // liste du mois ; elle restait dans le navigateur après « Se déconnecter » (vu le 16/10 : absente de _CLES_COPIES).
  const donnees = ['ents', 'vas', 'virements', 'modeles', 'editlog', 'snapshot_local', 'impots_payes'].map(f.cleLocale).concat(['ccn_token', 'ccn_mail', 'ccn_user', 'ccn_role', ref + 'auth-token']);
  // (16/10) + 'impots_calcul' : le choix « Voir le calcul » des impôts au téléphone (P4), du confort sans chiffre : GARDÉ
  const confort = ['masque', 'periode', 'recap_vue', 'rappel_bilan', 'pb_defaults', 'a_envoyer', 'impots_calcul'].map(f.cleLocale)
    .concat(['ccn_theme', 'ccn_tab', 'ccn_ro', 'ccn_ident', 'fin_autre_ents', 'crm_ents', 'sb-autreprojet-auth-token']);
  donnees.concat(confort).forEach((k) => localStorage.setItem(k, '[1]'));
  f._effacerCopiesLocales();
  V('copies des comptes et session effacées', donnees.every((k) => !m.has(k)), donnees.filter((k) => m.has(k)).join(', '));
  V('la copie des impôts payés (montants, dates) est effacée aussi', !m.has(f.cleLocale('impots_payes')), f.cleLocale('impots_payes') + ' encore là');
  V('thème, confort, file d’envoi, lecture seule et AUTRES sites gardés', confort.every((k) => m.has(k)), confort.filter((k) => !m.has(k)).join(', '));
});

console.log('\n-- pastille d’identité de l’en-tête (ordinateur, tablette) : icône du site, 12 px, jetons du thème --');
// Avant (17/10) : « 👤 Prénom » en émoji, 11,5 px, violet de marque écrit en dur (3,02:1 en thème clair).
essayer('majBadgeIdentite / _badgeIdentite se laissent extraire', () => {
  const code = prendre(/function majBadgeIdentite\(\)\{[\s\S]*?\n\}/) + '\n' + prendre(/function _badgeIdentite\(b, ico, txt\)\{[\s\S]*?\n\}/);
  const b = { style: { display: 'none', background: '#221a2d', color: '#e879f9', border: 'x' }, _h: '', lastChild: null };
  Object.defineProperty(b, 'innerHTML', { get() { return this._h; }, set(v) { this._h = v; this.lastChild = { textContent: '' }; } });
  const run = (nom) => new Function('document', '_currentUser', code + '\nmajBadgeIdentite();')({ getElementById: () => b }, nom);
  run('Camille');
  V('une icône SVG au trait, aucun émoji', /^<svg[^>]*stroke="currentColor"[\s\S]*<\/svg><span><\/span>$/.test(b.innerHTML) && !/\p{Extended_Pictographic}/u.test(b.innerHTML + code), b.innerHTML.slice(0, 80));
  V('le nom est écrit comme du TEXTE (jamais du HTML)', b.lastChild.textContent === 'Camille');
  V('aucune couleur écrite en dur sur la pastille (le CSS et ses jetons décident)', !b.style.background && !b.style.color && !b.style.border, JSON.stringify(b.style));
  run('<img src=x onerror=alert(1)>');
  V('un nom piégé reste du texte', !/<img/.test(b.innerHTML) && /<img/.test(b.lastChild.textContent));
});
essayer('applyRoleUI (associé) : pas d’émoji ni de couleur en dur', () => {
  const f = prendre(/function applyRoleUI\(\)\{[\s\S]*?\n\}/);
  V('... la pastille d’associé passe par la même fonction', /_badgeIdentite\(badge,'asso'/.test(f) && !/\p{Extended_Pictographic}/u.test(f) && !/#[0-9a-f]{6}/i.test(f), f.slice(0, 200));
});
{
  const balise = (SRC.match(/<div id="role-badge"[^>]*>/) || [''])[0];
  const enLigne = /font-size:\s*([\d.]+)px/.exec(balise);
  V('la balise ne force aucune taille sous 12 px', !enLigne || +enLigne[1] >= 12, balise);
  const regle = (SRC.match(/\.dash > \.topbar #role-badge\{[^}]*\}/g) || []).filter((r) => /font-size/.test(r)).pop() || '';
  const fs_ = /font-size:\s*([\d.]+)px/.exec(regle);
  V('règle CSS : 12 px ou plus, encre et fond = jetons du thème', !!fs_ && +fs_[1] >= 12 && /color:var\(--acc-txt\)/.test(regle) && /background:var\(--acc-12\)/.test(regle), regle.slice(0, 160));
}

console.log('\n-- S-A : aucun identifiant de connexion écrit, sous AUCUNE forme, dans la page ni dans les fichiers publiés --');
// Les deux identifiants ne sont PAS écrits ici : seulement leur empreinte sha256 (minuscules, sans accent).
const EMPREINTES = new Set(['bd01b0b648c2c64eb1bddd9361d9972ea684b344fedc4d166654a85e8919e7ad', 'cbabe5c78b280e3c1a6303aae8589ddff01ea1f7a87f795e4e26811d05f90c3e']);
const h = (t) => crypto.createHash('sha256').update(t).digest('hex');
const ENTITES = { eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê', euml: 'ë', Euml: 'Ë', agrave: 'à', Agrave: 'À',
  acirc: 'â', Acirc: 'Â', auml: 'ä', ccedil: 'ç', Ccedil: 'Ç', icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï', ocirc: 'ô', Ocirc: 'Ô', ouml: 'ö',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', yuml: 'ÿ', ntilde: 'ñ', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú' };
const decoder = (t) => t
  .replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, x) => String.fromCharCode(parseInt(x, 16)))
  .replace(/\\x([0-9a-fA-F]{2})/g, (_, x) => String.fromCharCode(parseInt(x, 16)))
  .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/&#(\d{1,7});/g, (_, x) => String.fromCodePoint(+x))
  .replace(/&([a-zA-Z]+);/g, (m, n) => ENTITES[n] || m);
// Chaque suite de lettres, puis chaque morceau camelCase, en minuscules et sans accents.
function mots(texte) {
  const t = decoder(texte).normalize('NFD').replace(/\p{M}/gu, '');
  const out = new Set();
  for (const suite of t.match(/[A-Za-z]+/g) || []) {
    out.add(suite.toLowerCase());
    for (const p of suite.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[A-Z]+/g) || []) out.add(p.toLowerCase());
  }
  return out;
}
const trouves = (texte, emp = EMPREINTES) => [...mots(texte)].filter((t) => emp.has(h(t)));
// Les fichiers publiés à côté de la page (ce dossier, sous-dossiers compris, sauf .git et node_modules).
function fichiers(dossier) {
  const out = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...fichiers(p));
    else if (/\.(html?|js|mjs|json|md|txt|css|svg|webmanifest|xml|yml|yaml)$/i.test(e.name)) out.push(p);
  }
  return out;
}
V('aucun identifiant de connexion dans la page (commentaires compris, casse, accents, entités, échappements)',
  trouves(SRC).length === 0, trouves(SRC).length + ' mot(s) trouvé(s) (non écrits ici)');
const tous = fichiers(__dirname);
const sales = tous.filter((p) => trouves(fs.readFileSync(p, 'utf8')).length).map((p) => path.relative(__dirname, p));
V('aucun identifiant dans les ' + tous.length + ' fichiers publiés à côté (bancs, lanceur, manifeste…)', sales.length === 0, sales.join(', '));

console.log('\n-- les contrôles savent échouer --');
const emp = new Set([h('elodie')]);
for (const forme of ['// elodie', 'Élodie', 'ÉLODIE', '&#201;lodie', '&Eacute;LODIE', '&#xC9;lodie', '"\\u00c9lodie"', 'nomÉlodie', 'Élodie_2', 'élodie']) {
  V('un identifiant inventé écrit « ' + forme + ' » serait attrapé par son empreinte', trouves(forme, emp).length === 1);
}
V('... mais pas un mot qui le contient seulement (« Élodies » n’est pas « Élodie »)', trouves('Élodies', emp).length === 0);
V('un script flottant sans empreinte serait attrapé',
  !/\bintegrity="sha(384|512)-/.test('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'));

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
})();
