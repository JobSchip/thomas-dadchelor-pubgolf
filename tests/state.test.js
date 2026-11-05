const test=require('node:test');const assert=require('node:assert/strict');const {act,initial}=require('../server');
test('add player, strokes, salmari and duplicate protection',()=>{const s=initial();const p={id:'p1',name:'Thomas'};assert.equal(act(s,{id:'a1',type:'addPlayer',player:p}),null);assert.equal(s.players.length,1);assert.equal(act(s,{id:'a2',type:'setScore',playerId:'p1',hole:3,value:1}),null);assert.equal(s.players[0].scores[3],1);assert.equal(act(s,{id:'a3',type:'setSalmari',playerId:'p1',value:1}),null);assert.equal(s.players[0].salmari,1);assert.equal(act(s,{id:'a3',type:'setSalmari',playerId:'p1',value:5}),null);assert.equal(s.players[0].salmari,1)});
test('reject invalid hole and score',()=>{const s=initial();act(s,{id:'a1',type:'addPlayer',player:{id:'p1',name:'Thomas'}});assert.equal(typeof act(s,{id:'a4',type:'setScore',playerId:'p1',hole:7,value:1}),'string');assert.equal(typeof act(s,{id:'a5',type:'setScore',playerId:'p1',hole:1,value:-2}),'string')});

test('profile avatar uploads are accepted for known players and validated', () => {
 const state=initial();
 const player={id:'person_a',name:'Thomas',avatar:'data:image/jpeg;base64,SGVsbG8='};
 assert.equal(act(state,{id:'x-avatar-add',type:'addPlayer',player}),null);
 assert.equal(state.players[0].avatar,player.avatar);
 assert.equal(act(state,{id:'x-avatar-update',type:'setAvatar',playerId:'person_a',avatar:'data:image/jpeg;base64,SGVsbG8='}),null);
 assert.match(act(state,{id:'x-avatar-bad',type:'setAvatar',playerId:'person_a',avatar:'javascript:alert(1)'}),/Ongeldige/);
});

test('post-third-hole check-in is validated and persisted',()=>{
 const s=initial();act(s,{id:'p-new',type:'addPlayer',player:{id:'person3',name:'Thomas'}});
 assert.equal(act(s,{id:'checkin1',type:'setCheckin',playerId:'person3',value:3}),null);
 assert.equal(s.players[0].checkin,3);
 assert.equal(typeof act(s,{id:'checkin-bad',type:'setCheckin',playerId:'person3',value:5}),'string');
 assert.equal(s.players[0].checkin,3);
});

test('jongen/meisje, januari en Thomas-antwoord zijn éénmalige keuzes',()=>{
 const s=initial();act(s,{id:'test-new',type:'addPlayer',player:{id:'p1',name:'Thomas'}});
 assert.equal(act(s,{id:'q1',type:'answerRound',playerId:'p1',round:'one',choice:'blue'}),null);
 assert.equal(s.players[0].answers.one,'blue');
 assert.match(act(s,{id:'q1-again',type:'answerRound',playerId:'p1',round:'one',choice:'pink'}),/al beantwoord/);
 assert.equal(act(s,{id:'q2',type:'answerRound',playerId:'p1',round:'two',choice:'18'}),null);
 assert.equal(act(s,{id:'q4',type:'answerRound',playerId:'p1',round:'four',choice:'misschien-thomas'}),null);
 assert.equal(s.players[0].answers.four,'misschien-thomas');
 assert.match(act(s,{id:'bad',type:'answerRound',playerId:'p1',round:'two',choice:'19'}),/Ongeldig|al beantwoord/);
});
test('een speler deelt één keer een bonus uit aan een bestaande speler',()=>{
 const s=initial();
 act(s,{id:'p-1',type:'addPlayer',player:{id:'p1',name:'Thomas'}});
 act(s,{id:'p-2',type:'addPlayer',player:{id:'p2',name:'Jan'}});
 assert.equal(act(s,{id:'gift',type:'nominate',playerId:'p1',targetPlayerId:'p2'}),null);
 assert.equal(s.players[0].nomination,'p2');
 assert.match(act(s,{id:'gift-again',type:'nominate',playerId:'p1',targetPlayerId:'p2'}),/al iemand gekozen/);
 assert.match(act(s,{id:'bad-gift',type:'nominate',playerId:'p2',targetPlayerId:'missing'}),/niet gevonden/);
});


test('ingediende holes zijn definitief en niet te overschrijven of te wissen',()=>{
 const s=initial();
 act(s,{id:'new-locked',type:'addPlayer',player:{id:'locked',name:'Golfmaat'}});
 assert.equal(act(s,{id:'initial-score',type:'setScore',playerId:'locked',hole:0,value:8}),null);
 assert.match(act(s,{id:'rewrite-score',type:'setScore',playerId:'locked',hole:0,value:2}),/definitief/);
 assert.match(act(s,{id:'erase-score',type:'setScore',playerId:'locked',hole:0,value:null}),/Ongeldige score/);
 assert.equal(s.players[0].scores[0],8);
});
test('Salmari telt per knopdruk op en mag niet teruggezet worden',()=>{
 const s=initial();
 act(s,{id:'new-salmari',type:'addPlayer',player:{id:'shots',name:'Golfer'}});
 assert.equal(act(s,{id:'shot-one',type:'setSalmari',playerId:'shots',value:1}),null);
 assert.match(act(s,{id:'shot-decrease',type:'setSalmari',playerId:'shots',value:0}),/Ongeldige bonus/);
 assert.match(act(s,{id:'shot-skip',type:'setSalmari',playerId:'shots',value:3}),/één shot/);
 assert.equal(act(s,{id:'shot-two',type:'setSalmari',playerId:'shots',value:2}),null);
 assert.equal(s.players[0].salmari,2);
});

test('iOS Capacitor origin kan de gedeelde scores lezen en een preflight uitvoeren',async()=>{
 const {server}=require('../server');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const options=await fetch(base+'/api/action?room=IOS-CORS-TEST',{
   method:'OPTIONS',
   headers:{Origin:'capacitor://localhost','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}
  });
  assert.equal(options.status,204);
  assert.equal(options.headers.get('access-control-allow-origin'),'capacitor://localhost');
  const state=await fetch(base+'/api/state?room=IOS-CORS-TEST',{headers:{Origin:'capacitor://localhost'}});
  assert.equal(state.status,200);
  assert.equal(state.headers.get('access-control-allow-origin'),'capacitor://localhost');
  assert.equal(Array.isArray((await state.json()).players),true);
  const originNotAllowed=await fetch(base+'/api/state?room=IOS-CORS-TEST',{headers:{Origin:'https://untrusted.example'}});
  assert.equal(originNotAllowed.headers.get('access-control-allow-origin'),null);
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('cadeau aan jezelf mag alleen als je de enige golfer bent',()=>{
 const state=initial();
 act(state,{id:'join1',type:'addPlayer',player:{id:'one',name:'Eerste'}});
 act(state,{id:'join2',type:'addPlayer',player:{id:'two',name:'Tweede'}});
 assert.match(act(state,{id:'self',type:'nominate',playerId:'one',targetPlayerId:'one'}),/andere golfer/);
 assert.equal(state.players[0].nomination,null);
 assert.equal(act(state,{id:'friend',type:'nominate',playerId:'one',targetPlayerId:'two'}),null);
 const solo=initial();
 act(solo,{id:'join-solo',type:'addPlayer',player:{id:'solo',name:'Solo'}});
 assert.equal(act(solo,{id:'self-solo',type:'nominate',playerId:'solo',targetPlayerId:'solo'}),null);
});
