/* ============================================================
 * 译后编辑实训平台 - 内置语料库
 * 每个任务: { id, name, pair, domain, minutes, tips, terms, segs }
 * seg: { src 原文, mt 机翻译文(含典型错误), ref 参考译文, notes 教学点评 }
 * ============================================================ */

const TASKS = [
  {
    id: 't1',
    name: 'AI 芯片发布会新闻',
    pair: '英译中',
    domain: '科技',
    minutes: 12,
    tips: '科技文本重准确：数字、单位、术语不能错；英文被动句常可改为主动句；"less/fewer"等否定词漏译是机翻高频错误。',
    terms: [
      { s: 'computing power', t: '算力' },
      { s: 'edge devices', t: '边缘设备' },
      { s: 'hallucination', t: '幻觉（模型生成虚假内容）' },
      { s: 'benchmark', t: '基准测试' },
      { s: 'predecessor', t: '上一代产品' },
      { s: 'latency', t: '延迟' }
    ],
    segs: [
      {
        src: 'The new chip delivers twice the computing power while consuming 30 percent less energy.',
        mt: '这款新芯片提供了两倍的算力，同时消耗了30%的能源。',
        ref: '这款新芯片算力提升一倍，能耗降低30%。',
        notes: [
          { type: '漏译', text: '"less"被漏译——原意是能耗降低30%，机翻译成了"消耗30%的能源"，意思完全相反，属于严重错误。' },
          { type: '搭配', text: '"提供了算力"可改为"算力提升一倍"，更符合中文科技新闻表达。' }
        ]
      },
      {
        src: 'Artificial intelligence will not replace translators, but translators who use AI may replace those who do not.',
        mt: '人工智能不会取代译者，但使用人工智能的译者可能会取代那些不使用的人。',
        ref: '人工智能不会取代译者，但会用AI的译者可能会取代不用AI的译者。'
      },
      {
        src: 'The model was trained on a corpus of over 200 million bilingual sentence pairs.',
        mt: '该模型在一个包含超过200万双语句子对的语料库上进行了训练。',
        ref: '该模型基于超过2亿句对的双语语料库训练而成。',
        notes: [
          { type: '数字错误', text: '200 million = 2亿，机翻误作"200万"，差了三个数量级。数字是科技文本的生命线，必须逐一核对。' }
        ]
      },
      {
        src: 'Latency has been reduced from 50 milliseconds to just 8 milliseconds.',
        mt: '延迟已从50毫秒减少到仅8毫秒。',
        ref: '延迟已从50毫秒降至仅8毫秒。'
      },
      {
        src: 'Developers can now deploy the model on edge devices such as smartphones and smart speakers.',
        mt: '开发者现在可以在边缘设备上部署该模型，例如智能手机和智能扬声器。',
        ref: '开发者现在可将该模型部署到智能手机、智能音箱等边缘设备上。',
        notes: [
          { type: '语序欧化', text: '英语后置举例"such as..."直译成"例如..."尾巴过长，中文习惯把例子放在"等"之前。' },
          { type: '术语', text: '"smart speakers"规范译名为"智能音箱"。' }
        ]
      },
      {
        src: 'The company plans to open-source the framework by the end of this year.',
        mt: '该公司计划在今年年底之前开源这个框架。',
        ref: '该公司计划于今年年底前将这一框架开源。'
      },
      {
        src: 'Despite these advances, hallucination remains a major challenge for large language models.',
        mt: '尽管有这些进步，幻觉仍然是大型语言模型的主要挑战。',
        ref: '尽管取得了这些进展，幻觉问题仍是大型语言模型面临的一大挑战。',
        notes: [
          { type: '搭配', text: '"尽管有这些进步"较生硬，可改为"尽管取得了这些进展"。' },
          { type: '表达', text: '"是……的主要挑战"可补出"面临"，使逻辑主体更清晰。' }
        ]
      },
      {
        src: 'Benchmark results show that the system outperforms its predecessor by 15 percent on average.',
        mt: '基准测试结果显示，该系统平均比其前代产品高出15%。',
        ref: '基准测试结果显示，该系统的整体性能平均超越上一代产品15%。'
      }
    ]
  },
  {
    id: 't2',
    name: '跨境支付公司半年报新闻稿',
    pair: '英译中',
    domain: '商务',
    minutes: 10,
    tips: '商务新闻稿重地道：多用四字结构与主谓短句；警惕一词多义（如 close 收盘/完成交割）；客户与合规表述要符合行业惯例。',
    terms: [
      { s: 'cross-border payment', t: '跨境支付' },
      { s: 'year on year', t: '同比' },
      { s: 'compliance', t: '合规' },
      { s: 'acquisition', t: '收购' },
      { s: 'close (a deal)', t: '完成交割' },
      { s: 'onboarding', t: '（客户）入驻' },
      { s: 'retention', t: '留存' }
    ],
    segs: [
      {
        src: 'Founded in 2015, the startup has grown into a leading provider of cross-border payment solutions.',
        mt: '成立于2015年，这家初创公司已经成长为跨境支付解决方案的领先提供商。',
        ref: '这家初创公司成立于2015年，现已成长为跨境支付解决方案领域的领军企业。',
        notes: [
          { type: '语序欧化', text: '英语分词开头直译为"成立于2015年，……"，中文更习惯先出主语。' },
          { type: '表达', text: '"领先提供商"可润色为"领军企业"。' }
        ]
      },
      {
        src: 'Revenue for the first half of the year rose 24 percent year on year, driven by strong demand in Southeast Asia.',
        mt: '受东南亚强劲需求的推动，今年上半年收入同比增长了24%。',
        ref: '受东南亚市场强劲需求拉动，公司今年上半年营收同比增长24%。'
      },
      {
        src: 'The company serves more than 10,000 enterprise clients across 40 countries and regions.',
        mt: '该公司为40个国家和地区超过1万家企业客户提供服务。',
        ref: '公司业务覆盖40个国家和地区，服务企业客户超过1万家。'
      },
      {
        src: 'We remain committed to compliance and will work closely with regulators in every market we enter.',
        mt: '我们仍然承诺合规，并将与我们进入的每个市场的监管机构密切合作。',
        ref: '我们始终致力于合规经营，并将与所进入每个市场的监管机构保持密切合作。',
        notes: [
          { type: '搭配', text: '"承诺合规"不够地道，商务语境常用"致力于合规经营"。' }
        ]
      },
      {
        src: 'The acquisition is expected to close in the fourth quarter, subject to regulatory approval.',
        mt: '此次收购预计将在第四季度关闭，等待监管批准。',
        ref: '本次收购预计于第四季度完成交割，尚待监管机构批准。',
        notes: [
          { type: '词义错误', text: '"close"在此指交易完成交割，而非"关闭"——典型的一词多义陷阱。' },
          { type: '表达', text: '"等待监管批准"可改为更正式的"尚待监管机构批准"。' }
        ]
      },
      {
        src: 'Customer retention improved from 82 percent to 91 percent following the redesign of our onboarding process.',
        mt: '客户保留率从82%提高到91%，在我们重新设计入职流程之后。',
        ref: '在重新设计客户入驻流程后，客户留存率从82%提升至91%。',
        notes: [
          { type: '语序欧化', text: '时间状语后置的"……，在……之后"是典型欧化句，应前移。' },
          { type: '术语', text: '"onboarding"指客户入驻流程，不是员工"入职"；"retention"规范说法为"留存率"。' }
        ]
      }
    ]
  },
  {
    id: 't3',
    name: '苏州文旅推介文案',
    pair: '中译英',
    domain: '文旅',
    minutes: 12,
    tips: '中译外重译名与搭配：文化遗产名称用官方译名（如拙政园 the Humble Administrator\'s Garden）；主谓一致、介词搭配是机翻重灾区；中文流水句需断句重组。',
    terms: [
      { s: '拙政园', t: "the Humble Administrator's Garden" },
      { s: '评弹', t: 'Pingtan storytelling' },
      { s: '刺绣', t: 'embroidery' },
      { s: '高铁', t: 'high-speed rail' },
      { s: '平江路', t: 'Pingjiang Road' },
      { s: '江南', t: 'Jiangnan (regions south of the Yangtze River)' }
    ],
    segs: [
      {
        src: '苏州园林以其精巧的设计和深厚的历史底蕴闻名于世。',
        mt: 'Suzhou gardens is famous for its exquisite design and deep historical foundation.',
        ref: 'Suzhou gardens are renowned worldwide for their exquisite design and profound historical heritage.',
        notes: [
          { type: '语法', text: '主谓不一致：gardens is → gardens are；its 应为 their。' },
          { type: '搭配', text: '"deep historical foundation"是字面直译，惯用表达为 profound historical heritage。' }
        ]
      },
      {
        src: '游客可以乘坐高铁在30分钟内从上海到达苏州。',
        mt: 'Tourists can take the high-speed train to arrive Suzhou from Shanghai in 30 minutes.',
        ref: 'Visitors can reach Suzhou from Shanghai in just 30 minutes by high-speed rail.',
        notes: [
          { type: '语法', text: 'arrive 是不及物动词，须说 arrive in Suzhou；更简洁的写法是 reach Suzhou。' }
        ]
      },
      {
        src: '每年春天，拙政园的杜鹃花展吸引数十万国内外游客。',
        mt: 'Every spring, the azalea exhibition in Zhuozheng Garden attracts hundreds of thousands of tourists from home and abroad.',
        ref: "Every spring, the azalea show at the Humble Administrator's Garden attracts hundreds of thousands of visitors from home and abroad.",
        notes: [
          { type: '术语', text: '拙政园有官方译名 the Humble Administrator\'s Garden，拼音"Zhuozheng Garden"仅在辅译场合可用。' }
        ]
      },
      {
        src: '这座古城保存了宋元明清各代的桥梁和民居建筑。',
        mt: 'This ancient city has preserved bridges and residential buildings of Song, Yuan, Ming and Qing Dynasties.',
        ref: 'The ancient city preserves bridges and folk houses dating from the Song, Yuan, Ming and Qing dynasties.'
      },
      {
        src: '当地政府启动了一项为期三年的保护计划，以恢复古城的水系。',
        mt: 'The local government has launched a three-year protection plan to restore the water system of the ancient city.',
        ref: 'The local government has launched a three-year conservation program to restore the ancient city\'s waterways.'
      },
      {
        src: '漫步在平江路，游客可以体验评弹、刺绣等传统江南文化。',
        mt: 'Walking in Pingjiang Road, visitors can experience Pingtan, embroidery and other traditional Jiangnan cultures.',
        ref: 'Strolling along Pingjiang Road, visitors can experience traditional Jiangnan culture such as Pingtan storytelling and embroidery.',
        notes: [
          { type: '搭配', text: '"Walk in a road"应为 walk along / stroll along；"stroll"更贴合"漫步"。' },
          { type: '语法', text: 'culture 不可数，cultures 需改回单数；"Pingtan"最好补出 storytelling 便于外国读者理解。' }
        ]
      }
    ]
  },
  {
    id: 't4',
    name: '健康科普文章（用药与疫苗）',
    pair: '中译英',
    domain: '医学科普',
    minutes: 10,
    tips: '医学科普重规范：剂量、温度、症状名称必须准确；"服药期间"等固定表达用 while taking；注意 continuous/persistent 这类近义词的区分。',
    terms: [
      { s: '心血管疾病', t: 'cardiovascular disease' },
      { s: '副作用', t: 'side effects' },
      { s: '冷链', t: 'cold chain' },
      { s: '临床试验', t: 'clinical trials' },
      { s: '就医', t: 'seek medical attention' },
      { s: '视力模糊', t: 'blurred vision' }
    ],
    segs: [
      {
        src: '研究表明，每天步行30分钟可以显著降低患心血管疾病的风险。',
        mt: 'Research shows that walking 30 minutes a day can significantly reduce the risk of cardiovascular disease.',
        ref: 'Research shows that walking 30 minutes a day can significantly reduce the risk of cardiovascular disease.'
      },
      {
        src: '医生建议患者服药期间避免饮酒。',
        mt: 'Doctors suggest patients avoid drinking alcohol during taking medicine.',
        ref: 'Doctors advise patients to avoid alcohol while taking the medication.',
        notes: [
          { type: '语法', text: '"during taking medicine"不成立——during 后接名词短语，动词短语须用 while taking。' },
          { type: '搭配', text: '医嘱语境 advise sb to do 比 suggest sb do 更规范。' }
        ]
      },
      {
        src: '疫苗需要在2至8摄氏度的条件下冷藏运输。',
        mt: 'Vaccines need to be cold chain transported under the condition of 2-8 degrees Celsius.',
        ref: 'Vaccines must be transported under cold-chain conditions at 2 to 8 degrees Celsius.',
        notes: [
          { type: '搭配', text: '"cold chain transported"是生硬拼凑，应为 transported under cold-chain conditions。' }
        ]
      },
      {
        src: '临床试验显示，该药物的有效率达到92%，且副作用轻微。',
        mt: 'Clinical trials show that the effective rate of the drug reaches 92%, and side effects are slight.',
        ref: 'Clinical trials show that the drug has an efficacy rate of 92%, with only mild side effects.',
        notes: [
          { type: '术语', text: '药物"有效率"规范表达为 efficacy rate；"轻微"修饰副作用用 mild 而非 slight 更地道。' }
        ]
      },
      {
        src: '请注意，本说明不能替代专业医疗建议。',
        mt: 'Please note that this instruction cannot replace professional medical advice.',
        ref: 'Please note that this information is not a substitute for professional medical advice.'
      },
      {
        src: '如果出现持续头痛或视力模糊等症状，请立即就医。',
        mt: 'If symptoms such as continuous headache or blurred vision appear, please seek medical attention immediately.',
        ref: 'If you experience symptoms such as persistent headache or blurred vision, seek medical attention immediately.',
        notes: [
          { type: '搭配', text: '持续性头痛的规范说法是 persistent headache，continuous 强调"不间断"，语境不同。' },
          { type: '风格', text: '医嘱常用第二人称祈使句"If you experience..., seek..."，比 symptoms appear 更直接。' }
        ]
      }
    ]
  }
];

/* 内置演示排行榜（静态演示数据，仅用于展示排名效果） */
const DEMO_BOARD = {
  t1: [['林亦扬', 93.5], ['周雨桐', 91.8], ['陈昊', 90.2], ['吴倩', 88.6], ['郑凯文', 86.9], ['王小满', 84.3]],
  t2: [['苏明玉', 94.1], ['高一鸣', 92.0], ['林亦扬', 89.7], ['刘思远', 87.5], ['陈昊', 85.2]],
  t3: [['赵文萱', 92.7], ['周雨桐', 90.5], ['钱可盈', 88.9], ['吴倩', 86.4], ['郑凯文', 83.8]],
  t4: [['何静姝', 95.0], ['苏明玉', 92.6], ['高一鸣', 90.8], ['钱可盈', 88.1], ['王小满', 85.5]]
};
