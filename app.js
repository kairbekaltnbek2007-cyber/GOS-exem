const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LET=['А','В','С','Д','Е'],fmt=s=>[s/3600|0,(s%3600)/60|0,Math.round(s)%60].map(n=>String(n).padStart(2,'0')).join(':'),dt=d=>new Date(d).toLocaleDateString('ru-RU');
const app=$('#app');let sb,user,draft,run,timer;
const toast=m=>{const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3500)};
const ask=m=>new Promise(r=>{const w=document.createElement('div');w.className='modal';w.innerHTML=`<div class="box card"><p>${esc(m)}</p><div class="row"><button class="btn ghost" data-v="0">Отмена</button><button class="btn" data-v="1">Да</button></div></div>`;w.onclick=e=>{const v=e.target.dataset.v;if(v!==undefined){w.remove();r(v==='1')}};document.body.append(w)});
const NAV=[['home','🏠','Главная'],['tests','📚','Тесты'],['upload','📤','Загрузить тест'],['results','📊','Мои результаты'],['profile','👤','Профиль']];
async function boot(){
 if(!window.CFG||CFG.url.startsWith('ВСТАВ')){app.innerHTML='<div class="auth card"><h2>Нужно подключить Supabase</h2><p>Вставьте адрес и ключ проекта в файл config.js.</p></div>';return}
 sb=supabase.createClient(CFG.url,CFG.key);
 user=(await sb.auth.getSession()).data.session?.user||null;
 sb.auth.onAuthStateChange((_e,s)=>{const u=s?.user||null;if((u&&u.id)!==(user&&user.id)){user=u;route()}});
 addEventListener('hashchange',route);route()}
async function route(){
 clearInterval(timer);if(!user)return authView(false);
 const [p,id]=(location.hash.slice(1)||'home').split('/');
 const V={home:vHome,tests:vTests,upload:draw,results:vResults,profile:vProfile,run:vRun,result:vResult};
 shell(p);try{await(V[p]||vHome)(id)}catch(e){$('#main').innerHTML=`<div class="card err">Ошибка: ${esc(e.message)}</div>`}}
function shell(p){const a={run:'tests',result:'results'}[p]||p;
 app.innerHTML=`<aside><div class="logo">🩺 <b>ГОС экзамен</b></div><nav>${NAV.map(([h,i,t])=>`<a href="#${h}" class="${h===a?'on':''}"><span>${i}</span><em>${t}</em></a>`).join('')}</nav><a id="out"><span>⎋</span><em>Выйти</em></a></aside><main id="main"></main>`;
 $('#out').onclick=()=>sb.auth.signOut()}
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
 $('#main').innerHTML=`<h1>Тесты</h1><div class="card">${data.map(t=>`<div class="item"><div><b>${esc(t.title)}</b><small>${t.questions[0].count} вопросов · ${dt(t.created_at)}</small></div><a class="btn" href="#run/${t.id}">Пройти</a><button class="btn ghost" data-edit="${t.id}">Править</button><button class="btn ghost" data-del="${t.id}">Удалить</button></div>`).join('')||'<p class="mut">Тестов пока нет. <a href="#upload">Загрузить тест</a></p>'}</div>`;
 $('#main').onclick=async e=>{const d=e.target.dataset;
  if(d.del&&await ask('Удалить тест вместе с результатами?')){const r=await sb.from('tests').delete().eq('id',d.del);if(r.error)toast(r.error.message);vTests()}
  if(d.edit){const [t,q]=await Promise.all([sb.from('tests').select('title').eq('id',d.edit).single(),sb.from('questions').select('*').eq('test_id',d.edit).order('pos')]);
   draft={id:d.edit,title:t.data.title,qs:q.data.map(x=>({text:x.text,options:x.options,correct:x.correct,issues:[]}))};location.hash='#upload'}}}
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
 m.innerHTML=`<h1>${draft.id?'Редактирование теста':'Предварительный просмотр'}</h1><div class="card"><input id="ttl" placeholder="Название теста" value="${esc(draft.title)}"><small>Вопросов: ${draft.qs.length}. Проверьте текст и отметьте правильный ответ. Вопросы с проблемами подсвечены.</small></div>${draft.qs.map((q,i)=>`<div class="card q ${bad(q)?'bad':''}"><div class="row"><b>Вопрос ${i+1}</b><button class="btn ghost" data-rm="${i}">Удалить</button></div>${q.issues.map(x=>`<small class="err">⚠ ${esc(x)}</small>`).join('')}<textarea data-i="${i}" data-k="t">${esc(q.text)}</textarea>${q.options.map((x,j)=>`<div class="opt"><input type="radio" name="c${i}" data-i="${i}" data-k="c" data-j="${j}" ${q.correct===j?'checked':''}><b>${LET[j]}</b><input data-i="${i}" data-k="o" data-j="${j}" value="${esc(x)}"></div>`).join('')}</div>`).join('')}<div class="row"><button class="btn ghost" id="add">+ Вопрос</button><button class="btn ghost" id="cx">Отмена</button><button class="btn" id="sv">Сохранить тест</button></div><p id="msg" class="err"></p>`;
 m.oninput=e=>{const d=e.target.dataset;if(e.target.id==='ttl')draft.title=e.target.value;else if(d.k==='t')draft.qs[d.i].text=e.target.value;else if(d.k==='o')draft.qs[d.i].options[d.j]=e.target.value};
 m.onchange=e=>{const d=e.target.dataset;if(d.k==='c')draft.qs[d.i].correct=+d.j};
 m.onclick=e=>{const t=e.target;if(t.dataset.rm!==undefined){draft.qs.splice(t.dataset.rm,1);draw()}else if(t.id==='add'){draft.qs.push(blank());draw()}else if(t.id==='cx'){draft=null;drop()}else if(t.id==='sv')save()}}
async function save(){
 const msg=$('#msg'),t=draft.title.trim();if(!t)return msg.textContent='Введите название теста';
 const i=draft.qs.findIndex(bad);if(i>=0)return msg.textContent=`Вопрос ${i+1}: нужен текст, минимум 2 варианта без пропусков и отмеченный правильный ответ`;
 try{let id=draft.id,r;
  if(id){r=await sb.from('tests').update({title:t}).eq('id',id);if(r.error)throw r.error;r=await sb.from('questions').delete().eq('test_id',id);if(r.error)throw r.error}
  else{r=await sb.from('tests').insert({title:t}).select().single();if(r.error)throw r.error;id=r.data.id}
  r=await sb.from('questions').insert(draft.qs.map((q,p)=>({test_id:id,pos:p,text:q.text.trim(),options:opts(q),correct:q.correct})));if(r.error)throw r.error;
  draft=null;toast('Тест сохранён');location.hash='#tests'}catch(e){msg.textContent='Не удалось сохранить: '+e.message}}
async function vRun(id){
 const [t,q]=await Promise.all([sb.from('tests').select('title').eq('id',id).single(),sb.from('questions').select('*').eq('test_id',id).order('pos')]);
 if(t.error||q.error)throw(t.error||q.error);if(!q.data.length)throw Error('В тесте нет вопросов');
 run={id,title:t.data.title,qs:q.data,ans:{},flag:new Set(),i:0,t0:Date.now()};rdr()}
function rdr(){
 const r=run,q=r.qs[r.i],n=r.qs.length,done=Object.keys(r.ans).length;
 $('#main').innerHTML=`<div class="row"><div><h1>${esc(r.title)}</h1></div><div class="row"><span class="pill big" id="tm">00:00:00</span><button class="btn" id="fin">Завершить</button></div></div><div class="bar"><i style="width:${done/n*100}%"></i></div><small>Отвечено ${done} из ${n} · ${Math.round(done/n*100)}%</small>
 <div class="runbox"><div class="card pal">${r.qs.map((_,k)=>`<button class="pn ${k===r.i?'cur':''} ${r.ans[k]!==undefined?'ok':''} ${r.flag.has(k)?'fl':''}" data-g="${k}">${k+1}</button>`).join('')}</div>
 <div class="card"><small>Вопрос ${r.i+1} из ${n}</small><h3>${esc(q.text)}</h3>${q.options.map((o,j)=>`<button class="ans ${r.ans[r.i]===j?'sel':''}" data-a="${j}"><b>${LET[j]}</b>${esc(o)}</button>`).join('')}<div class="row"><button class="btn ghost" data-nav="-1" ${r.i?'':'disabled'}>← Назад</button><button class="btn ghost" data-fl="1">${r.flag.has(r.i)?'★ Снять отметку':'☆ Отметить'}</button><button class="btn" data-nav="1" ${r.i<n-1?'':'disabled'}>Далее →</button></div></div></div>`;
 const tick=()=>{const e=$('#tm');if(e)e.textContent=fmt((Date.now()-r.t0)/1000)};tick();clearInterval(timer);timer=setInterval(tick,1000);
 $('#main').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.a!==undefined)r.ans[r.i]=+d.a;else if(d.g!==undefined)r.i=+d.g;else if(d.nav)r.i+=+d.nav;else if(d.fl)r.flag.has(r.i)?r.flag.delete(r.i):r.flag.add(r.i);else if(b.id==='fin')return finish();else return;rdr()}}
async function finish(){
 const r=run,n=r.qs.length,done=Object.keys(r.ans).length;if(done<n&&!await ask(`Вы ответили на ${done} из ${n}. Завершить тест?`))return;
 const c=r.qs.filter((q,k)=>r.ans[k]===q.correct).length;
 const {data,error}=await sb.from('attempts').insert({test_id:r.id,answers:r.ans,correct_count:c,total:n,percent:Math.round(c/n*100),seconds:Math.round((Date.now()-r.t0)/1000)}).select().single();
 if(error)return toast('Не удалось сохранить результат: '+error.message);clearInterval(timer);run=null;location.hash='#result/'+data.id}
async function vResult(id){
 const {data:a,error}=await sb.from('attempts').select('*,tests(title)').eq('id',id).single();if(error)throw error;
 const {data:qs}=await sb.from('questions').select('*').eq('test_id',a.test_id).order('pos');
 $('#main').innerHTML=`<h1>${esc(a.tests.title)}</h1><div class="grid4"><div class="card stat"><small>Результат</small><b>${a.percent}%</b></div><div class="card stat"><small>Правильно</small><b class="g">${a.correct_count}</b></div><div class="card stat"><small>Неправильно / пропущено</small><b class="r">${a.total-a.correct_count}</b></div><div class="card stat"><small>Время</small><b>${fmt(a.seconds)}</b></div></div><div class="row"><a class="btn" href="#run/${a.test_id}">Пройти повторно</a><a class="btn ghost" href="#results">Все результаты</a></div>${qs.map((q,k)=>{const y=a.answers[k];return `<div class="card q ${y===q.correct?'good':'bad'}"><b>${k+1}. ${esc(q.text)}</b><small>Ваш ответ: ${y===undefined?'нет ответа':LET[y]+') '+esc(q.options[y])}</small>${y===q.correct?'':`<small>Правильный: ${LET[q.correct]}) ${esc(q.options[q.correct])}</small>`}</div>`}).join('')}`}
async function vResults(){
 const {data,error}=await sb.from('attempts').select('*,tests(title)').order('created_at',{ascending:false});if(error)throw error;
 $('#main').innerHTML=`<h1>Результаты тестов</h1><div class="card">${data.map(x=>`<div class="item"><div><b>${esc(x.tests?.title)}</b><small>${dt(x.created_at)} · ${fmt(x.seconds)} · ${x.correct_count}/${x.total}</small></div><span class="pill ${x.percent>=75?'okp':'wp'}">${x.percent}%</span><a class="btn ghost" href="#result/${x.id}">Просмотр</a></div>`).join('')||'<p class="mut">Результатов пока нет.</p>'}</div>`}
async function vProfile(){
 const m=user.user_metadata||{},{data}=await sb.from('attempts').select('percent,seconds'),n=data?.length||0;
 $('#main').innerHTML=`<h1>Профиль</h1><div class="card"><div class="av">${esc((m.full_name||user.email)[0].toUpperCase())}</div><input id="n" placeholder="Имя и фамилия" value="${esc(m.full_name)}"><input id="g" placeholder="Группа" value="${esc(m.group)}"><small>${esc(user.email)}</small><div class="row"><button class="btn" id="sv">Сохранить</button></div></div><div class="card"><b>Общая статистика</b><p>Пройдено тестов: ${n} · Средний результат: ${n?Math.round(data.reduce((s,x)=>s+x.percent,0)/n):0}% · Время: ${fmt(data.reduce((s,x)=>s+x.seconds,0))}</p></div>`;
 $('#sv').onclick=async()=>{const r=await sb.auth.updateUser({data:{full_name:$('#n').value.trim(),group:$('#g').value.trim()}});if(r.error)toast(r.error.message);else{user=r.data.user;toast('Сохранено')}}}
boot();
