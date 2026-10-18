/* ============================================================
 * nav.js — 全局工作台外壳（2026-10-18 v3）
 *
 * 设计（用户定案）：首页工作台的左侧栏 = 全站唯一导航入口。
 *   · 学生端所有页面（找/改/测/统计/设置/对标）都渲染同一套
 *     wb-side 侧栏（视觉与首页工作台完全一致），主区包进 .wb-content；
 *     旧的横向顶栏整体退役（与侧栏功能重复，属冗余导航）。
 *   · 沉浸式：作答态（body.answering）由 CSS 隐藏侧栏、主区占满全屏
 *     （ui.css），保持 ③测 赛场整页独占。
 *   · 教师页（teacher/review/class）仍用横向顶栏——教师看板是独立
 *     口令门场景，不进学生工作台。
 *   · 首页 index.html 由 home.js 自管侧栏（含聚焦 hero），本文件跳过。
 *
 * 幂等：pe-exam.js 整页重绘 body 后调 mtpeNavRender() 重新挂壳；
 *   重复调用时把 #app 重新移入 .wb-content，不会产生第二份侧栏。
 * ============================================================ */
(function () {
 const KEY = 'mtpe_account';
 /* 学生端工作台侧栏：顺序 = 首页 → 统计/设置 → 找改测 → 对标（与首页 v2 一致） */
 const ITEMS = [
   { href: 'index.html',    label: '🏠 聚焦首页' },
   { href: 'stats.html',    label: '📊 我的统计' },
   { href: 'settings.html', label: '⚙️ 我的设置' },
   { href: 'annotate.html', label: '🔍 标注实训', tag: '① 找' },
   { href: 'practice.html', label: '✏️ 改译实训', tag: '② 改' },
   { href: 'pe-exam.html',  label: '⏱️ 仿真训练', tag: '③ 测' },
   { href: 'champion.html', label: '🎯 能力对标' }
 ];
 const TEACHER = ['teacher.html', 'review.html', 'class.html'];

 function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
 function cur0() { return location.pathname.split('/').pop() || 'index.html'; }
 function helpOnclick() { return '(window.mtpeHelp||function(){})();return false'; }

 /* —— 教师页：横向顶栏（口令门场景，不带学生语义入口） —— */
 function teacherBar(cur) {
   const TABS = [
     { href: 'annotate.html', label: '① 找' },
     { href: 'practice.html', label: '② 改' },
     { href: 'pe-exam.html',  label: '③ 测' }
   ];
   const tabs = TABS.map((t) => '<a class="mtpe-tab' + (t.href === cur ? ' on' : '') + '" href="' + t.href + '">' + t.label + '</a>').join('');
   return '<div class="mtpe-nav">'
   + '<div class="mtpe-brand" onclick="location.href=\'index.html\'" title="回到首页"><span class="logo">译</span><span class="mtpe-brand-t">译后编辑实训平台</span></div>'
   + '<span class="mtpe-tabs">' + tabs + '</span>'
   + '<span class="mtpe-spacer"></span>'
   + '<a class="mtpe-tab plain" href="#" onclick="' + helpOnclick() + '" title="帮助">?</a>'
   + '<span class="mtpe-acc" style="color:#4f46e5;font-weight:600" title="教师通道：全班数据由 Supabase RLS 口令门隔离">教师通道</span>'
   + '</div>'
   + barStyle();
 }
 function barStyle() {
   return '<style>'
   + '#mtpe-nav{position:sticky;top:0;z-index:60}'
   + '.mtpe-nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.08);padding:10px 18px;font:14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif}'
   + '.mtpe-brand{font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;color:#1d1d1f}'
   + '.mtpe-brand .logo{display:inline-flex;width:26px;height:26px;border-radius:8px;background:#0071e3;color:#fff;align-items:center;justify-content:center;font-size:13px;font-weight:600}'
   + '.mtpe-tabs{display:inline-flex;background:rgba(0,0,0,.05);border-radius:9px;padding:2px;gap:2px}'
   + '.mtpe-tab{color:#1d1d1f;text-decoration:none;padding:6px 14px;border-radius:7px;font-size:14px;display:inline-flex;align-items:center;transition:all .15s ease}'
   + '.mtpe-tab:hover{color:#0071e3}.mtpe-tab.on{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);font-weight:500}'
   + '.mtpe-tab.plain{color:#0071e3}.mtpe-tab.plain:hover{background:rgba(0,0,0,.04)}'
   + '.mtpe-acc{font-size:13px;color:#6e6e73;font-variant-numeric:tabular-nums}'
   + '.mtpe-spacer{flex:1}'
   + '.hidden{display:none!important}'
   + '</style>';
 }

 /* —— 学生端：全局工作台侧栏（视觉与首页 wb-side 完全同一套） —— */
 function shellHtml(cur) {
   const acc = localStorage.getItem(KEY) || '';
   const wk = '日一二三四五六'[new Date().getDay()];
   const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) + ' 星期' + wk;
   const items = ITEMS.map((t) =>
     '<a' + (t.href === cur ? ' class="on"' : '') + ' href="' + t.href + '">'
     + t.label + (t.tag ? ' <span class="tag">' + t.tag + '</span>' : '') + '</a>').join('');
   const account = acc
     ? '<span class="wb-acc" title="已登录">' + esc(acc) + '</span><a href="#" onclick="mtpeLogout();return false">退出</a>'
     : '<a href="#" onclick="(window.mtpeShowLogin||function(){location.reload();})();return false">登录</a>';
   return '<div class="wb-app">'
   + '<aside class="wb-side">'
   +   '<div class="wb-logo"><h1>译后编辑实训平台</h1><p>' + esc(today) + '</p></div>'
   +   '<nav class="wb-nav">' + items + '</nav>'
   +   '<div class="wb-foot">'
   +     '<div class="wb-foot-acts">'
   +       '<a href="#" onclick="' + helpOnclick() + '" title="帮助：流程说明 / 计分口径 / 数据来源 / 常见问题">? 帮助</a>'
   +       '<a href="#" id="mtpe-install" class="hidden" onclick="mtpeInstall();return false" title="装成桌面应用，断网也能用">⬇ 安装到桌面</a>'
   +       account
   +     '</div>'
   +     '语料加密封存 · 离线可用'
   +   '</div>'
   + '</aside>'
   + '<div class="wb-content"></div>'
   + '</div>';
 }

 /* 侧栏样式内联自带：annotate / pe-exam / champion 不加载 style.css，
    外壳必须在任何页面可用。取值与 style.css 的 .wb-side 段保持同步（改两处）。 */
 function shellStyle() {
   return '<style>'
   + '.wb-app{display:flex;min-height:100vh;background:linear-gradient(180deg,#e9ecf7 0%,#f6f7fb 240px)}'
   + '.wb-side{width:216px;background:linear-gradient(180deg,#1e1b4b 0%,#14173d 100%);color:#d0d5dd;padding:22px 0;flex-shrink:0;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;box-shadow:4px 0 24px rgba(23,23,63,.15)}'
   + '.wb-logo{padding:0 20px 16px;border-bottom:1px solid rgba(255,255,255,.08)}'
   + '.wb-logo h1{font-size:17px;color:#fff;font-weight:700;margin:0}'
   + '.wb-logo p{font-size:12px;color:#8b94a7;margin-top:4px}'
   + '.wb-nav{flex:1;overflow-y:auto;padding:10px 0}'
   + '.wb-nav a{display:flex;align-items:center;gap:9px;margin:3px 12px;padding:10px 14px;border-radius:11px;font-size:14px;color:#d0d5dd;text-decoration:none;transition:all .15s ease;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif}'
   + '.wb-nav a:hover{color:#fff;background:rgba(255,255,255,.06)}'
   + '.wb-nav a.on{background:linear-gradient(90deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 14px rgba(79,70,229,.4);font-weight:500}'
   + '.wb-nav .tag{margin-left:auto;background:#2f9e44;color:#fff;font-size:10.5px;padding:1px 7px;border-radius:99px}'
   + '.wb-foot{padding:14px 20px 0;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#8b94a7;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}'
   + '.wb-foot-acts{display:flex;flex-direction:column;gap:2px;margin-bottom:10px}'
   + '.wb-foot-acts a,.wb-foot-acts .wb-acc{display:block;padding:7px 0;font-size:12.5px;color:#d0d5dd;text-decoration:none;border-radius:8px}'
   + '.wb-foot-acts a:hover{color:#fff;background:rgba(255,255,255,.06)}'
   + '.wb-foot-acts .wb-acc{color:#8b94a7;cursor:default;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
   + '.wb-content{flex:1;min-width:0;max-width:none}'
   + 'body.answering .wb-side{display:none!important}'
   + 'body.answering .wb-app{display:block!important}'
   + '.hidden{display:none!important}'
   + '@media (max-width:900px){.wb-app{display:block}.wb-side{position:sticky;top:0;z-index:60;height:auto;width:100%;flex-direction:row;align-items:center;padding:8px 10px;gap:8px;overflow-x:auto}.wb-logo{border:none;padding:0 10px;display:flex;align-items:center;gap:8px;flex-shrink:0}.wb-logo h1{font-size:14px;white-space:nowrap}.wb-logo p{display:none}.wb-nav{display:flex;padding:0}.wb-nav a{margin:0;padding:8px 12px;white-space:nowrap}.wb-nav .tag{display:none}.wb-foot{display:none}}'
   + '</style>';
 }

 function render() {
   const host = document.getElementById('mtpe-nav');
   if (!host) return;
   const cur = cur0();
   /* 侧栏不占顶部高度：作答态顶条贴屏顶（ui.css 的 --mtpe-nav-h 口径） */
   document.documentElement.style.setProperty('--mtpe-nav-h', '0px');
   /* 首页：home.js 自管侧栏（含聚焦 hero），本文件不渲染 */
   if (cur === 'index.html') { host.innerHTML = ''; return; }
   /* 教师页：横向顶栏 */
   if (TEACHER.indexOf(cur) >= 0) { host.innerHTML = teacherBar(cur); syncInstall(); return; }
   /* 学生端：全局工作台侧栏 */
   host.innerHTML = shellStyle() + shellHtml(cur);
   /* 把本页 #app 移入侧栏右侧主区（幂等：重复调用移回即可，不会出第二份侧栏） */
   const app = document.getElementById('app');
   const content = host.querySelector('.wb-content');
   if (app && content) content.appendChild(app);
   syncInstall();
 }

 /* 安装按钮：仅在浏览器确认可安装时出现（file:// 或已安装时不出现） */
 function syncInstall() {
   const b = document.getElementById('mtpe-install');
   if (!b) return;
   const h = () => b.classList.toggle('hidden', !(window.mtpeCanInstall && window.mtpeCanInstall()));
   document.addEventListener('mtpe-install-changed', h);
   document.addEventListener('mtpe-installed', h);
   h();
 }

/* 供"整页重绘"的页面使用：仿真训练会整体替换 body.innerHTML，重绘后要重新挂上外壳 */
window.mtpeNavRender = render;
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
 else render();
})();
