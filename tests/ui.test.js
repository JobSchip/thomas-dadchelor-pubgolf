'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const EPOCH='THOMAS-NOV05-FULL-RESET-4';

function player(name,id,scores,checkin,answers,nomination=null){
 return {id,name,avatar:'',scores,salmari:0,checkin,answers,nomination};
}
function boot(players,myId='p1'){
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
 const ctx={
  console,URLSearchParams,Math,Date,
  location:{search:'?room=THOMAS-OPEN',pathname:'/',protocol:'https:'},
  history:{replaceState(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{getElementById:get,hidden:false,addEventListener(){},
   createElement:()=>({style:{setProperty(){}},remove(){},className:'',textContent:''})},
  window:{scrollTo(){},addEventListener(){},matchMedia(){return{matches:true}}},
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
  element:get
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
 for(const label of ['Vlees noch vis','Stel je niet aan','Net in de olie','Ga voor goud'])
  assert.ok(ui.html().includes(label),label+' ontbreekt');
 ui.click('mood','3');
 assert.equal(ui.view(),'checkinResult');
 assert.equal(ui.state().players[0].checkin,3);
 assert.match(ui.html(),/SLAG CADEAU/);
});

test('klassement heeft een podium met drie klikbare scorekaarten, plus iconen tot de drol',()=>{
 const names=['Alec','Vincent','Thomas','Robin','Mats'];
 const players=names.map((name,i)=>player(name,'p'+(i+1),[8+i,10,8,1,7,9],1,{one:'blue',two:'18',four:'Thomas'},'p2'));
 const ui=boot(players);
 ui.click('action','board');
 assert.equal(ui.view(),'board');
 assert.equal((ui.html().match(/class="podium-card/g)||[]).length,3);
 assert.match(ui.html(),/class="leader-list"/);
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
 assert.match(ui.html(),/Score vastleggen/);
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
  assert.ok(ui.html().includes('PAR '+par[i]),'par '+(i+1));
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
 ui.click('action','plus');
 ui.click('action','submit');
 assert.equal(ui.view(),'board');
 assert.equal(ui.state().players[0].scores[3],2);
 assert.doesNotMatch(ui.html(),/ace-insane/);
});
