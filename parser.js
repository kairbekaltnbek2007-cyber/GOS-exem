(function(root){
const POS=['A\u0410','B\u0412\u0411','C\u0421\u0412','D\u0414\u0413','E\u0415\u0414'],
L='[A-Ea-e\u0410-\u0415\u0430-\u0435\u0421\u0441]',
OPT=new RegExp('^\\s*('+L+')\\s*[.)]\\s*(.*)$'),
NUM=/^\s*(\d{1,4})\s*[.)]\s+(.+)$/,
ANS=new RegExp('^\\s*(?:правильный ответ|дұрыс жауап|ответ|жауап|answer|correct|ключ)\\s*[:=\\-\u2013]\\s*('+L+')\\s*[.)]?\\s*$','i'),
KEYH=/^\s*(ответы|ключи?|answers?|keys?|жауаптар|кілт)\s*:?\s*$/i,
KEYP='(\\d+)\\s*[.\\-\u2013:)]?\\s*('+L+')(?![A-Za-z\u0400-\u04FF])';
const nz=c=>({'\u0410':'A','\u0412':'B','\u0421':'C','\u0415':'E'})[c]||c;
function parse(lines){
 const flat=lines.map(l=>(l.t||'').trim()).filter(Boolean);
 if(flat.length>=6&&flat.length%6===0&&flat.filter(t=>OPT.test(t)).length<flat.length*.1){
  const out=[];
  for(let g=0;g<flat.length;g+=6){
   const stars=[],opts=flat.slice(g+1,g+6).map((t,j)=>{if(/^[*+]|\*$/.test(t))stars.push(j);return t.replace(/^[*+]\s*|\s*\*$/g,'')});
   const c=stars.length===1?stars[0]:null,issues=[];
   if(c===null)issues.push(stars.length?'Отмечено несколько правильных ответов — оставьте один':'Правильный ответ не найден — отметьте его вручную');
   out.push({text:flat[g].replace(/^\d{1,4}\s*[.)]\s+/,''),options:opts,correct:c,issues})}
  return out}
 const qs=[];let cur=null,inKey=false;const keys={};
 const mk=t=>({text:t,options:[],marks:[],stars:[],bold:[]});
 for(const ln of lines){
  const t=(ln.t||'').trim();if(!t)continue;let m;
  if(KEYH.test(t)){inKey=true;continue}
  if(inKey){const re=new RegExp(KEYP,'g');while((m=re.exec(t)))keys[+m[1]]=m[2];continue}
  if(cur&&(m=t.match(ANS))){cur.key=m[1];continue}
  if(cur&&cur.options.length<5&&(cur.text||cur.options.length)&&(m=t.match(OPT))&&POS[cur.options.length].includes(m[1].toUpperCase())){
   let o=m[2].trim();const star=/^[*+]|\*$/.test(o);o=o.replace(/^[*+]\s*|\s*\*$/g,'');
   cur.options.push(o);cur.marks.push(m[1].toUpperCase());if(star)cur.stars.push(cur.options.length-1);cur.bold.push(!!ln.b);continue}
  if((m=t.match(NUM))){cur=mk(m[2].trim());cur.num=+m[1];qs.push(cur);continue}
  if(!cur||cur.options.length===5){cur=mk(t);qs.push(cur);continue}
  if(cur.options.length)cur.options[cur.options.length-1]+=' '+t;else cur.text+=' '+t;
 }
 return qs.map((q,i)=>{
  const idx=k=>{k=k.toUpperCase();let j=q.marks.map(nz).indexOf(nz(k));if(j<0)j='ABCDE'.indexOf(nz(k));if(j<0)j=({'\u0414':3,'\u0411':1,'\u0413':3})[k]??-1;return j<q.options.length?j:-1};
  let c=null;const bi=q.bold.map((b,j)=>b?j:-1).filter(j=>j>=0);
  if(q.key)c=idx(q.key);
  else if(q.stars.length===1)c=q.stars[0];
  else{const k=keys[q.num||i+1];if(k)c=idx(k);else if(bi.length===1&&q.options.length>1)c=bi[0]}
  if(c<0)c=null;
  const issues=[];
  if(c===null)issues.push('Правильный ответ не найден — отметьте его вручную');
  if(q.options.length!==5)issues.push('Вариантов: '+q.options.length+' (ожидалось 5)');
  if(!q.text)issues.push('Нет текста вопроса');
  return{text:q.text,options:q.options,correct:c,issues};
 });
}
async function fileLines(f){
 const n=f.name.toLowerCase();
 if(n.endsWith('.txt')){const b=await f.arrayBuffer();let s;try{s=new TextDecoder('utf-8',{fatal:true}).decode(b)}catch(e){s=new TextDecoder('windows-1251').decode(b)}return s.split(/\r?\n/).map(t=>({t}))}
 if(n.endsWith('.docx')){
  const r=await mammoth.convertToHtml({arrayBuffer:await f.arrayBuffer()},{styleMap:['u => u']});
  const d=new DOMParser().parseFromString(r.value,'text/html'),out=[];
  d.querySelectorAll('p,li').forEach(p=>{p.querySelectorAll('br').forEach(b=>b.replaceWith('\n'));
   const t=p.textContent,len=t.trim().length,bt=[...p.querySelectorAll('strong,u')].reduce((a,e)=>a+e.textContent.length,0);
   t.split('\n').forEach(x=>out.push({t:x,b:len>3&&bt>=len*.6}))});
  return out}
 if(n.endsWith('.pdf')){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise,out=[];
  for(let p=1;p<=pdf.numPages;p++){const c=await(await pdf.getPage(p)).getTextContent(),rows={};
   c.items.forEach(i=>{const y=Math.round(i.transform[5]/3);(rows[y]=rows[y]||[]).push(i)});
   Object.keys(rows).map(Number).sort((a,b)=>b-a).forEach(y=>out.push({t:rows[y].sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' ')}))}
  return out}
 throw Error('Поддерживаются только DOCX, TXT и PDF');
}
root.Parser={parse,fileLines};if(typeof module!=='undefined')module.exports=root.Parser;
})(typeof window!=='undefined'?window:globalThis);
