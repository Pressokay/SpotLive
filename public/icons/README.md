# PWA Icons

This directory contains the icons for the SpotLive Progressive Web App.

## Required Icon Sizes

The following icon sizes are required for full PWA support:

- `icon-32x32.png` - Favicon
- `icon-72x72.png` - Android
- `icon-96x96.png` - Android
- `icon-128x128.png` - Chrome
- `icon-144x144.png` - Android
- `icon-152x152.png` - iOS
- `icon-192x192.png` - Android (required)
- `icon-384x384.png` - Android
- `icon-512x512.png` - Android (required, maskable)

## Generating Icons

### Option 1: Online Tool (Recommended for MVP)

1. Use the SVG file `icon.svg` as source
2. Go to https://realfavicongenerator.net/
3. Upload `icon.svg`
4. Configure settings:
   - Android: Enable all sizes
   - iOS: Enable all sizes
   - Favicon: Enable
5. Download and extract PNG files to this directory

### Option 2: Manual Conversion

1. Open `icon.svg` in an image editor (Inkscape, Figma, etc.)
2. Export as PNG at each required size
3. Save with the naming convention: `icon-{size}x{size}.png`

### Option 3: Using Sharp (Node.js)

```bash
npm install sharp --save-dev
node scripts/generate-icons-with-sharp.js
```

## Icon Design Guidelines

- Use the provided SVG (`icon.svg`) as the base
- Ensure icons are square (1:1 aspect ratio)
- Use maskable icons for Android (safe zone: 80% of icon)
- Background color: `#030712` (dark gray)
- Primary color: `#7c3aed` (purple)
- Icon should be recognizable at small sizes (32x32)

## Current Status

⚠️ Placeholder icons are currently in place. Replace with actual PNG icons before production deployment.

