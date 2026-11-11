export const API='https://uoajxuxmaqhigxuhwpcs.supabase.co/functions/v1/math4-quiz';
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(body){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});let data;try{data=await r.json();}catch{throw new Error('雲端未能回應，請稍後重試。');}if(!r.ok)throw Object.assign(new Error(data.error||'連線失敗'),{status:r.status});return data;}
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export const optionList=(all=false)=>`${all?'<option value="">全部學號</option>':'<option value="">請選擇學號</option>'}${Array.from({length:25},(_,i)=>`<option value="${i+1}">${i+1}號</option>`).join('')}`;
export const date=s=>s?new Intl.DateTimeFormat('zh-HK',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s)):'—';
export const minutes=n=>`${Math.floor((n||0)/60)}分${(n||0)%60}秒`;
const diagrams={
 diagonal:'<rect x="35" y="20" width="240" height="110"/><path d="M35 130L275 20" class="dash"/>',
 quarters:'<rect x="90" y="10" width="130" height="130"/><path d="M155 10V140M90 75H220" class="dash"/>',
 parallelogram:'<path d="M30 125L90 25H280L220 125Z"/><path d="M90 25V125" class="dash"/><path d="M245 125H280V25" class="ghost"/>',
 degree:'<path d="M155 75L55 25M155 75L55 125M155 75H270"/><circle cx="155" cy="75" r="5"/><text x="165" y="65">A</text>',
 cycle:'<path d="M70 25H240V125H70Z"/><circle cx="70" cy="25" r="4"/><circle cx="240" cy="25" r="4"/><circle cx="240" cy="125" r="4"/><circle cx="70" cy="125" r="4"/><text x="45" y="25">A</text><text x="250" y="25">B</text><text x="250" y="140">C</text><text x="45" y="140">D</text>'
};
export function diagram(id){return id?`<svg class="diagram" viewBox="0 0 320 150" role="img" aria-label="${{diagonal:'長方形有一條虛線對角線',quarters:'正方形有橫向及直向的虛線中線',parallelogram:'平行四邊形左邊三角形以虛線分割，右邊顯示填補位置',degree:'A點連接三條線',cycle:'四個頂點各連接兩條線的長方形框'}[id]}">${diagrams[id]||''}</svg>`:'';}
