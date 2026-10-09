/* ============================================================
 * nav.js — 全站共享顶栏（两个主 tab + 教师入口）
 * 说明：教师登录是【角色切换】不是【安全鉴权】——口令以 FNV-1a 摘要存放，
 * 仅用于把教师管理功能收拢，公开部署时请勿依赖它保护内容。
 * 用法：页面放 <div id="mtpe-nav"></div> 并引入本脚本
 * ============================================================ */
(function () {
 const TEACHER_HASH = 0x10fd1a44; // FNV-1a('hankyou')
 const KEY = 'mtpe_role';
 const fnv1a = (s) => {
 let h = 0x811c9dc5;
 for (let i = 0; i < s.length; i++) {
 h ^= s.charCodeAt(i);
 h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
 }
 return h >>> 0;
 };
 const isTeacher = () => localStorage.getItem(KEY) === 'teacher';
 function setTeacher(v) { v ? localStorage.setItem(KEY, 'teacher') : localStorage.removeItem(KEY); }

 window.askTeacherLogin = function () {
 if (isTeacher()) { location.href = 'teacher.html'; return; }
 const pwd = prompt('教师口令（仅用于切换教师视图）：');
 if (pwd == null) return;
 if (fnv1a(pwd) === TEACHER_HASH) { setTeacher(true); alert('已进入教师模式'); location.href = 'teacher.html'; }
 else alert('口令不正确');
 };
 window.toggleTeacher = function () {
 if (isTeacher()) { setTeacher(false); alert('已退出教师模式，返回学生视图'); location.reload(); }
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
 <span class="mtpe-tabs"><a class="mtpe-tab ${cur === 'index.html' || cur === 'annotate.html' ? 'on' : ''}" href="index.html"> 译后编辑实训</a>
 <a class="mtpe-tab ${cur === 'pe-exam.html' ? 'on' : ''}" href="pe-exam.html"> 模拟参赛</a></span>
 <span style="flex:1"></span>
 ${typeof window.askNickname === 'function' ? `<a class="mtpe-tab" href="#" onclick="askNickname();return false"> ${(localStorage.getItem('mtpe_nickname')||'"匿名"').replace(/"/g,'')||'未设置昵称'}</a>` : ''}
 ${teacher ? `<a class="mtpe-tab plain" href="teacher.html"> 教师后台</a>
 <a class="mtpe-tab plain" href="#" onclick="toggleTeacher();return false"> 退出教师模式</a>`
 : `<a class="mtpe-tab plain" href="#" onclick="askTeacherLogin();return false"> 教师登录</a>`}
 </div>
 <style>
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
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
 else render();
})();
