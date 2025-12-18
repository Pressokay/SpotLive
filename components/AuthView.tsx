import React, { useState } from 'react';
import { User } from '../types';
import { X, User as UserIcon, ArrowRight, Sparkles } from './Icon';
import { useLanguage } from '../translations';
import { usersService } from '../services/supabaseService';

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
  onCancel: () => void;
  targetAction: string; // e.g., "post a story" or "view profile"
}

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess, onCancel, targetAction }) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    
    try {
      // Créer un user anonyme dans Supabase
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
      const userId = await usersService.createAnonymousUser(username, avatarUrl);
      
      if (!userId) {
        throw new Error('Failed to create user');
      }
      
      // Sauvegarder userId dans localStorage
      localStorage.setItem('spotlive_user_id', userId);
      localStorage.setItem('spotlive_username', username);
      
      const user: User = {
        id: userId,
        username: username,
        avatarUrl: avatarUrl,
        isGuest: false
      };
      
      onLoginSuccess(user);
    } catch (error) {
      console.error('Login error:', error);
      // Fallback: créer un user local si Supabase échoue
      const mockUser: User = {
        id: `u_${Date.now()}`,
        username: username,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        isGuest: false
      };
      localStorage.setItem('spotlive_user_id', mockUser.id);
      localStorage.setItem('spotlive_username', username);
      onLoginSuccess(mockUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] relative animate-in slide-in-from-bottom-10 duration-300">
      <button 
        onClick={onCancel} 
        className="absolute top-[calc(1.5rem+env(safe-area-inset-top))] right-6 p-2 text-gray-400 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-900/30 text-purple-400 mb-6 ring-1 ring-purple-500/50">
                <UserIcon size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{t('auth.join')}</h2>
            <p className="text-gray-400">
                {t('auth.desc')} <span className="text-purple-400 font-medium">{targetAction}</span> {t('auth.share')}
            </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('auth.input.label')}</label>
                <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('auth.input.placeholder')}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                    autoFocus
                />
            </div>
            
            <button 
                type="submit" 
                disabled={!username || loading}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2"
            >
                {loading ? (
                    <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        <span>{t('auth.button.connecting')}</span>
                    </>
                ) : (
                    <>
                        <span>{t('auth.button.continue')}</span>
                        <ArrowRight size={18} />
                    </>
                )}
            </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-xs text-gray-600">
                {t('auth.policy')}
            </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;