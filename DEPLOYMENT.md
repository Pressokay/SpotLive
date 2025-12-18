# Guide de Déploiement PWA - SpotLive

Ce guide explique comment déployer SpotLive en tant que Progressive Web App (PWA) sur mobile.

## ✅ Prérequis

- ✅ Service Worker créé (`public/sw.js`)
- ✅ Manifest.json configuré
- ✅ Icônes PWA (placeholders créés, à remplacer par de vraies icônes)
- ✅ Meta tags iOS configurés
- ✅ HTTPS (fourni gratuitement par Vercel/Netlify)

## 🚀 Déploiement Rapide

### Option 1: Vercel (Recommandé)

1. **Installer Vercel CLI** (optionnel):
   ```bash
   npm i -g vercel
   ```

2. **Déployer**:
   ```bash
   vercel
   ```
   Ou connectez votre repo GitHub sur [vercel.com](https://vercel.com)

3. **Configurer les variables d'environnement**:
   - Dans le dashboard Vercel, allez dans Settings > Environment Variables
   - Ajoutez `GEMINI_API_KEY` avec votre clé API

4. **C'est tout !** Votre app est maintenant en ligne avec HTTPS

### Option 2: Netlify

1. **Installer Netlify CLI** (optionnel):
   ```bash
   npm i -g netlify-cli
   ```

2. **Déployer**:
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

3. **Configurer les variables d'environnement**:
   - Dans le dashboard Netlify, allez dans Site settings > Environment variables
   - Ajoutez `GEMINI_API_KEY`

## 📱 Installation sur Mobile

### Android (Chrome)

1. Ouvrez votre app déployée dans Chrome Android
2. Le navigateur détectera automatiquement la PWA
3. Une bannière "Installer l'application" apparaîtra
4. Ou allez dans Menu (⋮) > "Ajouter à l'écran d'accueil"
5. L'app apparaîtra comme une app native sur votre écran d'accueil

### iOS (Safari)

1. Ouvrez votre app déployée dans Safari iOS
2. Appuyez sur le bouton Partager (□↑)
3. Faites défiler et sélectionnez "Sur l'écran d'accueil"
4. Personnalisez le nom si nécessaire
5. Appuyez sur "Ajouter"
6. L'app apparaîtra comme une app native sur votre écran d'accueil

## 🎨 Améliorer les Icônes

Les icônes placeholder sont actuellement en place. Pour de meilleures icônes :

1. **Utilisez le SVG source** (`public/icons/icon.svg`)
2. **Convertissez en PNG** avec:
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [CloudConvert](https://cloudconvert.com/svg-to-png)
   - Ou un éditeur d'images (Figma, Inkscape, etc.)

3. **Remplacez les fichiers** dans `public/icons/`:
   - `icon-192x192.png` (requis)
   - `icon-512x512.png` (requis)
   - Toutes les autres tailles pour une meilleure compatibilité

## ✅ Checklist de Déploiement

- [ ] Code déployé sur Vercel/Netlify
- [ ] HTTPS activé (automatique avec Vercel/Netlify)
- [ ] Variable `GEMINI_API_KEY` configurée
- [ ] Service Worker accessible (vérifier dans DevTools > Application > Service Workers)
- [ ] Manifest.json accessible (vérifier `/manifest.json`)
- [ ] Icônes remplacées par de vraies icônes PNG
- [ ] Test d'installation sur Android
- [ ] Test d'installation sur iOS
- [ ] Test de fonctionnement hors ligne (Service Worker)

## 🔍 Vérification PWA

### Chrome DevTools

1. Ouvrez votre app dans Chrome
2. Ouvrez DevTools (F12)
3. Allez dans l'onglet **Application**
4. Vérifiez:
   - ✅ Service Worker enregistré et actif
   - ✅ Manifest détecté
   - ✅ Icônes chargées

### Lighthouse (Test PWA)

1. Dans Chrome DevTools, ouvrez l'onglet **Lighthouse**
2. Sélectionnez "Progressive Web App"
3. Cliquez sur "Generate report"
4. Visez un score de 90+ pour une PWA optimale

## 🐛 Dépannage

### Le Service Worker ne s'enregistre pas

- Vérifiez que vous êtes en HTTPS (ou localhost)
- Vérifiez la console pour les erreurs
- Assurez-vous que `public/sw.js` existe

### L'app ne s'installe pas

- Vérifiez que le manifest.json est valide
- Vérifiez que les icônes requises (192x192, 512x512) existent
- Vérifiez que vous êtes en HTTPS

### Les icônes ne s'affichent pas

- Vérifiez que les fichiers PNG existent dans `public/icons/`
- Vérifiez les chemins dans `manifest.json`
- Videz le cache du navigateur

## 📝 Notes Importantes

- **HTTPS requis**: Les PWA nécessitent HTTPS en production (gratuit avec Vercel/Netlify)
- **Données en mémoire**: Actuellement, les stories sont stockées en mémoire (perdues au refresh)
- **API Gemini**: La clé API est exposée côté client (pour production, utilisez un proxy backend)

## 🎉 C'est Prêt !

Une fois déployé, votre app SpotLive sera installable comme une app native sur Android et iOS, sans passer par les stores d'applications !

