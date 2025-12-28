import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  maxPull?: number;
  pullDownText?: string;
  releaseText?: string;
  refreshingText?: string;
  isRefreshing?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  threshold = 100,
  maxPull = 200,
  pullDownText = 'Tirez pour rafraîchir',
  releaseText = 'Relâchez pour actualiser',
  refreshingText = 'Mise à jour...',
  isRefreshing: externalIsRefreshing
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [internalIsRefreshing, setInternalIsRefreshing] = useState(false);
  const isRefreshing = externalIsRefreshing !== undefined ? externalIsRefreshing : internalIsRefreshing;
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isTouching = useRef(false);
  const pullStartY = useRef(0);
  const lastScrollY = useRef(0);

  // Gestion du début du touch
  const handleTouchStart = (e: TouchEvent) => {
    // Ne démarrer que si on est tout en haut de la page
    if (window.scrollY <= 0 && !isTouching.current) {
      isTouching.current = true;
      startY.current = e.touches[0].clientY;
      pullStartY.current = e.touches[0].clientY;
      lastScrollY.current = window.scrollY;
    }
  };

  // Gestion du mouvement de touch
  const handleTouchMove = (e: TouchEvent) => {
    if (!isTouching.current) return;

    const touchY = e.touches[0].clientY;
    const deltaY = touchY - pullStartY.current;
    
    // Si on tire vers le bas et qu'on est en haut de la page
    if (deltaY > 0 && window.scrollY <= 0) {
      e.preventDefault();
      isDragging.current = true;
      
      // Calculer la distance de défilement avec un effet de résistance
      const distance = Math.min(deltaY * 0.6, maxPull);
      setPullDistance(distance);
    }
  };

  // Gestion de la fin du touch
  const handleTouchEnd = async (e: TouchEvent) => {
    if (!isDragging.current) {
      isTouching.current = false;
      return;
    }

    // Si la distance dépasse le seuil, déclencher le rafraîchissement
    if (pullDistance >= threshold) {
      if (externalIsRefreshing === undefined) {
        setInternalIsRefreshing(true);
      }
      try {
        await onRefresh();
      } catch (error) {
        console.error('Erreur lors du rafraîchissement:', error);
      } finally {
        if (externalIsRefreshing === undefined) {
          setInternalIsRefreshing(false);
        }
      }
    }
    
    // Réinitialiser l'état
    setPullDistance(0);
    isDragging.current = false;
    isTouching.current = false;
  };

  // Ajouter les écouteurs d'événements
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance]);

  // Calculer la rotation de l'icône
  const rotation = Math.min(pullDistance / 2, 180);
  const progress = Math.min(pullDistance / threshold, 1);
  
  // Afficher le contenu
  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        touchAction: 'pan-y',
        paddingTop: isRefreshing ? '60px' : '0',
        transition: 'padding-top 0.3s ease',
      }}
    >
      {/* Indicateur de rafraîchissement */}
      <div 
        className="absolute left-0 right-0 top-0 flex justify-center items-center h-16 pointer-events-none"
        style={{
          transform: `translateY(${isRefreshing ? 0 : pullDistance - 60}px)`,
          transition: isRefreshing ? 'transform 0.3s ease' : 'none',
        }}
      >
        <AnimatePresence>
          {(pullDistance > 0 || isRefreshing) && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                scale: isRefreshing ? 1.1 : 1
              }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex flex-col items-center"
            >
              {isRefreshing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1, 
                    ease: "linear" 
                  }}
                >
                  <RefreshCw className="w-6 h-6 text-blue-500" />
                </motion.div>
              ) : (
                <motion.div
                  style={{ rotate: rotation }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <RefreshCw className="w-6 h-6 text-blue-500" />
                </motion.div>
              )}
              <motion.span 
                className="text-xs mt-1 text-gray-500"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {isRefreshing 
                  ? refreshingText 
                  : pullDistance >= threshold 
                    ? releaseText 
                    : pullDownText}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contenu */}
      <div 
        style={{ 
          transform: `translateY(${isRefreshing ? 60 : pullDistance}px)`,
          transition: isRefreshing 
            ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
            : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
