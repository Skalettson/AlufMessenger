/**
 * Генерация иконок для PWA из favicon.ico
 * Запуск: node scripts/generate-icons.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

// Создаем SVG иконку как основу
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0088CC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#006699;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Фон -->
  <rect width="512" height="512" rx="100" fill="url(#grad)"/>
  <!-- Бумажный самолетик -->
  <path d="M120 256 L380 140 L340 380 L256 300 L120 256 Z M256 300 L380 140 L256 220 L256 300 Z" 
        fill="white" 
        stroke="white" 
        stroke-width="8"
        stroke-linejoin="round"/>
</svg>
`;

async function generateIcons() {
  const svgBuffer = Buffer.from(svgIcon);
  
  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 48, name: 'icon-48.png' },
    { size: 96, name: 'icon-96.png' },
    { size: 144, name: 'icon-144.png' },
    { size: 72, name: 'icon-72.png' },
  ];

  for (const { size, name } of sizes) {
    const outputPath = path.join(publicDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: ${name} (${size}x${size})`);
  }

  // Маскируемая иконка (без padding)
  const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0088CC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#006699;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#grad)"/>
  <path d="M100 256 L400 120 L360 400 L256 310 L100 256 Z M256 310 L400 120 L256 230 L256 310 Z" 
        fill="white" 
        stroke="white" 
        stroke-width="8"
        stroke-linejoin="round"/>
</svg>
`;
  
  const maskableBuffer = Buffer.from(maskableSvg);
  const maskablePath = path.join(publicDir, 'icon-512-maskable.png');
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(maskablePath);
  console.log('Created: icon-512-maskable.png (512x512)');

  console.log('\nIcons generated successfully!');
}

generateIcons().catch(console.error);
