// Deployed to Supabase. No teacher credential or service key belongs in this file.
const URL = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = 'https://wongngaiyam3-rgb.github.io';
const headers = {'Access-Control-Allow-Origin': allowedOrigin,'Access-Control-Allow-Headers':'content-type, apikey, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function db(table:string,query='',method='GET',body?:unknown){
 const r=await fetch(`${URL}/rest/v1/${table}?${query}`,{method,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){console.error('Database request failed',table,r.status);throw new Error('雲端暫時未能儲存，請稍後重試。');}return r.status===204?[]:await r.json();
}
const validToken=(s:unknown)=>typeof s==='string' && /^[a-f0-9]{64}$/.test(s);
const validStudent=(c:unknown,n:unknown)=>['4A','4B','4C'].includes(c as string)&&Number.isInteger(n)&&Number(n)>=1&&Number(n)<=25;
async function questionBank(){return (await db('math4_settings','id=eq.questions&select=payload'))[0].payload;}
const safeAttempt=(a:any)=>{const {token_hash,...safe}=a;return safe;};
async function result(a:any){if(!a.completed)return {attempt:safeAttempt(a)};const qs=await questionBank();return {attempt:safeAttempt(a),review:qs.map((q:any,i:number)=>({id:q.id,answer:q.answer,explanation:q.explanation,correct:a.answers[i]===q.answer}))};}
async function teacher(token:unknown){if(!validToken(token))return false;return (await db('math4_teacher_sessions',`token_hash=eq.${await hash(token as string)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=token_hash`)).length>0;}
async function passwordMatches(password:string,config:any){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const out=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(config.salt),iterations:config.iterations,hash:'SHA-256'},key,256);const hex=[...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,'0')).join('');let diff=hex.length^config.hash.length;for(let i=0;i<hex.length;i++)diff|=hex.charCodeAt(i)^config.hash.charCodeAt(i);return diff===0;}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'只接受POST請求'},405);
 try{
  const raw=await req.text();if(raw.length>16000)return json({error:'資料過大'},413);
  const b=JSON.parse(raw);
  if(b.action==='health')return json({ok:true,app:'p4-maths-mcq-40-v1'});
  if(b.action==='login'){
   const ip=await hash(KEY+(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown'));
   const recent=await db('math4_login_events',`ip_hash=eq.${ip}&created_at=gt.${encodeURIComponent(new Date(Date.now()-900000).toISOString())}&select=id&limit=10`);
   if(recent.length>=10)return json({error:'嘗試次數過多，請15分鐘後再試。'},429);
   await db('math4_login_events','','POST',{ip_hash:ip});
   const config=(await db('math4_settings','id=eq.teacher&select=payload'))[0].payload;
   if(typeof b.password!=='string'||b.password.length>100||!await passwordMatches(b.password,config))return json({error:'密碼不正確。'},401);
   const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
   await db('math4_teacher_sessions','','POST',{token_hash:await hash(token),expires_at:new Date(Date.now()+8*3600000).toISOString()});
   return json({token});
  }
  if(['list','detail','logout'].includes(b.action)){
   if(!await teacher(b.teacherToken))return json({error:'教師登入已過期，請重新登入。'},401);
   if(b.action==='logout'){await db('math4_teacher_sessions',`token_hash=eq.${await hash(b.teacherToken)}`,'DELETE');return json({ok:true});}
   if(b.action==='detail'){
    if(typeof b.id!=='string'||! /^[a-f0-9-]{36}$/.test(b.id))return json({error:'無效紀錄'},400);
    const a=(await db('math4_attempts',`id=eq.${b.id}&select=*`))[0];if(!a)return json({error:'找不到紀錄'},404);
    const qs=await questionBank();return json({attempt:safeAttempt(a),questions:qs});
   }
   let q='academic_year=eq.2026-2027&app_id=eq.p4-maths-mcq-40-v1&select=id,class,student_no,answered,completed,score,started_at,updated_at,completed_at,elapsed_seconds,version&order=started_at.desc';
   if(b.class){if(!['4A','4B','4C'].includes(b.class))return json({error:'班別不正確'},400);q+=`&class=eq.${b.class}`;}
   if(b.student_no!==undefined&&b.student_no!==null){if(!Number.isInteger(b.student_no)||b.student_no<1||b.student_no>25)return json({error:'學號不正確'},400);q+=`&student_no=eq.${b.student_no}`;}
   const all=[];for(let offset=0;offset<10000;offset+=1000){const rows=await db('math4_attempts',q+`&limit=1000&offset=${offset}`);all.push(...rows);if(rows.length<1000)break;}
   return json({attempts:all});
  }
  if(!['start','resume','save','finish'].includes(b.action)||!validToken(b.token))return json({error:'請重新選擇班別及學號。'},400);
  const th=await hash(b.token);let a=(await db('math4_attempts',`token_hash=eq.${th}&select=*`))[0];
  if(b.action==='start'){
   if(!validStudent(b.class,b.student_no))return json({error:'請選擇4A–4C及1–25號。'},400);
   if(a){if(a.class!==b.class||a.student_no!==b.student_no)return json({error:'學生資料與紀錄不符。'},403);return json(await result(a));}
   a=(await db('math4_attempts','','POST',{class:b.class,student_no:b.student_no,token_hash:th}))[0];return json(await result(a));
  }
  if(!a)return json({error:'找不到這次作答，請返回入口重試。'},404);
  if(b.action==='resume'||a.completed)return json(await result(a));
  if(!Array.isArray(b.answers)||b.answers.length!==40||!b.answers.every((n:any)=>Number.isInteger(n)&&n>=-1&&n<=3))return json({error:'答案格式不正確'},400);
  if(!Number.isInteger(b.version)||b.version!==a.version)return json({error:'另一頁面已更新這份答案，請重新載入。'},409);
  const answered=b.answers.filter((n:number)=>n>=0).length;
  if(b.action==='finish'&&answered!==40)return json({error:'請先完成全部40題。'},400);
  const complete=b.action==='finish';const qs=complete?await questionBank():null;
  const elapsed=Math.max(a.elapsed_seconds,Math.min(Math.floor((Date.now()-Date.parse(a.started_at))/1000),Number.isFinite(b.elapsed_seconds)?Math.max(0,Math.floor(b.elapsed_seconds)):0));
  const patch={answers:b.answers,answered,version:a.version+1,updated_at:new Date().toISOString(),elapsed_seconds:elapsed,completed:complete,...(complete?{score:qs.reduce((s:number,q:any,i:number)=>s+(q.answer===b.answers[i]?1:0),0),completed_at:new Date().toISOString()}:{})};
  const updated=await db('math4_attempts',`id=eq.${a.id}&version=eq.${a.version}&completed=eq.false`,'PATCH',patch);
  if(updated.length!==1)return json({error:'答案剛被另一頁面更新，請重新載入。'},409);
  return json(await result(updated[0]));
 }catch(e){console.error('Quiz request failed',e instanceof Error?e.message:'unknown');return json({error:'連線未能完成，答案仍保留在此裝置。請重試。'},500);}
});
