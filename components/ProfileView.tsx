import React, { useState } from 'react';
import { User, Story } from '../types';
import { Edit2, Save, RefreshCw, X, Globe, Grid } from './Icon';
import { useLanguage } from '../translations';
import StoryCard from './StoryCard';

interface ProfileViewProps {
  user: User;
  storyCount: number;
  onLogout: () => void;
  onUpdateProfile: (updatedUser: User) => void;
  myStories: Story[];
  onDeleteStory: (id: string) => void;
  likedStoryIds: Set<string>;
  onToggleLikeStory: (storyId: string) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
    user, 
    storyCount, 
    onLogout, 
    onUpdateProfile,
    myStories,
    onDeleteStory,
    likedStoryIds,
    onToggleLikeStory
}) => {
  const { t, language, setLanguage } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.username);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatarUrl);

  const handleShuffleAvatar = () => {
    // Generate a new random seed for the avatar
    const randomSeed = Math.random().toString(36).substring(7);
    setCurrentAvatarUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    onUpdateProfile({
      ...user,
      username: editName,
      avatarUrl: currentAvatarUrl
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(user.username);
    setCurrentAvatarUrl(user.avatarUrl);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 w-full overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
            
            {/* Header Profile Section - Safe Area Adjusted */}
            <div className="p-6 pt-[calc(2.5rem+env(safe-area-inset-top))] flex flex-col items-center">
                <div className="relative group mb-6">
                    <div className="w-28 h-28 rounded-full border-4 border-gray-800 overflow-hidden shadow-2xl bg-gray-900 ring-2 ring-purple-500/20">
                    <img src={currentAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    
                    {isEditing && (
                    <button 
                        onClick={handleShuffleAvatar}
                        className="absolute bottom-1 right-1 p-2 bg-purple-600 rounded-full text-white shadow-lg hover:bg-purple-500 transition-transform active:scale-95 border border-purple-400"
                        title="Shuffle Avatar"
                    >
                        <RefreshCw size={18} />
                    </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="w-full max-w-xs space-y-6 mb-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col space-y-2">
                            <label className="text-xs text-purple-400 font-bold uppercase tracking-wider ml-1">{t('profile.displayName')}</label>
                            <input 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-white font-semibold focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all placeholder-gray-600"
                                placeholder={t('auth.input.placeholder')}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={handleCancel} 
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 font-bold transition-colors flex items-center justify-center space-x-2"
                            >
                                <X size={16} />
                                <span>{t('create.cancel')}</span>
                            </button>
                            <button 
                                onClick={handleSave} 
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center space-x-2"
                            >
                                <Save size={16} />
                                <span>{t('profile.save')}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center mb-6">
                        <div className="flex items-center space-x-3 mb-2">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{user.username}</h2>
                            <button 
                                onClick={() => setIsEditing(true)} 
                                className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-900/20 rounded-lg transition-colors"
                                title={t('profile.edit')}
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                        <span className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 text-purple-200 text-xs px-4 py-1.5 rounded-full border border-purple-500/30 font-medium">
                            {t('profile.level')}
                        </span>
                    </div>
                )}

                {/* Settings & Stats */}
                <div className="w-full max-w-sm space-y-3 mb-8">
                    {/* Stats - Simplified to just stories */}
                    <div className="bg-gray-900/80 rounded-2xl p-4 border border-gray-800 flex items-center justify-center">
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-2xl text-white">{storyCount}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('profile.stories')}</span>
                        </div>
                    </div>

                     {/* Language */}
                    <div className="bg-gray-900/80 backdrop-blur-sm p-2 rounded-2xl flex items-center justify-between border border-gray-800">
                        <div className="flex items-center space-x-3 px-3">
                            <Globe size={18} className="text-gray-400"/>
                            <span className="text-gray-400 font-medium text-sm">{t('profile.language')}</span>
                        </div>
                        <div className="flex bg-gray-950 rounded-xl p-1">
                            <button 
                                onClick={() => setLanguage('en')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            >
                                EN
                            </button>
                            <button 
                                onClick={() => setLanguage('fr')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${language === 'fr' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                            >
                                FR
                            </button>
                        </div>
                    </div>

                    {!isEditing && (
                        <button 
                            onClick={onLogout}
                            className="w-full py-3 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-950/30 rounded-xl transition-colors border border-transparent hover:border-red-900/30"
                        >
                            {t('profile.logout')}
                        </button>
                    )}
                </div>
            </div>

            {/* Content List */}
            <div className="px-4 pb-8">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center">
                    <Grid size={20} className="mr-2 text-purple-400" />
                    {t('profile.stories')}
                </h3>

                <div className="space-y-4">
                    {myStories.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 bg-gray-900/50 rounded-2xl border border-gray-800/50 border-dashed">
                            <p>{t('profile.noStories')}</p>
                        </div>
                    ) : (
                        myStories.map(story => (
                            <StoryCard 
                                key={story.id} 
                                story={story} 
                                spot={{
                                    id: 'temp', 
                                    name: story.locationName, 
                                    neighborhood: 'My Location',
                                    latitude: story.latitude,
                                    longitude: story.longitude,
                                    description: '',
                                    activeStories: [],
                                    vibeScore: 0
                                }}
                                currentUser={user}
                                onDelete={onDeleteStory}
                                onClick={() => {}}
                                hasLiked={likedStoryIds.has(story.id)}
                                onToggleLike={() => onToggleLikeStory(story.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default ProfileView;