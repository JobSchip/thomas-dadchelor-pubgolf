import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradle = path.join(project, 'android', 'gradlew');
if (fs.existsSync(gradle)) {
 console.info('Existing Android Studio project found.');
 process.exit(0);
}
const r = spawnSync('npx', ['cap', 'add', 'android'], {cwd:project,stdio:'inherit'});
if (r.status !== 0) process.exit(r.status || 1);
console.info('Android Studio project generated at ios-app/android/');
