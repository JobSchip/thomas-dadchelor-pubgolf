'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const {URL}=require('node:url');
const root=__dirname;
const dataDir=process.env.DATA_DIR||path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true});
const port=Number(process.env.PORT)||3000;
const resetEpoch='THOMAS-NOV05-FULL-RESET-4';
const resetRoom='THOMAS-OPEN';
const resetMarker=path.join(dataDir,'.pubgolf-full-reset-20261105-v4');
if(!fs.existsSync(resetMarker)){
 const gameFile=path.join(dataDir,resetRoom+'.json');
 try{
  let lastRevision=0;
  if(fs.existsSync(gameFile)){
   try{lastRevision=Number(JSON.parse(fs.readFileSync(gameFile,'utf8')).revision)||0}catch{}
  }
  const clean={players:[],revision:lastRevision+1,updatedAt:Date.now(),seenActions:[],epoch:resetEpoch};
  const temp=gameFile+'.full-reset-tmp';
  fs.writeFileSync(temp,JSON.stringify(clean),'utf8');
  fs.renameSync(temp,gameFile);
  fs.writeFileSync(resetMarker,new Date().toISOString(),'utf8');
  console.info('PubGolf volledige reset uitgevoerd — THOMAS-OPEN: 0 spelers, profielfotos, scores en bonussen');
 }catch(error){console.error('PubGolf volledige reset mislukt:',error.message)}
}

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.mp4':'video/mp4','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8'};
const initial=()=>({players:[],revision:0,updatedAt:Date.now(),seenActions:[],epoch:resetEpoch});
function roomName(requestUrl){return String(requestUrl.searchParams.get('room')||'THOMAS').toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,24)||'THOMAS'}
function roomFile(room){return path.join(dataDir,room+'.json')}
function load(room){try{const s=JSON.parse(fs.readFileSync(roomFile(room),'utf8'));if(!Array.isArray(s.players)|| (room===resetRoom&&s.epoch!==resetEpoch))return initial();s.seenActions=Array.isArray(s.seenActions)?s.seenActions:[];return s}catch{return initial()}}
function save(room,s){const dest=roomFile(room);const tmp=dest+'.tmp';fs.writeFileSync(tmp,JSON.stringify(s));fs.renameSync(tmp,dest)}
function publicState(s){return {players:s.players,revision:s.revision,updatedAt:s.updatedAt,epoch:resetEpoch}}
function json(res,code,obj,req){
 const raw=Buffer.from(JSON.stringify(obj));
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Accept-Encoding, Origin'};
 const accept=String(req?.headers?.['accept-encoding']||'');
 if(raw.length>2048&&accept.includes('br')){headers['content-encoding']='br';res.writeHead(code,headers);return res.end(zlib.brotliCompressSync(raw,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:3}}))}
 if(raw.length>2048&&accept.includes('gzip')){headers['content-encoding']='gzip';res.writeHead(code,headers);return res.end(zlib.gzipSync(raw,{level:4}))}
 res.writeHead(code,headers);return res.end(raw);
}
const assetCache=new Map();
function staticAsset(file){
 const stat=fs.statSync(file),record=assetCache.get(file);
 if(record&&record.mtimeMs===stat.mtimeMs&&record.size===stat.size)return record;
 const raw=fs.readFileSync(file);
 const compressible=/\.(html|css|js|webmanifest|json)$/.test(file);
 const entry={mtimeMs:stat.mtimeMs,size:stat.size,etag:'W/"'+stat.size+'-'+Math.floor(stat.mtimeMs)+'"',raw,
  br:compressible?zlib.brotliCompressSync(raw,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}}):null,
  gzip:compressible?zlib.gzipSync(raw,{level:5}):null};
 assetCache.set(file,entry);return entry;
}
function validId(id){return typeof id==='string'&&id.length>0&&id.length<=80&&/^[\w-]+$/.test(id)}
function act(s,a){if(!a||!validId(a.id)||typeof a.type!=='string')return 'Ongeldige wijziging';if(s.seenActions.includes(a.id))return null;
 if(a.type==='addPlayer'){
  if(!a.player||!validId(a.player.id)||typeof a.player.name!=='string')return 'Ongeldige speler';const name=a.player.name.trim().replace(/\s+/g,' ');if(name.length<2||name.length>32)return 'Spelersnaam moet 2-32 tekens zijn';if(s.players.length>=32)return 'Maximaal 32 spelers';if(s.players.some(p=>p.id===a.player.id||p.name.toLowerCase()===name.toLowerCase()))return 'Speler bestaat al';s.players.push({id:a.player.id,name,avatar:typeof a.player.avatar==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.player.avatar)&&a.player.avatar.length<60000?a.player.avatar:'',scores:Array(6).fill(null),salmari:0,checkin:null,answers:{},nomination:null});
 }else if(a.type==='setScore'){
  const p=s.players.find(p=>p.id===a.playerId);if(!p)return 'Speler niet gevonden';if(!Number.isInteger(a.hole)||a.hole<0||a.hole>5)return 'Ongeldige hole';if(!Number.isInteger(a.value)||a.value<1||a.value>99)return 'Ongeldige score';if(Number.isInteger(p.scores[a.hole]))return 'Score is definitief en kan niet worden aangepast';p.scores[a.hole]=a.value;
 }else if(a.type==='setSalmari'){
  const p=s.players.find(p=>p.id===a.playerId);if(!p)return 'Speler niet gevonden';if(Number.isInteger(p.scores?.[5]))return 'De laatste ronde is afgerond';if(!Number.isInteger(a.value)||a.value<1||a.value>30)return 'Ongeldige bonus';if(a.value!==(p.salmari||0)+1)return 'Salmari kan alleen met één shot tegelijk worden opgehoogd';p.salmari=a.value;
 }else if(a.type==='setCheckin'){
  const p=s.players.find(p=>p.id===a.playerId);if(!p)return 'Speler niet gevonden';
  if(!Number.isInteger(a.value)||a.value<0||a.value>3)return 'Ongeldige check-in';
  p.checkin=a.value;
 }else if(a.type==='answerRound'){
  const p=s.players.find(p=>p.id===a.playerId);if(!p)return 'Speler niet gevonden';
  const valid={one:['blue','pink','rainbow'],two:['10','12','14','16','18','20','22','25'],four:['Thomas','THOMAS','thomas','misschien-thomas']};
  if(!Object.prototype.hasOwnProperty.call(valid,a.round)||!valid[a.round].includes(a.choice))return 'Ongeldig antwoord';
  if(!p.answers||typeof p.answers!=='object')p.answers={};
  if(Object.prototype.hasOwnProperty.call(p.answers,a.round))return 'Deze vraag is al beantwoord';
  p.answers[a.round]=a.choice;
 }else if(a.type==='nominate'){
  const p=s.players.find(p=>p.id===a.playerId);
  if(!p)return 'Speler niet gevonden';
  if(typeof p.nomination==='string'&&p.nomination.length)return 'Er is al iemand gekozen';
  if(!validId(a.targetPlayerId)||!s.players.some(x=>x.id===a.targetPlayerId))return 'Speler niet gevonden';if(s.players.length>1&&a.targetPlayerId===a.playerId)return 'Kies een andere golfer';
  p.nomination=a.targetPlayerId;
 }else if(a.type==='setAvatar'){
  const p=s.players.find(p=>p.id===a.playerId);if(!p)return 'Speler niet gevonden';if(typeof a.avatar!=='string'||a.avatar.length>60000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(a.avatar))return 'Ongeldige profielfoto';p.avatar=a.avatar;
 }else if(a.type==='removePlayer'){
  if(!validId(a.playerId))return 'Ongeldige speler';s.players=s.players.filter(p=>p.id!==a.playerId);
 }else return 'Onbekende wijziging';
 s.revision=(s.revision||0)+1;s.updatedAt=Date.now();s.seenActions.push(a.id);if(s.seenActions.length>600)s.seenActions=s.seenActions.slice(-450);return null;
}
const nativeOrigins=new Set(['capacitor://localhost','http://localhost','https://localhost']);
function allowNativeOrigin(req,res){
 const origin=String(req.headers.origin||'');
 if(nativeOrigins.has(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
 }
}
const server=http.createServer((req,res)=>{
  let url;try{url=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'Ongeldige URL'})}
  if(url.pathname.startsWith('/api/')){
    allowNativeOrigin(req,res);
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Cache-Control':'no-store','Vary':'Origin'});
      return res.end();
    }
  }
  if(url.pathname==='/api/state'&&req.method==='GET'){
    const current=load(roomName(url));
    const sinceRaw=url.searchParams.get('since');
    if(sinceRaw!==null&&/^\d+$/.test(sinceRaw)&&Number(sinceRaw)===current.revision&&current.epoch===resetEpoch){
      return json(res,200,{unchanged:true,revision:current.revision,epoch:resetEpoch},req);
    }
    return json(res,200,publicState(current),req);
  }
  if(url.pathname==='/api/action'&&req.method==='POST'){
    let body='',oversize=false;
    req.on('data',chunk=>{body+=chunk;if(body.length>110000){oversize=true;req.destroy()}});
    req.on('end',()=>{if(oversize)return json(res,413,{error:'Te groot'});let action;try{action=JSON.parse(body)}catch{return json(res,400,{error:'Ongeldige JSON'})}if(action.epoch!==resetEpoch)return json(res,409,{error:'Laad de nieuwe app-versie opnieuw'});const room=roomName(url),s=load(room);const err=act(s,action);if(err)return json(res,400,{error:err});try{save(room,s)}catch(e){console.error(e);return json(res,500,{error:'Opslaan mislukt'})}return json(res,200,publicState(s),req)});return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Methode niet toegestaan'});
  const pathname=decodeURIComponent(url.pathname);const requested=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');const file=path.resolve(root,requested);
  if(!file.startsWith(root+path.sep)||(file===dataDir||file.startsWith(dataDir+path.sep))||path.basename(file).startsWith('.')||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{error:'Niet gevonden'});
  const asset=staticAsset(file);
  const isDocument=file.endsWith('index.html')||file.endsWith('sw.js');
  const versioned=url.searchParams.has('v');
  const headers={
   'Content-Type':types[path.extname(file)]||'application/octet-stream',
   'Cache-Control':isDocument?'no-cache':versioned?'public, max-age=31536000, immutable':'public, max-age=3600',
   'X-Content-Type-Options':'nosniff',
   'ETag':asset.etag,
   'Vary':'Accept-Encoding'
  };
  if(file.endsWith('.mp4')){
   const total=asset.raw.length;
   headers['Accept-Ranges']='bytes';
   const range=String(req.headers.range||'');
   if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!match||(match[1]===''&&match[2]==='')){
     res.writeHead(416,{...headers,'Content-Range':'bytes */'+total,'Content-Length':0});return res.end();
    }
    let start=match[1]===''?Math.max(0,total-Number(match[2])):Number(match[1]);
    let end=match[2]===''||match[1]===''?total-1:Number(match[2]);
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||end<start){
     res.writeHead(416,{...headers,'Content-Range':'bytes */'+total,'Content-Length':0});return res.end();
    }
    end=Math.min(total-1,end);
    headers['Content-Range']='bytes '+start+'-'+end+'/'+total;
    headers['Content-Length']=end-start+1;
    res.writeHead(206,headers);
    return req.method==='HEAD'?res.end():res.end(asset.raw.subarray(start,end+1));
   }
  }
  if(req.headers['if-none-match']===asset.etag){res.writeHead(304,headers);return res.end()}
  const accept=String(req.headers['accept-encoding']||'');
  let output=asset.raw;
  if(asset.br&&accept.includes('br')){headers['Content-Encoding']='br';output=asset.br}
  else if(asset.gzip&&accept.includes('gzip')){headers['Content-Encoding']='gzip';output=asset.gzip}
  headers['Content-Length']=output.length;
  res.writeHead(200,headers);
  if(req.method==='HEAD')return res.end();
  return res.end(output);
});
if(require.main===module)server.listen(port,'0.0.0.0',()=>console.log(`Thomas' Pub Golf live at http://localhost:${port}`));
module.exports={server,act,initial,publicState};
