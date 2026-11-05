const test=require('node:test');const assert=require('node:assert/strict');const {act,initial}=require('../server');
test('add player, strokes, salmari and duplicate protection',()=>{const s=initial();const p={id:'p1',name:'Thomas'};assert.equal(act(s,{id:'a1',type:'addPlayer',player:p}),null);assert.equal(s.players.length,1);assert.equal(act(s,{id:'a2',type:'setScore',playerId:'p1',hole:3,value:1}),null);assert.equal(s.players[0].scores[3],1);assert.equal(act(s,{id:'a3',type:'setSalmari',playerId:'p1',value:2}),null);assert.equal(s.players[0].salmari,2);assert.equal(act(s,{id:'a3',type:'setSalmari',playerId:'p1',value:5}),null);assert.equal(s.players[0].salmari,2)});
test('reject invalid hole and score',()=>{const s=initial();act(s,{id:'a1',type:'addPlayer',player:{id:'p1',name:'Thomas'}});assert.equal(typeof act(s,{id:'a4',type:'setScore',playerId:'p1',hole:7,value:1}),'string');assert.equal(typeof act(s,{id:'a5',type:'setScore',playerId:'p1',hole:1,value:-2}),'string')});

test('profile avatar uploads are accepted for known players and validated', () => {
 const state=initial();
 const player={id:'person_a',name:'Thomas',avatar:'data:image/jpeg;base64,SGVsbG8='};
 assert.equal(act(state,{id:'x-avatar-add',type:'addPlayer',player}),null);
 assert.equal(state.players[0].avatar,player.avatar);
 assert.equal(act(state,{id:'x-avatar-update',type:'setAvatar',playerId:'person_a',avatar:'data:image/jpeg;base64,SGVsbG8='}),null);
 assert.match(act(state,{id:'x-avatar-bad',type:'setAvatar',playerId:'person_a',avatar:'javascript:alert(1)'}),/Ongeldige/);
});
