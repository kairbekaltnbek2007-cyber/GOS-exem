const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LET=['А','В','С','Д','Е'],fmt=s=>[s/3600|0,(s%3600)/60|0,Math.round(s)%60].map(n=>String(n).padStart(2,'0')).join(':'),dt=d=>new Date(d).toLocaleDateString('ru-RU');
const app=$('#app');let sb,user,draft,run,timer,admin,fix;
const toast=m=>{const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3500)};
const ask=m=>new Promise(r=>{const w=document.createElement('div');w.className='modal';w.innerHTML=`<div class="box card"><p>${esc(m)}</p><div class="row"><button class="btn ghost" data-v="0">Отмена</button><button class="btn" data-v="1">Да</button></div></div>`;w.onclick=e=>{const v=e.target.dataset.v;if(v!==undefined){w.remove();r(v==='1')}};document.body.append(w)});
const ic=p=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const NAV=[['home',ic('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5a2 2 0 0 1 4 0v5"/>'),'Дом'],['tests',ic('<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>'),'Тест'],['upload',ic('<path d="M7.5 18.5h-1a4.5 4.5 0 0 1-.5-8.97 6 6 0 0 1 11.6-1.2 4.6 4.6 0 0 1-.1 10.17h-1"/><path d="M12 20.5V12m0 0-3 3m3-3 3 3"/>'),'Загрузка теста'],['results',ic('<path d="M5 20v-5M10 20V9M15 20v-8M20 20V5"/>'),'Результаты'],['profile',ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),'Профиль']];
async function boot(){
 if(!window.CFG||CFG.url.startsWith('ВСТАВ')){app.innerHTML='<div class="auth card"><h2>Нужно подключить Supabase</h2><p>Вставьте адрес и ключ проекта в файл config.js.</p></div>';return}
 sb=supabase.createClient(CFG.url,CFG.key);
 user=(await sb.auth.getSession()).data.session?.user||null;
 sb.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;if((u&&u.id)!==(user&&user.id)){user=u;admin=undefined;route()}});
 addEventListener('hashchange',route);route()}
async function route(){
 clearInterval(timer);if(!user)return authView(false);
 if(admin===undefined){const r=await sb.from('admins').select('user_id').maybeSingle();admin=!!r.data}
 const [p,id,mode]=(location.hash.slice(1)||'home').split('/');
 const V={home:vHome,tests:vTests,upload:admin?draw:vHome,results:vResults,profile:vProfile,run:vRun,result:vResult,errors:vErrors,mock:vMock,mockrun:vMockRun};
 shell(p);try{await(V[p]||vHome)(id,mode)}catch(e){$('#main').innerHTML=`<div class="card err">Ошибка: ${esc(e.message)}</div>`}}
function shell(p){const a={run:'tests',result:'results',errors:'results',mock:'tests',mockrun:'tests'}[p]||p;
 app.innerHTML=`<aside><div class="logo">🩺 <b>ГОС экзамен</b></div><nav>${NAV.filter(x=>admin||x[0]!=='upload').map(([h,i,t])=>`<a href="#${h}" class="${h===a?'on':''}"><span>${i}</span><em>${t}</em></a>`).join('')}</nav></aside><main id="main"></main>`;}
function authView(reg){
 app.innerHTML=`<div class="auth card"><h2>🩺 ГОС экзамен</h2>${reg?'<input id="n" placeholder="Имя и фамилия"><input id="g" placeholder="Группа">':''}<input id="e" type="email" placeholder="Email"><input id="p" type="password" placeholder="Пароль (от 6 символов)"><button class="btn" id="go">${reg?'Зарегистрироваться':'Войти'}</button><a id="sw">${reg?'Уже есть аккаунт? Войти':'Нет аккаунта? Регистрация'}</a><p id="msg" class="err"></p></div>`;
 $('#sw').onclick=()=>authView(!reg);
 $('#go').onclick=async()=>{const e=$('#e').value.trim(),p=$('#p').value;
  const r=reg?await sb.auth.signUp({email:e,password:p,options:{data:{full_name:$('#n').value.trim(),group:$('#g').value.trim()}}}):await sb.auth.signInWithPassword({email:e,password:p});
  if(r.error)$('#msg').textContent=r.error.message;else if(reg&&!r.data.session)$('#msg').textContent='Подтвердите email по письму, затем войдите.'}}
async function vHome(){
 const [t,a]=await Promise.all([sb.from('tests').select('id'),sb.from('attempts').select('*,tests(title)').order('created_at',{ascending:false})]);
 if(t.error||a.error)throw(t.error||a.error);
 const A=a.data,avg=A.length?Math.round(A.reduce((s,x)=>s+x.percent,0)/A.length):0,tm=A.reduce((s,x)=>s+x.seconds,0);
 const ach=[[A.length>=1,'🥇','Первый тест'],[A.length>=3,'🏅','Активный студент'],[A.some(x=>x.percent>=90),'🏆','Отличник (90%+)']].filter(x=>x[0]);
 $('#main').innerHTML=`<h1>Привет, ${esc(user.user_metadata?.full_name||'студент')}! 👋</h1><div class="grid4">${[['📄','Всего тестов',t.data.length],['✅','Пройдено',A.length],['🎯','Средний результат',avg+'%'],['⏱','Время обучения',fmt(tm)]].map(([i,l,v])=>`<div class="card stat">${i}<small>${l}</small><b>${v}</b></div>`).join('')}</div>
 <h2>Недавние тесты</h2><div class="card">${A.slice(0,5).map(x=>`<div class="item"><div><b>${esc(x.tests?.title)}</b><small>${x.total} вопросов · ${dt(x.created_at)}</small></div><span class="pill">${x.percent}%</span><a class="btn ghost" href="#run/${x.test_id}">Пройти снова</a></div>`).join('')||'<p class="mut">Пока нет пройденных тестов.</p>'}</div>
 <h2>Достижения</h2><div class="card">${ach.map(([,i,t])=>`<span class="pill big">${i} ${t}</span>`).join('')||'<p class="mut">Пройдите первый тест, чтобы получить достижение.</p>'}</div>`}
async function vTests(){
 const {data,error}=await sb.from('tests').select('id,title,created_at,questions(count)').order('created_at',{ascending:false});if(error)throw error;
 $('#main').innerHTML=`<div class="row"><h1>Тесты</h1><a class="btn" href="#mock">🎓 Пробный экзамен</a></div><div class="card">${data.map(t=>`<div class="item"><div><b>${esc(t.title)}</b><small>${t.questions[0].count} вопросов · ${dt(t.created_at)}</small></div><a class="btn" href="#run/${t.id}">Пройти</a>${admin?`<button class="btn ghost" data-edit="${t.id}">Править</button><button class="btn ghost" data-del="${t.id}">Удалить</button>`:''}</div>`).join('')||(admin?'<p class="mut">Тестов пока нет. <a href="#upload">Загрузить тест</a></p>':'<p class="mut">Тесты ещё не добавлены.</p>')}</div>`;
 $('#main').onclick=async e=>{const d=e.target.dataset;
  if(d.del&&await ask('Удалить тест вместе с результатами?')){const r=await sb.from('tests').delete().eq('id',d.del);if(r.error)toast(r.error.message);vTests()}
  if(d.edit){const [t,q]=await Promise.all([sb.from('tests').select('title').eq('id',d.edit).single(),getQs(d.edit)]);
   draft={id:d.edit,title:t.data.title,qs:q.data.map(x=>({id:x.id,explanation:x.explanation||'',text:x.text,options:x.options,correct:x.correct,issues:[]}))};location.hash='#upload'}}}
const opts=q=>{const L=q.options.map(x=>x.trim());while(L.length&&!L.at(-1))L.pop();return L},
 bad=q=>{const o=opts(q);return !q.text.trim()||o.length<2||o.includes('')||q.correct==null||q.correct>=o.length};
function drop(){
 $('#main').innerHTML=`<h1>Загрузка теста</h1><label class="card drop" id="dz"><div>☁️</div><b>Перетащите файл сюда или нажмите для выбора</b><small>DOCX, TXT, PDF · кириллица и казахский · варианты А В С Д Е</small><input id="f" type="file" accept=".docx,.txt,.pdf" hidden></label><button class="btn ghost" id="man">Создать тест вручную</button><p id="msg" class="err"></p>`;
 const go=async f=>{if(!f)return;$('#msg').textContent='Читаю файл…';
  try{const qs=Parser.parse(await Parser.fileLines(f));if(!qs.length)throw Error('Вопросы не найдены. Нужен формат «1. Вопрос» и варианты «А) …».');draft={title:f.name.replace(/\.[^.]+$/,''),qs};draw()}catch(e){$('#msg').textContent=e.message}};
 $('#f').onchange=e=>go(e.target.files[0]);$('#dz').ondragover=e=>e.preventDefault();$('#dz').ondrop=e=>{e.preventDefault();go(e.dataTransfer.files[0])};
 $('#man').onclick=()=>{draft={title:'',qs:[blank()]};draw()}}
const blank=()=>({text:'',options:['','','','',''],correct:null,issues:[]});
function draw(){
 if(!draft)return drop();const m=$('#main');draft.qs.forEach(q=>{while(q.options.length<5)q.options.push('')});
 m.innerHTML=`<h1>${draft.id?'Редактирование теста':'Предварительный просмотр'}</h1><div class="card"><input id="ttl" placeholder="Название теста" value="${esc(draft.title)}"><small>Вопросов: ${draft.qs.length}. Проверьте текст и отметьте правильный ответ. Вопросы с проблемами подсвечены.</small></div>${draft.qs.map((q,i)=>`<div class="card q ${bad(q)?'bad':''}"><div class="row"><b>Вопрос ${i+1}</b><button class="btn ghost" data-rm="${i}">Удалить</button></div>${q.issues.map(x=>`<small class="err">⚠ ${esc(x)}</small>`).join('')}<textarea data-i="${i}" data-k="t">${esc(q.text)}</textarea><textarea data-i="${i}" data-k="x" placeholder="Пояснение к ответу (необязательно, показывается в тренировке)">${esc(q.explanation||'')}</textarea>${q.options.map((x,j)=>`<div class="opt"><input type="radio" name="c${i}" data-i="${i}" data-k="c" data-j="${j}" ${q.correct===j?'checked':''}><b>${LET[j]}</b><input data-i="${i}" data-k="o" data-j="${j}" value="${esc(x)}"></div>`).join('')}</div>`).join('')}<div class="row"><button class="btn ghost" id="add">+ Вопрос</button><button class="btn ghost" id="cx">Отмена</button><button class="btn" id="sv">Сохранить тест</button></div><p id="msg" class="err"></p>`;
 m.oninput=e=>{const d=e.target.dataset;if(e.target.id==='ttl')draft.title=e.target.value;else if(d.k==='t')draft.qs[d.i].text=e.target.value;else if(d.k==='x')draft.qs[d.i].explanation=e.target.value;else if(d.k==='o')draft.qs[d.i].options[d.j]=e.target.value};
 m.onchange=e=>{const d=e.target.dataset;if(d.k==='c')draft.qs[d.i].correct=+d.j};
 m.onclick=e=>{const t=e.target;if(t.dataset.rm!==undefined){draft.qs.splice(t.dataset.rm,1);draw()}else if(t.id==='add'){draft.qs.push(blank());draw()}else if(t.id==='cx'){draft=null;drop()}else if(t.id==='sv')save()}}
async function save(){
 const msg=$('#msg'),t=draft.title.trim();if(!t)return msg.textContent='Введите название теста';
 const i=draft.qs.findIndex(bad);if(i>=0)return msg.textContent=`Вопрос ${i+1}: нужен текст, минимум 2 варианта без пропусков и отмеченный правильный ответ`;
 try{let id=draft.id,r;
  if(id){r=await sb.from('tests').update({title:t}).eq('id',id);if(r.error)throw r.error}
  else{r=await sb.from('tests').insert({title:t}).select().single();if(r.error)throw r.error;id=r.data.id}
  const rows=draft.qs.map((q,p)=>({id:q.id||crypto.randomUUID(),test_id:id,pos:p,text:q.text.trim(),options:opts(q),correct:q.correct,explanation:(q.explanation||'').trim()||null}));
  const old=draft.id?(await getQs(id)).data.map(x=>x.id):[];
  for(let a=0;a<rows.length;a+=300){r=await sb.from('questions').upsert(rows.slice(a,a+300));if(r.error)throw r.error}
  const keep=new Set(rows.map(x=>x.id)),gone=old.filter(x=>!keep.has(x));
  for(let a=0;a<gone.length;a+=100){r=await sb.from('questions').delete().in('id',gone.slice(a,a+100));if(r.error)throw r.error}
  draft=null;toast('Тест сохранён');location.hash='#tests'}catch(e){msg.textContent='Не удалось сохранить: '+e.message}}
const SZ=200,MOCK_SEC=45;
async function getQIds(tids){let all=[],a=0;for(;;){let q=sb.from('questions').select('id,test_id').order('id').range(a,a+999);if(tids)q=q.in('test_id',tids);const r=await q;if(r.error)throw r.error;all=all.concat(r.data);if(r.data.length<1000)break;a+=1000}return all}
async function getQsByIds(ids){let o=[];for(let a=0;a<ids.length;a+=100){const r=await sb.from('questions').select('*').in('id',ids.slice(a,a+100));if(r.error)throw r.error;o=o.concat(r.data)}const M=Object.fromEntries(o.map(x=>[x.id,x]));return ids.map(i=>M[i]||{id:i,test_id:null,text:'(вопрос удалён)',options:['—'],correct:0})}
async function mockPool(src){if(src!=='done')return getQIds();const r=await sb.from('attempts').select('test_id');if(r.error)throw r.error;const t=[...new Set((r.data||[]).map(x=>x.test_id).filter(Boolean))];return t.length?getQIds(t):[]}
async function vMock(cs,src){
 const count=+cs||50,sc=src==='done'?'done':'all',pool=await mockPool(sc),n=pool.length,c=Math.min(count,n),min=Math.round(c*MOCK_SEC/60),ch=(h,t,on)=>`<a class="btn ${on?'':'ghost'}" href="${h}">${t}</a>`;
 $('#main').innerHTML=`<h1>Пробный экзамен</h1><div class="card"><p>Система случайно выберет вопросы ${sc==='done'?'из пройденных вами тестов':'из всех тестов'} и включит жёсткий таймер. Подсказок нет: правильные ответы видны только после завершения. Когда время выйдет, экзамен завершится сам.</p><p class="mut">Сколько вопросов:</p><div class="row" style="justify-content:flex-start">${[50,100].map(x=>ch(`#mock/${x}/${sc}`,x,count===x)).join('')}</div><p class="mut">Откуда брать вопросы:</p><div class="row" style="justify-content:flex-start">${ch(`#mock/${count}/all`,'Все тесты',sc==='all')}${ch(`#mock/${count}/done`,'Только пройденные',sc==='done')}</div>${n?`<p><b>${c} вопросов · ${min} мин</b>${c<count?`<small>В выбранном наборе всего ${n} вопросов.</small>`:''}</p><a class="btn" href="#mockrun/${count}/${sc}">Начать пробный экзамен</a>`:`<p class="err">Нет вопросов для экзамена. ${sc==='done'?'Сначала пройдите хотя бы один тест или выберите «Все тесты».':'Тесты ещё не добавлены.'}</p>`}</div>`}
async function vMockRun(cs,src){
 const count=+cs||50,sc=src==='done'?'done':'all',key='gos_run_mock';let sv=null;try{sv=JSON.parse(localStorage.getItem(key))}catch(e){}
 if(sv&&sv.dl&&Date.now()-sv.dl>600000){try{localStorage.removeItem(key)}catch(e){}sv=null}
 let qs,st=null;
 if(sv&&sv.mock&&sv.qids&&sv.qids.length){qs=await getQsByIds(sv.qids);st=sv}
 if(!st){const a=(await mockPool(sc)).slice();if(!a.length)throw Error('Нет вопросов для экзамена');for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  qs=await getQsByIds(a.slice(0,count).map(x=>x.id));const t=Date.now();st={mock:1,qids:qs.map(x=>x.id),ans:{},flag:[],lock:{},i:0,t0:t,qt0:t,dl:t+qs.length*MOCK_SEC*1000}}
 run={...st,flag:new Set(st.flag),id:null,key,mode:'mock',title:'Пробный экзамен',qs,done:false};persist();rdr()}
async function getQs(id){let all=[],a=0;for(;;){const r=await sb.from('questions').select('*').eq('test_id',id).order('pos').range(a,a+999);if(r.error)throw r.error;all=all.concat(r.data);if(r.data.length<1000)break;a+=1000}return{data:all,error:null}}
async function vRun(id,mode0){
 const [mode,rest='']=(mode0||'').split('@'),[pt,cnt]=rest.split('~'),part=+pt||0,count=+cnt||0;
 const [t,q,m,at]=await Promise.all([sb.from('tests').select('title').eq('id',id).single(),getQs(id),sb.from('mistakes').select('question_id,status').eq('test_id',id),sb.from('attempts').select('qids').eq('test_id',id)]);
 if(t.error||q.error)throw(t.error||q.error);if(!q.data.length)throw Error('В тесте нет вопросов');
 const open=new Set((m.data||[]).filter(x=>x.status==='open').map(x=>x.question_id)),err=/^(e|(exam|train)-e)$/.test(mode||''),base=err?(mode==='e'?'':mode.slice(0,-2)):mode;
 const n=q.data.length,blocks=Math.ceil(n/SZ),blk=k=>q.data.slice((k-1)*SZ,k*SZ),A=(at.data||[]).map(a=>new Set(a.qids||[])),isDone=k=>A.some(z=>blk(k).every(x=>z.has(x.id)));
 if(base!=='exam'&&base!=='train'){let sel=part;if(sel===0&&pt===''&&blocks>1){sel=1;while(sel<blocks&&isDone(sel))sel++}return pickMode(id,t.data.title,err,open.size,{n,blocks,sel,cnt:count,ps:blocks>1&&sel?Math.min(SZ,n-(sel-1)*SZ):n,done:Array.from({length:blocks},(_,i)=>isDone(i+1))})}
 const pool=err?q.data.filter(x=>open.has(x.id)):(part?blk(part):q.data);if(!pool.length)throw Error('Ошибок для повтора нет');
 const key='gos_run_'+id+'_'+mode0;let s=null;try{s=JSON.parse(localStorage.getItem(key))}catch(e){}
 const byId=Object.fromEntries(q.data.map(x=>[x.id,x])),resume=s&&s.qids&&s.qids.length&&s.qids.every(i=>byId[i]);
 let qs;
 if(resume)qs=s.qids.map(i=>byId[i]);
 else if(!err&&count&&count<pool.length){const a=pool.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}qs=a.slice(0,count).sort((x,y)=>x.pos-y.pos)}
 else qs=pool;
 const qids=qs.map(x=>x.id);
 run=resume?{...s,flag:new Set(s.flag)}:{qids,ans:{},flag:new Set(),lock:{},i:0,t0:Date.now(),qt0:Date.now()};
 Object.assign(run,{id,key,mode:base,title:t.data.title+(part&&!err?` · вопросы ${(part-1)*SZ+1}–${Math.min(part*SZ,n)}`:'')+(!err&&qs.length<pool.length?` · ${qs.length} из ${pool.length}`:''),qs,done:false});rdr()}
const persist=()=>{try{const r=run;localStorage.setItem(r.key,JSON.stringify({qids:r.qids,ans:r.ans,flag:[...r.flag],lock:r.lock,i:r.i,t0:r.t0,qt0:r.qt0,nx:r.nx,dl:r.dl,mock:r.mode==='mock'?1:0}))}catch(e){}};
function rdr(){run.mode==='train'?rdrTrain():rdrExam()}
function rdrExam(){
 const r=run,q=r.qs[r.i],n=r.qs.length,done=Object.keys(r.ans).length;
 $('#main').innerHTML=`<div class="runhead"><div><h1>${esc(r.title)}</h1></div><div class="grp"><span class="pill big" id="tm">00:00:00</span><button class="btn" id="fin">Завершить</button></div></div><div class="bar"><i style="width:${done/n*100}%"></i></div><small>Отвечено ${done} из ${n} · ${Math.round(done/n*100)}%</small>
 <div class="runbox"><div class="card pal">${r.qs.map((_,k)=>`<button class="pn ${k===r.i?'cur':''} ${r.ans[k]!==undefined?'ok':''} ${r.flag.has(k)?'fl':''}" data-g="${k}">${k+1}</button>`).join('')}</div>
 <div class="card"><small>Вопрос ${r.i+1} из ${n}</small><h3>${esc(q.text)}</h3>${q.options.map((o,j)=>`<button class="ans ${r.ans[r.i]===j?'sel':''}" data-a="${j}"><b>${LET[j]}</b>${esc(o)}</button>`).join('')}<div class="row"><button class="btn ghost" data-nav="-1" ${r.i?'':'disabled'}>← Назад</button><button class="btn ghost" data-fl="1">${r.flag.has(r.i)?'★ Снять отметку':'☆ Отметить'}</button><button class="btn" data-nav="1" ${r.i<n-1?'':'disabled'}>Далее →</button></div></div></div>`;
 const tick=()=>{const e=$('#tm');if(r.mode==='mock'){const z=(r.dl-Date.now())/1000;if(e){e.textContent='⏱ '+fmt(Math.max(0,z));e.style.color=z<300?'#dc2626':''}if(z<=0&&!r.done)finish(true);return}if(e)e.textContent=fmt((Date.now()-r.t0)/1000)};tick();clearInterval(timer);timer=setInterval(tick,1000);
 $('#main').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.a!==undefined)r.ans[r.i]=+d.a;else if(d.g!==undefined)r.i=+d.g;else if(d.nav)r.i+=+d.nav;else if(d.fl)r.flag.has(r.i)?r.flag.delete(r.i):r.flag.add(r.i);else if(b.id==='fin')return finish();else return;persist();rdr()}}
async function finish(silent){
 const r=run;if(!r||r.done)return;const n=r.qs.length,done=Object.keys(r.ans).length;if(!silent&&done<n&&!await ask(`Вы ответили на ${done} из ${n}. Завершить тест?`))return;
 r.done=true;clearInterval(timer);
 const ok=r.qs.map((q,k)=>r.ans[k]===q.correct),c=ok.filter(Boolean).length;
 const {data,error}=await sb.from('attempts').insert({test_id:r.id||null,title:r.title,mode:r.mode,qids:r.qids,answers:r.ans,correct_count:c,total:n,percent:Math.round(c/n*100),seconds:Math.round((Math.min(Date.now(),r.mode==='mock'?r.dl:Infinity)-r.t0)/1000)}).select().single();
 if(error){r.done=false;if(r.mode==='train'){r.nx=Date.now()+5000;timer=setInterval(()=>{if(Date.now()>=r.nx){clearInterval(timer);finish(true)}},1000)}return toast('Не удалось сохранить результат: '+error.message)}
 const {data:ex}=await(r.id?sb.from('mistakes').select('question_id,status,wrong_count').eq('test_id',r.id):sb.from('mistakes').select('question_id,status,wrong_count').in('question_id',r.qids)),E=Object.fromEntries((ex||[]).map(x=>[x.question_id,x])),now=new Date().toISOString();
 const rows=r.qs.flatMap((q,k)=>{const e=E[q.id],b={user_id:user.id,test_id:q.test_id,question_id:q.id,updated_at:now};
  if(!ok[k])return[{...b,status:'open',wrong_count:(e?e.wrong_count:0)+1}];
  return e&&e.status==='open'?[{...b,status:'fixed',wrong_count:e.wrong_count}]:[]});
 if(rows.length){const m=await sb.from('mistakes').upsert(rows,{onConflict:'user_id,question_id'});if(m.error)toast('Ошибки не сохранились: '+m.error.message)}
 try{localStorage.removeItem(r.key)}catch(e){}run=null;location.hash='#result/'+data.id}
async function vResult(id){
 const {data:a,error}=await sb.from('attempts').select('*,tests(title)').eq('id',id).single();if(error)throw error;
 let {data:qs}=a.test_id?await getQs(a.test_id):{data:await getQsByIds(a.qids)};
 if(a.qids&&a.test_id){const M=Object.fromEntries(qs.map(q=>[q.id,q]));qs=a.qids.map(i=>M[i]||{text:'(вопрос удалён)',options:['—'],correct:0})}
 $('#main').innerHTML=`<h1>${esc(a.tests?a.tests.title:(a.title||'Пробный экзамен'))}</h1><small>${a.mode==='train'?'Режим: тренировка':a.mode==='mock'?'Режим: пробный экзамен':'Режим: экзамен'}</small><div class="grid4"><div class="card stat"><small>Результат</small><b>${a.percent}%</b></div><div class="card stat"><small>Правильно</small><b class="g">${a.correct_count}</b></div><div class="card stat"><small>Неправильно / пропущено</small><b class="r">${a.total-a.correct_count}</b></div><div class="card stat"><small>Время</small><b>${fmt(a.seconds)}</b></div></div><div class="row"><a class="btn" href="${a.test_id?'#run/'+a.test_id:'#mock'}">${a.test_id?'Пройти повторно':'Новый пробный экзамен'}</a>${a.correct_count<a.total?`<a class="btn" href="#errors">Работа над ошибками</a>`:''}<a class="btn ghost" href="#results">Все результаты</a></div>${qs.map((q,k)=>{const y=a.answers[k];return `<div class="card q ${y===q.correct?'good':'bad'}"><b>${k+1}. ${esc(q.text)}</b><small>Ваш ответ: ${y===undefined?'нет ответа':LET[y]+') '+esc(q.options[y])}</small>${y===q.correct?'':`<small>Правильный: ${LET[q.correct]}) ${esc(q.options[q.correct])}</small>`}</div>`}).join('')}`}
const tabs=a=>`<div class="row" style="justify-content:flex-start"><a class="btn ${a==='r'?'':'ghost'}" href="#results">Результаты</a><a class="btn ${a==='e'?'':'ghost'}" href="#errors">Работа над ошибками</a></div>`;
async function vErrors(){
 const {data,error}=await sb.from('mistakes').select('*,questions(text,options,correct),tests(title)').order('updated_at',{ascending:false});if(error)throw error;
 const G={};for(const x of data){const g=G[x.test_id]=G[x.test_id]||{t:x.tests?.title,o:[],f:0};if(x.status==='open')g.o.push(x);else g.f++}
 $('#main').innerHTML=`<h1>Результаты тестов</h1>${tabs('e')}${Object.entries(G).map(([i,g])=>`<div class="card"><div class="row"><div><b>${esc(g.t)}</b><small>Ошибок: ${g.o.length} · Исправлено: ${g.f}</small></div>${g.o.length?`<a class="btn" href="#run/${i}/e">Повторить ошибки</a>`:''}</div>${g.o.map(x=>`<div class="item"><div>${esc(x.questions.text)}<small>Правильный ответ: ${LET[x.questions.correct]}) ${esc(x.questions.options[x.questions.correct])} · ошибок: ${x.wrong_count}</small></div></div>`).join('')}</div>`).join('')||'<div class="card"><p class="mut">Ошибок пока нет. Неправильные и пропущенные вопросы появятся здесь после прохождения теста.</p></div>'}`}
async function vResults(){
 const {data,error}=await sb.from('attempts').select('*,tests(title)').order('created_at',{ascending:false});if(error)throw error;
 $('#main').innerHTML=`<h1>Результаты тестов</h1>${tabs('r')}<div class="card">${data.map(x=>`<div class="item"><div><b>${esc(x.tests?.title||x.title||'Пробный экзамен')}</b><small>${dt(x.created_at)} · ${x.mode==='train'?'тренировка':x.mode==='mock'?'пробный экзамен':'экзамен'} · ${fmt(x.seconds)} · ${x.correct_count}/${x.total}</small></div><span class="pill ${x.percent>=75?'okp':'wp'}">${x.percent}%</span><a class="btn ghost" href="#result/${x.id}">Просмотр</a></div>`).join('')||'<p class="mut">Результатов пока нет.</p>'}</div>`}
async function vProfile(){
 const m=user.user_metadata||{},{data}=await sb.from('attempts').select('percent,seconds'),n=data?.length||0;
 $('#main').innerHTML=`<h1>Профиль</h1><div class="card"><div class="av">${esc((m.full_name||user.email)[0].toUpperCase())}</div><input id="n" placeholder="Имя и фамилия" value="${esc(m.full_name)}"><input id="g" placeholder="Группа" value="${esc(m.group)}"><small>${esc(user.email)}</small><div class="row"><button class="btn" id="sv">Сохранить</button><button class="btn ghost" id="lo">Выйти</button></div></div><div class="card"><div class="row"><div><b>Тёмная тема</b><small>Удобнее читать ночью</small></div><button class="btn ghost" id="th"></button></div></div><div class="card"><b>Общая статистика</b><p>Пройдено тестов: ${n} · Средний результат: ${n?Math.round(data.reduce((s,x)=>s+x.percent,0)/n):0}% · Время: ${fmt(data.reduce((s,x)=>s+x.seconds,0))}</p></div>`;
 $('#lo').onclick=()=>sb.auth.signOut();
 const th=$('#th'),paint=()=>th.textContent=document.documentElement.dataset.theme==='dark'?'☀️ Светлая':'🌙 Тёмная';paint();th.onclick=()=>{const d=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=d;try{localStorage.gos_theme=d}catch(e){}paint()};
 $('#sv').onclick=async()=>{const r=await sb.auth.updateUser({data:{full_name:$('#n').value.trim(),group:$('#g').value.trim()}});if(r.error)toast(r.error.message);else{user=r.data.user;toast('Сохранено')}}}
document.head.insertAdjacentHTML('beforeend','<style>.modes{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tmr.low{background:#fee2e2;color:#dc2626}@media(max-width:700px){.modes{grid-template-columns:1fr}}</style>');
function pickMode(id,title,err,nOpen,c){
 const sf=err?'-e':'',p=!err&&c&&(c.sel||c.cnt)?'@'+c.sel+(c.cnt?'~'+c.cnt:''):'',more=!err&&nOpen?`<a class="btn ghost" href="#run/${id}/e">Повторить ошибки (${nOpen})</a>`:'';
 const cs=!err&&c&&c.ps>10?`<p class="mut">Сколько вопросов пройти:</p><div class="row" style="justify-content:flex-start">${[10,20,50,100,200].filter(x=>x<c.ps).map(x=>`<a class="btn ${c.cnt===x?'':'ghost'}" href="#run/${id}/@${c.sel}~${x}">${x}</a>`).join('')}<a class="btn ${c.cnt?'ghost':''}" href="#run/${id}/@${c.sel}">Все (${c.ps})</a></div>`:'';
 const chips=!err&&c&&c.blocks>1?`<p class="mut">Тест большой (${c.n} вопросов). Выберите часть:</p><div class="row" style="justify-content:flex-start">${Array.from({length:c.blocks},(_,i)=>`<a class="btn ${c.sel===i+1?'':'ghost'}" href="#run/${id}/@${i+1}">${i*SZ+1}–${Math.min((i+1)*SZ,c.n)}${c.done[i]?' ✓':''}</a>`).join('')}<a class="btn ${c.sel===0?'':'ghost'}" href="#run/${id}/@0">Весь тест</a></div>`:'';
 $('#main').innerHTML=`<h1>${esc(title)}</h1>${chips}${cs}<p class="mut">${err?'Повтор ошибок: '+nOpen+'. ':''}Выберите режим прохождения</p><div class="modes"><div class="card"><h3>📝 Экзамен</h3><p>Правильные ответы не показываются до конца теста. Времени не ограничено. Можно возвращаться к вопросам, менять ответы и отмечать вопросы.</p><a class="btn" href="#run/${id}/exam${err?sf:p}">Начать экзамен</a></div><div class="card"><h3>🎯 Тренировка</h3><p>После ответа сразу видно результат: зелёный — верно, красный — ошибка. На каждый вопрос 60 секунд. Пропустить вопрос и вернуться назад нельзя.</p><a class="btn" href="#run/${id}/train${err?sf:p}">Начать тренировку</a></div></div>${more}`}
function adv(){const r=run;if(!r||r.done)return;clearInterval(timer);if(r.i<r.qs.length-1){r.i++;r.qt0=Date.now();persist();rdr()}else finish(true)}
function lockQ(v){const r=run,q=r.qs[r.i];if(r.lock[r.i])return;r.lock[r.i]=v;r.nx=Date.now()+(q.explanation?4500:2200);persist();rdr()}
function rdrTrain(){
 const r=run,q=r.qs[r.i],n=r.qs.length,lk=r.lock[r.i];
 const cls=j=>!lk?'':j===q.correct?'right':j===r.ans[r.i]?'wrongo':'';
 const msg=lk==='t'?'⏱ Время вышло. ':r.ans[r.i]===q.correct?'✅ Верно. ':'❌ Неверно. ';
 $('#main').innerHTML=`<div class="runhead"><div><h1>${esc(r.title)}</h1><small>Тренировка</small></div><span class="pill big tmr" id="tm">60</span></div><div class="bar"><i style="width:${(r.i+(lk?1:0))/n*100}%"></i></div><small>Вопрос ${r.i+1} из ${n}</small><div class="card"><h3>${esc(q.text)}</h3>${q.options.map((o,j)=>`<button class="ans ${cls(j)}" data-a="${j}" ${lk?'disabled':''}><b>${LET[j]}</b>${esc(o)}</button>`).join('')}${lk?`<p>${msg}Правильный ответ: <b>${LET[q.correct]}) ${esc(q.options[q.correct])}</b></p>${q.explanation?`<small>${esc(q.explanation)}</small>`:''}`:''}</div>`;
 clearInterval(timer);
 const tick=()=>{if(run!==r||r.done)return;if(r.lock[r.i]){if(Date.now()>=r.nx)adv();return}const s=Math.max(0,Math.ceil((60000-(Date.now()-r.qt0))/1000)),e=$('#tm');if(e){e.textContent=s;e.classList.toggle('low',s<=10)}if(s<=0)lockQ('t')};
 timer=setInterval(tick,250);tick();
 $('#main').onclick=e=>{const b=e.target.closest('[data-a]');if(b&&!r.lock[r.i]){r.ans[r.i]=+b.dataset.a;lockQ('a')}}}

boot();
