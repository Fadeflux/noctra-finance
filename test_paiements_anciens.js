// DEUX PAIEMENTS ANCIENS IDENTIQUES NE FUSIONNENT PLUS, NE PARTENT PLUS ENSEMBLE (relecture du 16/10, R2).
// Prouvé sur le VRAI code de index.html (`_saveVirements`, `_cleVirement` et les fonctions des paiements anciens), avec
// un faux serveur en mémoire et DEUX appareils. Aucune connexion, données inventées, aucun identifiant de connexion.
//
// ⚠️ LE DÉFAUT : les paiements notés avant les identifiants (13/09) n'en ont pas ; ils étaient reconnus par
// « date|montant|note ». Deux paiements anciens identiques (même jour, même montant, même note) :
//   B1  au paiement suivant, la liste de la base était dédoublonnée avec elle-même : l'un DISPARAISSAIT (Déjà envoyé
//       −1 500 $, Reste à envoyer +1 500 $ : la modèle payée deux fois) ;
//   B1b en supprimer UN supprimait les DEUX (pierre tombale « date|montant|note »).
// La règle : un identifiant stable pour chaque paiement ancien (« L-… », le même sur tous les appareils), jamais de
// dédoublonnage par contenu ; une ancienne pierre tombale « date|montant|note » ne retire qu'UNE ligne, une seule fois.
//
//     node test_paiements_anciens.js [autre/index.html]      (sur final25.html : doit ÉCHOUER)
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
  else { ko++; console.log('  KO  ' + quoi + (detail !== undefined ? '  -> ' + String(detail).slice(0, 300) : '')); }
}

const AIDES = ['_virSig', '_virIds', '_virAncien', '_virVieilleCle', '_virAppliquerTombes', '_virClasser', '_tombesNoter', '_virTombe'];
const PRESENTES = AIDES.filter((x) => SRC.includes('function ' + x + '('));
const R2 = ['_virIds', '_virAppliquerTombes', '_virClasser'].every((x) => PRESENTES.includes(x));
const CODE = [extraire('_cleVirement'), extraire('_saveVirements')].concat(PRESENTES.map(extraire)).join('\n');

// ── Faux monde : UNE base, des appareils (chacun sa copie des fonctions, ses globales) ─────────────────────────────
function nouveauServeur(init) {
  const S = { donnees: {}, ecritures: [] };
  for (const k of Object.keys(init || {})) S.donnees[k] = JSON.stringify(init[k]);
  S.fetch = async (url, o) => {
    if (!o || !o.method || o.method === 'GET') {
      const m = /[?&]cles=([^&]*)/.exec(url);
      const cles = m ? decodeURIComponent(m[1]).split(',') : Object.keys(S.donnees);
      const r = {}; cles.forEach((k) => { if (k in S.donnees) r[k] = S.donnees[k]; }); return r;
    }
    const b = JSON.parse(o.body); S.ecritures.push(b.key); S.donnees[b.key] = b.value; return { ok: true };
  };
  return S;
}
const lireL = (S, k) => JSON.parse(S.donnees[k] || '[]');
function appareil(S) {
  const g = { virements: [], _VIREMENTS_SUPPRIMES: new Set(), _dirty: {}, _tombes: {} };
  const f = new Function('apiFetch', 'G',
    'var virements = G.virements, _VIREMENTS_SUPPRIMES = G._VIREMENTS_SUPPRIMES, _dirty = G._dirty, _tombes = G._tombes, _currentUser = "Essai";\n' +
    'function ecritureInterdite(){ return false; } function renderModelShare(){}\n' + CODE +
    '\nreturn { ecrire: function(){ return _saveVirements.apply(null, arguments); }, lire: function(){ return virements; },' +
    ' poser: function(l){ virements = l; }, F: { ' + ['_cleVirement'].concat(PRESENTES).map((x) => x + ': ' + x).join(', ') + ' } };');
  const o = f((u, x) => S.fetch(u, x), g);
  // le chargement de la page : la liste de la base (+ ses identifiants stables, s'ils existent), pierres tombales passées
  o.charger = () => {
    let l = lireL(S, 'virements'); const tl = lireL(S, 'virements_supprimes');
    if (o.F._virIds) l = o.F._virIds(l);
    if (o.F._virAppliquerTombes) l = o.F._virAppliquerTombes(l, tl).liste;
    else { const s = new Set(tl.filter((t) => t && t.k != null).map((t) => String(t.k)));      // la règle d'avant (_virTombe)
      l = l.filter((v) => !(s.has(String(o.F._cleVirement(v))) || s.has([v.date, v.amount, v.note || ''].join('|')))); }
    o.poser(l); return l;
  };
  // « Noter un paiement » et « Supprimer » : les mêmes gestes que addModelPayment / deleteModelPayment
  o.noter = (id, montant, date, note) => { o.lire().push({ id: id, date: date, amount: montant, note: note || '' }); return o.ecrire(); };
  o.supprimer = (v) => { const l = o.lire(); const i = l.indexOf(v); g._VIREMENTS_SUPPRIMES.add(o.F._cleVirement(v)); l.splice(i, 1); return o.ecrire(); };
  return o;
}
const somme = (l) => l.reduce((s, v) => s + (Number(v.amount) || 0), 0);
const n1500 = (l) => l.filter((v) => Number(v.amount) === 1500).length;
const ANCIEN = () => ({ date: '2026-09-01', amount: 1500, note: '' });          // paiement ancien : pas d'identifiant
const DEPART = () => [{ id: 'vfictif-a', date: '2026-08-05', amount: 2600, note: 'juillet' }, ANCIEN(), ANCIEN()];
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n-- 0. les fonctions des paiements anciens existent --');
  V(R2, '_virIds / _virAppliquerTombes / _virClasser présents dans la page', 'présentes : ' + PRESENTES.join(', '));

  console.log('\n-- 1. B1 : deux paiements anciens identiques, puis un paiement noté --');
  {
    const S = nouveauServeur({ virements: DEPART() });
    const A = appareil(S); A.charger();
    V(somme(A.lire()) === 5600, 'Déjà envoyé à l’ouverture : 5 600 $ (les deux 1 500 $ comptent)', somme(A.lire()));
    V((await A.noter('vfictif-n', 100, '2026-10-16', 'paiement fictif')) === true, 'le paiement de 100 $ est noté et vu en base');
    const b = lireL(S, 'virements');
    V(n1500(b) === 2, 'en base : les DEUX paiements de 1 500 $ sont toujours là', n1500(b) + ' paiement(s) de 1 500 $');
    V(somme(b) === 5700, 'Déjà envoyé en base : 5 700 $ (5 600 + 100)', somme(b));
    V(b.every((v) => v.id), 'les paiements anciens ont reçu leur identifiant en base (premier enregistrement)', JSON.stringify(b.map((v) => v.id)));
    V(new Set(b.map((v) => v.id)).size === b.length, 'aucun identifiant en double');
    const R = appareil(S); R.charger();
    V(somme(R.lire()) === 5700 && n1500(R.lire()) === 2, 'rechargé : 5 700 $, deux 1 500 $', somme(R.lire()));
  }

  console.log('\n-- 2. B1b : supprimer UN des deux paiements anciens identiques --');
  {
    const S = nouveauServeur({ virements: DEPART() });
    const A = appareil(S); A.charger();
    const un = A.lire().find((v) => Number(v.amount) === 1500);
    V((await A.supprimer(un)) === true, 'suppression écrite et vérifiée');
    const b = lireL(S, 'virements');
    V(n1500(b) === 1, 'en base : il en reste UN (pas zéro)', n1500(b) + ' paiement(s) de 1 500 $');
    V(somme(b) === 4100, 'Déjà envoyé : 5 600 − 1 500 = 4 100 $', somme(b));
    const t = lireL(S, 'virements_supprimes');
    V(t.length === 1 && String(t[0].k).slice(0, 2) === 'L-', 'la pierre tombale vise UN identifiant (« L-… »), pas « date|montant|note »', JSON.stringify(t.map((x) => x.k)));
    const R = appareil(S); R.charger();
    V(n1500(R.lire()) === 1 && somme(R.lire()) === 4100, 'rechargé : un 1 500 $, 4 100 $', somme(R.lire()));
  }

  console.log('\n-- 3. DEUX appareils ouverts sur les mêmes paiements anciens --');
  {
    const S = nouveauServeur({ virements: DEPART() });
    const A = appareil(S), B = appareil(S); A.charger(); B.charger();
    if (R2) V(JSON.stringify(A.lire().map((v) => v.id)) === JSON.stringify(B.lire().map((v) => v.id)), 'les deux appareils calculent les MÊMES identifiants', JSON.stringify([A.lire().map((v) => v.id), B.lire().map((v) => v.id)]));
    await A.noter('vfictif-n1', 100, '2026-10-16', 'A');
    await B.noter('vfictif-n2', 200, '2026-10-16', 'B');      // B a été ouvert AVANT l'écriture de A
    let b = lireL(S, 'virements');
    V(n1500(b) === 2 && somme(b) === 5900, 'A puis B notent un paiement : deux 1 500 $, 5 900 $ en base', n1500(b) + ' / ' + somme(b));
    const unA = A.lire().find((v) => Number(v.amount) === 1500);
    await A.supprimer(unA);                                  // A supprime UN 1 500 $
    await B.noter('vfictif-n3', 300, '2026-10-17', 'B');     // B (liste périmée : deux 1 500 $) note un paiement
    b = lireL(S, 'virements');
    V(n1500(b) === 1, 'B (périmé) note un paiement : le 1 500 $ supprimé par A ne revient PAS, l’autre reste', n1500(b));
    V(somme(b) === 4700, 'en base : 2 600 + 1 500 + 100 + 200 + 300 = 4 700 $', somme(b));
    V(n1500(B.lire()) === 1, 'l’écran de B est remis d’aplomb (un seul 1 500 $)', n1500(B.lire()));
    const A2 = appareil(S), B2 = appareil(S); A2.charger(); B2.charger();
    V(somme(A2.lire()) === 4700 && somme(B2.lire()) === 4700, 'rechargés : les deux appareils disent 4 700 $', somme(A2.lire()) + ' / ' + somme(B2.lire()));
    await attendre(2800);                                    // le « dernier regard » 2,5 s plus tard ne change rien
    b = lireL(S, 'virements');
    V(n1500(b) === 1 && somme(b) === 4700, 'après le dernier regard (2,5 s) : toujours 4 700 $', somme(b));
  }

  console.log('\n-- 4. une ANCIENNE pierre tombale « date|montant|note » (écrite avant) ne retire qu’UNE ligne, une seule fois --');
  {
    // suppression d'avant à moitié faite : la pierre tombale est écrite, la liste pas encore (coupure entre les deux)
    const S = nouveauServeur({ virements: DEPART(), virements_supprimes: [{ k: '2026-09-01|1500|', le: '2026-10-15T20:00:00.000Z', par: 'Essai' }] });
    const A = appareil(S), B = appareil(S); A.charger(); B.charger();
    V(n1500(A.lire()) === 1 && somme(A.lire()) === 4100, 'à l’ouverture : un 1 500 $ est déjà retiré (pas les deux)', n1500(A.lire()) + ' / ' + somme(A.lire()));
    await A.noter('vfictif-n', 100, '2026-10-16', 'A');
    let b = lireL(S, 'virements');
    V(n1500(b) === 1 && somme(b) === 4200, 'A note 100 $ : il reste UN 1 500 $ en base (4 200 $)', n1500(b) + ' / ' + somme(b));
    const t = lireL(S, 'virements_supprimes');
    V(t.some((x) => x.k === '2026-09-01|1500|' && x.ok) && t.some((x) => String(x.k).slice(0, 2) === 'L-'), 'l’ancienne pierre tombale est attribuée (ok) + celle de l’identifiant', JSON.stringify(t));
    await B.noter('vfictif-m', 50, '2026-10-17', 'B');      // B (périmé) écrit à son tour
    await A.noter('vfictif-o', 10, '2026-10-18', 'A');      // et A encore : la pierre tombale ne frappe pas une 2e fois
    b = lireL(S, 'virements');
    V(n1500(b) === 1 && somme(b) === 4260, 'deux enregistrements de plus : toujours UN 1 500 $ (aucune cascade)', n1500(b) + ' / ' + somme(b));
  }

  console.log('\n-- 5. ancienne pierre tombale sans ligne en base : une copie périmée ne remet pas ce paiement --');
  {
    // (la suppression d'avant a déjà retiré la ligne de la base) ; B a gardé la liste d'avant en mémoire
    const S = nouveauServeur({ virements: [{ id: 'vfictif-a', date: '2026-08-05', amount: 2600, note: 'juillet' }, ANCIEN()] });
    const B = appareil(S); B.charger();
    S.donnees.virements = JSON.stringify([{ id: 'vfictif-a', date: '2026-08-05', amount: 2600, note: 'juillet' }]);
    S.donnees.virements_supprimes = JSON.stringify([{ k: '2026-09-01|1500|', le: '2026-10-15T20:00:00.000Z', par: 'Essai' }]);
    await B.noter('vfictif-n', 100, '2026-10-16', 'B');
    const b = lireL(S, 'virements');
    V(n1500(b) === 0 && somme(b) === 2700, 'le paiement supprimé avant ne revient pas (2 700 $)', n1500(b) + ' / ' + somme(b));
  }

  console.log('\n-- 6. une ancienne version encore ouverte remet sa copie SANS identifiant : reconnue, pas doublée --');
  if (R2) {
    const S = nouveauServeur({ virements: DEPART() });
    const A = appareil(S); A.charger();
    await A.noter('vfictif-n', 100, '2026-10-16', 'A');     // les identifiants sont maintenant en base
    const b0 = lireL(S, 'virements');
    S.donnees.virements = JSON.stringify(b0.concat([ANCIEN()]));   // ce que pousserait une version d'avant (copie sans identifiant)
    const B = appareil(S); B.charger();
    V(n1500(B.lire()) === 2 && somme(B.lire()) === 5700, 'à l’ouverture : la copie est reconnue (deux 1 500 $, pas trois)', n1500(B.lire()) + ' / ' + somme(B.lire()));
    await B.noter('vfictif-m', 50, '2026-10-17', 'B');
    const b = lireL(S, 'virements');
    V(n1500(b) === 2 && somme(b) === 5750, 'au prochain enregistrement, la base est nettoyée (deux 1 500 $, 5 750 $)', n1500(b) + ' / ' + somme(b));
  } else V(false, 'une ancienne version remet sa copie : non mesurable (fonctions absentes)');

  console.log('\n-- 7. données SANS doublon : rien ne bouge (montants identiques, identifiants ajoutés) --');
  {
    const L0 = [{ date: '2026-05-05', amount: 900, note: 'avril', id: 'vfictif00' }, { date: '2026-06-04', amount: 1500, note: 'mai' },
      { date: '2026-07-06', amount: 2100, note: 'juin', id: 'vfictif02' }, { date: '2026-08-05', amount: 2600, note: 'juillet' },
      { date: '2026-09-04', amount: 3100, note: 'aout', id: 'vfictif04' }, { date: '2026-10-05', amount: 3400, note: 'septembre' }];
    const S = nouveauServeur({ virements: L0 });
    const A = appareil(S); A.charger();
    V(somme(A.lire()) === somme(L0) && A.lire().length === 6, 'à l’ouverture : 6 paiements, ' + somme(L0) + ' $', somme(A.lire()));
    await A.noter('vfictif-n', 250, '2026-10-16', 'A');
    const b = lireL(S, 'virements');
    V(b.length === 7 && somme(b) === somme(L0) + 250, 'après un paiement : 7 paiements, ' + (somme(L0) + 250) + ' $', b.length + ' / ' + somme(b));
    const sans = (v) => ({ date: v.date, amount: v.amount, note: v.note });
    V(JSON.stringify(b.slice(0, 6).map(sans)) === JSON.stringify(L0.map(sans)), 'les 6 paiements d’avant : mêmes dates, montants, notes, même ordre');
    V(['vfictif00', 'vfictif02', 'vfictif04'].every((id) => b.some((v) => v.id === id)), 'les identifiants existants ne changent pas');
    const A2 = appareil(S); A2.charger();
    const avant = JSON.stringify(lireL(S, 'virements'));
    await A2.ecrire();
    V(JSON.stringify(lireL(S, 'virements')) === avant, 'un enregistrement sans changement n’écrit plus rien (identifiants déjà là)');
  }

  console.log('\n-- 8. restaurer une copie : les paiements anciens identiques se COMPTENT --');
  if (R2) {
    const F = appareil(nouveauServeur({})).F;
    const copie = F._virIds(DEPART());                          // copie de secours d'avant : deux 1 500 $
    const base = F._virIds(DEPART().slice(0, 2));                // la base n'en a plus qu'un (perdu par B1)
    const c = F._virClasser(copie, base, []);
    V(c.absents.length === 1 && Number(c.absents[0].amount) === 1500, 'copie 2 × 1 500 $, base 1 × : UN paiement absent proposé (case cochée)', JSON.stringify(c.absents));
    V(c.communs.length === 2 && c.supprimes.length === 0, '… les deux autres sont en commun, aucun « supprimé »');
    const c2 = F._virClasser(copie, base, [{ k: 'L-2026-09-01|1500|#2', le: '2026-10-16T10:00:00.000Z', par: 'Essai' }]);
    V(c2.absents.length === 0 && c2.supprimes.length === 1, 'le 2e a été supprimé exprès (pierre tombale) : « supprimé », case décochée', JSON.stringify([c2.absents.length, c2.supprimes.length]));
    const c3 = F._virClasser(copie, F._virIds(DEPART()), []);
    V(c3.absents.length === 0 && c3.supprimes.length === 0 && c3.communs.length === 3, 'copie identique à la base : rien à restaurer');
    const vieux = F._virClasser(copie, F._virIds([DEPART()[0]]), [{ k: '2026-09-01|1500|', le: '2026-10-15T20:00:00.000Z', par: 'Essai' }]);
    V(vieux.supprimes.length === 1 && vieux.absents.length === 1, 'base sans 1 500 $ + UNE ancienne pierre tombale : 1 supprimé, 1 absent (pas 2 supprimés)', JSON.stringify([vieux.supprimes.length, vieux.absents.length]));
    // la règle d'avant (par date|montant|note) : le paiement perdu passait pour « présent »
    const sig = (o) => [o.date, Number(o.amount) || 0, String(o.note || '').trim()].join('|');
    const srv = new Set(DEPART().slice(0, 2).map(sig));
    V(DEPART().filter((v) => !srv.has(sig(v))).length === 0, '(témoin) la règle d’avant ne voyait AUCUN paiement absent : le banc mesure bien ce défaut');
  } else V(false, 'restaurer une copie : _virClasser absente');

  console.log('\n-- 9. identifiants stables : même liste = mêmes identifiants, le rang ne compte que les lignes sans identifiant --');
  if (R2) {
    const F = appareil(nouveauServeur({})).F;
    const a = F._virIds(DEPART()), b = F._virIds(JSON.parse(JSON.stringify(DEPART())));
    V(JSON.stringify(a) === JSON.stringify(b), 'deux lectures de la même liste : mêmes identifiants');
    V(a[1].id === 'L-2026-09-01|1500|#1' && a[2].id === 'L-2026-09-01|1500|#2', '« L- » + date|montant|note + « # » + rang', a[1].id + ' / ' + a[2].id);
    const m = F._virIds([a[1], ANCIEN()]);
    V(m[1].id === 'L-2026-09-01|1500|#1', 'une copie sans identifiant à côté d’une ligne déjà identifiée retombe sur #1 (reconnue)', m[1].id);
    V(F._virVieilleCle('2026-09-01|1500|') && !F._virVieilleCle('L-2026-09-01|1500|#1') && !F._virVieilleCle('vabc123'), 'ancienne pierre tombale reconnue (et seulement elle)');
  } else V(false, 'identifiants stables : _virIds absente');

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE (' + n + ' contrôles)') + '\n');
  process.exit(ko ? 1 : 0);
})();
