(function appMain(){
"use strict";
const HOLES=[
  {venue:"Jopen",drink:"Mooie Nel IPA",details:"Halve liter",par:8,visual:"ipa"},
  {venue:"Tierney's Irish Pub",drink:"Guinness",details:"Pint",par:10,visual:"stout"},
  {venue:"Proeflokaal In den Uiver",drink:"Halve liter bier",details:"50 cl",par:8,visual:"mug"},
  {venue:"Bierlokaal de Uiver",drink:"Fluitje",details:"Hole-in-one",par:1,visual:"flute",special:true},
  {venue:"Café De Lift",drink:"Brugse Zot",details:"33 cl",par:7,visual:"chalice"},
  {venue:"Café Studio",drink:"Vaasje",details:"25 cl",par:9,visual:"vaasje"}
];
const q=new URLSearchParams(location.search);
const room=(q.get("room")||localStorage.getItem("golf-room")||"THOMAS-OPEN").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,24)||"THOMAS-OPEN";
q.set("room",room);
history.replaceState(null,"",location.pathname+"?"+q.toString());
localStorage.setItem("golf-room",room);
const RESET_EPOCH="THOMAS-NOV05-FULL-RESET-4";
const API_BASE=String(globalThis.__PUBGOLF_API_BASE__||"").replace(/\/+$/,"");
const isNative=()=>globalThis.__PUBGOLF_NATIVE__===true;
function nativeFeedback(kind="light"){
 if(!isNative())return;
 try{window.dispatchEvent(new CustomEvent("pubgolf:haptic",{detail:{kind}}))}catch{}
}
const storeKey="golf-v5-"+room,meKey="golf-me-v5-"+room,queueKey="golf-queue-v5-"+room;
// Clear test data and profile photos saved by older app versions on this device.
for(const prefix of ["golf-v3-","golf-v4-","golf-me-","golf-me-v4-","golf-queue-","golf-queue-v4-"]){
 try{localStorage.removeItem(prefix+room)}catch{}
}
const parse=(raw,fallback)=>{try{return JSON.parse(raw)||fallback}catch{return fallback}};
let state=parse(localStorage.getItem(storeKey),{players:[],revision:0,epoch:RESET_EPOCH});
let queue=parse(localStorage.getItem(queueKey),[]);
let myId=localStorage.getItem(meKey)||"",view="welcome",hole=0,strokes=8,selectedPlayerId="";
let network=false,flushing=false,polling=false,toastTimer,avatarDraft="",checkinChoice=-1,aceTimer=null,questionResult={},nomineeDraft="",pourReady=false,thomolRound=null,thomolPopTimer=null,thomolTickTimer=null,pluimRound=null,pluimTickTimer=null,pluimNextTimer=null;
const el=id=>document.getElementById(id);
const escapeHtml=text=>String(text??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const newId=()=>globalThis.crypto?.randomUUID?.()||"x"+Date.now().toString(36)+Math.random().toString(36).slice(2);
const me=()=>state.players.find(p=>p.id===myId);
const save=()=>{localStorage.setItem(storeKey,JSON.stringify(state));localStorage.setItem(queueKey,JSON.stringify(queue))};
function score(p){
 const arr=Array.isArray(p.scores)?p.scores:[];
 let total=0,par=0,completed=0;
 arr.forEach((val,i)=>{if(Number.isInteger(val)&&i<6){total+=val;par+=HOLES[i].par;completed++}});
 const answer=p.answers||{};
 let adjustment=-(p.salmari||0)-(p.checkin===3?1:0)-(p.thomolHits||0)-(p.pluimHits||0);
 if(answer.one==='blue')adjustment-=1;
 else if(answer.one==='pink')adjustment+=1;
 else if(answer.one==='rainbow')adjustment+=2;
 if(answer.two)adjustment+=answer.two==='18'?-1:1;
 if(answer.four)adjustment-=1;
 const gifts=state.players.filter(x=>x.nomination===p.id).length;
 adjustment-=gifts;
 return {completed,total,net:total+adjustment,relative:total+adjustment-par,bonus:-adjustment,gifts};
}
// Most completed holes first; on equal progress the lowest relative score wins.
 // Ties follow the chronological player registration order, not alphabetical order.
 const leaders=()=>state.players.map((p,index)=>({p,index}))
  .sort((a,b)=>score(b.p).completed-score(a.p).completed||score(a.p).relative-score(b.p).relative||a.index-b.index)
  .map(({p})=>p);
function notify(message){
 const toast=el("toast");toast.textContent=message;toast.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("visible"),2300);
}
function apply(s,a){
 const p=s.players.find(p=>p.id===a.playerId);
 if(a.type==="addPlayer"&&!s.players.some(x=>x.id===a.player.id)){
  s.players.push({...a.player,scores:Array(6).fill(null),salmari:0,checkin:null,answers:{},nomination:null,thomolHits:null,pluimHits:null});
 }else if(a.type==="setScore"&&p&&!Number.isInteger(p.scores[a.hole]))p.scores[a.hole]=a.value;
 else if(a.type==="setSalmari"&&p)p.salmari=a.value;
 else if(a.type==="setAvatar"&&p)p.avatar=a.avatar;
 else if(a.type==="setCheckin"&&p)p.checkin=a.value;
 else if(a.type==="answerRound"&&p){p.answers=p.answers||{};p.answers[a.round]=a.choice;}
 else if(a.type==="nominate"&&p)p.nomination=a.targetPlayerId;
 else if(a.type==="finishThomol"&&p&&!Number.isInteger(p.thomolHits))p.thomolHits=a.hits;
 else if(a.type==="finishPluim"&&p&&!Number.isInteger(p.pluimHits))p.pluimHits=a.hits;
}
function update(type,details,quiet=false){
 const a={id:newId(),epoch:RESET_EPOCH,type,...details};
 apply(state,a);queue.push(a);save();
 if(!quiet)render();
 flush();
}
async function flush(){
 if(flushing||!queue.length)return;
 flushing=true;
 try{
  while(queue.length){
   const response=await fetch(API_BASE+"/api/action?room="+encodeURIComponent(room),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(queue[0])});
   if(!response.ok){const info=await response.json().catch(()=>({}));throw Error(info.error||"Opslaan mislukt")}
   const current=await response.json();queue.shift();queue.forEach(a=>apply(current,a));state=current;save();network=true;
  }
 }catch(err){network=false;console.warn("offline",err)}
 finally{flushing=false;status()}
}
async function poll(){
 if(polling||flushing)return;polling=true;
 try{
  const response=await fetch(API_BASE+"/api/state?room="+encodeURIComponent(room)+"&since="+encodeURIComponent(state.revision||0),
   {cache:"no-store",signal:AbortSignal.timeout(7500)});
  if(!response.ok)throw Error("Geen verbinding");
  const remote=await response.json();const oldRevision=state.revision;
  if(remote.epoch!==RESET_EPOCH){network=false;notify("Ververs de app om verder te spelen");return}
  if(remote.unchanged){network=true;if(queue.length)flush();return}
  queue.forEach(a=>apply(remote,a));state=remote;save();network=true;
  if(remote.revision!==oldRevision&&["board","choose","detail"].includes(view)){
   const list=el("screen")?.querySelector(".leader-list, .player-list"),offset=list?.scrollTop||0;
   render();
   const updated=el("screen")?.querySelector(".leader-list, .player-list");
   if(updated)updated.scrollTop=offset;
  }
  if(queue.length)flush();
 }catch{network=false}
 finally{polling=false;status()}
}
function status(){const dot=el("connection");if(dot)dot.classList.toggle("online",network)}
function sticker(index,extra=""){
 // One optimized 4x2 transparent sprite sheet, used by PWA and native mobile apps.
 return `<span class="thomas-sticker sticker-${index} ${extra}" aria-hidden="true"></span>`;
}
function maybeJumpScare(event){
 const p=me();
 // Surprises are cosmetic; never intercept clicks or manipulate game state.
 if(!p||!document.body?.appendChild||document.hidden)return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 if(!["preview","hole","board","quiz1","quiz2","quiz4","checkin","nominate"].includes(view))return;
 const action=event.target.closest("[data-action]");
 const eligibleAction=action&&["pourDrink","gotDrink","continue","return","board","confirmNominate"].includes(action.dataset.action);
 if(!eligibleAction&&!event.target.closest("[data-mood]")&&!event.target.closest("[data-round]"))return;

 const key="golf-scares-v2-"+room+"-"+myId;
 let record=parse(localStorage.getItem(key),null);
 if(!record||!Array.isArray(record.plan)||!Array.isArray(record.seen)){
  const holes=[0,1,2,3,4,5];
  for(let i=holes.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [holes[i],holes[j]]=[holes[j],holes[i]];
  }
  // Between two and four surprise moments, spread across distinct holes.
  const target=2+Math.floor(Math.random()*3);
  record={plan:holes.slice(0,target).sort((a,b)=>a-b),seen:[],attempts:{},lastAt:0};
 }
 if(!record.plan.includes(hole)||record.seen.includes(hole))return;
 if(Date.now()-record.lastAt<6500)return;
 record.attempts??={};
 record.attempts[hole]=(record.attempts[hole]||0)+1;
 const shouldShow=record.attempts[hole]>=2||Math.random()<.45;
 if(!shouldShow){
  localStorage.setItem(key,JSON.stringify(record));
  return;
 }
 record.seen.push(hole);
 record.lastAt=Date.now();
 localStorage.setItem(key,JSON.stringify(record));

 // Each variant feels different. Only the final surprise can be full-screen.
 const count=record.seen.length;
 const type=count===record.plan.length&&record.plan.length>=3?"full":count%2?"mini":"medium";
 const stickerId=type==="full"?3:type==="medium"?7:2;
 const caption=type==="full"?"BOE, MAAT!":type==="medium"?"WAT DAN?!":"HOPPAAA!";
 const duration=type==="full"?920:type==="medium"?690:520;
 setTimeout(()=>{
  const wrap=document.createElement("div");
  wrap.className="thomas-jumpscare thomas-jumpscare--"+type;
  wrap.setAttribute("aria-hidden","true");
  wrap.innerHTML=`<div class="thomas-jumpscare-card">${sticker(stickerId,"jumpscare-sticker")}<span>${caption}</span><small class="sticker-chat-quote">“${escapeHtml(thomasQuote())}”</small></div>`;
  document.body.appendChild(wrap);
  nativeFeedback(type==="full"?"medium":"light");
  setTimeout(()=>wrap.remove(),duration);
 },55);
}

const THOMAS_QUOTES=[
 "Big man, hoezo geef je op?",
 "Maatje wie hou je voor de gek",
 "Hahahah zieke gek",
 "Niet slim oule??",
 "Opeens ben je vet goed?",
 "Met of zonder clownspak aan?",
 "Hahahh wat een fucking legend",
 "Pilsen?",
 "Zuipeeennnnnnn",
 "Ik ben nooit de verkeerde Thomas",
 "Neem op dan !!!!!",
 "Pohhhh lekker hoor",
 "Nee man ben je gek",
 "Goed geprobeerd",
 "Oli 3000?",
 "Wat doe jij gast?!? Hele weekend offline",
 "Bro jij denkt dat ik gesprekken bewaar oule?",
 "Hahaha geloof je het zelf"
];
function thomasQuote(){return THOMAS_QUOTES[Math.floor(Math.random()*THOMAS_QUOTES.length)]}
const SIP_SCARE_MEDIA=[
 {type:"photo",src:"./assets/scare-photo-1.webp",label:"DE CHEF IS NIET ONDER DE INDRUK"},
 {type:"photo",src:"./assets/scare-photo-2.webp",label:"HET TEAM KEURT HET GOED"},
 {type:"photo",src:"./assets/scare-photo-3.webp",label:"JE WORDT IN DE GATEN GEHOUDEN"},
 {type:"photo",src:"./assets/scare-photo-4.webp",label:"WAT IS DIT NOU WEER?"},
 {type:"photo",src:"./assets/scare-photo-5.webp",label:"RAT! RAT! RAT!"},
 {type:"video",src:"./assets/scare-clip-1.mp4",label:"HO, WAT GEBEURT HIER?!",duration:4100},
 {type:"video",src:"./assets/scare-clip-2.mp4",label:"PROFESSIONEEL WERK, CHEF",duration:4100},
 {type:"video",src:"./assets/scare-clip-3.mp4",label:"KOEK KOEK!",duration:4250},
 {type:"video",src:"./assets/scare-clip-4.mp4",label:"KIJK HEM ZITTEN DAN",duration:4050},
 {type:"video",src:"./assets/scare-clip-5.mp4",label:"HOPPAAAA!",duration:4100}
];
let sipScareVisible=false;
function showSipScare(media){
 if(sipScareVisible||!document.body?.appendChild)return;
 sipScareVisible=true;
 const wrap=document.createElement("div");
 const isVideo=media.type==="video";
 wrap.className="sip-media-scare "+(isVideo?"sip-media-scare--video":"sip-media-scare--photo");
 wrap.setAttribute("role","dialog");
 wrap.setAttribute("aria-modal","true");
 wrap.setAttribute("aria-label","Onverwachte Pub Golf-verrassing. Tik op Verder om door te spelen.");
 const content=isVideo?
  `<video class="sip-media-scare-media" autoplay muted playsinline preload="auto" disablepictureinpicture><source src="${media.src}" type="video/mp4"></video>`:
  `<img class="sip-media-scare-media" src="${media.src}" alt="" decoding="async">`;
 wrap.innerHTML=`<div class="sip-media-scare-inner">
  <span class="sip-media-scare-kicker">💥 PUB GOLF SURPRISE</span>
  <div class="sip-media-scare-frame">${content}</div>
  <div class="sip-media-scare-caption">“${escapeHtml(thomasQuote())}”<small>— THOMAS UIT DE CHAT</small></div>
  <button class="sip-media-scare-close" type="button" aria-label="Sluit verrassing">✕ VERDER</button>
 </div>`;
 let finished=false;
 let timeout;
 const onKey=e=>{if(e.key==="Escape")close()};
 function close(){
  if(finished)return;
  finished=true;
  clearTimeout(timeout);
  document.removeEventListener?.("keydown",onKey);
  wrap.remove();
  sipScareVisible=false;
 }
 wrap.querySelector(".sip-media-scare-close")?.addEventListener("click",e=>{e.stopPropagation();close()});
 document.body.appendChild(wrap);
 document.addEventListener?.("keydown",onKey);
 wrap.querySelector(".sip-media-scare-close")?.focus?.();
 const video=isVideo?wrap.querySelector("video"):null;
 if(video){
  video?.addEventListener("ended",close,{once:true});
  video?.play?.()?.catch?.(()=>{});
 }
 nativeFeedback("medium");
 timeout=setTimeout(close,isVideo?media.duration:1400);
}
function maybeSipMediaScare(){
 if(view!=="hole"||!me()||sipScareVisible||document.hidden)return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 if(!document.body?.appendChild)return;
 const key="golf-sip-media-v1-"+room+"-"+myId;
 let record=parse(localStorage.getItem(key),null);
 if(!record||!Array.isArray(record.plan)||!Array.isArray(record.seen)||!Array.isArray(record.used)){
  const shuffled=[0,1,2,3,4,5];
  for(let i=shuffled.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const target=2+Math.floor(Math.random()*3);
  record={plan:shuffled.slice(0,target).sort((a,b)=>a-b),seen:[],used:[],attempts:{},lastAt:0,firstType:Math.random()<.5?"photo":"video"};
 }
 if(!record.plan.includes(hole)||record.seen.includes(hole))return;
 if(Date.now()-record.lastAt<6500)return;
 record.attempts??={};
 record.attempts[hole]=(record.attempts[hole]||0)+1;
 // Not every sip: a random pop on the first, guaranteed on the second.
 if(record.attempts[hole]===1&&Math.random()<.48){
  localStorage.setItem(key,JSON.stringify(record));
  return;
 }
 // Alternate photo and video from one surprise to the next.
 // Every match with at least two scares therefore gets both media types.
 const firstType=record.firstType==="photo"?"photo":"video";
 const preferred=record.seen.length%2===0?firstType:(firstType==="video"?"photo":"video");
 const available=SIP_SCARE_MEDIA.map((item,i)=>({item,i}))
  .filter(({item,i})=>item.type===preferred&&!record.used.includes(i))
  .map(({i})=>i);
 const selected=available[Math.floor(Math.random()*available.length)]??(preferred==="video"?5:0);
 record.seen.push(hole);
 record.used.push(selected);
 record.lastAt=Date.now();
 localStorage.setItem(key,JSON.stringify(record));
 showSipScare(SIP_SCARE_MEDIA[selected]);
}

function avatar(p,extra=""){
 const name=escapeHtml(p.name?.slice(0,1)?.toUpperCase()||"?");
 return `<span class="avatar ${extra}">${p.avatar?`<img alt="" src="${p.avatar}">`:name}</span>`;
}
function salmariAvailable(){
 const p=me();
 if(!p||Number.isInteger(p.scores?.[5]))return false;
 const started=p.scores?.some(n=>Number.isInteger(n))||
  localStorage.getItem("golf-firstdrink-"+room+"-"+myId)==="1";
 return Boolean(started);
}
function header(){
 const p=me(),quick=el("salmari-quick"),count=el("salmari-count");
 const allowed=salmariAvailable();
 if(quick){
   quick.hidden=!allowed;
   quick.disabled=!allowed;
   quick.setAttribute("aria-label",allowed?"Salmari, "+(p.salmari||0)+" shotjes geteld":"Salmari nog niet beschikbaar");
 }
 if(count)count.textContent=String(p?.salmari||0);
 status();
}
function setView(next){
 if(aceTimer){clearTimeout(aceTimer);aceTimer=null}
 if(view==="pluimPlay"&&next!=="pluimPlay")pluimClearTimers();
 if(next==="preview"&&me())localStorage.setItem("golf-firstdrink-"+room+"-"+myId,"1");
 if(next==="nominate")nomineeDraft="";
 if(next==="preview")pourReady=false;
 if(next!=="hole")cancelSipHold();
 if(next==="hole")ignoreSipClick=false;
 view=next;render();
 window.scrollTo({top:0,behavior:"instant"});
 const kind={preview:"preview",hole:"drink",board:"board",detail:"scorecard",checkin:"mood",checkinResult:"mood",quiz1:"baby",quiz2:"calendar",quiz4:"names",nominate:"gift",thomolIntro:"general",thomolPlay:"general",thomolResult:"good",pluimIntro:"general",pluimPlay:"general",pluimResult:"good",quizResult:"result",giftResult:"gift",ace:"ace",finish:"finish",welcome:"welcome"}[next]||"general";
 setTimeout(()=>{if(view===next)rainIcons(kind,next==="ace"?18:next==="preview"?22:next==="board"?16:14)},120);
}

const THOMOL_DURATION=13000,THOMOL_MAX_HITS=10;
function thomolClearTimers(){
 if(thomolPopTimer){clearTimeout(thomolPopTimer);thomolPopTimer=null}
 if(thomolTickTimer){clearInterval(thomolTickTimer);thomolTickTimer=null}
}
function thomolIntro(){
 return `<div class="page-card thomol-intro">
  <span class="thomol-kicker">⚡ VERBORGEN BONUSRONDE</span>
  <div class="thomol-intro-art" aria-hidden="true">
   <span class="thomol-impact thomol-impact-a">BOEM!</span>
   ${sticker(3,"thomol-hero-sticker")}
   <span class="thomol-impact thomol-impact-b">THOMAS!</span>
  </div>
  <h1 class="thomol-title">HIT THE<br><em>THOMOL</em></h1>
  <p class="thomol-description">Thomas komt overal omhoog. Pak 'm als je kan.</p>
  <div class="thomol-rules"><span>⏱️ 13 seconden</span><span>🔨 9 gaten</span><span>🎯 1 hit = −1 slag</span></div>
  <p class="thomol-footnote">Hij is razendsnel. Eén poging. Maximaal 10 slagen korting.</p>
  <div class="grow"></div>
  <button type="button" class="cta thomol-start-btn" data-action="thomolStart">START HET GEKLOP <span>→</span></button>
  <button type="button" class="thomol-skip" data-action="thomolSkip">Deze bonusronde overslaan</button>
 </div>`;
}
function thomolPlay(){
 const g=thomolRound||{hits:0,misses:0,active:-1,decoy:-1,until:Date.now()};
 const seconds=Math.max(0,Math.ceil((g.until-Date.now())/1000));
 return `<div class="page-card thomol-play">
  <div class="thomol-status"><span>🔨 HIT THE THOMOL</span><strong id="thomol-timer">${seconds}s</strong></div>
  <div class="thomol-progress-row"><div><small>RAAK</small><strong>${g.hits}<span> / ${THOMOL_MAX_HITS}</span></strong></div>
  <div><small>MIS</small><strong>${g.misses}</strong></div></div>
  <p class="thomol-command">HOPPA! TIK OP DE ECHTE THOMAS.</p>
  <div class="thomol-grid" role="group" aria-label="Negen gaten met een opduikende Thomas">
  ${Array.from({length:9},(_,i)=>`<button type="button" class="thomol-hole ${i===g.active?'mole-active':''} ${i===g.decoy?'mole-fake':''}" data-thomol-cell="${i}" aria-label="Gat ${i+1}">
    <span class="thomol-hole-back"></span>
    ${i===g.active?sticker(3,"thomol-mole"):i===g.decoy?sticker(4,"thomol-decoy"):''}
    <span class="thomol-hole-front"></span>
   </button>`).join("")}</div>
  <div class="thomol-taunt" aria-live="polite">${g.lastQuote?`“${escapeHtml(g.lastQuote)}”`:'THOMAS KOMT ERAAN...'}</div>
  <div class="grow"></div>
  <p class="thomol-guidance">Eén tik per raakmoment. Laat je niet foppen door de nep-Thomas.</p>
 </div>`;
}
function thomolResult(){
 const hits=me()?.thomolHits??0;
 return `<div class="page-card thomol-result">
  <span class="thomol-kicker">🔨 DE BONUSRONDE IS VOORBIJ</span>
  <div class="thomol-result-art">${sticker(3,"thomol-result-sticker")}<span class="thomol-stamp">GERAAKT!</span></div>
  <h1 class="thomol-title">${hits?'LEKKER':'HELAAS'}<br><em>${hits?'GERAMD!':'GEKLOOPT.'}</em></h1>
  <p class="thomol-result-description">${hits?'Thomas heeft het geweten.':"Thomas is je ontsnapt, oule."}</p>
  <div class="thomol-score-plate"><strong>−${hits}</strong><span>${hits===1?'SLAG':'SLAGEN'} VERDIEND</span></div>
  <p class="thomol-result-quote">“${escapeHtml(hits>2?'Hahahh wat een fucking legend':hits>0?'Goed geprobeerd':'Niet slim oule??')}” — THOMAS</p>
  <div class="grow"></div>
  <button type="button" class="cta thomol-next" data-action="continue">Op naar de volgende kroeg <span>→</span></button>
 </div>`;
}
function thomolStart(){
 const p=me();
 if(!p||Number.isInteger(p.thomolHits))return nextHole();
 if(!Number.isInteger(p.scores?.[1])||!p.answers?.two)return nextHole();
 thomolClearTimers();
 thomolRound={hits:0,misses:0,active:-1,decoy:-1,last:-1,lastQuote:"",until:Date.now()+THOMOL_DURATION,hitThisPop:false};
 setView("thomolPlay");
 thomolSpawn();
 thomolTickTimer=setInterval(()=>{
  if(!thomolRound||view!=="thomolPlay"){thomolClearTimers();return}
  const remaining=thomolRound.until-Date.now();
  if(remaining<=0){thomolFinish();return}
  const ticker=el("thomol-timer");
  if(ticker)ticker.textContent=Math.ceil(remaining/1000)+"s";
 },100);
}
function thomolSpawn(){
 const g=thomolRound;
 if(!g||view!=="thomolPlay")return;
 if(Date.now()>=g.until){thomolFinish();return}
 const candidates=Array.from({length:9},(_,i)=>i).filter(i=>i!==g.last);
 const target=candidates[Math.floor(Math.random()*candidates.length)];
 g.last=target;
 g.active=target;
 g.hitThisPop=false;
 // Two heads appear often, but only one counts as a hit.
 const options=Array.from({length:9},(_,i)=>i).filter(i=>i!==target);
 g.decoy=Math.random()<.63?options[Math.floor(Math.random()*options.length)]:-1;
 render();
 const exposure=310+Math.floor(Math.random()*210);
 thomolPopTimer=setTimeout(()=>{
  if(!thomolRound||view!=="thomolPlay")return;
  g.active=-1;g.decoy=-1;
  render();
  thomolPopTimer=setTimeout(thomolSpawn,155+Math.floor(Math.random()*115));
 },exposure);
}
function thomolHit(index){
 const g=thomolRound;
 if(!g||view!=="thomolPlay"||Date.now()>=g.until)return;
 if(index===g.active&&!g.hitThisPop){
  g.hits=Math.min(THOMOL_MAX_HITS,g.hits+1);
  g.hitThisPop=true;
  g.active=-1;
  g.lastQuote=thomasQuote();
  nativeFeedback("medium");
  if(g.hits>=THOMOL_MAX_HITS){thomolFinish();return}
 }else{
  g.misses++;
  g.lastQuote=g.decoy===index?'Maatje wie hou je voor de gek':'Niet slim oule??';
  nativeFeedback("light");
 }
 render();
}
function thomolFinish(){
 if(Number.isInteger(me()?.thomolHits))return nextHole();
 const hits=thomolRound?.hits||0;
 thomolClearTimers();
 thomolRound=null;
 update("finishThomol",{playerId:myId,hits},true);
 setView("thomolResult");
 if(hits>0)celebrate(Math.min(76,14+hits*7));
}
function thomolSkip(){
 if(view!=="thomolIntro"||Number.isInteger(me()?.thomolHits))return;
 thomolClearTimers();thomolRound=null;
 update("finishThomol",{playerId:myId,hits:0},true);
 setView("thomolResult");
}


const PLUIM_ZONES=[18,13,9],PLUIM_SPEEDS=[120,170,230],PLUIM_LIMIT=4500;
function pluimClearTimers(){
 if(pluimTickTimer){clearInterval(pluimTickTimer);pluimTickTimer=null}
 if(pluimNextTimer){clearTimeout(pluimNextTimer);pluimNextTimer=null}
}
function pluimPosition(g,now=Date.now()){
 if(g.locked)return g.stopAt;
 const traveled=Math.max(0,(now-g.startedAt)*g.speed/1000)%200;
 return traveled<=100?traveled:200-traveled;
}
function pluimPrepareAttempt(g){
 g.target=[28,41,55,70][Math.floor(Math.random()*4)];
 g.width=PLUIM_ZONES[g.attempt];
 g.speed=PLUIM_SPEEDS[g.attempt];
 g.startedAt=Date.now();
 g.locked=false;g.stopAt=0;g.message="";
}
function pluimIntro(){
 return `<div class="page-card pluim-intro">
   <span class="pluim-kicker">🎰 DE TWEEDE BONUSRONDE</span>
   <div class="pluim-hero-art" aria-hidden="true"><div class="pluim-target-rings"></div>${sticker(6,"pluim-hero-sticker")}<span class="pluim-hero-stamp">STOP!</span></div>
   <h1 class="pluim-title">STOP DE<br><em>PLUIM!</em></h1>
   <p class="pluim-description">Die wijzer gaat als een malle. Stop 'm precies in het <strong>gele vak.</strong></p>
   <div class="pluim-rules"><span>🎯 3 POGINGEN</span><span>⏱️ 4,5 SEC PER KANS</span><span>🏆 HIT = −1 SLAG</span></div>
   <p class="pluim-warning">Elke beurt sneller. De gele zone wordt steeds kleiner. Maximaal −3 slagen. Eén poging per golfer.</p>
   <div class="grow"></div>
   <button class="cta pluim-start" type="button" data-action="pluimStart">START DE METER <span>→</span></button>
   <button class="pluim-skip" type="button" data-action="pluimSkip">Bonusronde overslaan</button>
 </div>`;
}
function pluimPlay(){
 const g=pluimRound||{attempt:0,hits:0,history:[],target:50,width:18,speed:120,startedAt:Date.now(),locked:false,stopAt:0};
 const pos=pluimPosition(g);
 const left=g.target-g.width/2;
 const timeLeft=g.locked?0:Math.max(0,(PLUIM_LIMIT-(Date.now()-g.startedAt))/1000);
 return `<div class="page-card pluim-play">
   <div class="pluim-top"><span>🎰 STOP DE PLUIM!</span><strong>RONDE ${g.attempt+1}/3</strong></div>
   <div class="pluim-progress-dots">${Array.from({length:3},(_,i)=>`<span class="${i<g.history.length?(g.history[i]?'hit':'miss'):i===g.attempt?'current':''}">${i<g.history.length?(g.history[i]?'✓':'✕'):i+1}</span>`).join("")}</div>
   <div class="pluim-top-score"><span>VERDIEND <strong>−${g.hits}</strong> SLAGEN</span><span class="pluim-countdown" id="pluim-countdown">${timeLeft.toFixed(1)}s</span></div>
   <div class="pluim-stage">
     ${sticker(7,"pluim-distraction")}
     <span class="pluim-stage-label">MIK OP GEEL, MAAT.</span>
     <div class="pluim-meter-wrap">
       <div class="pluim-meter" role="img" aria-label="Bewegende meter: stop de wijzer in de gele trefzone">
        <span class="pluim-zone" style="left:${left}%;width:${g.width}%"></span>
        <span class="pluim-needle" id="pluim-needle" style="left:${pos}%"><i>▼</i></span>
       </div>
       <div class="pluim-meter-markers"><span>0</span><span>50</span><span>100</span></div>
     </div>
     <div class="pluim-attempt-info"><span>SNELHEID <strong>${g.attempt===0?'SNEL':g.attempt===1?'BLOEDSNEL':'ABSURD'}</strong></span><span>TREFZONE <strong>${g.width}%</strong></span></div>
     <div class="pluim-feedback ${g.locked?(g.history[g.history.length-1]?'pluim-good':'pluim-bad'):''}" aria-live="polite">${g.locked?escapeHtml(g.message):'WACHT... EN... STOP!'}</div>
   </div>
   <div class="grow"></div>
   <button type="button" class="pluim-stop-button" data-action="pluimStop" ${g.locked?'disabled':''}>
     <strong>${g.locked?(g.history[g.history.length-1]?'RAAK!':'MIS!'):'STOP DIE PLUIM!'}</strong>
     <span>${g.locked?'VOLGENDE POGING KOMT ERAAN':"TIK OM DE WIJZER TE STOPPEN"}</span>
   </button>
   <p class="pluim-footer-tip">Geen herkansingen. Goed mikken, chef.</p>
 </div>`;
}
function pluimResult(){
 const hits=me()?.pluimHits||0;
 const reaction=hits===3?'ON-GE-LO-FELIJK!':hits===2?'LEKKER GEDAAN!':hits===1?'NETJES, MAAT!':'FANTASTISCH MIS.';
 return `<div class="page-card pluim-result">
   <span class="pluim-kicker">🏆 DE METER IS GESTOPT</span>
   <div class="pluim-result-art">${sticker(hits>0?6:3,"pluim-result-sticker")}<span class="pluim-result-stamp">${hits}/3 RAAK!</span></div>
   <h1 class="pluim-title">${reaction.replace(' ','<br>')}</h1>
   <p class="pluim-result-sub">${hits?'Die vingers zijn nog verrassend scherp.':'Thomas is je te snel af geweest.'}</p>
   <div class="pluim-result-ticket"><strong>−${hits}</strong><span>${hits===1?'SLAG':'SLAGEN'}<small>CADEAU VOOR DE RANGLIJST</small></span></div>
   <p class="pluim-result-quote">“${escapeHtml(hits>1?'Opeens ben je vet goed?':hits===1?'Goed geprobeerd':'Maatje wie hou je voor de gek')}” — Thomas</p>
   <div class="grow"></div>
   <button class="cta pluim-continue" type="button" data-action="continue">Volgende kroeg <span>→</span></button>
 </div>`;
}
function pluimRefreshNeedle(){
 const g=pluimRound;
 if(!g||view!=="pluimPlay"||g.locked)return;
 const time=Date.now()-g.startedAt;
 if(time>=PLUIM_LIMIT){pluimStop(true);return}
 const needle=el("pluim-needle"),counter=el("pluim-countdown");
 if(needle)needle.style.left=pluimPosition(g)+"%";
 if(counter)counter.textContent=Math.max(0,(PLUIM_LIMIT-time)/1000).toFixed(1)+"s";
}
function pluimStartTicker(){
 if(pluimTickTimer){clearInterval(pluimTickTimer);pluimTickTimer=null}
 pluimTickTimer=setInterval(pluimRefreshNeedle,22);
}
function pluimStart(){
 const p=me();
 if(view!=="pluimIntro"||!p||Number.isInteger(p.pluimHits))return;
 if(!Number.isInteger(p.scores?.[3])||!p.answers?.four)return nextHole();
 pluimClearTimers();
 const g={attempt:0,hits:0,history:[],locked:false,stopAt:0};
 pluimRound=g;
 pluimPrepareAttempt(g);
 setView("pluimPlay");
 pluimStartTicker();
}
function pluimStop(expired=false){
 const g=pluimRound;
 if(view!=="pluimPlay"||!g||g.locked)return;
 const elapsed=Date.now()-g.startedAt;
 const position=pluimPosition(g);
 const hit=!expired&&elapsed<PLUIM_LIMIT&&Math.abs(position-g.target)<=g.width/2;
 g.stopAt=position;
 g.locked=true;
 g.history.push(hit);
 if(hit)g.hits++;
 g.message=hit?'BOEM! −1 SLAG!':expired?'TE LAAT, OUWE!':'NET MIS, MAAT!';
 if(pluimTickTimer){clearInterval(pluimTickTimer);pluimTickTimer=null}
 nativeFeedback(hit?'success':'light');
 render();
 if(hit){celebrate(19);rainIcons("good",14)}
 pluimNextTimer=setTimeout(()=>{
  pluimNextTimer=null;
  if(view!=="pluimPlay"||pluimRound!==g)return;
  if(g.attempt>=2){pluimFinish();return}
  g.attempt++;
  pluimPrepareAttempt(g);
  render();
  pluimStartTicker();
 },920);
}
function pluimFinish(){
 const g=pluimRound;
 if(!g||view!=="pluimPlay")return;
 const hits=g.hits;
 pluimClearTimers();pluimRound=null;
 if(!Number.isInteger(me()?.pluimHits))update("finishPluim",{playerId:myId,hits},true);
 setView("pluimResult");
 if(hits>0)celebrate(30+hits*16);
}
function pluimSkip(){
 if(view!=="pluimIntro"||Number.isInteger(me()?.pluimHits))return;
 pluimClearTimers();pluimRound=null;
 update("finishPluim",{playerId:myId,hits:0},true);
 setView("pluimResult");
}

function nextHole(){
 const p=me();if(!p){setView("choose");return}
 const done=p.scores||[];
 const answers=p.answers||{};
 if(Number.isInteger(done[0])&&!answers.one){setView("quiz1");return}
 if(Number.isInteger(done[1])&&!answers.two){setView("quiz2");return}
 if(Number.isInteger(done[1])&&answers.two&&!Number.isInteger(p.thomolHits)){setView("thomolIntro");return}
 if(Number.isInteger(done[2])&&!Number.isInteger(p.checkin)){setView("checkin");return}
 if(Number.isInteger(done[3])&&!answers.four){setView("quiz4");return}
 if(Number.isInteger(done[3])&&answers.four&&!Number.isInteger(p.pluimHits)){setView("pluimIntro");return}
 if(Number.isInteger(done[4])&&!p.nomination){setView("nominate");return}
 const first=done.findIndex(n=>!Number.isInteger(n));
 if(first<0){setView("finish");return}
 hole=first;strokes=0;
 setView("preview");
}
function svgDrink(kind){
 const start='<svg class="beer-svg" viewBox="0 0 230 252" role="img" aria-label="Illustratie van het drankje"><defs><linearGradient id="amber" x1="0" x2="1"><stop stop-color="#f4b940"/><stop offset=".6" stop-color="#cf7f1c"/><stop offset="1" stop-color="#f9ce6a"/></linearGradient><linearGradient id="lager" x1="0" x2="1"><stop stop-color="#fbd56d"/><stop offset="1" stop-color="#e9a328"/></linearGradient></defs>';
 const foam='<path d="M67 61 Q60 50 71 47 Q74 34 86 41 Q98 29 108 40 Q120 31 128 43 Q141 36 151 48 Q165 45 166 61Z" fill="#fffaf0" stroke="#f0eadb" stroke-width="2"/>';
 let content="";
 if(kind==="stout"){
  content='<path d="M61 45 L171 45 L159 211 Q117 223 73 211Z" fill="#2b201e" stroke="#cfd8cf" stroke-width="5"/><path d="M64 46 L168 46 L165 73 Q112 88 68 72Z" fill="#fff7e5"/><path d="M113 117 L107 135 L118 147 L129 135 L123 117Z" fill="#e7bf70"/><text x="116" y="164" fill="#f5e9d4" font-size="19" font-family="Georgia" text-anchor="middle">GUINNESS</text><path d="M73 82 L78 205" stroke="#fff" stroke-width="8" opacity=".1"/>';
 }else if(kind==="mug"){
  content='<rect x="52" y="53" width="120" height="161" rx="15" fill="url(#lager)" stroke="#e5e7e1" stroke-width="6"/><path d="M174 81 Q218 76 213 125 Q210 160 176 159" fill="none" stroke="#e0e4de" stroke-width="16"/><path d="M174 81 Q209 79 203 125 Q201 145 176 148" fill="none" stroke="#fffaf0" stroke-width="7"/><path d="M75 63 L75 198" stroke="white" stroke-width="9" opacity=".25"/>'+foam;
 }else if(kind==="flute"){
  content='<path d="M93 24 L138 24 L137 207 Q115 216 94 207Z" fill="url(#lager)" stroke="#edf2ed" stroke-width="4"/><path d="M91 22 Q115 13 140 22 L137 39 L94 39Z" fill="#fffaf0"/><path d="M106 57 L105 197" stroke="white" stroke-width="5" opacity=".4"/>';
 }else if(kind==="chalice"){
  content='<path d="M59 66 Q57 139 92 163 Q105 169 116 169 Q130 169 143 161 Q171 132 170 66Z" fill="url(#amber)" stroke="#e0e8db" stroke-width="5"/><rect x="110" y="168" width="12" height="52" rx="6" fill="#d8e3d5"/><ellipse cx="116" cy="220" rx="56" ry="9" fill="#d8e3d5"/><path d="M61 63 Q113 42 168 63" fill="none" stroke="#fff9e6" stroke-width="15"/><text x="116" y="123" text-anchor="middle" fill="#fff4d8" font-family="Georgia" font-weight="bold" font-size="13">BRUGSE ZOT</text>';
 }else if(kind==="vaasje"){
  content='<path d="M71 74 L161 74 L157 208 Q116 223 75 208Z" fill="url(#lager)" stroke="#e9eee6" stroke-width="5"/><path d="M71 73 Q115 55 161 73 L157 84 Q116 96 75 83Z" fill="#fff9e9"/><path d="M85 93 L89 202" stroke="white" stroke-width="7" opacity=".4"/>';
 }else{
  content='<path d="M61 65 Q63 115 81 153 Q93 174 109 177 L110 214 L88 221 L144 221 L122 214 L122 177 Q141 172 153 151 Q169 122 170 65Z" fill="url(#amber)" stroke="#e4ede5" stroke-width="5"/><path d="M59 65 Q115 52 172 65" fill="none" stroke="#fff9e9" stroke-width="14"/><path d="M89 89 Q91 140 103 159" stroke="#fff" stroke-width="7" opacity=".32" fill="none"/><text x="115" y="128" fill="white" font-family="Georgia" font-weight="bold" font-size="19" text-anchor="middle">JOPEN</text>';
 }
 return start+content+"</svg>";
}
const SIP_HOLD_MS=850;
let sipHoldTimer=null,sipHoldTarget=null,sipHoldStartedAt=0,sipHoldPosition=null,sipHoldDone=false,ignoreSipClick=false;
function refreshCounter(){
 const counter=el("stroke-value");
 if(counter)counter.textContent=String(strokes);
 const unit=el("sip-unit");
 if(unit)unit.textContent=strokes===1?"SLOK":"SLOKKEN";
 const pad=el("sip-pad");
 if(pad)pad.setAttribute("aria-label",strokes+" "+(strokes===1?"slok":"slokken")+" geteld. Tik voor één extra slok; houd 0,85 seconde ingedrukt om de score te bevestigen.");
}
function addSip(){
 if(view!=="hole")return;
 strokes=Math.min(99,strokes+1);
 refreshCounter();
 nativeFeedback("light");
 maybeSipMediaScare();
}
function confirmSipScore(){
 if(view!=="hole")return;
 if(strokes<1){notify("Tik eerst minstens één slok");return}
 if(Number.isInteger(me()?.scores?.[hole])){notify("Deze score staat al vast");return}
 const under=strokes<HOLES[hole].par;
 const above=strokes>HOLES[hole].par;
 const holeInOne=strokes===1;
 update("setScore",{playerId:myId,hole,value:strokes},true);
 nativeFeedback(holeInOne?"success":above?"error":"medium");
 if(holeInOne){
  setView("ace");
  aceBlast();
 }else{
  setView("board");
  if(under)setTimeout(()=>{celebrate(44);rainIcons("good",58)},65);
  if(above)setTimeout(()=>rainIcons("bad",72),90);
  setTimeout(()=>flyBeer(3),95);
 }
}
function cancelSipHold(){
 if(sipHoldTimer!==null){clearTimeout(sipHoldTimer);sipHoldTimer=null}
 if(sipHoldTarget?.classList?.remove)sipHoldTarget.classList.remove("is-holding");
 sipHoldTarget=null;
 sipHoldPosition=null;
}
function completeSipHold(){
 if(view!=="hole"||sipHoldDone)return;
 sipHoldDone=true;
 ignoreSipClick=true;
 cancelSipHold();
 confirmSipScore();
}
function beginSipHold(target,event){
 if(view!=="hole"||!target)return;
 if(event.button!==undefined&&event.button!==0)return;
 if(event.isPrimary===false)return;
 cancelSipHold();
 sipHoldDone=false;
 sipHoldTarget=target;
 sipHoldStartedAt=Date.now();
 sipHoldPosition={x:event.clientX||0,y:event.clientY||0};
 target.classList?.add?.("is-holding");
 sipHoldTimer=setTimeout(completeSipHold,SIP_HOLD_MS);
}
function releaseSipHold(){
 if(!sipHoldTarget)return;
 if(!sipHoldDone&&Date.now()-sipHoldStartedAt>=SIP_HOLD_MS){
  completeSipHold();
  return;
 }
 cancelSipHold();
}
function landing(){
 return `<div class="landing page-card">
 <div class="intro-copy"><h1 class="display">Pre Papa.<br><i>Pluim Pub Golf.</i></h1><p>De ronde is begonnen.</p></div>
 <div class="hero-photo"><img src="./assets/thomas-4.webp" alt="Thomas in feeststemming">${sticker(7,"landing-sticker")}<span class="hero-tag">THE DADCHELOR CUP</span></div>
 <div class="grow"></div><button class="cta" data-action="start">Ik speel mee <span>→</span></button>
 </div>`;
}
function choose(){
 return `<div class="page-card"><button class="back" data-action="welcome">← Terug</button><span class="overline">STAP 01</span><h1 class="display">Wie ben<br><i>jij?</i></h1>
 <p class="helper">Tik op jouw profiel of maak een nieuwe aan.</p>
 <div class="player-list">${state.players.map(p=>`<button class="pick" data-player="${escapeHtml(p.id)}">${avatar(p)}<strong>${escapeHtml(p.name)}</strong><span class="chevron">→</span></button>`).join("")||'<div class="no-players">De eerste golfer mag zich aanmelden.</div>'}</div>
 <div class="grow"></div><button class="cta" data-action="create">Nieuw profiel <span>+</span></button></div>`;
}
function profile(){
 return `<div class="page-card"><button class="back" data-action="choose">← Terug</button><span class="overline">NIEUWE SPELER</span><h1 class="display">Join the<br><i>club.</i></h1>
 <button class="photo-upload" data-action="photo">${avatarDraft?`<img src="${avatarDraft}" alt="Profielfoto">`:'<span>+</span>'}</button>
 <button class="upload-label" data-action="photo">Kies je profielfoto</button>
 <label class="form-label" for="player-name">Jouw naam</label><input id="player-name" class="name-input" type="text" maxlength="32" placeholder="Hoe heet je?" autocomplete="off" enterkeyhint="done">
 <div class="grow"></div><button class="cta" data-action="register">Maak profiel <span>→</span></button></div>`;
}
function rules(){
 return `<div class="page-card rules-page"><button class="back" data-action="choose">← Terug</button>
 <span class="overline">DE SPELREGELS</span><h1 class="display">Zo speel<br><i>je mee.</i></h1>
 <div class="rule"><span>01</span><p>Elke kroeg is één hole, met een eigen drankje en PAR.</p></div>
 <div class="rule"><span>02</span><p>Tel je slokken en vul je score in. Er is geen tijdslimiet.</p></div>
 <div class="rule"><span>03</span><p>Na iedere hole verschijnt het live klassement.</p></div>
 <div class="rule"><span>04</span><p>Salmari: één slag aftrek per shot op de totaalscore.</p></div>
 <div class="grow"></div><button class="cta" data-action="rulesDone">Begrepen. Tee off! <span>→</span></button></div>`;
}

const BAR_LINES=[
 ["Dit begint verdacht veel op een goed idee.","De eerste staat. De lat ligt nog laag."],
 ["De Ieren noemen dit cultuur.","Guinness getapt. Tijd om te presteren."],
 ["Een halve liter ambitie graag.","Kijk eens aan. Professioneel werk."],
 ["Klein glas, grote verwachtingen.","Een fluitje met grootheidswaanzin."],
 ["België heeft zijn werk gedaan.","De Zot is binnen. Jij bent aan zet."],
 ["Het laatste rondje is aangebroken.","Finale. Net doen alsof je nog scherp bent."]
];
function preview(){
 const h=HOLES[hole],pic=[1,2,3,4,1,3][hole],ready=pourReady;
 return `<div class="page-card taproom ${ready?'is-served':'is-waiting'}" data-tap-hole="${hole+1}">
  <div class="taproom-photo" aria-hidden="true"><img src="./assets/thomas-${pic}.webp" alt=""></div>
  <div class="taproom-heading">
   <span class="taproom-label">AAN DE BAR BIJ</span>
   <h1>${escapeHtml(h.venue)}</h1>
   <p class="taproom-order"><strong>${escapeHtml(h.drink)}</strong><span>${escapeHtml(h.details)}</span></p>
  </div>
  <div class="taproom-machine-area">
   <button class="taproom-machine ${ready?'has-poured':''}" data-action="${ready?'gotDrink':'pourDrink'}" type="button" aria-label="${ready?'Je drankje is klaar, ga naar de score':'Tik op de tap om je glas te vullen'}">
    <span class="taproom-tap" aria-hidden="true"><span class="taproom-tap-neck"></span><span class="taproom-tap-head"></span><span class="taproom-tap-handle"></span><span class="taproom-tap-spout"></span></span>
    <span class="taproom-stream" aria-hidden="true"></span>
    <span class="taproom-glass glass-${h.visual}" aria-hidden="true">
      <span class="taproom-beer"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="taproom-foam"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="taproom-glass-shine"></span>
    </span>
    <span class="taproom-driptray" aria-hidden="true"></span>
   </button>
  </div>
  <div class="taproom-footer">
    <div class="taproom-peeker">${sticker([2,4,5,7,6,3][hole])}</div>
    <button type="button" class="taproom-cta" data-action="${ready?'gotDrink':'pourDrink'}">
      <span class="taproom-cta-icon">${ready?'✓':'🍺'}</span>
      <span class="taproom-cta-copy"><strong>${ready?"Ik heb m'n drankje!":"Tap dat biertje"}</strong><small>${ready?'Op naar de scorekaart':'Eén tik en hij staat klaar'}</small></span>
      <span class="taproom-arrow">→</span>
    </button>
  </div>
 </div>`;
}
function holeView(){
 const h=HOLES[hole];
 return `<div class="page-card hole-page sip-minimal">
  <div class="sip-minimal-par" aria-label="PAR ${h.par}">PAR <strong>${h.par}</strong></div>
  <button id="sip-pad" class="sip-hold-button" type="button" data-action="sip"
   aria-label="${strokes} ${strokes===1?'slok':'slokken'} geteld. Tik voor één extra slok; houd 0,85 seconde ingedrukt om de score te bevestigen.">
   <svg class="sip-hold-ring" aria-hidden="true" viewBox="0 0 260 260">
    <circle cx="130" cy="130" r="114" pathLength="100"></circle>
   </svg>
   <strong id="stroke-value" class="sip-minimal-number" aria-live="polite" aria-atomic="true">${strokes}</strong>
   <span id="sip-unit" class="sip-minimal-unit">${strokes===1?'SLOK':'SLOKKEN'}</span>
  </button>
 </div>`;
}
function ace(){
 const h=HOLES[hole];
 const icons=["💥","🍺","🏆","🔥","⚡","🍻","⭐","⛳","🥇","🎉","🚀","🎯"];
 return `<div class="page-card ace-insane">
   <div class="ace-sunburst" aria-hidden="true"></div>
   <div class="ace-jackpot-ring" aria-hidden="true"><span>HOLE IN ONE · HOLE IN ONE ·</span></div>
   <div class="ace-blast-layer" aria-hidden="true">
     ${icons.map((icon,i)=>`<span style="--ace-i:${i}">${icon}</span>`).join("")}
     ${[3,6,7,2].map((n,i)=>`<div class="ace-sticker-fly ace-fly-${i}">${sticker(n)}</div>`).join("")}
   </div>
   <span class="ace-topline">⛳ HOLE ${String(hole+1).padStart(2,"0")} <span>•</span> ${escapeHtml(h.venue.toUpperCase())}</span>
   <div class="ace-main">
     <div class="ace-boom"><span>💥</span> BOEM<span>!</span></div>
     <div class="ace-slot"><span>🎰</span> JACKPOT <span>🎰</span></div>
     <h1 class="ace-title">GE-WEL-<br>DIG!</h1>
     <p class="ace-sub">HOLE IN ONE.<br><strong>Goed gedaan, maat!</strong></p>
     <div class="ace-score-chip">
       <strong>01</strong>
       <div><span>1 SLAG · 1 SLOK</span><b>${escapeHtml(h.drink)}. In één keer.</b><small>${escapeHtml(h.venue)} · PAR ${h.par}</small></div>
     </div>
     <div class="ace-praise"><span>🏌️</span><p>Hier mag je echt onredelijk trots op zijn.</p></div>
   </div>
   <div class="ace-actions">
     <button type="button" class="ace-replay" data-action="replayAce" aria-label="Speel de hole-in-one-viering opnieuw">↻ Nog een keer BOEM</button>
     <button class="cta ace-cta" type="button" data-action="board">Naar het klassement <span>→</span></button>
   </div>
 </div>`;
}
function aceBlast(){
 if(view!=="ace"||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 celebrate(75);
 rainIcons("ace",55);
 flyBeer(7);
 setTimeout(()=>{if(view==="ace"){celebrate(38);rainIcons("ace",24)}},950);
 setTimeout(()=>{if(view==="ace"){celebrate(25);flyBeer(4)}},1920);
}
function quiz1(){
 return `<div class="page-card question-page question-baby">${sticker(2,"quiz-sticker")}
 <span class="overline">NA HOLE 1 · THOMAS TRIVIA</span>
 <h1 class="display">Jongen<br>of <i>meisje?</i></h1>
 <p class="question-sub">Wat wordt het voor Thomas en Danique?</p>
 <div class="answer-stack">
 <button class="gender-answer boy" data-round="one" data-choice="blue"><span>💙</span> Een jongen <b>→</b></button>
 <button class="gender-answer girl" data-round="one" data-choice="pink"><span>🩷</span> Een meisje <b>→</b></button>
 <button class="gender-answer rainbow" data-round="one" data-choice="rainbow"><span>🌈</span> Alle kleuren <b>→</b></button>
 </div><div class="grow"></div></div>`;
}
function quiz2(){
 const days=['10','12','14','16','18','20','22','25'];
 return `<div class="page-card question-page question-date">${sticker(4,"quiz-sticker")}<span class="overline">NA HOLE 2 · THOMAS TRIVIA</span>
 <h1 class="display">Wanneer<br>is <i>Danique</i><br>uitgerekend?</h1>
 <p class="question-sub">Kies de juiste dag in januari.</p>
 <div class="date-grid">${days.map(x=>`<button data-round="two" data-choice="${x}"><strong>${x}</strong><span>JAN</span></button>`).join("")}</div>
 <div class="grow"></div></div>`;
}
function quiz4(){
 const labels=['Thomas','Thomas','thomas','Misschien Thomas'];
 const choice=['Thomas','THOMAS','thomas','misschien-thomas'];
 return `<div class="page-card question-page question-name">
 ${sticker(7,"quiz-sticker")}
 <div class="thomas-cloud" aria-hidden="true">${Array.from({length:35},(_,i)=>`<span style="--i:${i};--x:${(i*37)%92}%;--y:${(i*23)%82}%;--rotate:${(i*17)%42-21}deg">Thomas</span>`).join("")}</div>
 <span class="overline">NA HOLE 4 · CRUCIALE VRAAG</span>
 <h1 class="display">Hoe gaat<br>de zoon van<br><i>Thomas</i> heten?</h1>
 <div class="name-choice">${labels.map((label,i)=>`<button data-round="four" data-choice="${choice[i]}">${label}<span>→</span></button>`).join("")}</div>
 <div class="grow"></div></div>`;
}
function quizResult(){
 const r=questionResult;
 return `<div class="page-card quiz-result ${r.delta<0?'win':'loss'}">
 <span class="overline">${r.title||'ANTWOORD BINNEN'}</span>
 <div class="result-burst">${r.emoji||'🎉'}</div>
 <h1 class="display">${r.heading||'Lekker'}<br><i>${r.subheading||'bezig!'}</i></h1>
 <p class="question-result-text">${r.description||''}</p>
 <div class="impact">${r.delta>0?'+':''}${r.delta} <small>${Math.abs(r.delta)===1?'SLAG':'SLAGEN'}</small></div>
 <div class="grow"></div><button class="cta" data-action="continue">Volgende kroeg <span>→</span></button></div>`;
}
function nominate(){
 const all=state.players,options=all.length>1?all.filter(p=>p.id!==myId):all;
 const selected=options.find(p=>p.id===nomineeDraft);
 return `<div class="page-card nominate-page">
 <div class="gift-ambient" aria-hidden="true"><span>✦</span><span>🎁</span><span>✦</span></div>
 <span class="gift-kicker"><span class="gift-kicker-icon">🎁</span> BONUSRONDE 05 / 06</span>
 <div class="gift-hero">
   <span class="gift-hero-emoji" aria-hidden="true">💌</span>
   <h1 class="display">Hoppakee.<br><i>Vragen op.</i></h1>
   <p>Een gratis <strong>−1 slag</strong> voor iemand uit de club. Wie gun jij ’m?</p>
 </div>
 <div class="vote-heading"><span>KIES JE GELUKSVOGEL</span><span>${options.length} ${options.length===1?'GOLFER':'GOLFERS'}</span></div>
 <div class="vote-grid" role="group" aria-label="Kies een golfer voor een slag aftrek">
 ${options.map((p,i)=>`<button class="vote-card ${nomineeDraft===p.id?'is-picked':''}" type="button" data-nominate="${escapeHtml(p.id)}" aria-pressed="${nomineeDraft===p.id}" style="--vote-index:${Math.min(i,12)}">
  <span class="vote-check" aria-hidden="true">${nomineeDraft===p.id?'✓':'+'}</span>
  ${avatar(p,"vote-avatar")}
  <strong>${escapeHtml(p.name)}</strong>
  <small>−1 SLAG CADEAU</small>
 </button>`).join("")}</div>
 <div class="grow"></div>
 <div class="vote-confirm">
  <div class="vote-preview" aria-live="polite">${selected?`<span>🎯</span><span><strong>${escapeHtml(selected.name)}</strong> krijgt een slag cadeau.</span>`:'<span>👆</span><span>Kies eerst een maat hierboven.</span>'}</div>
  <button class="cta gift-cta" data-action="confirmNominate" ${selected?'':'disabled'}>${selected?`Geef ${escapeHtml(selected.name)} −1 slag`:'Kies een golfer'} <span>→</span></button>
 </div>
 </div>`;
}
function giftResult(){
 const name=questionResult.friend||'je maat';
 const giftPlayer=state.players.find(p=>p.name===name);
 return `<div class="page-card gift-done">
 <span class="overline">CADEAUTJE UITGEDEELD</span>
 <div class="gift-done-art" aria-hidden="true"><span class="gift-spot">✨</span>${giftPlayer?avatar(giftPlayer,"gift-done-avatar"):'<span class="gift-done-avatar">🎁</span>'}<span class="gift-bow">🎀</span></div>
 <div class="gift-done-ticket"><span>GUNFACTOR +100</span><strong>−1</strong><span>SLAG CADEAU</span></div>
 <h1 class="display">Kijk je eens<br><i>gul zijn.</i></h1>
 <p class="question-result-text"><strong>${escapeHtml(name)}</strong> krijgt één slag minder. Van jou. Wat een wereldgozer.</p>
 <div class="grow"></div><button class="cta" data-action="continue">Op naar de laatste kroeg <span>→</span></button>
 </div>`;
}
const RANK_ICONS=["👑","🥈","🥉","🏅","🎖️","🦚","🕺","🍻","🦆","🍆","🥨","🧦","🐌","🥴","🤡","🚽","🪠","🫠","🥀","🧻","🦠","🪳","🗑️","🫧","🪦","💩"];
function rankIcon(index,total){
 if(index===0)return "👑";
 if(total>1&&index===total-1)return "💩";
 return RANK_ICONS[index]||"🧻";
}
function leaderboard(){
 const players=leaders(),p=me(),stat=p?score(p):null,done=stat?.completed===6;
 const format=n=>n>0?"+"+n:String(n);
 return `<div class="page-card leader-page leader-vertical">
  <div class="leader-heading">
   <div><span class="overline">${done?'DE EINDSTAND':'LIVE KLASSEMENT'}</span>
    <h1 class="display">The <i>clubhouse.</i></h1></div>
   <span class="leader-live"><span class="leader-live-dot"></span>${done?'FINISH':'LIVE'}</span>
  </div>
  <p class="helper leader-helper">Beste golfer bovenaan. Iedereen staat onder elkaar.</p>
  <div class="leader-sticker-peek">${sticker(5)}</div>
  <div class="leader-vertical-header"><span>RANGSCHIKKING</span><span>${players.length} ${players.length===1?'GOLFER':'GOLFERS'}</span></div>
  <div class="leader-list leader-vertical-list" aria-label="Live ranglijst">
   ${players.map((player,index)=>{
    const scorecard=score(player);
    const last=players.length>1&&index===players.length-1;
    return `<button type="button" data-leader="${escapeHtml(player.id)}" aria-label="Nummer ${index+1}: ${escapeHtml(player.name)}, ${scorecard.completed} van 6 holes" class="leader-row rank-place-${index+1} ${index<3?'leader-top-three':''} ${player.id===myId?'selected':''}" style="--row:${Math.min(index,18)}">
     <span class="rank"><strong>${index+1}</strong><small aria-hidden="true">${rankIcon(index,players.length)}</small></span>
     <span class="avatar-holder">${avatar(player)}</span>
     <span class="leader-name"><strong>${escapeHtml(player.name)}${player.id===myId?' <span class="you">jij</span>':''}</strong><small>${scorecard.completed}/6 holes${last?' · Hekkensluiter':''}</small></span>
     <span class="leader-score">${scorecard.completed?format(scorecard.relative):'–'}<small>t.o.v. PAR</small></span>
     <span class="leader-arrow" aria-hidden="true">›</span>
    </button>`;
   }).join("")||'<div class="no-players">Nog geen golfers aan de start.</div>'}
  </div>
  <div class="grow"></div>
  <div class="leader-bottom"><button class="cta" data-action="${done?'finish':'continue'}">${done?'Mijn eindscore':'Volgende hole'} <span>→</span></button></div>
 </div>`;
}
function detail(){
 const p=state.players.find(x=>x.id===selectedPlayerId);
 if(!p)return `<div class="page-card"><button class="back" data-action="board">← Klassement</button><p>Deze golfer is niet gevonden.</p></div>`;
 const st=score(p),rank=leaders().findIndex(x=>x.id===p.id)+1;
 const otherAdjustment=st.net-st.total+(p.salmari||0)+(p.thomolHits||0)+(p.pluimHits||0);
 const signed=n=>n>0?`+${n}`:n<0?`−${Math.abs(n)}`:"0";
 return `<div class="page-card detail-page">
 <button class="back" data-action="board">← Terug naar klassement</button>
 <span class="overline">SCOREKAART · PLEK ${rank}</span>
 <div class="detail-player-head">
  ${avatar(p,"detail-avatar")}
  <div><h1 class="detail-player-name">${escapeHtml(p.name)}</h1><p class="detail-rank">${rankIcon(rank-1,state.players.length)} Nummer ${rank} in het klassement</p></div>
 </div>
 <div class="detail-section-title">Slagen per drankje</div>
 <div class="detail-holes">
  ${HOLES.map((h,i)=>{
   const n=p.scores?.[i],done=Number.isInteger(n);
   return `<div class="detail-hole-row">
    <span class="detail-hole-index">${i+1}</span>
    <span class="detail-hole-name"><strong>${escapeHtml(h.venue)}</strong><small>${escapeHtml(h.drink)} · PAR ${h.par}</small></span>
    <span class="detail-hole-strokes">${done?n:'–'}<small>${done?signed(n-h.par):'Nog niet'}</small></span>
   </div>`;
  }).join("")}
 </div>
 <div class="detail-calculation">
  <div><span>Totaal aantal slagen</span><strong>${st.completed?st.total:"–"}</strong></div>
  <div><span>🥃 Salmari-shotjes</span><strong>${p.salmari||0} <small>× −1</small></strong></div>
  <div><span>🔨 Hit the Thomol</span><strong>${Number.isInteger(p.thomolHits)?p.thomolHits:"–"} <small>× −1</small></strong></div>
  <div><span>🎯 Stop de Pluim</span><strong>${Number.isInteger(p.pluimHits)?p.pluimHits:"–"} <small>× −1</small></strong></div>
  <div><span>Quizzen, check-in en cadeaus</span><strong>${signed(otherAdjustment)}</strong></div>
  <div class="detail-total"><span>Netto slagen</span><strong>${st.completed?st.net:"–"}</strong></div>
 </div>
 <div class="grow"></div><button class="cta" data-action="board">Terug naar klassement <span>→</span></button>
 </div>`;
}
function checkin(){
 const moods=[
  [4,"Vlees nog vis","Het kan nog alle kanten op."],
  [3,"Lekker in de oli","Kijk, nu wordt het gezellig."],
  [2,"Poepiepapiepoe","Duidelijk verhaal, chef."],
  [6,"GAA VOOR GOUUUDD","We zien wel waar het schip strandt."]
 ];
 return `<div class="page-card checkin-page">
 <span class="checkin-pill">🍺 HALVERWEGE · HOLE 03</span>
 <div class="checkin-hero">
 <h1 class="display">Hoe ga <i>je?</i></h1>
 <p>Even inchecken als vrienden onder elkaar</p></div>
 <div class="mood-grid">${moods.map((m,i)=>`<button class="mood mood-${i}" type="button" data-mood="${i}" aria-label="${m[1]}">
   ${sticker(m[0],"mood-sticker")}
   <span class="mood-copy"><strong>${m[1]}</strong><small>${m[2]}</small></span>
   <span class="mood-arrow" aria-hidden="true">↗</span>
 </button>`).join("")}</div>
 <div class="grow"></div></div>`;
}
function checkinResult(){
 const extra=checkinChoice===3;
 const lines=["Je bent er. Dat is wat telt.","Kijk, nu wordt het gezellig.","Duidelijk verhaal, chef.","GAA VOOR GOUUUDD. Kijk, dat is ambitie."];
 return `<div class="page-card result-page checkin-result ${extra?'checkin-gold':''}">
 <span class="overline">DE TUSSENSTAND · CHECK-IN</span>
 <div class="result-emoji">${extra?"🏅":"🍻"}</div>
 <h1 class="display">${extra?'Goed gedaan,<br><i>maat!</i>':'Hoppakee.<br><i>Doorrr.</i>'}</h1>
 <p class="result-copy">${lines[checkinChoice]||lines[0]}</p>
 <div class="checkin-reward">${extra?'<strong>−1</strong><span>SLAG CADEAU</span>':'<strong>✓</strong><span>CHECK-IN BINNEN</span>'}</div>
 <div class="grow"></div><button class="cta" data-action="continue">Volgende kroeg <span>→</span></button></div>`;
}
function finish(){
 const p=me(),s=p?score(p):{net:0,relative:0,bonus:0},rank=leaders().findIndex(x=>x.id===myId)+1;
 return `<div class="page-card finish-page"><span class="overline">DE LAATSTE HOLE</span><h1 class="display">Wat een<br><i>ronde.</i></h1>
 <div class="finish-avatar">${p?avatar(p):""}<span>${rank===1?"👑":rank===state.players.length&&rank>1?"💩":"⛳"}</span></div>
 <div class="finish-number">${s.net}</div><p class="helper centered">NETTO SLAGEN · ${s.bonus} BONUS</p><p class="finish-sub">#${rank} op het leaderboard</p>
 <div class="grow"></div><button class="cta" data-action="board">Bekijk de eindstand <span>→</span></button></div>`;
}
function menu(){
 const p=me();return `<div class="page-card menu-page"><button class="back" data-action="return">← Terug</button><span class="overline">HET CLUBHOUSE</span><h1 class="display">Jouw<br><i>menu.</i></h1>
 <div class="menu-list"><button data-action="board">Live klassement <span>↗</span></button><button data-action="photo">Profielfoto wijzigen <span>↗</span></button></div>
 <div class="grow"></div>${p?`<p class="menu-footer">Je speelt als ${escapeHtml(p.name)}</p>`:""}</div>`;
}

function render(){
 if(!me()&&["preview","hole","ace","board","detail","finish","menu","quiz1","quiz2","quiz4","quizResult","nominate","giftResult","checkin","checkinResult","rules","thomolIntro","thomolPlay","thomolResult","pluimIntro","pluimPlay","pluimResult"].includes(view))view="choose";
 const pages={welcome:landing,choose,profile,rules,preview,hole:holeView,ace,board:leaderboard,detail,quiz1,quiz2,quiz4,quizResult,nominate,giftResult,checkin,checkinResult,finish,menu,thomolIntro,thomolPlay,thomolResult,pluimIntro,pluimPlay,pluimResult};
 const screen=el("screen");
 screen.innerHTML=`<section class="page page-${view}">${(pages[view]||landing)()}</section>`;
 el("app").dataset.view=view;
 header();
}

function rainIcons(kind="general",amount=25){
 const overlay=el("effects");if(!overlay||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 const palettes={
  welcome:["⛳","🍺","🍆","🎉","🤡","🪩","🦩","🦄","🛟","🧀"],
  preview:["🍺","🍻","🍆","🥨","🕺","🤡","🍟","🍕","🦖","🛒","🦩","🛸","🪿"],
  drink:["🍻","🍺","🍋","🍆","🍸","🍀","🦄","🪇","🧀","🦆","🎺"],
  board:["🏆","👑","💩","⛳","🍻","🤡","🪠","🦚","🧦","🦩","🧻"],
  scorecard:["📋","🍺","🥃","🧮","🕵️","🍆","🏌️","🦆"],
  good:["🏆","🍺","👑","🕺","🎉","🎯","🍆","🦄","🪩","🚀","🪇"],
  bad:["💩","💩","🤡","🚽","🥴","🍆","🫠","🐌","🪠","🧻","🦠","🦨"],
  ace:["🏆","🍺","🍺","⛳","🌟","🍆","🤡","🍻","🎉","🦄","🚀","🪩","🦖"],
  baby:["👶","🍼","💙","🩷","🌈","🤡","🦄","🧸","🪿"],
  calendar:["📆","⏰","👶","🥳","🍼","🧮","🎰","🦉"],
  names:["👶","🤡","🍆","👨","💩","🧑‍🍼","🦆","🪇"],
  gift:["🎁","👑","🍻","🤝","🍆","💌","🦄","🪿"],
  mood:["🥴","🍺","🤡","🪩","🕺","🫠","🛸","🦖"],
  finish:["🏆","👑","💩","🎊","⛳","🦚","🦄","🪩"],
  result:["🎉","🤡","🍺","💩","🕺","🦩","🪇","🦖"],
  general:["🍻","🍆","🤡","⛳","🕺","🦄","🪿","🪇"]
 };
 const barEmojis=[
  ["🍺","🎺","🎩","🍆","🐔","🧄","🦄","🎳","🍟","🥨","🤡","🪩"],
  ["🍀","🍻","🦆","🪗","🦖","🐸","🧦","🌈","🥔","🍆","🫠","🛸"],
  ["🫒","🥒","🧀","🍺","🐐","🍄","🥖","👑","🤡","🦄","🦩","🪇"],
  ["⛳","🏆","🎯","🍺","🤡","🪠","🚀","🥁","🍆","🦖","🌟","🦆"],
  ["🍻","🧦","🐙","🍕","🍆","🛼","🦄","🤹","🥨","🍌","🎷","🫠"],
  ["🪩","🍺","🕺","🍆","🎉","🍕","🦖","🦋","🐸","💃","🪅","👑"]
 ];
 const emojis=(kind==="preview"||kind==="drink")?barEmojis[hole%6]:(palettes[kind]||palettes.general);
 for(let i=0;i<amount;i++){
  const sp=document.createElement("span");sp.className="rain-emoji";
  sp.textContent=emojis[Math.floor(Math.random()*emojis.length)];
  sp.style.left=Math.random()*97+"%";
  sp.style.animationDelay=Math.random()*1.55+"s";
  sp.style.animationDuration=(2.1+Math.random()*1.5)+"s";
  sp.style.fontSize=(19+Math.random()*25)+"px";
  sp.style.setProperty("--spin",(-180+Math.random()*360)+"deg");
  sp.style.setProperty("--sway",(-110+Math.random()*220)+"px");
  overlay.appendChild(sp);setTimeout(()=>sp.remove(),6000);
 }
}
function celebrate(count=42){
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 const overlay=el("effects");if(!overlay)return;
 for(let i=0;i<count;i++){const piece=document.createElement("i");piece.className="confetti";piece.style.left=Math.random()*100+"%";piece.style.background=["#e8be59","#2e8f74","#ff8b76","#b9ed89","#faf6e9"][i%5];piece.style.animationDelay=Math.random()*.28+"s";piece.style.setProperty("--drift",(-90+Math.random()*180)+"px");overlay.appendChild(piece);setTimeout(()=>piece.remove(),2200)}
}
function flyBeer(count=3){
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 const overlay=el("effects");if(!overlay)return;
 for(let i=0;i<count;i++){const piece=document.createElement("span");piece.className="flying-beer";piece.textContent="🍺";piece.style.top=(12+(i%6)*12)+"%";piece.style.animationDelay=(i*.12)+"s";overlay.appendChild(piece);setTimeout(()=>piece.remove(),2600)}
}
async function avatarFile(file){
 if(!file||!file.type.startsWith("image/"))return notify("Kies een foto");
 if(file.size>8000000)return notify("Maximaal 8 MB");
 const img=new Image(),url=URL.createObjectURL(file);
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
  const canvas=document.createElement("canvas");canvas.width=canvas.height=176;
  const min=Math.min(img.width,img.height),ctx=canvas.getContext("2d");
  ctx.drawImage(img,(img.width-min)/2,(img.height-min)/2,min,min,0,0,176,176);
  let output=canvas.toDataURL("image/jpeg",.66);if(output.length>60000)output=canvas.toDataURL("image/jpeg",.48);
  if(output.length>60000)return notify("Foto te groot");
  const currentName=view==="profile"?el("player-name")?.value:null;
  if(me()&&view!=="profile")update("setAvatar",{playerId:myId,avatar:output});
  else avatarDraft=output;
  render();if(currentName!==null&&el("player-name"))el("player-name").value=currentName;notify("Foto opgeslagen");
 }catch{notify("Deze foto kon niet worden gelezen")}
 finally{URL.revokeObjectURL(url);el("photo-input").value=""}
}
el("photo-input").addEventListener("change",e=>avatarFile(e.target.files?.[0]));
window.addEventListener("pubgolf:photo-selected",event=>avatarFile(event.detail?.file));
window.addEventListener("pubgolf:photo-error",()=>notify("Foto kiezen is niet gelukt"));

el("salmari-quick").addEventListener("click",()=>{
 const p=me();
 if(!salmariAvailable())return;
 if(!p)return notify("Kies eerst je profiel");
 if((p.salmari||0)>=30)return notify("Maximum bereikt");
 update("setSalmari",{playerId:myId,value:(p.salmari||0)+1},true);
 header();
 if(["board","finish"].includes(view))render();
 nativeFeedback("medium");notify("🥃 Salmari! −1 slag");
});
el("menu").addEventListener("click",()=>setView("menu"));
el("screen").addEventListener("dblclick",e=>{if(e.target.closest(".counter"))e.preventDefault()});
// Native pointer gestures: a quick tap counts one; an 850 ms hold confirms.
el("screen").addEventListener("pointerdown",e=>{
 const pad=e.target.closest("#sip-pad");
 if(pad&&view==="hole")beginSipHold(pad,e);
});
el("screen").addEventListener("pointerup",e=>{
 if(sipHoldTarget)releaseSipHold();
});
el("screen").addEventListener("pointercancel",cancelSipHold);
el("screen").addEventListener("pointerleave",e=>{
 if(sipHoldTarget)cancelSipHold();
});
el("screen").addEventListener("pointermove",e=>{
 if(!sipHoldTarget||!sipHoldPosition)return;
 if(Math.hypot((e.clientX||0)-sipHoldPosition.x,(e.clientY||0)-sipHoldPosition.y)>24)cancelSipHold();
});
el("screen").addEventListener("contextmenu",e=>{
 if(e.target.closest("#sip-pad"))e.preventDefault();
});
el("screen").addEventListener("keydown",e=>{
 if(!e.target.closest("#sip-pad")||![" ","Enter"].includes(e.key))return;
 e.preventDefault();
 if(e.repeat)return;
 beginSipHold(e.target,{button:0,isPrimary:true,clientX:0,clientY:0});
});
el("screen").addEventListener("keyup",e=>{
 if(!e.target.closest("#sip-pad")||![" ","Enter"].includes(e.key))return;
 e.preventDefault();
 if(!sipHoldDone&&sipHoldTarget){releaseSipHold();addSip();}
 else cancelSipHold();
});
el("screen").addEventListener("click",e=>{
 maybeJumpScare(e);
 const thomol=e.target.closest("[data-thomol-cell]");
 if(thomol){
  thomolHit(Number(thomol.dataset.thomolCell));
  return;
 }
 const pick=e.target.closest("[data-player]");
 if(pick){
  myId=pick.dataset.player;localStorage.setItem(meKey,myId);
  const p=me();if(p&&score(p).completed===0&&!localStorage.getItem("golf-intro-"+myId))setView("rules");else nextHole();
  return;
 }
 const mood=e.target.closest("[data-mood]");
 if(mood){
  checkinChoice=Number(mood.dataset.mood);
  update("setCheckin",{playerId:myId,value:checkinChoice},true);
  setView("checkinResult");return;
 }
 const answer=e.target.closest("[data-round]");
 if(answer){
  const round=answer.dataset.round,choice=answer.dataset.choice,p=me();
  if(!p||p.answers?.[round])return;
  let delta=0,title="",heading="",subheading="",description="",emoji="";
  if(round==="one"){
   delta=choice==="blue"?-1:choice==="pink"?1:2;
   title="BABYVOORSPELLING";
   heading=choice==="blue"?"Bingo!":choice==="pink"?"Helaas.":"Te woke,";
   subheading=choice==="blue"?"It's a boy!":choice==="pink"?"Het is een jongen.":"vriend.";
   description=choice==="blue"?"Goed geraden. Een slag cadeau.":choice==="pink"?"Roze was 'm niet. Een slag erbij.":"Alle kleuren? Twee slagen erbij.";
   emoji=choice==="blue"?"💙":choice==="pink"?"🩷":"🌈";
  }else if(round==="two"){
   delta=choice==="18"?-1:1;title="BABY COUNTDOWN";
   heading=delta<0?"BAM!":"Net mis.";
   subheading=delta<0?"18 januari.":"18 januari!";
   description=delta<0?"Helemaal goed. Pak die bonus.":"Het juiste antwoord was 18 januari.";
   emoji=delta<0?"🎯":"🤡";
  }else if(round==="four"){
   delta=-1;title="NAAM VAN HET JAAR";heading="Thomas.";subheading="Uiteraard.";
   description="Alle antwoorden waren correct. −1 slag voor je intellect.";
   emoji="👶";
  }
  questionResult={delta,title,heading,subheading,description,emoji};
  update("answerRound",{playerId:myId,round,choice},true);
  setView("quizResult");nativeFeedback(delta<0?"success":"error");if(delta<0)celebrate(36);
  rainIcons(delta<0?"good":"bad",46);return;
 }
 const vote=e.target.closest("[data-nominate]");
 if(vote){
  if(view!=="nominate"||me()?.nomination)return;
  const chosen=state.players.find(p=>p.id===vote.dataset.nominate);
  if(!chosen||(state.players.length>1&&chosen.id===myId))return;
  nomineeDraft=chosen.id;nativeFeedback("light");
  const currentScroll=el("screen")?.querySelector(".vote-grid")?.scrollTop||0;
  render();
  const grid=el("screen")?.querySelector(".vote-grid");if(grid)grid.scrollTop=currentScroll;
  return;
 }
 const golfer=e.target.closest("[data-leader]");
 if(golfer){selectedPlayerId=golfer.dataset.leader;setView("detail");return;}
 const button=e.target.closest("[data-action]");
 if(!button){
  return;
 }
 switch(button.dataset.action){
  case "start":if(me())nextHole();else setView("choose");break;
  case "welcome":setView("welcome");break;
  case "choose":setView("choose");break;
  case "create":avatarDraft="";setView("profile");break;
  case "photo":
   if(isNative())window.dispatchEvent(new Event("pubgolf:choose-photo"));
   else el("photo-input").click();
   break;
  case "register":{
   const name=el("player-name")?.value.trim().replace(/\s+/g," ");
   if(!name||name.length<2)return notify("Vul je naam in");
   if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return notify("Deze naam bestaat al");
   if(state.players.length>=32)return notify("Het veld zit vol");
   myId=newId();localStorage.setItem(meKey,myId);
   update("addPlayer",{player:{id:myId,name,avatar:avatarDraft||""}},true);
   setView("rules");break;
  }
  case "rulesDone":localStorage.setItem("golf-intro-"+myId,"1");nextHole();break;
  case "minus":
   if(view!=="hole")break;
   strokes=Math.max(0,strokes-1);refreshCounter();nativeFeedback("light");break;
  case "sip":
  case "plus":
   if(ignoreSipClick){ignoreSipClick=false;break}
   addSip();break;
  case "submit":
   confirmSipScore();break;
  case "confirmNominate":{
   if(view!=="nominate"||me()?.nomination)return;
   const chosen=state.players.find(p=>p.id===nomineeDraft);
   if(!chosen||(state.players.length>1&&chosen.id===myId))return notify("Kies een andere golfer");
   questionResult={friend:chosen.name};
   update("nominate",{playerId:myId,targetPlayerId:chosen.id},true);
   nomineeDraft="";
   nativeFeedback("success");setView("giftResult");celebrate(42);return;
  }
  case "thomolStart":if(view==="thomolIntro")thomolStart();break;
  case "thomolSkip":thomolSkip();break;
  case "pluimStart":if(view==="pluimIntro")pluimStart();break;
  case "pluimStop":pluimStop();break;
  case "pluimSkip":pluimSkip();break;
  case "continue":nextHole();break;
  case "pourDrink":
   if(view!=="preview"||pourReady)break;
   pourReady=true;
   nativeFeedback("medium");
   render();
   break;
  case "gotDrink":
   if(view!=="preview"||!pourReady)break;
   nativeFeedback("light");
   setView("hole");
   break;
  case "replayAce":
   if(view==="ace"){render();nativeFeedback("success");aceBlast()}
   break;
  case "board":setView("board");break;
  case "finish":setView("finish");break;
  case "menu":setView("menu");break;
  case "return":nextHole();break;
  


 }
});
if(state.epoch!==RESET_EPOCH){
 state={players:[],revision:0,epoch:RESET_EPOCH};
 queue=[];myId="";localStorage.removeItem(meKey);save();
}
render();
if(me())nextHole();else setTimeout(()=>rainIcons("welcome",15),450);
poll();setInterval(()=>{if(!document.hidden)poll()},5500);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)poll()});
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();