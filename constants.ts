import { User, Story } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  username: 'GlobalExplorer',
  avatarUrl: 'https://picsum.photos/seed/user1/100/100',
  isGuest: false
};

// Known Neighborhood Centroids for auto-assignment (Conakry context)
export const KNOWN_NEIGHBORHOODS = [
  { name: 'Kaloum', lat: 9.515, lon: -13.710 },
  { name: 'Dixinn', lat: 9.545, lon: -13.690 },
  { name: 'Taouyah', lat: 9.580, lon: -13.680 },
  { name: 'Ratoma', lat: 9.605, lon: -13.650 },
  { name: 'Kipe', lat: 9.620, lon: -13.630 },
  { name: 'Lambanyi', lat: 9.635, lon: -13.610 }
];

// Initial stories - empty by default for MVP
// Users will create their own stories
export const INITIAL_STORIES: Story[] = [];

export const FILTERS = ['All', 'Near Me', 'Trending'];