// Script to generate PWA icons from SVG
// Requires: npm install sharp (or use online tool)
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG template for icon
const svgTemplate = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="grad" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4c1d95;stop-opacity:1" />
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#030712" rx="20%"/>
  <circle cx="256" cy="256" r="230" fill="url(#grad)"/>
  <g transform="translate(256, 240)">
    <path d="M 0 -80 L -60 0 L 0 50 L 60 0 Z" fill="white" stroke="#030712" stroke-width="8"/>
    <circle cx="0" cy="-10" r="25" fill="#7c3aed"/>
  </g>
</svg>
`;

console.log('Generating PWA icons...');
console.log('Note: This script generates SVG files. For PNG conversion, use an online tool or install sharp.');
console.log('Recommended: Use https://realfavicongenerator.net/ or similar tool to convert SVG to PNG\n');

sizes.forEach(size => {
  const svg = svgTemplate(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`✓ Generated ${filename}`);
});

// Also create a 32x32 favicon
const faviconSvg = svgTemplate(32);
fs.writeFileSync(path.join(iconsDir, 'icon-32x32.svg'), faviconSvg);
console.log('✓ Generated icon-32x32.svg');

console.log('\n✅ Icon generation complete!');
console.log('\nNext steps:');
console.log('1. Convert SVG files to PNG using an online tool like:');
console.log('   - https://realfavicongenerator.net/');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('2. Or install sharp: npm install sharp --save-dev');
console.log('3. Place PNG files in public/icons/ directory');

