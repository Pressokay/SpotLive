<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SpotLive - Progressive Web App

A mobile-first social discovery app for real-time urban vibes. Discover what's happening around you through location-based stories.

View your app in AI Studio: https://ai.studio/apps/drive/1lGHn8sZsWLZxN3mPshaLcOs9zL4__PSX

## Features

- 📍 **Location-based Stories** - Share and discover stories at specific locations
- 🗺️ **Interactive Map** - Visualize spots and stories on a map
- 📸 **Camera Integration** - Capture photos and videos directly in the app
- 🔥 **Real-time Vibes** - Stories expire after 24 hours for fresh content
- 📱 **PWA Ready** - Install as a native app on Android and iOS (no app store needed!)
- 🌍 **Works Everywhere** - Uses your device's geolocation

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and add your `GEMINI_API_KEY`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Generate PWA icons (optional, for production):
   ```bash
   node scripts/create-icons-simple.js
   ```
   Then replace placeholder icons with real PNG files (see `public/icons/README.md`)

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

## Building for Production

```bash
npm run build
npm run preview
```

## Installing as PWA (Mobile App)

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (3 dots)
3. Select "Add to Home screen" or "Install app"
4. The app will appear as a native app icon

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will appear as a native app icon

## Deployment

### Recommended: Vercel (Free, HTTPS included)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variable `GEMINI_API_KEY`
4. Deploy!

The app will be available at `https://your-app.vercel.app` with HTTPS (required for PWA).

### Alternative: Netlify

1. Push your code to GitHub
2. Import project in [Netlify](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variable `GEMINI_API_KEY`

## PWA Features

- ✅ Service Worker for offline support
- ✅ App manifest for installation
- ✅ Responsive design for mobile
- ✅ Camera and geolocation APIs
- ✅ Standalone app experience

## Project Structure

```
├── components/       # React components
├── services/         # API services (Gemini)
├── public/           # Static assets
│   ├── icons/       # PWA icons
│   └── sw.js        # Service Worker
├── scripts/         # Utility scripts
└── index.tsx        # App entry point
```

## Notes

- Stories are currently stored in memory (lost on refresh)
- For production, consider adding a backend (Firebase, Supabase, etc.)
- Gemini API key is exposed client-side (use a backend proxy for production)
- PWA requires HTTPS in production (Vercel/Netlify provide this free)

## License

MIT
