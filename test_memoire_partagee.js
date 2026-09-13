// CE SITE NE SE MÉLANGE PLUS AVEC UN AUTRE DANS LE NAVIGATEUR.
//
// ⚠️ LE DÉFAUT (13/09). Plusieurs sites sont servis par la MÊME adresse
// (fadeflux.github.io). Pour le navigateur, c'est un seul site : un seul
// localStorage. Et des sites différents écrivaient les mêmes clés —
// `crm_virements`, `crm_ents`, `crm_modeles`, `crm_vas`, `crm_snapshot_local`…
// Ouvrir l'un puis l'autre dans le même navigateur :
//   • la copie de secours de l'un devenait celle de l'autre ;
//   • au chargement, des virements « récupérés depuis ce navigateur » pouvaient
//     être FUSIONNÉS dans le mauvais cloud, puis réécrits ; le panneau de
//     récupération proposait de restaurer ceux d'un autre site ;
//   • et une liste re-triée après une fusion n'était pas redessinée : les
//     boutons ✕ gardaient les anciennes positions, un clic supprimait UN AUTRE
//     virement que celui visé.
//
// Aucune connexion : les fonctions sont extraites du VRAI index.html et tournent
// sur une fausse mémoire partagée. (Règle de la maison : jamais la base réelle.)
//
//     node test_memoire_partagee.js [autre/index.html]

'use strict';
const fs = require('fs');
const path = require('path');

const PAGE = process.argv[2] || path.join(__dirname, 'index.html');
const SRC = fs.readFileSync(PAGE, 'utf8');

let ko = 0;
function V(titre, cond, detail = '') {
  if (cond) console.log('  OK  ' + titre);
  else { ko++; console.log('  KO  ' + titre + (detail ? '  -> ' + String(detail).slice(0, 200) : '')); }
}
function morceau(debut, fin) {
  const i = SRC.indexOf(debut);
  if (i < 0) return null;
  const j = SRC.indexOf(fin, i + debut.length);
  return j < 0 ? null : SRC.slice(i, j);
}
const CE_SITE = 'noctra';
const AUTRE = 'autresite';   // n'importe quel autre site servi à la même adresse

(async () => {
  console.log('\n-- 1. chaque copie locale de données est rangée sous le nom du site --');
  {
    const CLES = ['virements', 'ents', 'vas', 'modeles', 'editlog', 'snapshot_local', 'pb_defaults'];
    const partagees = CLES.filter((k) => SRC.includes("'crm_" + k + "'"));
    V('plus aucune clé de données commune à plusieurs sites', partagees.length === 0, 'encore partagées : ' + partagees.join(', '));
    const site = /const SITE_FINANCES='([a-z]+)';/.exec(SRC);
    V('le site porte son nom', !!site && site[1] === CE_SITE, site ? site[1] : 'absent');
  }

  const fCle = morceau("const SITE_FINANCES=", "\nlet _VIR_AFFICHES") || "";

  console.log('\n-- 2. au chargement, on ne fusionne QUE la copie de CE site --');
  {
    const bloc = morceau("      try{\n        const _lv=await window.storage.get(", "      // Modèles et journal");
    if (!bloc) {
      console.log('  --  (ce site ne fusionne pas les virements du navigateur au chargement : rien à vérifier ici)');
    } else {
      const memoire = new Map();
      const etranger = [{ id: 'x1', date: '2026-09-10', amount: 777, note: 'paiement d’un autre site' }];
      memoire.set('crm_virements', JSON.stringify(etranger));                        // ancienne clé commune
      memoire.set('fin_' + AUTRE + '_virements', JSON.stringify(etranger));          // la copie d'un autre site
      let ecritures = 0;
      const f = new Function('window', 'virements', '_saveVirements', 'showSaveStatus', 'setTimeout',
        fCle + '\n return (async()=>{ ' + bloc + ' return virements; })();');
      const apres = await f({ storage: { get: async (k) => (memoire.has(k) ? { value: memoire.get(k) } : null) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('les virements d’un autre site ne sont PAS fusionnés dans ce cloud', apres.length === 1,
        apres.length + ' virement(s) après chargement : ' + JSON.stringify(apres.map((v) => v.amount)));
      V('... et rien n’est réécrit au serveur', ecritures === 0, ecritures + ' écriture(s)');
      // Mais la copie de CE site, elle, reste récupérable.
      memoire.clear();
      memoire.set('fin_' + CE_SITE + '_virements', JSON.stringify([{ id: 'b', date: '2026-09-02', amount: 50, note: '' }]));
      const propre = await f({ storage: { get: async (k) => (memoire.has(k) ? { value: memoire.get(k) } : null) } },
        [{ id: 'a', date: '2026-09-01', amount: 100, note: '' }], () => { ecritures++; }, () => {}, () => {});
      V('la copie de CE site reste récupérée', propre.length === 2, JSON.stringify(propre.map((v) => v.amount)));
    }
  }

  console.log('\n-- 3. supprimer vise la ligne CLIQUÉE, même si la liste a bougé --');
  {
    const nom = 'deleteModelPayment';
    const corps = morceau('async function ' + nom + '(i){', '\n}\n');
    V('la suppression est extraite', !!corps);
    if (corps) {
      const A = { id: 'A', date: '2026-09-01', amount: 100, note: '' };
      const B = { id: 'B', date: '2026-09-05', amount: 200, note: '' };
      const C = { id: 'C', date: '2026-09-09', amount: 300, note: '' };
      const D = { id: 'D', date: '2026-09-03', amount: 400, note: 'autre appareil' };
      const monde = { virements: [A, B, C], affiches: [A, B, C], bandeaux: [] };
      // Affiché : A, B, C. Puis une fusion ajoute D et RE-TRIE : l'écran n'a pas bougé.
      monde.virements = [C, B, D, A];
      const f = new Function('virements', '_VIR_AFFICHES', 'showConfirm', 'logEdit', '_VIREMENTS_SUPPRIMES', '_cleVirement',
        'renderVirements', 'renderModelShare', '_saveVirements', 'saveData', 'showSaveStatus', 'fmtR', 'dl',
        corps + '\n}\n; return { f: ' + nom + ', lire: () => virements };');
      const o = f(monde.virements, monde.affiches, async () => true, () => {}, new Set(), (v) => v.id,
        () => {}, () => {}, async () => true, () => {}, (t) => monde.bandeaux.push(t), (x) => x + ' $', (d) => d);
      await o.f(0);   // clic sur la 1re ligne affichée : A (100 $)
      const reste = o.lire().map((v) => v.id).sort().join(',');
      V('c’est A (la ligne cliquée) qui disparaît', reste === 'B,C,D', 'reste : ' + reste);
    }
  }

  console.log('\n-- 4. après une fusion, la liste affichée est redessinée --');
  {
    const corps = morceau('async function _saveVirements(){', '\n}\n');
    V('la sauvegarde des virements est extraite', !!corps);
    if (corps) {
      let dessins = 0;
      const params = ['_dirty', 'ecritureInterdite', 'apiFetch', 'virements', '_cleVirement', '_VIREMENTS_SUPPRIMES', '_pushSetting', 'console', 'renderModelShare'];
      const f = new Function(...params, corps + '\n}\n; return _saveVirements;');
      const sauver = f({}, () => false,
        async () => ({ virements: JSON.stringify([{ id: 'S', date: '2026-09-04', amount: 90, note: '' }]) }),
        [{ id: 'L', date: '2026-09-01', amount: 10, note: '' }], (v) => v.id, new Set(), async () => true,
        { info() {}, warn() {} }, () => { dessins++; });
      await sauver();
      V('la liste fusionnée est redessinée (sinon les ✕ visent de mauvaises lignes)', dessins >= 1, dessins + ' dessin(s)');
    }
  }

  console.log('\n-- 5. aucun autre site ni aucune autre agence nommés dans ce dépôt public --');
  {
    // Liste rangée sous forme d'EMPREINTES (sha256 tronqué) : ce banc n'en contient aucun.
    const crypto = require('crypto');
    const INTERDITS = new Set([
      '00139528c9a24aca', '01ddadf7b03c336f', '04240809cca78a0f', '05195963bbd10343', '08368961da922106', '09f49cafe12120ec',
      '0a4eb1fdb8f1de5c', '0b76fb9711d4f3d8', '0e4b2cc962efb28b', '117b26ccb8fb4ed5', '13d63234821e9ec8', '13f30f775fb6824a',
      '164d9b3b7b836b0e', '16c2aec40ede68fb', '1b5c1d3c9d8e2808', '23c8aa36106a6d89', '2404fdeb34a79ea4', '2487c0f0728a2861',
      '28fed7d40ff88a12', '2b842d2a5611cb20', '2db0f8a45c44969b', '2defd355f601a479', '2e4f57816bec2d5e', '2f93527f7fca966a',
      '32a1e3443a1dffd6', '33dd18b47a2bda2f', '382177b9b31af811', '3ba7c23a8258e08a', '3fa53103bb563186', '40031618ad9bd84b',
      '4026e2a877f67b34', '40903c59d19feef1', '414b0a2f58514c75', '4367104d4aa5846c', '438782d2eda360ba', '440b88f9b52836bc',
      '44bcdaca8c456ca1', '4631f91f323c23a5', '47acf82a48cfa5c3', '4812789f7130fd12', '4b4e7d5db7fc6173', '4ca70efcf4260452',
      '4f6105e2260d1223', '4f98636470ed11df', '5045d78495fc49a1', '528f14167d47cc13', '5784034037cfe682', '5ccf3e630657cfb9',
      '6203340e0745473e', '62eb92cbf5bb53a0', '698c828d52949145', '6a61e9feada0b195', '6d8e16e0018bdd1e', '70dd997c29c18374',
      '728950ef277f75b7', '798b671317f292c1', '7a857235760e4737', '7b3ca3e426cd521f', '7cdf8a37974a5a2b', '7d4aa40fd654b74d',
      '84ff7a86c49a362e', '869dcf48aa1b92b0', '873573645c587e10', '88a1ad27d99e95f7', '88fec672bcb8d0dc', '8acf1bbe8739a2c7',
      '8c9158fef04d879f', '8f71957826707804', '91e224dd42a264c9', '91e52721fc76ee51', '928d73f0b47bf95b', '940fcb01712ac8d7',
      '944e5ce46de06912', '945085b11ad89f21', '94a602a952c9818f', '97cb5901c79692f4', '9901972c0fd08a3d', '9a9d685f1d13235e',
      '9b8290893d287b6b', '9c156250567a8006', 'a387c1ca4f96e5bf', 'ad7007f508bc8dc3', 'ae6346a0de0fadc9', 'af4fda792dbbdb79',
      'b3cab839150a5147', 'b4642f312dcd065b', 'b48db56e9315a39c', 'b52e38a9e394d71f', 'b5b31ded89a6206f', 'b6888bbd34591be4',
      'b9ac732af2aa0b0b', 'ba8a36f7c57d1648', 'bb565a3ddd1cd230', 'bc1b180e87561b99', 'c3f523bbf225edca', 'c64fa36ebda6e4a5',
      'c6fde3bee3cc22b1', 'c7d6d115b53ecda5', 'c9c57ae36dd11c95', 'cd172b28ea547ba3', 'cd3a54125ac34d97', 'cd58e30ca91c31ad',
      'ceeea83e61d92f92', 'd12d7420fab77062', 'd24068c25bc64c59', 'd3b87062116daf52', 'd3f13b5690574a95', 'd3f1c4c0abc8b49b',
      'd5b1009bdf5cb6fc', 'd74484802927e141', 'd77c1280eb9ca1ca', 'd8502596a6d79611', 'dd35109949907845', 'de0ad2a8beed214f',
      'dfc3f1949c56273c', 'e050e474330b5980', 'e415bceda0a4df86', 'e6382b487b75248d', 'e83f8deafb192805', 'e9abc5b847a266cf',
      'ec0c02715c499e46', 'ec1186f266c2d30e', 'ee22404ac207812e', 'eff3cc26e4b119c3', 'f0359bf18e00412f', 'f05169c93460d65e',
      'f074af7ea0860046', 'f3b6a2c5c5e9d873', 'f688f2bd1b183566', 'f773094574a105ec', 'f8c78d89c3f2eecd', 'ff235c3f71bd089b',
    ]);
    const interdits = (texte) => [...new Set((String(texte).match(/(?<!\d)\d{17,20}(?!\d)|[A-Z]+(?![a-z])|[A-Z]?[a-zà-ÿ]+/g) || [])
      .filter((m) => INTERDITS.has(crypto.createHash('sha256').update(m.toLowerCase()).digest('hex').slice(0, 16))))];
    const { execSync } = require('child_process');
    let fichiers = [];
    try { fichiers = execSync('git ls-files', { cwd: __dirname, encoding: 'utf8' }).split('\n').filter((f) => f && /\.(html|js|json|md|txt)$/.test(f)); } catch (e) {}
    const trouves = [];
    for (const f of fichiers) {
      const chemin = f === 'index.html' ? PAGE : path.join(__dirname, f);
      if (!fs.existsSync(chemin)) continue;
      fs.readFileSync(chemin, 'utf8').split('\n').forEach((l, n) => { if (interdits(l).length) trouves.push(f + ':' + (n + 1)); });
    }
    V(fichiers.length + ' fichiers relus : aucun nom d’ailleurs', fichiers.length > 0 && trouves.length === 0, trouves.join(', '));
  }

  console.log('\n' + (ko ? ko + ' ECHEC(S)' : 'TOUT PASSE') + '\n');
  process.exit(ko ? 1 : 0);
})();
