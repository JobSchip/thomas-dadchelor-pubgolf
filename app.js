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
let network=false,flushing=false,polling=false,toastTimer,avatarDraft="",checkinChoice=-1,aceTimer=null,questionResult={},nomineeDraft="",pourReady=false;
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
 let adjustment=-(p.salmari||0)-(p.checkin===3?1:0);
 if(answer.one==='blue')adjustment-=1;
 else if(answer.one==='pink')adjustment+=1;
 else if(answer.one==='rainbow')adjustment+=2;
 if(answer.two)adjustment+=answer.two==='18'?-1:1;
 if(answer.four)adjustment-=1;
 const gifts=state.players.filter(x=>x.nomination===p.id).length;
 adjustment-=gifts;
 return {completed,total,net:total+adjustment,relative:total+adjustment-par,bonus:-adjustment,gifts};
}
const leaders=()=>[...state.players].sort((a,b)=>score(b).completed-score(a).completed||score(a).relative-score(b).relative||a.name.localeCompare(b.name,"nl"));
function notify(message){
 const toast=el("toast");toast.textContent=message;toast.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("visible"),2300);
}
function apply(s,a){
 const p=s.players.find(p=>p.id===a.playerId);
 if(a.type==="addPlayer"&&!s.players.some(x=>x.id===a.player.id)){
  s.players.push({...a.player,scores:Array(6).fill(null),salmari:0,checkin:null,answers:{},nomination:null});
 }else if(a.type==="setScore"&&p&&!Number.isInteger(p.scores[a.hole]))p.scores[a.hole]=a.value;
 else if(a.type==="setSalmari"&&p)p.salmari=a.value;
 else if(a.type==="setAvatar"&&p)p.avatar=a.avatar;
 else if(a.type==="setCheckin"&&p)p.checkin=a.value;
 else if(a.type==="answerRound"&&p){p.answers=p.answers||{};p.answers[a.round]=a.choice;}
 else if(a.type==="nominate"&&p)p.nomination=a.targetPlayerId;
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
 if(next==="preview"&&me())localStorage.setItem("golf-firstdrink-"+room+"-"+myId,"1");
 if(next==="nominate")nomineeDraft="";
 if(next==="preview")pourReady=false;
 view=next;render();
 window.scrollTo({top:0,behavior:"instant"});
 const kind={preview:"preview",hole:"drink",board:"board",detail:"scorecard",checkin:"mood",checkinResult:"mood",quiz1:"baby",quiz2:"calendar",quiz4:"names",nominate:"gift",quizResult:"result",giftResult:"gift",ace:"ace",finish:"finish",welcome:"welcome"}[next]||"general";
 setTimeout(()=>rainIcons(kind,next==="ace"?56:next==="preview"?22:next==="board"?16:14),120);
}
function nextHole(){
 const p=me();if(!p){setView("choose");return}
 const done=p.scores||[];
 const answers=p.answers||{};
 if(Number.isInteger(done[0])&&!answers.one){setView("quiz1");return}
 if(Number.isInteger(done[1])&&!answers.two){setView("quiz2");return}
 if(Number.isInteger(done[2])&&!Number.isInteger(p.checkin)){setView("checkin");return}
 if(Number.isInteger(done[3])&&!answers.four){setView("quiz4");return}
 if(Number.isInteger(done[4])&&!p.nomination){setView("nominate");return}
 const first=done.findIndex(n=>!Number.isInteger(n));
 if(first<0){setView("finish");return}
 hole=first;strokes=HOLES[hole].par;
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
function refreshCounter(){
 const number=el("stroke-value"),hint=el("screen")?.querySelector(".counter-note");
 if(number)number.textContent=String(strokes);
 if(hint){const par=HOLES[hole].par;hint.textContent=strokes<par?(par-strokes)+" onder par":strokes===par?"Precies op par":(strokes-par)+" boven par"}
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
 <div class="taproom-topline"><span class="taproom-onair"><span class="taproom-light"></span>DE VOLGENDE RONDE</span><span class="taproom-hole">0${hole+1}<small> / 06</small></span></div>
 <div class="taproom-heading"><span class="taproom-label">AAN DE BAR BIJ</span>
 <h1>${escapeHtml(h.venue)}</h1>
 <p class="taproom-order"><strong>${escapeHtml(h.drink)}</strong><span>${escapeHtml(h.details)}</span></p>
 </div>
 <div class="taproom-machine-area">
  <div class="taproom-nudge" aria-live="polite">${ready?'VERS GETAPT. NETJES.':'TIK OP DE TAP OM IN TE SCHENKEN'}</div>
  <button class="taproom-machine ${ready?'has-poured':''}" data-action="${ready?'gotDrink':'pourDrink'}" type="button" aria-label="${ready?'Je drankje is klaar, ga naar de score':'Tik op de tap om je glas te vullen'}">
    <span class="taproom-tap" aria-hidden="true"><span class="taproom-tap-neck"></span><span class="taproom-tap-head"></span><span class="taproom-tap-handle"></span><span class="taproom-tap-spout"></span></span>
    <span class="taproom-stream" aria-hidden="true"></span>
    <span class="taproom-glass glass-${h.visual}" aria-hidden="true">
      <span class="taproom-beer"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="taproom-foam"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="taproom-glass-shine"></span>
      <span class="taproom-glass-label">T<br>O</span>
    </span>
    <span class="taproom-driptray" aria-hidden="true"></span>
  </button>
 </div>
 <div class="taproom-footer">
  <div class="taproom-banter" aria-live="polite"><span>${ready?'🍻':'🗣️'}</span><p>${escapeHtml(BAR_LINES[hole][ready?1:0])}</p></div>
  <button type="button" class="taproom-cta" data-action="${ready?'gotDrink':'pourDrink'}"><span class="taproom-cta-icon">${ready?'✓':'🍺'}</span><span class="taproom-cta-copy"><strong>${ready?"Ik heb m'n drankje!":"Tap dat biertje"}</strong><small>${ready?'Op naar de scorekaart':'Eén tik en hij staat klaar'}</small></span><span class="taproom-arrow">→</span></button>
  <div class="taproom-bottomline"><span>⛳ PAR ${h.par}</span><span>THOMAS' OPEN · HOLE ${hole+1}</span></div>
 </div>
 </div>`;
}
function holeView(){
 const h=HOLES[hole];const progress=HOLES.map((x,i)=>`<span class="${i<=hole?'active':''}"></span>`).join("");
 return `<div class="page-card hole-page" style="--haze:${hole*2.6}px;--haze-alpha:${0.08+hole*.05}"><div class="progress">${progress}</div>
 <div class="hole-head"><span class="overline">HOLE ${hole+1} / 6</span><span class="par-badge">PAR ${h.par}</span></div>
 <h1 class="venue">${escapeHtml(h.venue)}</h1><p class="drink-name">${escapeHtml(h.drink)} <span>· ${escapeHtml(h.details)}</span></p>
 ${h.special?'<div class="hole-tag">⭐ HOLE-IN-ONE</div>':''}
 <div class="drink-frame">${svgDrink(h.visual)}</div>
 <div class="score-control"><div class="overline">JOUW SLAGEN</div>
 <div class="counter" role="group" aria-label="Aantal slagen"><button data-action="minus" aria-label="Minder slagen" type="button">−</button><strong id="stroke-value">${strokes}</strong><button data-action="plus" aria-label="Meer slagen" type="button">+</button></div>
 <p class="counter-note">${strokes<h.par?`${h.par-strokes} onder par`:strokes===h.par?"Precies op par":`${strokes-h.par} boven par`}</p></div>
 <div class="grow"></div><button class="cta" data-action="submit">Score vastleggen <span>→</span></button></div>`;
}
function ace(){
 return `<div class="ace-wrap page-card">
 <span class="ace-overline">HOLE 04 · BIERLOKAAL</span>
 <div class="ace-ball">⛳</div>
 <div class="ace-ring"></div>
 <p class="ace-small">DIT. IS. 'M.</p>
 <h1 class="ace-big">HOLE<br>IN ONE<span>!</span></h1>
 <p class="ace-wow">GE-WEL-DIG!</p>
 <p class="ace-copy">Dat fluitje zat in één keer. Legende.</p>
 <div class="grow"></div>
 <button class="cta ace-cta" data-action="board">Naar het klassement <span>→</span></button>
 </div>`;
}

function quiz1(){
 return `<div class="page-card question-page question-baby">
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
 return `<div class="page-card question-page question-date"><span class="overline">NA HOLE 2 · THOMAS TRIVIA</span>
 <h1 class="display">Wanneer<br>is <i>Danique</i><br>uitgerekend?</h1>
 <p class="question-sub">Kies de juiste dag in januari.</p>
 <div class="date-grid">${days.map(x=>`<button data-round="two" data-choice="${x}"><strong>${x}</strong><span>JAN</span></button>`).join("")}</div>
 <div class="grow"></div></div>`;
}
function quiz4(){
 const labels=['Thomas','Thomas','thomas','Misschien Thomas'];
 const choice=['Thomas','THOMAS','thomas','misschien-thomas'];
 return `<div class="page-card question-page question-name">
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
 const players=leaders(),p=me(),st=p?score(p):null,done=st?.completed===6;
 const podium=players.slice(0,3),rest=players.slice(3);
 const format=n=>n>0?'+'+n:String(n);
 return `<div class="page-card leader-page">
 <div class="leader-heading">
  <div><span class="overline">${done?'DE EINDSTAND':'LIVE KLASSEMENT'}</span>
  <h1 class="display">The <i>clubhouse.</i></h1></div>
  <span class="leader-live"><span class="leader-live-dot"></span>${done?'FINISH':'LIVE'}</span>
 </div>
 <p class="helper leader-helper">De stand van zaken. Tik op een golfer voor de scorekaart.</p>
 ${players.length? `<div class="podium" aria-label="Top drie golfers">
 ${podium.map((player,index)=>{
 const stat=score(player);
 return `<button type="button" class="podium-card place-${index+1} ${player.id===myId?'is-you':''}" data-leader="${escapeHtml(player.id)}" aria-label="Bekijk scorekaart van ${escapeHtml(player.name)}">
  <span class="podium-medal">${rankIcon(index,players.length)}</span>
  ${avatar(player,"podium-avatar")}
  <span class="podium-name">${escapeHtml(player.name)}${player.id===myId?' <small>JIJ</small>':''}</span>
  <strong class="podium-score">${stat.completed?format(stat.relative):'–'}</strong>
  <small class="podium-meta">${stat.completed}/6 holes · PAR</small>
 </button>`;
 }).join("")}</div>` : '<div class="no-players">Nog geen golfers aan de start.</div>'}
 ${rest.length?`<div class="leader-section-title"><span>DE REST VAN DE CLUB</span><span>${players.length} DEELNEMERS</span></div>
 <div class="leader-list">${rest.map((player,i)=>{
  const index=i+3,stat=score(player),last=index===players.length-1,emblem=rankIcon(index,players.length);
  return `<button type="button" data-leader="${escapeHtml(player.id)}" aria-label="Bekijk de scorekaart van ${escapeHtml(player.name)}" class="leader-row ${player.id===myId?'selected':''}" style="--row:${Math.min(index,18)}">
  <span class="rank"><span class="rank-emoji" aria-hidden="true">${emblem}</span><span class="rank-num">${index+1}</span></span>
  <span class="avatar-holder">${avatar(player)}${last?'<span class="award poo">💩</span>':''}</span>
  <span class="leader-name"><strong>${escapeHtml(player.name)}${player.id===myId?' <span class="you">jij</span>':''}</strong><small>${stat.completed} van 6 holes</small></span>
  <span class="leader-score">${stat.completed?format(stat.relative):'–'}<small>t.o.v. PAR</small></span>
  <span class="leader-arrow" aria-hidden="true">›</span>
  </button>`;
 }).join("")}</div>`:''}
 <div class="grow"></div>
 <div class="leader-bottom"><button class="cta" data-action="${done?'finish':'continue'}">${done?'Mijn eindscore':'Volgende hole'} <span>→</span></button></div>
 </div>`;
}
function detail(){
 const p=state.players.find(x=>x.id===selectedPlayerId);
 if(!p)return `<div class="page-card"><button class="back" data-action="board">← Klassement</button><p>Deze golfer is niet gevonden.</p></div>`;
 const st=score(p),rank=leaders().findIndex(x=>x.id===p.id)+1;
 const otherAdjustment=st.net-st.total+(p.salmari||0);
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
  <div><span>Quizzen, check-in en cadeaus</span><strong>${signed(otherAdjustment)}</strong></div>
  <div class="detail-total"><span>Netto slagen</span><strong>${st.completed?st.net:"–"}</strong></div>
 </div>
 <div class="grow"></div><button class="cta" data-action="board">Terug naar klassement <span>→</span></button>
 </div>`;
}
function checkin(){
 const moods=[
  ["😐","Vlees noch vis","Nog niet echt begonnen."],
  ["😏","Stel je niet aan","Kan nog best een ronde bij."],
  ["🥴","Net in de olie","Kijk, nu komen we ergens."],
  ["🤪","Ga voor goud","Geen commentaar, chef."]
 ];
 return `<div class="page-card checkin-page">
 <span class="checkin-pill">🍺 HALVERWEGE · HOLE 03</span>
 <div class="checkin-hero"><span aria-hidden="true">🪩</span>
 <h1 class="display">Hoe staat<br><i>de motor?</i></h1>
 <p>Even eerlijk, kameraad. Hoe staat ’t ervoor?</p></div>
 <div class="mood-grid">${moods.map((m,i)=>`<button class="mood mood-${i}" type="button" data-mood="${i}" aria-label="${m[1]}">
   <span class="mood-emoji" aria-hidden="true">${m[0]}</span>
   <span class="mood-copy"><strong>${m[1]}</strong><small>${m[2]}</small></span>
   <span class="mood-arrow" aria-hidden="true">↗</span>
 </button>`).join("")}</div>
 <p class="small-message">Geen jury. Wel een bonusslag als je voor goud gaat. 🏅</p>
 <div class="grow"></div></div>`;
}
function checkinResult(){
 const extra=checkinChoice===3;
 const lines=["Prima. We zien je bij de volgende.","Dat wilden we horen, maat.","Zo kennen we je weer.","Kijk, dát is een instelling."];
 return `<div class="page-card result-page checkin-result ${extra?'checkin-gold':''}">
 <span class="overline">DE TUSSENSTAND · CHECK-IN</span>
 <div class="result-emoji">${extra?"🏅":"🍻"}</div>
 <h1 class="display">${extra?'Ga voor <i>goud.</i>':'Hoppakee.<br><i>Doorrr.</i>'}</h1>
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
 if(!me()&&["preview","hole","ace","board","detail","finish","menu","quiz1","quiz2","quiz4","quizResult","nominate","giftResult","checkin","checkinResult","rules"].includes(view))view="choose";
 const pages={welcome:landing,choose,profile,rules,preview,hole:holeView,ace,board:leaderboard,detail,quiz1,quiz2,quiz4,quizResult,nominate,giftResult,checkin,checkinResult,finish,menu};
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
 const overlay=el("effects");if(!overlay)return;
 for(let i=0;i<count;i++){const piece=document.createElement("i");piece.className="confetti";piece.style.left=Math.random()*100+"%";piece.style.background=["#e8be59","#2e8f74","#ff8b76","#b9ed89","#faf6e9"][i%5];piece.style.animationDelay=Math.random()*.28+"s";piece.style.setProperty("--drift",(-90+Math.random()*180)+"px");overlay.appendChild(piece);setTimeout(()=>piece.remove(),2200)}
}
function flyBeer(count=3){
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
 const button=e.target.closest("[data-action]");if(!button)return;
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
  case "minus":strokes=Math.max(1,strokes-1);refreshCounter();nativeFeedback("light");break;
  case "plus":strokes=Math.min(99,strokes+1);refreshCounter();nativeFeedback("light");break;
  case "submit":{
   if(Number.isInteger(me()?.scores?.[hole])){notify("Deze score staat al vast");break}
   const under=strokes<HOLES[hole].par;
   const above=strokes>HOLES[hole].par;
   const holeInOne=hole===3&&strokes===1;
   update("setScore",{playerId:myId,hole,value:strokes},true);
   nativeFeedback(holeInOne?"success":above?"error":"medium");
   if(holeInOne){
     setView("ace");
     setTimeout(()=>{if(view==="ace"){celebrate(110);flyBeer(9);rainIcons("ace",90)}},70);
     setTimeout(()=>{if(view==="ace")celebrate(75)},900);
     aceTimer=setTimeout(()=>{if(view==="ace")setView("board")},4200);
   }else{
     setView("board");
     if(under)setTimeout(()=>{celebrate(44);rainIcons("good",58)},65);
     if(above)setTimeout(()=>rainIcons("bad",72),90);
     setTimeout(()=>flyBeer(3),95);
   }
   break;
  }
  case "confirmNominate":{
   if(view!=="nominate"||me()?.nomination)return;
   const chosen=state.players.find(p=>p.id===nomineeDraft);
   if(!chosen||(state.players.length>1&&chosen.id===myId))return notify("Kies een andere golfer");
   questionResult={friend:chosen.name};
   update("nominate",{playerId:myId,targetPlayerId:chosen.id},true);
   nomineeDraft="";
   nativeFeedback("success");setView("giftResult");celebrate(42);return;
  }
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