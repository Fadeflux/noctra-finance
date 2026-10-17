// LA COPIE DE SECOURS CONTIENT TOUT, ET L'IMPORT LA REPREND SANS RIEN EFFACER (17/10, feat9_restes ; relecture du 16/10, O3).
//
// ⚠️ LE DÉFAUT : « Télécharger une copie de secours » ne mettait dans le fichier ni le journal (l'Historique, donc la
// corbeille des bilans), ni ses archives, ni l'objectif du mois, ni les pierres tombales : base effacée → copie importée
// → la corbeille, l'Historique et l'objectif étaient perdus. Et une copie réimportée après une base effacée proposait de
// recréer TOUS les bilans (leurs identifiants changent à la création) : des doublons.
// LA RÈGLE :
//   1. la copie = les données d'avant + `editlog`, `editlog_archive` et les morceaux par année (RELUS en base au moment du
//      téléchargement ; sans réseau : ceux lus à l'ouverture, et c'est dit), `monthly_goal`, les pierres tombales
//      (paiements, chaque liste déclarée, journal, archive) — JAMAIS le webhook Discord, jamais une autre clé ;
//   2. l'import lit ces clés en plus SEULEMENT pour une copie qui les a (une ancienne copie : rien de plus) ;
//   3. le journal revient ligne par ligne, à sa place (plus loin dans l'archive si la base l'a déjà rangée) ; une ligne
//      effacée exprès (« Effacer l'historique ») ne revient pas ;
//   4. une pierre tombale n'est reprise que si ce qu'elle désigne n'est NI en base, NI sur l'appareil, NI dans la copie ; un
//      repère du journal seulement s'il ne cache aucune ligne de la base ;
//   5. l'objectif : repris s'il n'y en a pas (case cochée) ; différent : case DÉCOCHÉE ;
//   6. un identifiant de bilan inconnu de la base se reconnaît par le jour et les chiffres : jamais recréé en double.
// Prouvé sur le VRAI code de index.html (fonctions extraites), faux serveur en mémoire, données INVENTÉES. Aucune connexion.
//
//     node test_copie_complete.js [autre/index.html]      (sur la version d'avant : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
function extraire(nom) {
  let i = SRC.indexOf('async function ' + nom + '(');
  if (i < 0) i = SRC.indexOf('function ' + nom + '(');
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
function ligne(re) { const m = SRC.match(re); if (!m) throw new Error('introuvable : ' + re); return m[0]; }
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}
function essayer(quoi, f) { try { return f(); } catch (e) { V(false, quoi, e.message); return null; } }
async function essayerA(quoi, f) { try { return await f(); } catch (e) { V(false, quoi, e.message); return null; } }

const NOMS = ['_secoursL', '_secoursClesTombes', '_secoursObjectif', '_secoursAnnees', '_secoursTelecharger', '_secoursComplete',
  '_secoursPlusCles', '_secoursPlus', 'exportData', '_optsJournal', '_clesArchiveAnnees', '_cleVirement', '_virSig', '_virVieilleCle',
  '_pl', '_caseHtml', 'ts', '_corbUtile'];
const CODE = essayer('les fonctions de la copie complète sont extraites', () => [ligne(/var _SECOURS_ANNEE = [^\n]+/), ligne(/var _CORB_SUPPR = [^\n]+/), ligne(/const fmtC=v=>[^\n]+/)]
  .concat(NOMS.map(extraire)).join('\n'));

// un monde : la mémoire de la page, un faux serveur (réglages en texte, comme Supabase), un faux navigateur
function monde(o) {
  o = o || {};
  const W = { fichiers: [], lus: [], statut: [], ecrit: [], posts: [] };
  W.base = Object.assign({}, o.base || {});
  W.apiFetch = async (url, opt) => {
    if (o.panne) throw new Error('réseau');
    if (opt && opt.method === 'POST') { const b = JSON.parse(opt.body); W.posts.push(b); W.base[b.key] = String(b.value); return { ok: true }; }
    const m = /cles=([^&]+)/.exec(url); const cles = m ? decodeURIComponent(m[1]).split(',') : [];
    W.lus.push(cles); const r = {}; cles.forEach((k) => { if (k in W.base) r[k] = W.base[k]; }); return r;
  };
  W.document = { createElement: () => { const a = { click() { W.fichiers.push({ nom: a.download, corps: a.href }); } }; return a; }, getElementById: () => null };
  W.Blob = function (parts) { this.texte = parts.join(''); };
  W.URL = { createObjectURL: (b) => b.texte };
  W.LISTES = {
    impots_payes: { cleDe: (x) => String(x.id), lire: () => W.impotsPayes, titre: 'paiement d’impôts' },
    impots_retraits: { cleDe: (x) => String(x.id), lire: () => W.impotsRetraits, titre: 'retrait des impôts' },
  };
  W.editLog = o.editLog || [];
  W.impotsPayes = o.impotsPayes || [];
  W.impotsRetraits = o.impotsRetraits || [];
  W.virements = o.virements || [];
  W.saveVirements = async (cle, liste, opts) => { W.ecrit.push({ cle, liste: JSON.parse(JSON.stringify(liste)), opts }); return o.ecritureRefusee ? false : true; };
  W.saveEditLog = async () => { W.ecrit.push({ cle: 'editlog', liste: JSON.parse(JSON.stringify(W.editLogRef())) }); return true; };
  const f = new Function('apiFetch', 'document', 'Blob', 'URL', '_LISTES', 'ents', 'vas', 'virements', 'modeles', 'impotsPayes', 'impotsRetraits',
    'SITE_FINANCES', '_apiConnected', '_settingsCache', '_objEnregistre', 'navigator', 'showSaveStatus', '_fileLire', '_saveVirements', '_saveEditLog',
    'renderEditLog', '_corbRelireArchives', 'uk', '_fileReglageFait', '_fileReglageNoter', '__W',
    'var editLog = __W.editLog;\n' + CODE + '\n__W.editLogRef = function(){ return editLog; };\nreturn { ' + NOMS.join(', ') + ' };');
  W.F = f(W.apiFetch, W.document, W.Blob, W.URL, W.LISTES, o.ents || [{ id: 'b1', date: '2026-09-30' }], [], W.virements, [], W.impotsPayes, W.impotsRetraits,
    'noctra', o.connecte !== false, o.cache || {}, o.objEnregistre === undefined ? null : o.objEnregistre, { onLine: o.horsLigne ? false : true },
    (t) => W.statut.push(t), () => (o.file || []), W.saveVirements, W.saveEditLog, () => {}, () => {}, () => {}, () => {}, (k, v) => W.posts.push({ attente: k, v }), W);
  return W;
}
const J = (x) => JSON.stringify(x);
const lj = (ts, action, detail, plus) => Object.assign({ ts, action, detail }, plus || {});
const BILAN = { date: '2026-03-31', brut: 3000, va: 100, mo: 0, ci: 0, ch: 0, al_total: 0, al_items: [] };

(async () => {
if (CODE) {
  console.log('\n-- 1. la copie : tout, relu maintenant, jamais le webhook --');
  await essayerA('copie complète', () => {
    const base = {
      editlog_archive: J([lj('2026-01-02T10:00:00.000Z', 'Suppression entrée', '31 déc. 2025 · net $1.00', { bid: 'x9', bilan: Object.assign({}, BILAN, { date: '2025-12-31' }) })]),
      editlog_archive_2025: J([lj('2025-02-01T10:00:00.000Z', 'Note', 'sur 31 janv. 2025')]),
      editlog_supprimes: J([{ avant: '2026-01-02T10:00:00.000Z', par: 'p', raison: 'archive' }]),
      editlog_archive_supprimes: '[]',
      virements_supprimes: J([{ k: 'v-sup', le: '2026-09-01T10:00:00.000Z', par: 'p' }]),
      impots_payes_supprimes: J([{ k: 'i-sup', le: '2026-10-01T10:00:00.000Z', par: 'p' }]),
      impots_retraits_supprimes: J([{ k: 'r-sup', le: '2026-10-02T10:00:00.000Z', par: 'p' }]),
      monthly_goal: '8000', discord_webhook: 'https://exemple.invalid/webhook-fictif', snapshot_1: '{"ts":"x"}', cle_inconnue: 'garde-moi',
    };
    const W = monde({ base, editLog: [lj('2026-10-10T10:00:00.000Z', 'Suppression entrée', '31 mars 2026 · net $2,400.00', { bid: 'b0', bilan: BILAN })],
      impotsPayes: [{ id: 'ip1', mois: '2026-09', date: '2026-10-10', amount: 40 }], impotsRetraits: [{ id: 'rt1', date: '2026-10-11', amount: 60 }] });
    return W.F._secoursComplete().then((d) => {
      const f = W.fichiers.pop(), c = JSON.parse(f.corps);
      V(/^noctra-finance-copie-de-secours-\d{4}-\d\d-\d\d\.json$/.test(f.nom), 'même nom de fichier qu’avant', f.nom);
      V(['ents', 'vas', 'virements', 'modeles', 'impots_payes', 'impots_retraits', 'exportedAt', 'site', 'version'].every((k) => k in c), 'les clés d’avant y sont (l’ancien import les relit)');
      V(c.editlog.length === 1 && c.editlog[0].bilan && c.editlog[0].bilan.date === '2026-03-31', 'le journal, avec le bilan entier de la ligne « Suppression entrée » (la corbeille)');
      V(c.editlog_archive.length === 1 && c.editlog_archive[0].bid === 'x9', 'l’archive du journal (relue en base)');
      V(c.editlog_archives_annees && J(Object.keys(c.editlog_archives_annees)) === J(['editlog_archive_2025']), 'le morceau 2025 (seulement les morceaux non vides)', J(c.editlog_archives_annees));
      V(c.monthly_goal === 8000, 'l’objectif du mois (8000)', c.monthly_goal);
      V(['virements_supprimes', 'impots_payes_supprimes', 'impots_retraits_supprimes', 'editlog_supprimes', 'editlog_archive_supprimes'].every((k) => Array.isArray(c[k])) && c.virements_supprimes[0].k === 'v-sup',
        'les pierres tombales (paiements, impôts payés, retraits, journal, archive)');
      const lues = [].concat(...W.lus);
      V(!lues.includes('discord_webhook') && !/discord|webhook/i.test(f.corps), 'JAMAIS le webhook : ni demandé à la base, ni dans le fichier');
      V(!lues.some((k) => /^snapshot|^sauvegarde|cle_inconnue/.test(k)) && !('snapshot_1' in c) && !('cle_inconnue' in c), 'aucune autre clé (sauvegardes, clés inconnues) lue ni copiée');
      V(c.archives === 'relues' && c.version === 3 && !W.statut.length, 'archive relue au moment du téléchargement, aucun message');
    });
  });
  await essayerA('sans réseau', () => {
    const W = monde({ panne: true, cache: { editlog_archive: J([lj('2026-01-02T10:00:00.000Z', 'Note', 'x')]), monthly_goal: '7000', discord_webhook: 'https://exemple.invalid/w' } });
    return W.F._secoursComplete().then(() => {
      const c = JSON.parse(W.fichiers.pop().corps);
      V(c.archives === 'appareil' && c.editlog_archive.length === 1 && c.monthly_goal === 7000, 'base injoignable : la copie part quand même, avec l’archive lue à l’ouverture');
      V(W.statut.length === 1 && /^⚠/.test(W.statut[0]) && /archive/.test(W.statut[0]), '… et un message le dit', W.statut[0]);
      V(!/webhook/i.test(J(c)), '… toujours sans le webhook (même présent dans la copie de l’appareil)');
    });
  });
  await essayerA('objectif de la session', () => {
    const W = monde({ base: { monthly_goal: '8000' }, objEnregistre: 9500 });
    return W.F._secoursComplete().then(() => { V(JSON.parse(W.fichiers.pop().corps).monthly_goal === 9500, 'l’objectif changé sur cet appareil (9500) l’emporte'); });
  });
  V(/function exportData\(\) \{\n[^\n]*\n[^\n]*\n  if \(typeof _secoursComplete === 'function'\) return _secoursComplete\(\);/.test(SRC), 'exportData passe la main à la copie complète');

  console.log('\n-- 2. l’import : rien de plus pour une ancienne copie --');
  await essayerA('clés relues', () => {
    const W = monde();
    V(W.F._secoursPlusCles({ ents: [], virements: [], site: 'noctra', version: 2 }).length === 0, 'ancienne copie : AUCUNE lecture en plus');
    const k = W.F._secoursPlusCles({ ents: [], editlog: [], editlog_archives_annees: { editlog_archive_2019: [], discord_webhook: [], 'x;drop': [] } });
    V(k.includes('editlog') && k.includes('editlog_archive') && k.includes('monthly_goal') && k.includes('editlog_archive_2019') && k.includes('impots_payes_supprimes'), 'copie complète : journal, archive, morceaux, objectif, pierres tombales', J(k));
    V(!k.includes('discord_webhook') && !k.some((x) => /;|drop/.test(x)), 'une clé du fichier qui n’est pas « editlog_archive_<année> » n’est jamais lue ni écrite', J(k));
  });

  console.log('\n-- 3. le journal ligne par ligne, à sa place ; rien d’effacé exprès ne revient --');
  const tA = '2026-03-01T00:00:00.000Z';
  const L2 = lj('2026-10-01T10:00:00.000Z', 'Ajout entrée', '30 sept. 2026 · net $9.00'), L3 = lj('2026-10-05T10:00:00.000Z', 'Note', 'sur 30 sept. 2026');
  const L4 = lj('2026-10-12T10:00:00.000Z', 'Suppression entrée', '31 mars 2026 · net $2,400.00', { bid: 'b0', bilan: BILAN });
  const Lv = lj('2026-02-10T10:00:00.000Z', 'Note', 'ancienne, plus vieille que le repère « archive »');
  const A1 = lj('2026-01-02T10:00:00.000Z', 'Note', 'archivée'), A2 = lj('2025-12-20T10:00:00.000Z', 'Modification entrée', '30 nov. 2025 · net $1.00');
  const Y1 = lj('2025-02-01T10:00:00.000Z', 'Note', 'morceau'), Y2 = lj('2025-01-15T10:00:00.000Z', 'Note', 'morceau, absente');
  const P = { editlog: J([L3, L2]), editlog_archive: J([A1]), editlog_archive_2025: J([Y1]), editlog_supprimes: J([{ avant: tA, raison: 'archive' }]),
    editlog_archive_supprimes: '[]', monthly_goal: '8000', virements: J([{ id: 'v1', date: '2026-10-01', amount: 100 }, { id: 'L-2026-01-01|50|#0', date: '2026-01-01', amount: 50, note: '' }]),
    virements_supprimes: J([{ k: 'v-deja', le: 'x' }]), impots_payes: J([{ id: 'ip1', mois: '2026-09', date: '2026-10-10', amount: 40 }]), impots_payes_supprimes: '[]',
    impots_retraits: '[]', impots_retraits_supprimes: '[]' };
  const d = { ents: [], editlog: [L4, L3, L2, Lv], editlog_archive: [A1, A2], editlog_archives_annees: { editlog_archive_2025: [Y1, Y2], cle_piege: [L4] }, monthly_goal: 9000,
    virements: [{ id: 'v-copie', date: '2026-09-05', amount: 10 }],
    virements_supprimes: [{ k: 'v-absent', le: 'a', par: 'p' }, { k: 'v1', le: 'b' }, { k: 'v-deja', le: 'c' }, { k: 'v-copie', le: 'd' }, { k: '2026-01-01|50|', le: 'e' }],
    impots_payes: [{ id: 'ip-copie', mois: '2026-08', date: '2026-09-10', amount: 5 }],
    impots_payes_supprimes: [{ k: 'i-absent', le: 'f' }, { k: 'ip1', le: 'g' }, { k: 'ip-copie', le: 'h' }],
    editlog_supprimes: [{ avant: '2026-02-01T00:00:00.000Z', raison: 'vide' }], editlog_archive_supprimes: [{ avant: '2025-06-01T00:00:00.000Z', raison: 'archive' }] };
  await essayerA('classement', () => {
    const W = monde({ editLog: [L3, L2], impotsPayes: [{ id: 'ip1' }] });
    const CP = W.F._secoursPlus(d, P, {}, JSON.parse(P.virements));
    V(CP.n === 4 && CP.aj.editlog.length === 1 && CP.aj.editlog[0] === L4, '1 ligne nouvelle → le journal', J(CP.aj));
    V(CP.aj.editlog_archive && CP.aj.editlog_archive.length === 2 && CP.aj.editlog_archive.includes(Lv) && CP.aj.editlog_archive.includes(A2),
      'la ligne plus vieille que le repère « archive » de la base → l’archive (sinon la fusion la jetterait) ; A2 → l’archive', J(CP.aj.editlog_archive));
    V(CP.aj.editlog_archive_2025 && CP.aj.editlog_archive_2025.length === 1 && CP.aj.editlog_archive_2025[0] === Y2, 'la ligne absente du morceau 2025 → le morceau 2025');
    V(!CP.aj.cle_piege, 'une clé inventée dans le fichier (« cle_piege ») est ignorée');
    V(CP.corb === 1, 'la corbeille compte : 1 bilan supprimé revient', CP.corb);
    V(CP.obj && CP.obj.copie === 9000 && CP.obj.base === 8000, 'objectif différent : proposé (8000 → 9000)');
    const vt = (CP.tombes.find((t) => t.cle === 'virements_supprimes') || { l: [] }).l.map((t) => t.k);
    V(J(vt) === J(['v-absent']), 'paiements : seule la trace d’un paiement absent PARTOUT est reprise (pas v1 en base, pas v-deja déjà tracé, pas v-copie de la copie, pas l’ancienne trace d’un paiement ancien en base)', J(vt));
    const it = (CP.tombes.find((t) => t.cle === 'impots_payes_supprimes') || { l: [] }).l.map((t) => t.k);
    V(J(it) === J(['i-absent']), 'impôts payés : seule la trace d’un paiement absent partout', J(it));
    const et = (CP.tombes.find((t) => t.cle === 'editlog_supprimes') || { l: [] }).l;
    V(et.length === 0, 'le repère du journal de la copie, plus ancien que celui de la base : pas repris');
    const at = (CP.tombes.find((t) => t.cle === 'editlog_archive_supprimes') || { l: [] }).l;
    V(at.length === 1, 'le repère de l’archive de la copie, qui ne cache aucune ligne de la base : repris');
    V(CP.quelqueChose && CP.actif({}) && CP.actif({ journal: true }), 'il y a quelque chose à faire : le bouton s’allume');
    const H = []; CP.apercu(H, (cls, t) => H.push(t));
    const txt = H.join(' ');
    V(/data-case="journal"[^>]*>|aria-checked="true" data-case="journal"/.test(txt) && /Ajouter 4 lignes de l’Historique absentes de ta base \(dont 1 bilan de la corbeille\)/.test(txt), 'aperçu : « Ajouter 4 lignes… (dont 1 bilan de la corbeille) », cochée', txt.slice(0, 300));
    V(/aria-checked="false" data-case="objectif"/.test(txt) && /\$8,000 → \$9,000/.test(txt), 'aperçu : objectif différent → case DÉCOCHÉE', txt);
    V(/Les traces de 3 suppressions sont reprises/.test(txt), 'aperçu : les traces de suppression sont dites', txt);
  });
  await essayerA('effacé exprès', () => {
    const P2 = Object.assign({}, P, { editlog_supprimes: J([{ avant: '2026-10-02T00:00:00.000Z', raison: 'vide' }]) });
    const W = monde({ editLog: [L3] });
    const Lx = lj('2026-09-20T10:00:00.000Z', 'Note', 'effacée exprès');
    const CP = W.F._secoursPlus({ ents: [], editlog: [L4, L3, Lx] }, P2, {}, []);
    V(CP.effacees === 1 && CP.aj.editlog.length === 1 && CP.aj.editlog[0] === L4, '« Effacer l’historique » dans la base : la ligne plus ancienne ne revient pas (comptée, dite)', J([CP.effacees, CP.aj]));
    const H = []; CP.apercu(H, (cls, t) => H.push(t));
    V(/1 ligne effacée exprès de l’Historique/.test(H.join(' ')), 'aperçu : « 1 ligne effacée exprès … ne revient pas »');
  });
  await essayerA('repère qui cacherait', () => {
    const W = monde();
    const CP = W.F._secoursPlus({ ents: [], editlog_archive_supprimes: [{ avant: '2026-06-01T00:00:00.000Z', raison: 'archive' }] },
      Object.assign({}, P, { editlog_archive: J([lj('2026-01-02T10:00:00.000Z', 'Note', 'plus vieille que le repère')]) }), {}, []);
    V(!CP.tombes.some((t) => t.cle === 'editlog_archive_supprimes'), 'un repère qui cacherait une ligne de la base n’est PAS repris');
  });
  await essayerA('objectif', () => {
    const W = monde();
    const a = W.F._secoursPlus({ ents: [], monthly_goal: 8000 }, { monthly_goal: '8000' }, {}, []);
    const b = W.F._secoursPlus({ ents: [], monthly_goal: 8000 }, {}, {}, []);
    V(a.obj === null && !a.quelqueChose, 'même objectif : rien (« Rien à restaurer »)');
    V(b.obj && b.obj.base === null, 'pas d’objectif en base : repris…');
    const H = []; b.apercu(H, () => {}); V(/aria-checked="true" data-case="objectif"/.test(H.join(' ')), '… case cochée');
    const W2 = monde({ objEnregistre: 9000, file: [{ t: 'reglage', cle: 'monthly_goal', valeur: 9000 }] });
    const c = W2.F._secoursPlus({ ents: [], monthly_goal: 9000 }, { monthly_goal: '8000' }, {}, []);
    V(c.obj === null, 'l’objectif qui attend d’être envoyé depuis cet appareil compte comme l’actuel');
  });
  await essayerA('écriture', () => {
    const W = monde({ editLog: [L3, L2] });
    const CP = W.F._secoursPlus(d, P, {}, JSON.parse(P.virements));
    return CP.appliquerTombes().then(() => CP.appliquer({ journal: true, objectif: false })).then(() => {
      const cles = W.ecrit.map((e) => e.cle);
      V(cles[0] === 'virements_supprimes' || cles[0] === 'impots_payes_supprimes' || cles[0] === 'editlog_archive_supprimes', 'les traces de suppression d’abord (fonction générale d’écriture)', J(cles));
      const iA = cles.indexOf('editlog_archive_2025'), iB = cles.indexOf('editlog_archive'), iC = cles.indexOf('editlog');
      V(iA >= 0 && iB > iA && iC > iB, 'puis le journal, des plus anciennes aux plus récentes : morceau 2025, archive, journal', J(cles));
      const arch = W.ecrit[iB];
      V(arch.opts && arch.opts.limite === 3000 && typeof arch.opts.archive === 'function' && arch.opts.devant === true, 'l’archive passe par la même écriture que l’archivage (limite, morceaux par année)');
      V(W.ecrit[iC].liste.some((l) => l.bid === 'b0'), 'la ligne de la corbeille est dans le journal écrit');
      V(CP.fait.lignes === 4 && CP.fait.tombes === 3 && !W.posts.length, 'compté : 4 lignes, 3 traces ; objectif non coché : rien envoyé', J([CP.fait, W.posts]));
    });
  });
  await essayerA('écriture de l’objectif', () => {
    const W = monde();
    const CP = W.F._secoursPlus({ ents: [], monthly_goal: 9000 }, {}, {}, []);
    return CP.appliquer({ objectif: true }).then((ok) => {
      V(ok && W.posts.length === 1 && W.posts[0].key === 'monthly_goal' && W.posts[0].value === 9000, 'case cochée : l’objectif est envoyé (même requête que la page)', J(W.posts));
    });
  });
}
{
  console.log('\n-- 4. l’import branché (aperçu, bouton, écriture, message) ; un identifiant inconnu ne crée pas de doublon --');
  const R = (() => { try { return extraire('_restaurerAvecApercu'); } catch (e) { return ''; } })();
  V(/_secoursPlusCles\(d\)/.test(R) && /_clesPlus\.length \? apiFetch\('\/api\/settings\?cles=' \+ _clesPlus\.join\(','\)\) : null/.test(R), 'la base est relue pour ces clés, seulement si la copie les a');
  V(/_secoursPlus\(d, distPlus, dist, srvVir\)/.test(R) && /!\(CP && CP\.quelqueChose\)/.test(R), '« Rien à restaurer » tient compte du journal, de l’objectif, des traces');
  V(/if \(CP\) CP\.apercu\(L, ligne\);/.test(R) && /\|\| \(CP && CP\.actif\(c\)\)/.test(R), 'l’aperçu et le bouton');
  V(R.indexOf('CP.appliquerTombes()') > 0 && R.indexOf('CP.appliquerTombes()') < R.indexOf('if (virAjout.length) {') && R.indexOf('CP.appliquer(c)') > R.indexOf('_listeEcrire(a.cle)'),
    'traces d’abord, journal et objectif après les listes');
  V(/if \(f\.id && parId\[f\.id\]\) s = parId\[f\.id\];\n(?:    \/\/[^\n]*\n)+    else \{/.test(R) && !/else if \(!f\.id\) \{/.test(R), 'un identifiant inconnu de la base : reconnu par le jour et les chiffres (jamais recréé en double)');
  V(/_LISTES\.impots_payes\.titres = 'paiements d’impôts'/.test(SRC), 'l’aperçu dit « 2 paiements d’impôts » (plus « 2 paiement d’impôtss »)');
  V(/#bilan-dlg \.bd-plus > \*\{flex-shrink:0\}/.test(SRC), 'les lignes de l’aperçu gardent leur hauteur (la liste défile au lieu de les écraser l’une sur l’autre)');
}
console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
process.exit(ko ? 1 : 0);
})();
