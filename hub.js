/* 3단원 허브 연결: 지금 열린 활동 알리기 · 학생 이동 버튼 · 기록 저장(Firebase + 구글 시트)
   모든 데이터는 rooms/hub_main 아래 (기존 보안 규칙 그대로 통과) */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = () => getDatabase(getApp());
const H = p => ref(db(), 'rooms/hub_main' + (p ? '/' + p : ''));

const STUDENT_NAME_KEY = 'marketgo_student_name';
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
  trade: { title: '떡볶이 시장', lesson: 2, file: 'market-trade.html', emoji: '🥵' },
  curve: { title: '시장 예측하기', lesson: 3, file: 'curve.html', emoji: '📈' },
};

/* 👩‍🏫 선생님 화면이 방을 열면 → 허브의 '지금 수업'으로 등록 */
let seen = '', seenTimer = null;
export function hubSeen(app, room) {
  if (!room) return;
  const key = `${app}|${room}`;
  if (seen === key) return;
  seen = key;
  const send = () => update(H('current'), { app, room: String(room), at: Date.now() }).catch(() => {});
  send();
  if (seenTimer) clearInterval(seenTimer);
  seenTimer = setInterval(send, 60 * 1000);
  monitorStudentPresence(app, room);
}


/* 학생 이탈 감지: 앱이 백그라운드에 있을 때는 20초 유예.
   브라우저 종료·네트워크 단절은 onDisconnect를 사용. 이탈 '의심'일 뿐 고의 탈출의 증거는 아닙니다. */
const PRESENCE_GRACE_MS = 20000;
const presenceKey=(app,room)=>String(app)+'_'+String(room);
const presenceRef=(app,room,id)=>H('presence/'+presenceKey(app,room)+'/'+id);
function registerStudentPresence(app,room) {
  const name=getStudentName();
  if(!name||!app||!room)return;
  let id;
  try {
    id=localStorage.getItem('marketgo_presence_id');
    if(!id){id='p'+Math.random().toString(36).slice(2,12);localStorage.setItem('marketgo_presence_id',id);}
  }catch(e){id='p'+Math.random().toString(36).slice(2,12);}
  const r=presenceRef(app,room,id);
  const record=(state)=>update(r,{name,state,at:serverTimestamp()}).catch(()=>{});
  // An old tab must not keep overriding a new tab's active status.
  const alive=()=>record(document.visibilityState==='hidden'?'hidden':'active');
  onDisconnect(r).update({state:'offline',at:serverTimestamp()}).catch(()=>{});
  alive();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')alive();},15000);
  document.addEventListener('visibilitychange',alive);
  window.addEventListener('pagehide',()=>{clearInterval(interval);record('offline');},{once:true});
}
let teacherPresenceStop=null, teacherPresenceTimer=null, teacherPresenceKey='';
function monitorStudentPresence(app,room) {
  const key=presenceKey(app,room);
  if(teacherPresenceKey===key)return;
  if(teacherPresenceStop)teacherPresenceStop();
  if(teacherPresenceTimer)clearInterval(teacherPresenceTimer);
  teacherPresenceKey=key;
  const seenIds=new Set(),alerted=new Set();
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
    setTimeout(()=>item.remove(),20000);
  }
  function inspect(){
    const now=Date.now();
    for(const [id,p] of Object.entries(data)){
      if(!p||!p.name)continue;
      const status=p.state||'offline',at=Number(p.at)||0;
      if(status==='active'){
        if(alerted.has(id)){showNotice(p.name,'✅ 다시 수업 화면으로 돌아왔어요');alerted.delete(id);}
        seenIds.add(id);
      }else if(seenIds.has(id)&&!alerted.has(id)&&at>0&&now-at>=PRESENCE_GRACE_MS){
        showNotice(p.name,'⚠️ '+(statusLabel[status]||'수업 화면을 벗어난 것으로 보여요'));
        alerted.add(id);
      }
    }
  }
  teacherPresenceStop=onValue(H('presence/'+key),snap=>{
    data=snap.val()||{};
    if(!initialized){
      for(const [id,p] of Object.entries(data))if(p&&p.state==='active')seenIds.add(id);
      initialized=true;
    }
    inspect();
  },()=>{});
  teacherPresenceTimer=setInterval(inspect,3000);
}

/* 📊 기록: 같은 날·같은 방은 한 줄로 덮어써요. 구글 시트 주소가 있으면 시트로도 보내요 */
const pad = n => String(n).padStart(2, '0');
const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lastSent = {};
export async function hubLog(app, room, cols, rows, extra = '') {
  try {
    const d = new Date(), key = `${dayStr(d).replace(/-/g, '')}_${app}_${room}`;
    const json = JSON.stringify([cols, rows, extra]);
    if (lastSent[key] === json) return; lastSent[key] = json;
    const prev = (await get(H('logs/' + key))).val();
    if (prev && prev.json === json && prev.sent) return;
    const title = (APPS[app] || {}).title || app;
    const data = { key, app, title, room: String(room), at: Date.now(), date: `${dayStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`, cols, rows, extra, json, sent: false };
    await set(H('logs/' + key), data);
    const url = (await get(H('sheetUrl'))).val();
    if (url) {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key, sheet: title, date: data.date, room: data.room, cols, rows }) });
      await update(H('logs/' + key), { sent: true });
    }
  } catch (e) { console.warn('hubLog', e); }
}

/* 🧒 학생: 선생님이 다른 활동을 열면 → 화면 아래에 '이동' 버튼 */
export function hubFollow(app, room) {
  if (window.__hubFollow) return; window.__hubFollow = true;
  registerStudentPresence(app, room);
  let expireTimer = null;
  const st = document.createElement('style');
  st.textContent = `.hubGo{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#FFE58F;color:#5B4B57;border:3px solid #5B4B57;border-radius:999px;padding:14px 26px;font-family:Jua,sans-serif;font-size:22px;box-shadow:0 6px 0 #5B4B57;text-decoration:none;animation:hubB 1s infinite alternate;white-space:nowrap}@keyframes hubB{to{transform:translateX(-50%) translateY(-6px)}}`;
  document.head.appendChild(st);
  onValue(H('current'), s => {
    if (expireTimer) { clearTimeout(expireTimer); expireTimer = null; }
    document.querySelectorAll('.hubGo').forEach(x => x.remove());
    const c = s.val(); if (!c || !APPS[c.app]) return;
    if (c.app === app && String(c.room) === String(room)) return;
    const maxAge = 10 * 60 * 1000;
    const age = Date.now() - Number(c.at || 0);
    if (!c.at || age > maxAge) return;
    const target = APPS[c.app];
    const a = document.createElement('a'); a.className = 'hubGo';
    a.href = `${target.file}?room=${encodeURIComponent(c.room)}${target.q || ''}`;
    a.textContent = `🚀 선생님이 '${target.title}'을(를) 열었어요 → 이동!`;
    document.body.appendChild(a);
    expireTimer = setTimeout(() => a.remove(), Math.max(0, maxAge - age));
  });
}
