import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // App / Welcome
    'app.welcome.title': 'SpotLive',
    'app.welcome.subtitle': 'Discover the real vibe of Conakry before you step out.',
    'app.welcome.button': 'Start Exploring',
    'app.welcome.note': 'No account needed to browse.',
    'app.feed.title': 'Live Now',
    'app.feed.activeStories': 'active stories',
    'app.feed.login': 'Log In',
    'app.feed.noStories': 'No active stories in this area right now.',
    'app.feed.beFirst': 'Be the first to post!',
    'app.nav.map': 'Map',
    'app.nav.feed': 'Feed',
    'app.nav.profile': 'Profile',
    'app.filter.all': 'All',

    // Map
    'map.you': 'You',
    'map.realtime': 'Conakry Real-time',
    'map.viewStories': 'View Stories',
    'map.checkIn': 'Check In',

    // Auth
    'auth.join': 'Join SpotLive',
    'auth.desc': 'Log in to',
    'auth.action.post': 'post a story',
    'auth.action.profile': 'view profile',
    'auth.share': 'and share your vibe with Conakry.',
    'auth.input.label': 'Username or Phone',
    'auth.input.placeholder': 'Enter your name',
    'auth.button.continue': 'Continue',
    'auth.button.connecting': 'Connecting...',
    'auth.policy': 'By continuing, you agree to our Vibe Check Policy.',

    // Create
    'create.locating': 'Locating...',
    'create.nearYou': 'Near You',
    'create.permission.title': 'Camera Access Required',
    'create.permission.desc': 'Please allow camera access to post stories.',
    'create.cancel': 'Cancel',
    'create.photo': 'PHOTO',
    'create.video': 'VIDEO',
    'create.recording': 'RECORDING',
    'create.locationPlaceholder': 'Location',
    'create.captionPlaceholder': 'Describe the vibe...',
    'create.hashtagsPlaceholder': '#hashtags',
    'create.share': 'Share to Spot',

    // Profile
    'profile.edit': 'Edit Profile',
    'profile.displayName': 'Display Name',
    'profile.save': 'Save Changes',
    'profile.stories': 'My Stories',
    'profile.logout': 'Log Out',
    'profile.level': 'Explorer Level 1',
    'profile.language': 'Language',
    'profile.noStories': 'You haven\'t posted any stories yet.',
  },
  fr: {
    // App / Welcome
    'app.welcome.title': 'SpotLive',
    'app.welcome.subtitle': 'Découvrez la vraie ambiance de Conakry avant de sortir.',
    'app.welcome.button': 'Commencer à explorer',
    'app.welcome.note': 'Aucun compte requis pour naviguer.',
    'app.feed.title': 'En Direct',
    'app.feed.activeStories': 'stories actives',
    'app.feed.login': 'Connexion',
    'app.feed.noStories': 'Aucune story active dans cette zone pour le moment.',
    'app.feed.beFirst': 'Soyez le premier à poster !',
    'app.nav.map': 'Carte',
    'app.nav.feed': 'Fil',
    'app.nav.profile': 'Profil',
    'app.filter.all': 'Tous',

    // Map
    'map.you': 'Vous',
    'map.realtime': 'Conakry En Direct',
    'map.viewStories': 'Voir les Stories',
    'map.checkIn': 'Pointer ici',

    // Auth
    'auth.join': 'Rejoindre SpotLive',
    'auth.desc': 'Connectez-vous pour',
    'auth.action.post': 'poster une story',
    'auth.action.profile': 'voir le profil',
    'auth.share': 'et partagez votre ambiance avec Conakry.',
    'auth.input.label': 'Nom d\'utilisateur ou Téléphone',
    'auth.input.placeholder': 'Entrez votre nom',
    'auth.button.continue': 'Continuer',
    'auth.button.connecting': 'Connexion...',
    'auth.policy': 'En continuant, vous acceptez notre politique.',

    // Create
    'create.locating': 'Localisation...',
    'create.nearYou': 'Près de vous',
    'create.permission.title': 'Accès Caméra Requis',
    'create.permission.desc': 'Veuillez autoriser l\'accès à la caméra pour poster.',
    'create.cancel': 'Annuler',
    'create.photo': 'PHOTO',
    'create.video': 'VIDÉO',
    'create.recording': 'ENREGISTREMENT',
    'create.locationPlaceholder': 'Lieu',
    'create.captionPlaceholder': 'Décrivez l\'ambiance...',
    'create.hashtagsPlaceholder': '#hashtags',
    'create.share': 'Publier le Spot',

    // Profile
    'profile.edit': 'Modifier Profil',
    'profile.displayName': 'Nom d\'affichage',
    'profile.save': 'Enregistrer',
    'profile.stories': 'Mes Stories',
    'profile.logout': 'Se Déconnecter',
    'profile.level': 'Explorateur Niveau 1',
    'profile.language': 'Langue',
    'profile.noStories': 'Vous n\'avez pas encore posté de story.',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};