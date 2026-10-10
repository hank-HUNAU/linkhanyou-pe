/* ============================================================
 * nav.js — 全站共享顶栏（实训端 + 账号状态）
 * 登录 / 解密逻辑在 unlock.js（配 secure.js）；本文件只负责渲染顶栏。
 * 教师登录按钮与相关代码已移除；教学端仅本地使用（不发布）。
 * 用法：页面放 <div id="mtpe-nav"></div> 并引入本脚本
 * ============================================================ */
(function () {
 const KEY = 'mtpe_account';
 function render() {
 const host = document.getElementById('mtpe-nav');
 if (!host) return;
 const cur = location.pathname.split('/').pop() || 'index.html';
 const acc = localStorage.getItem(KEY) || '';
 host.innerHTML = '<div class="mtpe-nav">'
 + '<div class="mtpe-brand" onclick="location.href=\'index.html\'"><span class="logo">译</span>译后编辑实训平台</div>'
 + '<span class="mtpe-tabs"><a class="mtpe-tab ' + (cur === 'teacher.html' || cur === 'review.html' ? '' : 'on') + '" href="index.html">实训端</a></span>'
 + '<span style="flex:1"></span>'
 + (acc
   ? '<span class="mtpe-acc" title="已登录">' + acc + '</span><a class="mtpe-tab plain" href="#" onclick="mtpeLogout();return false">退出</a>'
   : '<a class="mtpe-tab plain" href="#" onclick="(window.mtpeShowLogin||function(){location.reload();})();return false">登录</a>')
 + '</div>'
 + '<style>'
 + '#mtpe-nav{position:sticky;top:0;z-index:60}'
 + '.mtpe-nav{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.08);padding:10px 18px;font:14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif}'
 + '.mtpe-brand{font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;color:#1d1d1f}'
 + '.mtpe-brand .logo{display:inline-flex;width:26px;height:26px;border-radius:8px;background:#0071e3;color:#fff;align-items:center;justify-content:center;font-size:13px;font-weight:600}'
 + '.mtpe-tabs{display:inline-flex;background:rgba(0,0,0,.05);border-radius:9px;padding:2px;gap:2px}'
 + '.mtpe-tab{color:#1d1d1f;text-decoration:none;padding:6px 14px;border-radius:7px;font-size:14px;display:inline-flex;align-items:center;transition:all .15s ease}'
 + '.mtpe-tab:hover{color:#0071e3}.mtpe-tab.on{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);font-weight:500}'
 + '.mtpe-tab.plain{color:#0071e3}.mtpe-tab.plain:hover{background:rgba(0,0,0,.04)}'
 + '.mtpe-acc{font-size:13px;color:#6e6e73;font-variant-numeric:tabular-nums}'
 + '</style>';
 const bar = host.querySelector('.mtpe-nav');
 if (bar) {
 const setH = () => document.documentElement.style.setProperty('--mtpe-nav-h', bar.offsetHeight + 'px');
 setH();
 window.addEventListener('resize', setH);
 }
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
 else render();
})();
