import React, { useState } from 'react';
import { Story, Spot, User } from '../types';
import { MapPin, Clock, Share2, Trash2, Heart } from './Icon';

interface StoryCardProps {
  story: Story;
  spot: Spot;
  currentUser: User | null;
  onClick: () => void;
  onDelete: (storyId: string) => void;
  hasLiked?: boolean;
  onToggleLike?: () => void;
}

const StoryCard: React.FC<StoryCardProps> = ({ 
  story, 
  spot, 
  currentUser, 
  onClick, 
  onDelete, 
  hasLiked, 
  onToggleLike
}) => {
  const [copied, setCopied] = useState(false);

  const timeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const isOwner = currentUser?.id === story.userId;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this story?")) {
      onDelete(story.id);
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleLike) onToggleLike();
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}?story=${story.id}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: `SpotLive: ${spot.name}`,
                text: `Check out ${story.username}'s story at ${spot.name}`,
                url: url
            });
        } catch (err) {
            // User cancelled or share failed
        }
    } else {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy');
        }
    }
  };

  return (
    <div 
      className="relative w-full aspect-[4/5] bg-gray-800 rounded-xl overflow-hidden shadow-lg mb-4 cursor-pointer group"
      onClick={onClick}
    >
      <img 
        src={story.imageUrl} 
        alt={story.caption} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 overflow-hidden">
            <img src={story.userAvatar} alt={story.username} className="w-full h-full object-cover" />
          </div>
          <span className="text-white text-sm font-semibold text-shadow">{story.username}</span>
        </div>
        
        <div className="flex items-center space-x-2">
            <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full flex items-center space-x-1">
                <Clock size={12} className="text-gray-300" />
                <span className="text-gray-300 text-xs">{timeAgo(story.timestamp)}</span>
            </div>
            
            {isOwner && (
                <button 
                    onClick={handleDeleteClick}
                    className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-colors z-20"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-center space-x-1 mb-2">
            <MapPin size={14} className="text-purple-400" />
            <span className="text-purple-300 text-xs font-medium uppercase tracking-wide">{spot.neighborhood} • {spot.name}</span>
        </div>
        <p className="text-white text-sm font-medium mb-2 line-clamp-2">{story.caption}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {story.vibeTags.map(tag => (
            <span key={tag} className="text-xs bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
             {/* Like Button with Count */}
             <button 
                onClick={handleLikeClick}
                className="flex items-center space-x-1.5 group/like"
             >
                <div className={`p-2 rounded-full transition-all ${hasLiked ? 'text-pink-500 bg-pink-500/20' : 'text-white hover:bg-white/10'}`}>
                    <Heart size={20} className={`transition-transform duration-300 ${hasLiked ? "fill-pink-500 scale-110" : "group-hover/like:scale-110"}`} />
                </div>
                <span className={`text-sm font-bold ${hasLiked ? 'text-pink-400' : 'text-white'}`}>{story.likes}</span>
             </button>

             <div className="flex items-center space-x-3">
                <button 
                    onClick={handleShareClick}
                    className="flex items-center space-x-1 text-white hover:text-purple-400 p-2 rounded-full hover:bg-white/10 active:scale-95 transition-transform relative"
                >
                    {copied && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in slide-in-from-bottom-2">
                            Copied!
                        </div>
                    )}
                    <Share2 size={20} />
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default StoryCard;