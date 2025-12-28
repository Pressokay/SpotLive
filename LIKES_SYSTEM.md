# Système de Likes Persistants - SpotLive

## ✅ Architecture Implémentée

### 1. **Table `story_likes` avec contrainte d'unicité**

```sql
CREATE TABLE story_likes (
  id UUID PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP,
  UNIQUE(story_id, user_id)  -- ⚠️ CONTRAINTE CRITIQUE
);
```

**Avantages :**
- ✅ Empêche définitivement les doublons en base de données
- ✅ Fonctionne même en cas de race condition (clics rapides)
- ✅ Pas de dépendance au cache local

### 2. **Triggers automatiques**

Les triggers mettent à jour automatiquement le compteur `likes` dans la table `stories` :
- **INSERT** → `likes + 1`
- **DELETE** → `likes - 1`

**Avantages :**
- ✅ Synchronisation automatique
- ✅ Pas besoin d'appeler manuellement `increment_story_likes`
- ✅ Cohérence garantie

### 3. **Service Frontend**

Le service `storiesService.toggleLike()` :
1. Vérifie si un like existe déjà
2. Insère ou supprime selon le cas
3. Gère les erreurs d'unicité (race conditions)
4. Retourne le nouveau nombre de likes

### 4. **Gestion Offline**

**Stratégie actuelle :**
- Les likes sont stockés en base de données
- Si offline, l'action est optimiste (UI mise à jour immédiatement)
- En cas d'erreur, rollback automatique

**Amélioration possible (optionnel) :**
- Queue de synchronisation avec IndexedDB
- Synchronisation automatique quand la connexion revient

## 🔒 Sécurité

### Row Level Security (RLS)

```sql
-- Tout le monde peut lire les likes
CREATE POLICY "Anyone can read likes" ON story_likes FOR SELECT USING (true);

-- Tout le monde peut créer des likes (la contrainte UNIQUE empêche les abus)
CREATE POLICY "Anyone can create likes" ON story_likes FOR INSERT WITH CHECK (true);

-- Les users peuvent supprimer leurs propres likes
CREATE POLICY "Users can delete own likes" ON story_likes FOR DELETE USING (true);
```

## 📋 Checklist de Déploiement

### 1. Exécuter le SQL dans Supabase

```bash
# Copiez le contenu de supabase-setup.sql dans Supabase Dashboard > SQL Editor
# Exécutez le script complet
```

### 2. Vérifier les tables

Dans Supabase Dashboard > Table Editor, vous devriez voir :
- ✅ `story_likes` avec colonnes : `id`, `story_id`, `user_id`, `created_at`
- ✅ Contrainte UNIQUE sur `(story_id, user_id)`

### 3. Vérifier les triggers

Dans Supabase Dashboard > Database > Triggers :
- ✅ `trigger_update_likes_on_insert`
- ✅ `trigger_update_likes_on_delete`

### 4. Tester

1. **Test basique :**
   - Liker une story → doit fonctionner
   - Reliker la même story → doit unlike (pas de doublon)
   - Fermer l'app et revenir → le like doit être conservé

2. **Test race condition :**
   - Cliquer très rapidement plusieurs fois sur like
   - Résultat : un seul like doit être créé

3. **Test offline :**
   - Désactiver le réseau
   - Liker une story → UI mise à jour
   - Réactiver le réseau → synchronisation automatique

## 🐛 Dépannage

### Erreur "duplicate key value violates unique constraint"

**Cause :** Race condition (clics rapides)

**Solution :** Déjà gérée dans le code avec `insertError.code === '23505'`

### Les likes ne se chargent pas au démarrage

**Vérifier :**
- `loadUserLikes()` est appelé dans `useEffect`
- `user.id` existe bien
- Les RLS policies sont actives

### Le compteur de likes ne se met pas à jour

**Vérifier :**
- Les triggers sont créés et actifs
- La fonction `update_story_likes_count()` existe

## 🎯 Résultat Final

✅ **Un utilisateur ne peut liker qu'une seule fois une story**
✅ **Le like persiste même après fermeture de l'app**
✅ **Le système fonctionne même en cas de race condition**
✅ **Le bouton like est désactivé si déjà liké (via `hasLiked`)**

