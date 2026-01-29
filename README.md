# Étude biblique — Site famille (statique)

Ce site est **100% statique** (HTML/CSS/JS) : parfait pour **GitHub Pages**.

## Déploiement (GitHub Pages)
1. Créez un dépôt GitHub (public) : `etude-biblique-famille`
2. Uploadez tous les fichiers de ce zip à la racine du dépôt
3. Settings → Pages → Source: Deploy from a branch → Branch: `main` → Folder: `/(root)`
4. L’URL du site sera du type : `https://<user>.github.io/etude-biblique-famille/`

## Mise à jour du planning
- Modifiez `plan.json` directement (dans GitHub) **ou**
- Utilisez `admin.html` (modifie localement sur votre appareil), puis:
  1) Télécharger `plan.json`
  2) Remplacer `plan.json` dans GitHub
  3) Commit

## Structure des données (plan.json)
- `assignments[].sections.paragraphs`: liste d’objets `{ memberId, text }`
- `assignments[].sections.verses`: idem
- `assignments[].sections.review`: idem

Bon usage 🙏
