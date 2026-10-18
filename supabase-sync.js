/* ============================================================
 * supabase-sync.js — 云端同步（Supabase，云为主 · 本地为底）
 * 设计原则（2026-10-17）：
 *   ① 不动既有 localStorage 架构：云同步是"附加写"，任何失败都不影响本地作答
 *   ② 匿名登录（signInAnonymously）→ 每个学生一个 auth.uid，RLS 按 user_id 隔离
 *   ③ 未开启匿名登录 / 断网 / 报错 → 静默降级纯本地，失败记录进队列稍后重发
 *   ④ 依赖本地 supabase.js（UMD，218KB，进 SW 预缓存，离线可用）
 * 表：students / attempts / annotation_sessions / wrongbook（public，RLS 全开）
 * ============================================================ */
(function () {
  'use strict';

  var URL = 'https://fdvypkybxhkdpvfepskf.supabase.co';
  var KEY = 'sb_publishable_5T_3drNAt7fzqIXrxFc5ww_8yotMUfd';
  var QKEY = 'mtpe_cloud_queue';

  var state = 'off';           // off | connecting | ready | error
  var client = null;
  var uid = null;
  var disabled = false;        // 匿名登录被禁用等永久性失败：本会话不再尝试
  var liveCh = null;           // Realtime broadcast 通道：写库成功后通知教师看板
  var liveOn = false;

  function q() {
    try { return JSON.parse(localStorage.getItem(QKEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function saveQ(list) {
    try { localStorage.setItem(QKEY, JSON.stringify(list.slice(0, 200))); } catch (e) {}
  }
  function enqueue(job) {
    var list = q();
    job._tries = (job._tries || 0) + 1;
    if (job._tries > 5) return;               // 重试 5 次仍失败则丢弃，避免堆积
    list.push(job); saveQ(list);
  }

  /* ---------- 初始化：库就绪 → 匿名登录 → 身份登记 → 清队列 ---------- */
  function init() {
    if (disabled || client) return;
    if (typeof supabase === 'undefined' || !supabase.createClient) return;  // 库未加载（离线首访等）
    try {
      client = supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    } catch (e) { state = 'error'; return; }
    state = 'connecting';
    client.auth.getSession().then(function (res) {
      if (res && res.data && res.data.session) return res.data.session.user;
      return client.auth.signInAnonymously().then(function (r) {
        if (r.error) throw r.error;
        return r.data.user;
      });
    }).then(function (user) {
      if (!user) throw new Error('no user');
      uid = user.id;
      state = 'ready';
      ensureLive();
      flush();
    }).catch(function (e) {
      /* anonymous_provider_disabled 等：本会话降级为纯本地，不再重试 */
      state = 'error';
      if (e && (e.code === 'anonymous_provider_disabled' || /anonymous/i.test(e.message || ''))) disabled = true;
    });
  }

  function flush() {
    if (state !== 'ready') return;
    var list = q();
    if (!list.length) return;
    var rest = list;
    var step = function () {
      if (!rest.length) { saveQ([]); return; }
      var job = rest[0];
      run(job).then(function (ok) {
        if (ok) { rest = rest.slice(1); step(); }
        else { job._tries = (job._tries || 0) + 1; rest = rest.slice(1); if (job._tries <= 5) rest.push(job); saveQ(rest); }
      });
    };
    step();
  }

  function run(job) {
    if (job.t === 'attempt') return upsertByClient('attempts', job.row, job.cid);
    if (job.t === 'annotation') return upsertByClient('annotation_sessions', job.row, job.cid);
    if (job.t === 'wrong') return insertOnce('wrongbook', job.row);
    if (job.t === 'student') return upsertStudent(job.row);
    return Promise.resolve(true);
  }

  /* ---------- Realtime：交卷信号（broadcast，不经表、不受 RLS 表策略约束） ----------
   * 学生端每次写库成功发一条「有新动态」信号；教师看板订阅同一通道自动刷新。
   * 只发 kind（哪张表）与时间，不发任何作答内容——隐私口径与数据层一致。 */
  function ensureLive() {
    if (liveCh || !client) return;
    try {
      liveCh = client.channel('mtpe-live');
      liveCh.subscribe(function (st) { liveOn = (st === 'SUBSCRIBED'); });
    } catch (e) { liveCh = null; }
  }
  function ping(kind) {
    try {
      if (liveOn && liveCh) liveCh.send({ type: 'broadcast', event: 'activity', payload: { kind: kind, at: Date.now() } });
    } catch (e) {}
  }

  /* client_id 查重后插入（表未建唯一索引也能防重） */
  function upsertByClient(table, row, cid) {
    if (!uid || !cid) return Promise.resolve(true);
    return client.from(table).select('id').eq('client_id', cid).limit(1)
      .then(function (res) {
        if (res.error) throw res.error;
        if (res.data && res.data.length) return true;      // 已上传过
        row.user_id = uid;
        return client.from(table).insert(row).then(function (r2) { if (r2.error) throw r2.error; ping(table); return true; });
      });
  }
  function insertOnce(table, row) {
    if (!uid) return Promise.resolve(true);
    row.user_id = uid;
    return client.from(table).insert(row).then(function (r) { if (r.error) throw r.error; ping(table); return true; });
  }
  function upsertStudent(row) {
    if (!uid) return Promise.resolve(true);
    row.id = uid;
    return client.from('students').upsert(row, { onConflict: 'id' })
      .then(function (r) { if (r.error) throw r.error; return true; });   // 报到不打扰教师
  }

  function accountNow() {
    try { return localStorage.getItem('mtpe_account') || ''; } catch (e) { return ''; }
  }
  function nickNow() {
    try {
      var set = localStorage.getItem('mtpe_nickname_set');
      var v = JSON.parse(localStorage.getItem('mtpe_nickname') || '""');
      return (set && v) ? v : (accountNow() || '匿名');
    } catch (e) { return accountNow() || '匿名'; }
  }

  /* ---------- 对外 API（页面挂接用，全部 fire-and-forget） ---------- */

  /* 登录 / 报姓名后登记身份（students 表，upsert 幂等） */
  window.mtpeCloudIdentity = function (account, nickname) {
    if (state !== 'ready') return;
    upsertStudent({ account: account || accountNow(), nickname: nickname || nickNow(), last_seen_at: new Date().toISOString() })
      .catch(function () { enqueue({ t: 'student', row: { account: account || accountNow(), nickname: nickname || nickNow(), last_seen_at: new Date().toISOString() } }); });
  };

  /* ② 改 / ③ 测 交卷记录（app.js / pe-exam.js 的 record） */
  window.mtpeCloudAttempt = function (rec) {
    if (!rec || !rec.id) return;
    var row = {
      client_id: String(rec.id), task_id: String(rec.taskId || ''), task_name: String(rec.taskName || ''),
      pair: rec.pair || null, domain: rec.domain || null,
      mode: ['competition', 'practice', 'exam', 'demo'].indexOf(rec.mode) >= 0 ? rec.mode : 'practice',
      score: rec.score != null ? Number(rec.score) : null,
      ter: rec.ter != null ? Number(rec.ter) : null,
      seg_done: rec.segDone != null ? Number(rec.segDone) : null,
      total: rec.total != null ? Number(rec.total) : null,
      words: rec.words != null ? Number(rec.words) : null,
      time_used: rec.timeUsed != null ? Number(rec.timeUsed) : null,
      details: Array.isArray(rec.details) ? rec.details.slice(0, 100) : null,
      profile: { nickname: rec.nickname || nickNow(), date: rec.date || '' }
    };
    var job = { t: 'attempt', row: row, cid: String(rec.id) };
    if (state === 'ready') upsertByClient('attempts', row, job.cid).catch(function () { enqueue(job); });
    else enqueue(job);
  };

  /* ① 找 交卷统计（annotate.js 的 result；special 为专项名或空） */
  window.mtpeCloudAnnotation = function (result, wrongAdded) {
    if (!result) return;
    var cid = 'ann_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var row = {
      client_id: cid,
      paper: result.special || result.paper || '',
      special: result.special || null,
      precision_pct: result.precision != null ? Number(result.precision) : null,
      recall_pct: result.recall != null ? Number(result.recall) : null,
      f1: result.f1 != null ? Number(result.f1) : null,
      tp: result.TP != null ? Number(result.TP) : null,
      fp: result.FP != null ? Number(result.FP) : null,
      fn: result.FN != null ? Number(result.FN) : null,
      tag_wrong: result.tagWrong != null ? Number(result.tagWrong) : null,
      sev_wrong: result.sevWrong != null ? Number(result.sevWrong) : null,
      pairs_n: result.pairsN != null ? Number(result.pairsN) : null,
      tagged_n: result.tagged != null ? Number(result.tagged) : null
    };
    var jobA = { t: 'annotation', row: row, cid: cid };
    if (state === 'ready') upsertByClient('annotation_sessions', row, cid).catch(function () { enqueue(jobA); });
    else enqueue(jobA);

    if (Array.isArray(wrongAdded)) {
      wrongAdded.forEach(function (w) {
        if (!w || !w.k || !w.span || !w.tag) return;
        var jw = { t: 'wrong', row: { pair_key: String(w.k), span: String(w.span).slice(0, 300), tag: String(w.tag), sev: w.sev ? String(w.sev) : null, kind: w.kind ? String(w.kind) : 'miss', mine: w.mine ? String(w.mine).slice(0, 300) : null } };
        if (state === 'ready') insertOnce('wrongbook', jw.row).catch(function () { enqueue(jw); });
        else enqueue(jw);
      });
    }
  };

  /* 状态查询（设置页可显示连接徽标） */
  window.mtpeCloudState = function () { return { state: state, uid: uid, live: liveOn }; };

  /* 库脚本晚到也能初始化：DOMContentLoaded + 轮询一次 */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(function () { if (state === 'off' && !client) init(); }, 2500);
})();
