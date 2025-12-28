import React, { useState, useEffect } from 'react';
import { X, Globe, ChevronDown } from './Icon';
import { getCountryName, getCountryFlag, POPULAR_COUNTRIES } from '../services/countryService';
import { storiesService } from '../services/supabaseService';

interface CountrySelectorProps {
  currentCountryCode: string | null;
  userCountryCode: string | null;
  onCountryChange: (countryCode: string | null) => void;
  onClose: () => void;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  currentCountryCode,
  userCountryCode,
  onCountryChange,
  onClose
}) => {
  const [availableCountries, setAvailableCountries] = useState<Array<{ code: string; name: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCountries = async () => {
      setIsLoading(true);
      try {
        const countries = await storiesService.getAvailableCountries();
        setAvailableCountries(countries);
      } catch (error) {
        console.error('Error loading countries:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCountries();
  }, []);

  const filteredCountries = availableCountries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCountry = (code: string | null) => {
    onCountryChange(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
      <div className="w-full bg-gray-900 rounded-t-3xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Globe size={20} className="text-purple-400" />
            <h2 className="text-lg font-bold text-white">Sélectionner un pays</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-800">
          <input
            type="text"
            placeholder="Rechercher un pays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Countries List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {/* Option "Tous les pays" */}
              <button
                onClick={() => handleSelectCountry(null)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                  currentCountryCode === null
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🌍</span>
                  <div className="text-left">
                    <div className="font-semibold">Tous les pays</div>
                    <div className="text-xs opacity-75">Voir toutes les stories</div>
                  </div>
                </div>
                {currentCountryCode === null && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </button>

              {/* Pays de l'utilisateur (si différent de "Tous") */}
              {userCountryCode && userCountryCode !== currentCountryCode && (
                <button
                  onClick={() => handleSelectCountry(userCountryCode)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors border border-purple-500/30"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getCountryFlag(userCountryCode)}</span>
                    <div className="text-left">
                      <div className="font-semibold">{getCountryName(userCountryCode)}</div>
                      <div className="text-xs opacity-75">Votre localisation</div>
                    </div>
                  </div>
                  <ChevronDown size={16} className="text-gray-400 rotate-[-90deg]" />
                </button>
              )}

              {/* Liste des pays disponibles */}
              {filteredCountries.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p>Aucun pays trouvé</p>
                </div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleSelectCountry(country.code)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                      currentCountryCode === country.code
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getCountryFlag(country.code)}</span>
                      <div className="text-left">
                        <div className="font-semibold">{country.name}</div>
                        <div className="text-xs opacity-75">{country.count} {country.count === 1 ? 'story' : 'stories'}</div>
                      </div>
                    </div>
                    {currentCountryCode === country.code && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountrySelector;

