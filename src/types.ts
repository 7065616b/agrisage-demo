export type Point = {x:number;y:number};
export type Zone = {id:string;name:string;kind:'work'|'protected'|'obstacle';x:number;y:number;width:number;height:number};
export type FarmMap = {width:number;height:number;base:Point;zones:Zone[]};
export type SimulationState = {phase:'IDLE'|'MOVING'|'WORKING'|'RETURNING'|'PAUSED'|'STOPPED'|'COMPLETE'|'RETURNED';position:Point;route:Point[];routeIndex:number;workStep:number;workCompleted:boolean;resumePhase:string|null;jobId:string|null;message:string};
