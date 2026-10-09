/* ============================================================
 * MTPE 模拟考场 · 逻辑 v2
 * 依据真实界面截图（第四届全国翻译技术大赛决赛）校准：
 * - 右侧栏双模式：题目面板（默认） AI助手（仅深度译后编辑开放）
 * - 轻度/深度两种作答模式
 * - 工具栏含 运行QA、格式刷、溶解样式
 * - AI 模型声明为"大语言模型"（教学模拟，不使用真实品牌名），预置 4 条英文润色指令
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
let S=null; // {task, minutes, peMode, answers[], cur, startTs, duration, tokens, switches, enters}
const TOKEN_LIMIT = 10000;

/* 第九届赛制：Agent 选手成绩（拟真，交卷后同榜） */
const AGENT_BOARD = {
 t1: [['Agent·旗舰A', 91.4], ['Agent·旗舰B', 89.7], ['Agent·旗舰C', 87.8]],
 t2: [['Agent·旗舰A', 92.1], ['Agent·旗舰B', 88.9], ['Agent·旗舰C', 86.5]],
 t3: [['Agent·旗舰A', 90.6], ['Agent·旗舰B', 88.2], ['Agent·旗舰C', 85.7]],
 t4: [['Agent·旗舰A', 93.0], ['Agent·旗舰B', 90.4], ['Agent·旗舰C', 88.6]]
};
const AGENT_DEFAULT = [['Agent·旗舰A', 90.0], ['Agent·旗舰B', 88.0], ['Agent·旗舰C', 86.0]];
function modeName(m){ return m==='deep'?'深度':m==='agent'?'第九届·Agent同榜':'轻度'; }

/* ============ 考试广场（精简版：只保留与考试直接相关的元素） ============ */
function renderExams(){
 document.body.className='';
 document.body.innerHTML = `
 <div class="yc-top">
 <div class="yc-brand"><span class="yc-logo">译</span>MTPE 模拟考场 <span class="en">译后编辑模拟考试</span></div>
 <div class="yc-top-right"><a class="mi" href="index.html" style="text-decoration:none"> 返回实训平台</a></div>
 </div>
 <div class="wrap">
 <div class="page-t">考试广场</div>
 <div class="page-s">独立教学模拟工具，与任何商业平台无关。仅保留与考试作答直接相关的界面要素；作答模式含第九届赛制（无 AI·Agent 同榜）、轻度与深度。交卷成绩自动计入主平台「我的统计」。</div>
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
 <span class="reset-link" onclick="resetEnters('${t.id}')">重置进入次数</span>
 </div>
 </div>`;
 }).join('')}
 <div class="page-s" style="margin-top:16px"> 交卷后在主平台可查看逐段修订痕迹、排行榜与成绩报告。</div>
 </div>
 <div id="modal-mask" class="mask hidden"><div class="modal" id="modal-box"></div></div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;
}

function resetEnters(id){ store.del('enters_'+id); store.del('draft_'+id); renderExams(); toast('已重置该任务的进入次数与答题记录'); }

function enterExam(id){
 const task=TASKS.find(t=>t.id===id); if(!task)return;
 const minutes=parseInt(($('#dur-'+id)||{}).value||'15',10);
 const enters=store.get('enters_'+id,0);
 if(enters>=3){ openModal(`<h3>无法进入考试</h3><div class="warn-box">该考试进入答题页面的次数已达 3 次上限，系统已强制交卷，无法再次作答。</div>
 <div class="m-actions"><button class="btn btn-g" onclick="closeModal();resetEnters('${id}');renderExams()">重置拟真数据</button></div>`); return; }
 store.set('enters_'+id, enters+1);
 const draft=store.get('draft_'+id,null);
 let answers=task.segs.map(g=>g.mt||''), resumed=false;
 if(draft){ answers=draft.answers; resumed=true; }
 S={ task, minutes, peMode:'agent', answers,
 cur:0, startTs:Date.now(), duration:minutes*60, tokens:TOKEN_LIMIT, switches:0, timer:null, over:false };
 openModal(`<h3>进入答题页面（第 ${enters+1}/3 次）</h3>
 <div class="field" style="margin:10px 0">
 <div style="font-weight:600;font-size:13px;margin-bottom:6px">选择作答模式</div>
 <div class="mode-row">
 <div class="mode-btn" id="mode-light" onclick="pickMode(this,'light')"><b>轻度译后编辑</b><span>以可理解为目标，只改硬伤，不重写（真实赛制：不开放 AI 助手）</span></div>
 <div class="mode-btn sel" id="mode-agent" onclick="pickMode(this,'agent')"><b> 第九届模式（默认）</b><span>全程无 AI，交卷后与 Agent 选手同榜排名（对齐2026第九届赛制）</span></div>
 <div class="mode-btn" id="mode-deep" onclick="pickMode(this,'deep')"><b>深度译后编辑</b><span>达到人工翻译水准，可切换 AI 助手（大语言模型模拟）</span></div>
 </div>
 <style>.mode-row{grid-template-columns:1fr 1fr 1fr}</style>
 </div>
 <div class="info-box"> 请勿切换页面/点击红框外区域（累计 <b>8 次</b>强制交卷）； 禁止复制试题与粘贴内容； 倒计时归零自动交卷； AI 助手 Token 限额 10000（仅深度模式）。</div>
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
 const deep = peMode==='deep';
 const agent = peMode==='agent';
 document.body.innerHTML=`
 <div class="yc-top">
 <div class="yc-brand"><span class="yc-logo">译</span>MTPE 模拟考场 <span class="en">译后编辑考试·${modeName(peMode)}</span></div>
 <div class="exam-meta">
 <span class="switch-chip ok" id="sw-chip">切屏 0/8</span>
 ${deep?`<span class="tok-chip" id="tok-chip">剩余可用Tokens:${TOKEN_LIMIT}</span>`:''}
 <span class="remain" id="remain">${fmt(S.duration)}</span>
 </div>
 </div>
 <div class="exam-toolbar">
 <button class="tb-btn" onclick="copySrc()"> 复制原文 ▾</button>
 <span class="tb-sep"></span>
 <button class="tb-btn tb-b" onclick="toast('拟真版：富文本样式不可用')">B</button>
 <button class="tb-btn tb-i" onclick="toast('拟真版：富文本样式不可用')">I</button>
 <button class="tb-btn tb-u" onclick="toast('拟真版：富文本样式不可用')">U</button>
 <button class="tb-btn" onclick="toast('拟真版：格式刷不可用')">格式刷</button>
 <span class="tb-sep"></span>
 <button class="tb-btn" onclick="openFind()"> 查找替换</button>
 <button class="tb-btn" onclick="runQA()"> 运行QA</button>
 <button class="tb-btn" onclick="openSpecial()">特殊字符</button>
 <span class="tb-sep"></span>
 <button class="tb-btn" onclick="clearPe()">清除译文</button>
 <button class="tb-btn" onclick="toast('拟真版：溶解样式不可用')"> 溶解样式</button>
 <button class="tb-btn" id="hidden-btn" onclick="toggleHidden()">显示隐藏字符</button>
 </div>
 <div class="exam-body">
 <div class="op-zone">
 <div class="zone-note">* 红框内为光标操作区域，请勿点击框外区域</div>
 <table class="seg-table">
 <tr><th style="width:46px">#</th><th>原文</th><th>译文（Enter 确认句段）</th></tr>
 ${task.segs.map((g,i)=>`
 <tr id="row-${i}" onclick="setCur(${i})">
 <td class="num">${i+1}<span class="st todo" id="st-${i}">○</span></td>
 <td class="src-cell" id="src-${i}">${hlTerms(g.src)}</td>
 <td class="pe-cell"><textarea id="ta-${i}" rows="3" aria-label="第${i}段译文编辑"
 oninput="onInput(${i},this.value)"
 onkeydown="segKey(event,${i})"></textarea></td>
 </tr>`).join('')}
 </table>
 </div>
 <div class="side-col">
 <div class="task-panel">
 <div class="tp-title">第九届全国机器翻译译后编辑大赛（拟真）</div>
 <div class="tp-nav">
 <button class="btn btn-g" onclick="navSeg(-1)"> 上一题</button>
 <button class="btn btn-g" onclick="navSeg(1)">下一题 </button>
 </div>
 <div class="tp-card">
 <b>${agent?'汉译外译后编辑（第九届赛制）':deep?'汉译外深度译后编辑':'外译汉轻度译后编辑'}</b> <span class="muted">（机翻翻译译文由AI生成，仅供参考）</span>
 <div class="muted" style="margin-top:4px">${deep?'可点击右侧标签切换 AI 助手；Token 限额 10000。':agent?'第九届赛制：全程无 AI 助手；Agent 选手将与您同榜排名，交卷后见分晓。':'本题型不开放 AI 助手（真实赛制）。'}</div>
 </div>
 ${deep?`
 <div class="side-tabs">
 <span class="s-tab" id="tab-task" onclick="switchSide('task')">题目</span>
 <span class="s-tab on" id="tab-ai" onclick="switchSide('ai')"> AI助手</span>
 </div>`:''}
 </div>
 ${deep?`
 <div class="ai-panel" id="ai-panel">
 <div class="ai-head"> AI助手 <span class="seg-ref">当前会话对应句段编号:<b id="ai-seg">1</b></span></div>
 <div class="ai-quick">
 <button class="q-btn" onclick="quickPolish()"> 译文润色</button>
 <button class="q-btn" onclick="quickSynonym()">同义调查询</button>
 </div>
 <div class="ai-dialog" id="ai-dialog">
 <div class="msg a">你好，我是拟真 AI 助手（规则模拟）。可用快捷指令，或输入含「润色 / 同义词 / 术语」的指令。Token 有限，请合理使用。</div>
 </div>
 <div class="ai-foot">
 <div class="ai-dis">基于大语言模型（教学模拟），相关内容仅供参考使用。</div>
 <div class="ai-input-row">
 <input id="ai-input" placeholder="请输入对话指令" aria-label="AI助手对话输入" onkeydown="if(event.key==='Enter')aiSend()">
 <button class="btn btn-p" onclick="aiSend()">工具</button>
 </div>
 </div>
 </div>`:''}
 <div class="side-btns">
 <button class="btn btn-g" onclick="saveExit()">保存&退出</button>
 <button class="btn btn-r" onclick="askSubmit()">交卷</button>
 </div>
 </div>
 </div>
 <div class="status-bar">
 <span>进度: <b id="prog-txt">0/${task.segs.length}</b> 段</span>
 <span class="sb-title">${esc(task.name)}-${modeName(peMode)}译后编辑</span>
 <span>‹ ${''} <b id="page-num">1</b>/${task.segs.length} 页 ›</span>
 <span>跳至 <input id="jump-n" type="number" min="1" max="${task.segs.length}" value="1"> 段
 <button class="btn btn-g" style="padding:2px 8px" onclick="jumpSeg()">跳转</button></span>
 </div>
 <div class="icon-rail">
 <button class="rail-btn" onclick="toast('拟真版：句段列表即主区域')"><span>句段</span></button>
 ${deep?`<button class="rail-btn on" id="rail-ai" onclick="switchSide('ai')"><span>AI助手</span></button>`
 :`<button class="rail-btn" disabled onclick="toast('${agent?'第九届赛制全程无AI助手，Agent选手与您同榜排名':'轻度译后编辑不开放AI助手（真实赛制）'}')"><span>AI助手</span></button>`}
 <button class="rail-btn" onclick="runQA()"><span>QA</span></button>
 </div>
 <div class="ref-note">* 此界面为教学拟真还原，试题内容与正式考试无关。红框内为光标操作区域，请勿点击框外区域。</div>
 <div id="modal-mask" class="mask hidden"><div class="modal" id="modal-box"></div></div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;

 task.segs.forEach((g,i)=>{ const ta=$('#ta-'+i); ta.value=S.answers[i]||''; refreshStatus(i); });
 setCur(0);
 bindAntiCheat();
}

function switchSide(w){
 const ai=$('#ai-panel');
 if(!ai)return;
 ai.style.display = w==='ai'?'flex':'none';
 $('#tab-ai').classList.toggle('on',w==='ai');
 $('#tab-task').classList.toggle('on',w==='task');
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
 document.querySelectorAll('.seg-table tr').forEach(r=>r.classList.remove('cur'));
 const row=$('#row-'+S.cur); if(row)row.classList.add('cur');
 const ai=$('#ai-seg'); if(ai)ai.textContent=S.cur+1;
 const pn=$('#page-num'); if(pn)pn.textContent=S.cur+1;
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
function onInput(i,v){ S.answers[i]=v; refreshStatus(i); }

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
 openModal(`<h3> QA 检查结果（${issues.length} 条）</h3>
 <div style="max-height:320px;overflow:auto">${rows}</div>
 <div class="m-actions"><button class="btn btn-p" onclick="closeModal()">知道了</button></div>`);
}

/* ---- AI 助手（规则模拟，仅深度模式） ---- */
function tokCost(text){ const cn=(text.match(/[\u4e00-\u9fff]/g)||[]).length; const other=text.length-cn;
 return Math.ceil(cn*2+other*0.25); }
function spend(n){ if(S.tokens<n){ aiBubble('a','剩余 Tokens 不足，无法继续对话（考试规则：耗尽后不可充值）。'); return false; }
 S.tokens-=n; const c=$('#tok-chip'); c.textContent='剩余可用Tokens:'+S.tokens;
 c.className='tok-chip'+(S.tokens<1000?' low':''); return true; }
function aiBubble(role,text,extra){
 const d=$('#ai-dialog'); const div=document.createElement('div');
 div.className='msg '+role;
 div.innerHTML=esc(text)+(extra||'');
 d.appendChild(div); d.scrollTop=d.scrollHeight; return div;
}
function aiThinking(cb){
 const d=$('#ai-dialog');
 const div=document.createElement('div'); div.className='msg a';
 div.innerHTML='<span class="think" onclick="this.classList.toggle(\'open\')"> 深度思考过程（点击展开）</span><div class="think-body">先核对术语与数字等硬性错误，再检查句式是否符合目标语习惯，最后评估是否存在过度编辑空间……</div>';
 d.appendChild(div); d.scrollTop=d.scrollHeight;
 setTimeout(cb,600);
}
function quickPolish(){ aiSend('润色'); }
function quickSynonym(){ aiSend('同义词'); }
function aiSend(preset){
 const inp=$('#ai-input'); const q=(preset||inp.value).trim();
 if(!preset)inp.value='';
 if(!q)return;
 aiBubble('u',q);
 const seg=S.task.segs[S.cur], i=S.cur;
 aiThinking(()=>{
 let reply='', apply=null;
 if(q.includes('润色')){
 if(!spend(tokCost(seg.ref)+40))return;
 reply=`【句段 ${i+1} 润色建议】\n${seg.ref}\n\n可参考指定指令如下：\n【正式规范】Make the text more formal and standard.\n【优化表达】Try to improve the expression.\n【生动形象】Pay attention to its vividness.\n【避免中式英语】Avoid Chinglish and improve the text.`;
 apply={pe:seg.ref};
 } else if(q.includes('同义')||q.includes('近义')){
 if(!spend(60))return;
 const terms=(S.task.terms||[]).filter(t=>seg.src.toLowerCase().includes(t.s.toLowerCase()));
 reply=terms.length?`【句段 ${i+1} 同义词/相关表达】\n${terms.map(t=>'· '+t.s+' '+t.t).join('\n')}\n\n提示：如无规范术语要求，可结合语境灵活替换。`:`【句段 ${i+1}】未检索到强相关术语，建议结合语境自行斟酌表达。`;
 } else if(q.includes('术语')){
 if(!spend(50))return;
 const terms=(S.task.terms||[]);
 reply=terms.length?`【本任务术语表摘录】\n${terms.slice(0,5).map(t=>'· '+t.s+' = '+t.t).join('\n')}${terms.length>5?'\n……完整术语表见赛前材料':''}`:'本任务未配置术语表。';
 } else {
 if(!spend(30))return;
 reply='我是拟真版 AI 助手，支持三类指令：\n· 「润色」 当前句段润色建议\n· 「同义词」 查询相关表达\n· 「术语」 查看术语表摘录\n（正式比赛中由大模型实时对话，按 Token 计费。）';
 }
 const extra=apply?`<br><button class="apply-btn" onclick="applyPe(${JSON.stringify(apply.pe).replace(/"/g,'&quot;')})">应用到译文</button>`:'';
 aiBubble('a',reply,extra);
 });
}
function applyPe(pe){ if(pe==null)return; S.answers[S.cur]=pe; $('#ta-'+S.cur).value=pe; refreshStatus(S.cur); toast('已将建议应用到句段 '+(S.cur+1)); }

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
 if(S.peMode==='light')toast('轻度译后编辑模式：AI 助手不可用（真实赛制）');
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
 const record={task,peMode,reason,timeUsed,details,editedN,avgTer,score,terScore,noEditN,tokens:S.tokens,switches:S.switches,enters:store.get('enters_'+task.id,0)};
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
 details:r.details.map(d=>({i:d.i,src:d.mt?'':'',mt:d.mt,ref:d.ref,pe:d.pe,ter:d.ter,sim:d.sim,empty:!d.edited,notes:[]}))
 };
 // 主平台结果页需要 d.src 渲染原文列：从 data.js 反查
 const t=(typeof TASKS!=='undefined'?TASKS:[]).find(x=>x.id===r.task.id);
 if(t) rec.details.forEach(d=>{ d.src=t.segs[d.i].src; d.notes=t.segs[d.i].notes||[]; });
 const h=JSON.parse(localStorage.getItem('mtpe_history')||'[]');
 localStorage.setItem('mtpe_history', JSON.stringify([rec].concat(h).slice(0,200)));
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
 <div class="page-s">拟真版结果：计算机辅助指标实时计算；正式大赛以“机器智能评分 + 人工评阅”为准${r.peMode==='agent'?'（第九届引入 Agent 选手与人类同榜，下方为同榜结果）':'（决赛译文质量 170 分 + 翻译技术应用 30 分）'}。</div>
 <div class="warn-box" style="margin-bottom:14px"> 得分说明：综合得分基于与参考译文的<b>词级重合度</b>，同义改写或更优表达可能被低估，请以逐段修订痕迹自行判断质量；修订率中文按字切分，跨语向比较需谨慎。</div>
 <div class="res-hero">
 <div class="res-box"><div class="v">${r.score}</div><div class="l">综合得分（vs 参考译文）</div></div>
 <div class="res-box"><div class="v a">${r.terScore}</div><div class="l">考场口径分（TER×1.2）</div></div>
 <div class="res-box"><div class="v a">${(r.avgTer*100).toFixed(1)}%</div><div class="l">平均修订率</div></div>
 <div class="res-box"><div class="v">${r.editedN}/${r.task.segs.length}</div><div class="l">编辑段数</div></div>
 <div class="res-box"><div class="v g">${fmt(r.timeUsed)}</div><div class="l">用时</div></div>
 ${r.peMode==='deep'?`<div class="res-box"><div class="v ${r.tokens<1000?'r':''}">${r.tokens}</div><div class="l">剩余 Tokens</div></div>`:''}
 <div class="res-box"><div class="v ${r.switches>=5?'r':''}">${r.switches}</div><div class="l">切屏次数（上限8）</div></div>
 <div class="res-box"><div class="v ${r.enters>=3?'r':''}">${r.enters}/3</div><div class="l">进入次数</div></div>
 </div>
 <div class="${(r.terScore||0)>=PASS_LINE?'info-box':'warn-box'}" style="margin-bottom:14px"> <b>考场口径（TER×${TER_K}，与训练效果模拟同源）：</b>${r.terScore} 分 —— ${(r.terScore||0)>=PASS_LINE?`<b>达到模拟晋级线 ${PASS_LINE}（前20%水平）</b>`:`未达模拟晋级线 ${PASS_LINE}，差 ${(PASS_LINE-(r.terScore||0)).toFixed(1)} 分`}。晋级线取自 1000 人模拟池第 80 百分位。</div>
 <div class="${r.noEditN>r.details.length*0.6||r.noEditN<3?'warn-box':'info-box'}" style="margin-bottom:14px"> <b>编辑率诊断：</b>未编辑 ${r.noEditN}/${r.details.length} 段。${r.noEditN>r.details.length*0.6?'改动过少——机翻对的句子保留是得分动作，但文化专有词与文学表达处需果断改，先练"判断哪里该改"。':r.noEditN<3?'几乎逐句都改——警惕过度编辑：大模型底稿错误少而隐蔽，机翻对的部分不动才是得分动作（M0 思维）。':'编辑节奏适中。'}</div>
 ${r.peMode==='agent'?agentBoardHTML(r):''}
 ${r.details.map(d=>`
 <div class="res-seg">
 <b>第 ${d.i+1} 段</b>
 ${d.edited?`<span class="tag blue">修订率 ${(d.ter*100).toFixed(1)}%</span> <span class="muted">相似度 ${d.sim}%</span>`:'<span class="tag need">保留机翻 / 未作答</span>'}
 <div class="muted" style="margin-top:4px">${esc(d.pe||d.mt)}</div>
 </div>`).join('')}
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
 <a class="btn btn-p" href="pe-exam.html" style="text-decoration:none">返回我的考试</a>
 <a class="btn btn-o" href="index.html" style="text-decoration:none">去主平台看逐段修订痕迹 </a>
 </div>
 </div>
 <div id="toast" style="opacity:0" role="status" aria-live="polite"></div>`;
}

/* ---- 弹窗 ---- */
function openModal(h){ $('#modal-box').innerHTML=h; $('#modal-mask').classList.remove('hidden'); }
function closeModal(){ const m=$('#modal-mask'); if(m)m.classList.add('hidden'); }

renderExams();
