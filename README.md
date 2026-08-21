# Prépa padel — PWA

App statique, un seul dossier, aucune dépendance, aucun build.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'app (HTML + CSS + JS + schémas SVG inline) |
| `manifest.webmanifest` | Nom, icônes, `display: standalone`, raccourcis |
| `sw.js` | Service worker, cache-first — fonctionne hors ligne |
| `icon.svg` / `icon-192.png` / `icon-512.png` / `icon-maskable-512.png` | Icônes |

## Déploiement

Tous les chemins sont **relatifs** (`./`), donc ça marche aussi bien à la racine d'un domaine que dans un sous-chemin type `user.github.io/prepa-padel/`.

**GitHub Pages**
```bash
git init && git add . && git commit -m "prépa padel"
git remote add origin git@github.com:<toi>/prepa-padel.git
git push -u origin main
# Settings → Pages → Deploy from branch → main / root
```

**Netlify / Cloudflare Pages** — glisser le dossier, pas de commande de build, dossier de publication = racine.

**Ton propre serveur** — copier le dossier derrière n'importe quel serveur statique. Un seul impératif : **HTTPS**, sinon le service worker ne s'enregistre pas et l'installation est refusée (`localhost` est la seule exception, pratique pour tester).

## Test local

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Installation sur le téléphone

- **Android / Chrome** : menu ⋮ → « Installer l'application ». L'invite native peut mettre quelques visites à apparaître, l'entrée de menu est toujours là.
- **iOS / Safari** : Partager → « Sur l'écran d'accueil ». iOS ignore l'invite d'installation automatique, et une PWA iOS a son propre bac à sable de stockage : **les données saisies dans Safari ne sont pas reprises par l'icône installée**. Installe d'abord, saisis ensuite.

## Données

Tout est dans `localStorage`, sous la clé `padel-prep-v1`, **sur l'appareil uniquement**. Rien ne part sur un serveur, et rien ne se synchronise entre ton téléphone et ton PC.

Deux conséquences :
- Vider les données de site du navigateur efface ton historique de séances.
- iOS purge le stockage des sites non utilisés au bout de ~7 jours — mais **pas** celui des PWA installées sur l'écran d'accueil. Raison de plus pour l'installer plutôt que de la laisser en onglet.

Les boutons **Exporter / Importer** en bas de page produisent un JSON : c'est ta sauvegarde et ton moyen de passer d'un appareil à l'autre.

## Mise à jour

Après modification de `index.html`, incrémenter `VERSION` dans `sw.js` (`prepa-padel-v1` → `v2`). Sans ça, le cache continue de servir l'ancienne version.
