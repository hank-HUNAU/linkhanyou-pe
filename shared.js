/* ============================================================
 * shared.js — store / toast 单一正本（2026-11-02 第二批收口）
 * 背景（UI 评估 fe/visual 组）：store 曾有 4 份逐字拷贝、toast 有 6 份定义，
 * 参数各自漂移（2000/2200/2400ms、hidden 类 vs opacity 两套显隐机制）。
 * 收口后：所有页面先加载本文件，再加载页面脚本；页面内不再自定义。
 *
 * 加载方式：同步 <script> 放在 unlock.js 之后、mtpeBoot 之前——
 * 经典脚本按文档顺序执行，保证页面脚本运行时全局已就绪。
 * ============================================================ */

/* localStorage 封装（键前缀可定制）。set 不吞配额错误：
   app.js 的 saveHistory 抗爆仓策略依赖 set 抛出 QuotaExceeded 来逐级瘦身，
   这里静默失败会让该策略失效——调用方自己决定要不要 try/catch。 */
function mtpeMakeStore(prefix) {
  return {
    get(k, d) { try { const v = localStorage.getItem(prefix + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { localStorage.setItem(prefix + k, JSON.stringify(v)); },
    del(k) { localStorage.removeItem(prefix + k); }
  };
}
/* 全局正本：mtpe_ 前缀（app/stats/settings 原用此前缀）。
   注意：annotate(ann_)/pe-exam(ycx_)/champion(mtpe_champ_) 是各自独立的
   命名空间（机房共用账号下隔离数据），不得统一——它们在页面内用
   mtpeMakeStore('<自己的前缀>') 取一份，仅消除重复实现，不动键名。 */
window.store = mtpeMakeStore('mtpe_');

/* toast 单一正本。兼容三种旧用法：
   · app/champion 的 hidden 类显隐（show 时 remove，hide 时靠 opacity）
   · annotate/pe-exam/stats/settings 的 opacity 显隐
   · stats/settings 元素缺失时自动创建 #toast
   统一为 opacity 机制（ui.css #toast 有 transition + :empty 兜底）；
   超时取各版最大值 2400ms。 */
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.opacity = '1';
  clearTimeout(t._mtpeTm);
  t._mtpeTm = setTimeout(() => { t.style.opacity = '0'; }, 2400);
}
