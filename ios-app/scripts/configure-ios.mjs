import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(appRoot, '..');
const target = path.join(appRoot, 'ios', 'App', 'App');
const plist = path.join(target, 'Info.plist');
if (!fs.existsSync(plist)) throw new Error('iOS project missing; run npm run ios:init');

function plistValue(key, type, value) {
  const tool = '/usr/libexec/PlistBuddy';
  const existing = spawnSync(tool, ['-c', 'Print :' + key, plist], { encoding: 'utf8' });
  const command = existing.status === 0
    ? 'Set :' + key + ' ' + value
    : 'Add :' + key + ' ' + type + ' ' + value;
  const result = spawnSync(tool, ['-c', command, plist], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('PlistBuddy: ' + result.stderr);
}
plistValue('CFBundleDisplayName', 'string', "Thomas' Pub Golf");
plistValue('NSCameraUsageDescription', 'string', "Maak een foto voor je Pub Golf-spelersprofiel.");
plistValue('NSPhotoLibraryUsageDescription', 'string', 'Kies een profielfoto voor je Pub Golf-spelersprofiel.');
plistValue('NSPhotoLibraryAddUsageDescription', 'string', 'Sla een gekozen foto op als je dat zelf wilt.');
plistValue('ITSAppUsesNonExemptEncryption', 'bool', 'false');

const iconDir = path.join(target, 'Assets.xcassets', 'AppIcon.appiconset');
fs.mkdirSync(iconDir, { recursive: true });
await sharp(path.join(repoRoot, 'assets', 'icon-512.png'))
  .resize(1024, 1024)
  .flatten({ background: '#12352c' })
  .png()
  .toFile(path.join(iconDir, 'AppIcon.png'));
fs.writeFileSync(path.join(iconDir, 'Contents.json'), JSON.stringify({
  images: [{ filename: 'AppIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 }
}, null, 2) + '\n');
console.info('Configured privacy strings, export compliance and 1024px opaque app icon.');
