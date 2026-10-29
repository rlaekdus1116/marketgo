/* 3단원 허브 연결: 지금 열린 활동 알리기 · 학생 이동 버튼 · 기록 저장(Firebase + 구글 시트)
   모든 데이터는 rooms/hub_main 아래 (기존 보안 규칙 그대로 통과) */
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = () => getDatabase(getApp());
const H = p => ref(db(), 'rooms/hub_main' + (p ? '/' + p : ''));

export const APPS = {
  market: { title: '시장에 가면', lesson: 1, file: 'index.html', emoji: '🧺' },
  auction: { title: '다연샘 경매소', lesson: 2, file: 'auction.html', emoji: '🔨' },
  trade: { title: '떡볶이 시장', lesson: 2, file: 'market-trade.html', emoji: '🌶️' },
  curve: { title: '시장 예측하기', lesson: 3, file: 'curve.html', emoji: '📈' },
};

/* 👩‍🏫 선생님 화면이 방을 열면 → 허브의 '지금 수업'으로 등록 */
let seen = '';
export function hubSeen(app, room) {
  if (!room || seen === app + room) return; seen = app + room;
  update(H('current'), { app, room: String(room), at: Date.now() }).catch(() => {});
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
  const st = document.createElement('style');
  st.textContent = `.hubGo{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;background:#FFE58F;color:#5B4B57;border:3px solid #5B4B57;border-radius:999px;padding:14px 26px;font-family:Jua,sans-serif;font-size:22px;box-shadow:0 6px 0 #5B4B57;text-decoration:none;animation:hubB 1s infinite alternate;white-space:nowrap}@keyframes hubB{to{transform:translateX(-50%) translateY(-6px)}}`;
  document.head.appendChild(st);
  onValue(H('current'), s => {
    document.querySelectorAll('.hubGo').forEach(x => x.remove());
    const c = s.val(); if (!c || !APPS[c.app]) return;
    if (c.app === app && String(c.room) === String(room)) return;
    if (Date.now() - (c.at || 0) > 3 * 3600 * 1000) return;   // 3시간 지난 건 무시
    const a = document.createElement('a'); a.className = 'hubGo';
    a.href = `${APPS[c.app].file}?room=${encodeURIComponent(c.room)}`;
    a.textContent = `🚀 선생님이 '${APPS[c.app].title}'을(를) 열었어요 → 이동!`;
    document.body.appendChild(a);
  });
}
