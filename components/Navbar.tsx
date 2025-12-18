import React from 'react';
import { ViewState } from '../types';
import { Map, List, PlusCircle, User } from './Icon';
import { useLanguage } from '../translations';

interface NavbarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentView, onChangeView }) => {
  const { t } = useLanguage();
  const navItemClass = (view: ViewState) => 
    `flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200 ${
      currentView === view ? 'text-purple-400' : 'text-gray-400 hover:text-gray-200'
    }`;

  // Using h-auto and padding-bottom with env(safe-area-inset-bottom) ensures
  // the navbar sits correctly above the iPhone home swipe bar.
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex items-stretch justify-around z-50 h-auto min-h-[4rem] pb-[env(safe-area-inset-bottom)] pt-1">
      <button className={navItemClass(ViewState.MAP)} onClick={() => onChangeView(ViewState.MAP)}>
        <Map size={24} />
        <span className="text-xs font-medium">{t('app.nav.map')}</span>
      </button>
      <button className={navItemClass(ViewState.FEED)} onClick={() => onChangeView(ViewState.FEED)}>
        <List size={24} />
        <span className="text-xs font-medium">{t('app.nav.feed')}</span>
      </button>
      <button className={navItemClass(ViewState.POST)} onClick={() => onChangeView(ViewState.POST)}>
        <PlusCircle size={32} className="text-purple-500 mb-1" />
      </button>
      <button className={navItemClass(ViewState.PROFILE)} onClick={() => onChangeView(ViewState.PROFILE)}>
        <User size={24} />
        <span className="text-xs font-medium">{t('app.nav.profile')}</span>
      </button>
    </div>
  );
};

export default Navbar;