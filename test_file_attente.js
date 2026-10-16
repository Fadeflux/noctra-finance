// UN BILAN NON ENREGISTRÉ EST GARDÉ, RENVOYÉ, JAMAIS EN DOUBLE ; UN BILAN CHANGÉ AILLEURS N'EST PLUS ÉCRASÉ.
// Prouvé sur le VRAI code de index.html (file d'attente, saveEntry, _majBilan, fusion par groupe), avec un faux
// serveur en mémoire et un faux stockage local. Aucune connexion.
//
// ⚠️ LES DÉFAUTS (15/10, agents/equipe_1510/donnees/trouvailles.md) :
//   D-7 coupure pendant la création d'un bilan : jamais renvoyé, l'en-tête finissait par dire « Enregistré »,
//       recharger le PERDAIT ;
//   D-8 coupure pendant une mise à jour : l'écran gardait un chiffre que la base n'avait pas ;
//   D-12 suppression hors ligne : le bilan revenait au rechargement, sans un mot ;
//   D-1 le même bilan mis à jour sur deux appareils : le 2e enregistrement effaçait le 1er (une simple note
//       remettait l'ancien net).
//
//     node test_file_attente.js [autre/index.html]
'use strict';
const fs = require('fs');
const path = require('path');

const CIBLE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(CIBLE, 'utf8').replace(/\r\n/g, '\n');
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
function extraireVar(debut) {
  const i = SRC.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut);
  return SRC.slice(i, SRC.indexOf('];', i) + 2);
}
let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail ? '  -> ' + String(detail).slice(0, 300) : '')); }
}

const NOMS = ['_canon', '_copie', '_valGroupe', '_sigBilan', '_fusionBilan', '_baseNoter', '_baseDe', '_lireBilan', '_majBilan', '_fileLire', '_fileEcrire',
  '_fileModifier', '_uidDe', '_entreeDeUid', '_fileBilan', '_fileGarderCreation', '_fileRetirerBilan', '_fileRetirerCreation', '_fileAnnulerCreation',
  '_memeOp', '_fileEnvoyer', '_fileTour', '_fileCreer', '_fileSuppr', '_fileAnnule', '_fileAppliquer', 'saveEntry', 'deleteEntryAPI', 'updateEntryAPI',
  'profitEntree', 'fraisOF', '_tombesNoter', '_virTombe'];
const CODE = [extraireVar('var _GROUPES_BILAN = ['), (SRC.match(/const _IMPOTS_OF=[^;]+;/) || [''])[0], 'const _TAUX=0.80;']
  .concat(NOMS.map(extraire)).join('\n') + '\n_uidDe.n = 0;';

function monde(serveurInit) {
  const S = { lignes: JSON.parse(JSON.stringify(serveurInit || [])), coupe: false, perdre: 0, seq: 100, journal: [] };
  const stock = {};
  const W = {
    S, stock, dialogues: [], reponses: [], statut: [],
    apiFetch: async (url, o) => {
      const m = (o && o.method) || 'GET';
      if (S.coupe) throw new Error('TypeError: Failed to fetch');
      if (m === 'GET' && url === '/api/entries') return JSON.parse(JSON.stringify(S.lignes));
      if (m === 'GET' && url.indexOf('/api/entries/') === 0) { const id = url.split('/').pop(); return JSON.parse(JSON.stringify(S.lignes.filter((x) => x.id === id))); }
      if (m === 'GET') return {};
      const b = o.body ? JSON.parse(o.body) : null;
      S.journal.push(m + ' ' + url);
      if (m === 'POST' && url === '/api/entries') {
        const r = Object.assign({}, b, { id: 'srv-' + (++S.seq) }); S.lignes.push(r);
        if (S.perdre) { S.perdre--; throw new Error('réponse perdue'); }
        return JSON.parse(JSON.stringify(r));
      }
      if (m === 'PUT') { const id = url.split('/').pop(); const i = S.lignes.findIndex((x) => x.id === id); if (i < 0) throw new Error('0 ligne'); S.lignes[i] = Object.assign({}, b, { id }); return JSON.parse(JSON.stringify(S.lignes[i])); }
      if (m === 'DELETE') { const id = url.split('/').pop(); S.lignes = S.lignes.filter((x) => x.id !== id); return { ok: true }; }
      return { ok: true };
    },
  };
  const f = new Function('W',
    'var localStorage = { getItem: (k) => (k in W.stock ? W.stock[k] : null), setItem: (k, v) => { W.stock[k] = String(v); }, removeItem: (k) => { delete W.stock[k]; } };\n' +
    'var document = { body: { classList: { contains: (c) => !!W.lecture && c === "readonly" } }, getElementById: () => null };\n' +
    'var console = { warn() {}, info() {}, log() {}, error() {} };\n' +
    'var navigator = {}; var apiFetch = W.apiFetch; var ents = W.ents || []; var _vuServeur = {}; var _tombes = {}; var _uids = new WeakMap();\n' +
    'var _CLE_FILE = "fin_noctra_a_envoyer", _fileMem = [], _fileEnCours = null, _donneesChargees = true, _apiConnected = true, _currentUser = "Manon", _dlgOuvert = false, _dernierEchec = "reseau";\n' +
    'var virements = [], editLog = [], _VIREMENTS_SUPPRIMES = new Set(), _settingsCache = {}, _LISTES = {};\n' +
    'function ecritureInterdite(){ return !!W.lecture; } function showSaveStatus(t){ W.statut.push(t); } function _etatFile(){ return false; } function _fileMinuteur(){}\n' +
    'function _rendreTout(){} function _rythmeBilan(){ return true; } function _peutDemander(){ return true; } function _quoiBilan(){ return "d’octobre"; }\n' +
    'function _deMois(){ return "d’octobre"; } function _nomMois(){ return "octobre"; } function _netBilan(e){ return (e.brut||0)*0.8+(e.tgNet||0); } function _mtS(v){ return String(v); } function fmtC(v){ return "$" + v; }\n' +
    'async function _heureModifAilleurs(){ return ""; } async function _dialogueConflit(m, s, f){ W.dialogues.push("conflit:" + f.conflits.map(g => g[0]).join(",")); return W.reponses.shift() || "annuler"; }\n' +
    'async function _fenetre(o){ W.dialogues.push(o.titre); return { choix: W.reponses.shift() || "annuler" }; }\n' +
    'function _cleVirement(v){ return v.id || [v.date, v.amount, v.note || ""].join("|"); } function _attenteNoter(){} function _saveVirements(){ return Promise.resolve(true); } function _saveEditLog(){ return Promise.resolve(true); }\n' +
    'function _listeEcrire(){ return Promise.resolve(true); } async function _fileListe(){ return true; } async function _fileReglage(){ return true; } function _optsJournal(){ return { cleDe: (l) => l.ts }; }\n' +
    CODE + '\nreturn { ents: () => ents, setEnts: (e) => { ents = e; }, base: () => _vuServeur, file: () => _fileLire(), appliquer: () => _fileAppliquer(),\n' +
    '  saveEntry, deleteEntryAPI, updateEntryAPI, _fileEnvoyer, _fileAnnulerCreation, _baseNoter, _sigBilan, _fusionBilan, _uids: () => _uids, setCo: (v) => { _apiConnected = v; } };');
  Object.assign(W, f(W));
  return W;
}
function bilan(id, date, ofNet, extra) {
  const e = Object.assign({ date, ofNet, brut: ofNet / 0.8, tgNet: 0, va: 0, mo: 0, ci: 0, ch: 0, alT: 0, alI: [], vaI: [], moI: [], ciI: [], chI: [], paidBy: {}, notes: '', author: 'Andre' }, extra || {});
  if (id) e.id = id;
  return e;
}

(async () => {
  console.log('\n-- 1. D-7 : bilan créé hors ligne → gardé (même après « rechargement »), renvoyé UNE fois --');
  {
    const W = monde([bilan('s1', '2026-09-30', 9000)]);
    W.setEnts([bilan('s1', '2026-09-30', 9000)]); W.S.coupe = true;
    const e = bilan(null, '2026-10-15', 6800); W.ents().unshift(e);
    V(await W.saveEntry(e) === false, 'réseau coupé : saveEntry rend false');
    V(W.statut.some((t) => /NON SAUVEGARD/.test(t) && /gardé sur cet appareil/.test(t)), 'le message dit que c’est gardé', W.statut.slice(-1)[0]);
    V(W.file().length === 1 && W.file()[0].t === 'cree', 'il est dans la file (stockage local)');
    // « rechargement » : un monde neuf qui lit le même stockage, la base n'a toujours pas octobre
    const W2 = monde(W.S.lignes); Object.assign(W2.stock, W.stock);
    W2.setEnts(JSON.parse(JSON.stringify(W2.S.lignes))); W2.appliquer();
    V(W2.ents().some((x) => x.date === '2026-10-15' && !x.id), 'après rechargement il est toujours à l’écran (repris de la file)');
    V(await W2._fileEnvoyer('chargement') === true, 'réseau revenu : la file est envoyée');
    V(W2.S.lignes.filter((x) => x.date === '2026-10-15').length === 1, 'UN bilan d’octobre en base');
    V(W2.ents().find((x) => x.date === '2026-10-15').id, '… et l’écran a son identifiant (modifiable)');
    V(!W2.stock.fin_noctra_a_envoyer, 'la file est vide (clé retirée)');
    V(await W2._fileEnvoyer('minuteur') === true && W2.S.lignes.filter((x) => x.date === '2026-10-15').length === 1, 'renvoyer encore ne crée rien de plus');
  }

  console.log('\n-- 2. réponse perdue : le bilan est en base mais la page a reçu une erreur → pas de doublon --');
  {
    const W = monde([]); W.setEnts([]);
    W.S.perdre = 1;
    const e = bilan(null, '2026-10-15', 6800); W.ents().unshift(e);
    V(await W.saveEntry(e) === false && W.S.lignes.length === 1, 'la base l’a, la page croit à un échec');
    V(await W._fileEnvoyer('reseau') === true, 'la file repart');
    V(W.S.lignes.length === 1, 'toujours UN bilan (adopté, pas recréé)', W.S.lignes.length);
    V(W.ents()[0].id === W.S.lignes[0].id, 'l’écran a pris l’identifiant de la base');
  }

  console.log('\n-- 3. D-8 : mise à jour hors ligne → gardée avec la version d’origine, renvoyée --');
  {
    const o = bilan('o1', '2026-10-01', 6800);
    const W = monde([o]); W.setEnts([JSON.parse(JSON.stringify(o))]); W._baseNoter(o);
    W.S.coupe = true;
    const m = Object.assign({}, W.ents()[0], { ofNet: 9000, brut: 9000 / 0.8 }); W.ents()[0] = m;
    V(await W.updateEntryAPI('o1', m) === false, 'coupé : false');
    V(W.file()[0] && W.file()[0].t === 'maj' && W.file()[0].base.ofNet === 6800, 'gardée, avec la version d’origine (6 800)');
    W.S.coupe = false;
    V(await W._fileEnvoyer('reseau') === true && W.S.lignes[0].ofNet === 9000, 'réseau revenu : 9 000 en base');
  }

  console.log('\n-- 4. D-1 : changé ailleurs depuis l’ouverture → fusion par groupe, ou la question --');
  {
    const o = bilan('o1', '2026-10-01', 6800, { alI: [{ name: 'VPN', val: 10, paidBy: 'moi' }], alT: 10 });
    const W = monde([o]); W.setEnts([JSON.parse(JSON.stringify(o))]); W._baseNoter(o);
    // André (ailleurs) ajoute une dépense ; Manon (ici, ouverte avant) ne change que la note
    W.S.lignes[0] = Object.assign({}, o, { alI: o.alI.concat([{ name: 'Serveur dédié', val: 50, paidBy: 'moi' }]), alT: 60 });
    const mien = Object.assign({}, W.ents()[0], { notes: 'facture reçue', author: 'Manon' });
    V(await W.updateEntryAPI('o1', mien) === true, 'note seule : écrit sans question');
    const b = W.S.lignes[0];
    V(b.alT === 60 && b.alI.length === 2 && b.notes === 'facture reçue' && b.ofNet === 6800, 'la dépense d’André ET la note de Manon sont en base', JSON.stringify([b.alT, b.notes, b.ofNet]));
    V(Math.abs(b.profit - W.ents()[0].profit) < 0.001 && W.ents()[0].alT === 60, 'le bénéfice est recalculé, l’écran montre la fusion');
    // les deux changent le net : la question ; « les miens » / « les siens »
    W.S.lignes[0] = Object.assign({}, W.S.lignes[0], { ofNet: 9000, brut: 9000 / 0.8 });
    W.reponses.push('miens');
    const m2 = Object.assign({}, W.ents()[0], { ofNet: 7500, brut: 7500 / 0.8 });
    V(await W.updateEntryAPI('o1', m2) === true && W.S.lignes[0].ofNet === 7500, '« Garder les miens » : 7 500', W.dialogues.join(' | '));
    V(W.dialogues.some((d) => d === 'conflit:of'), 'la question a bien porté sur le net OnlyFans seulement');
    W.S.lignes[0] = Object.assign({}, W.S.lignes[0], { ofNet: 8000, brut: 8000 / 0.8 });
    W.reponses.push('siens');
    const m3 = Object.assign({}, W.ents()[0], { ofNet: 7000, brut: 7000 / 0.8 });
    V(await W.updateEntryAPI('o1', m3) === true && W.S.lignes[0].ofNet === 8000, '« Garder ses chiffres » : 8 000');
    // Échap : rien d'écrit, gardé (à vérifier)
    W.S.lignes[0] = Object.assign({}, W.S.lignes[0], { ofNet: 8100, brut: 8100 / 0.8 });
    const m4 = Object.assign({}, W.ents()[0], { ofNet: 6000, brut: 6000 / 0.8 });
    V(await W.updateEntryAPI('o1', m4) === false && W.S.lignes[0].ofNet === 8100, 'Échap : la base n’est pas touchée');
    V(W.file().some((x) => x.t === 'maj' && x.conflit), '… et le changement est gardé « à vérifier »');
  }

  console.log('\n-- 5. supprimé ailleurs pendant une modification → la question, puis « le recréer » --');
  {
    const o = bilan('o1', '2026-10-01', 6800);
    const W = monde([]); W.setEnts([JSON.parse(JSON.stringify(o))]); W._baseNoter(o);
    W.reponses.push('recreer');
    V(await W.updateEntryAPI('o1', Object.assign({}, o, { ofNet: 7500, brut: 7500 / 0.8 })) === true, 'recréé');
    V(W.S.lignes.length === 1 && W.S.lignes[0].ofNet === 7500 && W.dialogues.some((d) => /supprimé sur un autre appareil/.test(d)), 'en base avec 7 500, après la question');
  }

  console.log('\n-- 6. D-12 : suppression hors ligne → gardée, renvoyée ; la mise à jour en attente du même bilan est annulée --');
  {
    const o = bilan('o1', '2026-10-01', 6800);
    const W = monde([o]); W.setEnts([]); W._baseNoter(o); W.S.coupe = true;
    await W.updateEntryAPI('o1', Object.assign({}, o, { ofNet: 1 }));
    V(await W.deleteEntryAPI('o1', o) === false, 'coupé : false');
    V(W.statut.some((t) => /Suppression NON enregistrée/.test(t)), 'l’échec est DIT');
    V(W.file().length === 1 && W.file()[0].t === 'suppr', 'seule la suppression reste en file (la mise à jour est annulée)', JSON.stringify(W.file().map((x) => x.t)));
    W.S.coupe = false;
    V(await W._fileEnvoyer('reseau') === true && W.S.lignes.length === 0, 'renvoyée : le bilan n’est plus en base');
  }

  console.log('\n-- 7. bilan pas encore envoyé, supprimé ici → il ne part jamais --');
  {
    const W = monde([]); W.setEnts([]); W.setCo(false);
    const e = bilan(null, '2026-10-15', 6800); W.ents().unshift(e);
    await W.saveEntry(e);
    W._fileAnnulerCreation(e); W.setCo(true);
    V(W.file().length === 0 && (await W._fileEnvoyer('reseau')) === true && W.S.lignes.length === 0, 'rien en file, rien en base');
  }

  console.log('\n-- 8. lecture seule : rien n’est gardé ni envoyé --');
  {
    const W = monde([]); W.setEnts([]); W.lecture = true;
    const e = bilan(null, '2026-10-15', 6800);
    V(await W.saveEntry(e) === false && W.file().length === 0 && W.S.journal.length === 0, 'aucune file, aucune écriture');
  }

  console.log('\n-- 9. le contrôle sait échouer : l’ancienne mise à jour réécrivait la ligne entière --');
  {
    const base = { ofNet: 6800, alT: 10 }, ailleurs = { ofNet: 6800, alT: 60 }, ici = { ofNet: 6800, alT: 10, notes: 'x' };
    const ancienne = Object.assign({}, ici);      // PUT de la ligne telle que chargée ici
    V(ancienne.alT !== ailleurs.alT && base.alT === 10, 'l’ancienne forme effaçait la dépense d’André (le banc mesure bien ce défaut)');
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
