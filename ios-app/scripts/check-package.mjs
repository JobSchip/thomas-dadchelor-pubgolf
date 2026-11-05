import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(app, 'www');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const native = fs.readFileSync(path.join(dir, 'native-config.js'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const required = ['app.js', 'styles.css', 'native-config.js', 'manifest.webmanifest', 'assets/icon-512.png', 'assets/thomas-1.webp', 'assets/thomas-4.webp'];
for (const filename of required) {
  if (!fs.existsSync(path.join(dir, filename))) throw new Error('Missing: ' + filename);
}
if (!html.includes('src="./native-config.js"') || !html.includes('src="./native.js"') || !html.includes('src="./app.js"')) {
  throw new Error('Missing native bootstrap scripts or incorrect script order');
}
if (!native.includes('__PUBGOLF_API_BASE__') || !native.includes('https://thomas-pubgolf-production.up.railway.app')) {
  throw new Error('Unexpected iOS API endpoint');
}
if (!js.includes('API_BASE+"/api/action') || !js.includes('API_BASE+"/api/state')) {
  throw new Error('Bundled app is not using API_BASE for the multiplayer API');
}
new Function(js);
console.info('iOS web bundle integrity checks passed (local views + remote Railway API).');
