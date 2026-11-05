/* 3단원 허브 연결: 지금 열린 활동 알리기 · 학생 이동 버튼 · 기록 저장(Firebase + 구글 시트)
   모든 데이터는 rooms/hub_main 아래 (기존 보안 규칙 그대로 통과) */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = () => getDatabase(getApp());
const H = p => ref(db(), 'rooms/hub_main' + (p ? '/' + p : ''));

const STUDENT_NAME_KEY = 'marketgo_student_name';
const STUDENT_ROOM_KEY = 'marketgo_student_confirmed_room';
export function studentRoomConfirmed(room) {
  if(!/^\d{4}$/.test(String(room||'')))return false;
  try{return localStorage.getItem(STUDENT_ROOM_KEY)===String(room);}catch(e){return false;}
}
export function confirmStudentRoom(room) {
  if(!/^\d{4}$/.test(String(room||'')))return false;
  try{localStorage.setItem(STUDENT_ROOM_KEY,String(room));return true;}catch(e){return false;}
}
// Never automatically enroll a browser from an earlier class in a newly opened room.
export function requireStudentRoom(room) {
  if(studentRoomConfirmed(room))return true;
  location.replace('hub.html?joinRoom='+encodeURIComponent(String(room||'')));
  return false;
}
const LEGACY_NAME_KEYS = ['market_name', 'trade_name', 'auction_name', 'curve_name', 'poll_name'];
export function getStudentName() {
  try {
    let name = (localStorage.getItem(STUDENT_NAME_KEY) || '').trim();
    if (!name) {
      for (const key of LEGACY_NAME_KEYS) {
        name = (localStorage.getItem(key) || '').trim();
        if (name) break;
      }
      if (name) localStorage.setItem(STUDENT_NAME_KEY, name);
    }
    return name;
  } catch (e) { return ''; }
}
export function saveStudentName(value) {
  const name = String(value || '').trim().slice(0, 8);
  if (!name) return '';
  try {
    localStorage.setItem(STUDENT_NAME_KEY, name);
    LEGACY_NAME_KEYS.forEach(key => localStorage.setItem(key, name));
  } catch (e) {}
  return name;
}
export function clearStudentName() {
  try {
    localStorage.removeItem(STUDENT_NAME_KEY);
    LEGACY_NAME_KEYS.forEach(key => localStorage.removeItem(key));
  } catch (e) {}
}

export const APPS = {
  market: { title: '시장에 가면', lesson: 1, file: 'index.html', emoji: '🧺' },
  auction: { title: '다연샘 경매소', lesson: 2, file: 'auction.html', emoji: '🔨' },
  auctionS: { title: '다연샘 판매소 (공급)', lesson: 2, file: 'auction.html', q: '&kind=S', emoji: '🏷️' },
  poll: { title: '시장 가격 결정 투표', lesson: 2, file: 'poll.html', emoji: '🗳️' },
  trade: { title: '고@바 모찌 시장', lesson: 2, file: 'market-trade.html', emoji: '🍡' },
  curve: { title: '시장 예측하기', lesson: 3, file: 'curve.html', emoji: '📈' },
  priceLab: { title: '시장 가격', lesson: 2, file: 'price-lab.html', emoji: '📊' },
};


/* Smooth realtime UI updates: preserve focused fields, QR images and unchanged DOM nodes. */
export function patchHTML(root,html){
 const fresh=document.createElement('div');fresh.innerHTML=html;
 function sync(a,b){
  if(a.nodeType!==b.nodeType||(a.nodeType===1&&(a.tagName!==b.tagName||(a.id&&b.id&&a.id!==b.id)))){a.replaceWith(b.cloneNode(true));return;}
  if(a.nodeType===3){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
  if(a.nodeType!==1)return;
  if(a.id==='qr'&&a.childNodes.length&&!b.childNodes.length)return;
  const focused=a===document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  for(const attr of Array.from(a.attributes))if(!b.hasAttribute(attr.name))a.removeAttribute(attr.name);
  for(const attr of Array.from(b.attributes)){
   if(focused&&['value','checked'].includes(attr.name))continue;
   if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);
  }
  if(!focused&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){
   if(a.type==='checkbox'||a.type==='radio')a.checked=b.checked;
   else if(a.value!==b.value)a.value=b.value;
  }
  const incoming=Array.from(b.childNodes);
  for(let i=0;i<incoming.length;i++){
   const next=incoming[i];let existing=a.childNodes[i];
   if(!existing){a.appendChild(next.cloneNode(true));continue;}
   if(next.nodeType===1&&next.id&&existing.nodeType===1&&existing.id!==next.id){
    const found=Array.from(a.childNodes).find(node=>node.nodeType===1&&node.id===next.id);
    if(found){a.insertBefore(found,existing);existing=found;}
   }
   sync(existing,next);
  }
  while(a.childNodes.length>incoming.length)a.lastChild.remove();
 }
 const nodes=Array.from(fresh.childNodes);
 for(let i=0;i<nodes.length;i++){
  const old=root.childNodes[i];
  if(!old)root.appendChild(nodes[i].cloneNode(true));else sync(old,nodes[i]);
 }
 while(root.childNodes.length>nodes.length)root.lastChild.remove();
}

/* 👩‍🏫 선생님 화면이 방을 열면 → 허브의 '지금 수업'으로 등록 */
let seen = '', seenTimer = null;
export function hubSeen(app, room) {
  if (!room) return;
  const key = `${app}|${room}`;
  if (seen === key) return;
  seen = key;
  const send = async initial=>{
    try{
      if(!initial){
        const current=(await get(H('current'))).val();
        if(!current||current.app!==app||String(current.room)!==String(room)){
          if(seenTimer){clearInterval(seenTimer);seenTimer=null;}return;
        }
      }
      await update(H('current'),{app,room:String(room),at:Date.now()});
    }catch(e){}
  };
  send(true);
  if(seenTimer)clearInterval(seenTimer);
  seenTimer=setInterval(()=>send(false),60*1000);
  monitorStudentPresence(app, room);
}


/* 학생 이탈 감지: 앱이 백그라운드에 있을 때는 20초 유예.
   브라우저 종료·네트워크 단절은 onDisconnect를 사용. 이탈 '의심'일 뿐 고의 탈출의 증거는 아닙니다. */
const PRESENCE_GRACE_MS = 10000;
const presenceKey=(app,room)=>String(app)+'_'+String(room);
const presenceRef=(app,room,id)=>H('presence/'+presenceKey(app,room)+'/'+id);
function registerStudentPresence(app,room,participantId='') {
  const name=getStudentName();
  if(!name||!app||!room)return;
  let id;
  try {
    id=localStorage.getItem('marketgo_presence_id');
    if(!id){id='p'+Math.random().toString(36).slice(2,12);localStorage.setItem('marketgo_presence_id',id);}
  }catch(e){id='p'+Math.random().toString(36).slice(2,12);}
  const r=presenceRef(app,room,id);
  const who=()=>getStudentName()||name;
  const attrs=()=>({name:who(),...(participantId?{participantId:String(participantId)}:{})});
  let stopped=false, activeSaving=false, activeAgain=false;
  // 같은 앱에서 20초 이상 화면을 벗어났다가 복귀한 경우만 1회로 셉니다.
  // Firebase 트랜잭션으로 누적해 새로고침·재접속 후에도 횟수가 유지됩니다.
  async function markActive(){
    if(stopped)return;
    if(activeSaving){activeAgain=true;return;}
    activeSaving=true;
    try {
      await runTransaction(r,old=>{
        const x=old||{},t=Date.now();
        const away=Number(x.awaySince)||((x.state==='hidden'||x.state==='offline')?Number(x.at)||0:0);
        const genuine=(x.state==='hidden'||x.state==='offline')&&away>0&&t-away>=PRESENCE_GRACE_MS;
        return {...x,...attrs(),state:'active',at:t,awaySince:null,
          returnCount:(Number(x.returnCount)||0)+(genuine?1:0),
          lastReturnAt:genuine?t:(x.lastReturnAt||null)};
      },{applyLocally:false});
    }catch(e){console.warn('복귀 횟수 저장 실패',e);}
    finally{
      activeSaving=false;
      if(activeAgain){activeAgain=false;if(document.visibilityState==='visible')markActive();}
    }
  }
  function markAway(state){
    if(stopped)return;
    // 마지막 활성 시각과 처음 떠난 시각을 보존합니다.
    update(r,{...attrs(),state,at:serverTimestamp(),awaySince:Date.now()}).catch(()=>{});
  }
  onDisconnect(r).update({state:'offline',at:serverTimestamp()}).catch(()=>{});
  if(document.visibilityState==='visible')markActive();else markAway('hidden');
  const interval=setInterval(()=>{
    if(document.visibilityState==='visible'&&!activeSaving)update(r,{...attrs(),state:'active',at:serverTimestamp()}).catch(()=>{});
  },15000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')markAway('hidden');
    else markActive();
  });
  window.addEventListener('pagehide',()=>{
    markAway('offline');stopped=true;clearInterval(interval);
  },{once:true});
}
let teacherPresenceStop=null, teacherPresenceTimer=null, teacherPresenceKey='';
function monitorStudentPresence(app,room) {
  const key=presenceKey(app,room);
  if(teacherPresenceKey===key)return;
  if(teacherPresenceStop)teacherPresenceStop();
  if(teacherPresenceTimer)clearInterval(teacherPresenceTimer);
  teacherPresenceKey=key;
  const seenIds=new Set(),alerted=new Set(),lastCount=new Map();
  let data={},initialized=false;
  const statusLabel={hidden:'다른 화면으로 이동한 것으로 보여요',offline:'연결이 끊기거나 화면을 떠났어요'};
  const fmt=t=>new Date(t).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  function showNotice(name,message) {
    let wrap=document.getElementById('marketgo-presence-notices');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='marketgo-presence-notices';
      wrap.style.cssText='position:fixed;z-index:99999;right:12px;top:12px;display:flex;flex-direction:column;gap:8px;max-width:min(420px,calc(100vw - 24px));pointer-events:none';
      document.body.appendChild(wrap);
    }
    const item=document.createElement('div');
    item.style.cssText='pointer-events:auto;background:#FFF5CC;border:2px solid #DEB356;color:#493D36;border-radius:16px;padding:12px 16px;font:18px/1.45 Jua,"Malgun Gothic",sans-serif;box-shadow:0 6px 20px #0002;word-break:keep-all';
    const strong=document.createElement('strong');strong.textContent=name+' · ';
    const content=document.createTextNode(message+' ('+fmt(Date.now())+') ');
    const close=document.createElement('button');close.textContent='✕';close.title='알림 닫기';close.style.cssText='border:0;background:none;cursor:pointer;font-size:17px;color:inherit';close.onclick=()=>item.remove();
    item.append(strong,content,close);wrap.prepend(item);
    while(wrap.children.length>5)wrap.lastChild.remove();
    setTimeout(()=>{item.remove();if(wrap.childElementCount===0)wrap.remove();},3000);
  }
  function inspect(){
    const now=Date.now();
    for(const [id,p] of Object.entries(data)){
      if(!p||!p.name)continue;
      const status=p.state||'offline',at=Number(p.at)||0;
      const returns=Math.max(0,Number(p.returnCount)||0),previous=lastCount.get(id)??returns;
      if(status==='active'){
        if(alerted.has(id)||returns>previous){
          showNotice(p.name,'✅ 돌아왔어요 · 누적 '+returns+'회 (20초 이상 이탈)');
          alerted.delete(id);
        }
        seenIds.add(id);
      }else if(seenIds.has(id)&&!alerted.has(id)&&at>0&&now-at>=PRESENCE_GRACE_MS){
        showNotice(p.name,'⚠️ '+(statusLabel[status]||'수업 화면을 벗어난 것으로 보여요')+' · '+(returns+1)+'번째');
        alerted.add(id);
      }
      lastCount.set(id,returns);
    }
  }
  teacherPresenceStop=onValue(H('presence/'+key),snap=>{
    data=snap.val()||{};
    if(!initialized){
      for(const [id,p] of Object.entries(data)){if(p&&p.state==='active')seenIds.add(id);lastCount.set(id,Math.max(0,Number(p?.returnCount)||0));}
      initialized=true;
    }
    inspect();
  },()=>{});
  teacherPresenceTimer=setInterval(inspect,3000);
}

/* 교사용 평가 기록은 현재 브라우저에만 저장. 실시간 수업 데이터는 Firebase에 따로 보관됩니다. */
export function teacherLogs(){try{return JSON.parse(localStorage.getItem('marketgo_teacher_logs_v3')||'{}')||{}}catch(e){return {}}}
export function removeTeacherLog(k){const logs=teacherLogs();delete logs[k];try{localStorage.setItem('marketgo_teacher_logs_v3',JSON.stringify(logs))}catch(e){}}
export async function hubLog(app,room,cols,rows,extra=''){
  try{
    const d=new Date(),pad=n=>String(n).padStart(2,'0'),day=[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
    const classCode=(localStorage.getItem('marketgo_class_code')||'201').trim()||'201';
    const key=day.replace(/-/g,'')+'_'+classCode+'_'+app+'_'+room,logs=teacherLogs();
    const data={key,app,title:(APPS[app]||{}).title||app,room:String(room),classCode,at:Date.now(),date:day+' '+pad(d.getHours())+':'+pad(d.getMinutes()),cols,rows,extra,sent:false};
    if(logs[key]&&JSON.stringify(logs[key].rows)===JSON.stringify(rows)&&JSON.stringify(logs[key].cols)===JSON.stringify(cols))return;
    logs[key]=data;localStorage.setItem('marketgo_teacher_logs_v3',JSON.stringify(logs));
  }catch(e){console.warn('local teacher records',e)}
}

/* 🧒 학생: 선생님이 다른 활동을 열면 → 화면 아래에 '이동' 버튼 */
export function hubFollow(app, room, participantId='') {
  if (window.__hubFollow) return; window.__hubFollow = true;
  registerStudentPresence(app, room, participantId);
  let expireTimer = null;
  const st = document.createElement('style');
  st.textContent = `.hubGo{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#FFE58F;color:#5B4B57;border:3px solid #5B4B57;border-radius:999px;padding:14px 26px;font-family:Jua,sans-serif;font-size:22px;box-shadow:0 6px 0 #5B4B57;text-decoration:none;animation:hubB 1s infinite alternate;white-space:nowrap}@keyframes hubB{to{transform:translateX(-50%) translateY(-6px)}}`;
  document.head.appendChild(st);
  onValue(H('current'), s => {
    if (expireTimer) { clearTimeout(expireTimer); expireTimer = null; }
    document.querySelectorAll('.hubGo').forEach(x => x.remove());
    const c = s.val(); if (!c || !APPS[c.app]) return;
    if(String(c.room)!==String(room) || !studentRoomConfirmed(room))return; // never jump to another class
    if (c.app === app && String(c.room) === String(room)) return;
    const maxAge = 10 * 60 * 1000;
    const age = Date.now() - Number(c.at || 0);
    if (!c.at || age > maxAge) return;
    const target = APPS[c.app];
    const a = document.createElement('a'); a.className = 'hubGo';
    a.href = `${target.file}?room=${encodeURIComponent(c.room)}${target.q || ''}`;
    a.textContent = `🚀 선생님이 '${target.title}'을(를) 열었어요 → 이동!`;
    document.body.appendChild(a);
    const go=setTimeout(()=>{if(document.body.contains(a))location.href=a.href;},3500);
    a.addEventListener('click',()=>clearTimeout(go));
    expireTimer = setTimeout(()=>{clearTimeout(go);a.remove();},Math.max(0,maxAge-age));
  });
}
