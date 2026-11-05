import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const mobileRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repoRoot=path.resolve(mobileRoot,'..');
const src=path.join(repoRoot,'assets','icon-512.png');
const app=path.join(mobileRoot,'android','app','src','main');
const resources=path.join(app,'res');
if (!fs.existsSync(path.join(app,'AndroidManifest.xml'))) {
 throw new Error('Android project ontbreekt: voer eerst npm run android:init uit');
}
const name="Thomas' Pub Golf";
const xmlEscape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'\\');

// Capacitor generated strings should remain stable across app updates.
const stringFile=path.join(resources,'values','strings.xml');
let strings=fs.readFileSync(stringFile,'utf8');
for (const [key,value] of [['app_name',name],['title_activity_main',name]]) {
 const rx=new RegExp('(<string\\s+name=["\\x27]'+key+'["\\x27]>)[\\s\\S]*?(<\\/string>)');
 if (!rx.test(strings)) throw new Error('Android string not found: '+key);
 strings=strings.replace(rx,(_match,head,tail)=>head+xmlEscape(value)+tail);
}
fs.writeFileSync(stringFile,strings);

// Disable device backup of local player/photo cache (server is the shared source).
const manifestFile=path.join(app,'AndroidManifest.xml');
let manifest=fs.readFileSync(manifestFile,'utf8');
if (!manifest.includes('android.permission.INTERNET')) throw new Error('Missing Android internet permission');
if (/android:allowBackup=["\x27][^"\x27]+["\x27]/.test(manifest))
 manifest=manifest.replace(/android:allowBackup=["\x27][^"\x27]+["\x27]/,'android:allowBackup="false"');
else manifest=manifest.replace(/<application\b/,'<application android:allowBackup="false"');
fs.writeFileSync(manifestFile,manifest);

// Android launcher icons use a fixed opaque base with a safe-size centered foreground.
const densities=[['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]];
for (const [density,mult] of densities) {
 const dir=path.join(resources,'mipmap-'+density);fs.mkdirSync(dir,{recursive:true});
 const legacy=Math.round(48*mult),foreground=Math.round(108*mult),image=Math.round(69*mult);
 const flat=await sharp(src).resize(legacy,legacy).flatten({background:'#12352c'}).png().toBuffer();
 for(const filename of ['ic_launcher.png','ic_launcher_round.png'])
  fs.writeFileSync(path.join(dir,filename),flat);
 const symbol=await sharp(src).resize(image,image).png().toBuffer();
 const layered=await sharp({create:{width:foreground,height:foreground,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
  .composite([{input:symbol,left:Math.floor((foreground-image)/2),top:Math.floor((foreground-image)/2)}])
  .png().toBuffer();
 fs.writeFileSync(path.join(dir,'ic_launcher_foreground.png'),layered);
}
fs.mkdirSync(path.join(resources,'values'),{recursive:true});
fs.writeFileSync(path.join(resources,'values','pubgolf_icon_background.xml'),
 '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="pubgolf_icon_background">#12352c</color></resources>\n');
const adaptiveDir=path.join(resources,'mipmap-anydpi-v26');
fs.mkdirSync(adaptiveDir,{recursive:true});
const adaptive='<?xml version="1.0" encoding="utf-8"?>\n'+
 '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'+
 '  <background android:drawable="@color/pubgolf_icon_background" />\n'+
 '  <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'+
 '</adaptive-icon>\n';
for(const filename of ['ic_launcher.xml','ic_launcher_round.xml'])
 fs.writeFileSync(path.join(adaptiveDir,filename),adaptive);
console.info('Android configured: brand name, five launcher-icon densities, adaptive icon and backup privacy.');
