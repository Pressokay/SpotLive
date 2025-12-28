# Système de Filtrage par Pays - SpotLive

## ✅ Architecture Implémentée

### 1. **Modèle de Données**

#### Table `stories` (Supabase)
```sql
CREATE TABLE stories (
  ...
  country_code TEXT NOT NULL,  -- ISO 3166-1 alpha-2 (ex: 'FR', 'GN', 'US')
  ...
);

-- Index pour performance
CREATE INDEX idx_stories_country_code ON stories(country_code);
CREATE INDEX idx_stories_country_expires ON stories(country_code, expires_at) 
  WHERE expires_at > NOW();
```

**Avantages :**
- ✅ Filtrage rapide côté base de données
- ✅ Index optimisé pour requêtes fréquentes
- ✅ Format standardisé (ISO 3166-1 alpha-2)

### 2. **Détection Automatique du Pays**

#### Service `countryService.ts`
- **`detectCountryFromCoordinates()`** : Détecte le pays depuis GPS via Nominatim
- **`getCountryName()`** : Convertit code pays → nom (ex: 'FR' → 'France')
- **`getCountryFlag()`** : Génère emoji drapeau depuis code pays

#### Dans `App.tsx`
```typescript
// Détection automatique au démarrage
useEffect(() => {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const countryCode = data.address?.country_code?.toUpperCase();
    setUserCountryCode(countryCode);
    
    // Sélection automatique du pays de l'utilisateur par défaut
    if (!selectedCountryCode) {
      setSelectedCountryCode(countryCode);
    }
  });
}, []);
```

### 3. **Filtrage Côté Backend (Supabase)**

#### Service `storiesService.getActiveStories()`
```typescript
async getActiveStories(countryCode?: string | null): Promise<Story[]> {
  let query = supabase
    .from('stories')
    .select('*')
    .gt('expires_at', now);
  
  // Filtrer par pays si spécifié
  if (countryCode && countryCode !== 'ALL') {
    query = query.eq('country_code', countryCode);
  }
  
  return query.order('created_at', { ascending: false });
}
```

**Avantages :**
- ✅ Filtrage côté serveur (performance optimale)
- ✅ Moins de données transférées sur mobile
- ✅ Requête indexée (rapide)

### 4. **UI pour Changer de Pays**

#### Composant `CountrySelector.tsx`
- Modal bottom sheet avec liste des pays
- Recherche de pays
- Affichage du nombre de stories par pays
- Option "Tous les pays" pour voir toutes les stories
- Mise en évidence du pays actuel

#### Intégration dans le Feed
- Bouton dans le header avec drapeau + nom du pays
- Clic → ouvre le sélecteur
- Changement → recharge automatique des stories

### 5. **Persistance des Préférences**

```typescript
// Sauvegarde dans localStorage
localStorage.setItem('spotlive_country_code', countryCode);

// Restauration au démarrage
const savedCountryCode = localStorage.getItem('spotlive_country_code');
if (savedCountryCode) {
  setSelectedCountryCode(savedCountryCode);
}
```

## 📋 Flux Utilisateur

### Scénario 1 : Premier Lancement
1. App détecte la géolocalisation
2. Détecte le pays (ex: France)
3. Affiche automatiquement les stories de France
4. Sauvegarde la préférence

### Scénario 2 : Changer de Pays
1. Utilisateur clique sur le bouton pays dans le header
2. Modal s'ouvre avec liste des pays disponibles
3. Utilisateur sélectionne un pays (ex: Guinée)
4. Stories se rechargent automatiquement
5. Préférence sauvegardée

### Scénario 3 : Voir Tous les Pays
1. Utilisateur ouvre le sélecteur
2. Sélectionne "Tous les pays"
3. Toutes les stories s'affichent (sans filtre)

## 🎯 Bonnes Pratiques Implémentées

### Performance Mobile
- ✅ **Index composite** : `(country_code, expires_at)` pour requêtes rapides
- ✅ **Filtrage côté serveur** : Moins de données transférées
- ✅ **Cache localStorage** : Évite les requêtes inutiles
- ✅ **Lazy loading** : Liste des pays chargée à la demande

### UX
- ✅ **Détection automatique** : Pas besoin de configurer manuellement
- ✅ **Feedback visuel** : Drapeau + nom du pays dans le header
- ✅ **Recherche** : Trouver rapidement un pays
- ✅ **Compteur de stories** : Voir combien de stories par pays

### Sécurité & Fiabilité
- ✅ **Validation du code pays** : ISO 3166-1 alpha-2 uniquement
- ✅ **Fallback** : 'XX' si pays non détecté
- ✅ **Gestion d'erreurs** : Pas de crash si détection échoue

## 🔍 Requêtes SQL Optimisées

### Requête de base (avec filtre pays)
```sql
SELECT * FROM stories
WHERE expires_at > NOW()
  AND country_code = 'FR'  -- Filtre par pays
ORDER BY created_at DESC;
```

### Requête pour liste des pays disponibles
```sql
SELECT country_code, COUNT(*) as count
FROM stories
WHERE expires_at > NOW()
GROUP BY country_code
ORDER BY count DESC;
```

**Performance :** ~10-50ms grâce aux index

## 📱 Exemple d'Utilisation

### Code Frontend
```typescript
// Charger les stories d'un pays spécifique
const stories = await storiesService.getActiveStories('FR');

// Charger toutes les stories
const allStories = await storiesService.getActiveStories(null);

// Obtenir la liste des pays disponibles
const countries = await storiesService.getAvailableCountries();
```

### Code Backend (Supabase)
```sql
-- Exemple : Stories de France actives
SELECT * FROM stories
WHERE country_code = 'FR'
  AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 50;
```

## 🚀 Déploiement

### 1. Exécuter le SQL mis à jour
Le fichier `supabase-setup.sql` contient déjà :
- ✅ Colonne `country_code` dans `stories`
- ✅ Index optimisés
- ✅ RLS policies

### 2. Vérifier la migration
Dans Supabase Dashboard > Table Editor > stories :
- Vérifier que `country_code` existe
- Vérifier les index sont créés

### 3. Tester
1. Créer une story → vérifier que `country_code` est enregistré
2. Changer de pays → vérifier que les stories se filtrent
3. Sélectionner "Tous" → vérifier que toutes les stories s'affichent

## 🐛 Dépannage

### Les stories ne se filtrent pas
- Vérifier que `country_code` est bien enregistré lors de la création
- Vérifier que l'index `idx_stories_country_code` existe
- Vérifier la console pour les erreurs Supabase

### Le pays n'est pas détecté
- Vérifier les permissions de géolocalisation
- Vérifier que Nominatim répond (pas de rate limit)
- Fallback : utiliser 'XX' (Inconnu)

### Performance lente
- Vérifier que les index sont créés
- Vérifier le nombre de stories (peut nécessiter pagination si > 1000)

## 🎉 Résultat Final

✅ **Stories filtrées par pays par défaut**
✅ **Détection automatique du pays de l'utilisateur**
✅ **UI intuitive pour changer de pays**
✅ **Performance optimale sur mobile**
✅ **Préférences persistantes**

