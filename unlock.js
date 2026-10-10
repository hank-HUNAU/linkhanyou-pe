/* ============================================================
 * unlock.js — 登录解锁（本地内置账号）
 * 流程：口令 → PBKDF2 派生 KEK → 解开内容密钥 → AES-GCM 解密语料明文
 *      → 明文只放本标签页 sessionStorage → 重载页面供各页面脚本读取
 * 边界说明：语料明文不在站点里，只有 key 解开才拿得到。
 *   把本文件删掉 = 没有钥匙 = corpus.js/annotate-data.js 注水桩取不到数据 = 页面无内容可用。
 * 因此"删掉校验就能绕过"在这里不成立（AES-GCM 同时保证密文被改就解不开）。
 * ============================================================ */
(function () {
 const KEY = 'mtpe_account';
 const PAY = 'mtpe_payload';
 const NO_GATE = ['teacher.html', 'review.html'];
 const seal = window.__MTPE_SEAL__ || null;
 const enc = new TextEncoder();
 const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
 const page = () => (location.pathname.split('/').pop() || 'index.html');

 window.mtpeLogout = function () {
 try { sessionStorage.removeItem(PAY); } catch (e) {}
 localStorage.removeItem(KEY);
 location.reload();
 };

 async function kekOf(pwd, salt) {
 const km = await crypto.subtle.importKey('raw', enc.encode(pwd), 'PBKDF2', false, ['deriveBits']);
 const bits = await crypto.subtle.deriveBits(
 { name: 'PBKDF2', salt: enc.encode(salt), iterations: seal.iter, hash: 'SHA-256' }, km, 256);
 return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
 }

 window.mtpeUnlock = async function () {
 const idEl = document.getElementById('mtpe-acc');
 const pwEl = document.getElementById('mtpe-pw');
 const err = document.getElementById('mtpe-login-err');
 const fail = (m) => { if (err) { err.textContent = m; err.style.display = 'block'; } };
 const id = ((idEl && idEl.value) || '').trim();
 const k = seal && seal.keys ? seal.keys.filter((x) => x.id === id)[0] : null;
 if (!k) return fail('账号不存在');
 if (!(window.crypto && crypto.subtle)) return fail('当前环境不支持安全校验，请用 https 或较新的浏览器打开');
 const btn = document.getElementById('mtpe-login-btn');
 if (btn) { btn.disabled = true; btn.textContent = '解锁中…'; }
 if (err) err.style.display = 'none';
 try {
 const kek = await kekOf(pwEl ? pwEl.value : '', k.salt);
 let rawKey;
 try { rawKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(k.iv) }, kek, b64d(k.wrap)); }
 catch (e) { throw new Error('密码不正确'); }
 const ck = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
 const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(seal.nonce) }, ck, b64d(seal.data));
 sessionStorage.setItem(PAY, new TextDecoder().decode(plain));
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

 if (!seal) console.error('secure.js 未加载：语料密文缺失');
 if (NO_GATE.indexOf(page()) < 0) {
 let unlocked = false;
 try { unlocked = !!sessionStorage.getItem(PAY); } catch (e) {}
 if (!unlocked) gate();
 }
})();
