# Système de Modération - SpotLive

## ✅ Architecture Implémentée

### 1. **Structure de Base de Données**

#### Table `story_reports`
```sql
CREATE TABLE story_reports (
  id UUID PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, -- 'spam', 'inappropriate', 'off_topic', 'harassment', 'other'
  details TEXT,
  created_at TIMESTAMP,
  UNIQUE(story_id, user_id) -- Un user ne peut signaler qu'une fois
);
```

#### Colonnes ajoutées à `stories`
```sql
ALTER TABLE stories 
ADD COLUMN reports_count INTEGER DEFAULT 0,
ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN hidden_at TIMESTAMP,
ADD COLUMN hidden_reason TEXT;
```

**Avantages :**
- ✅ Contrainte d'unicité empêche les signalements multiples
- ✅ Compteur automatique de signalements
- ✅ Masquage automatique après seuil

### 2. **Règles Automatiques**

#### Seuil de Masquage
- **3 signalements** → Story masquée automatiquement
- **10 signalements** → Masquage définitif (protection contre abus)

#### Triggers Automatiques
```sql
-- Incrémente reports_count à chaque signalement
CREATE TRIGGER trigger_increment_reports
AFTER INSERT ON story_reports
FOR EACH ROW
EXECUTE FUNCTION increment_story_reports();

-- Masque automatiquement après 3 signalements
CREATE TRIGGER trigger_auto_hide_on_reports
AFTER INSERT ON story_reports
FOR EACH ROW
EXECUTE FUNCTION auto_hide_story_on_reports();
```

**Avantages :**
- ✅ Pas d'intervention manuelle nécessaire
- ✅ Réaction immédiate aux signalements
- ✅ Scalable (fonctionne même avec des milliers de signalements)

### 3. **Fonction RPC pour Signalement**

#### `report_story()`
```sql
CREATE FUNCTION report_story(
  p_story_id TEXT,
  p_user_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
) RETURNS JSON
```

**Vérifications :**
- ✅ Empêche les signalements multiples (contrainte UNIQUE)
- ✅ Vérifie que la story existe et n'est pas expirée
- ✅ Retourne un message informatif

**Réponse :**
```json
{
  "success": true,
  "report_id": "...",
  "reports_count": 2,
  "is_hidden": false,
  "message": "Encore 1 signalement(s) avant masquage"
}
```

### 4. **Service Frontend**

#### `moderationService.reportStory()`
```typescript
async reportStory(
  storyId: string,
  userId: string,
  reason: 'spam' | 'inappropriate' | 'off_topic' | 'harassment' | 'other',
  details?: string
): Promise<{ success: boolean; message: string; ... }>
```

**Fonctionnalités :**
- ✅ Appelle la fonction RPC Supabase
- ✅ Gère les erreurs
- ✅ Retourne un message utilisateur

### 5. **UI/UX**

#### Composant `ReportModal`
- ✅ Modal avec sélection de raison
- ✅ Champ de détails optionnel
- ✅ Feedback visuel pendant l'envoi
- ✅ Message de confirmation

#### Bouton de Signalement
- ✅ Icône `Flag` dans `StoryCard`
- ✅ Visible seulement si pas propriétaire
- ✅ Ouvre le modal de signalement

**Raisons disponibles :**
- Spam
- Contenu inapproprié
- Hors sujet
- Harcèlement
- Autre

### 6. **Filtrage Automatique**

#### Stories masquées exclues
```typescript
async getActiveStories(countryCode?: string | null): Promise<Story[]> {
  let query = supabase
    .from('stories')
    .select('*')
    .gt('expires_at', now)
    .eq('is_hidden', false); // Exclure les stories masquées
  // ...
}
```

**Avantages :**
- ✅ Les stories masquées ne s'affichent plus
- ✅ Pas besoin de vérification côté client
- ✅ Performance optimale

## 📋 Règles de Modération

### Seuils Automatiques

| Signalements | Action |
|-------------|--------|
| 1-2 | Aucune action (juste comptage) |
| 3-9 | Masquage automatique |
| 10+ | Masquage définitif (protection abus) |

### Expiration Naturelle

Les stories expirent automatiquement après 24h (déjà en place), donc même si une story est masquée, elle disparaîtra naturellement.

### Protection contre les Abus

- ✅ **Contrainte UNIQUE** : Un utilisateur ne peut signaler qu'une fois
- ✅ **Vérification d'existence** : Impossible de signaler une story expirée
- ✅ **Seuil élevé** : 10 signalements = masquage définitif (évite les faux positifs)

## 🎯 Recommandations UX

### 1. **Feedback Utilisateur**

✅ **Message après signalement :**
- "Signalement enregistré"
- "Encore X signalement(s) avant masquage"
- "Story masquée automatiquement"

✅ **Confirmation visuelle :**
- Modal avec animation
- Message de succès
- Bouton disabled pendant l'envoi

### 2. **Transparence**

✅ **Information claire :**
- "Les stories avec 3+ signalements sont masquées automatiquement"
- Raisons de signalement explicites
- Détails optionnels pour contexte

### 3. **Accessibilité**

✅ **Bouton visible :**
- Icône Flag dans StoryCard
- Tooltip "Signaler"
- Accessible même sur mobile

### 4. **Protection Utilisateur**

✅ **Pas de signalement de ses propres stories :**
- Bouton masqué si propriétaire
- Impossible de signaler sa propre story

## 🚀 Évolutions Futures (Optionnel)

### Phase 2 : Modération Manuelle
- Dashboard admin pour voir les signalements
- Possibilité de démasquer une story
- Statistiques de modération

### Phase 3 : Machine Learning
- Détection automatique de contenu inapproprié
- Scoring de risque par story
- Pré-modération avant publication

### Phase 4 : Système de Réputation
- Utilisateurs avec beaucoup de signalements → restrictions
- Utilisateurs fiables → moins de vérifications
- Système de confiance communautaire

## 📊 Métriques à Surveiller

### KPIs Importants
- Nombre de signalements par jour
- Taux de stories masquées
- Raisons les plus fréquentes
- Stories masquées vs stories expirées

### Alertes à Configurer
- Si > 10 signalements en 1h → alerte
- Si > 50% des stories signalées → problème communautaire
- Si story masquée puis démasquée → vérifier

## 🐛 Gestion d'Erreurs

### Cas d'Erreur Gérés

1. **Signalement multiple**
   - Message : "Vous avez déjà signalé cette story"
   - Action : Aucune (contrainte UNIQUE)

2. **Story expirée**
   - Message : "Cette story n'existe plus ou a expiré"
   - Action : Aucune

3. **Erreur serveur**
   - Message : "Erreur lors du signalement"
   - Action : Réessayer

## 📋 Checklist de Déploiement

### 1. Exécuter le SQL
```bash
# Copier le contenu de supabase-moderation.sql
# Exécuter dans Supabase Dashboard > SQL Editor
```

### 2. Vérifier les Tables
- ✅ `story_reports` créée
- ✅ Colonnes ajoutées à `stories`
- ✅ Index créés
- ✅ Triggers actifs

### 3. Tester
- [ ] Signaler une story → doit fonctionner
- [ ] Re-signaler la même story → doit échouer
- [ ] 3 signalements → story masquée automatiquement
- [ ] Story masquée → ne s'affiche plus dans le feed

### 4. Monitoring
- [ ] Configurer alertes Supabase
- [ ] Surveiller les métriques
- [ ] Vérifier les logs

## 🎉 Résultat Final

✅ **Modération automatique** : Pas besoin d'équipe
✅ **Scalable** : Fonctionne avec des milliers d'utilisateurs
✅ **Simple** : Règles claires et transparentes
✅ **Efficace** : Masquage automatique après seuil
✅ **Protection** : Contre les abus et faux positifs
✅ **MVP-friendly** : Pas de ML, pas de modération manuelle

