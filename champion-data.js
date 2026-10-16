/* ============================================================
 * champion-data.js — 能力对标数据（固定数据，非加密语料）
 *
 * 来源：参考资料/译后编辑真题对照表.csv
 * 亚军 = 外研社·国才杯「理解当代中国」全国大学生外语能力大赛
 *        汉译英 · 镇湖刺绣 篇的真实选手（9 段作答 + 专家评析）
 *
 * 用法：champion.html / champion.js 读取 window.CHAMPION
 * 画像分数为从专家评析逐条归纳的「能力分」（0-100，越高越强），
 * 属可调的教学参数，改动后重新部署即可，不影响语料加封。
 * ============================================================ */

window.CHAMPION = {
  name: '亚军选手',
  event: '外研社·国才杯「理解当代中国」全国大学生外语能力大赛',
  task: '汉译英 · 镇湖刺绣',
  taskId: 'zhenhu',
  intro: '以该选手的 9 段真实作答与专家评析提炼能力画像，作为学生对标基准。',

  /* 六大维度画像（与平台 MQM 六大维度一致，见 mqm.js / 手册） */
  profile: [
    { dim: '准确性', score: 85, note: '正确修正 Raw MT 逻辑主语错误、准确理解「婆家」=夫家，结构重组到位' },
    { dim: '术语', score: 80, note: '主动补地理/机构/职能背景（镇湖在江苏、织造府职能、龙袍用途），仅 Rolls-Royce 专名格式 1 处错' },
    { dim: '语言规范', score: 55, note: '高频拼写/搭配细节错：craftsmanship、works→work、engaging→engaged 等 ≥4 处，是主要短板' },
    { dim: '风格', score: 85, note: '改主语、理顺信息流、逻辑关系表达好，专家多次肯定「结构更清晰」' },
    { dim: '区域规范', score: 75, note: '补年代信息（战国≈2500 年前）到位；汉译英篇区域规范体现少，无硬伤' },
    { dim: '格式', score: 75, note: '无明显格式/标记相关评析，取中性基线' }
  ],

  /* 镇湖刺绣 9 段真实作答（学生逐段对照亚军的处理与专家评析） */
  segs: [
    {
      src: '从宫廷御用中走来的精致和细腻',
      mt: "Exquisite and delicate qualities that come from the palace's official use",
      pe: '（未改标题）',
      fix: '',
      flaw: '标题未改',
      comment: '选手作答未更改文章标题，建议改为 Exquisite and delicate qualities coming from the royal family\u2019s patronage。'
    },
    {
      src: '追溯镇湖刺绣的历史，可谓源远流长，',
      mt: 'Tracing back to the history of embroidery in Zhenhu, it can be said that it has a long and rich history.',
      pe: 'Zhenhu embroidery, a representative of the Su embroidery (an embroidery style in Jiangsu Province), has a long and rich history.',
      fix: '结构重组 + 补地理信息',
      flaw: '',
      comment: '调整句子结构、变更主语为 Zhenhu embroidery，补充地理信息（镇湖在江苏苏州）。Raw MT：动词-ing 短语逻辑主语与句子主语不一致，必须修改。'
    },
    {
      src: '，早在战国时期，这里就已经是一片“闺阁家家架绣绷，妇姑人人巧习针”的兴旺景象。',
      mt: 'As early as the Warring States period, this place was already a prosperous scene of "every household in the boudoir had embroidered tightly, and every woman and aunt was skilled in needlework".',
      pe: 'As early as the Warring States period (roughly 2,500 years ago), the area was already prosperous in embroidery, with a line suggesting that "every family do embroidery works and there is a female embroiderer in every family".',
      fix: '补年代信息（战国≈2500 年前）',
      flaw: 'works→work 细节错',
      comment: '补充年代信息对目标读者友好，但出现个别细节错误（works 应为 work）。Raw MT：意义表达有误（embroidered tightly）。'
    },
    {
      src: '明清时期，江南织造府便常来此地下单，从枕套到龙袍，镇湖绣品源源不断地被送进宫廷。',
      mt: 'During the Ming and Qing dynasties, Jiangnan Weaving Mansion often came here to place orders. From pillowcases to dragon robes, Zhenhu embroidery products were continuously sent to the court.',
      pe: "During the Ming and Qing dynasties, Jiangnan Weaving Mansion, the imperial institution for silk and embroidery, often came to Zhenhu to place imperial orders and sent embroidery products from pillowcases to the emperor's robes with dragon patterns to the palace.",
      fix: '补机构职能 + 龙袍图案用途',
      flaw: '',
      comment: '补充政府机构信息、说明织造府职能（为皇家提供丝绸刺绣），补充龙袍图案与用途，意义表达完整，对目标读者友好。'
    },
    {
      src: '“户户搞刺绣、家家有绣娘”的传统就这样在一代一代苏绣人的手里传承至今。',
      mt: "The tradition of 'every household engages in embroidery, and every household has an embroidery mother' has been passed down from generation to generation of Su embroiderers.",
      pe: 'Through generations, embroiderers in Jiangsupassed down the tradition of embroidery, with every household engaging in embroidery.',
      fix: '呼应地理 + 变更主语',
      flaw: 'Jiangsu 建议改 Zhenhu in Jiangsu；engaging→engaged',
      comment: '呼应前面地理信息、变更主语使结构更符合逻辑与信息流。Jiangsu 建议改为 Zhenhu in Jiangsu，engaging 建议改为 engaged。'
    },
    {
      src: '镇湖有句话：“不会刺绣的姑娘，找不到婆家。”',
      mt: 'There is a saying in Zhenhu: "A girl who cannot embroider cannot find her in laws."',
      pe: 'There is a saying in Zhenhu that "A girl who cannot do embroidery work cannot get married."',
      fix: '准确理解「婆家」=未来夫家',
      flaw: '建议去 that、采用冒号',
      comment: '更准确表达原文：「婆家」不是因结婚出现的非直系亲戚，而是未来夫家。建议去掉 that，采用冒号。'
    },
    {
      src: '所以镇上的绣娘们无论老幼，打从六七岁开始，便在一针一线的深思琢磨中，锤炼着针法，磨练着耐性。',
      mt: 'Therefore, the embroiderers in the town, regardless of age, have been refining their needlework and patience through careful consideration since the age of six or seven.',
      pe: 'Female embroiderers in the town, since the age of six or seven, have been refining their needle work with patience, persistence and craftsmenship.',
      fix: '结构更清晰',
      flaw: 'craftsmanship 拼写；建议保留 Therefore',
      comment: '调整句子结构使逻辑更清晰，但有个别细节错误（应为 craftsmanship）。建议保留原逻辑关系词 Therefore。'
    },
    {
      src: '她们无所不绣，从山水花鸟，到衣帽围巾，从刺绣艺术品字画，到劳斯莱斯高定版的内饰，',
      mt: 'They embroider everything, from landscapes, flowers, and birds, to clothing, hats, and scarves, from embroidered artworks, calligraphy, and paintings, to Rolls Royce high-end interior designs.',
      pe: 'They embroider patterns such as landscapes, flowers, birds, and insects onto a rich tapestry of products, from commodities like clothing, hats, and scarves, to embroidery artworks resembling calligraphy or painting, and even high-end interior designs for Rolls Royce.',
      fix: '补细节（patterns/insects/tapestry）+ 加 even',
      flaw: 'artworks→artwork、design→decorations、Rolls-Royce 连字符',
      comment: '信息表达更清晰、补充细节并增加逻辑词 even。细节不足：artworks 建议改 artwork、design 建议改 decorations、Rolls Royce 应为 Rolls-Royce。'
    },
    {
      src: '每一代绣娘都在手艺的精进和社会的需求中寻找着刺绣的一席之地，苏绣的精细已越发凸显其地域性、艺术性、国际性。',
      mt: "Every generation of embroiderers seeks a place for embroidery in the refinement of their craft and the needs of society. The refinement of Su embroidery has increasingly highlighted its regional, artistic, and international characteristics.",
      pe: 'With generations of embroiderers refining their crafts to meet the demands of society, Su embroidery now boasts regional, artistic, and international characteristics.',
      fix: '改结构主语 + 表达暗含逻辑',
      flaw: '',
      comment: '变更句子结构和主语，更好地表达原文暗含的逻辑关系和意义。'
    }
  ]
};

/* ============================================================
 * 另外两位参赛选手的点状作答（各仅 1 段，作横向参照 + 避坑教学）
 * 来源：参考资料/译后编辑真题对照表.csv
 *   · educability（第七届初赛·英→汉）→ 字面直译反面教材
 *   · 何园（第七届决赛·汉→英）→ 脱离语境反面教材
 * 数据量各 1 段，不足支撑画像外推，仅做单句/标题级对照。
 * ============================================================ */
window.RIVALS = {
  educability: {
    style: '字面直译',
    verdict: '典型陷阱：死扣单词原意、跳不出字面。cross-pollination 在此不是「授粉」，而是「知识跨界贯通」。',
    seg: {
      src: 'It makes you wonder what other cross-pollinations have occurred.',
      mt: '这让你不禁想知道还有哪些其他的交叉授粉发生过。',
      pe: '这会让人好奇还有哪些其他的「跨领域授粉」曾经发生过。',
      comment: '选手模糊捕捉到 cross 意指「结合不同领域」，但未能跳出单词原意「授粉」的限制。结合前文语境，此处 cross-pollination 并非字面意义上的异花授粉，语义为「知识在脑子里相互调用、贯通的现象」。整句宜改为「这让人不禁想知道还有哪些关联贯通的现象发生过。」'
    }
  },
  heyuan: {
    style: '脱离语境',
    verdict: '典型陷阱：理解到位但表达过度抽象、脱离园林步道的具体语境。',
    seg: {
      src: '立体交通，居游两宜',
      mt: 'Three-dimensional transportation, suitable for both living and traveling',
      pe: 'Three-Dimensional Connectivity for Residence and Recreation',
      comment: '选手理解了「交通」的真正含义，但表达较为抽象。结合后文「满足居住者在园内的日常行走需要」，此处「立体交通」并非车水马龙的公共街道，而是供人行走、立体交错的园林步道（如回廊、鹅卵石路等）。小标题宜改为「The three-dimensional walking system providing spaces for both living and sightseeing」。'
    }
  }
};
