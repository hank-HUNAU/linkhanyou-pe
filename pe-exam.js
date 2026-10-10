/* ============================================================
 * MTPE 模拟考场 · 逻辑 v2
 * 依据真实界面截图（第四届翻译技术大赛决赛 / 第九届官方模拟赛）校准：
 * - 右侧栏：题目面板 + 上一题/下一题 + 保存&退出 / 交卷
 * - 两种作答模式：第九届模式（默认，无 AI、Agent 同榜）与轻度译后编辑
 * - 工具栏按第九届官方模拟赛实拍对齐：复制原文/清除译文、B I U Aa、S x² x₃ ¶、
 *   清除样式、查找替换、拼写检查、特殊字符（不再有格式刷/溶解样式）
 * - 2026-10-10 瘦身：下线深度模式 / AI 助手拟真（与"第九届全程无 AI"矛盾）与右侧图标栏
 * ============================================================ */
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const store = {
 get(k,d){ try{const v=localStorage.getItem('ycx_'+k);return v===null?d:JSON.parse(v);}catch(e){return d;} },
 set(k,v){ localStorage.setItem('ycx_'+k, JSON.stringify(v)); },
 del(k){ localStorage.removeItem('ycx_'+k); }
};
function toast(m){ const t=$('#toast'); if(!t)return; t.textContent=m; t.style.opacity='1'; clearTimeout(t._m); t._m=setTimeout(()=>t.style.opacity='0',2000); }
function fmt(s){ const m=Math.floor(s/60),x=s%60; return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0'); }

/* ---- 词级 diff / TER（与主平台一致） ---- */
function tokenize(s){ return (s.match(/[\u4e00-\u9fff]|[A-Za-z]+(?:'[a-z]+)?|\d+(?:\.\d+)?%?|[^\s]/g)||[]); }
function diffTokens(a,b){
 const n=a.length,m=b.length;
 const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
 const ops=[];let i=0,j=0;
 while(i<n&&j<m){ if(a[i]===b[j]){ops.push({op:'same',t:a[i]});i++;j++;} else if(dp[i+1][j]>=dp[i][j+1]){ops.push({op:'del',t:a[i]});i++;} else {ops.push({op:'ins',t:b[j]});j++;} }
 while(i<n)ops.push({op:'del',t:a[i++]});
 while(j<m)ops.push({op:'ins',t:b[j++]});
 return ops;
}
function revisionRate(mt,pe){ const A=tokenize(mt),B=tokenize(pe); if(!A.length&&!B.length)return 0;
 const e=diffTokens(A,B).filter(o=>o.op!=='same').length; return A.length?e/A.length:1; }
function similarity(pe,ref){ const A=tokenize(pe),B=tokenize(ref); if(!A.length&&!B.length)return 100; if(!A.length||!B.length)return 0;
 const e=diffTokens(A,B).filter(o=>o.op!=='same').length; return Math.max(0,Math.round((1-e/Math.max(A.length,B.length))*1000)/10); }
/* 考场口径：TER(答案,参考) —— 与训练效果模拟/校准基准同口径（K=1.2，晋级线84） */
const TER_K = 1.2, PASS_LINE = 84;
function terRef(pe,ref){ const A=tokenize(pe),B=tokenize(ref); if(!B.length)return 0; if(!A.length)return 1;
 const e=diffTokens(A,B).filter(o=>o.op!=='same').length; return e/B.length; }
function examScore(pe,ref){ return Math.max(0, 100 - terRef(pe,ref)*100*TER_K); }

/* ---- 全局状态 ---- */
let S=null; // {task, minutes, peMode, answers[], cur, startTs, duration, switches, enters}

/* 第九届赛制：Agent 选手成绩（拟真，交卷后同榜） */
const AGENT_BOARD = {
 t1: [['Agent·旗舰A', 91.4], ['Agent·旗舰B', 89.7], ['Agent·旗舰C', 87.8]],
 t2: [['Agent·旗舰A', 92.1], ['Agent·旗舰B', 88.9], ['Agent·旗舰C', 86.5]],
 t3: [['Agent·旗舰A', 90.6], ['Agent·旗舰B', 88.2], ['Agent·旗舰C', 85.7]],
 t4: [['Agent·旗舰A', 93.0], ['Agent·旗舰B', 90.4], ['Agent·旗舰C', 88.6]]
};
const AGENT_DEFAULT = [['Agent·旗舰A', 90.0], ['Agent·旗舰B', 88.0], ['Agent·旗舰C', 86.0]];
function modeName(m){ return m==='agent'?'第九届·Agent同榜':'轻度'; }
/* 按语言方向给出列头语言代码（对齐真实界面的"请输入原文（en-US）"） */
function langOf(pair){ return /中译英|汉译英|中译外|汉译外/.test(pair || '') ? ['zh-CN', 'en-US'] : ['en-US', 'zh-CN']; }

/* ============ 考试广场（精简版：只保留与考试直接相关的元素） ============ */
function renderExams(){
 document.body.className='';
 document.body.innerHTML = `
 <div class="yc-top">
 <div class="yc-brand"><span class="yc-logo">译</span>MTPE 模拟考场 <span class="en">译后编辑模拟考试</span></div>
 <div class="yc-top-right"><a class="mi" href="index.html" style="text-decoration:none">返回首页</a></div>
 </div>
 <div class="wrap">
 <div class="page-t">考试广场</div>
 <div class="page-s">教学模拟工具：界面按第九届赛制还原，试题内容与正式考试无关。</div>
 ${TASKS.map(t=>{
 const draft=store.get('draft_'+t.id,null);
 const enters=store.get('enters_'+t.id,0);
 const real = ![8,15,30].includes(t.minutes);
 return `
 <div class="exam-card-v3">
 <div class="mtpe-logo"><span class="big">MTPE</span><span class="sm">${t.corpus?'历届真题':'模拟考试'}</span></div>
 <div class="ec-v3-body">
 <h3>${esc(t.name)} <span class="tag blue">${esc(t.pair)}</span>${t.corpus?'<span class="tag-fee">真题</span>':''}</h3>
 <div class="times">
 <span>题型：译后编辑 ｜ ${t.segs.length} 段 ｜ 建议时长 ${t.minutes} 分钟</span>
 <span>进入次数：已用 ${enters}/3 ${draft?`｜ <span style="color:var(--a)">有未完成答题记录（${draft.done}/${t.segs.length} 段），进入后可继续</span>`:''}</span>
 </div>
 </div>
 <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
 <span class="dur">时长 <select id="dur-${t.id}">
 <option value="8">8 分钟</option><option value="15">15 分钟</option><option value="30">30 分钟</option>
 ${real?`<option value="${t.minutes}" selected>${t.minutes} 分钟（真题）</option>`:''}
 </select></span>
 <button class="btn btn-o" onclick="enterExam('${t.id}')">去考试</button>
 </div>
 </div>`;
 }).join('')}
 </div>
 <div id="modal-mask" class="mask hidden"><div class="modal" id="modal-box"></div></div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;
}

/* 重置某个任务的进入次数（拟真规则上限 3 次）。界面上不再提供入口 ——
   否则学生自己点一下就把防作弊的"3 次上限"清零；教师需要重开演示时可在控制台调用。 */
function resetEnters(id){ store.del('enters_'+id); store.del('draft_'+id); renderExams(); toast('已重置该任务的进入次数与答题记录'); }

function enterExam(id){
 const task=TASKS.find(t=>t.id===id); if(!task)return;
 const minutes=parseInt(($('#dur-'+id)||{}).value||'15',10);
 const enters=store.get('enters_'+id,0);
 if(enters>=3){ openModal(`<h3>无法进入考试</h3><div class="warn-box">该考试进入答题页面的次数已达 3 次上限（对齐真实赛制），无法再次作答。换一套试卷练习即可。</div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal()">知道了</button></div>`); return; }
 store.set('enters_'+id, enters+1);
 const draft=store.get('draft_'+id,null);
 let answers=task.segs.map(g=>g.mt||''), resumed=false;
 if(draft){ answers=draft.answers; resumed=true; }
 S={ task, minutes, peMode:'agent', answers,
 cur:0, startTs:Date.now(), duration:minutes*60, switches:0, timer:null, over:false };
 openModal(`<h3>进入答题页面（第 ${enters+1}/3 次）</h3>
 <div class="field" style="margin:10px 0">
 <div style="font-weight:600;font-size:13px;margin-bottom:6px">选择作答模式</div>
 <div class="mode-row">
 <div class="mode-btn" id="mode-light" onclick="pickMode(this,'light')"><b>轻度译后编辑</b><span>以可理解为目标，只改硬伤，不重写</span></div>
 <div class="mode-btn sel" id="mode-agent" onclick="pickMode(this,'agent')"><b> 第九届模式（默认）</b><span>全程无 AI，交卷后与 Agent 选手同榜排名（对齐2026第九届赛制）</span></div>
 </div>
 <style>.mode-row{grid-template-columns:1fr 1fr 1fr}</style>
 </div>
 <div class="info-box">请勿切换页面/点击红框外区域（累计 <b>8 次</b>强制交卷）；禁止复制试题与粘贴内容；倒计时归零自动交卷。</div>
 ${resumed?'<div class="info-box">已恢复上次答题记录。</div>':''}
 <div class="m-actions"><button class="btn btn-p" onclick="closeModal();startExam()">开始答题</button></div>`);
}
function pickMode(el,m){
 document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('sel'));
 el.classList.add('sel'); S.peMode=m;
}

/* ============ 答题页 ============ */
function renderExam(){
 document.body.className='exam-on';
 const {task,peMode}=S;
 const agent = peMode==='agent';
 /* 语向标签按任务实际方向生成，不再写死"汉译外" */
 const dirLabel = /中译英|汉译英|中译外|汉译外/.test(task.pair || '') ? '汉译英' : '英译汉';
 document.body.innerHTML=`
 <div class="yc-top">
 <div class="yc-brand"><span class="yc-logo">译</span>MTPE 模拟考场 <span class="en">译后编辑考试·${modeName(peMode)}</span></div>
 <div class="exam-meta">
 <span class="switch-chip ok" id="sw-chip">切屏 0/8</span>
 <span class="remain" id="remain">${fmt(S.duration)}</span>
 </div>
 </div>
 <div class="exam-toolbar">
 <div class="tb-col">
 <button class="tb-btn" onclick="copySrc()">复制原文 ▾</button>
 <button class="tb-btn" onclick="clearPe()">清除译文</button>
 </div>
 <span class="tb-sep"></span>
 <div class="tb-col">
 <span class="tb-line">
 <button class="tb-btn tb-b" onclick="toast('拟真版：富文本样式不可用')">B</button>
 <button class="tb-btn tb-i" onclick="toast('拟真版：富文本样式不可用')">I</button>
 <button class="tb-btn tb-u" onclick="toast('拟真版：富文本样式不可用')">U</button>
 <button class="tb-btn" onclick="toast('拟真版：字号设置不可用')">Aa ▾</button>
 </span>
 <span class="tb-line">
 <button class="tb-btn" onclick="toast('拟真版：删除线不可用')">S</button>
 <button class="tb-btn" title="插入上标" onclick="insertChar('²')">x²</button>
 <button class="tb-btn" title="插入下标" onclick="insertChar('₃')">x₃</button>
 <button class="tb-btn" id="hidden-btn" title="显示隐藏字符" onclick="toggleHidden()">¶</button>
 </span>
 </div>
 <span class="tb-sep"></span>
 <button class="tb-btn tb-tall" onclick="clearStyles()">清除样式</button>
 <button class="tb-btn tb-tall" onclick="openFind()">查找替换</button>
 <button class="tb-btn tb-tall" onclick="runQA()">拼写检查</button>
 <button class="tb-btn tb-tall" onclick="openSpecial()">特殊字符</button>
 </div>
 <div class="exam-body">
 <div class="op-zone">
 <div class="seg-table">
 <div class="seg-row head">
 <div class="seg-num">#</div>
 <div class="seg-cell src">原文<span class="col-lang">请输入原文（${langOf(task.pair)[0]}）</span></div>
 <div class="seg-cell pe">译文<span class="col-lang">请输入译文（${langOf(task.pair)[1]}）　Enter 确认句段</span>
 <span class="col-tools"><button class="tb-btn" title="字号（拟真版不可用）" onclick="toast('拟真版：字号设置不可用')">Aa</button><button class="tb-btn" title="插入脚注标记" onclick="insertChar('*')">(*)</button><button class="tb-btn" title="特殊字符" onclick="openSpecial()">⊞</button><button class="tb-btn" title="上一段" onclick="navSeg(-1)">^</button><button class="tb-btn" title="下一段" onclick="navSeg(1)">v</button></span>
 </div>
 </div>
 ${task.segs.map((g,i)=>`
 <div class="seg-row" id="row-${i}" onclick="setCur(${i})">
 <div class="seg-num">${i+1}<span class="st todo" id="st-${i}">○</span></div>
 <div class="seg-cell src" id="src-${i}">${hlTerms(g.src)}</div>
 <div class="seg-cell pe"><textarea id="ta-${i}" rows="1" class="pe-edit" aria-label="第${i}段译文编辑"
 oninput="onInput(${i},this.value)"
 onkeydown="segKey(event,${i})"></textarea></div>
 </div>`).join('')}
 </div>
 </div>
 <div class="side-col">
 <div class="task-panel">
 <div class="tp-title">第九届全国机器翻译译后编辑大赛（拟真）</div>
 <div class="notice-box">
 <b>试题须知</b>
 <div>满分 100 ｜ 请直接在所提供的机器译文基础上修改，系统将自动记录修订位置，<b>无需另行标注修改痕迹</b>。</div>
 </div>
 <div class="tp-nav">
 <button class="btn btn-g" onclick="navSeg(-1)"> 上一题</button>
 <button class="btn btn-g" onclick="navSeg(1)">下一题 </button>
 </div>
 <div class="tp-card">
 <b>${dirLabel} · ${agent?'译后编辑（第九届赛制）':'轻度译后编辑'}</b> <span class="muted">（机翻底稿，供修改）</span>
 </div>
 </div>
 <div class="side-btns">
 <button class="btn btn-g" onclick="saveExit()">保存&退出</button>
 <button class="btn btn-r" onclick="askSubmit()">交卷</button>
 </div>
 </div>
 </div>
 <div class="status-bar">
 <span>进度: <b id="prog-txt">0/${task.segs.length}</b> 段</span>
 <span class="sb-title">${esc(task.name)}-${modeName(peMode)}译后编辑</span>
 <span>跳至 <input id="jump-n" type="number" min="1" max="${task.segs.length}" value="1"> 段
 <button class="btn btn-g" style="padding:2px 8px" onclick="jumpSeg()">跳转</button></span>
 </div>
 <div class="ref-note">* 红框内为光标操作区域，请勿点击框外区域。</div>
 <div id="modal-mask" class="mask hidden"><div class="modal" id="modal-box"></div></div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;

 task.segs.forEach((g,i)=>{ const ta=$('#ta-'+i); ta.value=S.answers[i]||''; refreshStatus(i); });
 setCur(0);
 bindAntiCheat();
 task.segs.forEach((g,i)=>{ autoGrow(i); });
}

/* ---- 状态 / 导航 ---- */
function refreshStatus(i){
 const st=$('#st-'+i); if(!st)return;
 const v=S.answers[i]||'', mt=S.task.segs[i].mt||'';
 let cls='todo',txt='○';
 if(v && v!==mt){cls='done';txt='';}
 else if(v){cls='editing';txt='●';}
 st.className='st '+cls; st.textContent=txt;
 const done=S.answers.filter((a,k)=>a&&a!==S.task.segs[k].mt).length;
 $('#prog-txt').textContent=done+'/'+S.task.segs.length;
}
function setCur(i){
 S.cur=Math.max(0,Math.min(i,S.task.segs.length-1));
 document.querySelectorAll('.seg-table .seg-row').forEach(r=>r.classList.remove('cur'));
 const row=$('#row-'+S.cur); if(row)row.classList.add('cur');
 const jn=$('#jump-n'); if(jn)jn.value=S.cur+1;
}
function navSeg(d){ setCur(S.cur+d); $('#ta-'+S.cur).focus(); }
function segKey(e,i){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); confirmSeg(i); } }
function confirmSeg(i){
 refreshStatus(i);
 if(i+1<S.task.segs.length){ setCur(i+1); $('#ta-'+(i+1)).focus(); toast('句段 '+(i+1)+' 已确认'); }
 else toast('已是最后一个句段');
}
function jumpSeg(){ const n=parseInt($('#jump-n').value,10); if(n>=1&&n<=S.task.segs.length){ setCur(n-1); $('#ta-'+(n-1)).focus(); } }
function onInput(i,v){ S.answers[i]=v; refreshStatus(i); autoGrow(i); }
/* 译文编辑框按内容自动增高，并铺满本行（左右两栏因此等高） */
function autoGrow(i){
 const ta=$('#ta-'+i); if(!ta) return;
 ta.style.minHeight='0px';
 ta.style.minHeight=Math.max(40, ta.scrollHeight)+'px';
}

/* ---- 工具栏 ---- */
function copySrc(){
 const src=S.task.segs[S.cur].src;
 try{ navigator.clipboard.writeText(src); }catch(e){}
 toast('原文已复制（考试中仍禁止粘贴）');
}
function clearPe(){
 if(!confirm('确定清除当前句段译文？'))return;
 S.answers[S.cur]=S.task.segs[S.cur].mt||''; $('#ta-'+S.cur).value=S.answers[S.cur]; refreshStatus(S.cur);
}
/* 清除样式：纯文本编辑器里等价于清理本段的格式噪声（连续空格 / 不可见字符） */
function clearStyles(){
 const i=S.cur, ta=$('#ta-'+i); if(!ta)return;
 const before=ta.value;
 const after=before.replace(/[\u200b-\u200f\ufeff\u00a0]/g,' ').replace(/ {2,}/g,' ');
 if(after===before){ toast('本段没有可清理的格式噪声（连续空格 / 不可见字符）'); return; }
 ta.value=after; S.answers[i]=after; refreshStatus(i);
 toast('已清理本段格式噪声');
}
function openSpecial(){
 openModal(`<h3>插入特殊字符</h3>
 <div style="display:flex;flex-wrap:wrap;gap:6px">${['×','÷','±','°','©','®','™','µ','¶','§','—','…','“','”','‘','’'].map(c=>`<button class="btn btn-g" style="min-width:42px" onclick="insertChar('${c}')">${c}</button>`).join('')}</div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button></div>`);
}
function insertChar(c){ const ta=$('#ta-'+S.cur); const p=ta.selectionStart||ta.value.length;
 ta.value=ta.value.slice(0,p)+c+ta.value.slice(ta.selectionEnd||p); S.answers[S.cur]=ta.value; refreshStatus(S.cur); ta.focus(); }
let hiddenOn=false;
function toggleHidden(){ hiddenOn=!hiddenOn;
 S.task.segs.forEach((g,i)=>{ const el=$('#src-'+i);
 el.innerHTML=hiddenOn?hlTerms(g.src).replace(/ /g,'<span style="color:#c3cad8">·</span>'):hlTerms(g.src); });
 $('#hidden-btn').textContent=hiddenOn?'隐藏字符':'显示隐藏字符';
}
function openFind(){
 openModal(`<h3>查找替换</h3>
 <div style="display:flex;flex-direction:column;gap:8px">
 <input id="f-find" placeholder="查找（在全部译文中）" style="border:1px solid var(--bd);border-radius:7px;padding:8px 10px;font-family:inherit">
 <input id="f-rep" placeholder="替换为（留空则仅查找）" style="border:1px solid var(--bd);border-radius:7px;padding:8px 10px;font-family:inherit">
 </div>
 <div id="f-out" class="info-box" style="display:none"></div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal()">关闭</button><button class="btn btn-p" onclick="doFind()">执行</button></div>`);
}
function doFind(){
 const f=$('#f-find').value; if(!f){toast('请输入查找内容');return;}
 const r=$('#f-rep').value; let hits=0,rep=0;
 S.answers.forEach((a,i)=>{ if(!a)return;
 if(a.includes(f)){ hits++;
 if(r){ S.answers[i]=a.split(f).join(r); $('#ta-'+i).value=S.answers[i]; refreshStatus(i); rep++; } } });
 const out=$('#f-out'); out.style.display='block';
 out.textContent=`命中 ${hits} 个句段${r?`，已替换 ${rep} 个`:''}`;
}
/* 运行QA（拟真：基础质量检查） */
function runQA(){
 const issues=[];
 S.task.segs.forEach((g,i)=>{
 const pe=(S.answers[i]||'').trim();
 if(!pe) issues.push([i,'warn','译文为空']);
 else if(pe===(g.mt||'')) issues.push([i,'warn','与机翻译文完全一致（疑似未编辑）']);
 if(pe){
 if(/\s{2,}/.test(pe)) issues.push([i,'minor','存在连续多个空格']);
 if(/[,，]\s*[,，]|[。.]{2,}/.test(pe)) issues.push([i,'minor','疑似重复标点']);
 (S.task.terms||[]).forEach(t=>{
 if(g.src.toLowerCase().includes(t.s.toLowerCase()) && pe!==g.ref && !pe.includes(t.t.split('（')[0]))
 issues.push([i,'major','术语建议：「'+t.s+'」「'+t.t.split('（')[0]+'」']);
 });
 }
 });
 const rows=issues.length?issues.map(([i,lv,m])=>`<div class="qa-row ${lv}">句段 ${i+1} · ${esc(m)}</div>`).join('')
 :'<div class="qa-row ok"> QA 检查通过，未发现问题</div>';
 openModal(`<h3>拼写检查结果（${issues.length} 条）</h3>
 <div style="max-height:320px;overflow:auto">${rows}</div>
 <div class="m-actions"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
}

/* ---- 术语高亮 ---- */
function hlTerms(src){
 let html=esc(src);
 (S.task.terms||[]).forEach(t=>{ if(!t.s)return;
 try{ html=html.replace(new RegExp('('+t.s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark title="'+esc(t.t)+'">$1</mark>'); }catch(e){} });
 return html;
}

/* ---- 防作弊 ---- */
function bindAntiCheat(){
 S._vis=()=>{ if(document.visibilityState==='hidden')return; countSwitch('窗口切回'); };
 S._blur=()=>countSwitch('失去焦点');
 S._ctx=e=>{ e.preventDefault(); toast('考试模式禁止右键操作'); };
 S._copy=e=>{ e.preventDefault(); toast('考试模式禁止复制试题内容'); };
 S._paste=e=>{ e.preventDefault(); toast('考试模式禁止粘贴内容'); };
 document.addEventListener('visibilitychange',S._vis);
 window.addEventListener('blur',S._blur);
 const oz=document.querySelector('.op-zone');
 if(oz)oz.addEventListener('contextmenu',S._ctx);
 document.addEventListener('copy',S._copy);
 document.addEventListener('paste',S._paste);
}
function unbindAntiCheat(){
 document.removeEventListener('visibilitychange',S._vis);
 window.removeEventListener('blur',S._blur);
 document.removeEventListener('copy',S._copy);
 document.removeEventListener('paste',S._paste);
}
function countSwitch(reason){
 if(!S||S.over)return;
 S.switches++;
 const c=$('#sw-chip');
 if(c){ c.textContent='切屏 '+S.switches+'/8'; c.className='switch-chip'+(S.switches>=5?'':' ok'); }
 if(S.switches>=8){ forceSubmit('系统检测到您切换答题页面累计 8 次，已强制交卷。'); }
 else toast(' '+reason+'，已计切屏 '+S.switches+'/8 次');
}

/* ---- 计时 / 交卷 ---- */
function startExam(){
 renderExam();
 S.startTs=Date.now();
 S.timer=setInterval(()=>{
 if(!S||S.over){clearInterval(S.timer);return;}
 const left=S.duration-Math.floor((Date.now()-S.startTs)/1000);
 const el=$('#remain'); if(!el)return;
 el.textContent=fmt(Math.max(0,left));
 if(left<=60)el.classList.add('warn');
 if(left<=0)forceSubmit('考试时间已用完，系统自动交卷。');
 },500);
 const ta=$('#ta-0'); if(ta)ta.focus();
 if(S.peMode==='light')toast('轻度译后编辑模式：以可理解为目标，只改硬伤');
 if(S.peMode==='agent')toast('第九届模式：全程无 AI，交卷后与 Agent 选手同榜排名');
}
function askSubmit(){
 const done=S.answers.filter((a,k)=>a&&a!==S.task.segs[k].mt).length;
 openModal(`<h3>确认交卷？</h3><div class="info-box">已编辑 ${done}/${S.task.segs.length} 段。交卷后不可返回修改。</div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal()">继续作答</button><button class="btn btn-r" onclick="closeModal();doSubmit('手动交卷')">确认交卷</button></div>`);
}
function forceSubmit(msg){ if(S&&S.over)return; openModal(`<h3>强制交卷</h3><div class="warn-box">${esc(msg)}</div>
 <div class="m-actions"><button class="btn btn-p" onclick="closeModal();doSubmit('强制交卷')">查看结果</button></div>`); }
function saveExit(){
 const done=S.answers.filter((a,k)=>a&&a!==S.task.segs[k].mt).length;
 store.set('draft_'+S.task.id,{answers:S.answers,done,savedAt:Date.now()});
 endExam(); renderExams(); toast('答题记录已保存，可从「去考试」继续');
}
function endExam(){ if(S&&S.timer)clearInterval(S.timer); unbindAntiCheat(); if(S)S.over=true; }

function doSubmit(reason){
 endExam();
 const {task,peMode}=S;
 const timeUsed=Math.floor((Date.now()-S.startTs)/1000);
 const details=task.segs.map((g,i)=>{
 const pe=(S.answers[i]||'').trim(); const mt=g.mt||'';
 const edited=!!pe&&pe!==mt;
 return { i, edited, ter:edited?revisionRate(mt,pe):0, sim:pe?similarity(pe,g.ref):0, terScore:pe?examScore(pe,g.ref):0, pe, mt, ref:g.ref };
 });
 const editedN=details.filter(d=>d.edited).length;
 const avgTer=editedN?details.filter(d=>d.edited).reduce((s,d)=>s+d.ter,0)/editedN:0;
 const score=Math.round(details.reduce((s,d)=>s+d.sim,0)/details.length*10)/10;
 const terScore=Math.round(details.reduce((s,d)=>s+d.terScore,0)/details.length*10)/10;
 const noEditN=details.length-editedN;
 store.del('draft_'+task.id);
 const record={task,peMode,reason,timeUsed,details,editedN,avgTer,score,terScore,noEditN,switches:S.switches,enters:store.get('enters_'+task.id,0)};
 record.prevBest=historyBest(task.id);   // 须在 syncToMainHistory 之前：同步会把本次写入历史
 record.profile=buildProfile(record);
 syncToMainHistory(record);
 renderResult(record);
}

/* ---- Agent 同榜（第九届赛制拟真） ---- */
/* ---- 同步成绩到主平台「我的统计」（mtpe_history） ---- */
function wordCountSrc(s){ return (s.match(/[\u4e00-\u9fff]/g)||[]).length + (s.match(/[A-Za-z]+/g)||[]).length; }
function syncToMainHistory(r){
 try{
 const rec={
 id:'r'+Date.now(), taskId:r.task.id, taskName:r.task.name,
 pair:r.task.pair, domain:r.task.domain, mode:'competition',
 nickname:(JSON.parse(localStorage.getItem('mtpe_nickname')||'"匿名"')),
 date:new Date().toLocaleString('zh-CN',{hour12:false}),
 timeUsed:r.timeUsed, score:r.score, ter:Math.round(r.avgTer*1000)/10,
 segDone:r.editedN, total:r.task.segs.length,
 words:r.task.segs.reduce((s,g)=>s+wordCountSrc(g.src),0),
 profile:r.profile?{editRate:Math.round(r.profile.editRate*1000)/10,
   effRate:Math.round(r.profile.effRate*1000)/10,
   quadrant:quadrantName(r.profile.editRate,r.profile.effRate),
   speed:Math.round(r.profile.speed*10)/10,
   stability:Math.round((r.profile.second-r.profile.first)*10)/10,
   dims:r.profile.out}:null,
 details:r.details.map(d=>({i:d.i,src:d.mt?'':'',mt:d.mt,ref:d.ref,pe:d.pe,ter:d.ter,sim:d.sim,empty:!d.edited,notes:[]}))
 };
 // 主平台结果页需要 d.src 渲染原文列：从 data.js 反查
 const t=(typeof TASKS!=='undefined'?TASKS:[]).find(x=>x.id===r.task.id);
 if(t) rec.details.forEach(d=>{ d.src=t.segs[d.i].src; d.notes=t.segs[d.i].notes||[]; });
 const h=JSON.parse(localStorage.getItem('mtpe_history')||'[]');
 const list=[rec].concat(h).slice(0,200);
 /* 语料明文与作答记录共用同一块本地存储：容量吃紧时逐级丢弃较早记录的逐段明细，
    确保本次成绩一定入库（分数 / 日期 / 画像保留） */
 let keep=list.length, done=false;
 for(let i=0;i<8 && !done;i++){
  try{ localStorage.setItem('mtpe_history', JSON.stringify(list.map((r,idx)=>idx<keep?r:Object.assign({},r,{details:[]})))); done=true; }
  catch(e){ keep=Math.max(1,Math.floor(keep/2)); }
 }
 }catch(e){}
}
function agentBoardHTML(r){ const agents=(AGENT_BOARD[r.task.id]||AGENT_DEFAULT).map(([name,score])=>({name,score,agent:true}));
 const rows=agents.concat([{name:'我（'+getNickYcx()+'）',score:r.score,me:true}]).sort((a,b)=>b.score-a.score);
 rows.forEach((x,i)=>x.rank=i+1);
 const mine=rows.find(x=>x.me);
 const beaten=rows.filter(x=>x.agent&&x.score<r.score).length;
 const total=rows.filter(x=>x.agent).length;
 const verdict= mine.rank===1?' 你排第一，战胜了全部 Agent 选手！'
 : beaten===total?` 战胜了全部 ${total} 名 Agent 选手（第 ${mine.rank} 名）`
 : `与 Agent 同榜：第 ${mine.rank} 名，战胜 ${beaten}/${total} 名 Agent 选手${beaten===0?'——还没有 Agent 被你甩在身后，继续练！':''}`;
 return `
 <div class="board">
 <h3> 人机同榜（第九届赛制拟真）</h3>
 <table>
 <tr><th>名次</th><th>选手</th><th>得分</th><th>说明</th></tr>
 ${rows.map(row=>`
 <tr class="${row.me?'me':''}">
 <td class="${row.rank===1?'rank-1':''}">${row.rank<=3?['','',''][row.rank-1]:'#'+row.rank}</td>
 <td>${esc(row.name)}${row.agent?' <span class="tag blue" style="font-size:11px">Agent</span>':''}${row.me?'（本卷）':''}</td>
 <td><b>${row.score}</b></td>
 <td class="muted">${row.agent?'AI Agent 选手（拟真成绩）':'人类选手 · '+r.reason+' · 用时 '+fmt(r.timeUsed)}</td>
 </tr>`).join('')}
 </table>
 <div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:${beaten===total?'var(--gb)':'var(--ab)'};font-size:13.5px">${verdict}</div>
 <div class="board-note">* Agent 成绩为拟真数据。正式赛制中 Agent 选手的译文由组委会统一生成并评分后与人类选手合并排名。</div>
 </div>`;
}
function getNickYcx(){ return store.get('nickname_yx','我'); }

/* ============ 结果画像（优化A） ============
 * 四项：① 错误维度雷达 ② 编辑倾向四象限 ③ 速度与稳定性 ④ 参照系
 * 维度归并同标注体系：M1-M3→准确性，M4→术语，M5-M7→语言规范，M8→风格，M9→格式。
 * 注意：考场无人工标注，维度分布由"逐段机翻↔参考 diff"启发式初筛，精确口径以第一期 MQM 人工标注为准。
 */
const DIMS = ['准确性', '术语', '语言规范', '风格', '格式'];
const M_DIM = { M1:'准确性', M2:'准确性', M3:'准确性', M4:'术语',
                M5:'语言规范', M6:'语言规范', M7:'语言规范', M8:'风格', M9:'格式' };
const QUAD_X = 0.30, QUAD_Y = 0.60;

function zeroDims(){ const o = {}; DIMS.forEach(d => o[d] = 0); return o; }
function isPunctOnly(s){ return !!s && !/[0-9A-Za-z\u4e00-\u9fff]/.test(s); }
/* 参考译文补出拉丁文括注（专名/术语处理）也算术语维度 */
const GLOSS_RE = /[（(]\s*[A-Za-z][A-Za-z0-9 .'’\-]{1,40}\s*[）)]/;
function termHit(terms, txt){
  if (!txt || !terms.length) return false;
  const low = txt.toLowerCase();
  return terms.some(t => {
    const cn = String(t.s || '').trim();
    const en = String(t.t || '').split('（')[0].trim();
    return (cn && (txt.includes(cn) || low.includes(cn.toLowerCase()))) ||
           (en && en.length > 1 && low.includes(en.toLowerCase()));
  });
}
function classifyChunk(del, ins, terms){
  const d = del.join(''), s = ins.join('');
  if (d.replace(/\s+/g, '') === s.replace(/\s+/g, '')) return 'M9';   // 仅空白/不可见差异
  const dt = d.replace(/\s+/g, ''), st = s.replace(/\s+/g, '');
  if (termHit(terms, dt) || termHit(terms, st)) return 'M4';          // 命中术语表
  if (st && GLOSS_RE.test(st) && !GLOSS_RE.test(dt)) return 'M4';     // 参考补出拉丁文括注
  if (/[0-9]/.test(dt) || /[0-9]/.test(st)) return 'M5';              // 数字/单位
  if (isPunctOnly(dt) || isPunctOnly(st)) return 'M7';                // 标点
  if (!dt) return 'M2';                                                // 参考多出内容 → 漏译
  if (!st) return 'M3';                                                // 参考少出内容 → 增译
  const dn = del.filter(t => t.trim()).length, sn = ins.filter(t => t.trim()).length;
  // 仅"整句/短语级重述"判为风格（双侧 ≥2 词且 ≥6 字）：单词级替换默认按误译，避免低估准确性
  if (dn >= 2 && sn >= 2 && Math.max(dt.length, st.length) >= 6 && Math.abs(dt.length - st.length) <= 2) return 'M8';
  if (st.length - dt.length >= 4) return 'M2';
  if (dt.length - st.length >= 4) return 'M3';
  return 'M1';
}
function errorTags(a, b, terms){
  const ops = diffTokens(tokenize(a || ''), tokenize(b || ''));
  const tags = [];
  let i = 0;
  while (i < ops.length){
    if (ops[i].op === 'same'){ i++; continue; }
    const del = [], ins = [];
    while (i < ops.length && ops[i].op !== 'same'){ (ops[i].op === 'del' ? del : ins).push(ops[i].t); i++; }
    tags.push(classifyChunk(del, ins, terms));
  }
  return tags;
}
function addTags(target, tags){ tags.forEach(m => { target[M_DIM[m] || '准确性'] += 1; }); }
function sumDims(o){ return DIMS.reduce((s, d) => s + o[d], 0); }

function buildProfile(r){
  const terms = r.task.terms || [];
  const draft = zeroDims(), out = zeroDims();
  const n = r.details.length;
  let editOps = 0, cut = 0, mtTok = 0;
  const halves = [[], []];
  r.details.forEach((d, idx) => {
    const base = d.mt || '', ref = d.ref || '';
    const pe = String(d.pe == null ? '' : d.pe).trim();
    const baseTags = errorTags(base, ref, terms);
    addTags(draft, baseTags);
    const peTags = pe ? errorTags(pe, ref, terms) : baseTags;
    if (pe) addTags(out, peTags);
    const ops = diffTokens(tokenize(base), tokenize(pe || base));
    editOps += ops.filter(o => o.op !== 'same').length;
    mtTok += tokenize(base).length;
    cut += Math.max(0, baseTags.length - peTags.length);
    halves[idx < n / 2 ? 0 : 1].push(pe ? similarity(pe, ref) : 0);
  });
  const avg = arr => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
  return {
    draft, out,
    editRate: mtTok ? editOps / mtTok : 0,
    effRate: editOps ? Math.min(1, cut / editOps) : 0,
    speed: n / (Math.max(r.timeUsed, 1) / 60),
    first: avg(halves[0]), second: avg(halves[1]),
    draftTotal: sumDims(draft), outTotal: sumDims(out)
  };
}
function historyBest(taskId){
  try{
    const h = JSON.parse(localStorage.getItem('mtpe_history') || '[]') || [];
    const s = h.filter(x => x && x.taskId === taskId).map(x => Number(x.score) || 0).filter(v => v > 0);
    return s.length ? Math.max(...s) : null;
  }catch(e){ return null; }
}

/* ---- 图 1：维度改对率雷达（0-100 固定刻度，避免某维度量级独大导致退化） ---- */
function fixRates(p){
  // 该维度机翻无问题的按 100% 计（无事可改）
  return DIMS.map(d => p.draft[d] ? Math.max(0, Math.min(100, (p.draft[d] - p.out[d]) / p.draft[d] * 100)) : 100);
}
function radarSVG(values, color){
  const cx = 160, cy = 146, R = 96, n = DIMS.length;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const clamp = v => Math.min(1, Math.max(0, v / 100));
  const P = (i, v) => [(cx + Math.cos(ang(i)) * R * clamp(v)).toFixed(1),
                       (cy + Math.sin(ang(i)) * R * clamp(v)).toFixed(1)];
  let g = '';
  [25, 50, 75, 100].forEach(f => {
    g += '<polygon points="' + DIMS.map((_, i) => P(i, f).join(',')).join(' ') + '" fill="none" stroke="#e5eaf2"/>';
  });
  DIMS.forEach((_, i) => { const q = P(i, 100);
    g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + q[0] + '" y2="' + q[1] + '" stroke="#e5eaf2"/>'; });
  g += '<text x="' + (cx + 3) + '" y="' + (cy - R * 0.5) + '" font-size="9" fill="#b6bfcd">50%</text>';
  g += '<polygon points="' + values.map((v, i) => P(i, v).join(',')).join(' ') +
       '" fill="' + color + '" fill-opacity=".18" stroke="' + color + '" stroke-width="2"/>';
  values.forEach((v, i) => { const q = P(i, v);
    g += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3" fill="' + color + '"/>'; });
  DIMS.forEach((L, i) => {
    const x = (cx + Math.cos(ang(i)) * R * 1.3).toFixed(1);
    const y = (cy + Math.sin(ang(i)) * R * 1.3 + 4).toFixed(1);
    g += '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="11" fill="#5a6478">' + esc(L) + '</text>';
  });
  return '<svg viewBox="0 0 320 294" width="100%" height="205" role="img" aria-label="维度改对率雷达图">' + g + '</svg>';
}
function dimTable(draft, out){
  return '<table class="prof-tb"><tr><th>维度</th><th>机翻底稿</th><th>你的译文</th><th>已改对</th></tr>' +
    DIMS.map(d => {
      const a = draft[d] || 0, b = out[d] || 0, fixed = Math.max(0, a - b);
      return '<tr><td>' + d + '</td><td>' + a + '</td><td>' + b + '</td><td>' +
             (a ? Math.round(fixed / a * 100) + '%' : '—') + '</td></tr>';
    }).join('') + '</table>';
}

/* ---- 图 2：编辑倾向四象限 ---- */
function quadrantName(x, y){
  if (y >= QUAD_Y) return x < QUAD_X ? '精准型' : '过度编辑型';
  return x < QUAD_X ? '保守型' : '鲁莽型';
}
const QUAD_DESC = {
  '精准型': '改动克制、命中率高——这是译后编辑最理想的节奏。',
  '过度编辑型': '改动基本都对，但改动量偏大。机翻对的部分保留才是得分动作（M0 思维），把时间留给文化词与长难句。',
  '保守型': '改动偏少且命中率不高——可能是"该改的地方"判断不足，也可能是没敢动。',
  '鲁莽型': '改动多、命中率低——先在脑子里判断哪儿是硬伤，再动手，别整句凭语感重写。'
};
function quadrantSVG(x, y){
  const W = 300, H = 244, L = 40, RT = 14, T = 14, B = 36;
  const pw = W - L - RT, ph = H - T - B;
  const px = v => L + Math.min(1, Math.max(0, v)) * pw;
  const py = v => (T + ph) - Math.min(1, Math.max(0, v)) * ph;
  const xm = px(QUAD_X), ym = py(QUAD_Y), right = px(1), bottom = py(0);
  const q = [
    [L, T, xm - L, ym - T, '#e9f7ee', '精准型', L + 6, T + 15],
    [xm, T, right - xm, ym - T, '#eaf2ff', '过度编辑型', right - 6, T + 15],
    [L, ym, xm - L, bottom - ym, '#f7f9fd', '保守型', L + 6, bottom - 6],
    [xm, ym, right - xm, bottom - ym, '#fdecec', '鲁莽型', right - 6, bottom - 6]
  ];
  let g = '';
  q.forEach(t => {
    g += '<rect x="' + t[0] + '" y="' + t[1] + '" width="' + t[2] + '" height="' + t[3] + '" fill="' + t[4] + '"/>' +
         '<text x="' + t[5] + '" y="' + t[6] + '" text-anchor="' + (t[5] > right - 40 ? 'end' : 'start') +
         '" font-size="11.5" fill="#6b7488">' + t[7] + '</text>';
  });
  g += '<line x1="' + xm + '" y1="' + T + '" x2="' + xm + '" y2="' + bottom + '" stroke="#c9d3e3" stroke-dasharray="4 4"/>';
  g += '<line x1="' + L + '" y1="' + ym + '" x2="' + right + '" y2="' + ym + '" stroke="#c9d3e3" stroke-dasharray="4 4"/>';
  g += '<rect x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="#dfe5ef"/>';
  const dotX = px(x), dotY = py(y);
  g += '<line x1="' + dotX + '" y1="' + bottom + '" x2="' + dotX + '" y2="' + dotY + '" stroke="#2b7cff" stroke-width="1" stroke-dasharray="3 3"/>';
  g += '<line x1="' + L + '" y1="' + dotY + '" x2="' + dotX + '" y2="' + dotY + '" stroke="#2b7cff" stroke-width="1" stroke-dasharray="3 3"/>';
  g += '<circle cx="' + dotX + '" cy="' + dotY + '" r="6" fill="#2b7cff" stroke="#fff" stroke-width="2"/>';
  g += '<text x="' + W / 2 + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#5a6478">编辑率 →</text>';
  g += '<text x="11" y="' + (T + ph / 2) + '" text-anchor="middle" font-size="11" fill="#5a6478" transform="rotate(-90 11 ' + (T + ph / 2) + ')">有效编辑率 →</text>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="205" role="img" aria-label="编辑倾向四象限">' + g + '</svg>';
}

/* ---- 画像整体 HTML ---- */
function profileHTML(r){
  const p = r.profile;
  if (!p) return '';
  const qn = quadrantName(p.editRate, p.effRate);
  const speed = p.speed.toFixed(1);
  const decay = p.second - p.first;
  const decayTxt = decay <= -5 ? '后半程明显下滑（时间压力下容易失准），建议前半程就留出检查时间。'
    : decay >= 5 ? '后半程反而越改越顺，节奏在走上坡。' : '前后半程基本稳定，抗压节奏可用。';
  const pass = (r.terScore || 0) >= PASS_LINE;
  const best = (typeof r.prevBest === 'number' && isFinite(r.prevBest)) ? r.prevBest : null;
  const agentBest = (AGENT_BOARD[r.task.id] || AGENT_DEFAULT)[0][1];
  return `
 <div class="prof-head">结果画像 <span class="tag blue">四项诊断</span></div>
 <div class="prof-grid">
 <div class="prof-card">
 <h3>① 错误维度分布与改对率</h3>
 ${radarSVG(fixRates(p), '#2b7cff')}
 <div class="prof-legend"><span><i style="background:#2b7cff"></i>该维度已改对率</span></div>
 ${dimTable(p.draft, p.out)}
 <div class="prof-note">按 M1-M9 归并为 5 维。机翻底稿共 ${p.draftTotal} 处问题 → 你的译文献余 ${p.outTotal} 处。此分布由逐段 diff 启发式初筛，精确口径以第一期人工 MQM 标注为准；该维度机翻本无问题的按 100% 计。</div>
 </div>
 <div class="prof-card">
 <h3>② 编辑倾向定位</h3>
 ${quadrantSVG(p.editRate, p.effRate)}
 <div class="prof-kv"><span>整体编辑率</span><b>${(p.editRate * 100).toFixed(1)}%</b></div>
 <div class="prof-kv"><span>有效编辑率（改对的/改的）</span><b>${(p.effRate * 100).toFixed(1)}%</b></div>
 <div class="prof-kv"><span>类型判定</span><b>${qn}</b></div>
 <div class="prof-note">${QUAD_DESC[qn]}（阈值：编辑率 ${QUAD_X * 100}%、有效编辑率 ${QUAD_Y * 100}%）</div>
 </div>
 <div class="prof-card">
 <h3>③ 速度与稳定性</h3>
 <div class="prof-kv"><span>处理速度</span><b>${speed} 段/分钟</b></div>
 <div class="prof-note">${decayTxt}（后程变化 ${decay >= 0 ? '+' : ''}${decay.toFixed(1)} 分，按段序前后半程切分）</div>
 </div>
 <div class="prof-card">
 <h3>④ 参照系</h3>
 <div class="prof-kv"><span>模拟晋级线</span><b>${PASS_LINE} 分 · ${pass ? '已达线' : '差 ' + (PASS_LINE - (r.terScore || 0)).toFixed(1)}</b></div>
 <div class="prof-kv"><span>本卷历史最好</span><b>${best === null ? '首次作答' : best + ' 分'}</b></div>
 <div class="prof-kv"><span>本次进步</span><b class="${best !== null && r.score >= best ? 'pos' : ''}">${best === null ? '—' : (r.score - best >= 0 ? '+' : '') + (r.score - best).toFixed(1) + ' 分'}</b></div>
 <div class="prof-kv"><span>同榜 Agent 最高分</span><b>${agentBest} 分（拟真）</b></div>
 <div class="prof-kv"><span>班级百分位</span><b class="muted">待教师导入</b></div>
 <div class="prof-note">历史最好取自本机「我的统计」中同一份卷子的既往成绩；班级参照需教师汇总后导入。</div>
 </div>
 </div>`;
}

/* ---- 图 5：下一步推荐练习（优化B：画像 → 推荐 → 回练闭环） ---- */
function wrongPairsCount(){
  try{
    const wb = JSON.parse(localStorage.getItem('ann_wrongbook') || '[]') || [];
    return [...new Set(wb.map(w => w.k))].length;
  }catch(e){ return 0; }
}
function recommendHTML(r){
  const p = r.profile;
  if (!p) return '';
  const idx = (typeof CORPUS_TAG_INDEX !== 'undefined') ? CORPUS_TAG_INDEX : null;
  const nm = String(r.task.name || '').match(/第(\d+)届(初赛|决赛)/);
  const ed = nm ? nm[1] : '', stage = nm ? nm[2] : '';
  const cands = DIMS.map(d => ({ d: d, base: p.draft[d] || 0, left: p.out[d] || 0 }))
    .filter(x => x.base > 0)
    .map(x => ({ d: x.d, base: x.base, left: x.left, rate: (x.base - x.left) / x.base }))
    .sort((a, b) => a.rate - b.rate || b.left - a.left);
  const weak = cands[0] || null;
  const avail = (dim, edf) => (!idx || !idx[dim]) ? null : (edf ? (idx[dim].e[edf] || 0) : idx[dim].t);
  const cnt = n => (n === null ? '' : '（约 ' + n + ' 句可练）');
 const items = [];
 const wbN = wrongPairsCount();
 const recWrong = {
   title: '错题回练（' + wbN + ' 句）',
   desc: '你在标注实训里漏检 / 判错的句子，只重做这些——闭环里最省时间的一步。',
   href: 'annotate.html?wrong=1'
 };
 if (weak){
   items.push({
     title: '最弱维度「' + weak.d + '」· 同源卷 ' + cnt(avail(weak.d, ed)),
     desc: '本卷该维度改对率仅 ' + Math.round(weak.rate * 100) + '%，还剩 ' + weak.left + ' 处没改对。回炉第 ' + ed + ' 届' + stage + '同类句对，专攻这一维。',
    href: 'annotate.html?dim=' + encodeURIComponent(weak.d) + '&ed=' + ed + '&stage=' + encodeURIComponent(stage) + '&n=15&go=1'
   });
   if (wbN) items.push(recWrong);
   items.push({
     title: '最弱维度「' + weak.d + '」· 跨届次加练 ' + cnt(avail(weak.d, null)),
     desc: '换一批同维度语料再练，检验上一次的补漏是不是真的补上了。',
    href: 'annotate.html?dim=' + encodeURIComponent(weak.d) + '&n=15&go=1'
   });
 } else if (wbN) items.push(recWrong);
 if (ed){
   items.push({
     title: '第 ' + ed + ' 届' + stage + ' · 同源句对盲标',
     desc: '本卷同源语料的逐句标注，练"找错"的敏感度（有种子标注的句子按 P/R/F1 计分）。',
    href: 'annotate.html?ed=' + ed + '&stage=' + encodeURIComponent(stage) + '&n=15&go=1'
   });
 }
  if (!items.length){
    items.push({ title: '去标注实训组卷', desc: '完成一次标注实训，就能拿到"找错"的查准率 / 查全率画像。', href: 'annotate.html' });
  }
  const list = items.slice(0, 3).map((it, i) => `
 <a class="rec-item" href="${it.href}">
 <span class="rec-n">${i + 1}</span>
 <span class="rec-body"><b>${esc(it.title)}</b><span class="muted">${esc(it.desc)}</span></span>
 <span class="rec-go">去练 →</span>
 </a>`).join('');
  return `
 <div class="prof-head">下一步练什么 <span class="tag blue">画像 → 推荐 → 回练</span></div>
 <div class="board">
 ${list}
 <div class="board-note">推荐由本次画像自动生成：先补最弱维度，再练同源卷，最后回练错题；链接直达标注实训的组卷筛选（按届次 / 赛段 / 错误类型）。可用句数来自全库句对的错误维度预计算。</div>
 </div>`;
}

/* ============ 结果页 ============ */
function renderResult(r){
 V='result'; S=null;
 document.body.className='';
 document.body.innerHTML=`
 <div class="yc-top">
 <div class="yc-brand"><span class="yc-logo">译</span>MTPE 模拟考场 <span class="en">考试结果（拟真）</span></div>
 <div class="yc-top-right"><a class="mi" href="pe-exam.html" style="text-decoration:none">返回考试中心</a></div>
 </div>
 <div class="wrap">
 <div class="page-t">「决赛${esc(r.task.pair)}」${esc(r.task.name)} <span class="tag blue">${esc(r.reason)} · ${modeName(r.peMode)}译后编辑</span></div>
 <div class="page-s">拟真版结果：计算机辅助指标实时计算；正式大赛以“机器智能评分 + 人工评阅”为准（第九届赛场显示满分 100）${r.peMode==='agent'?'，第九届引入 Agent 选手与人类同榜，下方为同榜结果':''}。</div>
 <div class="warn-box" style="margin-bottom:14px"> 得分说明：综合得分基于与参考译文的<b>词级重合度</b>，同义改写或更优表达可能被低估，请以逐段修订痕迹自行判断质量；修订率中文按字切分，跨语向比较需谨慎。</div>
 <div class="res-hero">
 <div class="res-box"><div class="v">${r.score}</div><div class="l">综合得分（vs 参考译文）</div></div>
 <div class="res-box"><div class="v a">${r.terScore}</div><div class="l">考场口径分（TER×1.2）</div></div>
 <div class="res-box"><div class="v a">${(r.avgTer*100).toFixed(1)}%</div><div class="l">平均修订率</div></div>
 <div class="res-box"><div class="v">${r.editedN}/${r.task.segs.length}</div><div class="l">编辑段数</div></div>
 <div class="res-box"><div class="v g">${fmt(r.timeUsed)}</div><div class="l">用时</div></div>
 <div class="res-box"><div class="v ${r.switches>=5?'r':''}">${r.switches}</div><div class="l">切屏次数（上限8）</div></div>
 <div class="res-box"><div class="v ${r.enters>=3?'r':''}">${r.enters}/3</div><div class="l">进入次数</div></div>
 </div>
 <div class="${(r.terScore||0)>=PASS_LINE?'info-box':'warn-box'}" style="margin-bottom:14px"> <b>考场口径（TER×${TER_K}，与训练效果模拟同源）：</b>${r.terScore} 分 —— ${(r.terScore||0)>=PASS_LINE?`<b>达到模拟晋级线 ${PASS_LINE}（前20%水平）</b>`:`未达模拟晋级线 ${PASS_LINE}，差 ${(PASS_LINE-(r.terScore||0)).toFixed(1)} 分`}。晋级线取自 1000 人模拟池第 80 百分位。</div>
 <div class="${r.noEditN>r.details.length*0.6||r.noEditN<3?'warn-box':'info-box'}" style="margin-bottom:14px"> <b>编辑率诊断：</b>未编辑 ${r.noEditN}/${r.details.length} 段。${r.noEditN>r.details.length*0.6?'改动过少——机翻对的句子保留是得分动作，但文化专有词与文学表达处需果断改，先练"判断哪里该改"。':r.noEditN<3?'几乎逐句都改——警惕过度编辑：大模型底稿错误少而隐蔽，机翻对的部分不动才是得分动作（M0 思维）。':'编辑节奏适中。'}</div>
 ${profileHTML(r)}
 ${recommendHTML(r)}
 ${r.peMode==='agent'?agentBoardHTML(r):''}
 ${r.details.map(d=>`
 <div class="res-seg">
 <b>第 ${d.i+1} 段</b>
 ${d.edited?`<span class="tag blue">修订率 ${(d.ter*100).toFixed(1)}%</span> <span class="muted">相似度 ${d.sim}%</span>`:'<span class="tag need">保留机翻 / 未作答</span>'}
 <div class="muted" style="margin-top:4px">${esc(d.pe||d.mt)}</div>
 </div>`).join('')}
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
 <a class="btn btn-p" href="pe-exam.html" style="text-decoration:none">返回我的考试</a>
 <a class="btn btn-o" href="practice.html#stats" style="text-decoration:none">去「改」看逐段修订痕迹与统计</a>
 </div>
 </div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;
}

/* ---- 弹窗 ---- */
function openModal(h){ $('#modal-box').innerHTML=h; $('#modal-mask').classList.remove('hidden'); }
function closeModal(){ const m=$('#modal-mask'); if(m)m.classList.add('hidden'); }

renderExams();
