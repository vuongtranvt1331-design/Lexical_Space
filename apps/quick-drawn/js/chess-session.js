'use strict';
// Pure rules/clock state. Host owns the clock; guests replay and validate moves.
(function(root){
 const REASONS=['checkmate','stalemate','repetition','fifty-move','material','agreement','resign','timeout','adjudication'];
 const validTime=t=>!!t&&Number.isInteger(t.minutes)&&t.minutes>=1&&t.minutes<=180&&Number.isInteger(t.increment)&&t.increment>=0&&t.increment<=60;
 const square=s=>typeof s==='string'&&/^[a-h][1-8]$/.test(s);
 class ChessSession{
  constructor(id,time){if(typeof id!=='string'||!/^chess-[a-z0-9-]+$/i.test(id)||!validTime(time))throw Error('Invalid chess session');this.id=id;this.time={minutes:time.minutes,increment:time.increment};this.game=new root.Chess();this.clocks=[time.minutes*60000,time.minutes*60000];this.anchor=0;this.running=false;this.result=null;this.revision=0;this.drawOffer=null}
  get turn(){return this.game.turn()==='w'?0:1}
  start(now){this.anchor=now;this.running=true}
  remaining(now){const clocks=[...this.clocks];if(this.running&&!this.result)clocks[this.turn]=Math.max(0,clocks[this.turn]-Math.max(0,now-this.anchor));return clocks}
  canMate(side){const pieces=this.game.board().flat().filter(Boolean),own=pieces.filter(p=>p.color===(side===0?'w':'b')&&p.type!=='k'),other=pieces.filter(p=>p.color!==(side===0?'w':'b')&&p.type!=='k');return own.length>0&&!(own.length===1&&['b','n'].includes(own[0].type)&&other.length===0)}
  finish(winner,reason,now){if(this.result||!REASONS.includes(reason)||![0,1,null].includes(winner))return false;this.clocks=this.remaining(now);this.result={winner,reason};this.running=false;this.drawOffer=null;this.revision++;return true}
  tick(now){if(!this.running||this.result)return false;if(this.remaining(now)[this.turn]>0)return false;return this.finish(this.canMate(1-this.turn)?1-this.turn:null,'timeout',now)}
  move(actor,from,to,promotion,now){
   if(!this.running||this.result||actor!==this.turn||!square(from)||!square(to)||!['q','r','b','n',undefined].includes(promotion))return false;
   if(this.tick(now))return false;
   const clocks=this.remaining(now);let move;try{move=this.game.move({from,to,...(promotion?{promotion}:{})})}catch(_){return false}if(!move)return false;
   this.clocks=clocks;this.clocks[actor]+=this.time.increment*1000;this.anchor=now;this.revision++;this.drawOffer=null;
   if(this.game.isCheckmate())this.finish(actor,'checkmate',now);
   else if(this.game.isStalemate())this.finish(null,'stalemate',now);
   else if(this.game.isInsufficientMaterial())this.finish(null,'material',now);
   else if(this.game.isThreefoldRepetition())this.finish(null,'repetition',now);
   else if(this.game.isDrawByFiftyMoves())this.finish(null,'fifty-move',now);
   return true;
  }
  snapshot(now){return {id:this.id,time:{...this.time},moves:this.game.history({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')),fen:this.game.fen(),clocks:this.remaining(now),revision:this.revision,running:this.running,result:this.result?{...this.result}:null,drawOffer:this.drawOffer}}
  static restore(data,now){
   if(!data||!validTime(data.time)||!Array.isArray(data.moves)||data.moves.length>20000||!data.moves.every(m=>typeof m==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))||!Array.isArray(data.clocks)||data.clocks.length!==2||!data.clocks.every(n=>Number.isFinite(n)&&n>=0&&n<=1210800000)||!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.running!=='boolean'||![null,0,1].includes(data.drawOffer))throw Error('Invalid snapshot');
   if(data.result!==null&&(!data.result||![null,0,1].includes(data.result.winner)||!REASONS.includes(data.result.reason)||data.running))throw Error('Invalid result');
   const session=new ChessSession(data.id,data.time);
   for(const m of data.moves)session.game.move({from:m.slice(0,2),to:m.slice(2,4),...(m.length===5?{promotion:m[4]}:{})});
   if(session.game.fen()!==data.fen)throw Error('Position mismatch');
   Object.assign(session,{clocks:[...data.clocks],revision:data.revision,running:data.running,result:data.result?{...data.result}:null,drawOffer:data.drawOffer,anchor:now});return session;
  }
 }
 root.ChessSession=ChessSession;root.validChessTime=validTime;
})(typeof window==='undefined'?globalThis:window);
