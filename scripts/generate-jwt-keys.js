/**
 * Генерация RSA 4096 ключей для JWT (auth-service).
 * Файлы всегда создаются в apps/auth-service/keys/ относительно корня репозитория.
 * Запуск: из корня репо — node scripts/generate-jwt-keys.js или pnpm run keys:generate
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const keysDir = path.join(repoRoot, 'apps', 'auth-service', 'keys');
const privatePath = path.join(keysDir, 'private.pem');
const publicPath = path.join(keysDir, 'public.pem');

fs.mkdirSync(keysDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(privatePath, privateKey);
fs.writeFileSync(publicPath, publicKey);

console.log('JWT keys generated successfully:');
console.log('  ', privatePath);
console.log('  ', publicPath);
