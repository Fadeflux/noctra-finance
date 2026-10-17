// LES LISTES PARTAGÉES (paiements, journal, et toute liste rangée dans UNE ligne de `settings`) NE SE
// DÉTRUISENT PLUS D'UN APPAREIL À L'AUTRE. Prouvé sur le VRAI `_saveVirements` de index.html (la fonction
// générale d'écriture fusionnée), avec un faux serveur en mémoire. Aucune connexion.
//
// ⚠️ LES DÉFAUTS (15/10, agents/equipe_1510/donnees/trouvailles.md) :
//   D-3 un paiement SUPPRIMÉ par un appareil revenait dès que l'autre (ouvert avant) en notait un ;
//   D-5 le journal d'un appareil effaçait les lignes écrites par l'autre ;
//   D-6 deux paiements dans la même seconde : l'un manquait en base malgré deux « ✓ » ;
//   D-13 le journal était coupé à 200 lignes sans le dire, et chaque paiement relisait TOUTE la table.
//
//     node test_fusion_listes.js [autre/index.html]
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

let ko = 0, n = 0;
function V(cond, quoi, detail) {
  if (cond) { console.log('  OK  ' + quoi); n++; }
  else { ko++; console.log('  KO  ' + quoi + (detail ? '  -> ' + String(detail).slice(0, 300) : '')); }
}

// ── Faux monde : UNE base (objet), DEUX appareils (chacun ses globales), un journal des requêtes ─────────────
function nouveauServeur(init) {
  const S = { donnees: Object.assign({}, init || {}), lectures: [], ecritures: [], avantEcriture: null };
  S.fetch = async (url, o) => {
    if (!o || !o.method || o.method === 'GET') {
      const m = /[?&]cles=([^&]*)/.exec(url);
      const cles = m ? decodeURIComponent(m[1]).split(',') : Object.keys(S.donnees);
      S.lectures.push(cles.join(','));
      const r = {}; cles.forEach((k) => { if (k in S.donnees) r[k] = S.donnees[k]; }); return r;
    }
    const b = JSON.parse(o.body);
    if (S.avantEcriture) { const f = S.avantEcriture; S.avantEcriture = null; await f(b); }
    S.ecritures.push(b.key); S.donnees[b.key] = b.value; return { ok: true };
  };
  return S;
}
const CODE = [extraire('_cleVirement'), extraire('_saveVirements')].join('\n');
function appareil(serveur, etat) {
  // Chaque appareil = sa propre copie de la fonction (comme deux onglets / deux téléphones), ses propres listes.
  const g = { virements: etat.virements || [], _VIREMENTS_SUPPRIMES: new Set(etat.supprimes || []), _dirty: {}, lecture: !!etat.lecture,
              rendus: 0, journal: etat.journal || [] };
  const f = new Function('apiFetch', 'ecritureInterdite', 'renderModelShare', 'console', 'G',
    'var virements = G.virements, _VIREMENTS_SUPPRIMES = G._VIREMENTS_SUPPRIMES, _dirty = G._dirty, _currentUser = "Essai";\n' +
    // (témoin) l'ANCIENNE version écrivait par _pushSetting : on le fournit, pour qu'elle tourne et échoue sur le fond
    'function _pushSetting(key, val){ return apiFetch("/api/settings", { method: "POST", body: JSON.stringify({ key: key, value: JSON.stringify(val) }) }).then(function(){ return true; }, function(){ return false; }); }\n' + CODE +
    '\nreturn { ecrire: function(){ return _saveVirements.apply(null, arguments); }, lire: function(){ return virements; } };');
  const o = f((u, x) => serveur.fetch(u, x), () => g.lecture, () => { g.rendus++; }, { warn() {}, info() {} }, g);
  return Object.assign(g, o);
}
const lireL = (S, k) => JSON.parse(S.donnees[k] || '[]');
const P = (id, montant, date, note) => ({ id, date: date || '2026-10-0' + (montant % 9 + 1), amount: montant, note: note || '' });

(async () => {
  console.log('\n-- 1. D-3 : un paiement supprimé ne revient plus (pierre tombale partagée) --');
  {
    const S = nouveauServeur({ virements: JSON.stringify([P('a', 100), P('b', 3400, '2026-10-05', 'septembre')]) });
    const appA = appareil(S, { virements: [P('a', 100), P('b', 3400, '2026-10-05', 'septembre')] });
    const appB = appareil(S, { virements: [P('a', 100), P('b', 3400, '2026-10-05', 'septembre')] });   // ouverte AVANT
    appA.virements.splice(1, 1); appA._VIREMENTS_SUPPRIMES.add('b');
    V(await appA.ecrire() === true, 'l’appareil A supprime b : écrit et vérifié');
    appB.virements.push(P('c', 500));
    V(await appB.ecrire() === true, 'l’appareil B (liste périmée, avec b) note c : écrit et vérifié');
    const ids = lireL(S, 'virements').map((v) => v.id).sort().join(',');
    V(ids === 'a,c', 'en base : a et c, SANS b', ids);
    V(lireL(S, 'virements_supprimes').some((t) => t.k === 'b' && t.le && t.par), 'la pierre tombale de b est enregistrée (qui, quand)');
    V(appB.lire().map((v) => v.id).sort().join(',') === 'a,c', 'l’écran de l’appareil B est remis d’aplomb (b disparaît)', appB.lire().map((v) => v.id));
    V(appB.rendus >= 1, '… et redessiné');
  }

  console.log('\n-- 2. D-6 : deux paiements dans la même seconde, l’autre écrit ENTRE l’écriture et la vérification --');
  {
    const S = nouveauServeur({ virements: JSON.stringify([P('a', 100)]) });
    const appA = appareil(S, { virements: [P('a', 100)] });
    const appB = appareil(S, { virements: [P('a', 100)] });
    appA.virements.push(P('x', 111)); appB.virements.push(P('y', 222));
    // L’appareil B lit AVANT que l’appareil A écrive, et écrase sa liste juste après lui : le pire moment.
    let attente;
    const lu = new Promise((r) => { attente = r; });
    S.avantEcriture = async (b) => { if (b.key === 'virements') { await lu; } };
    const pA = appA.ecrire();
    await new Promise((r) => setImmediate(r));
    const pM = appB.ecrire();             // lit [a] (l’appareil A n'a pas encore écrit)
    await new Promise((r) => setTimeout(r, 5));
    attente();
    const [rA, rM] = await Promise.all([pA, pM]);
    V(rA === true && rM === true, 'chacun ne dit « ✓ » qu’après avoir VU son paiement en base', JSON.stringify([rA, rM]));
    // Le pire cas : l'écriture de l’appareil A arrive APRÈS la vérification de l’appareil B. Le « dernier regard » (2,5 s) le voit.
    await new Promise((r) => setTimeout(r, 3500));
    const ids = lireL(S, 'virements').map((v) => v.id).sort().join(',');
    V(ids === 'a,x,y', 'en base à la fin : x ET y (le dernier regard a remis celui qu’une écriture tardive avait recouvert)', ids);
  }

  console.log('\n-- 3. D-5 : le journal d’un appareil n’efface plus les lignes de l’autre ; « Effacer » tient --');
  {
    const L = (t, a) => ({ ts: '2026-10-15T1' + t + ':00:00.000Z', action: a, detail: '01 oct. 2026 · ' + a });
    const opts = (J) => ({ cleDe: (l) => l.ts + '|' + l.action + '|' + l.detail, dateDe: (l) => new Date(l.ts).getTime(),
      trier: (x, y) => new Date(y.ts) - new Date(x.ts), devant: true, limite: 200, marge: 25, archive: true, appliquer: (l) => { J.journal = l; } });
    const S = nouveauServeur({ editlog: JSON.stringify([L(0, 'Ajout entrée')]) });
    const appA = appareil(S, { journal: [L(0, 'Ajout entrée')] });
    const appB = appareil(S, { journal: [L(0, 'Ajout entrée')] });
    appA.journal.unshift(L(2, 'Modification entrée'));
    await appA.ecrire('editlog', () => appA.journal, opts(appA));
    appB.journal.unshift(L(3, 'Note'));
    await appB.ecrire('editlog', () => appB.journal, opts(appB));
    const acts = lireL(S, 'editlog').map((l) => l.action).join(' / ');
    V(acts === 'Note / Modification entrée / Ajout entrée', 'les lignes des DEUX appareils, du plus récent au plus ancien', acts);
    // L’appareil A efface l'historique (le repère « vidé » passe par l'état de la fonction, comme _journalVider) ;
    // L’appareil B (ouverte avant) ajoute une ligne : l'ancien ne revient pas
    await (async () => {
      const f = new Function('apiFetch', 'ecritureInterdite', 'renderModelShare', 'console', 'G',
        'var virements = G.virements, _VIREMENTS_SUPPRIMES = G._VIREMENTS_SUPPRIMES, _dirty = G._dirty, _currentUser = "Essai";\n' + CODE +
        '\n(_saveVirements._fil = {}).editlog = { p: null, ensuite: null, vide: "2026-10-15T14:00:00.000Z" };' +
        '\nreturn _saveVirements("editlog", function(){ return G.journal; }, G.opts);');
      await f((u, x) => S.fetch(u, x), () => false, () => {}, { warn() {} }, { virements: [], _VIREMENTS_SUPPRIMES: new Set(), _dirty: {}, journal: [], opts: opts({}) });
    })();
    V(lireL(S, 'editlog').length === 0, '« Effacer l’historique » : la base est vide', lireL(S, 'editlog').length);
    V(lireL(S, 'editlog_supprimes').some((t) => t.avant), '… et un repère partagé « tout ce qui est avant » est enregistré');
    appB.journal.unshift(L(5, 'Ajout paiement modele'));
    await appB.ecrire('editlog', () => appB.journal, opts(appB));
    const apres = lireL(S, 'editlog').map((l) => l.action).join(' / ');
    V(apres === 'Ajout paiement modele', 'l’appareil B (journal périmé) ajoute une ligne : SEULE la nouvelle arrive, rien d’effacé ne revient', apres);
  }

  console.log('\n-- 4. D-13 : au-delà de 225 lignes, les plus anciennes vont dans l’archive (rien ne se perd) --');
  {
    const opts = { cleDe: (l) => l.ts + '|' + l.action, dateDe: (l) => new Date(l.ts).getTime(), trier: (x, y) => new Date(y.ts) - new Date(x.ts),
      devant: true, limite: 200, marge: 25, archive: true, archiveMax: 3000 };
    const lignes = []; for (let i = 0; i < 260; i++) lignes.push({ ts: new Date(Date.UTC(2026, 8, 1) + i * 3600e3).toISOString(), action: 'L' + i, detail: '' });
    const S = nouveauServeur({});
    const a = appareil(S, {});
    V(await a.ecrire('editlog', lignes.slice().reverse(), opts) === true, '260 lignes écrites (vérifiées)');
    const vive = lireL(S, 'editlog'), arch = lireL(S, 'editlog_archive');
    V(vive.length === 200 && arch.length === 60, 'journal : 200 lignes ; archive : 60', vive.length + ' / ' + arch.length);
    V(arch.some((l) => l.action === 'L0') && vive[0].action === 'L259', 'la plus ancienne est dans l’archive, la plus récente en tête');
    V(new Set(vive.concat(arch).map((l) => l.action)).size === 260, 'aucune ligne perdue');
  }

  console.log('\n-- 5. seulement la clé utile est relue ; rien n’est écrit si rien ne change --');
  {
    const S = nouveauServeur({ virements: JSON.stringify([P('a', 100)]), snapshot_1: JSON.stringify({ gros: 'x'.repeat(30000) }) });
    const a = appareil(S, { virements: [P('a', 100)] });
    V(await a.ecrire() === true, 'rien de nouveau : rend true');
    V(S.ecritures.length === 0, 'aucune écriture', S.ecritures.join(','));
    V(S.lectures.every((l) => l === 'virements,virements_supprimes'), 'relu : virements + pierres tombales SEULEMENT (pas les sauvegardes)', S.lectures.join(' | '));
  }

  console.log('\n-- 6. cinq appels pendant une écriture n’en font qu’UNE de plus --');
  {
    const S = nouveauServeur({ virements: JSON.stringify([]) });
    const a = appareil(S, { virements: [] });
    a.virements.push(P('z', 7));
    const ps = [a.ecrire(), a.ecrire(), a.ecrire(), a.ecrire(), a.ecrire()];
    const rs = await Promise.all(ps);
    V(rs.every((r) => r === true), 'tous rendent true');
    V(S.ecritures.filter((k) => k === 'virements').length === 1, 'une seule écriture de la liste', S.ecritures.join(','));
  }

  console.log('\n-- 7. lecture seule et hors ligne : rien n’est écrit, rien n’est annoncé --');
  {
    const S = nouveauServeur({ virements: JSON.stringify([P('a', 100)]) });
    const ro = appareil(S, { virements: [P('a', 100), P('q', 9)], lecture: true });
    V(await ro.ecrire() === false && S.ecritures.length === 0, 'lecture seule : false, 0 écriture');
    const hl = appareil({ fetch: () => Promise.reject(new Error('hors ligne')) }, { virements: [P('a', 100), P('q', 9)] });
    V(await hl.ecrire() === false, 'hors ligne : false (rien d’écrasé à l’aveugle)');
  }

  console.log('\n-- 8. le contrôle sait échouer : l’ANCIENNE forme ressuscitait b --');
  {
    // L'ancienne fusion : (là-bas ∪ ici) − supprimé ICI. l’appareil B n'a rien supprimé ici : b revient.
    const serveur = [P('a', 100)], ici = [P('a', 100), P('b', 3400), P('c', 500)], supprIci = new Set();
    const vus = new Set(ici.map((v) => v.id));
    const ancienne = ici.concat(serveur.filter((v) => !vus.has(v.id) && !supprIci.has(v.id)));
    V(ancienne.some((v) => v.id === 'b'), 'l’ancienne forme remettait b en base (le banc mesure bien ce défaut)');
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
