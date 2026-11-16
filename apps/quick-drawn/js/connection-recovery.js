'use strict';
// Ephemeral transport recovery. No storage, Firebase, game rules or identity writes.
(()=>{
 const CHANNEL='quickdrawn-link',VERSION=1;
 const secret=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
 function nonce(){if(typeof crypto==='undefined'||!crypto.getRandomValues)return null;return Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('')}
 class QuickDrawnRecovery{
  constructor(options){this.o=options;this.generation=0;this.ticket=null;this.blocked=false;this.flight=null;this.timer=null;this.retryAt=0;this.attempt=0;this.lastSeen=0;this.away=false;this.probeAt=0;this.pending=null;this.lostAt=0;this.claim=null;this.resolving=false;this.watched=new WeakSet();this.notice=null;
   const wake=()=>{if(!this.active||document.visibilityState==='hidden')return;this.control('AWAY',{away:false});this.probeAt=Date.now();this.retry()};
   document.addEventListener('visibilitychange',()=>{if(!this.active)return;if(document.visibilityState==='hidden')this.control('AWAY',{away:true});else wake()});
   window.addEventListener('online',wake);window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);document.addEventListener('resume',wake);
   window.addEventListener('offline',()=>this.lost('Thiết bị đang mất mạng. Ván được giữ để kết nối lại.'));
  }
  get active(){return !!this.ticket}
  offer(){this.offerNonce=nonce();return this.offerNonce?{version:VERSION,nonce:this.offerNonce}:undefined}
  accept(offer,c){if(!offer||offer.version!==VERSION||!secret(offer.nonce))return undefined;const token=nonce(),session=nonce();if(!token||!session)return undefined;const ticket={version:VERSION,token,session,nonce:offer.nonce};this.arm(ticket,c);return {...ticket}}
  adopt(ticket,c){if(!ticket||ticket.version!==VERSION||!secret(ticket.token)||!secret(ticket.session)||ticket.nonce!==this.offerNonce)return false;this.arm({...ticket},c);return true}
  arm(ticket,c){this.ticket=ticket;this.remote=c?.peer||this.o.hostId();this.lastSeen=Date.now();this.blocked=false;this.attempt=0;this.probeAt=0;if(!this.timer)this.timer=setInterval(()=>this.tick(),5000)}
  reset(){this.generation++;this.ticket=null;this.blocked=false;this.pending=null;this.offerNonce=null;this.claim=null;this.resolving=false;this.lostAt=0;this.away=false;this.probeAt=0;this.attempt=0;this.clearFlight();clearInterval(this.timer);this.timer=null;this.hide()}
  metadata(){return {channel:CHANNEL,version:VERSION,session:this.ticket.session,token:this.ticket.token}}
  valid(data){return data&&data.channel===CHANNEL&&data.version===VERSION&&this.active&&data.session===this.ticket.session&&data.token===this.ticket.token}
  control(type,body={},c=this.o.getConnection()){if(c?.open&&this.active){try{c.send({...this.metadata(),type,...body})}catch(_){this.lost('Đường truyền bị gián đoạn. Đang kết nối lại…')}}}
  trackPeer(p,owned=false){if(!p||this.watched.has(p))return;this.watched.add(p);p.on('disconnected',()=>{if(this.o.getPeer()!==p||!this.active)return;this.retryAt=0;this.retry()});p.on('close',()=>{if(this.o.getPeer()===p)this.lost('Kết nối đã đóng. Có thể nối lại phiên đang chơi.')});p.on('open',()=>{if(this.o.getPeer()===p&&this.active){this.retryAt=0;this.retry()}});if(owned){p.on('connection',c=>{if(this.o.getPeer()!==p){c.close();return}if(this.o.acceptExtra?.(c))return;if(!this.incoming(c))c.close()});p.on('error',e=>this.peerError(e))}}
  peerError(error){if(!this.active)return false;if(error?.type==='network'&&this.o.getConnection()?.open){this.retryAt=Date.now()+3000;return true}this.lost('Chưa nối được với đối thủ. Ván đang được giữ.');return true}
  trackConnection(c){const generation=this.generation;c.on('open',()=>{if(generation!==this.generation||this.o.getConnection()!==c||!this.active)return;if(this.blocked&&this.o.role()==='guest'){this.requestNonce=nonce();const claim=this.claim?.matchId===this.o.matchId?.()?this.claim:null;if(claim)this.startFlight(c,45000);this.control('JOIN',{nonce:this.requestNonce,...(claim?{claim}:{})},c)}})}
  incoming(c){if(!this.active)return false;if(this.resolving){c.close();return true}if(this.o.role()!=='host'||!this.valid(c.metadata)){c.close();return true}
   this.lost('Đối thủ đang kết nối lại…',false);this.clearFlight();this.o.bind(c);this.startFlight(c);return true;
  }
  receive(data,c){if(this.o.getConnection()!==c)return true;
   if(!data||data.channel!==CHANNEL){if(this.active)this.lastSeen=Date.now();return false}
   if(!this.valid(data))return true;this.lastSeen=Date.now();
   if(data.type==='PING'){this.control('PONG',{},c);return true}if(data.type==='PONG'){this.probeAt=0;return true}
   if(data.type==='AWAY'&&typeof data.away==='boolean'){this.away=data.away;return true}
   if(data.type==='JOIN'&&this.o.role()==='host'&&secret(data.nonce)&&this.valid(c.metadata)){
    const generation=this.generation,claim=data.claim;if(claim&&(!Number.isFinite(claim.elapsedMs)||claim.elapsedMs<30000||claim.elapsedMs>604800000||![0,.5,1].includes(claim.hostScore)||typeof claim.matchId!=='string'))return true;if(claim)this.startFlight(c,45000);Promise.resolve(claim?this.o.applyClaim?.(claim):undefined).then(()=>{if(generation!==this.generation||c!==this.o.getConnection())return;this.pending={c,nonce:data.nonce,sequence:nonce()};this.control('STATE',{nonce:data.nonce,sequence:this.pending.sequence,state:this.o.snapshot()},c)}).catch(()=>{if(generation===this.generation&&c===this.o.getConnection())this.lost('Chưa khôi phục được trạng thái ván. Bấm kết nối lại.')})
   }else if(data.type==='STATE'&&this.o.role()==='guest'&&this.blocked&&data.nonce===this.requestNonce&&secret(data.sequence)){
    const generation=this.generation;Promise.resolve().then(()=>{if(generation!==this.generation||c!==this.o.getConnection())throw Error('Stale recovery');return this.o.apply(data.state)}).then(ok=>{if(ok===false)throw Error('Invalid recovery snapshot');if(generation!==this.generation||c!==this.o.getConnection())return;this.pending={c,nonce:data.nonce,sequence:data.sequence};this.control('ACK',{nonce:data.nonce,sequence:data.sequence},c)}).catch(()=>{if(generation===this.generation&&c===this.o.getConnection())this.lost('Chưa đồng bộ được trạng thái ván. Bấm kết nối lại.')})
   }else if(data.type==='ACK'&&this.o.role()==='host'&&this.matches(data,c)){
    this.control('GO',{nonce:data.nonce,sequence:data.sequence},c);this.restore();
   }else if(data.type==='GO'&&this.o.role()==='guest'&&this.matches(data,c))this.restore();
   return true;
  }
  matches(data,c){return this.pending?.c===c&&this.pending.nonce===data.nonce&&this.pending.sequence===data.sequence}
  restore(){this.clearFlight();this.blocked=false;this.pending=null;this.lastSeen=Date.now();this.probeAt=0;this.away=false;this.attempt=0;this.hide();this.o.restored()}
  lost(message='Mất kết nối với đối thủ. Đang thử kết nối lại…',auto=true){if(!this.active)return false;const first=!this.blocked;this.blocked=true;this.pending=null;this.probeAt=0;
   const c=this.o.getConnection();this.o.detach(c);this.clearFlight();if(c)try{c.close()}catch(_){}
   if(first){this.lostAt=Date.now();this.o.lost()}this.show(message);this.retryAt=first?0:Date.now()+2000;if(auto)this.retry();return true;
  }
  clearFlight(){if(this.flight){clearTimeout(this.flight.timer);this.flight=null}}
  startFlight(c,timeout=15000){this.clearFlight();const generation=this.generation;this.flight={c,timer:setTimeout(()=>{if(generation!==this.generation)return;this.o.detach(c);try{c.close()}catch(_){}this.flight=null;this.retryAt=Date.now()+Math.min(10000,1000*2**Math.min(this.attempt,4));this.show('Chưa gặp lại đối thủ. Đang chờ họ quay về game…')},timeout)}}
  retry(manual=false){if(!this.active||this.resolving)return;if(!manual&&(document.visibilityState==='hidden'||(typeof navigator!=='undefined'&&navigator.onLine===false)))return;
   if(manual){const old=this.flight?.c;this.clearFlight();if(old){this.o.detach(old);try{old.close()}catch(_){}}this.retryAt=0}
   if(Date.now()<this.retryAt)return;
   let p=this.o.getPeer();if(!p||p.destroyed){try{p=new Peer(this.o.role()==='host'?this.o.hostId():undefined);this.o.setPeer(p);this.trackPeer(p,true)}catch(_){this.retryAt=Date.now()+5000;return}}
   if(p.disconnected){try{p.reconnect()}catch(_){}this.retryAt=Date.now()+3000;return}
   if(!this.blocked){if(this.o.getConnection()?.open)this.control('PING');else this.lost();return}
   if(this.o.role()==='host'){this.show('Mất kết nối. Đang chờ đối thủ quay lại phòng…');return}
   if(this.flight||p.open===false)return;
   try{this.attempt++;const c=p.connect(this.o.hostId(),{reliable:true,metadata:this.metadata()});this.o.bind(c);this.startFlight(c);this.show('Đang kết nối lại với chủ phòng…')}catch(_){this.retryAt=Date.now()+5000;this.show('Chưa nối được. Kiểm tra mạng rồi thử lại.')}
  }
  tick(){if(!this.active||document.visibilityState==='hidden')return;const time=Date.now();if(this.blocked){this.updateDecisionUI();this.retry();return}if(this.probeAt&&time-this.probeAt>10000&&this.lastSeen<this.probeAt){this.lost('Không nhận được phản hồi. Đang nối lại…');return}if(time-this.lastSeen>(this.away?120000:40000)){this.lost('Đối thủ tạm mất kết nối. Đang chờ nối lại…');return}this.control('PING');if(this.o.getPeer()?.disconnected)this.retry()}
  show(text){if(!this.notice){const section=document.createElement('section');section.className='connection-notice';section.dataset.connectionNotice=this.o.label;section.setAttribute('role','status');const message=document.createElement('p');message.dataset.reconnectMessage='';const button=document.createElement('button');button.type='button';button.textContent='Kết nối lại';button.dataset.reconnectRetry='';button.onclick=()=>this.retry(true);section.append(message);section.append(button);document.body.append(section);this.notice=section}this.notice.querySelector('[data-reconnect-message]').textContent=text;this.notice.hidden=false;this.updateDecisionUI()}
  decisionAllowed(){return this.active&&this.blocked&&!this.resolving&&this.o.canAdjudicate?.()&&Date.now()-this.lostAt>=30000&&document.visibilityState!=='hidden'&&(typeof navigator==='undefined'||navigator.onLine!==false)}
  async adjudicate(score){
   if(![0,.5,1].includes(score)||!this.decisionAllowed())return;
   const generation=this.generation,matchId=this.o.matchId(),elapsedMs=Date.now()-this.lostAt;this.resolving=true;this.updateDecisionUI();
   try{const result=await this.o.adjudicate(score);if(this.generation!==generation)return;const actual=result?.score??score;this.claim={matchId,hostScore:this.o.role()==='host'?actual:1-actual,elapsedMs};this.show('Đã ghi kết quả cho cả hai người. Có thể về sảnh hoặc kết nối lại để đồng bộ.')}catch(_){if(this.generation===generation)this.show('Chưa ghi được kết quả. Hãy kiểm tra mạng và thử lại.')}finally{if(this.generation===generation){this.resolving=false;this.updateDecisionUI();this.retryAt=0;this.retry()}}
  }
  updateDecisionUI(){
   if(!this.notice)return;let area=this.notice.querySelector('[data-reconnect-decisions]');
   if(!area){area=document.createElement('div');area.dataset.reconnectDecisions='';const label=document.createElement('p');label.dataset.reconnectCountdown='';area.append(label);const buttons=document.createElement('div');buttons.className='connection-decision-actions';for(const [text,score]of [['Nhận thua',0],['Nhận thắng',1],['Hòa',.5]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.reconnectScore=String(score);button.onclick=()=>this.adjudicate(score);buttons.append(button)}area.append(buttons);this.notice.append(area)}
   const can=this.active&&this.blocked&&this.o.canAdjudicate?.();area.hidden=!can;if(!can)return;
   const remaining=Math.max(0,Math.ceil((30000-(Date.now()-this.lostAt))/1000));area.querySelector('[data-reconnect-countdown]').textContent=this.resolving?'Đang ghi kết quả…':remaining?'Chờ đối thủ nối lại: '+remaining+' giây.':'Bạn có thể chốt kết quả cho cả hai người.';
   for(const button of area.querySelectorAll('button'))button.disabled=!this.decisionAllowed();
  }

  hide(){if(this.notice)this.notice.hidden=true}
 }
 window.QuickDrawnRecovery=QuickDrawnRecovery;
})();
