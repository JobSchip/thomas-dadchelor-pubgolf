import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'darwin') {
  console.error('iOS project generation requires macOS and Xcode. Use GitHub Actions if you do not have a Mac.');
  process.exit(1);
}
if (fs.existsSync(path.join(project, 'ios', 'App', 'App.xcodeproj'))) {
  console.info('Existing native Xcode project found.');
  process.exit(0);
}
const result = spawnSync('npx', ['cap', 'add', 'ios'], { cwd: project, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.info('Created ios/App/App.xcworkspace');
