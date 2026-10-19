# HANDOFF · 译后编辑实训平台（MTPE Trainer）

> 交接文档 ｜ 更新：**2026-10-13** ｜ 状态：**已上线可用**，六页结构定稿，设计底座统一，回归全绿
> 本文档供新会话 / 其他接手者快速上手。**本文件只在本地，不发布**（含内部口径与账号）。

---

## 一、现在是什么样

参考公开赛事的答题模式构建的**译后编辑（MTPE）教学实训平台**。
纯前端 HTML/CSS/JS，零依赖、双击即用、可装到桌面、可离线。语料加密存放、按需分片下发。

```
index.html          首页：汇总 + 导流。按有无记录分两版（新账号只见"下一步 + 三步卡"）
├ annotate.html     ① 找：组卷 → 作答 → 结果     （作答中可开 MQM 错误类型速查弹窗）
├ practice.html     ② 改：广场 → 作答 → 结果
├ pe-exam.html      ③ 测：广场 → 考场 → 结果     （作答时整页独占，贴近真实赛场）
├ stats.html        我的统计：练习 / 标注 / 仿真三块 + 筛选 + 导出   ← 不加载语料，打开最快
├ champion.html     对标亚军：学生作答 vs 亚军画像（镇湖刺绣真实作答 + 第七届画像外推）
├ MQM错误类型参考手册.html   考点页：七大维度 + 两种简化版 + 每维度挂「练这一维度」入口
└ 404.html

顶层导航（nav.js）只放：品牌(=回首页) ｜ ① 找 ② 改 ③ 测 ｜ 我的统计 ? 账号 安装到桌面
两个"不占页面"的入口：help.js（帮助弹窗）、mqm.js（错误类型速查弹窗）

教师端（仅本地，不发布）：teacher.html（讲义/课堂视角/基线）、review.html（标注校对汇总与仲裁）、
class.html（班级汇总与百分位）
```

**两条导航栏的分工（勿混）**

| | 全局栏（nav.js） | 分页栏（各页自带） |
|---|---|---|
| 内容 | 品牌 + 三步骤 + 我的统计 ? 账号 安装 | 本页上下文：任务名 / 进度 / 计时 / 交卷 / 退出 |
| 何时显示 | **仅浏览态** | 作答态（此时全局栏被隐藏，它是唯一一条） |

规则：作答态给 `body` 加 `.answering` → `ui.css` 里 `body.answering #mtpe-nav{display:none}` +
`--mtpe-nav-h:0px`（不归零的话吸顶元素会凭空下移留白）。**全局栏已有的入口，页面里不再重复。**

**只登一次**：登录后本机只存 **32 字节内容密钥**（`mtpe_ck` + 12 小时有效期），明文只在内存里；
点「退出」清密钥与账号。**注意：退出不清学习数据**（见第九节待办第 1 条）。

---

## 二、线上与部署

| 项 | 值 |
|---|---|
| 站点 | https://hank-hunau.github.io/linkhanyou-pe/ |
| 仓库 | https://github.com/hank-HUNAU/linkhanyou-pe （**公开**，MIT 只覆盖代码） |
| 账号 | `hunau-pe-01` / `linkhankyou01`　`hunau-pe-02` / `linkhankyou02`（口令不进公开仓库，只在 secure.js 里以 PBKDF2 包裹后的形式存在） |
| 部署 | `py -3 deploy_to_github.py`（在 `2026-10-04-17-26-42/mtpe/`） |

**为什么用脚本部署**：本机到 `github.com:443` 不通，但 `api.github.com` 可达，所以走 Git Data API
（建 blobs → tree → commit → 更新 ref）。

**部署脚本自带的护栏**（改坏了会直接拒绝上传）：

- corpus.js / annotate-data.js 必须是**注水桩**（出现明文或有「参考译文」字样就中止）
- 四个页面**首屏不得直接引入** secure.js / s-tasks.js / s-pairs.js
- `secure.js` 必须 < 30KB（说明是密钥环而不是整包密文）；两个分片必须存在且不含明文
- 本地 PNG 魔数校验

**部署后固定动作**（每次都跑，别省）：

```
node verify_deploy_sync.mjs      # 本地 ↔ 线上逐文件比对（现 39 项）
node verify_live.mjs             # 线上文件端到端：登录 → 分片按需解密（现 16 项）
```

---

## 三、文件地图

### 页面与脚本

| 文件 | 行数 | 职责 |
|---|---|---|
| `index.html` / `home.js` | 47 / 210 | 首页：下一步建议 + 我的进度 + 三步入口（不加载语料） |
| `annotate.html` / `annotate.js` | 33 / 572 | ① 找：组卷（按需筛选）+ 划选打标 + 种子对照评分 |
| `practice.html` / `app.js` | 50 / 627 | ② 改：广场 / 作答 / 结果 + 教学演示 |
| `pe-exam.html` / `pe-exam.js` | 42 / 838 | ③ 测：广场 / 考场 / 结果画像 |
| `stats.html` / `stats.js` | 42 / 216 | 我的统计（**不加载语料**） |
| `report.js` | 125 | **共用**：结果页 + 成绩报告导出（②改 交卷后 与 统计页「查看」共用） |

### 样式（**层级关系是硬约束**）

| 文件 | 行数 | 职责 |
|---|---|---|
| `ui.css` | 174 | **全站设计底座**：设计变量 + 基础重置 + 按钮/标签/卡片/弹窗/提示块/Toast/空态/步骤标签/骨架屏/焦点态/断点。**四个页面都先加载它** |
| `style.css` | 214 | ②改 专属：顶栏、三步卡、作答区、统计与图表、首页各板块 |
| `annotate.css` | 58 | ①找 专属：组卷表单、划选打标面板、结果页 |
| `pe-exam.css` | 163 | ③测 专属：考场外壳、双栏作答、右侧面板、结果画像 |

### 支撑脚本

| 文件 | 职责 |
|---|---|
| `unlock.js` | 登录 + 内容密钥 + `mtpeEnsureSlice()` 按需解密分片 + `mtpeBoot()` 等数据就绪再启动页面脚本 |
| `nav.js` | 全站顶栏（含 `window.mtpeNavRender()`，供整体重绘的 ③测 重建顶栏） |
| `help.js` | 帮助弹窗（流程 / 计分口径 / 数据来源与局限 / 常见问题） |
| `mqm.js` | M1–M9 + M0 的唯一口径 + `mqmQuickRef()` 速查弹窗 |
| `sw.js` / `pwa.js` / `manifest.json` | PWA 离线外壳（当前 `CACHE = 'mtpe-shell-v11'`） |

### 语料与密文

| 文件 | 大小 | 说明 |
|---|---|---|
| `secure.js` | 11.4 KB | **密钥环 + meta 片**（种子 / 预标注 / 图谱 / 小账本） |
| `s-tasks.js` | 324 KB | tasks 片（改 / 测 用） |
| `s-pairs.js` | 323 KB | pairs 片（找 用） |
| `corpus.js` / `annotate-data.js` | ~1 KB | 异步注水桩（**自动生成，勿手改**） |
| `data.js` | 1 KB | 只剩空的 `TASKS` 挂载容器 |
| `_sealed_backup/` | — | 明文备份（加封脚本找不到明文时会回退到这里） |

---

## 四、设计底座与「三页统一」的硬规则

**主色 `#0071e3`（苹果蓝）**，色板 / 圆角 4 档 / 字号 5 档 / 间距 6 档 / 阴影 2 档全部定义在 `ui.css`。

**根因备忘**：站点经历过两次主题——`style.css` 与 `annotate.css` 里各有一块
「Apple 设计语言覆盖（2026-10-09）」，用 `!important` 把按钮压成 980px 胶囊；
**`pe-exam.css` 从未吃到**。于是"改/找 是胶囊按钮、测 是圆角矩形"，主色一套 `#0071e3` 一套 `#2b7cff`，
顶栏 `nav.js` 又是第三处写死的蓝。现已全部上移到 `ui.css`，不再需要 `!important`。

**四条不许破的规则**（`smoke_ui.mjs` 会拦）：

1. 四个页面**必须先加载 `ui.css`**，再加载各自的页面样式。
2. 页面 CSS **不得再定义 `:root`** 或 `--primary` / `--yc` / `--an` 这类主色变量。
3. 页面 CSS **不得再自己定义 `.btn`**，也不得用 `border-radius: 980px !important` 压圆角。
4. 颜色只写在 `ui.css`；`audit_contrast.mjs` 直接读 token 算对比度，**当前 12 项全部合格 AA**。

**步骤色**：`.step-tag` 三档 `s1` 青绿（找）/ `s2` 蓝（改）/ `s3` 亮蓝（测）——
三页底色统一，但一眼能看出在第几步。

**已知未完**：字号与圆角虽已立好 token，页面 CSS 里仍有不少直接写的 px（`style.css` 还有十几级字号）。
视觉已统一，但"台阶"没完全落到 token 上。

---

## 五、数据与语料管线

### 数据现状（线上实测）

- 句对 **1402** 条（A 级，全部有机翻底稿）｜整卷 **20** 套（第 1–6 届 14 套 + 第 7/8 届与模拟赛 5 套 + 教学案例 1 套）
- 种子标注 **65** 条覆盖 62 句｜维度覆盖：准确性 1382 / 术语 88 / 语言规范 286 / 风格 265 / 区域规范 133 / 格式 **0**
- 第 8 届初赛德语 5 条属 B 级「案例摘录」，**不在题库内**

### 补底稿的边界（务必如实说，别含糊）

**第 3 届（2020 腾讯 TranSmart）与第 5 届（2022 火山翻译）**：官方只公布了「原文 + 参考译文」，
机翻输出从未公开、当年引擎也已调不到。这 **691 条底稿由 DeepSeek-V3 按机翻输出风格重构生成**
（`mtpe/gen_mt_drafts.mjs` 生成 + `merge_redraft.py` 合并回 CSV，可断点续跑）。

平台口径：卷名写「DeepSeek-V3 **重构** 底稿」，`tips` 与「找」页说明写明"非官方底稿"，
数据里打 `rb:1` 标记；**这两届的参考译文仍是官方原文**。**不得与官方底稿混称。**

### 改语料 / 数据的唯一正确姿势

```
1) 改 CSV（在 2026-10-04-17-26-42/译后编辑大赛历届参赛原文/训练集）
2) cd 译后编辑实训平台 && node build_corpus.mjs "<训练集目录>"    # 生成明文 corpus.js / annotate-data.js
3) 把明文覆盖进 _sealed_backup/
4) cd 2026-10-04-17-26-42/mtpe && node seal_content.mjs           # 重新加封：secure.js + 两个分片 + 注水桩
5) py -3 deploy_to_github.py  →  node verify_deploy_sync.mjs  →  node verify_live.mjs
```

`build_corpus.mjs` 有两道**构建期护栏**（不通过直接 exit 1）：相邻句段不得互相包含（先跑
`fix_contained_segments.mjs` 清理）；种子片段必须能在机翻里定位到。

**术语表按「届次 + 赛段」挂载**，且方向一律「源语 → 译语」（英译汉卷英文在前）。
没填赛段的条目会被忽略并告警。改完用 `node audit_task_terms.mjs` 复核（应输出「可疑 0 条」）。

---

## 六、安全与授权边界（不许越界）

1. **教师端不发布**：teacher / review / class 只在本地，线上是占位页。
2. **公开仓库只放学生端**：README 与 NOTICE 已写明「代码 MIT；**真题语料不在 MIT 授权范围内**，
   著作权归原权利人，仅限课堂教学与非商业学术研究，不构成再分发许可」。
   `LICENSE` **保持规范 MIT 正文不动**——曾把说明加在正文前，结果 GitHub 的许可证识别掉成
   `Other/NOASSERTION`；语料部分单独写在 `NOTICE`。
3. **公开表述收敛**：README 不透露站点结构与语料规模；正文避免"官方"字样（站点内仍有 35 处，
   其中 16 处是代码注释）。`scan_public_words.mjs` 可自查。
4. **未做的事**：尚未取得权利人的书面授权。若要进一步降低风险，下一步是**向赛事组委会申请
   教学用途许可**——这是唯一能实质改变风险等级的动作。
5. 站点是**教学用途的自建软件**，不是任何赛事的官方平台；不使用任何第三方标识与 Logo。

---

## 七、测试与护栏（固定动作）

全部在 `2026-10-04-17-26-42/mtpe/` 下运行。

| 脚本 | 覆盖 | 当前 |
|---|---|---|
| `smoke_practice.mjs` | ②改：广场 / 计时器泄漏 / 草稿 / 导航与卡片一致性 | 57 项 |
| `smoke_annotate.mjs` | ①找：组卷（一键 + 高级筛选）/ 打标 / 交卷评分 / 结果页 | 57 项 |
| `smoke_peexam.mjs` | ③测：广场 / 答题页 / 结果页 / 文案瘦身回归 | 全通过 |
| `smoke_stats.mjs` | 我的统计：不加载语料 / 口径标注 / 筛选 / 空态 | 22 项 |
| `smoke_ui.mjs` | 设计底座：ui.css 优先 / 页面 CSS 不得再定义 token / 焦点态 / 骨架 | 35 项 |
| `smoke_help.mjs` | 帮助弹窗与入口 | 18 项 |
| `verify_sso_pwa.mjs` | 单点登录 / 分片按需下载 / PWA 资产 / 首页分版本 | 107 项 |
| `verify_hydrate.mjs` | 注水桩三条路径（未登录 / 离线 / 就绪） | 3 路径 |
| `verify_seal.mjs` | 加封端到端（两账号可解 / 错口令拒绝 / 改一位即拒绝） | 18 项 |
| `lint_undefined.mjs` | 「调用了但没定义」的函数 | 0 |
| `audit_page_css.mjs` | 页面用到的 class 是否有样式（**以 ui.css 为准**） | 0 缺样式 |
| `audit_contrast.mjs` | 对比度（**直接读 ui.css 的 token 计算**） | 12 项全合格 AA |
| `audit_release.mjs` | 落地前体检：数据 / 安全 / 界面 / 健壮性 → P0/P1/P2 | 全空 |

**新写测试用什么**：`_payload.mjs` 提供 `makeLoader(dir)` / `loadAll()` / `installSeal()` /
`installShards()` / `putKeyIn()` / `wireScriptLoader()`。新页面脚本照 `smoke_stats.mjs`
的桩环境写法即可（`new Function('window','document','localStorage', ...)`）。

---

## 八、最近三轮做了什么（2026-10-11 ~ 10-13）

按时间顺序，只列会改变认知的：

1. **语料分片加密（v2）**：整包 476KB 密文 → 登录只下 **11.4KB 密钥环 + meta 片**；
   进「改/测」下 tasks 片、进「找」下 pairs 片。本机只存 32 字节内容密钥。
2. **第 3/5 届补 691 条重构底稿**：整卷 13 → 20 套，第 1–8 届全量覆盖（边界见第五节）。
3. **口径统一「测」**：站点不再出现「考」；同时修掉一个真 bug——
   ②改 的限时练习与 ③测 的仿真训练**共用 `mode='competition'`**，导致首页把限时练习漏算、
   统计页把测评分混进"练习平均分"，同一个"平均得分"给出两个数。现在 ③测 写 `mode='exam'`，
   旧记录用 `profile` 字段反推（②改 的记录不带 profile），**历史数据不用迁移**。
4. **顶栏统一（两态制）** + 带编号的步骤标签；③测 的浏览态补上全局栏；
   去掉单列的「首页」（品牌本身可点回首页）。
5. **文案瘦身 + 帮助弹窗**：页面内说明性文字约 3500 → 1200 字；口径 / 来源 / 局限 / 常见问题
   全部收进 `help.js`。
6. **设计底座 `ui.css`**：见第四节。顺带修掉三处硬伤——琥珀警告色对比度 2.90（不达标）→ 4.66、
   全站 0 处 `:focus-visible`、分片解密期间 `#app` 一片空白 → 骨架屏。
7. **页面结构收口**：我的统计独立成 `stats.html`（不加载语料）；MQM 手册变考点页；
   首页按状态分两版；找页页头与另两页对齐。
8. **授权表述收口**：README / LICENSE / NOTICE 三件套（见第六节）。
9. **M5 维度拆分（2026-10-13）**：M5「数字单位」原定义混了「数量级译错」和「日期/货币格式」两类。已拆分——数量级/数字译错并入 M1 误译；M5 改名「单位格式」，只收日期/货币/度量单位格式，维度从「语言规范」挪到新维度「区域规范」（对齐 MQM 官方 Locale conventions，配合参考资料里新增的 MQM 文献清单）。维度覆盖随之变化：语言规范 386→286、区域规范 0→133。已重跑 build + seal + 部署（提交 a8ee5792，回归全绿）。
10. **对标亚军（champion，2026-10-13）**：新增 `champion.html`。以「外研社·国才杯」汉译英镇湖刺绣篇亚军选手为基准——从她的 9 段真实作答+专家评析提炼六大维度能力画像（`champion-data.js` 固定数据），学生可在三篇真题（第七届初赛英→汉 / 决赛汉→英 / 镇湖刺绣汉→英）做译后编辑，结果页给出「学生画像 vs 亚军画像」雷达图 + 强弱项清单。口径：educability/何园以参考译文为基准（画像外推），镇湖刺绣以亚军真实作答为基准（逐段对照+专家评析）。学生能力分 = 修正率 ×100，与亚军画像分同尺度。入口在首页「学习资源」。部署提交 7d1d40a0。

---

## 九、待办（按优先级）

**P0 —— 已解决（2026-10-17，提交 c8dc15f1）**

0. **Supabase 前端接入 —— 已投产（2026-10-17 20:25 端到端验证通过）**：
   - `supabase.js`（UMD 本地化 218KB，进 SW 预缓存）+ `supabase-sync.js`：匿名登录 →
     students 身份登记；①找 → annotation_sessions + wrongbook；②改/③测 → attempts；
     client_id 查重防重传；失败入队 `mtpe_cloud_queue`（重试 ≤5 次后丢弃）。
   - 项目 `mtpe-trainer`（fdvypkybxhkdpvfepskf），5 表 RLS 全开。**匿名登录已开启
     （2026-10-17 20:25），端到端验证通过**：浏览器登录 → students 落行（account/
     nickname/uid 吻合）。学生作答自动上云，无需任何额外操作。
   - 未开启/断网/报错一律静默降级纯本地（`window.mtpeCloudState()` 可查状态）。
   - index.html 引用带 `?v=17a` cache-busting；改 supabase-sync.js 后需递增。

0b. **在线教师看板（RLS 教师口令门）—— 已投产（2026-10-17，提交 55e0aa95）**：
   - `teacher.html` 改为「教师口令」登录并**正式上线**（此前线上是占位页）：
     publishable key + `global.headers: {'x-teacher-key': 口令}`，页面本身不含任何服务端密钥。
   - Supabase 侧：`teacher_gate` 私密表（RLS enable+**force**）存教师口令
     `KR_0ySK7CFi4w30TPu57mS7Vd71FScPx`；自引用探测策略（头内口令=库中密钥 → 可见该行）；
     四张数据表各挂教师头 SELECT 策略。curl 三态实测：对口令见全班 / 错口令与无头只见空表。
   - ⚠️ 教训：`teacher_gate` 建表时漏开 RLS，曾对持 publishable key 者裸奔可读——
     已修复。**凡新表必查 `pg_class.relrowsecurity`**。
   - 前端防呆：service_role 密钥误填会被拒绝；口令留存 localStorage（清洗换行/空格）；
     错口令面板直接内嵌输入框可重输。E2E 12 项全过（`check_teacher_gate.cjs`）。
   - review.html / class.html 仍是占位页；教师看板无账号只有口令（可随时轮换）。

0c. **云端发号（教师看板创建学生账号）—— 已投产（2026-10-18，提交 1cad33d2）**：
   - Supabase 新表 `student_keys`（RLS enable+**force**）：`{id,salt,iv,wrap}` 云端密钥环条目。
     公开可读（与 secure.js 同暴露面，保密靠密码→PBKDF2(200000)→KEK 包裹，**不存明文密码**）；
     INSERT/DELETE 仅限教师口令头。`teacher_gate` 加 `ck` 列存内容密钥（仅教师头可读）。
   - teacher.html「学生账号发放」卡：账号 ID + 密码（可随机生成）→ 前端 webcrypto 包裹 CK 入库；
     凭据只显示一次；可删除账号（学生历史成绩保留）。**盐必须是文本串**（unlock.js 对 salt
     做字符串编码，与 secure.js 'hunau-pe-salt-01' 同构；随机字节 base64 会导致两侧
     KEK 不一致——已踩坑已修）。
   - unlock.js：本地密钥环查不到账号 → 拉 `student_keys` 合并重找（5s 超时，断网回落内置
     账号）。云端账号**首次登录需联网**，解锁后与内置账号完全一致。SW 缓存 v12→v13。
   - E2E 8 项全过（`.workbuddy/check_cloud_keys.cjs`）：发号→新账号解锁→错密码拒→
     内置回归→清理。
   - 内置账号：hunau-pe-01 / hunau-pe-02（密码在 seal_content.mjs ACCOUNTS，教师自持）。

0d. **全局工作台外壳 —— 已投产（2026-10-18，提交 ad9e818a）**：
   - 用户定案：首页工作台的左侧栏 = **全站唯一导航入口**。找/改/测/统计/设置/对标
     六个学生页全部渲染与首页同一套 `wb-side` 侧栏（7 项导航，当前项高亮），
     旧横向顶栏退役（与侧栏功能重复）。侧栏底部收纳：帮助 / 安装到桌面 / 账号 / 退出。
   - nav.js 重写为 shell 渲染器（幂等）：把各页 `#app` 移入 `.wb-content`；
     **侧栏样式内联自带**（annotate/pe-exam/champion 不加载 style.css 也能生效，
     取值与 style.css 的 .wb-side 段同步——改样式要改两处）；`--mtpe-nav-h` 置 0。
   - 沉浸式：作答态 `body.answering` 隐藏侧栏、主区占满全屏。
     ⚠️ 关键修正：ui.css 旧规则 `body.answering #mtpe-nav{display:none}` 在 shell 化后
     会把主内容一起藏掉（#app 已在 #mtpe-nav 内），已删除。
   - 首页（home.js 自管侧栏，未登录只显示登录层）；教师页（teacher/review/class）
     仍为横向顶栏「教师通道」。SW 缓存 v15。E2E 17 项全过。

0e. **Realtime 实时推送（Supabase Realtime）—— 未做（挂账）**：
   - 教师看板目前只能刷新页面看新数据。若要"学生交卷即刻出现在看板上"，
     需对 attempts / annotation_sessions 挂 `supabase_realtime` publication + 前端订阅。
   - 注意：RLS 会同样作用于 Realtime 的授权判断，教师端靠 `x-teacher-key` 头订阅，
     需确认 Realtime 通道能透传自定义头（多半需要在 `realtime.messages` 策略里处理）。

0f. **①找 作答页宽度两档 —— 已定案并实现（2026-10-19）**：
   - `.ans-wrap` 内卡片**限宽 960px 居中**（中文最佳行宽 35–45 字），超宽屏不再拉成一行长带。
   - ⚠️ 教训：`scrollbar-gutter:stable` 在 Chromium **根元素上不生效**（实测 1280→1265→1260 仍跳）；
     改 `html{overflow-y:scroll}` 恒定有效（1280 视口内容区全程 1265，位移 0.00px）。
   - ⚠️ 复现滚动条类 bug **必须有头模式**（`headless:false`）：headless 的滚动条是0 宽 overlay 类型，
     headless 下永远复现不出来。

0g. **toast 空元素占位+ 溢出修复 —— 已修（2026-10-19）**：
   - `#toast:empty, .toast:empty { display:none !important }`：空toast 容器仍占位导致布局出现空隙。

**P1 —— ①找 作答页体验系列（2026-10-19 一日内完成，线上 2756941，SW v30）**

这一轮的连续改造已全部上线，**读代码前先看这一节**，别当成独立小补丁：

1. **字号与排版**：译文（操作对象）17px / line-height 1.8 / 白底 + 3px 蓝左边线；
   原文（参考）15px / 浅灰底 `--src-box`。原先两者同字号同底色，主次不分。
2. **底栏固定**：`.nav-row` 改 `position:fixed; bottom:0; z-index:90` + 毛玻璃白底 +
   `env(safe-area-inset-bottom)`，上一条/下一条位置**恒定不随句子变化**（③测「工具栏 always sticky」同一模式）。
   - 三栏 grid `1fr auto 1fr`；**`.nav-c` 必须显式 `grid-column:2/3`、`.nav-r` `grid-column:3`**
     ——只有两个子元素时会顺次落进第 1、2 列，导致中栏偏左 327px、交卷跑到中间。
   - 顶栏「交卷」已删除，**交卷只有底栏一个入口**（避免同功能两个名字）。
2b. **进度进底栏（2026-10-19，原第 4 问待决项落地）**：顶栏只留页面级操作（步骤标签 / 错误类型 / 退出），
   进度全部下沉到固定底栏左格 `.nav-l` = **点阵 + 文字**：
   - 点阵每句一点：已标句实心蓝 `.done`、当前句带环 `.cur`、待标句空心 → 一眼看出漏标哪几句；
   - 句数 > 40 时不画点（避免糊成一片），只留文字；
   - 已标统计「已标 X/M 句」仅在 >0 时显示，避免「0 句」噪声；
   - 面板打开锁切句时，点阵随中栏按钮一起淡出（同一视觉语言）。
   - ⚠️ `TAG_LABEL[a.tag]` 必须写 `|| a.tag` 兜底（annotate.js 标注列表行 + `renderMT` 的 mark title），
     否则 SCHEME 未就绪时页面上直接显示 `undefined`。
3. **共享高度变量**：`.ans-wrap{--nav-h:59px}`，被 `.nav-row`、`.sel-panel`（bottom）、内容让位
   padding 三处引用——改底栏高度只改这一处。
4. **面板跟随选区（popover）**：`.sel-panel` 水平对齐选区中心（左右 16px 安全边），
   垂直优先下方 10px → 放不下翻上方 → 仍不行贴底栏上方；多行划选取 `getClientRects()` 最后一行；
   滚动/缩放用 rAF 节流 `repositionPanel()`。
   - ⚠️ 教训（踩了两次）：`.sel-panel` 的 bottom/z-index 必须跟着 `--nav-h` 走，
     否则被固定底栏盖住，「保存标注/取消」点不到。
   - ⚠️ 教训：算间隙符号别算反——`gap = bar.top − panel.bottom`（正值 = 不重叠）。
5. **防丢片段双守卫**：键盘 `←/→` 切句 + 鼠标 `lockNavButtons()`（记录 `dataset.wasDisabled`
   精确还原 disabled 态）；面板打开时 `body.panel-open` 令底栏中栏按钮 `opacity:.4`。
6. **Esc 优先级**：先关标注面板，再关 `#modal-mask`（Esc 取消打标）。
7. **M0 chip 视觉区分**：M0 是「正确处理」，不是错误。`.t-chip.m0` 虚线灰底、`.m0.on` 绿色实底、
   渲染加 `✓` 前缀 + `.m0-hint` 说明行——此前与 M1–M9 错误类型长得一样，学生会误以为标错了。
8. **P0 修复：`editAnn()` 从未定义**（annotate.js:337 调用、全项目搜不到定义）→ 点已打标注抛
   `ReferenceError`，等于**无法修改已有标注**。已补：定位 mark 并带锚点重开面板、M4 正确预选。
9. **零标注空态**：无任何标注时显示引导文案，而非空白卡片。
10. **括号全半角统一**、**键盘切句**（`←/→`）、**文案去重**（两个交卷入口统一为「交卷」）。

**MQM 侧同日改造**：
- 速查弹窗：宽度 `min(680px,94vw)` → `min(1180px,94vw)`；≥1080px 时判据列 `white-space:nowrap`
  （窄屏自动换行兜底）；行内样式改注入 `<style>` 块（作用域 `#mqm-ref`）+ 严重度色分级；
  按钮写明「知道了（Esc）」，`mqm.js` 加 Esc 监听。
  ⚠️ 测「是否折行」不能拿 `height > lineHeight*1.6` 判断（会把 padding 算成折行），
  正确算法 `lines = round((td高 − padding上下) / lineHeight)`。
- `MQM错误类型参考手册.html` **整体重写为教学型练习手册**：10 张学习卡（M0–M9）=
  判据一句话 + 例句对照（问题片段红高亮 / 漏译在原文标出丢失部分）+ 四选一即时判定 + 解析；
  进度存localStorage `mqm_practice`（已练 n/10 · 答对 m）；学术内容（七维度表 / 权重公式 /
  `?dim=` 维度入口 / 来源）收进折叠 `<details>` 附录；sticky 目录；顶部「按 Esc 返回上一页」。
  重写时踩坑：原用 `$('#toc')` 但重写后没有定义 → 补 `const $ = (s) => document.querySelector(s);`。
  ⚠️ 来源标注遵守用户文献规范：MQM 手册（无 DOI，类型：行业标准手册）→ qt21.eu；
  ISO 18587:2017（无 DOI，类型：国际标准）→ iso.org/standard/62970.html。
  ⚠️ `参考资料/` 目录未被 git 跟踪，站内链接会 404 → 改为纯文本路径说明（教师本机文件）。

**P0 —— 已解决（2026-10-17，提交 c8dc15f1）**

1. ~~**机房串号**~~ **已修复——按昵称分区**：所有用户数据带保存时的昵称戳（history 用已有
   `nickname` 字段；标注统计/错题本/草稿新增 `nick` 字段），各页读取按当前昵称过滤
   （`mtpe_nickname`，取不到时不过滤以兼容测试桩）。登录时昵称预置成账号名并清
   `nickname_set`（强制新用户报到）；首次填姓名时 `mtpeClaimRecords()`（unlock.js）把
   账号名戳的记录改标成姓名（"认领"）；退出清昵称两键，草稿留存但不串号；写回合并时
   保留"别人的"条目不冲掉。
2. ~~**只有导出、没有导入**~~ **已加导入**：「我的统计」新增「导入作业 JSON（恢复本机记录）」
   （`stats.js importHomework/mergeHomework`）——按 id/键去重合并，导入记录一律改标当前
   昵称（谁导入归谁），配额失败有提示。

**P1 —— 教师侧与闭环**

3. ~~**教师端三页合并**~~ **部分作废，剩 class.html 一页**：teacher.html 已是完整教师看板
   （口令门 + 全班数据 + MQM 维度分布 + 学生账号发放），**review.html 是有意为之的安全设计**——
   公开站只发学生端，「教师批改与仲裁仅本地/私有部署」，**别当缺口去"修"**。
   仅剩 class.html（159 行，班级汇总）尚未并入看板，需要时再合并。
4. **布置与截止**：可用链接解决——`practice.html#task=<id>` 直达某卷，老师在群里发链接即一次布置。
5. **难度分级**：卷子现在只有"段数 / 字数 / 建议时长"，可按每段预估错误数（`tags` 已在算）打难度标签。

**P2 —— 体验与覆盖**

6. ~~找页移动端~~ **已解决（2026-10-19，SW v31）**：`annotate.css` 原**零断点**，现补三档
   1100 / 860 / 620。中屏底栏改两行；手机档面板变贴底满宽抽屉（拇指可达区），
   `placePanel` 在 ≤620px 让位给 CSS。E2E 五档视口（1280/1024/820/620/390）全过。
   ⚠️ 遗留：触屏「精确划选」本身仍无解（长按选词已可用，但划不出任意片段）——
   若要真正支持手机，需加「点选模式」（点词逐个选入片段），属功能新增不是修 bug。
7. 字号 / 圆角 token 收敛（第四节未完项）。
8. 数据可篡改：分数存 localStorage，学生能改；导出时可加简单校验和让老师一眼看出。
9. ~~种子标注扩充~~ **脚本已丢失，待办需重做（2026-10-19 核实）**：
   HANDOFF 原文写「`suggest_seeds.mjs` 已初筛出 634 条候选」——**该脚本与候选文件现已不存在**
   （全项目只剩 build_corpus.mjs），**634 这个数字目前无任何数据支撑，不要再当作可执行待办引用**。
   真实现状：**句对 1402条 / 种子 65 条 = 覆盖率仅 4.6%**。
   若要扩充必须重跑：`build_corpus.mjs` 走build → seal → 部署 三步，
   且**种子必须人工逐条复核**——它是 ①找 评分的金标准，机器初筛直接上线会污染 F1 口径。
10. 暗色模式（挂账）：需先把颜色完全收敛到 token。

---

## 十、环境坑与工作习惯

- **PowerShell 引用中文命令易失败** → 用 `py -3` 或写成 `.mjs` 文件再跑。
- **`apply_patch` 同一个文件不能一次做多个操作**（Delete + Add 也不行）→ 分两次调用。
- **中文路径 + .NET API**：`[System.IO.File]::ReadAllText` 用的是进程工作目录，不是 PowerShell
  `Set-Location` 的结果 → 一律用绝对路径。
- **Python 控制台编码**：`$env:PYTHONIOENCODING='utf-8'`；否则中文输出乱码/报错。
- **`github.com:443` 不通**，只有 `api.github.com` 通 → 只能用 `deploy_to_github.py`。
- **Git Data 的 tree `content` 不支持 `encoding`** → PNG 必须走 blobs 接口。
- **无头浏览器不可用**：本机 Edge 被转发、Playwright Chromium 挂起 → **视觉核对交给用户**，
  这边只能做代码与结构层的核对。
- **线上是 CDN**：偶发单次 404，重试即可。
- **`verify_deploy_sync` 按 CRLF→LF 归一后比较**：报"不一致"时先看是不是行尾差异。
- **改 UI 后必跑** `audit_page_css.mjs`：每个页面只加载自己的样式，共享组件漏一份就是整块 UI 坏掉，
  肉眼未必看得出（历史上标注页交卷弹窗掉到页面最底部就是这个原因）。

---

## 十一、已下线模块（**勿复活**）

判据：自相矛盾 / 空转 / 与别的模块功能重叠。

| 已删 | 原因 |
|---|---|
| 深度模式 + AI 助手拟真（面板 / Token / 快捷指令） | 与"赛场全程无 AI"矛盾；是规则模拟不是真 AI |
| 右侧图标栏（句段 / AI助手 / QA） | QA 与工具栏"拼写检查"重复 |
| LLM 预标注校对（采纳 / 修改 / 驳回） | 与"找错标注"主功能重叠，且与种子评分形成两套口径 |
| FLAGS 规则预标注线索 | 按届次/赛段粗粒度，命中率低 |
| MQM-B 质量分 / MQM 自评 | 与 P/R/F1 同一批种子错误的重复表达 |
| 排行榜 / DEMO_BOARD | 自编任务已移除，榜是空的 |
| 练习侧错题本板块 | 与标注端错题本同数据不同口径 |
| 自定义任务导入 | 教师功能占用学生页同级入口 |
| 首屏引入 secure.js | 首屏传输量 966KB → 16KB 的关键就是把它挪出关键路径 |

**大段删除务必用标记法（`cut_blocks.mjs`）+ 删后立刻跑全套回归 + `lint_undefined.mjs`**：
历史上发生过把 `renderMT` / `bindSelection` / `offsetWithin` 一起切掉的误伤。
