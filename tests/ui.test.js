'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const styles=fs.readFileSync(path.resolve(__dirname,'../styles.css'),'utf8');
const EPOCH='THOMAS-NOV05-FULL-RESET-4';

function player(name,id,scores,checkin,answers,nomination=null){
 return {id,name,avatar:'',scores,salmari:0,checkin,answers,nomination};
}
function boot(players,myId='p1',options={}){
 const storage=new Map([
  ['golf-room','THOMAS-OPEN'],
  ['golf-v5-THOMAS-OPEN',JSON.stringify({players,revision:4,updatedAt:0,epoch:EPOCH})],
  ['golf-me-v5-THOMAS-OPEN',myId]
 ]);
 const elements=new Map();
 function get(id){
  if(!elements.has(id))elements.set(id,{
   id,dataset:{},innerHTML:'',textContent:'',hidden:false,disabled:false,
   style:{},listeners:{},classList:{add(){},remove(){},toggle(){}},
   setAttribute(){},querySelector(){return null},appendChild(){},
   addEventListener(type,fn){this.listeners[type]=fn}
  });
  return elements.get(id);
 }
 const fakeMath=Object.create(Math);
 if(typeof options.random==='number')fakeMath.random=()=>options.random;
 const ctx={
  console,URLSearchParams,Math:fakeMath,Date,
  location:{search:'?room=THOMAS-OPEN',pathname:'/',protocol:'https:'},
  history:{replaceState(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{getElementById:get,hidden:false,addEventListener(){},
   body:options.allowScares?{appendChild(){}}:undefined,
   createElement:()=>({style:{setProperty(){}},remove(){},className:'',textContent:'',setAttribute(){},querySelector(){return null}})},
  window:{scrollTo(){},addEventListener(){},matchMedia(){return{matches:options.reducedMotion??true}}},
  navigator:{},
  fetch:()=>new Promise(()=>{}),
  setTimeout:()=>1,clearTimeout(){},setInterval:()=>1
 };
 vm.runInNewContext(source,ctx,{timeout:2500,filename:'app.js'});
 function click(kind,value){
  get('screen').listeners.click({target:{closest(selector){
   if(kind==='vote'&&selector==='[data-nominate]')return {dataset:{nominate:value}};
   if(kind==='mood'&&selector==='[data-mood]')return {dataset:{mood:value}};
   if(kind==='action'&&selector==='[data-action]')return {dataset:{action:value}};
   if(kind==='leader'&&selector==='[data-leader]')return {dataset:{leader:value}};
   return null;
  }}});
 }
 return {
  click,view:()=>get('app').dataset.view,html:()=>get('screen').innerHTML,
  state:()=>JSON.parse(storage.get('golf-v5-THOMAS-OPEN')),queue:()=>JSON.parse(storage.get('golf-queue-v5-THOMAS-OPEN')||'[]'),
  element:get,storage
 };
}

test('bonusronde is een fotogrid, niet het klassement, en slaat pas na bevestiging op',()=>{
 const a=player('Alec','p1',[8,10,8,1,7,null],1,{one:'blue',two:'18',four:'Thomas'});
 const b=player('Vincent','p2',[8,10,8,1,7,null],1,{one:'blue',two:'18',four:'Thomas'});
 const ui=boot([a,b]);
 assert.equal(ui.view(),'nominate');
 assert.match(ui.html(),/class="vote-grid"/);
 assert.doesNotMatch(ui.html(),/leader-row/);
 assert.doesNotMatch(ui.html(),/data-nominate="p1"/);
 assert.match(ui.html(),/confirmNominate/);
 ui.click('vote','p2');
 assert.equal(ui.state().players[0].nomination,null);
 assert.equal(ui.queue().length,0);
 assert.match(ui.html(),/vote-card is-picked/);
 ui.click('action','confirmNominate');
 assert.equal(ui.view(),'giftResult');
 assert.equal(ui.state().players[0].nomination,'p2');
 assert.equal(ui.queue().filter(x=>x.type==='nominate').length,1);
 assert.match(ui.html(),/Vincent/);
});

test('dronken-check-in gebruikt de nieuwe vrienden-copy en bewaart optie 4 als bonus',()=>{
 const a=player('Alec','p1',[8,10,8,null,null,null],null,{one:'blue',two:'18'});
 const ui=boot([a]);
 assert.equal(ui.view(),'checkin');
 assert.match(ui.html(),/Hoe ga <i>je\?<\/i>/);
 assert.match(ui.html(),/Even inchecken als vrienden onder elkaar/);
 assert.equal((ui.html().match(/class="thomas-sticker sticker-[0-7] mood-sticker"/g)||[]).length,4,'vier echte stickers, geen smileys');
 assert.doesNotMatch(ui.html(),/mood-emoji|Geen jury|bonusslag|Voor die ene bonus/);
  for(const label of ['Vlees nog vis','Lekker in de oli','Poepiepapiepoe','GAA VOOR GOUUUDD'])
  assert.ok(ui.html().includes(label),label+' ontbreekt');
 ui.click('mood','3');
 assert.equal(ui.view(),'checkinResult');
 assert.equal(ui.state().players[0].checkin,3);
 assert.match(ui.html(),/SLAG CADEAU/);
});

test('klassement toont alle vijf spelers in één verticale volgorde van goed naar minder goed',()=>{
 const names=['Alec','Vincent','Thomas','Robin','Mats'];
 const players=names.map((name,i)=>player(name,'p'+(i+1),[8+i,10,8,1,7,9],1,{one:'blue',two:'18',four:'Thomas'},'p2'));
 const ui=boot(players);
 ui.click('action','board');
 assert.equal(ui.view(),'board');
 assert.equal((ui.html().match(/class="leader-row /g)||[]).length,5);
 assert.doesNotMatch(ui.html(),/class="podium-card/);
 assert.match(ui.html(),/class="leader-list leader-vertical-list"/);
 assert.match(ui.html(),/💩/);
 ui.click('leader','p1');
 assert.equal(ui.view(),'detail');
 assert.match(ui.html(),/Salmari-shotjes/);
});

test('Salmari blijft verborgen zodra de laatste hole is geregistreerd',()=>{
 const a=player('Alec','p1',[8,10,8,1,7,9],3,{one:'blue',two:'18',four:'Thomas'},'p1');
 const ui=boot([a]);
 assert.equal(ui.view(),'finish');
 assert.equal(ui.element('salmari-quick').hidden,true);
});

test('startpagina heeft Pre Papa. Pluim Pub Golf. zonder Haarlem Open',()=>{
 const ui=boot([]);
 assert.equal(ui.view(),'welcome');
 assert.match(ui.html(),/Pre Papa\.<br><i>Pluim Pub Golf\.<\/i>/);
 assert.doesNotMatch(ui.html(),/HAARLEM OPEN|Golf\. Bier\.|Thomas\.<\/i>/);
 assert.match(ui.html(),/landing-sticker/);
});

test('tap-to-pour is een aparte kroegervaring, zonder score of bonus weg te schrijven',()=>{
 const golfer=player('Thomas','p1',[null,null,null,null,null,null],null,{});
 const ui=boot([golfer]);
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/class="page-card taproom is-waiting"/);
 assert.match(ui.html(),/taproom-machine/);
 assert.match(ui.html(),/Tap dat biertje/);
 assert.doesNotMatch(ui.html(),/class="bar-scene"/);
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'preview','oude scoreknop mag de tap niet overslaan');
 ui.click('action','pourDrink');
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/taproom is-served/);
 assert.match(ui.html(),/Je drankje is klaar/);
 assert.match(ui.html(),/Ik heb m&#39;n drankje!|Ik heb m'n drankje!/);
 assert.equal(ui.queue().length,0,'gimmick verstuurt geen score');
 assert.equal(ui.state().players[0].scores[0],null);
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 assert.match(ui.html(),/PAR 8 SLOKKEN/);
 assert.match(ui.html(),/ELKE TIK = \+1 SLOK/);
 assert.match(ui.html(),/id="stroke-value"[^>]*>0<\/strong>/);
 assert.match(ui.html(),/data-action="sip"/);
 assert.equal(ui.queue().length,0);
});

test('elke van de zes kroegen heeft een eigen tap-to-pour-ervaring en behoudt zijn PAR',()=>{
 const venues=['Jopen',"Tierney's Irish Pub",'Proeflokaal In den Uiver','Bierlokaal de Uiver','Café De Lift','Café Studio'];
 const par=[8,10,8,1,7,9];
 for(let i=0;i<6;i++){
  const scores=Array.from({length:6},(_,j)=>j<i?par[j]:null);
  const golfer=player('Thomas','p1',scores,3,{one:'blue',two:'18',four:'Thomas'},'p1');
  const ui=boot([golfer]);
  assert.equal(ui.view(),'preview','hole '+(i+1));
  assert.ok(ui.html().includes(venues[i].replace(/'/g,'&#39;')),'kroeg '+(i+1));
  assert.doesNotMatch(ui.html(),/taproom-topline|taproom-bottomline|taproom-banter|taproom-nudge|taproom-glass-label/);
  assert.doesNotMatch(ui.html(),/PAR [0-9]+|DE VOLGENDE RONDE|\/ 06|THOMAS&#39; OPEN · HOLE/);
  assert.match(ui.html(),/taproom-machine/);
  assert.match(ui.html(),/taproom-peeker/);
  assert.match(ui.html(),new RegExp('data-tap-hole="'+(i+1)+'"'));
  assert.match(ui.html(),/data-action="pourDrink"/);
 }
});

test('hole-in-one-jackpot na exact één slag in hole vier blijft zichtbaar tot zelf doorklikken',()=>{
 const golfer=player('Thomas','p1',[8,10,8,null,null,null],0,{one:'blue',two:'18'});
 const ui=boot([golfer]);
 assert.equal(ui.view(),'preview');
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 ui.click('action','sip');
 ui.click('action','submit');
 assert.equal(ui.view(),'ace');
 assert.match(ui.html(),/ace-insane/);
 assert.match(ui.html(),/ace-jackpot-ring/);
 assert.match(ui.html(),/BOEM/);
 assert.match(ui.html(),/GE-WEL-/);
 assert.match(ui.html(),/Goed gedaan, maat!/);
 assert.match(ui.html(),/data-action="replayAce"/);
 assert.match(ui.html(),/data-action="board"/);
 assert.equal(ui.state().players[0].scores[3],1);
 assert.equal(ui.queue().filter(x=>x.type==='setScore').length,1);
 ui.click('action','replayAce');
 assert.equal(ui.view(),'ace');
 assert.equal(ui.queue().filter(x=>x.type==='setScore').length,1,'replay mag nooit extra slagen opslaan');
 ui.click('action','board');
 assert.equal(ui.view(),'board');
 assert.equal(ui.state().players[0].scores[3],1);
});

test('score twee op hole vier toont klassement, niet de hole-in-one-jackpot',()=>{
 const golfer=player('Thomas','p1',[8,10,8,null,null,null],0,{one:'blue',two:'18'});
 const ui=boot([golfer]);
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 ui.click('action','sip');
 ui.click('action','sip');
 ui.click('action','submit');
 assert.equal(ui.view(),'board');
 assert.equal(ui.state().players[0].scores[3],2);
 assert.doesNotMatch(ui.html(),/ace-insane/);
});

test('alle zes holes geven de BOEM-jackpot bij precies één slag, met de juiste bar en het juiste drankje',()=>{
 const venues=['Jopen',"Tierney's Irish Pub",'Proeflokaal In den Uiver','Bierlokaal de Uiver','Café De Lift','Café Studio'];
 const drinks=['Mooie Nel IPA','Guinness','Halve liter bier','Fluitje','Brugse Zot','Vaasje'];
 const pars=[8,10,8,1,7,9];
 for(let hole=0;hole<6;hole++){
  const scores=pars.map((p,i)=>i<hole?p:null);
  const golfer=player('Thomas','p1',scores,3,{one:'blue',two:'18',four:'Thomas'},'p1');
  const ui=boot([golfer]);
  assert.equal(ui.view(),'preview','Hole '+(hole+1)+' moet klaarstaan');
  ui.click('action','pourDrink');
  ui.click('action','gotDrink');
  assert.equal(ui.view(),'hole');
  assert.match(ui.html(),new RegExp('PAR '+pars[hole]+' SLOKKEN'));
  ui.click('action','sip');
  ui.click('action','submit');
  assert.equal(ui.view(),'ace','Hole '+(hole+1)+' moet jackpot tonen');
  assert.match(ui.html(),new RegExp('HOLE 0'+(hole+1)));
  assert.ok(ui.html().includes(venues[hole].replace(/'/g,'&#39;')),'Juiste locatie hole '+(hole+1));
  assert.ok(ui.html().includes(drinks[hole]),'Juiste drankje hole '+(hole+1));
  assert.match(ui.html(),/1 SLAG · 1 SLOK/);
  assert.match(ui.html(),/Goed gedaan, maat!/);
  assert.equal(ui.state().players[0].scores[hole],1);
  assert.equal(ui.queue().filter(x=>x.type==='setScore').length,1);
  ui.click('action','replayAce');
  assert.equal(ui.queue().filter(x=>x.type==='setScore').length,1,'Opnieuw afspelen mag niet opnieuw scoren');
  ui.click('action','board');
  assert.equal(ui.view(),'board');
 }
});

test('andere scores dan één in een willekeurige hole houden de normale score-flow',()=>{
 const pars=[8,10,8,1,7,9];
 for(let hole of [0,1,2,4,5]){
  const scores=pars.map((p,i)=>i<hole?p:null);
  const ui=boot([player('Thomas','p1',scores,3,{one:'blue',two:'18',four:'Thomas'},'p1')]);
  ui.click('action','pourDrink');
  ui.click('action','gotDrink');
  ui.click('action','sip');
  ui.click('action','sip');
  ui.click('action','submit');
  assert.equal(ui.view(),'board','Geen jackpot voor '+(hole+1));
  assert.equal(ui.state().players[0].scores[hole],2);
 }
});

test('Thomas stickers maken cameo bij quizvragen, scorekaart en jackpot zonder spelregels te veranderen',()=>{
 const golfer=player('Thomas','p1',[8,10,null,null,null,null],null,{one:'blue',two:'18'});
 const ui=boot([golfer]);
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/taproom-peeker/);
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.match(ui.html(),/sip-sticker/);
 const two=player('Thomas','p1',[8,10,8,null,null,null],3,{one:'blue',two:'18'});
 const ui2=boot([two]);
 ui2.click('action','pourDrink');ui2.click('action','gotDrink');
 ui2.click('action','sip');
 ui2.click('action','sip'); // Twee slokken: geen jackpot.
 ui2.click('action','submit');
 assert.equal(ui2.view(),'board');
 assert.match(ui2.html(),/leader-sticker-peek/);
 const ace=boot([player('Thomas','p1',[8,10,8,null,null,null],3,{one:'blue',two:'18'})]);
 ace.click('action','pourDrink');ace.click('action','gotDrink');ace.click('action','sip');ace.click('action','submit');
 assert.equal(ace.view(),'ace');
 assert.equal((ace.html().match(/class="ace-sticker-fly/g)||[]).length,4);
});
test('2 tot 4 willekeurige scares per speler worden over verschillende holes gepland',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})],'p1',{random:.999,allowScares:true,reducedMotion:false});
 assert.equal(ui.view(),'preview');
 ui.click('action','pourDrink');
 const key='golf-scares-v2-THOMAS-OPEN-p1';
 let record=JSON.parse(ui.storage.get(key));
 assert.ok(record.plan.length>=2&&record.plan.length<=4);
 assert.equal(new Set(record.plan).size,record.plan.length);
 assert.equal(record.seen.length,0);
 ui.click('action','gotDrink');
 record=JSON.parse(ui.storage.get(key));
 assert.deepEqual(Array.from(record.seen),[0]);
 ui.click('action','plus');
 ui.click('action','minus');
 assert.deepEqual(Array.from(JSON.parse(ui.storage.get(key)).seen),[0],'maximaal één scare per hole');
 assert.equal(ui.queue().length,0,'scares slaan geen scores op');
});

test('de instelling voor minder beweging voorkomt jumpscares volledig',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})],'p1',{random:.999,allowScares:true,reducedMotion:true});
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.equal(ui.storage.get('golf-scares-v2-THOMAS-OPEN-p1'),undefined);
 assert.equal(ui.view(),'hole');
});

test('primaire kleuren maken check-in, quiz, kroeg en score visueel uniek',()=>{
 for(const cls of ['.mood-0','.mood-1','.mood-2','.mood-3','.question-baby','.question-date','.question-name','.page-hole','.taproom[data-tap-hole="1"]','.leader-row']){
  assert.ok(styles.includes(cls),'Ontbrekende styling: '+cls);
 }
 for(const color of ['#165cff','#f04449','#ffdb42'])assert.ok(styles.includes(color),'Kleur ontbreekt: '+color);
 assert.match(styles,/thomas-jumpscare--mini/);
 assert.match(styles,/thomas-jumpscare--medium/);
 assert.match(styles,/thomas-jumpscare--full/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
});

test('tapscherm begint op nul: elke tik telt één slok, herstel werkt en registratie vereist bevestiging',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})]);
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 assert.match(ui.html(),/PAR 8 SLOKKEN/);
 assert.match(ui.html(),/id="sip-submit"[^>]*disabled/);
 ui.click('action','submit');
 assert.equal(ui.view(),'hole');
 assert.equal(ui.queue().length,0);
 assert.equal(ui.element('stroke-value').textContent,'');
 ui.click('action','sip');ui.click('action','sip');ui.click('action','sip');
 assert.equal(ui.element('stroke-value').textContent,'3');
 assert.equal(ui.element('sip-progress').textContent,'3 / PAR 8');
 assert.equal(ui.element('sip-submit').disabled,false);
 ui.click('action','minus');
 assert.equal(ui.element('stroke-value').textContent,'2');
 assert.equal(ui.element('sip-progress').textContent,'2 / PAR 8');
 assert.equal(ui.queue().length,0,'tikken slaan niet alvast scores op');
 ui.click('action','submit');
 assert.equal(ui.view(),'board');
 assert.equal(ui.state().players[0].scores[0],2);
 assert.equal(ui.queue().filter(x=>x.type==='setScore').length,1);
});

test('ranglijst toont minstens 16 deelnemers, met beste eerst en gelijke stand op aanmeldvolgorde',()=>{
 const raw=[9,2,7,4,1,6,3,12,8,11,10,5,16,15,14,13];
 const group=raw.map((x,i)=>player('Deelnemer '+(i+1),'p'+(i+1),[x,10,8,1,7,9],3,{one:'blue',two:'18',four:'Thomas'},null));
 const ui=boot(group);
 ui.click('action','board');
 assert.equal(ui.view(),'board');
 const html=ui.html();
 assert.equal((html.match(/class="leader-row /g)||[]).length,16);
 assert.doesNotMatch(html,/class="podium-card/);
 assert.ok(html.indexOf('data-leader="p5"')<html.indexOf('data-leader="p2"'));
 assert.ok(html.indexOf('data-leader="p2"')<html.indexOf('data-leader="p7"'));
 assert.ok(html.indexOf('data-leader="p13"')>html.indexOf('data-leader="p15"'));
 assert.match(html,/16 GOLFERS/);
 assert.match(html,/💩/);
 const same=[
 player('Zebra','p1',[8,10,8,1,7,9],3,{one:'blue',two:'18',four:'Thomas'}),
 player('Aap','p2',[8,10,8,1,7,9],3,{one:'blue',two:'18',four:'Thomas'})
 ];
 const tied=boot(same);
 tied.click('action','board');
 assert.ok(tied.html().indexOf('data-leader="p1"')<tied.html().indexOf('data-leader="p2"'),'gelijke score: eerst aangemeld eerst');
});


test('tikken op de slokkenteller kan willekeurig echte fotos of videoverrassingen tonen, zonder extra slok',()=>{
 const golfer=player('Thomas','p1',[null,null,null,null,null,null],null,{});
 const ui=boot([golfer],'p1',{random:.999,allowScares:true,reducedMotion:false});
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 ui.click('action','sip');
 assert.equal(ui.element('stroke-value').textContent,'1');
 const key='golf-sip-media-v1-THOMAS-OPEN-p1';
 let record=JSON.parse(ui.storage.get(key));
 assert.equal(record.seen.length,1);
 assert.equal(record.used.length,1);
 assert.ok(record.plan.length>=2&&record.plan.length<=4);
 assert.equal(new Set(record.plan).size,record.plan.length);
 assert.equal(record.used[0],9,'met deterministische random kiest hij de vijfde video');
 ui.click('action','sip');
 assert.equal(ui.element('stroke-value').textContent,'2');
 record=JSON.parse(ui.storage.get(key));
 assert.equal(record.seen.length,1,'maximaal één foto/video scare per hole');
 assert.equal(ui.queue().length,0,'geen score opgeslagen tot bevestiging');
 ui.click('action','submit');
 assert.equal(ui.state().players[0].scores[0],2);
 assert.equal(ui.queue().filter(a=>a.type==='setScore').length,1);
});

test('foto- en videomedia zijn in alle vijf varianten aanwezig en zijn klein voor mobiele verbindingen',()=>{
 const matches=Array.from(source.matchAll(/src:"\.\/assets\/(scare-(?:photo|clip)-\d+\.(?:webp|mp4))"/g));
 assert.equal(matches.length,10,'vijf fotos en vijf korte clips');
 for(const [,name] of matches){
  const file=path.join(__dirname,'../assets',name);
  const stat=fs.statSync(file);
  assert.ok(stat.size>10000,name+' is leeg');
  assert.ok(stat.size<350000,name+' is te groot');
 }
 assert.match(source,/autoplay muted playsinline/);
 assert.match(source,/sip-media-scare-close/);
 assert.match(styles,/\.sip-media-scare--video/);
 assert.match(styles,/\.sip-media-scare--photo/);
});

test('verminderde beweging onderdrukt automatisch alle foto- en videopopups',()=>{
 const golfer=player('Thomas','p1',[null,null,null,null,null,null],null,{});
 const ui=boot([golfer],'p1',{random:.999,allowScares:true,reducedMotion:true});
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 ui.click('action','sip');
 assert.equal(ui.storage.get('golf-sip-media-v1-THOMAS-OPEN-p1'),undefined);
 assert.equal(ui.element('stroke-value').textContent,'1');
});
