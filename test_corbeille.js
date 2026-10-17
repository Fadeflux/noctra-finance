// UN BILAN SUPPRIMÉ PAR ERREUR SE REMET, MÊME DES MOIS APRÈS (relecture du 16/10, O2).
//
// ⚠️ LE DÉFAUT : supprimer un bilan ne gardait que « 30 sept. 2026 · net $12,080.00 » dans le journal ; les 7 sauvegardes
// automatiques tournent (une par 20 h) : au 8e jour, le bilan n'existait plus NULLE PART.
// La règle :
//   1. la ligne « Suppression entrée » garde le bilan ENTIER (`bilan` = entryToDb), son identifiant (`bid`), qui (`par`) —
//      action et détail INCHANGÉS (le centre de contrôle les lit) ;
//   2. la corbeille = ces lignes (journal + archives), moins celles dont le dernier geste est « Bilan remis » ;
//   3. « Remettre ce bilan » passe par le chemin normal de création (relecture, alerte du mois, saveEntry) et JAMAIS en
//      lecture seule ;
//   4. une sauvegarde par mois (`sauvegarde_mois_<MM>`, 12 emplacements), jamais lue au chargement ;
//   5. « Effacer tout l'historique » range d'abord la corbeille dans l'archive.
// Prouvé sur le VRAI code de index.html (fonctions extraites), faux serveur en mémoire, bilans INVENTÉS. Aucune connexion.
//
//     node test_corbeille.js [autre/index.html]      (sur la version d'avant la corbeille : doit ÉCHOUER)
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
function blocDepuis(i) {
  let prof = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') prof++;
    else if (SRC[k] === '}' && --prof === 0) return SRC.slice(i, k + 1);
  }
  throw new Error('fin introuvable');
}
function extraire(nom) {
  let i = SRC.indexOf('async function ' + nom + '(');
  if (i < 0) i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) throw new Error('fonction introuvable : ' + nom);
  // le corps commence APRÈS la liste des paramètres (apiFetch a « options={} » : une accolade avant le corps)
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

// Le code de la page : les calculs du bilan, la suppression, le journal, la corbeille, la sauvegarde du mois.
const BASE = essayer('les fonctions de base sont extraites', () => [
  ligne(/const fmt=v=>[^\n]+/), ligne(/const fmtC=v=>[^\n]+/), ligne(/const _IMPOTS_OF=[^;]+;/), ligne(/const _TAUX=[^;]+;/),
  'function _netBilan(e){ return (e.brut||0)*0.80+(e.tgNet||0); }', 'function _mtS(v){ return (v<0?"−":"")+fmtC(v); }',
  extraire('dl'), extraire('_sansZero'), extraire('dlA'), extraire('fraisOF'), extraire('profitEntree'), extraire('entryFromDb'),
  extraire('entryToDb'), extraire('logEdit'), 'window.deleteEntry = ' + blocDepuis(SRC.indexOf('window.deleteEntry = ') + 'window.deleteEntry = '.length).replace(/^/, ''),
].join('\n'));
const CORB = ['_corbCle', '_corbT', '_corbQui', '_corbUtile', '_corbChamps', '_corbEntree', '_corbDetail', '_corbQuoi', '_corbDepuisTexte',
  '_corbArchivesChargees', '_corbLignes', '_corbeille', 'corbRemettre', '_corbAvantEffacer', '_smLireIndex', '_smCles', 'sauvegardeMoisSiNecessaire'];
const CODE_CORB = essayer('les fonctions de la corbeille existent dans la page', () => CORB.map(extraire).join('\n'));

// Un monde : faux journal, faux serveur, faux écran. `o.lecture` = lecture seule.
function monde(o) {
  o = o || {};
  const W = { journal: [], envois: [], dialogues: [], statut: [], rafraichi: 0, sauves: [], pousses: [], lues: [], lecture: !!o.lecture, charge: o.charge,
              doublon: o.doublon || null, choix: o.choix || 'annuler', reglages: Object.assign({}, o.reglages || {}), push_ok: o.push_ok !== false };
  const pre = [
    'var window = {}; var editLog = W.editLog || []; var ents = W.ents || []; var _editingId = null; var _currentUser = "appareil A";',
    'var _settingsCache = W.cache || {}; var _donneesChargees = (W.charge === undefined) ? true : W.charge; var _apiConnected = true; var _dlgOuvert = false;',
    'var virements = W.virements || []; var _corbVus = {}; var _corbArch = { obj: null, l: [] }; var _corbFrais = []; var _CORB_SUPPR = /^Suppression entr/;',
    'var _SM_PREFIXE = "sauvegarde_mois_", _SM_INDEX = "sauvegardes_mois";',
    'var document = { body: { classList: { contains: (c) => c === "readonly" && W.lecture } }, getElementById: () => null };',
    'var console = { warn() {}, info() {}, log() {}, error() {} };',
    'function _copie(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); }',
    'function gf(){ return ents; } function rh(){} function rc(){} function uk(){} function renderVirements(){} function renderModeles(){} function renderModelShare(){}',
    'function renderCorbeille(){} function _corbDire(t, c){ W.statut.push(t); } function _corbRemiseNoter(){} function _uidDe(){ return "u1"; }',
    'function _pasCharge(){ return false; } function cancelEdit(){} function _fileAnnulerCreation(){}',
    'function _attenteNoter(){} function _saveEditLog(){} function saveData(){ return Promise.resolve(true); }',
    'function showSaveStatus(t){ W.statut.push(t); } function ecritureInterdite(q){ if (W.lecture) { W.statut.push("⚠ Lecture seule — RIEN n’a été enregistré (" + q + ")"); return true; } return false; }',
    'function _fenetre(x){ W.dialogues.push(x); return Promise.resolve({ choix: W.choixFenetre || "oui" }); }',
    'function deleteEntryAPI(id){ W.envois.push("DELETE " + id); return Promise.resolve(true); }',
    'function saveEntry(e){ if (ecritureInterdite("entrée")) return Promise.resolve(false); W.envois.push("POST " + JSON.stringify(entryToDb(e))); return Promise.resolve(true); }',
    'async function _rafraichir(){ W.rafraichi++; } function _doublonServeurUtile(){ return true; }',
    'function _doublonMois(d){ return W.doublon && W.doublon.local ? { ym: d.slice(0, 7), liste: [W.doublon.local] } : null; }',
    'async function _doublonServeur(d){ return W.doublon && W.doublon.serveur ? { ym: d.slice(0, 7), liste: [W.doublon.serveur], ailleurs: "créé sur un autre appareil" } : null; }',
    'async function _corbAlerteDoublon(d, e){ W.dialogues.push({ doublon: d.ym }); return W.choix; }',
    'function _quoiBilan(e){ return "de " + String(e.date).slice(0, 7); } function _ymLocal(){ return W.mois; }',
    'function _snapContenu(){ return { ts: "2026-10-01T08:00:00.000Z", ents: ents, virements: [], modeles: [], impots_payes: [], vas: [] }; }',
    'async function _pushSetting(k, v){ if (ecritureInterdite(k)) return false; if (!W.push_ok) return false; W.pousses.push(k); W.reglages[k] = JSON.stringify(v); return true; }',
    'async function apiFetch(u){ W.lues.push(u); const m = /[?&]cles=([^&]*)/.exec(u); const o = {}; (m ? decodeURIComponent(m[1]).split(",") : []).forEach(k => { if (k in W.reglages) o[k] = W.reglages[k]; }); return o; }',
    'function _clesArchiveAnnees(){ return ["editlog_archive_2026", "editlog_archive_2025", "editlog_archive_sans_date"]; }',
    'function _optsJournal(){ var date = function(l){ var v = new Date(l && l.ts).getTime(); return isFinite(v) ? v : 0; }; return { cleDe: function(l){ return String(l && l.ts) + "|" + (l && l.action) + "|" + (l && l.detail); }, dateDe: date, trier: function(a, b){ return date(b) - date(a); }, archiveMax: 3000, archiveMarge: 500, archiveSuite: function(){ return "x"; } }; }',
    'async function _saveVirements(cle, liste, opts){ if (W.archive_ko) return false; W.sauves.push({ cle: cle, n: liste.length, lignes: liste }); return true; }',
  ].join('\n');
  const f = new Function('W', pre + '\n' + BASE + '\n' + (CODE_CORB || '') + '\nreturn { deleteEntry: window.deleteEntry, logEdit, entryToDb, entryFromDb, profitEntree, '
    + CORB.map((x) => 'get ' + x + '(){ return typeof ' + x + ' === "function" ? ' + x + ' : null; }').join(', ')
    + ', get editLog(){ return editLog; }, set editLog(v){ editLog = v; }, get ents(){ return ents; }, set ents(v){ ents = v; }, get cache(){ return _settingsCache; }, set cache(v){ _settingsCache = v; } };');
  W.api = f(W);
  return W;
}
// Un bilan INVENTÉ, tel que la page le tient en mémoire (relu par entryFromDb).
function bilanInvente(W, date, id) {
  const r = { id: id || 'b-essai', date: date || '2026-09-30', brut: 14000, va: 1550.5, mo: 0, ci: 699, ch: 600, al_total: 937.73,
    al_items: [{ name: 'Outil fictif', val: 637.73, paidBy: 'moi' }, { name: 'Serveur fictif', val: 300, paidBy: 'associe' }],
    va_items: [{ name: 'VA fictive', val: 1550.5, date: '2026-09-15', paidBy: 'moi' }], mo_items: [], ci_items: [{ name: 'IA fictive', val: 699, paidBy: 'moi' }],
    ch_items: [{ name: 'Chat fictif', val: 600, paidBy: 'moi' }], profit: 8293, paid_by: { va: 'moi' }, notes: 'note fictive', author: 'appareil A', tg_net: 880, of_net: 11200 };
  return W.api.entryFromDb(r);
}
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  console.log('\n-- 1. supprimer garde le bilan ENTIER dans la ligne du journal (action et détail inchangés) --');
  let ligneSuppr = null, bilanAvant = null;
  {
    const W = monde();
    const e = bilanInvente(W);
    W.api.ents = [e];
    bilanAvant = W.api.entryToDb(e);
    await W.api.deleteEntry(0);
    const l = W.api.editLog[0] || {};
    ligneSuppr = l;
    V(l.action === 'Suppression entrée', 'l’action reste « Suppression entrée »', l.action);
    V(l.detail === '30 sept. 2026 · net $12,080.00', 'le détail garde sa forme « 30 sept. 2026 · net $12,080.00 » (le centre de contrôle la lit)', l.detail);
    V(!!l.bilan && egal(l.bilan, bilanAvant), 'le bilan ENTIER est dans la ligne (les 18 colonnes de entryToDb, identiques)', String(JSON.stringify(l.bilan)).slice(0, 120));
    V(l.bid === 'b-essai' && l.par === 'appareil A', 'son identifiant et qui l’a supprimé y sont aussi', JSON.stringify({ bid: l.bid, par: l.par }));
    V(Object.keys(l).filter((k) => !['ts', 'action', 'detail', 'bid', 'par', 'bilan'].includes(k)).length === 0, 'rien d’autre n’est ajouté à la ligne', Object.keys(l));
    V(W.envois.includes('DELETE b-essai'), 'la suppression part comme avant (deleteEntryAPI)', W.envois);
  }

  console.log('\n-- 2. la corbeille : journal + archives, moins ce qui est remis --');
  {
    const W = monde();
    if (W.api._corbeille) {
      const d = (id, ts) => Object.assign({}, ligneSuppr, { ts: ts, bid: id });
      const vieux = { ts: '2026-09-01T10:00:00.000Z', action: 'Suppression entrée', detail: '28 août 2026 · net $1,250.00' };   // une ligne d'avant : sans bilan
      const enArchive = Object.assign({}, ligneSuppr, { ts: '2026-04-02T09:00:00.000Z', bilan: Object.assign({}, bilanAvant, { date: '2026-03-31' }), detail: '31 mars 2026 · net $12,080.00' });
      const enMorceau = Object.assign({}, ligneSuppr, { ts: '2025-12-03T09:00:00.000Z', bilan: Object.assign({}, bilanAvant, { date: '2025-11-30' }), detail: '30 nov. 2025 · net $12,080.00' });
      W.api.editLog = [d('x1', '2026-10-16T08:00:00.000Z'), vieux, { ts: '2026-10-15T08:00:00.000Z', action: 'Note', detail: 'sur 01 oct. 2026' }];
      W.api.cache = { editlog_archive: JSON.stringify([enArchive]), editlog_archive_2025: JSON.stringify([enMorceau]) };
      let c = W.api._corbeille();
      V(c.length === 3, 'trois bilans : celui du journal, celui de l’archive, celui du morceau 2025 (la ligne d’avant, sans bilan, n’y est pas)', c.map((i) => i.e.date));
      V(c[0].e.date === '2026-09-30' && c[2].e.date === '2025-11-30', 'du plus récent au plus ancien', c.map((i) => i.e.date));
      V(c[0].e.profit === W.api.profitEntree(c[0].e) && c[0].e.profit === 7786.48, 'le bénéfice est celui que la page affiche (recalculé comme au chargement, au centime)', c[0].e.profit);
      const k = c[0].cle;
      W.api.editLog = [{ ts: '2026-10-16T09:00:00.000Z', action: 'Bilan remis', detail: '30 sept. 2026 · net $12,080.00 · profit $7,786.48', de: k }].concat(W.api.editLog);
      c = W.api._corbeille();
      V(c.length === 2 && !c.some((i) => i.cle === k), '« Bilan remis » le sort de la corbeille', c.map((i) => i.e.date));
      W.api.editLog = [{ ts: '2026-10-16T10:00:00.000Z', action: 'Remise annulée', detail: '30 sept. 2026 · net $12,080.00 · profit $7,786.48', de: k }].concat(W.api.editLog);
      c = W.api._corbeille();
      V(c.some((i) => i.cle === k), '« Remise annulée » (plus récente) l’y remet : rien ne se perd', c.map((i) => i.e.date));
      W.api.editLog = [d('x2', '2026-10-17T08:00:00.000Z'), { ts: '2026-10-16T11:00:00.000Z', action: 'Bilan remis', detail: '30 sept. 2026 · net $12,080.00 · profit $7,786.48', de: k }].concat(W.api.editLog);
      c = W.api._corbeille();
      V(c.filter((i) => i.e.date === '2026-09-30').length === 1 && c[0].l.ts === '2026-10-17T08:00:00.000Z', 'remis puis resupprimé : il revient (la nouvelle suppression), une seule fois', c.map((i) => i.l.ts));
      const archive = W.api.editLog.slice();
      W.api.editLog = [];
      c = W.api._corbeille();
      V(c.length === 3, 'une ligne sortie du journal pendant la session (archivée) reste dans la corbeille', c.length);
    }
    // le MÊME bilan supprimé sur deux appareils (le 2e ne savait pas encore) : une seule ligne ; deux versions : deux lignes
    const D = monde();
    if (D.api._corbeille) {
      const l1 = Object.assign({}, ligneSuppr, { ts: '2026-10-16T08:00:00.000Z', bid: 'b-meme', par: 'appareil A' });
      const l2 = Object.assign({}, ligneSuppr, { ts: '2026-10-16T08:05:00.000Z', bid: 'b-meme', par: 'appareil B' });
      D.api.editLog = [l2, l1];
      let c = D.api._corbeille();
      V(c.length === 1 && c[0].par === 'appareil B', 'le même bilan supprimé deux fois (deux appareils) : UNE ligne dans la corbeille', JSON.stringify(c.map((i) => i.par)));
      D.api.editLog = [{ ts: '2026-10-16T09:00:00.000Z', action: 'Bilan remis', detail: 'x', de: D.api._corbCle(l1) }, l2, l1];
      c = D.api._corbeille();
      V(c.length === 0, '… et remise une fois, elle quitte la corbeille (quelle que soit la ligne remise)', c.length);
      const l3 = Object.assign({}, l2, { ts: '2026-10-16T08:07:00.000Z', bilan: Object.assign({}, bilanAvant, { of_net: 11000, brut: 13750 }) });
      const D2 = monde();                     // (un monde neuf : la remise ci-dessus reste connue de la session, à raison)
      D2.api.editLog = [l3, l2, l1];
      c = D2.api._corbeille();
      V(c.length === 2, 'deux VERSIONS différentes du même bilan : deux lignes (rien n’est choisi à la place du propriétaire)', c.length);
      D.api.editLog = [l3];
      c = D.api._corbeille();
      V(c.length === 1 && c[0].l.ts === l3.ts, 'la version remise quitte la corbeille, l’autre version y reste', JSON.stringify(c.map((i) => i.l.ts)));
    }
  }

  console.log('\n-- 3. « Remettre ce bilan » : le chemin normal de création --');
  for (const cas of ['simple', 'doublon_annule', 'doublon_serveur_creer', 'lecture_seule', 'deja_remis']) {
    const W = monde({ lecture: cas === 'lecture_seule', doublon: cas === 'doublon_annule' ? { local: { date: '2026-09-30', profit: 1 } } : (cas === 'doublon_serveur_creer' ? { serveur: { date: '2026-09-30', profit: 1 } } : null),
                      choix: cas === 'doublon_serveur_creer' ? 'creer' : 'annuler' });
    if (!W.api.corbRemettre) { V(false, 'corbRemettre existe', 'absente'); break; }
    W.api.editLog = [Object.assign({}, ligneSuppr)];
    const k = W.api._corbeille()[0].cle;
    if (cas === 'deja_remis') W.api.editLog = [{ ts: new Date().toISOString(), action: 'Bilan remis', detail: 'x', de: k }].concat(W.api.editLog);
    const r = await W.api.corbRemettre(k);
    const posts = W.envois.filter((x) => x.indexOf('POST ') === 0);
    const remis = W.api.editLog.filter((l) => l.action === 'Bilan remis' && l.de === k && cas !== 'deja_remis');
    if (cas === 'simple') {
      V(W.rafraichi === 1, 'la base est relue d’abord', W.rafraichi);
      V(posts.length === 1 && egal(JSON.parse(posts[0].slice(5)), Object.assign({}, bilanAvant, { profit: 7786.48 })), 'UN envoi par saveEntry, avec les MÊMES colonnes que le bilan supprimé (profit = celui que la page affiche)', posts[0] && posts[0].slice(0, 160));
      V(remis.length === 1 && remis[0].detail === '30 sept. 2026 · net $12,080.00 · profit $7,786.48', 'la ligne « Bilan remis » (même forme de détail qu’un ajout) pointe la ligne de suppression', remis[0] && remis[0].detail);
      V(W.api.ents.length === 1 && W.api.ents[0].date === '2026-09-30' && !W.api.ents[0].id, 'il est dans les bilans de l’écran (l’identifiant viendra de la base)', JSON.stringify(W.api.ents.map((e) => e.date)));
      V(r === true && W.api._corbeille().length === 0, 'il quitte la corbeille', r);
    } else if (cas === 'doublon_annule') {
      V(W.dialogues.some((d) => d.doublon === '2026-09'), 'le mois a déjà un bilan : l’alerte du mois s’ouvre', JSON.stringify(W.dialogues));
      V(posts.length === 0 && remis.length === 0 && W.api._corbeille().length === 1, '« Annuler » : rien n’est envoyé, il reste dans la corbeille', posts.length);
    } else if (cas === 'doublon_serveur_creer') {
      V(W.dialogues.some((d) => d.doublon === '2026-09'), 'un bilan du mois créé AILLEURS (base relue) : l’alerte aussi', JSON.stringify(W.dialogues));
      V(posts.length === 1 && remis.length === 1, '« Remettre quand même » : il est créé', posts.length);
    } else if (cas === 'lecture_seule') {
      V(r === false && posts.length === 0 && W.api.editLog.length === 1 && W.rafraichi === 0, 'LECTURE SEULE : 0 envoi, 0 ligne de journal, rien relu', JSON.stringify({ r, posts: posts.length, lignes: W.api.editLog.length }));
      V(W.statut.some((t) => /Lecture seule/.test(t)), '… et c’est dit', W.statut);
    } else if (cas === 'deja_remis') {
      V(r === false && posts.length === 0, 'déjà remis (ici ou ailleurs) : 0 envoi', posts.length);
    }
  }

  console.log('\n-- 4. une sauvegarde par mois, gardée 12 mois --');
  {
    const W = monde({ reglages: {} });
    if (W.api.sauvegardeMoisSiNecessaire) {
      W.api.ents = [bilanInvente(W)];
      W.mois = '2026-10';
      await W.api.sauvegardeMoisSiNecessaire();
      V(egal(W.pousses, ['sauvegarde_mois_10', 'sauvegardes_mois']), 'la 1re ouverture d’octobre écrit l’emplacement d’octobre, puis l’index', W.pousses);
      const s = JSON.parse(W.reglages.sauvegarde_mois_10 || '{}');
      V(s.mois === '2026-10' && (s.ents || []).length === 1, 'la sauvegarde dit son mois et contient les bilans', JSON.stringify({ mois: s.mois, n: (s.ents || []).length }));
      W.pousses = []; await W.api.sauvegardeMoisSiNecessaire();
      V(W.pousses.length === 0, 'une 2e ouverture dans le mois n’écrit rien', W.pousses);
      W.api.cache = {}; W.pousses = []; await W.api.sauvegardeMoisSiNecessaire();
      V(W.pousses.length === 0, '… même si cet appareil ne l’avait pas vue (l’index est relu en base)', W.pousses);
      for (let m = 11; m <= 22; m++) { W.mois = (m <= 12 ? '2026-' : '2027-') + String(((m - 1) % 12) + 1).padStart(2, '0'); await W.api.sauvegardeMoisSiNecessaire(); }
      const cles = Object.keys(W.reglages).filter((k) => k.indexOf('sauvegarde_mois_') === 0).sort();
      V(cles.length === 12, '13 mois plus tard : 12 emplacements, jamais plus', cles.length);
      V(JSON.parse(W.reglages.sauvegarde_mois_10).mois === '2027-10' && JSON.parse(W.reglages.sauvegarde_mois_11).mois === '2026-11', 'octobre 2027 a remplacé octobre 2026 ; novembre 2026 est encore là (12 mois)', W.reglages.sauvegarde_mois_10.slice(0, 40));
    }
    const R = monde({ lecture: true });
    if (R.api.sauvegardeMoisSiNecessaire) { R.api.ents = [bilanInvente(R)]; R.mois = '2026-11'; await R.api.sauvegardeMoisSiNecessaire(); V(R.pousses.length === 0, 'lecture seule : rien n’est écrit', R.pousses); }
    const P = monde({ push_ok: false });
    if (P.api.sauvegardeMoisSiNecessaire) { P.api.ents = [bilanInvente(P)]; P.mois = '2026-11'; await P.api.sauvegardeMoisSiNecessaire(); V(!('sauvegardes_mois' in P.reglages), 'sauvegarde refusée par le serveur : l’index n’est pas écrit (elle sera refaite)', Object.keys(P.reglages)); }
    const C = monde({ reglages: {}, charge: false });
    if (C.api.sauvegardeMoisSiNecessaire) { C.api.ents = [bilanInvente(C)]; C.mois = '2026-11'; await C.api.sauvegardeMoisSiNecessaire(); V(C.pousses.length === 0, 'chiffres pas chargés : rien n’est écrit (jamais une sauvegarde d’une copie incomplète)', C.pousses); }
  }

  console.log('\n-- 5. la lecture du chargement n’emporte PAS les sauvegardes du mois --');
  {
    const af = essayer('apiFetch est extraite', () => extraire('apiFetch'));
    if (af) {
      const appels = [];
      const lignes = [{ key: 'editlog', value: '[]' }, { key: 'sauvegarde_mois_10', value: '{"ts":"x"}' }, { key: 'snapshot_1', value: '{}' }];
      const fauxSb = (refus) => ({ from: (t) => { const q = { f: [], select() { return q; }, order() { return q; },
        not(c, o, v) { q.f.push(['not', c, o, v]); return q; },
        then(ok, no) { appels.push(JSON.stringify(q.f)); const r = (refus && q.f.length) ? { data: null, error: { code: 'PGRST100', message: 'failed to parse filter' } }
          : { data: lignes.filter((l) => !q.f.some((x) => x[2] === 'like' && l.key.indexOf('sauvegarde_mois_') === 0)), error: null };
          return Promise.resolve(r).then(ok, no); } }; return q; } });
      for (const refus of [false, true]) {
        appels.length = 0;
        const g = new Function('sb', 'entryFromDb', 'entryToDb', 'vaFromDb', 'vaToDb', af + '; return apiFetch;')(fauxSb(refus), (x) => x, (x) => x, (x) => x, (x) => x);
        const o = await g('/api/settings');
        if (!refus) {
          V(appels[0] === JSON.stringify([['not', 'key', 'like', 'sauvegarde_mois_%']]), 'la lecture du chargement demande « key not like sauvegarde_mois_% »', appels[0]);
          V(!('sauvegarde_mois_10' in o) && 'editlog' in o && 'snapshot_1' in o, 'les sauvegardes du mois ne sont pas dans les réglages chargés ; le reste, si', Object.keys(o));
        } else {
          V(appels.length === 2 && appels[1] === '[]', 'si la base refusait le filtre : la lecture d’avant (tout)', appels);
          V(!('sauvegarde_mois_10' in o) && 'editlog' in o, '… et les sauvegardes du mois sont écartées quand même', Object.keys(o));
        }
      }
    }
  }

  console.log('\n-- 6. « Effacer tout l’historique » : la corbeille d’abord rangée dans l’archive --');
  {
    const W = monde();
    if (W.api._corbAvantEffacer) {
      W.api.editLog = [Object.assign({}, ligneSuppr), { ts: '2026-10-15T08:00:00.000Z', action: 'Note', detail: 'sur 01 oct. 2026' }];
      const r = await W.api._corbAvantEffacer();
      V(r === true && W.sauves.length === 1 && W.sauves[0].cle === 'editlog_archive' && W.sauves[0].n === 1, 'la ligne du bilan supprimé est écrite dans l’archive (et elle seule)', JSON.stringify(W.sauves.map((s) => [s.cle, s.n])));
      const K = monde(); K.archive_ko = true; K.api.editLog = [Object.assign({}, ligneSuppr)];
      const r2 = await K.api._corbAvantEffacer();
      V(r2 === false && K.statut.some((t) => /NON effacé/.test(t)), 'archive impossible (réseau) : l’historique N’EST PAS effacé, et c’est dit', K.statut);
      const L = monde({ lecture: true }); L.api.editLog = [Object.assign({}, ligneSuppr)];
      V((await L.api._corbAvantEffacer()) === true && L.sauves.length === 0, 'lecture seule : rien n’est écrit (comme avant)', L.sauves.length);
    }
    const ce = essayer('clearEditLog est extraite', () => extraire('clearEditLog'));
    V(!!ce && /_corbAvantEffacer\(\)\)\s*===\s*false\) return;/.test(ce) && ce.indexOf('_corbAvantEffacer') < ce.indexOf('editLog=[]'), 'clearEditLog range la corbeille AVANT de vider le journal', ce && ce.slice(0, 80));
  }

  console.log('\n-- 7. le contrôle sait échouer --');
  {
    // La forme d'AVANT : logEdit('Suppression entrée', `${dl(entry.date)} · net …`) sans le bilan.
    const avant = "logEdit('Suppression entrée', `${dl(entry.date)} · net ${fmt((entry.brut||0)*0.80+(entry.tgNet||0))}`);";
    V(!/_corbChamps\(entry\)/.test(avant), 'l’ancienne ligne de suppression ne gardait pas le bilan', 'si ce n’est plus vrai, ce banc ne surveille plus rien');
    V(/_corbChamps\(entry\)/.test(SRC), '… et la page actuelle, si');
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + ' (' + n + ' contrôles)\n');
  process.exit(ko ? 1 : 0);
})();
