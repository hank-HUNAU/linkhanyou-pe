/* ============================================================
 * nav.js — 全站共享顶栏（两端：实训端 / 教学端）
 * 说明：教学端口令以 PBKDF2-SHA256（加盐 + 20 万次迭代）摘要校验，口令本身不落盘、
 * 无法从代码反推。注意：静态站点上"页面内容"仍可被直接打开，口令只保护入口与管理动作；
 * 需要真正防外泄时，请把 teacher.html / review.html 移出公开仓库（本地或私有部署）。
 * 用法：页面放 <div id="mtpe-nav"></div> 并引入本脚本
 * ============================================================ */
(function () {
 const TEACHER_SALT = 'mtpe-trainer-2026';
 const TEACHER_ITER = 200000;
 const TEACHER_DIGEST = 'lCpns0JZ7xa/VV1MDhMDiV8/VKSHQ03RfcjqpynR4U4=';
 const KEY = 'mtpe_role';
 async function digestOf(pwd) {
 const enc = new TextEncoder();
 const key = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveBits']);
 const bits = await crypto.subtle.deriveBits(
 { name: 'PBKDF2', salt: enc.encode(TEACHER_SALT), iterations: TEACHER_ITER, hash: 'SHA-256' }, key, 256);
 return btoa(String.fromCharCode(...new Uint8Array(bits)));
 }
 const isTeacher = () => localStorage.getItem(KEY) === 'teacher';
 function setTeacher(v) { v ? localStorage.setItem(KEY, 'teacher') : localStorage.removeItem(KEY); }

 window.askTeacherLogin = async function () {
 if (isTeacher()) { location.href = 'teacher.html'; return; }
 const pwd = prompt('教学端口令：');
 if (pwd == null) return;
 if (!(window.crypto && crypto.subtle)) { alert('当前环境不支持安全校验，请用 https 或较新的浏览器打开。'); return; }
 try {
 if (await digestOf(pwd) === TEACHER_DIGEST) { setTeacher(true); location.href = 'teacher.html'; }
 else alert('口令不正确');
 } catch (e) { alert('校验失败：' + e); }
 };
 window.toggleTeacher = function () {
 if (isTeacher()) { setTeacher(false); alert('已退出教学端，返回实训端'); location.reload(); }
 else askTeacherLogin();
 };
 window.mtpeIsTeacher = isTeacher;

 function render() {
 const host = document.getElementById('mtpe-nav');
 if (!host) return;
 const cur = (location.pathname.split('/').pop() || 'index.html');
 const teacher = isTeacher();
 host.innerHTML = `
 <div class="mtpe-nav">
 <div class="mtpe-brand" onclick="location.href='index.html'"><span class="logo">译</span>译后编辑实训平台</div>
 <span class="mtpe-tabs"><a class="mtpe-tab ${cur === 'teacher.html' || cur === 'review.html' ? '' : 'on'}" href="index.html">实训端</a>
 ${teacher ? `<a class="mtpe-tab ${cur === 'teacher.html' || cur === 'review.html' ? 'on' : ''}" href="teacher.html">教学端</a>`
 : `<a class="mtpe-tab" href="#" title="需要口令" onclick="askTeacherLogin();return false">教学端（需口令）</a>`}</span>
 <span style="flex:1"></span>
 ${typeof window.askNickname === 'function' ? `<a class="mtpe-tab" href="#" onclick="askNickname();return false"> ${(localStorage.getItem('mtpe_nickname')||'"匿名"').replace(/"/g,'')||'未设置昵称'}</a>` : ''}
 ${teacher ? `<a class="mtpe-tab plain" href="#" onclick="toggleTeacher();return false">退出教学端</a>`
 : `<a class="mtpe-tab plain" href="#" onclick="askTeacherLogin();return false">教学登录</a>`}
 </div>
 <style>
        /* 顶栏吸顶：页面内的次级吸顶元素用 --mtpe-nav-h 让位（由下方脚本按实测高度写入） */
        #mtpe-nav{position:sticky;top:0;z-index:60}
        .mtpe-nav{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.72);
          backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid rgba(0,0,0,.08);
          padding:10px 18px;font:14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif}
        .mtpe-brand{font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;color:#1d1d1f}
        .mtpe-brand .logo{display:inline-flex;width:26px;height:26px;border-radius:8px;background:#0071e3;color:#fff;
          align-items:center;justify-content:center;font-size:13px;font-weight:600}
        .mtpe-tabs{display:inline-flex;background:rgba(0,0,0,.05);border-radius:9px;padding:2px;gap:2px}
        .mtpe-tab{color:#1d1d1f;text-decoration:none;padding:6px 14px;border-radius:7px;font-size:14px;
          display:inline-flex;align-items:center;transition:all .15s ease}
        .mtpe-tab:hover{color:#0071e3}
        .mtpe-tab.on{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06);font-weight:500;color:#1d1d1f}
        .mtpe-tab.plain{color:#0071e3}
        .mtpe-tab.plain:hover{background:rgba(0,0,0,.04)}
 </style>`;
 /* 把顶栏实际高度写入 CSS 变量，供 .exam-top / .side-panel / annotate .top 等次级吸顶元素对齐 */
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
