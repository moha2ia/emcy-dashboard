# Présentation « État d'avancement » - EMCY Dashboard

Génère le PowerPoint français de 16 diapositives qui présente l'application
complète avec de vraies captures d'écran, puis l'importe dans l'espace
Ressources du tableau de bord.

Résultat final : `EMCY-Dashboard_Etat-davancement_FR.pptx` (aussi
téléchargeable dans l'app, Resources > « Présentation - État d'avancement »).

## Contenu du dossier

- `shots.cjs` : capture chaque page de l'app (Chrome headless, sessions admin + membre injectées)
- `login-shot.cjs` : capture l'écran de connexion (hors session)
- `stage.cjs` : crée des données de démo réalistes (tâches, pointages, un membre) via l'API, enregistrées dans `staged-state.json` pour un nettoyage exact
- `build-deck.cjs` : assemble le PPTX 16 diapositives (pptxgenjs, charte EMCY)
- `make-sheet.cjs` : génère `contact-sheet.html` (aperçu de toutes les diapositives en base64)
- `cleanup.cjs` : supprime toutes les données de démo de `db.json` (API arrêtée)
- `fix-upload.cjs` : re-téléverse le PPTX avec un titre/description UTF-8 propres

## Régénérer la présentation (ordre strict)

Prérequis : API sur :5000 et Vite sur :5173 en marche ; Chrome installé ;
dépendances : `cd docs/presentation && npm install pptxgenjs puppeteer-core`.

1. `node stage.cjs` - données de démo (tâches + pointages + membre démo)
2. `node shots.cjs` puis `node login-shot.cjs` - captures dans `shots/`
3. `node build-deck.cjs` - écrit le PPTX
4. (optionnel) `node make-sheet.cjs` - feuille de contact pour vérification visuelle
5. Nettoyage - arrêter l'API, puis `node cleanup.cjs`, puis supprimer
   `staged-state.json` et relancer l'API
6. Téléversement - démarrer l'API, obtenir un token :
   `curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@emcy.com","password":"admin123"}'`
   puis `node fix-upload.cjs` (remplace l'ancienne version dans Resources)

## Notes

- Les captures utilisent l'app réelle : toute évolution de l'interface se
  reflète en relançant simplement les étapes 2 et 3.
- Ne pas modifier `cleanup.cjs` à la légère : il filtre par les ids exacts de
  `staged-state.json` : c'est ce qui garantit qu'aucune vraie donnée n'est touchée.
- Le titre/description côté app doivent être envoyés en UTF-8 (voir
  `fix-upload.cjs` ; un `curl -F` Windows corrompt les accents).
- Charte couleurs du deck : navy `1F3A5F`, bleu `3D6DB5`, texte `22314E`.
