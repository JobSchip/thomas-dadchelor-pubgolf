import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const output = path.resolve(appRoot, 'www');
const backend = process.env.PUBGOLF_API_URL || 'https://thomas-pubgolf-production.up.railway.app';

if (!/^https:\/\/[-\w.]+(?::\d+)?$/.test(backend)) {
  throw new Error('PUBGOLF_API_URL must be a simple HTTPS origin without a path');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['app.js', 'styles.css', 'manifest.webmanifest']) {
  fs.copyFileSync(path.join(repoRoot, name), path.join(output, name));
}
fs.cpSync(path.join(repoRoot, 'assets'), path.join(output, 'assets'), { recursive: true });
let html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const scriptTag = /<script src="\.\/app\.js(?:\?v=\d+)?" defer><\/script>/;
if (!scriptTag.test(html)) throw new Error('Cannot find app.js script in source index.html');
html = html.replace(scriptTag,
  '<script src="./native-config.js"></script>\n' +
  '<script src="./native.js" defer></script>\n' +
  '<script src="./app.js" defer></script>');
html = html.replace(/\.\/styles\.css\?v=\d+/, './styles.css');
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, 'native-config.js'),
  'window.__PUBGOLF_NATIVE__ = true;\n' +
  'window.__PUBGOLF_API_BASE__ = ' + JSON.stringify(backend) + ';\n');
console.info('Bundled local Pub Golf web views into ios-app/www (API:', backend + ')');
