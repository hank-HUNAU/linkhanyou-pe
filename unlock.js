/* ============================================================
 * unlock.js — 登录解锁 + 语料分片按需解密
 *
 * 流程：口令 → PBKDF2 派生 KEK → 解开【内容密钥 CK】→ 把 CK 存本机
 *      （不再把 1.2MB 明文整包塞进 localStorage）。
 *      各二级页要哪片，再用 CK 现解哪片，明文只在内存里。
 *
 * 为什么要分片：整包加密时，打开首屏必须先下 476KB 密文（校园网十几秒）。
 *   现在登录只下【密钥环 + 元数据片】（约 10KB），
 *   「改 / 测」页用到才下 s-tasks.js，「找」页用到才下 s-pairs.js。
 *
 * 有效期 12 小时：过期即视为未登录，自动清掉本机 CK。
 * 点「退出」立即清掉 CK 与账号，公共机房用完即走。
 *
 * 安全边界：语料明文不在站点里，只有口令才解得开内容密钥。
 *   删掉本文件 / 删掉校验代码 = 没有 CK = 分片解不开 = 页面无内容。
 *   AES-GCM 同时保证：密文或分片被改一下，就解不出来（不做静默降级）。
 * ============================================================ */
(function () {
  const KEY = 'mtpe_account';        // 当前账号
  const CK = 'mtpe_ck';              // 内容密钥（base64），不是明文语料
  const CKTS = 'mtpe_ck_ts';         // 解锁时刻
  const TTL = 12 * 60 * 60 * 1000;   // 有效期：12 小时
  const SEAL_SRC = 'secure.js';      // 密钥环 + meta 片：只在"登录解锁"时需要
  const SHARD_SRC = (n) => 's-' + n + '.js';
  const LEGACY = ['mtpe_payload', 'mtpe_payload_ts'];
  const NO_GATE = ['teacher.html', 'review.html'];
  const enc = new TextEncoder();
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const page = () => (location.pathname.split('/').pop() || 'index.html');
  const sealNow = () => window.__MTPE_SEAL__ || null;

  /* ---- 密钥环按需加载（首屏关键路径上没有它） ---- */
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
    sealLoading.catch(function () {});
    return sealLoading;
  }
  window.mtpeSealReady = sealReady;

  /* 空闲时预取密钥环：只有 10KB，让登录那一下不用等 */
  window.mtpePrefetchSeal = function () {
    if (sealNow() || window.mtpeLoggedIn()) return;
    try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
    sealReady();
  };

  /* ---- 内容密钥：只存 CK，不存明文 ---- */
  let ckPromise = null;
  window.mtpeKey = function () {
    if (ckPromise) return ckPromise;
    ckPromise = (async function () {
      try {
        /* 旧版把 1.2MB 明文放在 localStorage：升级后一律清掉，强制重登一次 */
        LEGACY.forEach(function (k) { localStorage.removeItem(k); });
        LEGACY.forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
        const v = localStorage.getItem(CK);
        const ts = parseInt(localStorage.getItem(CKTS) || '0', 10);
        if (!v || !ts || Date.now() - ts > TTL || Date.now() < ts) {
          localStorage.removeItem(CK); localStorage.removeItem(CKTS);
          return null;
        }
        return await crypto.subtle.importKey('raw', b64d(v), 'AES-GCM', false, ['decrypt']);
      } catch (e) { return null; }
    })();
    return ckPromise;
  };

  /* 是否已解锁（同步判断，供界面用；密钥还没解析完时也准） */
  window.mtpeLoggedIn = function () {
    try {
      const v = localStorage.getItem(CK);
      const ts = parseInt(localStorage.getItem(CKTS) || '0', 10);
      return !!(v && ts && Date.now() - ts <= TTL && Date.now() >= ts);
    } catch (e) { return false; }
  };

  /* 剩余有效期（毫秒），未解锁返回 0 */
  window.mtpeKeyLeft = function () {
    try {
      const ts = parseInt(localStorage.getItem(CKTS) || '0', 10);
      if (!ts || !localStorage.getItem(CK)) return 0;
      return Math.max(0, TTL - (Date.now() - ts));
    } catch (e) { return 0; }
  };

  window.mtpeLogout = function () {
    try { localStorage.removeItem(CK); localStorage.removeItem(CKTS); } catch (e) {}
    try { localStorage.removeItem(KEY); } catch (e) {}
    LEGACY.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    location.reload();
  };

  /* 当前登录账号（导出作业带学号用） */
  window.mtpeAccount = function () {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  };

  /* ---- 解密后的分片（只在内存里，不落盘） ---- */
  const sliceCache = {};

  async function unzipIfNeeded(buf) {
    const s = sealNow();
    if (!(s && s.zip)) return buf;
    if (typeof DecompressionStream !== 'function') {
      throw new Error('当前浏览器版本过旧，无法解压语料：请用较新的 Chrome / Edge / Safari 打开');
    }
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function loadShard(name, ver) {
    return new Promise(function (resolve) {
      const bag = window.__MTPE_SHARDS__;
      if (bag && bag[name]) return resolve(bag[name]);
      let s;
      try { s = document.createElement('script'); } catch (e) { return resolve(null); }
      /* 带版本指纹：部署后不会"新密钥配旧分片"。
         只在 http/https 下加（file:// 直接双击打开时不带查询串，避免个别浏览器把它当成文件名）。 */
      const useVer = ver && location.protocol !== 'file:';
      s.src = SHARD_SRC(name) + (useVer ? '?v=' + ver : '');
      s.async = true;
      s.onload = function () { resolve((window.__MTPE_SHARDS__ || {})[name] || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  /* 取一片（'tasks' / 'pairs' / 'meta'）——同一次会话里只解一次 */
  window.mtpeEnsureSlice = function (name) {
    if (sliceCache[name]) return sliceCache[name];
    const p = (async function () {
      const ok = await sealReady();
      const seal = sealNow();
      /* 取不到就明确报错：注水桩会置 __MTPE_SLICE_FAIL__，页面给出提示，
         而不是静悄悄地渲染一个空页面（学生分不清"这卷没内容"和"没加载出来"）。 */
      if (!ok || !seal) throw new Error('密钥环没能加载（' + SEAL_SRC + '）');
      const ck = await window.mtpeKey();
      if (!ck) throw new Error('本机没有内容密钥：请重新登录');
      const open = async function (nonce, data) {
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(nonce) }, ck, b64d(data));
        const bytes = await unzipIfNeeded(plain);
        return JSON.parse(new TextDecoder().decode(bytes));
      };
      if (name === 'meta') return open(seal.nonce, seal.data);   // meta 片就在密钥环文件里
      const info = (seal.shards || {})[name];
      if (!info) throw new Error('这份密钥里没有' + name + '片的清单');
      const ct = await loadShard(name, seal.ver);
      if (!ct) throw new Error('分片下载失败（' + SHARD_SRC(name) + '）');
      return open(info.nonce, ct);
    })();
    sliceCache[name] = p;
    p.catch(function () { delete sliceCache[name]; });
    return p;
  };

  /* 页面脚本等语料就绪后再执行（corpus.js / annotate-data.js 会先挂 __MTPE_READY__） */
  window.mtpeBoot = function (src) {
    const ready = window.__MTPE_READY__ || Promise.resolve();
    ready.then(function () { return window.mtpeKey(); }).then(function (ck) {
      if (!ck) { window.mtpeShowLogin(); return; }    // 没解锁：登录框已经盖在上面，不必渲染半空的页面
      if (window.__MTPE_SLICE_FAIL__) { window.mtpeBootFallback(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      document.head.appendChild(s);
    }).catch(function (e) {
      if (window.console) console.error('页面启动失败：', e);
    });
  };

  /* 打不开时的兜底提示（语料解不开、密钥过期都不至于白屏） */
  window.mtpeBootFallback = function (msg) {
    const app = document.getElementById('app');
    /* 直接覆盖：启动骨架会一直在 #app 里，不能靠"内容为空"来判断要不要出提示 */
    if (app) {
      app.innerHTML = '<div style="max-width:560px;margin:80px auto;padding:24px;font:15px/1.8 -apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',sans-serif;color:#6e6e73">'
        + '<h2 style="color:#1d1d1f;font-size:19px;margin:0 0 8px">语料没有加载出来</h2>'
        + (msg || '请检查网络后刷新页面；若提示登录，请重新输入账号口令。')
        + '<div style="margin-top:16px"><a href="index.html" style="color:#0071e3">返回首页</a>　<a href="#" onclick="mtpeLogout();return false" style="color:#0071e3">重新登录</a></div></div>';
    }
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
      return fail('密钥文件没能加载：请检查网络后重试');
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
      /* 真解锁一次 meta 片：既验证口令，也确认密钥真的能开本站的语料
         （口令对但分片对不上时，宁可现在报错，也不要进去看到空页面） */
      const ck = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(seal.nonce) }, ck, b64d(seal.data));
      await unzipIfNeeded(plain);      // 顺带验证 gzip 头
      const raw64 = btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey)));
      localStorage.setItem(CK, raw64);
      localStorage.setItem(CKTS, String(Date.now()));
      localStorage.setItem(KEY, id);
      localStorage.setItem('mtpe_nickname', JSON.stringify(id));
      LEGACY.forEach(function (x) { try { localStorage.removeItem(x); } catch (e) {} });
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
    window.mtpeKey().then(function (ck) { if (!ck) gate(); });
  }

  /* 首屏渲染完、页面空下来后再悄悄预取密钥环（10KB，不阻塞打开页面） */
  function schedulePrefetch() {
    const fire = () => setTimeout(() => window.mtpePrefetchSeal(), 800);
    if (document.readyState === 'complete') fire();
    else window.addEventListener('load', fire);
  }
  schedulePrefetch();
})();
