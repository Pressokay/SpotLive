# Configuration Supabase pour SpotLive

## ✅ Étapes à suivre

### 1. Créer le fichier .env.local

Créez un fichier `.env.local` à la racine du projet avec :

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

### 2. Exécuter le script SQL dans Supabase

1. Allez sur votre dashboard Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (menu de gauche)
4. Cliquez sur **New Query**
5. Copiez-collez tout le contenu du fichier `supabase-setup.sql`
6. Cliquez sur **Run** (ou Ctrl+Enter)

### 3. Vérifier que les tables sont créées

1. Allez dans **Table Editor** (menu de gauche)
2. Vous devriez voir deux tables :
   - `users` (avec colonnes: id, username, avatar_url, created_at)
   - `stories` (avec toutes les colonnes nécessaires)

### 4. Tester l'application

1. Redémarrez le serveur de développement :
   ```bash
   npm run dev
   ```

2. Testez :
   - Créer un compte avec un pseudo
   - Poster une story
   - Vérifier que la story apparaît dans Supabase (Table Editor > stories)
   - Rafraîchir la page → la story devrait toujours être là !

## 🎉 C'est tout !

Votre app est maintenant connectée à Supabase avec :
- ✅ Authentification anonyme (juste un pseudo)
- ✅ Stories sauvegardées dans la base de données
- ✅ Partage global : tout le monde voit les mêmes stories
- ✅ Persistance : les données restent après refresh

## 🔍 Dépannage

### Les stories ne s'affichent pas
- Vérifiez que le script SQL a bien été exécuté
- Vérifiez la console du navigateur pour les erreurs
- Vérifiez que `.env.local` existe et contient les bonnes clés

### Erreur "relation does not exist"
- Le script SQL n'a pas été exécuté
- Réexécutez `supabase-setup.sql` dans SQL Editor

### Les stories ne se sauvegardent pas
- Vérifiez les RLS (Row Level Security) policies dans Supabase
- Allez dans Authentication > Policies et vérifiez que les policies sont actives

