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
const storeKey="golf-v3-"+room,meKey="golf-me-"+room,queueKey="golf-queue-"+room;
const parse=(raw,fallback)=>{try{return JSON.parse(raw)||fallback}catch{return fallback}};
let state=parse(localStorage.getItem(storeKey),{players:[],revision:0});
let queue=parse(localStorage.getItem(queueKey),[]);
let myId=localStorage.getItem(meKey)||"",view="welcome",hole=0,strokes=8,fromEdit=false;
let network=false,flushing=false,polling=false,toastTimer,avatarDraft="",checkinChoice=-1;
const el=id=>document.getElementById(id);
const escapeHtml=text=>String(text??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const newId=()=>globalThis.crypto?.randomUUID?.()||"x"+Date.now().toString(36)+Math.random().toString(36).slice(2);
const me=()=>state.players.find(p=>p.id===myId);
const save=()=>{localStorage.setItem(storeKey,JSON.stringify(state));localStorage.setItem(queueKey,JSON.stringify(queue))};
function score(p){
 const arr=Array.isArray(p.scores)?p.scores:[];
 let total=0,par=0,completed=0;
 arr.forEach((val,i)=>{if(Number.isInteger(val)&&i<6){total+=val;par+=HOLES[i].par;completed++}});
 const bonus=(p.salmari||0)+(p.checkin===3?1:0);
 return {completed,total,net:total-bonus,relative:total-bonus-par,bonus};
}
const leaders=()=>[...state.players].sort((a,b)=>score(b).completed-score(a).completed||score(a).relative-score(b).relative||a.name.localeCompare(b.name,"nl"));
function notify(message){
 const toast=el("toast");toast.textContent=message;toast.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("visible"),2300);
}
function apply(s,a){
 const p=s.players.find(p=>p.id===a.playerId);
 if(a.type==="addPlayer"&&!s.players.some(x=>x.id===a.player.id)){
  s.players.push({...a.player,scores:Array(6).fill(null),salmari:0,checkin:null});
 }else if(a.type==="setScore"&&p)p.scores[a.hole]=a.value;
 else if(a.type==="setSalmari"&&p)p.salmari=a.value;
 else if(a.type==="setAvatar"&&p)p.avatar=a.avatar;
 else if(a.type==="setCheckin"&&p)p.checkin=a.value;
}
function update(type,details,quiet=false){
 const a={id:newId(),type,...details};
 apply(state,a);queue.push(a);save();
 if(!quiet)render();
 flush();
}
async function flush(){
 if(flushing||!queue.length)return;
 flushing=true;
 try{
  while(queue.length){
   const response=await fetch("/api/action?room="+encodeURIComponent(room),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(queue[0])});
   if(!response.ok){const info=await response.json().catch(()=>({}));throw Error(info.error||"Opslaan mislukt")}
   const current=await response.json();queue.shift();queue.forEach(a=>apply(current,a));state=current;save();network=true;
  }
 }catch(err){network=false;console.warn("offline",err)}
 finally{flushing=false;status()}
}
async function poll(){
 if(polling||flushing)return;polling=true;
 try{
  const response=await fetch("/api/state?room="+encodeURIComponent(room),{cache:"no-store"});
  if(!response.ok)throw Error("Geen verbinding");
  const remote=await response.json();const oldRevision=state.revision;
  queue.forEach(a=>apply(remote,a));state=remote;save();network=true;
  if(remote.revision!==oldRevision&&!["profile","hole","checkin"].includes(view))render();
  if(queue.length)flush();
 }catch{network=false}
 finally{polling=false;status()}
}
function status(){const dot=el("connection");if(dot)dot.classList.toggle("online",network)}
function avatar(p,extra=""){
 const name=escapeHtml(p.name?.slice(0,1)?.toUpperCase()||"?");
 return `<span class="avatar ${extra}">${p.avatar?`<img alt="" src="${p.avatar}">`:name}</span>`;
}
function header(){
 const p=me(),h=el("header-avatar"),b=el("switcher");
 if(!h||!b)return;
 h.innerHTML=p?.avatar?`<img alt="" src="${p.avatar}">`:escapeHtml(p?.name?.[0]?.toUpperCase()||"↗");
 b.setAttribute("aria-label",p?"Wissel speler: "+p.name:"Kies een spelersprofiel");
 status();
}
function setView(next){
 view=next;render();
 window.scrollTo({top:0,behavior:"instant"});
}
function nextHole(){
 const p=me();if(!p){setView("choose");return}
 const first=p.scores.findIndex(n=>!Number.isInteger(n));
 if(first<0){setView("finish");return}
 if(first>=3&&Number.isInteger(p.scores[2])&&!Number.isInteger(p.checkin)){setView("checkin");return}
 hole=first;fromEdit=false;strokes=Number.isInteger(p.scores[hole])?p.scores[hole]:HOLES[hole].par;
 setView("hole");
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
function landing(){
 return `<div class="landing page-card">
 <div class="intro-copy"><span class="overline">HAARLEM OPEN</span><h1 class="display">Golf. Bier.<br><i>Thomas.</i></h1><p>De ronde is begonnen.</p></div>
 <div class="hero-photo"><img src="./assets/thomas-4.webp" alt="Thomas in feeststemming"><span class="hero-tag">THE DADCHELOR CUP</span></div>
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
 <div class="rule"><span>04</span><p>Salmari telt als één slag aftrek. Meedoen is vrijwillig en alcoholvrij kan ook.</p></div>
 <div class="grow"></div><button class="cta" data-action="rulesDone">Begrepen. Tee off! <span>→</span></button></div>`;
}
function holeView(){
 const h=HOLES[hole];const progress=HOLES.map((x,i)=>`<span class="${i<=hole?'active':''}"></span>`).join("");
 return `<div class="page-card hole-page"><div class="progress">${progress}</div>
 <div class="hole-head"><span class="overline">HOLE ${hole+1} / 6</span><span class="par-badge">PAR ${h.par}</span></div>
 <h1 class="venue">${escapeHtml(h.venue)}</h1><p class="drink-name">${escapeHtml(h.drink)} <span>· ${escapeHtml(h.details)}</span></p>
 ${h.special?'<div class="hole-tag">⭐ HOLE-IN-ONE</div>':''}
 <div class="drink-frame">${svgDrink(h.visual)}</div>
 <div class="score-control"><div class="overline">JOUW SLAGEN</div>
 <div class="counter" role="group" aria-label="Aantal slagen"><button data-action="minus" aria-label="Minder slagen" type="button">−</button><strong id="stroke-value">${strokes}</strong><button data-action="plus" aria-label="Meer slagen" type="button">+</button></div>
 <p class="counter-note">${strokes<h.par?`${h.par-strokes} onder par`:strokes===h.par?"Precies op par":`${strokes-h.par} boven par`}</p></div>
 <div class="grow"></div><button class="cta" data-action="submit">Score vastleggen <span>→</span></button></div>`;
}
function leaderboard(){
 const players=leaders(),p=me(),s=p?score(p):null,done=s?.completed===6;
 return `<div class="page-card leader-page">
 <span class="overline">${done?"DE EINDSTAND":"LIVE KLASSEMENT"}</span>
 <h1 class="display">The <i>clubhouse.</i></h1><p class="helper">De stand na jouw laatste hole.</p>
 <div class="leader-list">${players.map((player,index)=>{
 const stat=score(player),last=index===players.length-1&&players.length>1;
 return `<div class="leader-row ${index===0?'winner':''} ${player.id===myId?'selected':''}" style="--row:${Math.min(index,12)}">
 <div class="rank">${index+1}</div><div class="avatar-holder">${avatar(player)}${index===0?'<span class="award crown">👑</span>':last?'<span class="award poo">💩</span>':''}</div>
 <div class="leader-name"><strong>${escapeHtml(player.name)}${player.id===myId?' <span class="you">jij</span>':''}</strong><small>${stat.completed} / 6 holes</small></div>
 <div class="leader-score">${stat.completed?`${stat.relative>0?'+':''}${stat.relative}`:'–'}<small>t.o.v. par</small></div>
 </div>`;
 }).join("")}</div>
 <div class="leader-bottom"><button class="cta" data-action="${done?'finish':'continue'}">${done?'Mijn eindscore':'Volgende hole'} <span>→</span></button></div></div>`;
}
function checkin(){
 const moods=[["😎","Topfit"],["😊","Gezellig"],["🥴","Licht wankel"],["🤪","Erg dronken"]];
 return `<div class="page-card checkin-page"><span class="overline">HALVERWEGE</span><h1 class="display">Even<br><i>inchecken.</i></h1><p class="checkin-question">Hoe dronken ben je?</p>
 <div class="mood-grid">${moods.map((m,i)=>`<button class="mood" data-mood="${i}" aria-label="${m[1]}"><span>${m[0]}</span><strong>${m[1]}</strong></button>`).join("")}</div>
 <p class="small-message">Gewoon even eerlijk inchecken.</p>
 <div class="grow"></div></div>`;
}
function checkinResult(){
 const extra=checkinChoice===3;
 return `<div class="page-card result-page"><span class="overline">CHECK-IN COMPLETE</span>
 <div class="result-emoji">${extra?"🏅":"🙌"}</div><h1 class="display">${extra?"Lekker bezig,<br><i>maat.</i>":"Mooie<br><i>check-in.</i>"}</h1>
 <p class="result-copy">${extra?"Gefeliciteerd! −1 slag voor de effort.":"Op naar de volgende hole!"}</p>
 <div class="grow"></div><button class="cta" data-action="continue">Volgende hole <span>→</span></button></div>`;
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
 <div class="menu-list"><button data-action="board">Live klassement <span>↗</span></button><button data-action="edit">Scores aanpassen <span>↗</span></button><button data-action="bonus">Salmari <span>↗</span></button><button data-action="photo">Profielfoto wijzigen <span>↗</span></button><button data-action="choose">Wissel speler <span>↗</span></button></div>
 <div class="grow"></div>${p?`<p class="menu-footer">Je speelt als ${escapeHtml(p.name)}</p>`:""}</div>`;
}
function editView(){
 const p=me();return `<div class="page-card edit-page"><button class="back" data-action="menu">← Terug</button><span class="overline">SCOREKAART</span><h1 class="display">Jouw<br><i>holes.</i></h1>
 <div class="edit-list">${HOLES.map((h,i)=>`<button data-hole="${i}"><span class="edit-num">${i+1}</span><span class="edit-name">${escapeHtml(h.venue)}<small>${escapeHtml(h.drink)}</small></span><strong>${Number.isInteger(p?.scores[i])?p.scores[i]:"–"}</strong><span>→</span></button>`).join("")}</div></div>`;
}
function bonus(){
 const p=me(),n=p?.salmari||0;
 return `<div class="page-card bonus-page"><button class="back" data-action="menu">← Terug</button><span class="overline">BONUS</span><h1 class="display">Salmari<br><i>bonus.</i></h1>
 <div class="bonus-visual">🥃</div><p class="helper centered">Iedere Salmari betekent één slag aftrek.</p>
 <div class="counter"><button data-action="bonusminus" type="button">−</button><strong>${n}</strong><button data-action="bonusplus" type="button">+</button></div>
 <div class="grow"></div><button class="cta" data-action="board">Klaar <span>→</span></button></div>`;
}
function render(){
 if(!me()&&["hole","board","edit","bonus","finish","menu","checkin","checkinResult","rules"].includes(view))view="choose";
 const pages={welcome:landing,choose,profile,rules,hole:holeView,board:leaderboard,checkin,checkinResult,finish,menu,edit:editView,bonus};
 el("screen").innerHTML=`<section class="page page-${view}">${(pages[view]||landing)()}</section>`;
 header();
}
function celebrate(){
 const overlay=el("effects");if(!overlay)return;
 for(let i=0;i<42;i++){const piece=document.createElement("i");piece.className="confetti";piece.style.left=Math.random()*100+"%";piece.style.background=["#e8be59","#2e8f74","#ff8b76","#b9ed89","#faf6e9"][i%5];piece.style.animationDelay=Math.random()*.28+"s";piece.style.setProperty("--drift",(-90+Math.random()*180)+"px");overlay.appendChild(piece);setTimeout(()=>piece.remove(),2200)}
}
function flyBeer(){
 const overlay=el("effects");if(!overlay)return;
 for(let i=0;i<3;i++){const piece=document.createElement("span");piece.className="flying-beer";piece.textContent="🍺";piece.style.top=(25+i*20)+"%";piece.style.animationDelay=(i*.12)+"s";overlay.appendChild(piece);setTimeout(()=>piece.remove(),1400)}
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
  if(me()&&view!=="profile")update("setAvatar",{playerId:myId,avatar:output});
  else avatarDraft=output;
  render();notify("Foto opgeslagen");
 }catch{notify("Deze foto kon niet worden gelezen")}
 finally{URL.revokeObjectURL(url);el("photo-input").value=""}
}
el("photo-input").addEventListener("change",e=>avatarFile(e.target.files?.[0]));
el("switcher").addEventListener("click",()=>setView("choose"));
el("menu").addEventListener("click",()=>setView("menu"));
el("screen").addEventListener("dblclick",e=>{if(e.target.closest(".counter"))e.preventDefault()});
el("screen").addEventListener("click",e=>{
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
 const selectedHole=e.target.closest("[data-hole]");
 if(selectedHole){
  hole=Number(selectedHole.dataset.hole);strokes=me()?.scores?.[hole]??HOLES[hole].par;fromEdit=true;setView("hole");return;
 }
 const button=e.target.closest("[data-action]");if(!button)return;
 switch(button.dataset.action){
  case "start":if(me())nextHole();else setView("choose");break;
  case "welcome":setView("welcome");break;
  case "choose":setView("choose");break;
  case "create":avatarDraft="";setView("profile");break;
  case "photo":el("photo-input").click();break;
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
  case "minus":strokes=Math.max(1,strokes-1);render();break;
  case "plus":strokes=Math.min(99,strokes+1);render();break;
  case "submit":{
   const under=strokes<HOLES[hole].par;
   update("setScore",{playerId:myId,hole,value:strokes},true);
   setView("board");
   if(under)setTimeout(celebrate,65);
   setTimeout(flyBeer,95);
   break;
  }
  case "continue":nextHole();break;
  case "board":setView("board");break;
  case "finish":setView("finish");break;
  case "menu":setView("menu");break;
  case "return":nextHole();break;
  case "edit":setView("edit");break;
  case "bonus":setView("bonus");break;
  case "bonusplus":if(me())update("setSalmari",{playerId:myId,value:Math.min(30,(me().salmari||0)+1)});break;
  case "bonusminus":if(me())update("setSalmari",{playerId:myId,value:Math.max(0,(me().salmari||0)-1)});break;
 }
});
render();
if(me())nextHole();
poll();setInterval(poll,3500);
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();