/* ============================================================
 * unlock.js — 登录解锁（本地内置账号）
 * 流程：口令 → PBKDF2 派生 KEK → 解开内容密钥 → AES-GCM 解密语料明文
 *      → 明文放本机 localStorage → 重载页面供各页面脚本读取
 * 密文（secure.js）按需加载：首屏不加载它，已登录时完全不需要；
 *   只有要输入口令时才下载，并在页面空下来后悄悄预取，登录时通常已就绪。
 *
 * 为什么放 localStorage：一级首页登录一次，随后在 找 / 改 / 考 三个二级页
 *   之间往返不必再次输入口令（sessionStorage 按标签页隔离，换标签就会再问一次）。
 * 两条护栏：
 *   ① 有效期 12 小时，超时自动失效，回到首页需重新登录；
 *   ② 点「退出」立即清空明文与账号，公共机房用完即走，不留可用的语料副本。
 *
 * 安全边界：语料明文不在站点里，只有钥匙才解得开。
 *   删掉本文件 = 没有钥匙 = corpus.js / annotate-data.js 注水桩取不到数据 = 页面无内容可用。
 *   因此"删掉校验就能绕过"在这里不成立（AES-GCM 同时保证密文被改就解不开）。
 * ============================================================ */
(function () {
  const KEY = 'mtpe_account';
  const PAY = 'mtpe_payload';        // 明文载荷（本机共享，带时效）
  const TS = 'mtpe_payload_ts';      // 解锁时刻
  const TTL = 12 * 60 * 60 * 1000;   // 有效期：12 小时
  const SEAL_SRC = 'secure.js';      // 语料密文：只在"登录解锁"时需要，按需加载
  const NO_GATE = ['teacher.html', 'review.html'];
  const enc = new TextEncoder();
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const page = () => (location.pathname.split('/').pop() || 'index.html');
  const sealNow = () => window.__MTPE_SEAL__ || null;

  /* ---- 密文按需加载（首屏关键路径上不再有 1.2MB 的 secure.js） ---- */
  let sealLoading = null;
  function sealReady() {
    if (sealNow()) return Promise.resolve(true);
    if (sealLoading) return sealLoading;
    sealLoading = new Promise(function (resolve) {
      let s;
      try { s = document.createElement('script'); } catch (e) { return resolve(false); }
      s.src = SEAL_SRC;
      s.async = true;
      s.onload = function () { resolve(!!sealNow()); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return sealLoading;
  }
  window.mtpeSealReady = sealReady;

  /* 空闲时预取密文：已登录不下载；浏览器开了省流量模式也不下载 */
  window.mtpePrefetchSeal = function () {
    if (sealNow() || window.mtpePayload()) return;
    try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
    sealReady();
  };

  /* 解密后按需 gzip 解压（加封时先压缩，下载体积小 3 倍以上） */
  async function unzipIfNeeded(buf) {
    const s = sealNow();
    if (!(s && s.zip)) return buf;
    if (typeof DecompressionStream !== 'function') {
      throw new Error('当前浏览器版本过旧，无法解压语料：请用较新的 Chrome / Edge / Safari 打开');
    }
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* 语料明文读取口：corpus.js / annotate-data.js 注水桩都从这里取。
     带过期判定，过期即视为未登录，并顺手清掉本机残留的明文。 */
  window.mtpePayload = function () {
    try {
      const v = localStorage.getItem(PAY);
      if (!v) return null;
      const ts = parseInt(localStorage.getItem(TS) || '0', 10);
      if (!ts || Date.now() - ts > TTL || Date.now() < ts) {
        localStorage.removeItem(PAY); localStorage.removeItem(TS);
        return null;
      }
      return v;
    } catch (e) { return null; }
  };

  /* 剩余有效期（毫秒），供界面提示用；没有明文时返回 0 */
  window.mtpePayloadLeft = function () {
    try {
      const ts = parseInt(localStorage.getItem(TS) || '0', 10);
      if (!ts || !localStorage.getItem(PAY)) return 0;
      return Math.max(0, TTL - (Date.now() - ts));
    } catch (e) { return 0; }
  };

  window.mtpeLogout = function () {
    try { sessionStorage.removeItem(PAY); } catch (e) {}
    try { localStorage.removeItem(PAY); localStorage.removeItem(TS); } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };

  async function kekOf(pwd, salt) {
    const km = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: sealNow().iter, hash: 'SHA-256' }, km, 256);
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
  }

  window.mtpeUnlock = async function () {
    const idEl = document.getElementById('mtpe-acc');
    const pwEl = document.getElementById('mtpe-pw');
    const err = document.getElementById('mtpe-login-err');
    const btn = document.getElementById('mtpe-login-btn');
    const fail = (m) => { if (err) { err.textContent = m; err.style.display = 'block'; } };
    const id = ((idEl && idEl.value) || '').trim();
    if (!(window.crypto && crypto.subtle)) return fail('当前环境不支持安全校验，请用 https 或较新的浏览器打开');
    if (btn) { btn.disabled = true; btn.textContent = sealNow() ? '解锁中…' : '准备语料中…'; }
    if (err) err.style.display = 'none';
    const okSeal = await sealReady();
    const seal = sealNow();
    if (!okSeal || !seal) {
      if (btn) { btn.disabled = false; btn.textContent = '登录'; }
      return fail('语料密文没能加载：请检查网络后重试');
    }
    const k = seal.keys ? seal.keys.filter((x) => x.id === id)[0] : null;
    if (!k) {
      if (btn) { btn.disabled = false; btn.textContent = '登录'; }
      return fail('账号不存在');
    }
    if (btn) btn.textContent = '解锁中…';
    try {
      const kek = await kekOf(pwEl ? pwEl.value : '', k.salt);
      let rawKey;
      try { rawKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(k.iv) }, kek, b64d(k.wrap)); }
      catch (e) { throw new Error('密码不正确'); }
      const ck = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(seal.nonce) }, ck, b64d(seal.data));
      const bytes = await unzipIfNeeded(plain);
      localStorage.setItem(PAY, new TextDecoder().decode(bytes));
      localStorage.setItem(TS, String(Date.now()));
      try { sessionStorage.removeItem(PAY); } catch (e) {}    // 清掉旧版残留
      localStorage.setItem(KEY, id);
      localStorage.setItem('mtpe_nickname', JSON.stringify(id));
      location.reload();
    } catch (e) {
      fail(String(e.message || e));
      if (btn) { btn.disabled = false; btn.textContent = '登录'; }
    }
  };

  window.mtpeShowLogin = function () {
    if (document.getElementById('mtpe-login')) return;
    gate();
  };

  function gate() {
    if (NO_GATE.indexOf(page()) >= 0) return;
    if (!document.getElementById('mtpe-login-style')) {
      const st = document.createElement('style');
      st.id = 'mtpe-login-style';
      st.textContent = '#mtpe-login{position:fixed;inset:0;z-index:900;background:#f5f5f7;display:flex;align-items:center;justify-content:center}'
        + '.mtpe-login-card{width:min(380px,92vw);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:26px 24px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 18px 48px rgba(0,0,0,.08);font:15px/1.6 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif}'
        + '.mtpe-login-brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:17px;color:#1d1d1f}'
        + '.mtpe-login-brand .lg{display:inline-flex;width:26px;height:26px;border-radius:8px;background:#0071e3;color:#fff;align-items:center;justify-content:center;font-size:13px}'
        + '.mtpe-login-sub{font-size:12.5px;color:#86868b;margin:6px 0 16px}'
        + '.mtpe-login-card label{display:block;font-size:12.5px;color:#6e6e73;margin:10px 0 4px}'
        + '.mtpe-login-card input{width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.12);border-radius:10px;padding:9px 12px;font-size:15px;font-family:inherit;background:#fff}'
        + '.mtpe-login-card input:focus{outline:none;border-color:#0071e3}'
        + '.mtpe-login-err{display:none;margin-top:10px;font-size:12.5px;color:#d70015;background:#fdeced;border-radius:8px;padding:7px 10px}'
        + '.mtpe-login-btn{margin-top:16px;width:100%;border:none;border-radius:980px;background:#0071e3;color:#fff;padding:11px 0;font-size:15px;font-weight:500;cursor:pointer}'
        + '.mtpe-login-btn:disabled{opacity:.6}'
        ;
      document.head.appendChild(st);
    }
    const d = document.createElement('div');
    d.id = 'mtpe-login';
    d.innerHTML = '<div class="mtpe-login-card">'
      + '<div class="mtpe-login-brand"><span class="lg">译</span>译后编辑实训平台</div>'
      + '<div class="mtpe-login-sub">请使用本地内置账号登录后使用（账号由课程负责人发放）</div>'
      + '<label>账号</label><input id="mtpe-acc" autocomplete="username">'
      + '<label>密码</label><input id="mtpe-pw" type="password" autocomplete="current-password" placeholder="密码">'
      + '<div id="mtpe-login-err" class="mtpe-login-err"></div>'
      + '<button id="mtpe-login-btn" class="mtpe-login-btn" onclick="mtpeUnlock()">登录</button>'
      + '</div>';
    document.body.appendChild(d);
    const enter = (e) => { if (e.key === 'Enter') window.mtpeUnlock(); };
    ['mtpe-acc', 'mtpe-pw'].forEach(function (x) { const el = document.getElementById(x); if (el) el.addEventListener('keydown', enter); });
    const a = document.getElementById('mtpe-acc'); if (a) a.focus();
  }

  if (NO_GATE.indexOf(page()) < 0) {
    /* 旧版把明文放在本标签页 sessionStorage 里：遇到就迁移过来，
       免得升级后正在练的同学被迫重登一次。 */
    try {
      const legacy = sessionStorage.getItem(PAY);
      if (legacy && !localStorage.getItem(PAY)) {
        localStorage.setItem(PAY, legacy);
        localStorage.setItem(TS, String(Date.now()));
        sessionStorage.removeItem(PAY);
      }
    } catch (e) {}
    if (!window.mtpePayload()) gate();
  }

  /* 首屏渲染完、页面空下来后再悄悄预取密文（不阻塞打开页面） */
  function schedulePrefetch() {
    const fire = () => setTimeout(() => window.mtpePrefetchSeal(), 800);
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire);
  }
  schedulePrefetch();
})();
