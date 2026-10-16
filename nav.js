/* ============================================================
 * nav.js — 全站共享顶栏（品牌 = 回首页 ｜ ① 找 / ② 改 / ③ 测 ｜ 我的统计 ? 账号 安装到桌面）
 * 登录 / 解密逻辑在 unlock.js（配 secure.js）；本文件只负责渲染顶栏。
 * 四个页面（首页 + 三个二级页）共用；作答态由各页给 body 加 .answering 把它隐藏，
 * 让 ③ 测 保持整页独占。教师登录按钮与相关代码已移除，教学端仅本地使用。
 * 用法：页面放 <div id="mtpe-nav"></div> 并引入本脚本（在 pwa.js 旁边）
 * ============================================================ */
(function () {
 const KEY = 'mtpe_account';
 /* 只放三个流程页：品牌本身就是"回首页"（比一个小 tab 更好点，是通用约定），
    所以不再单列「首页」——否则在首页上它是个死链接，在别处又与品牌重复。
    顺序与全站「找 → 改 → 测」一致。 */
 const TABS = [
   { href: 'annotate.html', file: 'annotate.html', label: '① 找' },
   { href: 'practice.html', file: 'practice.html', label: '② 改' },
   { href: 'pe-exam.html',  file: 'pe-exam.html',  label: '③ 测' }
 ];
 function render() {
 const host = document.getElementById('mtpe-nav');
 if (!host) return;
 const cur = location.pathname.split('/').pop() || 'index.html';
 /* 2026-10-17 工作台 v2：首页改用侧边栏导航（wb-side），顶栏只服务二级页——
    首页上顶栏与侧边栏重复，整条撤掉（品牌回首页的职责由侧边栏 logo 承担）。 */
 if (cur === 'index.html') { host.innerHTML = ''; return; }
 const acc = localStorage.getItem(KEY) || '';
 const tabs = TABS.map((t) => '<a class="mtpe-tab' + (t.file === cur ? ' on' : '') + '" href="' + t.href + '">' + t.label + '</a>').join('');
 host.innerHTML = '<div class="mtpe-nav">'
 + '<div class="mtpe-brand" onclick="location.href=\'index.html\'" title="回到首页"><span class="logo">译</span><span class="mtpe-brand-t">译后编辑实训平台</span></div>'
 + '<span class="mtpe-tabs">' + tabs + '</span>'
 + '<span class="mtpe-spacer"></span>'
 + '<a class="mtpe-tab plain hidden" id="mtpe-install" href="#" onclick="mtpeInstall();return false" title="装成桌面应用，断网也能用">安装到桌面</a>'
 + '<a class="mtpe-tab plain" href="stats.html" title="我的统计：练习得分 / 标注能力 / 仿真训练画像，并可导出作业">我的统计</a>'
 + '<a class="mtpe-tab plain" href="settings.html" title="我的设置：账号信息 / 姓名 / 帮助">设置</a>'
 + '<a class="mtpe-tab plain" href="#" onclick="(window.mtpeHelp||function(){})();return false" title="帮助：流程说明 / 计分口径 / 数据来源 / 常见问题">?</a>'
 + (acc
   ? '<span class="mtpe-acc" title="已登录">' + acc + '</span><a class="mtpe-tab plain" href="#" onclick="mtpeLogout();return false">退出</a>'
   : '<a class="mtpe-tab plain" href="#" onclick="(window.mtpeShowLogin||function(){location.reload();})();return false">登录</a>')
 + '</div>'
 + '<style>'
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
 + '@media (max-width:600px){.mtpe-brand-t{display:none}.mtpe-tab{padding:6px 10px;font-size:13px}}'
 + '</style>';
 const bar = host.querySelector('.mtpe-nav');
 if (bar) {
 const setH = () => document.documentElement.style.setProperty('--mtpe-nav-h', bar.offsetHeight + 'px');
 setH();
 window.addEventListener('resize', setH);
 }
 /* 安装按钮：仅在浏览器确认可安装时出现（file:// 或已安装时不出现） */
 const syncInstall = () => {
 const b = document.getElementById('mtpe-install');
 if (b) b.classList.toggle('hidden', !(window.mtpeCanInstall && window.mtpeCanInstall()));
 };
 if (bar) {
 document.addEventListener('mtpe-install-changed', syncInstall);
 document.addEventListener('mtpe-installed', syncInstall);
 syncInstall();
 }
 }
/* 供"整页重绘"的页面使用：仿真训练会整体替换 body.innerHTML，重绘后要重新挂上顶栏 */
window.mtpeNavRender = render;
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
 else render();
})();
