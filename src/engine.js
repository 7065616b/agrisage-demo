export const MAP = Object.freeze({
  width: 12, height: 8, base: {x: 1, y: 6},
  zones: [
    {id: 'A', name: '허용 구역 A', kind: 'work', x: 2, y: 2, width: 4, height: 3},
    {id: 'P', name: '보호 구역', kind: 'protected', x: 8, y: 1, width: 2, height: 3},
    {id: 'O', name: '창고', kind: 'obstacle', x: 8, y: 5, width: 2, height: 2},
  ],
});

export const OUTBOUND = Object.freeze([{x:1,y:6},{x:2,y:6},{x:2,y:5},{x:2,y:4},{x:3,y:4},{x:4,y:4},{x:5,y:4}]);
export const STORAGE_KEY = 'agrisage-static-demo-v1';
export const HISTORY_VERSION = 2;
const active = new Set(['MOVING','WORKING','RETURNING']);
const recordedPhases = new Set(['IDLE','MOVING','WORKING','RETURNING','PAUSED','STOPPED','COMPLETE','RETURNED']);
const historyPhases = new Set([...recordedPhases,'INTERRUPTED']);
const terminal = new Set(['STOPPED','COMPLETE','RETURNED']);
const denial = /(?:보호\s*구역|금지\s*구역|구역\s*[B-Z]|[B-Z]\s*구역|권한\s*밖|창고|장애물)/i;
const work = /^(?:(?:허용\s*)?구역\s*A|A\s*구역)\s*(?:에서\s*)?(?:작업(?:해\s*줘|해줘|해|을\s*시작(?:해\s*줘)?|\s*시작)?|경작(?:해\s*줘|해줘|해)?)\.?$/i;
const workPrefix = /^(?:작업|경작)\s*(?:(?:허용\s*)?구역\s*A|A\s*구역)(?:에서)?(?:\s*(?:시작|해\s*줘|해줘))?\.?$/i;
const status = /^(?:상태\s*(?:조회|확인|알려줘|보여줘)?|현재\s*상태(?:\s*알려줘)?|트랙터\s*상태(?:\s*알려줘)?)\.?$/;
const home = /^(?:복귀|기지로\s*복귀(?:해\s*줘)?|돌아와|돌아와\s*줘)\.?$/;

export function interpret(input) {
  const text = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (!text || text.length > 100) return {kind:'reject', reason:'짧은 예시 문장을 입력해 주세요.'};
  if (denial.test(text)) return {kind:'reject', reason:'이 구역은 체험판 작업 권한 밖입니다. 허용 구역 A만 선택할 수 있습니다.'};
  if (work.test(text) || workPrefix.test(text)) return {kind:'work', zone:'A'};
  if (status.test(text)) return {kind:'status'};
  if (home.test(text)) return {kind:'return'};
  return {kind:'reject', reason:'이 문장은 모의 해석 범위 밖입니다. 아래 예시 중 하나를 사용해 주세요.'};
}

export function initialState() {
  return {phase:'IDLE', position:{...MAP.base}, route:[], routeIndex:0, workStep:0, workCompleted:false, resumePhase:null, jobId:null, message:'기지에서 대기 중입니다.'};
}

function equal(a,b) {return a.x===b.x && a.y===b.y}
function returnRoute(position) {
  const index=OUTBOUND.findIndex(p=>equal(p,position));
  if(index>=0) return [...OUTBOUND.slice(0,index+1)].reverse();
  return [position,...OUTBOUND.slice(0,-1).reverse()];
}
export function isBusy(state) {return active.has(state.phase)||state.phase==='PAUSED'}

export function transition(state, action) {
  switch(action.type) {
    case 'START':
      if(isBusy(state)) return state;
      if(!equal(state.position,MAP.base)) return {...state,message:'기지로 복귀한 뒤 새 작업을 시작할 수 있습니다.'};
      if(action.zone!=='A') return {...state,message:'허용 구역 A만 작업할 수 있습니다.'};
      return {...initialState(),phase:'MOVING',route:[...OUTBOUND],jobId:action.jobId, message:'허용 구역 A로 이동 중입니다.'};
    case 'TICK':
      if(state.phase==='MOVING') {
        if(state.routeIndex+1<state.route.length) {
          const routeIndex=state.routeIndex+1;
          return {...state,routeIndex,position:state.route[routeIndex],message:'허용 구역 A로 이동 중입니다.'};
        }
        return {...state,phase:'WORKING',route:[],routeIndex:0,workStep:0,message:'허용 구역 A에서 모의 작업 중입니다.'};
      }
      if(state.phase==='WORKING') {
        if(state.workStep<3) return {...state,workStep:state.workStep+1,message:'허용 구역 A에서 모의 작업 중입니다.'};
        return {...state,phase:'RETURNING',workCompleted:true,route:returnRoute(state.position),routeIndex:0,message:'모의 작업을 마치고 기지로 복귀 중입니다.'};
      }
      if(state.phase==='RETURNING') {
        if(state.routeIndex+1<state.route.length) {
          const routeIndex=state.routeIndex+1;
          const position=state.route[routeIndex];
          if(equal(position,MAP.base)) return {...state,phase:state.workCompleted?'COMPLETE':'RETURNED',position,routeIndex,message:state.workCompleted?'모의 작업과 복귀가 완료되었습니다.':'작업 완료 전 복귀했습니다.'};
          return {...state,position,routeIndex};
        }
        return {...state,phase:state.workCompleted?'COMPLETE':'RETURNED',position:{...MAP.base},message:state.workCompleted?'모의 작업과 복귀가 완료되었습니다.':'작업 완료 전 복귀했습니다.'};
      }
      return state;
    case 'PAUSE':
      if(!active.has(state.phase)) return state;
      return {...state,phase:'PAUSED',resumePhase:state.phase,message:'가상 시뮬레이터가 멈췄습니다.'};
    case 'RESUME':
      if(state.phase!=='PAUSED'||!active.has(state.resumePhase)) return state;
      return {...state,phase:state.resumePhase,resumePhase:null,message:'가상 시뮬레이터를 계속합니다.'};
    case 'STOP':
      if(!isBusy(state)) return state;
      return {...state,phase:'STOPPED',resumePhase:null,route:[],routeIndex:0,message:'즉시 멈췄습니다. 복귀를 선택할 수 있습니다.'};
    case 'RETURN':
      if(state.phase==='RETURNING'||state.phase==='COMPLETE'||state.phase==='RETURNED') return state;
      if(equal(state.position,MAP.base)) return {...state,phase:'IDLE',route:[],routeIndex:0,jobId:null,message:'이미 기지에 있습니다.'};
      return {...state,phase:'RETURNING',resumePhase:null,route:returnRoute(state.position),routeIndex:0,message:'기지로 복귀 중입니다.'};
    default: return state;
  }
}

const snapshot=state=>JSON.parse(JSON.stringify(state));
export function advanceSession(current,action,at) {
  const sim=transition(current.sim,action);
  if(sim===current.sim)return current;
  if(action.type==='START') {
    if(sim.phase!=='MOVING')return {...current,sim};
    const record={id:action.jobId,startedAt:at,endedAt:null,status:sim.phase,command:'허용 구역 A 작업',frames:[snapshot(sim)]};
    return {sim,history:[record,...current.history].slice(0,20)};
  }
  const history=current.history.map(record=>record.id===sim.jobId?{
    ...record,status:sim.phase,endedAt:terminal.has(sim.phase)?at:null,
    frames:[...record.frames,snapshot(sim)],
  }:record);
  return {sim,history};
}

function boundedText(value,max) {return typeof value==='string'&&value.length>0&&value.length<=max}
function point(value) {return value&&Number.isInteger(value.x)&&Number.isInteger(value.y)&&value.x>=0&&value.y>=0&&value.x<MAP.width&&value.y<MAP.height}
function frame(value,id) {
  return value&&recordedPhases.has(value.phase)&&value.jobId===id&&point(value.position)&&
    Array.isArray(value.route)&&value.route.length<=MAP.width*MAP.height&&value.route.every(point)&&
    Number.isInteger(value.routeIndex)&&value.routeIndex>=0&&value.routeIndex<Math.max(1,value.route.length)&&
    Number.isInteger(value.workStep)&&value.workStep>=0&&value.workStep<=3&&typeof value.workCompleted==='boolean'&&
    (value.resumePhase===null||active.has(value.resumePhase))&&boundedText(value.message,200);
}
function record(value) {
  return value&&boundedText(value.id,80)&&boundedText(value.startedAt,80)&&
    (value.endedAt===null||boundedText(value.endedAt,80))&&
    historyPhases.has(value.status)&&value.command==='허용 구역 A 작업'&&
    Array.isArray(value.frames)&&value.frames.length>0&&value.frames.length<=100&&
    value.frames.every(item=>frame(item,value.id))&&
    (value.status==='INTERRUPTED'||value.frames.at(-1).phase===value.status)&&
    (terminal.has(value.status)||value.status==='INTERRUPTED'?value.endedAt!==null:value.endedAt===null);
}
export function loadHistory(storage) {
  try {
    const raw=JSON.parse(storage.getItem(STORAGE_KEY)||'null');
    if(!raw||raw.version!==HISTORY_VERSION||!Array.isArray(raw.records))return [];
    return raw.records.filter(record).slice(0,20);
  } catch {return []}
}
export function saveHistory(storage, history) {
  try {storage.setItem(STORAGE_KEY,JSON.stringify({version:HISTORY_VERSION,records:history.slice(0,20)}));return true} catch {return false}
}
