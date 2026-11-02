import React,{Component,useEffect,useReducer,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import StudioScene from './three/StudioScene';
import {MAP,STORAGE_KEY,advanceSession,initialState,interpret,isBusy,loadHistory,saveHistory} from './engine';

const phaseName={IDLE:'대기',MOVING:'이동 중',WORKING:'작업 중',RETURNING:'복귀 중',PAUSED:'일시정지',STOPPED:'멈춤',COMPLETE:'작업 완료',RETURNED:'복귀 완료',INTERRUPTED:'이전 방문에서 중단'};
const stamp=()=>new Date().toLocaleString('ko-KR',{hour12:false});

function init(){
  let history=[];
  try{history=loadHistory(window.localStorage)}catch{}
  history=history.map(record=>['MOVING','WORKING','RETURNING','PAUSED'].includes(record.status)?{...record,status:'INTERRUPTED',endedAt:'이전 방문 종료'}:record);
  return {sim:initialState(),history};
}
function reducer(current,action){
  if(action.type==='RESET')return {sim:initialState(),history:[]};
  return advanceSession(current,action,stamp());
}

class SceneBoundary extends Component{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onFailure()}
  render(){return this.state.failed?this.props.fallback:this.props.children}
}

function FlatMap({sim}){
  const size=40,w=MAP.width*size,h=MAP.height*size;
  const center=p=>`${(p.x+.5)*size},${(p.y+.5)*size}`;
  const route=sim.route.map(center).join(' ');
  const drawn=sim.route.slice(0,sim.routeIndex+1).map(center).join(' ');
  const colors={work:'#8caa81',protected:'#d2c59a',obstacle:'#929f9d'};
  return <div className="flat-map" role="img" aria-label={`평면 농장 지도. 농기계 위치 ${sim.position.x}열 ${sim.position.y}행. 현재 ${phaseName[sim.phase]}.`}>
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width={w} height={h} fill="#e6eae0"/>
      {Array.from({length:MAP.width+1},(_,i)=><line key={'x'+i} x1={i*size} x2={i*size} y1="0" y2={h} stroke="#ced9cb"/>)}
      {Array.from({length:MAP.height+1},(_,i)=><line key={'y'+i} x1="0" x2={w} y1={i*size} y2={i*size} stroke="#ced9cb"/>)}
      {MAP.zones.map(z=><g key={z.id}><rect x={z.x*size+3} y={z.y*size+3} width={z.width*size-6} height={z.height*size-6} rx="8" fill={colors[z.kind]} stroke="#fff" strokeWidth="3"/><text x={(z.x+z.width/2)*size} y={(z.y+z.height/2)*size+5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#28483e">{z.name}</text></g>)}
      {route&&<polyline points={route} fill="none" stroke="#b58149" strokeWidth="5" strokeDasharray="7 7" strokeLinecap="round"/>}
      {drawn&&<polyline points={drawn} fill="none" stroke="#278777" strokeWidth="6" strokeLinecap="round"/>}
      <circle cx={(MAP.base.x+.5)*size} cy={(MAP.base.y+.5)*size} r="16" fill="#1d7869" stroke="white" strokeWidth="3"/>
      <text x={(MAP.base.x+.5)*size} y={(MAP.base.y+.5)*size+5} textAnchor="middle" fontSize="13" fontWeight="800" fill="white">B</text>
      <circle cx={(sim.position.x+.5)*size} cy={(sim.position.y+.5)*size} r="13" fill="#efb95e" stroke="#fff" strokeWidth="3"/>
      <text x={(sim.position.x+.5)*size} y={(sim.position.y+.5)*size+4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#493a24">T</text>
    </svg>
    <div className="map-key"><span><i className="key-work"/>허용 구역 A</span><span><i className="key-protected"/>보호 구역</span><span><i className="key-obstacle"/>장애물</span><span><i className="key-base"/>기지</span><span><i className="key-tractor"/>가상 트랙터</span></div>
  </div>;
}

function Viewer({sim,view,setView}){
  const [webgl,setWebgl]=useState(null),[sceneFailed,setSceneFailed]=useState(false);
  useEffect(()=>{try{const canvas=document.createElement('canvas');setWebgl(!!canvas.getContext('webgl2'))}catch{setWebgl(false)}},[]);
  const useFlat=view==='flat'||webgl===false||sceneFailed;
  return <section className="viewer-card" aria-label="가상 농장">
    <div className="viewer-head"><div><span className="overline">VIRTUAL FIELD / 01</span><h2>가상 농장 시뮬레이터</h2></div><div className="segmented" role="group" aria-label="지도 표시 방식"><button type="button" aria-pressed={!useFlat} onClick={()=>setView('3d')} disabled={webgl===false||sceneFailed}>3D 장면</button><button type="button" aria-pressed={useFlat} onClick={()=>setView('flat')}>평면 지도</button></div></div>
    <div className="scene-area">
      {useFlat?<FlatMap sim={sim}/>:webgl===null?<div className="scene-loading">3D 장면을 준비하는 중입니다…</div>:<SceneBoundary fallback={<FlatMap sim={sim}/>} onFailure={()=>setSceneFailed(true)}><Canvas frameloop="demand" shadows="percentage" dpr={[1,1.5]} camera={{position:[6.2,3.8,6.6],fov:38,near:.1,far:120}} gl={{antialias:true,powerPreference:'high-performance',alpha:true}}><StudioScene map={MAP} state={sim} mode="farm" reset={0}/></Canvas></SceneBoundary>}
      <div className="scene-chip">{useFlat&&view==='3d'?'WebGL 사용 불가 · 평면 지도':useFlat?'2D MAP':'3D FARM VIEW'}</div>
    </div>
    <div className="viewer-foot"><span>드래그하여 회전 · 스크롤/핀치로 확대</span><strong>화면 속 가상 이동 · 실물 제어 없음</strong></div>
  </section>;
}

function ConfirmDialog({onCancel,onConfirm}){
  const confirmRef=useRef(null);
  useEffect(()=>{confirmRef.current?.focus();const key=e=>{if(e.key==='Escape')onCancel();if(e.key==='Tab'){const nodes=[...document.querySelectorAll('.dialog button')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[onCancel]);
  return <div className="dialog-backdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className="overline">SIMULATION CONFIRMATION</span><h2 id="confirm-title">모의 작업을 시작할까요?</h2><p id="confirm-description">허용 구역 A로 가상 트랙터를 이동해 작업한 뒤 기지로 복귀합니다. 실제 농기계나 서버에는 아무 명령도 전송하지 않습니다.</p><div className="dialog-actions"><button type="button" className="btn secondary" onClick={onCancel}>취소</button><button ref={confirmRef} type="button" className="btn primary" onClick={onConfirm}>가상 작업 시작</button></div></div></div>;
}

export default function App(){
  const [{sim,history},dispatch]=useReducer(reducer,undefined,init);
  const [input,setInput]=useState('');const [notice,setNotice]=useState('');const [pending,setPending]=useState(false);
  const [view,setView]=useState('3d');const [replay,setReplay]=useState(null);const [resetPrompt,setResetPrompt]=useState(false);
  const display=replay?replay.record.frames[replay.index]:sim;
  useEffect(()=>{try{saveHistory(window.localStorage,history)}catch{}},[history]);
  useEffect(()=>{if(!isBusy(sim)||sim.phase==='PAUSED')return;const timer=setInterval(()=>dispatch({type:'TICK'}),850);return()=>clearInterval(timer)},[sim.phase]);
  useEffect(()=>{if(!replay||replay.index>=replay.record.frames.length-1)return;const timer=setTimeout(()=>setReplay(current=>current?{...current,index:current.index+1}:null),750);return()=>clearTimeout(timer)},[replay]);
  function submit(value=input){
    if(replay){setNotice('기록 재생을 닫은 뒤 새 명령을 입력해 주세요.');return}
    const result=interpret(value);setInput(value);
    if(result.kind==='reject'){setNotice(result.reason);return}
    if(result.kind==='status'){setNotice(`모의 상태: ${phaseName[sim.phase]}. 위치: ${sim.position.x}열 ${sim.position.y}행. ${sim.message}`);return}
    if(result.kind==='return'){dispatch({type:'RETURN'});setNotice('기지 복귀 명령을 가상 시뮬레이터에 적용했습니다.');return}
    if(isBusy(sim)){setNotice('현재 모의 작업이 진행 중입니다. 중복 실행은 할 수 없습니다.');return}
    if(sim.phase==='STOPPED'&&(sim.position.x!==MAP.base.x||sim.position.y!==MAP.base.y)){setNotice('가상 트랙터가 기지 밖에서 멈췄습니다. 먼저 기지로 복귀해 주세요.');return}
    setNotice('허용 구역 A 작업 요청을 확인했습니다.');setPending(true);
  }
  function start(){dispatch({type:'START',zone:'A',jobId:`demo-${Date.now()}`});setPending(false);setNotice('가상 작업을 시작했습니다.');setInput('')}
  function reset(){try{window.localStorage.removeItem(STORAGE_KEY)}catch{}dispatch({type:'RESET'});setReplay(null);setResetPrompt(false);setNotice('이 브라우저의 체험판 기록을 지웠습니다.')}
  const progress=sim.phase==='WORKING'?Math.round(sim.workStep/3*100):sim.phase==='COMPLETE'?100:0;
  return <>
    <header className="topbar"><a className="brand" href="./" aria-label="AgriSAGE 정적 체험판 시작"><img src="./brand/agrisage-mascot.png" alt=""/><span>AgriSAGE</span></a><span className="header-divider"/><span className="header-label">FIELD CONTROL EXPERIENCE</span><span className="header-spacer"/><span className="header-badge">STATIC DEMO</span></header>
    <div className="disclosure" role="note"><strong>체험용 정적 데모</strong><span>AI 모의 응답</span><span>이 브라우저에만 저장</span><span>실물 제어 없음</span></div>
    <main className="main">
      <div className="intro"><div><span className="overline">AGRICULTURAL INTELLIGENCE / DEMO</span><h1>한 문장으로 살펴보는<br/><em>미래 농장 운영</em></h1><p>허용 구역 A에서 가상 트랙터가 이동하고 작업한 뒤 복귀하는 과정을 직접 체험해 보세요.</p></div><div className="intro-aside"><span className="live-dot"/>브라우저 안에서 실행되는 모의 시나리오<small>연결된 실제 농장이나 기계가 없습니다.</small></div></div>
      <div className="dashboard"><Viewer sim={display} view={view} setView={setView}/><aside className="control-card">
        <div className="control-head"><span className="overline">COMMAND CONSOLE</span><h2>작업 요청</h2><p>아래 예시 문장만 결정적으로 해석합니다.</p></div>
        <div className="examples" aria-label="요청 예시">{['허용 구역 A 작업해줘','상태 조회','기지로 복귀해줘'].map(example=><button key={example} type="button" onClick={()=>{setInput(example);setNotice('')}}>{example}<span aria-hidden="true">↗</span></button>)}</div>
        <form onSubmit={e=>{e.preventDefault();submit()}}><label htmlFor="command">요청 문장</label><textarea id="command" value={input} onChange={e=>setInput(e.target.value)} maxLength={100} placeholder="예: 허용 구역 A 작업해줘" rows={3}/><button type="submit" className="btn primary full">모의 해석하기 <span aria-hidden="true">→</span></button></form>
        <div className="response" aria-live="polite"><span className="overline">MOCK AI RESPONSE</span><p>{notice||'예시 문장을 선택하거나 입력해 주세요. 알 수 없는 문장은 실행하지 않습니다.'}</p></div>
        <div className="limitations"><strong>체험판 안내</strong><p>실시간 협업, FactChat, Qwen, 데이터베이스와 연결되지 않습니다. 인증·서버 보안·실물 제어 능력을 검증하는 화면이 아닙니다.</p></div>
      </aside></div>
      <section className="status-card" aria-labelledby="status-title"><div className="section-heading"><div><span className="overline">SIMULATION STATUS</span><h2 id="status-title">가상 작업 상태</h2></div><span className={`phase phase-${sim.phase.toLowerCase()}`}>{phaseName[sim.phase]}</span></div><div className="status-body"><div className="status-main"><p className="status-message" aria-live="polite">{sim.message}</p><div className="status-meta"><span>위치 <strong>{sim.position.x}열 · {sim.position.y}행</strong></span><span>작업 구역 <strong>허용 A</strong></span><span>작업 진도 <strong>{progress}%</strong></span></div><div className="progress" role="progressbar" aria-label="모의 작업 진도" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${progress}%`}}/></div><p className="status-note">‘작업 완료’는 가상 작업과 기지 복귀가 모두 끝났을 때만 표시됩니다.</p></div><div className="controls"><button type="button" className="btn stop" disabled={!!replay||!isBusy(sim)} onClick={()=>{dispatch({type:'STOP'});setNotice('가상 트랙터를 즉시 멈췄습니다.')}}>즉시 멈춤</button><button type="button" className="btn secondary" disabled={!!replay||!isBusy(sim)||sim.phase==='RETURNING'||sim.phase==='PAUSED'} onClick={()=>dispatch({type:'PAUSE'})}>일시정지</button><button type="button" className="btn secondary" disabled={!!replay||sim.phase!=='PAUSED'} onClick={()=>dispatch({type:'RESUME'})}>계속</button><button type="button" className="btn secondary" disabled={!!replay||sim.phase==='IDLE'||sim.phase==='RETURNING'||sim.phase==='COMPLETE'||sim.phase==='RETURNED'} onClick={()=>dispatch({type:'RETURN'})}>기지 복귀</button></div></div></section>
      <section className="history-card" aria-labelledby="history-title"><div className="section-heading"><div><span className="overline">LOCAL ACTIVITY</span><h2 id="history-title">이 브라우저의 작업 기록</h2></div><button type="button" className="text-button" onClick={()=>setResetPrompt(true)} disabled={!history.length}>기록 초기화</button></div><p className="history-help">최대 20개까지 이 브라우저에만 저장됩니다. 재생은 저장된 장면을 보여주며 새 실행을 만들지 않습니다.</p>{history.length?<div className="history-list">{history.map(record=><div className="history-row" key={record.id}><div><strong>{record.command}</strong><small>{record.startedAt} · {record.endedAt||'진행 중'}</small></div><span className="history-phase">{phaseName[record.status]||record.status}</span><button type="button" className="btn secondary" onClick={()=>{setReplay({record,index:0});setView('flat');setNotice('저장된 장면을 재생합니다. 새 작업은 실행되지 않습니다.')}}>기록 재생</button></div>)}</div>:<div className="history-empty">아직 저장된 모의 작업이 없습니다.</div>}{replay&&<div className="replay-strip" role="status"><span>기록 재생 중 · {replay.index+1}/{replay.record.frames.length} 프레임 · 새 실행 없음</span><button type="button" onClick={()=>setReplay(null)}>재생 닫기</button></div>}</section>
      <footer>AgriSAGE 정적 체험판 <span>·</span> 모든 시뮬레이션은 브라우저 내부에서만 실행됩니다.</footer>
    </main>
    {pending&&<ConfirmDialog onCancel={()=>setPending(false)} onConfirm={start}/ >}
    {resetPrompt&&<div className="dialog-backdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">체험판 기록을 지울까요?</h2><p>이 브라우저의 AgriSAGE 정적 데모 기록만 삭제됩니다.</p><div className="dialog-actions"><button type="button" className="btn secondary" onClick={()=>setResetPrompt(false)}>취소</button><button type="button" className="btn stop" onClick={reset}>기록 삭제</button></div></div></div>}
  </>;
}
