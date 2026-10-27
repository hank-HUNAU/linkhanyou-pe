/* ============================================================
 * settings.js — 「我的设置」（settings.html 专用，2026-10-17 新增）
 *
 * 工作台首页改版后，原首页里的账号/帮助入口收拢到这里：
 *   ① 账号信息：登录账号、姓名/学号（可改，改完自动"认领"旧记录）、
 *      登录有效期、安装到桌面、退出登录
 *   ② 帮助信息：帮助弹窗（与全站 ? 同一份口径）、MQM 手册、数据来源与局限
 * 不加载语料，打开与统计页一样快。
 * ============================================================ */
(function () {
  const app = document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('mtpe_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mtpe_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._m); t._m = setTimeout(() => { t.style.opacity = '0'; }, 2400);
  }

  function render() {
    const acc = (window.mtpeAccount && window.mtpeAccount()) || '（未登录）';
    const nick = store.get('nickname', '') || '';
    const named = !!store.get('nickname_set', 0);
    const left = (window.mtpeKeyLeft && window.mtpeKeyLeft()) || 0;
    const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000);
    const valid = left > 0 ? h + ' 小时 ' + m + ' 分' : '已过期（重新登录即可）';

    app.innerHTML = `
 <div class="page-title"><h2>我的设置</h2></div>

 <div class="board"><h3>账号信息</h3>
 <table>
  <tr><th style="width:130px">登录账号</th><td><b>${esc(acc)}</b><span class="muted" style="margin-left:8px;font-size:12.5px">课上统一发放的共享账号，成绩按下面的"姓名/学号"区分归属</span></td></tr>
  <tr><th>姓名／学号</th><td>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input id="set-nick" maxlength="20" placeholder="例如：2024级翻译2班 张三" value="${esc(named ? nick : '')}" style="flex:1;min-width:200px;padding:9px 12px;border:1px solid rgba(0,0,0,.15);border-radius:10px;font-size:14px">
      <button class="btn btn-primary" onclick="mtpeSettingsSaveNick()">保存</button>
    </div>
    <div class="muted" style="font-size:12.5px;margin-top:6px">${named ? '当前：' + esc(nick) + '（改成新名字后，旧记录自动归属到新名字）' : '还没填写——导出作业与班级汇总会认不出你'}</div>
  </td></tr>
  <tr><th>登录有效期</th><td>${esc(valid)}</td></tr>
 </table>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
   <button id="mtpe-install-btn" class="btn btn-ghost hidden" onclick="mtpeInstall()">安装到桌面</button>
   <button class="btn btn-outline" onclick="if(window.mtpeLogout)mtpeLogout()">退出登录</button>
 </div>
 </div>

 <div class="board"><h3>帮助信息</h3>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px">
   <button class="btn btn-primary" onclick="if(window.mtpeHelp)mtpeHelp()">打开帮助（流程 / 计分口径 / 常见问题）</button>
   <a class="btn btn-ghost" href="MQM错误类型参考手册.html" style="text-decoration:none">MQM 错误类型参考手册</a>
   <a class="btn btn-ghost" href="champion.html" style="text-decoration:none">能力对标</a>
 </div>
 <p class="muted" style="line-height:1.9;margin:0">
   数据来源与局限：语料来自历届机器翻译译后编辑大赛真题；第 3 / 5 届官方未公布机翻底稿，平台使用
   <b>DeepSeek-V3 重构底稿</b>并在卷名中如实标注（非官方底稿）。得分基于与参考译文的词级重合度，
   仅用于自我纵向对比，不构成对翻译能力的官方评价。作答记录保存在<b>本机浏览器</b>里，换电脑或清缓存后
   可用「我的统计」导出／导入作业 JSON 恢复。
 </p>
 </div>`;
    window.mtpeInstallSync('mtpe-install-btn');
  }

  /* 改姓名：保存+认领统一走 unlock.js 的 mtpeSaveNick（2026-10-27 收口） */
  window.mtpeSettingsSaveNick = function () {
    const el = document.getElementById('set-nick');
    const v = ((el && el.value) || '').trim();
    if (!v) { toast('请填写姓名或学号后再保存'); return; }
    window.mtpeSaveNick(v);
    toast('已保存：' + v);
    render();
  };

  window.mtpeBindInstall('mtpe-install-btn');

  render();
})();
