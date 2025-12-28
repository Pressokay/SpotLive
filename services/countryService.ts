// Service pour la détection et gestion des pays

// Mapping ISO 3166-1 alpha-2 vers noms de pays
const COUNTRY_NAMES: Record<string, string> = {
  'AD': 'Andorre', 'AE': 'Émirats arabes unis', 'AF': 'Afghanistan', 'AG': 'Antigua-et-Barbuda',
  'AI': 'Anguilla', 'AL': 'Albanie', 'AM': 'Arménie', 'AO': 'Angola', 'AQ': 'Antarctique',
  'AR': 'Argentine', 'AS': 'Samoa américaines', 'AT': 'Autriche', 'AU': 'Australie',
  'AW': 'Aruba', 'AX': 'Îles Åland', 'AZ': 'Azerbaïdjan', 'BA': 'Bosnie-Herzégovine',
  'BB': 'Barbade', 'BD': 'Bangladesh', 'BE': 'Belgique', 'BF': 'Burkina Faso',
  'BG': 'Bulgarie', 'BH': 'Bahreïn', 'BI': 'Burundi', 'BJ': 'Bénin',
  'BL': 'Saint-Barthélemy', 'BM': 'Bermudes', 'BN': 'Brunei', 'BO': 'Bolivie',
  'BQ': 'Pays-Bas caribéens', 'BR': 'Brésil', 'BS': 'Bahamas', 'BT': 'Bhoutan',
  'BV': 'Île Bouvet', 'BW': 'Botswana', 'BY': 'Biélorussie', 'BZ': 'Belize',
  'CA': 'Canada', 'CC': 'Îles Cocos', 'CD': 'RD Congo', 'CF': 'République centrafricaine',
  'CG': 'Congo', 'CH': 'Suisse', 'CI': 'Côte d\'Ivoire', 'CK': 'Îles Cook',
  'CL': 'Chili', 'CM': 'Cameroun', 'CN': 'Chine', 'CO': 'Colombie',
  'CR': 'Costa Rica', 'CU': 'Cuba', 'CV': 'Cap-Vert', 'CW': 'Curaçao',
  'CX': 'Île Christmas', 'CY': 'Chypre', 'CZ': 'Tchéquie', 'DE': 'Allemagne',
  'DJ': 'Djibouti', 'DK': 'Danemark', 'DM': 'Dominique', 'DO': 'République dominicaine',
  'DZ': 'Algérie', 'EC': 'Équateur', 'EE': 'Estonie', 'EG': 'Égypte',
  'EH': 'Sahara occidental', 'ER': 'Érythrée', 'ES': 'Espagne', 'ET': 'Éthiopie',
  'FI': 'Finlande', 'FJ': 'Fidji', 'FK': 'Îles Malouines', 'FM': 'Micronésie',
  'FO': 'Îles Féroé', 'FR': 'France', 'GA': 'Gabon', 'GB': 'Royaume-Uni',
  'GD': 'Grenade', 'GE': 'Géorgie', 'GF': 'Guyane française', 'GG': 'Guernesey',
  'GH': 'Ghana', 'GI': 'Gibraltar', 'GL': 'Groenland', 'GM': 'Gambie',
  'GN': 'Guinée', 'GP': 'Guadeloupe', 'GQ': 'Guinée équatoriale', 'GR': 'Grèce',
  'GS': 'Géorgie du Sud', 'GT': 'Guatemala', 'GU': 'Guam', 'GW': 'Guinée-Bissau',
  'GY': 'Guyane', 'HK': 'Hong Kong', 'HM': 'Îles Heard-et-MacDonald', 'HN': 'Honduras',
  'HR': 'Croatie', 'HT': 'Haïti', 'HU': 'Hongrie', 'ID': 'Indonésie',
  'IE': 'Irlande', 'IL': 'Israël', 'IM': 'Île de Man', 'IN': 'Inde',
  'IO': 'Territoire britannique de l\'océan Indien', 'IQ': 'Irak', 'IR': 'Iran',
  'IS': 'Islande', 'IT': 'Italie', 'JE': 'Jersey', 'JM': 'Jamaïque',
  'JO': 'Jordanie', 'JP': 'Japon', 'KE': 'Kenya', 'KG': 'Kirghizistan',
  'KH': 'Cambodge', 'KI': 'Kiribati', 'KM': 'Comores', 'KN': 'Saint-Kitts-et-Nevis',
  'KP': 'Corée du Nord', 'KR': 'Corée du Sud', 'KW': 'Koweït', 'KY': 'Îles Caïmans',
  'KZ': 'Kazakhstan', 'LA': 'Laos', 'LB': 'Liban', 'LC': 'Sainte-Lucie',
  'LI': 'Liechtenstein', 'LK': 'Sri Lanka', 'LR': 'Liberia', 'LS': 'Lesotho',
  'LT': 'Lituanie', 'LU': 'Luxembourg', 'LV': 'Lettonie', 'LY': 'Libye',
  'MA': 'Maroc', 'MC': 'Monaco', 'MD': 'Moldavie', 'ME': 'Monténégro',
  'MF': 'Saint-Martin', 'MG': 'Madagascar', 'MH': 'Îles Marshall', 'MK': 'Macédoine du Nord',
  'ML': 'Mali', 'MM': 'Myanmar', 'MN': 'Mongolie', 'MO': 'Macao',
  'MP': 'Îles Mariannes du Nord', 'MQ': 'Martinique', 'MR': 'Mauritanie', 'MS': 'Montserrat',
  'MT': 'Malte', 'MU': 'Maurice', 'MV': 'Maldives', 'MW': 'Malawi',
  'MX': 'Mexique', 'MY': 'Malaisie', 'MZ': 'Mozambique', 'NA': 'Namibie',
  'NC': 'Nouvelle-Calédonie', 'NE': 'Niger', 'NF': 'Île Norfolk', 'NG': 'Nigeria',
  'NI': 'Nicaragua', 'NL': 'Pays-Bas', 'NO': 'Norvège', 'NP': 'Népal',
  'NR': 'Nauru', 'NU': 'Niue', 'NZ': 'Nouvelle-Zélande', 'OM': 'Oman',
  'PA': 'Panama', 'PE': 'Pérou', 'PF': 'Polynésie française', 'PG': 'Papouasie-Nouvelle-Guinée',
  'PH': 'Philippines', 'PK': 'Pakistan', 'PL': 'Pologne', 'PM': 'Saint-Pierre-et-Miquelon',
  'PN': 'Pitcairn', 'PR': 'Porto Rico', 'PS': 'Palestine', 'PT': 'Portugal',
  'PW': 'Palaos', 'PY': 'Paraguay', 'QA': 'Qatar', 'RE': 'La Réunion',
  'RO': 'Roumanie', 'RS': 'Serbie', 'RU': 'Russie', 'RW': 'Rwanda',
  'SA': 'Arabie saoudite', 'SB': 'Salomon', 'SC': 'Seychelles', 'SD': 'Soudan',
  'SE': 'Suède', 'SG': 'Singapour', 'SH': 'Sainte-Hélène', 'SI': 'Slovénie',
  'SJ': 'Svalbard', 'SK': 'Slovaquie', 'SL': 'Sierra Leone', 'SM': 'Saint-Marin',
  'SN': 'Sénégal', 'SO': 'Somalie', 'SR': 'Suriname', 'SS': 'Soudan du Sud',
  'ST': 'São Tomé-et-Príncipe', 'SV': 'Salvador', 'SX': 'Saint-Martin', 'SY': 'Syrie',
  'SZ': 'Eswatini', 'TC': 'Îles Turques-et-Caïques', 'TD': 'Tchad', 'TF': 'Terres australes françaises',
  'TG': 'Togo', 'TH': 'Thaïlande', 'TJ': 'Tadjikistan', 'TK': 'Tokelau',
  'TL': 'Timor oriental', 'TM': 'Turkménistan', 'TN': 'Tunisie', 'TO': 'Tonga',
  'TR': 'Turquie', 'TT': 'Trinité-et-Tobago', 'TV': 'Tuvalu', 'TW': 'Taïwan',
  'TZ': 'Tanzanie', 'UA': 'Ukraine', 'UG': 'Ouganda', 'UM': 'Îles mineures éloignées des États-Unis',
  'US': 'États-Unis', 'UY': 'Uruguay', 'UZ': 'Ouzbékistan', 'VA': 'Vatican',
  'VC': 'Saint-Vincent-et-les-Grenadines', 'VE': 'Venezuela', 'VG': 'Îles Vierges britanniques',
  'VI': 'Îles Vierges américaines', 'VN': 'Viêt Nam', 'VU': 'Vanuatu', 'WF': 'Wallis-et-Futuna',
  'WS': 'Samoa', 'YE': 'Yémen', 'YT': 'Mayotte', 'ZA': 'Afrique du Sud',
  'ZM': 'Zambie', 'ZW': 'Zimbabwe', 'XX': 'Inconnu'
};

// Détecter le pays depuis les coordonnées GPS via Nominatim
export const detectCountryFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=3`
    );
    const data = await response.json();
    
    // Nominatim retourne le code pays en ISO 3166-1 alpha-2
    const countryCode = data.address?.country_code?.toUpperCase();
    
    if (countryCode && countryCode.length === 2) {
      return countryCode;
    }
    
    return null;
  } catch (error) {
    console.error('Error detecting country:', error);
    return null;
  }
};

// Obtenir le nom du pays depuis son code
export const getCountryName = (code: string): string => {
  return COUNTRY_NAMES[code.toUpperCase()] || code;
};

// Obtenir le drapeau emoji depuis le code pays
export const getCountryFlag = (code: string): string => {
  if (!code || code.length !== 2) return '🌍';
  
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
};

// Liste des pays les plus populaires (pour le sélecteur)
export const POPULAR_COUNTRIES = [
  { code: 'GN', name: 'Guinée', flag: '🇬🇳' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
];

