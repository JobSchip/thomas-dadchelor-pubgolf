'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const styles=fs.readFileSync(path.resolve(__dirname,'../styles.css'),'utf8');
const EPOCH='THOMAS-NOV05-FULL-RESET-4';

function player(name,id,scores,checkin,answers,nomination=null,thomolHits=0,pluimHits=0){
 return {id,name,avatar:'',scores,salmari:0,checkin,answers,nomination,thomolHits,pluimHits};
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
 const intervals=[];
 const timeouts=[];
 const clock={now:Date.now()};
 class FakeDate extends Date{static now(){return clock.now}}
 const fakeMath=Object.create(Math);
 if(typeof options.random==='number')fakeMath.random=()=>options.random;
 const ctx={
  console,URLSearchParams,Math:fakeMath,Date:options.clock?FakeDate:Date,
  location:{search:'?room=THOMAS-OPEN',pathname:'/',protocol:'https:'},
  history:{replaceState(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{getElementById:get,hidden:false,addEventListener(){},
   body:options.allowScares?{appendChild(){}}:undefined,
   createElement:()=>({style:{setProperty(){}},remove(){},className:'',classList:{add(){},remove(){}},textContent:'',setAttribute(){},querySelector(){return null}})},
  window:{scrollTo(){},addEventListener(){},matchMedia(){return{matches:options.reducedMotion??true}}},
  navigator:{},
  fetch:()=>new Promise(()=>{}),
  setTimeout:(fn,delay)=>{if(options.clock)timeouts.push({fn,delay});return 1},clearTimeout(){},clearInterval(){},setInterval:fn=>{if(options.clock)intervals.push(fn);return 1}
 };
 vm.runInNewContext(source,ctx,{timeout:2500,filename:'app.js'});
 function click(kind,value){
  get('screen').listeners.click({target:{closest(selector){
   if(kind==='vote'&&selector==='[data-nominate]')return {dataset:{nominate:value}};
   if(kind==='mood'&&selector==='[data-mood]')return {dataset:{mood:value}};
   if(kind==='action'&&selector==='[data-action]')return {dataset:{action:value}};
   if(kind==='leader'&&selector==='[data-leader]')return {dataset:{leader:value}};
   if(kind==='thomol'&&selector==='[data-thomol-cell]')return {dataset:{thomolCell:value}};
   return null;
  }}});
 }
 return {
  click,
  holdStart(x=25,y=25){
   get('screen').listeners.pointerdown({target:{closest(selector){return selector==='#sip-pad'?get('sip-pad'):null}},clientX:x,clientY:y,button:0,isPrimary:true});
  },
  holdStop(){
   get('screen').listeners.pointerup({target:{closest(selector){return selector==='#sip-pad'?get('sip-pad'):null}}});
  },
  holdCancel(){get('screen').listeners.pointercancel({})},
  runHoldTimer(){
   const index=timeouts.findLastIndex(t=>t.delay===850);
   if(index<0)throw Error('Geen hold timer');
   const next=timeouts.splice(index,1)[0];
   clock.now+=next.delay;
   next.fn();
  },
  keyboardSip(key,type){
   const handler=get('screen').listeners[type];
   handler({key,repeat:false,target:{closest(selector){return selector==='#sip-pad'?get('sip-pad'):null}},preventDefault(){}});
  },
  view:()=>get('app').dataset.view,html:()=>get('screen').innerHTML,
  state:()=>JSON.parse(storage.get('golf-v5-THOMAS-OPEN')),queue:()=>JSON.parse(storage.get('golf-queue-v5-THOMAS-OPEN')||'[]'),
  element:get,storage,
  advance(ms){clock.now+=ms;for(const fn of intervals.slice())fn()},
  runGameTimeout(){const index=timeouts.findLastIndex(x=>x.delay===920);if(index<0)throw Error('Geen Pluim-actie in wachtrij');const next=timeouts.splice(index,1)[0];clock.now+=next.delay;next.fn()}
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

test('bruin café heeft Thomas achter de bar en laat het juiste glas tappen zonder scores te wijzigen',()=>{
 const golfer=player('Thomas','p1',[null,null,null,null,null,null],null,{});
 const ui=boot([golfer]);
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/taproom tavern is-waiting/);
 assert.match(ui.html(),/VOLGENDE/);
 assert.match(ui.html(),/RONDE<span>!/);
 assert.match(ui.html(),/tavern-thomas-face/);
 assert.match(ui.html(),/data-tap-hole="1"/);
 assert.match(ui.html(),/Tap biertje 1/);
 assert.equal((ui.html().match(/class="tavern-glass-slot/g)||[]).length,6);
 assert.match(ui.html(),/0<\/strong><span>LEEGGEDRONKEN/);
 assert.match(ui.html(),/5<\/strong><span>SCHOON/);
 assert.doesNotMatch(ui.html(),/Jopen|Tierney|Uiver|De Lift|Café Studio/);
 assert.doesNotMatch(ui.html(),/class="bar-scene"/);
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'preview','je kunt het tappen niet overslaan');
 ui.click('action','pourDrink');
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/taproom tavern is-served/);
 assert.match(ui.html(),/tavern-glass is-current is-filled/);
 assert.match(ui.html(),/Ik heb m&#39;n drankje!|Ik heb m'n drankje!/);
 assert.equal(ui.queue().length,0,'tappen verstuurt geen score');
 assert.equal(ui.state().players[0].scores[0],null);
 ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 assert.match(ui.html(),/PAR <strong>8<\/strong>/);
 assert.match(ui.html(),/id="stroke-value">0<\/strong>/);
 assert.equal(ui.queue().length,0);
});

test('zes rondes vullen precies het juiste glas en tonen lege versus schone glazen',()=>{
 const pars=[8,10,8,1,7,9];
 const venues=['Jopen',"Tierney's Irish Pub",'Proeflokaal In den Uiver','Bierlokaal de Uiver','Café De Lift','Café Studio'];
 for(let i=0;i<6;i++){
  const scores=pars.map((p,j)=>j<i?p:null);
  const golfer=player('Thomas','p1',scores,3,{one:'blue',two:'18',four:'Thomas'},'p1');
  const ui=boot([golfer]);
  assert.equal(ui.view(),'preview','ronde '+(i+1));
  const html=ui.html();
  assert.equal((html.match(/class="tavern-glass-slot/g)||[]).length,6);
  assert.equal((html.match(/tavern-glass is-drunk/g)||[]).length,i);
  assert.equal((html.match(/tavern-glass is-clean/g)||[]).length,5-i);
  assert.match(html,new RegExp('data-tap-hole="'+(i+1)+'"'));
  assert.match(html,new RegExp('data-action="pourDrink"'));
  assert.match(html,new RegExp('BIERTJE '+(i+1)));
  assert.match(html,new RegExp('<strong>'+i+'</strong><span>LEEGGEDRONKEN'));
  assert.match(html,new RegExp('<strong>'+(5-i)+'</strong><span>SCHOON'));
  for(const venue of venues)assert.ok(!html.includes(venue.replace(/'/g,'&#39;')),'kroegnaam mag niet zichtbaar zijn');
  ui.click('action','pourDrink');
  assert.match(ui.html(),new RegExp('data-tap-hole="'+(i+1)+'"'));
  assert.equal((ui.html().match(/tavern-glass is-current is-filled/g)||[]).length,1);
  assert.equal(ui.queue().length,0);
 }
});

test('in ronde drie staan twee lege glazen, tap je nummer drie en blijven drie schone over',()=>{
 const golfer=player('Thomas','p1',[8,10,null,null,null,null],null,{one:'blue',two:'18'},null,0);
 const ui=boot([golfer]);
 assert.equal(ui.view(),'thomolIntro'); // eerst de eenmalige bonus na hole twee
 ui.click('action','thomolSkip');
 ui.click('action','continue');
 assert.equal(ui.view(),'preview');
 assert.match(ui.html(),/RONDE 3 \/ 6/);
 assert.equal((ui.html().match(/tavern-glass is-drunk/g)||[]).length,2);
 assert.equal((ui.html().match(/tavern-glass is-clean/g)||[]).length,3);
 assert.match(ui.html(),/data-action="pourDrink" aria-label="Biertje 3 tappen"/);
 ui.click('action','pourDrink');
 assert.match(ui.html(),/tavern-glass is-current is-filled/);
 assert.equal(ui.queue().length,0);
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
  assert.match(ui.html(),new RegExp('PAR <strong>'+pars[hole]+'</strong>'));
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
 assert.match(ui.html(),/tavern-thomas-face/);
 ui.click('action','pourDrink');
 ui.click('action','gotDrink');
 assert.match(ui.html(),/sip-score-page/);
 assert.match(ui.html(),/sip-adjust-plus/);
 assert.doesNotMatch(ui.html(),/sip-sticker/);
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

test('slokkenscherm heeft grote +/- knoppen, PAR en live verschil plus bevestiging',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})]);
 ui.click('action','pourDrink');ui.click('action','gotDrink');
 assert.equal(ui.view(),'hole');
 assert.match(ui.html(),/PAR <strong>8<\/strong>/);
 assert.match(ui.html(),/Hoeveel slokken\?/);
 assert.match(ui.html(),/sip-score-comparison is-waiting/);
 assert.match(ui.html(),/id="sip-confirm"[^>]*disabled/);
 assert.equal((ui.html().match(/<button /g)||[]).length,3);
 assert.equal(ui.queue().length,0);
 for(let i=0;i<5;i++)ui.click('action','plus');
 assert.equal(ui.element('stroke-value').textContent,'5');
 assert.equal(ui.element('sip-diff-number').textContent,'-3');
 assert.equal(ui.element('sip-diff-label').textContent,'3 slokken onder PAR');
 assert.equal(ui.element('sip-confirm').disabled,false);
 ui.click('action','minus');
 assert.equal(ui.element('sip-diff-number').textContent,'-4');
 ui.click('action','plus');
 assert.equal(ui.queue().length,0,'tikken sparen de score pas bij bevestiging op');
 ui.click('action','submit');
 assert.equal(ui.view(),'board');
 assert.equal(ui.state().players[0].scores[0],5);
 assert.equal(ui.queue().filter(a=>a.type==='setScore').length,1);
});

test('exact PAR en boven PAR krijgen een andere duidelijke status',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})]);
 ui.click('action','pourDrink');ui.click('action','gotDrink');
 for(let i=0;i<8;i++)ui.click('action','plus');
 assert.equal(ui.element('sip-diff-number').textContent,'0');
 assert.equal(ui.element('sip-diff-label').textContent,'Precies op PAR');
 ui.click('action','plus');
 ui.click('action','plus');
 assert.equal(ui.element('sip-diff-number').textContent,'+2');
 assert.equal(ui.element('sip-diff-label').textContent,'2 slokken boven PAR');
 ui.click('action','minus');
 assert.equal(ui.element('sip-diff-label').textContent,'1 slok boven PAR');
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
 assert.match(source,/sip-media-scare-video-poster/);
 assert.match(source,/sip-media-scare-play/);
 assert.match(source,/addEventListener\("playing",playbackStarted\)/);
 assert.match(source,/playRequest|request=vid\.play\(\)/);
 assert.match(source,/scheduleClose\(2450\)/);
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


test('HIT THE THOMOL is een lastige eenmalige tussenronde na quiz 2, met -1 slag per echte tik',()=>{
 const p=player('Thomas','p1',[8,10,null,null,null,null],null,{one:'blue',two:'18'},null,null);
 const ui=boot([p],'p1',{random:.999,clock:true});
 assert.equal(ui.view(),'thomolIntro');
 assert.match(ui.html(),/HIT THE/);
 assert.match(ui.html(),/THOMOL/);
 assert.match(ui.html(),/16 seconden/);
 assert.match(ui.html(),/1 hit = −1 slag/);
 ui.click('action','thomolStart');
 assert.equal(ui.view(),'thomolPlay');
 assert.equal((ui.html().match(/data-thomol-cell="/g)||[]).length,9);
 assert.match(ui.html(),/mole-active/);
 assert.equal(ui.queue().length,0,'geen bonus voordat de tijd verstreken is');
 ui.click('thomol','7');
 assert.equal(ui.queue().length,0,'foute tik geeft geen bonus');
 ui.click('thomol','8');
 assert.match(ui.html(),/RAAK/);
 assert.equal(ui.state().players[0].thomolHits,null);
 ui.advance(17000);
 assert.equal(ui.view(),'thomolResult');
 assert.equal(ui.state().players[0].thomolHits,1);
 assert.equal(ui.queue().filter(a=>a.type==='finishThomol').length,1);
 assert.match(ui.html(),/−1/);
 ui.click('action','continue');
 assert.equal(ui.view(),'preview','na de bonus speel je door naar hole 3');
});

test('HIT THE THOMOL kan worden overgeslagen, maar dan is de bonus definitief nul',()=>{
 const p=player('Thomas','p1',[8,10,null,null,null,null],null,{one:'blue',two:'18'},null,null);
 const ui=boot([p]);
 assert.equal(ui.view(),'thomolIntro');
 ui.click('action','thomolSkip');
 assert.equal(ui.view(),'thomolResult');
 assert.equal(ui.state().players[0].thomolHits,0);
 assert.equal(ui.queue().filter(a=>a.type==='finishThomol').length,1);
 ui.click('action','continue');
 assert.equal(ui.view(),'preview');
 assert.doesNotMatch(ui.html(),/thomol-intro/);
});

test('Thomas-citaten uit de export verschijnen in willekeurige jumpscares',()=>{
 for(const quote of [
  'Big man, hoezo geef je op?',
  'Maatje wie hou je voor de gek',
  'Opeens ben je vet goed?',
  'Met of zonder clownspak aan?',
  'Hahahh wat een fucking legend',
  'Ik ben nooit de verkeerde Thomas'
 ])assert.ok(source.includes(quote),'chat-citaat ontbreekt: '+quote);
 assert.match(source,/const THOMAS_QUOTES=/);
 assert.match(source,/thomasQuote\(\)/);
 assert.match(source,/sip-media-scare-caption/);
 assert.match(styles,/\.thomol-grid/);
 assert.match(styles,/\.thomol-mole/);
 assert.match(styles,/\.thomol-decoy/);
});


test('STOP DE PLUIM verschijnt na hole vier en quiz, met drie snel moeilijker wordende pogingen',()=>{
 const p=player('Thomas','p1',[8,10,8,1,null,null],2,{one:'blue',two:'18',four:'Thomas'},null,0,null);
 const ui=boot([p],'p1',{random:.99,clock:true});
 assert.equal(ui.view(),'pluimIntro');
 assert.match(ui.html(),/STOP DE/);
 assert.match(ui.html(),/PLUIM!/);
 assert.match(ui.html(),/3 POGINGEN/);
 assert.match(ui.html(),/HIT = −1 SLAG/);
 ui.click('action','pluimStart');
 assert.equal(ui.view(),'pluimPlay');
 assert.match(ui.html(),/width:18%/);
 assert.match(ui.html(),/RONDE 1\/3/);
 ui.advance(580);
 ui.click('action','pluimStop');
 assert.match(ui.html(),/BOEM! −1 SLAG!/);
 assert.match(ui.html(),/RAAK!/);
 assert.equal(ui.queue().length,0,'tussentijdse tik mag niet worden opgeslagen');
 ui.runGameTimeout();
 assert.equal(ui.view(),'pluimPlay');
 assert.match(ui.html(),/width:13%/);
 assert.match(ui.html(),/RONDE 2\/3/);
 ui.advance(30);
 ui.click('action','pluimStop');
 assert.match(ui.html(),/NET MIS, MAAT!/);
 ui.runGameTimeout();
 assert.match(ui.html(),/width:9%/);
 assert.match(ui.html(),/RONDE 3\/3/);
 ui.advance(303);
 ui.click('action','pluimStop');
 assert.match(ui.html(),/BOEM! −1 SLAG!/);
 ui.runGameTimeout();
 assert.equal(ui.view(),'pluimResult');
 assert.equal(ui.state().players[0].pluimHits,2);
 assert.equal(ui.queue().filter(x=>x.type==='finishPluim').length,1);
 assert.match(ui.html(),/−2/);
 ui.click('action','continue');
 assert.equal(ui.view(),'preview','na het spel volgt de vijfde kroeg');
 assert.match(ui.html(),/Café De Lift/);
 ui.click('action','board');
 ui.click('leader','p1');
 assert.equal(ui.view(),'detail');
 assert.match(ui.html(),/Stop de Pluim/);
 assert.match(ui.html(),/2 <small>× −1/);
});

test('STOP DE PLUIM overslaan registreert nul en biedt geen tweede poging',()=>{
 const p=player('Thomas','p1',[8,10,8,2,null,null],2,{one:'blue',two:'18',four:'Thomas'},null,0,null);
 const ui=boot([p]);
 assert.equal(ui.view(),'pluimIntro');
 ui.click('action','pluimSkip');
 assert.equal(ui.view(),'pluimResult');
 assert.equal(ui.state().players[0].pluimHits,0);
 assert.equal(ui.queue().filter(x=>x.type==='finishPluim').length,1);
 ui.click('action','continue');
 assert.equal(ui.view(),'preview');
 assert.doesNotMatch(ui.html(),/pluim-intro/);
});

test('STOP DE PLUIM heeft live wijzer, kleurzone, tijdlimiet en veilige stopactie',()=>{
 const p=player('Thomas','p1',[8,10,8,1,null,null],2,{one:'blue',two:'18',four:'Thomas'},null,0,null);
 const ui=boot([p],'p1',{random:.99,clock:true});
 ui.click('action','pluimStart');
 assert.equal(ui.view(),'pluimPlay');
 assert.match(ui.html(),/id="pluim-needle"/);
 assert.match(ui.html(),/id="pluim-countdown"/);
 ui.advance(90);
 assert.ok(Number.parseFloat(ui.element('pluim-needle').style.left)>0,'wijzer beweegt');
 ui.advance(4600);
 assert.match(ui.html(),/TE LAAT, OUWE!/);
 ui.click('action','pluimStop');
 assert.match(ui.html(),/TE LAAT, OUWE!/, 'twee keer stoppen telt niet dubbel');
 assert.match(styles,/\.pluim-zone/);
 assert.match(styles,/\.pluim-stop-button/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
});

test('bevestigen bij nul slokken doet niets en de min knop gaat niet onder nul',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})]);
 ui.click('action','pourDrink');ui.click('action','gotDrink');
 ui.click('action','submit');
 assert.equal(ui.view(),'hole');
 assert.equal(ui.queue().length,0);
 ui.click('action','minus');
 assert.equal(ui.element('stroke-value').textContent,'0');
 ui.click('action','plus');
 assert.equal(ui.element('stroke-value').textContent,'1');
 assert.equal(ui.element('sip-diff-label').textContent,'7 slokken onder PAR');
 ui.click('action','submit');
 assert.equal(ui.view(),'ace','één slok blijft een hole-in-one');
});

test('slokkenknoppen zijn duidelijk toegankelijk en tonen verschil op het scherm',()=>{
 const ui=boot([player('Thomas','p1',[null,null,null,null,null,null],null,{})]);
 ui.click('action','pourDrink');ui.click('action','gotDrink');
 assert.match(ui.html(),/aria-label="Eén slok minder"/);
 assert.match(ui.html(),/aria-label="Eén slok erbij"/);
 assert.match(ui.html(),/role="status" aria-live="polite"/);
 assert.match(ui.html(),/id="sip-confirm"/);
 assert.doesNotMatch(ui.html(),/sip-hold-button|Houd de knop ingedrukt/);
});
