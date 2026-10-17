// POLITIQUE DE SÉCURITÉ DE CONTENU (CSP, 17/10 — S-C de la relecture du 16/10).
//
// ⚠️ LE DÉFAUT
// La page tient la session (lecture ET écriture de toute la comptabilité). Sans politique de contenu, un bout de
// HTML injecté un jour (aucun trouvé aujourd'hui) pourrait charger un script de n'importe où, ou envoyer la session
// à n'importe quelle adresse. La balise <meta http-equiv="Content-Security-Policy"> dit au navigateur : scripts =
// les deux fichiers FIGÉS (+ le script de la page), connexions = ce site, le projet Supabase et les webhooks
// Discord, polices Google, images du site ; aucun plugin, aucune balise <base>, aucun envoi de formulaire.
//
// Ce banc lit la balise et vérifie qu'elle est ÉTROITE (rien de trop) et COMPLÈTE (chaque ressource que la page
// charge vraiment y est : sinon le navigateur la bloquerait et le site casserait). La preuve dans un vrai navigateur
// (aucune violation dans la console, vraie bibliothèque) est faite à part, par la sonde de la vraie bibliothèque.
//
//     node test_csp.js

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + detail : '')); }
}

function lire(html) {
  const tete = html.split(/<\/head>/i)[0];
  const metas = tete.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*"\s*\/?>/gi) || [];
  const m = metas[0] ? /content="([^"]*)"/.exec(metas[0])[1] : '';
  const d = {};
  for (const part of m.split(';')) {
    const t = part.trim().split(/\s+/).filter(Boolean);
    if (t.length) d[t[0].toLowerCase()] = t.slice(1);
  }
  return { metas, d, pos: metas[0] ? html.indexOf(metas[0]) : -1 };
}
// Une source CSP couvre-t-elle cette adresse ? (règles de CSP3 : schéma, hôte, chemin ; un chemin finissant par « / »
// est un préfixe, sinon il doit être exact)
function couvre(source, url) {
  if (source === "'self'") return !/^[a-z][a-z0-9+.-]*:/i.test(url) || false;   // adresse relative = ce site
  if (/^[a-z]+:$/i.test(source)) return url.toLowerCase().startsWith(source.toLowerCase());
  const s = /^([a-z]+):\/\/([^/]+)(\/.*)?$/i.exec(source), u = /^([a-z]+):\/\/([^/]+)(\/[^?#]*)?/i.exec(url);
  if (!s || !u || s[1].toLowerCase() !== u[1].toLowerCase()) return false;
  const hote = s[2].toLowerCase(), uh = u[2].toLowerCase();
  if (hote.startsWith('*.') ? !uh.endsWith(hote.slice(1)) : hote !== uh) return false;
  if (!s[3]) return true;
  return s[3].endsWith('/') ? (u[3] || '/').startsWith(s[3]) : (u[3] || '/') === s[3];
}
const permet = (d, dir, url) => (d[dir] || d['default-src'] || []).some((s) => couvre(s, url));
const LARGES = /^(\*|https?:|wss?:|data:|blob:|'unsafe-eval'|'unsafe-hashes'|'wasm-unsafe-eval'|'strict-dynamic')$|\*/;

const { metas, d, pos } = lire(SRC);

console.log('\n-- la balise existe, une seule, AVANT toute ressource --');
V('une balise Content-Security-Policy dans <head>', metas.length === 1, metas.length + ' trouvée(s)');
const premiere = Math.min(...['<link', '<script', '<style'].map((t) => { const i = SRC.indexOf(t); return i < 0 ? Infinity : i; }));
V('... placée avant le premier <link>, <script> ou <style> (une balise meta ne protège que ce qui vient APRÈS elle)', pos >= 0 && pos < premiere, pos + ' / ' + premiere);
V('aucune directive qu’une balise meta ignore (frame-ancestors, report-uri, report-to, sandbox : avertissement console)',
  !['frame-ancestors', 'report-uri', 'report-to', 'sandbox'].some((k) => k in d), Object.keys(d).join(' '));

console.log('\n-- ÉTROITE : rien de trop --');
V("default-src 'none' (tout ce qui n’est pas nommé est refusé)", JSON.stringify(d['default-src']) === `["'none'"]`, JSON.stringify(d['default-src']));
for (const [k, v] of [['object-src', "'none'"], ['base-uri', "'none'"], ['form-action', "'none'"]]) {
  V(k + ' ' + v, JSON.stringify(d[k]) === JSON.stringify([v]), JSON.stringify(d[k]));
}
for (const k of Object.keys(d)) {
  const larges = (d[k] || []).filter((s) => LARGES.test(s) && !(k === 'img-src' && (s === 'data:' || s === 'blob:')));
  V(k + ' : aucune source trop large (*, https:, data:, unsafe-eval…)', larges.length === 0, larges.join(' '));
}
const SCRIPTS = (SRC.match(/<script\b[^>]*\bsrc="([^"]+)"/g) || []).map((s) => /src="([^"]+)"/.exec(s)[1]);
const sourcesScript = (d['script-src'] || []).filter((s) => /^https:\/\//.test(s));
V('script-src ne nomme QUE les fichiers que la page charge (pas un CDN entier : jsdelivr sert n’importe quel paquet)',
  sourcesScript.length > 0 && sourcesScript.every((s) => SCRIPTS.includes(s)), sourcesScript.join(' '));
const SUPA = (/const SUPABASE_URL = '(https:\/\/[^']+)'/.exec(SRC) || [])[1] || '';
const hote = SUPA.replace(/^https:\/\//, '');
const PERMIS_CONNECT = ["'self'", 'https://' + hote, 'wss://' + hote, 'https://discord.com/api/webhooks/', 'https://discordapp.com/api/webhooks/'];
V('connect-src : ce site, le projet Supabase (https + wss) et les webhooks Discord, rien d’autre',
  (d['connect-src'] || []).every((s) => PERMIS_CONNECT.includes(s)), (d['connect-src'] || []).join(' '));
V("img-src : 'self' data: blob: seulement", JSON.stringify((d['img-src'] || []).slice().sort()) === JSON.stringify(["'self'", 'blob:', 'data:']), JSON.stringify(d['img-src']));

console.log('\n-- COMPLÈTE : chaque ressource que la page charge vraiment est permise --');
const scriptsEnLigne = (SRC.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).length;
const attributs = /\son[a-z]+="/.test(SRC);
V("script-src 'unsafe-inline' tant que le script et les onclick=\"…\" sont dans la page", !(scriptsEnLigne || attributs) || (d['script-src'] || []).includes("'unsafe-inline'"));
for (const u of SCRIPTS) V('script permis : ' + u.split('/').slice(-3).join('/'), permet(d, 'script-src', u));
for (const l of SRC.match(/<link\b[^>]*>/g) || []) {
  const rel = (/rel="([^"]+)"/.exec(l) || [])[1] || '', href = (/href="([^"]+)"/.exec(l) || [])[1] || '';
  const dir = rel === 'stylesheet' ? 'style-src' : rel === 'manifest' ? 'manifest-src' : /icon/.test(rel) ? 'img-src' : null;
  if (dir) V(rel + ' permis (' + dir + ') : ' + href.slice(0, 60), permet(d, dir, href));
}
V("style-src 'unsafe-inline' (attributs style=\"…\" et <style> de la page)", (d['style-src'] || []).includes("'unsafe-inline'"));
if (/fonts\.googleapis\.com/.test(SRC)) V('les fichiers de police Google (fonts.gstatic.com) sont permis', permet(d, 'font-src', 'https://fonts.gstatic.com/s/inter/v1/x.woff2'));
V('Supabase permis : https (base, connexion) et wss (temps réel)', permet(d, 'connect-src', SUPA + '/rest/v1/entries') && permet(d, 'connect-src', 'wss://' + hote + '/realtime/v1/websocket') && permet(d, 'connect-src', SUPA + '/auth/v1/logout?scope=others'));
if (/sendDiscordNotif/.test(SRC)) V('les webhooks Discord que la page accepte sont permis (« Objectif atteint », bouton « Tester »)',
  permet(d, 'connect-src', 'https://discord.com/api/webhooks/123/abc') && permet(d, 'connect-src', 'https://discordapp.com/api/webhooks/123/abc'));
if (/serviceWorker\.register\(/.test(SRC)) V("le service worker du site (sw.js) est permis (worker-src 'self')", permet(d, 'worker-src', 'sw.js'));
if (/url\("data:image\/svg\+xml/.test(SRC)) V('les icônes dessinées en data: (mask-image) sont permises', permet(d, 'img-src', 'data:image/svg+xml,x'));
if (/createObjectURL/.test(SRC)) V('les téléchargements (Blob) ne sont pas touchés (blob: permis pour les images)', permet(d, 'img-src', 'blob:https://site/x'));
V('un formulaire de la page ne part jamais (la fenêtre du mot de passe annule l’envoi elle-même)',
  !/<form\b/.test(SRC) || /async function _mdpEnvoyer\(ev\)\{\n  if \(ev && ev\.preventDefault\) ev\.preventDefault\(\);/.test(SRC));

console.log('\n-- les contrôles savent échouer --');
{
  const t = (c) => lire('<head><meta http-equiv="Content-Security-Policy" content="' + c + '"><script src="https://cdn.jsdelivr.net/npm/x@1/x.js"></script></head>').d;
  V('un CDN entier serait vu comme trop large', !((t("script-src https://cdn.jsdelivr.net")['script-src'] || []).every((s) => SCRIPTS.includes(s))));
  V("une étoile serait vue", LARGES.test('*') && LARGES.test('https:') && LARGES.test("'unsafe-eval'") && LARGES.test('https://*.example.com'));
  V('un script non nommé serait refusé', !permet(t("script-src https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"), 'script-src', 'https://cdn.jsdelivr.net/npm/autre@1/a.js'));
  V('une adresse Supabase d’un AUTRE projet serait refusée', !permet(d, 'connect-src', 'https://autreprojet.' + 'supabase.co/rest/v1/x'));
  V('une adresse quelconque serait refusée', !permet(d, 'connect-src', 'https://exemple.invalid/vol?jeton=x') && !permet(d, 'img-src', 'https://exemple.invalid/p.gif'));
  V('une balise placée après les scripts serait vue', lire('<head><script src="a.js"></script><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head>').pos > 0);
}

console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
process.exit(ko ? 1 : 0);
