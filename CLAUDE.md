# Prépa padel — contexte projet

App perso de préparation physique pour le padel. Usage : Flo, sur son téléphone, en PWA installée.
Complète la couche globale `~/.claude/CLAUDE.md` et les règles du workspace `dev/.claude/`.

---

## Objectifs de l'utilisateur

Par ordre de priorité :

1. **Force du haut du corps** — frappe, smash, résistance aux échanges longs
2. **Explosivité du bas du corps** — premier appui, départs courts, déplacements latéraux
3. **Gainage et perte de gras abdominale**

Point à garder en tête pour toute évolution du contenu : la perte de gras se joue sur le
déficit calorique et l'activité globale, pas sur les exercices d'abdos. Ne jamais laisser
entendre l'inverse dans les textes de l'app.

Fréquence prévue : **2 séances par semaine**, en plus des sessions de padel.

---

## Contrainte matérielle — non négociable

Tout le programme repose sur un kit **SmartWorkout** (élastiques) :

- Bandes de résistances variées, empilables
- Ancrage de porte (positions haute / médiane / basse)
- Poignées, barre, sangles de chevilles
- Aucune charge libre, aucune machine, aucun banc

**Tout exercice ajouté doit être réalisable avec ce kit, chez soi, dans un espace réduit**
(les départs 3 m sont l'exception assumée : un couloir suffit).

Limite physique des élastiques à connaître : la résistance est **minimale en bas du mouvement
et maximale en haut**, l'inverse d'une charge libre. C'est pour ça que le programme compense
avec les pompes (charge constante) et les tempos excentriques lents en semaines 7-8.

---

## Stack — figée

Vanilla, mono-fichier, **aucune dépendance, aucun build**. C'est un choix, pas un état
transitoire : app perso sans backend ni compte, offline-first. Ne pas proposer de migration
vers Vue/Nuxt, ne pas ajouter de bundler, ne pas introduire de package npm.

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'app : CSS (l. 15-467), markup (l. 469-533), JS (l. 534-1176) |
| `sw.js` | Service worker cache-first, offline |
| `manifest.webmanifest` | PWA : icônes, `display: standalone`, raccourcis |
| `icon*.png` / `icon.svg` | Icônes |

Chemins **toujours relatifs** (`./`) — l'app doit tourner à la racine d'un domaine comme dans
un sous-chemin GitHub Pages.

---

## Structures de données

### `PROGRAM` — les deux séances

```js
{
  bloc:'Force',            // doit exister dans BLOC_ORDER[session] — sinon l'exo est invisible
  id:'dev-couche',         // clé unique, sert à state.checked / state.logs / FIGURES
  name:'Développé couché élastique',
  detail:'ancrage porte',  // optionnel, affiché en gris à côté du nom
  sets:{30:3,45:4,60:4},   // séries par format ; une clé par format où l'exo apparaît
  reps:'8–10',             // texte libre ; '40 s' ou '30 s / côté' déclenche un bouton chrono
  rest:90,                 // secondes ; 0 ou absent = pas de bouton repos
  tier:30,                 // format minimal où l'exo entre ; au-delà il passe en "beyond"
  sw:'chest/band-bench-chest-press',  // fiche SmartWorkout (voir plus bas)
  warm:true,               // exercice d'échauffement : pas de log, pas de progression hebdo
  note:'...'               // optionnel, encadré sous la prescription
}
```

`tier` et `sets` doivent rester cohérents : un exo de `tier:45` n'a pas de clé `30`.
Le fallback de résolution est `sets[durée] || sets[tier]`, donc `sets:{30:2}` avec `tier:30`
suffit pour un exercice au volume identique dans les trois formats.

**`warm:true`** implique trois choses, à ne pas dissocier : l'exercice échappe à `effSets()`
(pas d'allègement en semaines 1-2, pas de décharge en semaine 9), il n'affiche pas les champs
de saisie charge/reps, et il ne doit pas avoir de `rest` (l'échauffement s'enchaîne).

### `sw` — correspondance SmartWorkout

> **Attention au homonyme.** `smartworkout.app` est un tracker d'entraînement générique édité
> par un tiers, **sans aucun lien** avec la marque française — sa bibliothèque contient des
> machines Smith et des kettlebells. Le bon site est **`smartworkout-pro.com`**. Ne pas y
> revenir : cette confusion a déjà coûté un mapping complet à refaire.

Flo suit les démonstrations vidéo de SmartWorkout, principalement dans leur **app mobile**
(abonnement, 150+ exercices filmés spécifiques aux élastiques). Cette bibliothèque n'a pas
d'URL publique par exercice : le lien pointe donc vers la **page du groupe musculaire** sur le
site FR, qui contient les vidéos.

Le champ `sw` est un groupe musculaire concaténé à
`SW_BASE` (`https://smartworkout-pro.com/pages/exercices-elastique-`), et `SW_GROUPS` fournit
le libellé affiché. Six valeurs possibles, et **aucune autre** :

| `sw` | Page |
|---|---|
| `pectoraux` | développé couché, haut des pecs, pompes lestées |
| `dos` | rowing buste penché, soulevé de terre, tirage horizontal, pullover |
| `epaule` | overhead press, arrière d'épaule, tirage menton, élévations (**singulier**) |
| `bras` | curl biceps, extensions triceps |
| `abdos` | routine abdos, gainage |
| `jambes` | squat, fentes, soulevé de terre, hip thrust, mollets |

Vérification (le site renvoie un vrai 404 sur un slug inconnu) :

```bash
curl -s -o /dev/null -w "%{http_code}" https://smartworkout-pro.com/pages/exercices-elastique-<groupe>
```

Cinq exercices n'ont **aucune** page pertinente et n'en auront pas : `squat-jump`, `skater`,
`depart`, `split-jump`, `intervalles`. SmartWorkout ne filme ni pliométrie ni cardio — c'est
une marque d'élastiques. L'app affiche « Pas de vidéo SmartWorkout — voir le schéma », et c'est
précisément le cas où le schéma SVG doit être irréprochable. Ne pas les remplacer par des
mouvements du catalogue : ce sont les exercices les plus spécifiques du programme.

### `MOBILITY` — routine articulaire

Hors séance, sans matériel, pensée pour être casée 2-3 fois par jour.
Champs : `bloc` (∈ `MOB_BLOCS`), `name`, `presc`, `when`, `detail`.

### `FIGURES` — schémas SVG

Un schéma par exercice, clé = `id` de l'exercice. `viewBox="0 0 120 100"`, préfixé par
`SVG_HEAD` (defs du marqueur de flèche + ligne de sol) et fermé par `</svg>` au render.

Classes CSS disponibles (définies l. 440-455) :

| Classe | Usage |
|---|---|
| `.b` | segments du corps (trait épais encre) |
| `.hd` | tête (cercle) |
| `.band` | élastique (vert balle) |
| `.anch` | ancrage / appui (rectangle plein) |
| `.arr` | sens du mouvement (pointillé + flèche) |
| `.traj` | trajectoire ou repère d'alignement |
| `.flr` | repère au sol / pied |
| `.be` `.br` | blocs effort / récup (schéma intervalles) |
| `.gr` | ligne de sol (fournie par `SVG_HEAD`) |

`SIDE` et `FRONT` sont des corps de référence réutilisables (profil / face). La légende sous
le schéma est **générée automatiquement** par `figLegend()` en détectant les classes présentes.

### `state` — persisté dans `localStorage`, clé `padel-prep-v1`

```js
{
  duration:45,      // 30 | 45 | 60
  session:'A',      // 'A' | 'B' | 'M' (articulations)
  week:1,           // 1..9
  checked:{},       // 'A|dev-couche' -> bool, vidé au changement de séance et au "Terminer"
  logs:{},          // 'A|dev-couche' -> {load, reps, date}
  history:[],       // {date, session, duration, week, done}
  daily:{}          // '2026-08-23' -> nombre de doses articulaires (0..3)
}
```

---

## Progression sur 8 semaines

Gérée par `effSets()` et `WEEK_NOTES` :

| Semaines | Ajustement |
|---|---|
| 1-2 | Apprentissage — une série en moins (automatique), élastique léger |
| 3-4 | Volume complet du format choisi |
| 5-6 | Élastique plus résistant sur la force, +2 reps en pliométrie |
| 7-8 | Tempo excentrique 3 s à la descente sur développé et tirage |
| 9 | Décharge à 50 % du volume |

Seule la variation de séries est appliquée par le code — le reste est prescriptif, à la charge
de l'utilisateur. Si une évolution automatise la charge, elle doit s'appuyer sur `state.logs`.

---

## Structure des séances

`BLOC_ORDER` fixe l'ordre de rendu, `BLOC_META` la légende affichée sous le titre du bloc.
Un bloc absent de `BLOC_ORDER` fait disparaître ses exercices **sans erreur** — c'est le piège
principal de ce fichier de données.

| Séance | Ordre des blocs |
|---|---|
| A — haut du corps | Échauffement › Rotation › Force › Gainage |
| B — explosivité | Échauffement › Pliométrie › Rotation › Force › Gainage › Cardio |

- **Échauffement** : 2 à 3 min, présent dans les trois formats, jamais optionnel. Démarre par
  la planche en activation (habitude de Flo) — volontairement courte et **pas à l'échec** :
  un tronc épuisé dès le départ dégrade la force et la réception en pliométrie.
- **Rotation** : le geste du padel (chop en A, twist en B). À faire frais, avant la fatigue.
  Le chop est en `tier:30` — c'est le mouvement le plus spécifique, il ne saute jamais.
- **Pliométrie toujours en premier** dans le corps de séance B, jambes fraîches.

## Timers

Un seul décompte pour deux usages, via `startTimer(sec, label, kind)` :

- `startRest(sec, label)` — bouton « repos N s » présent si l'exercice a un `rest`
- `startWork(sec, label)` — bouton « chrono N s » généré automatiquement quand `reps`
  commence par une durée (`workSecs()` : `'30 s'`, `'30 s / côté'` → 30)

L'échéance est une **date absolue** (`Date.now() + sec*1000`), jamais un compteur décrémenté :
les navigateurs mobiles brident les timers en arrière-plan et un décompte par tick dérive puis
se fige. Le tick tourne à 250 ms uniquement pour rafraîchir l'affichage.

L'écran est maintenu allumé par la **Screen Wake Lock API** pendant le décompte. Le verrou est
libéré à la fin, et repris par le listener `visibilitychange` — un verrou saute dès que la page
passe en arrière-plan, il n'est jamais rendu automatiquement. L'API n'existe pas partout
(notamment sur d'anciennes versions iOS) : l'échec est silencieux et le décompte fonctionne
quand même. Fin de décompte : vibration + bip. L'`AudioContext` est créé **pendant le clic**
qui lance le timer, sinon la politique d'autoplay le laisse suspendu et le bip ne sort pas.

## Règles de contenu

- **Pliométrie toujours en premier** en séance B (jambes fraîches) — imposé par `BLOC_ORDER`
- Les textes sont en **français, tutoiement, ton direct** — pas de jargon inutile
- Chaque consigne dit **le critère d'arrêt ou le point à surveiller**, pas juste le mouvement
  (« si la réception devient molle, la série est finie »)
- Ne jamais promettre un résultat médical ou esthétique ; l'encadré `.warn` de la section
  articulations est le ton de référence sur la douleur
- Tout nouvel exercice avec `rest` doit avoir un schéma dans `FIGURES` si le placement de
  départ est ambigu

---

## Modification et déploiement

1. Éditer `index.html`
2. **Incrémenter `VERSION` dans `sw.js`** (`prepa-padel-v1` → `v2`) — sans ça le cache continue
   de servir l'ancienne version
3. Tester en local : `python3 -m http.server 8000`
4. Push sur `main` → GitHub Pages

Le service worker exige **HTTPS** (sauf `localhost`).

---

## Vérification avant commit

Il n'y a ni build ni test runner, mais les erreurs de données sont silencieuses. Deux contrôles
valent le coup après toute modification du programme ou des schémas :

1. **Syntaxe** — extraire le `<script>` et le passer à `node --check`.
2. **Cohérence des données** — vérifier que chaque `bloc` existe dans `BLOC_ORDER`, que
   `sets[durée] || sets[tier]` se résout pour chaque format, qu'aucune clé de `FIGURES` n'est
   orpheline, que les schémas n'utilisent que les classes connues et que les coordonnées et
   les `<text>` tiennent dans le `viewBox` 120 × 100.

Le contrôle du `viewBox` n'est pas cosmétique : un `<text>` trop long dépasse le cadre et se
fait couper au rendu, sans la moindre erreur console.

## Points connus non corrigés

- Les raccourcis du manifest (`./?s=A`) ne sont pas lus par le JS : les trois entrées ouvrent
  l'app dans l'état sauvegardé.
- Le `@import` Google Fonts n'est ni dans `ASSETS` ni cacheable par le service worker (il
  refuse le cross-origin au miss) : hors ligne, la typo tombe en fallback.
- Le fallback du service worker renvoie `index.html` pour **toute** requête GET échouée, y
  compris une image. À restreindre à `request.mode === 'navigate'`.
- `render()` reconstruit tout le DOM au moindre clic, ce qui referme les schémas dépliés.
- L'import JSON ne valide rien et `log.load` ressort en `innerHTML` non échappé (self-XSS).
- `SVG_HEAD` répète `<marker id="ah">` dans chaque carte — ids dupliqués dans le DOM.
- Séance B en 45 et 60 min déborde son budget (≈ 54 et ≈ 70 min) : le volume pliométrique du
  format 60 atteint ~126 contacts au sol, au-dessus de la fourchette usuelle de 80-120.
- Rien ne travaille l'avant-bras en charge, alors que le « padel elbow » est le pépin classique
  du sport. La bibliothèque SmartWorkout n'a aucun exercice d'avant-bras à élastique, mais
  `forearms/wrist-push-up` existe au poids du corps.
- Aucun suivi du poids corporel, alors que la perte de gras est un objectif déclaré.
