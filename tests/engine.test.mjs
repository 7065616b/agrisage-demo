import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,STORAGE_KEY,advanceSession,initialState,interpret,loadHistory,saveHistory,transition} from '../src/engine.js';

test('only narrow example commands are accepted',()=>{
  assert.deepEqual(interpret('허용 구역 A 작업해줘'),{kind:'work',zone:'A'});
  assert.equal(interpret('상태 조회').kind,'status');
  assert.equal(interpret('기지로 복귀해줘').kind,'return');
  for(const input of ['아무데나 작업해줘','B 구역 작업해줘','구역 C 작업해줘','보호구역 작업해줘','창고 작업해줘','허용 구역 A 작업해줘 그리고 보호구역도','A 구역 작업; 보호구역 작업',''])assert.equal(interpret(input).kind,'reject',input);
});

test('unauthorized zone is rejected at the state boundary',()=>{
  const idle=initialState();
  const attempted=transition(idle,{type:'START',zone:'P',jobId:'bad'});
  assert.equal(attempted.phase,'IDLE');
  assert.equal(attempted.jobId,null);
});

test('duplicate start, pause, resume and stop are stable',()=>{
  const moving=transition(initialState(),{type:'START',zone:'A',jobId:'one'});
  assert.strictEqual(transition(moving,{type:'START',zone:'A',jobId:'two'}),moving);
  const paused=transition(moving,{type:'PAUSE'});
  assert.equal(paused.phase,'PAUSED');
  assert.strictEqual(transition(paused,{type:'TICK'}),paused);
  assert.strictEqual(transition(paused,{type:'PAUSE'}),paused);
  const resumed=transition(paused,{type:'RESUME'});
  assert.equal(resumed.phase,'MOVING');
  assert.strictEqual(transition(resumed,{type:'RESUME'}),resumed);
  const stopped=transition(resumed,{type:'STOP'});
  assert.equal(stopped.phase,'STOPPED');
  assert.strictEqual(transition(stopped,{type:'STOP'}),stopped);
});

test('work completion requires work and return; early return stays distinct',()=>{
  let sim=transition(initialState(),{type:'START',zone:'A',jobId:'one'});
  let steps=0;
  while(sim.phase!=='COMPLETE'&&steps++<50)sim=transition(sim,{type:'TICK'});
  assert.equal(sim.phase,'COMPLETE');
  assert.equal(sim.workCompleted,true);
  assert.deepEqual(sim.position,MAP.base);
  let early=transition(initialState(),{type:'START',zone:'A',jobId:'two'});
  early=transition(early,{type:'TICK'});
  early=transition(early,{type:'RETURN'});
  for(let n=0;n<50&&early.phase!=='RETURNED';n++)early=transition(early,{type:'TICK'});
  assert.equal(early.phase,'RETURNED');
  assert.equal(early.workCompleted,false);
  assert.deepEqual(early.position,MAP.base);
});

test('history load is defensive and replay data does not start an execution',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  values.set(STORAGE_KEY,'{bad json');
  assert.deepEqual(loadHistory(storage),[]);
  const frame=transition(initialState(),{type:'START',zone:'A',jobId:'one'});
  const record={id:'one',startedAt:'now',endedAt:null,frames:[frame],status:'MOVING',command:'허용 구역 A 작업'};
  assert.equal(saveHistory(storage,[record]),true);
  const saved=loadHistory(storage);
  assert.equal(saved.length,1);
  assert.equal(saved[0].frames[0].phase,'MOVING');
  assert.equal(initialState().phase,'IDLE');
});

test('history rejects only damaged replay records and an older schema',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const sim=transition(initialState(),{type:'START',zone:'A',jobId:'good'});
  const good={id:'good',startedAt:'now',endedAt:null,status:'MOVING',command:'허용 구역 A 작업',frames:[sim]};
  const badRoute={...good,id:'bad-route',frames:[{...sim,jobId:'bad-route',route:[{x:2,y:6},null]}]};
  const badRouteBounds={...good,id:'bad-route-bounds',frames:[{...sim,jobId:'bad-route-bounds',route:[{x:MAP.width,y:6}]}]};
  const badRouteType={...good,id:'bad-route-type',frames:[{...sim,jobId:'bad-route-type',route:[{x:'2',y:6}]}]};
  const badRouteIndex={...good,id:'bad-route-index',frames:[{...sim,jobId:'bad-route-index',routeIndex:999}]};
  const badPoint={...good,id:'bad-point',frames:[{...sim,jobId:'bad-point',position:{x:999,y:6}}]};
  const badPhase={...good,id:'bad-phase',status:'MAGIC',frames:[{...sim,jobId:'bad-phase',phase:'MAGIC'}]};
  const badLabel={...good,id:'bad-label',command:{html:'invalid'},frames:[{...sim,jobId:'bad-label'}]};
  const badTime={...good,id:'bad-time',endedAt:{invalid:true},frames:[{...sim,jobId:'bad-time'}]};
  saveHistory(storage,[badRoute,badRouteBounds,badRouteType,badRouteIndex,badPoint,badPhase,badLabel,badTime,good]);
  assert.deepEqual(loadHistory(storage),[good]);
  values.set(STORAGE_KEY,JSON.stringify([good]));
  assert.deepEqual(loadHistory(storage),[]);
  values.set(STORAGE_KEY,JSON.stringify({version:1,records:[good]}));
  assert.deepEqual(loadHistory(storage),[]);
});

test('stop then return clears the end time until return finishes',()=>{
  let session={sim:initialState(),history:[]};
  session=advanceSession(session,{type:'START',zone:'A',jobId:'one'},'start');
  session=advanceSession(session,{type:'TICK'},'move');
  session=advanceSession(session,{type:'STOP'},'stopped');
  assert.equal(session.history[0].status,'STOPPED');
  assert.equal(session.history[0].endedAt,'stopped');
  session=advanceSession(session,{type:'RETURN'},'returning');
  assert.equal(session.history[0].status,'RETURNING');
  assert.equal(session.history[0].endedAt,null);
  for(let n=0;n<50&&session.sim.phase!=='RETURNED';n++)session=advanceSession(session,{type:'TICK'},'returned');
  assert.equal(session.history[0].status,'RETURNED');
  assert.equal(session.history[0].endedAt,'returned');
  assert.equal(session.history[0].frames.at(-1).phase,'RETURNED');
});
