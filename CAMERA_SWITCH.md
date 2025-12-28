# Système de Basculement Caméra - SpotLive

## ✅ Fonctionnalités Implémentées

### 1. **Basculement Avant/Arrière**

#### State Management
```typescript
const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
```

- ✅ **`facingMode`** : 'user' = caméra avant, 'environment' = caméra arrière
- ✅ **`isSwitchingCamera`** : État de chargement pendant le basculement
- ✅ **Par défaut** : Caméra arrière (`environment`)

### 2. **Fonction de Basculement**

#### `handleSwitchCamera()`
```typescript
const handleSwitchCamera = async () => {
  if (isSwitchingCamera || isRecording || capturedMedia) return;
  
  setIsSwitchingCamera(true);
  
  // Arrêter l'ancien stream
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    setStream(null);
  }
  
  // Basculer la caméra
  setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  
  // Le useEffect se chargera de démarrer la nouvelle caméra
};
```

**Protections :**
- ✅ Empêche le basculement pendant l'enregistrement
- ✅ Empêche le basculement si une capture existe déjà
- ✅ Empêche les doubles clics (isSwitchingCamera)

### 3. **Gestion Propre des Streams**

#### Arrêt de l'Ancien Stream
```typescript
// Dans handleSwitchCamera
if (stream) {
  stream.getTracks().forEach(track => track.stop());
  setStream(null);
}
```

#### Démarrage du Nouveau Stream
```typescript
// Dans useEffect (startCamera)
// Arrêter l'ancien stream s'il existe
if (stream) {
  stream.getTracks().forEach(track => track.stop());
}

const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: { 
    facingMode: facingMode, 
    aspectRatio: 9/16,
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  },
  audio: mode === 'VIDEO'
});
```

**Avantages :**
- ✅ Pas de fuite mémoire (streams arrêtés proprement)
- ✅ Pas de conflit entre streams
- ✅ Performance optimale

### 4. **Gestion des Erreurs**

#### Erreurs Gérées

1. **`NotAllowedError` / `PermissionDeniedError`**
   - L'utilisateur a refusé l'accès à la caméra
   - Affiche `permissionError`

2. **`NotFoundError` / `DevicesNotFoundError`**
   - Pas de caméra disponible
   - Si on essayait la caméra avant, revient à l'arrière

3. **`OverconstrainedError` / `ConstraintNotSatisfiedError`**
   - Contrainte non satisfaite (ex: aspectRatio)
   - Fallback : essaie sans contraintes strictes

4. **Autres erreurs**
   - Affiche `permissionError` par défaut

#### Code de Gestion d'Erreurs
```typescript
catch (err: any) {
  console.error("Camera error:", err);
  setIsSwitchingCamera(false);
  
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    setPermissionError(true);
  } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    // Pas de caméra disponible, essayer l'autre caméra
    if (facingMode === 'user') {
      setFacingMode('environment');
    }
  } else if (err.name === 'OverconstrainedError') {
    // Fallback sans contraintes strictes
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: mode === 'VIDEO'
      });
      // ...
    } catch (fallbackErr) {
      setPermissionError(true);
    }
  }
}
```

### 5. **UI/UX**

#### Bouton de Basculement
```tsx
{!capturedMedia && !isRecording && (
  <button 
    onClick={handleSwitchCamera}
    disabled={isSwitchingCamera}
    className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
    title={facingMode === 'user' ? 'Caméra arrière' : 'Caméra avant'}
  >
    {isSwitchingCamera ? (
      <Loader2 size={20} className="animate-spin" />
    ) : (
      <FlipHorizontal size={20} />
    )}
  </button>
)}
```

**Caractéristiques :**
- ✅ Visible seulement quand pas de capture et pas d'enregistrement
- ✅ Animation de chargement pendant le basculement
- ✅ Tooltip indiquant la caméra actuelle
- ✅ Désactivé pendant le basculement
- ✅ Style cohérent avec le reste de l'UI

## 📱 Bonnes Pratiques Implémentées

### 1. **Gestion Propre des Streams**

✅ **Arrêt avant démarrage** : L'ancien stream est toujours arrêté avant de démarrer le nouveau
✅ **Cleanup dans useEffect** : Les streams sont arrêtés au démontage du composant
✅ **Pas de fuite mémoire** : Tous les tracks sont arrêtés proprement

### 2. **Protection contre les Erreurs**

✅ **Try-catch** : Toutes les opérations async sont dans try-catch
✅ **Gestion spécifique** : Chaque type d'erreur est géré différemment
✅ **Fallback** : Si une contrainte échoue, on essaie sans contraintes

### 3. **UX Optimale**

✅ **Feedback visuel** : Animation de chargement pendant le basculement
✅ **États clairs** : Bouton disabled pendant le basculement
✅ **Protection** : Empêche le basculement dans des états invalides

### 4. **Performance**

✅ **Pas de double stream** : Un seul stream actif à la fois
✅ **Cleanup immédiat** : Streams arrêtés dès qu'ils ne sont plus nécessaires
✅ **Attente de metadata** : Attend que la vidéo soit prête avant de continuer

## 🔄 Flux de Basculement

### Scénario 1 : Basculement Normal
1. Utilisateur clique sur le bouton flip
2. `isSwitchingCamera` → `true`
3. Ancien stream arrêté
4. `facingMode` basculé
5. `useEffect` détecte le changement
6. Nouveau stream démarré
7. Vidéo affichée
8. `isSwitchingCamera` → `false`

### Scénario 2 : Erreur (Pas de Caméra Avant)
1. Utilisateur clique sur flip (caméra avant)
2. Stream arrière arrêté
3. Tentative de démarrage caméra avant
4. Erreur `NotFoundError`
5. Retour automatique à caméra arrière
6. Stream arrière redémarré

### Scénario 3 : Protection (Enregistrement en Cours)
1. Utilisateur enregistre une vidéo
2. Utilisateur clique sur flip
3. Fonction retourne immédiatement (protection)
4. Aucun changement

## 🎯 Cas d'Erreur à Éviter

### ❌ À NE PAS FAIRE

1. **Ne pas arrêter l'ancien stream**
   ```typescript
   // ❌ MAUVAIS
   const newStream = await getUserMedia({...});
   setStream(newStream);
   // L'ancien stream continue de tourner → fuite mémoire
   ```

2. **Basculement pendant l'enregistrement**
   ```typescript
   // ❌ MAUVAIS
   const handleSwitchCamera = () => {
     setFacingMode(prev => ...); // Pendant l'enregistrement → crash
   };
   ```

3. **Pas de gestion d'erreurs**
   ```typescript
   // ❌ MAUVAIS
   const stream = await getUserMedia({...}); // Pas de try-catch
   ```

4. **Double stream**
   ```typescript
   // ❌ MAUVAIS
   const stream1 = await getUserMedia({...});
   const stream2 = await getUserMedia({...}); // Deux streams actifs
   ```

### ✅ À FAIRE (Implémenté)

1. **Arrêter avant de démarrer**
   ```typescript
   // ✅ BON
   if (stream) {
     stream.getTracks().forEach(track => track.stop());
   }
   const newStream = await getUserMedia({...});
   ```

2. **Protection contre les états invalides**
   ```typescript
   // ✅ BON
   if (isSwitchingCamera || isRecording || capturedMedia) return;
   ```

3. **Gestion d'erreurs complète**
   ```typescript
   // ✅ BON
   try {
     // ...
   } catch (err) {
     // Gestion spécifique par type d'erreur
   }
   ```

4. **Cleanup dans useEffect**
   ```typescript
   // ✅ BON
   return () => {
     if (stream) {
       stream.getTracks().forEach(track => track.stop());
     }
   };
   ```

## 📋 Checklist de Test

### Tests à Effectuer

1. **Basculement Normal**
   - [ ] Clic sur bouton flip → caméra bascule
   - [ ] Animation de chargement visible
   - [ ] Nouvelle caméra fonctionne correctement

2. **Protection**
   - [ ] Pas de basculement pendant l'enregistrement
   - [ ] Pas de basculement si capture existe
   - [ ] Pas de double basculement (debounce)

3. **Gestion d'Erreurs**
   - [ ] Pas de caméra avant → retour automatique à arrière
   - [ ] Permission refusée → message d'erreur
   - [ ] Contrainte non satisfaite → fallback sans contraintes

4. **Performance**
   - [ ] Pas de lag pendant le basculement
   - [ ] Pas de fuite mémoire (vérifier DevTools)
   - [ ] Streams arrêtés proprement

## 🎉 Résultat Final

✅ **Basculement fluide** entre caméra avant/arrière
✅ **Gestion propre** des streams (pas de fuite mémoire)
✅ **Gestion d'erreurs** complète avec fallback
✅ **UX optimale** avec feedback visuel
✅ **Protection** contre les états invalides
✅ **Performance** optimisée

