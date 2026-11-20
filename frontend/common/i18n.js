/**
 * 界面语言（中 / 英）
 *
 * 设计取舍：**用中文原句当 key**，不再发明一套 key 名。
 * 原因：这个项目的中文文案是边写边改的，key 名一旦和文案脱钩就得维护两份；
 * 而 `t('餐前推荐')` 读起来和原文一样，漏译时会原样退回中文，不会出现「plan.title」这种
 * 给用户看的乱码。代价是同一句话在两处写法不同就得写两条 —— 可以接受。
 *
 * 带变量的句子用 `{名字}` 占位：`t('共 {n} 条记录', { n: 12 })`。
 * 不拼字符串是必须的 —— 英文语序和中文不同，'共 ' + n + ' 条记录' 直译过去是病句。
 *
 * 只翻「界面文案」。菜名、地区名、店家名一律不翻：
 *   - 菜名来自数据库，翻了就对不上菜单也搜不到；
 *   - 世界菜单那 1525 条本来就同时给了当地名与中文名，再机器翻译一遍只会更乱。
 */
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

export const LOCALES = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
];

const STORE_KEY = 'lang';

export const locale = ref('zh');

const DICT = {
  // ── 首页 ──
  今天也要好好吃饭: 'Eat well today too',
  已确认用餐: 'Meals logged',
  图鉴解锁: 'Dishes unlocked',
  获得勋章: 'Badges earned',
  餐前推荐: 'Meal planner',
  '按预算/热量搭一桌': 'Build a table by budget & calories',
  世界菜单: 'World menu',
  '七地区 1525 道比价': '1,525 dishes across 7 regions',
  餐后记录: 'Log a meal',
  '拍照/OCR/手动记账': 'Photo / OCR / manual entry',
  用餐历史: 'Meal history',
  回看评级与花费: 'Review ratings & spending',
  图鉴勋章: 'Guide & badges',
  解锁更多寿司: 'Unlock more sushi',
  最近用餐: 'Recent meals',
  '全部 ›': 'All ›',
  '还没有记录，去记一顿吧': 'No records yet — log your first meal',
  已作废: 'Voided',
  已确认: 'Confirmed',
  草稿: 'Draft',
  '你好，{name} 👋': 'Hi, {name} 👋',
  食客: 'Diner',
  管理员: 'Admin',
  '图鉴进度 {n}%': 'Guide progress {n}%',
  '{n} 道菜 · 实付 ¥{x}': '{n} dishes · paid ¥{x}',
  '{n} 分': '{n} pts',
  '{t} · {n} 分': '{t} · {n} pts',

  // ── 菜单 ──
  搜索: 'Search',
  全部: 'All',
  清除: 'Clear',
  '加载中…': 'Loading…',
  '连不上后端，请先启动服务后下拉刷新': "Can't reach the server. Start it, then pull to refresh.",
  '连不上后端，请先启动服务': "Can't reach the server. Start it first.",
  没有找到菜品: 'No dishes found',
  已排除过敏原: 'Allergens excluded',
  '关闭 ✕': 'Close ✕',
  单价: 'Unit price',
  '可能含有（日本28品目推断）': "May contain (inferred from Japan's 28 allergens)",
  去记录这道菜: 'Log this dish',
  搜索菜品: 'Search dishes',
  在售: 'On sale',
  待上架: 'Coming soon',
  已下架: 'Delisted',
  避开过敏原: 'Avoid allergens',
  '（已排除 {n} 项）': ' ({n} excluded)',
  '共 {n} 道': '{n} dishes',
  '，已显示 {n}': ', {n} shown',
  ' · 预计 {d}': ' · expected {d}',
  '加载更多（{a}/{b}）': 'Load more ({a}/{b})',
  '热量/过敏原为推断值': 'Calories / allergens are inferred',
  官网未提供营养信息: 'No official nutrition data',
  '热量与过敏原是程序按菜名关键词估出来的，不是官方标示。热量误差可能在 ±20%；过敏原请以店家的配料表为准，吃不准就问店员。':
    'Calories and allergens are estimated by the program from dish-name keywords, not official figures. Calories may be off by ±20%. For allergens, trust the shop ingredient list — ask the staff if unsure.',
  份: 'serving',
  暂无描述: 'No description',
  'kcal / {u}': 'kcal / {u}',

  // ── 世界菜单 ──
  全部分类: 'All categories',
  无单品图: 'No photo',
  当地售价: 'Local price',
  折合人民币: 'In CNY',
  食材: 'Ingredients',
  形态: 'Form',
  风味: 'Flavor',
  本页: 'This page',
  口味不同: 'Different taste',
  '搜菜名 / 食材，如 三文鱼、tuna、鮭魚': 'Search dish or ingredient',
  '全部 {n}': 'All {n}',
  '已全部加载 {n} 道': 'All {n} dishes loaded',
  '同食材同形态 · 跨地区比价（共 {n} 地）':
    'Same ingredient & form · cross-region price ({n} regions)',
  '同食材同形态 · 跨地区比价（共 {n} 地，只显示最便宜 {m} 条）':
    'Same ingredient & form · cross-region price ({n} regions, cheapest {m} shown)',
  '七地区共 {n} 道 · 有图 {m} 道': '{n} dishes in 7 regions · {m} with photo',
  '{s} 共 {n} 道': '{s} · {n} dishes',

  // ── 图鉴 ──
  '连不上后端，请先启动服务后重新进入': "Can't reach the server. Start it, then reopen this page.",
  暂无菜品: 'No dishes',
  这个筛选下还没有菜品: 'Nothing in this filter yet',
  未解锁: 'Locked',
  已解锁: 'Unlocked',
  暂无勋章: 'No badges',
  这个筛选下还没有勋章: 'No badges in this filter yet',
  已获得: 'Earned',
  未获得: 'Not yet',
  '图鉴 {a}/{b}': 'Guide {a}/{b}',
  '勋章 {a}/{b}': 'Badges {a}/{b}',
  '{n} 次 · {m} 份': '{n}× · {m} servings',

  // ── 历史 ──
  '还没有用餐记录，去记一顿吧': 'No meals yet — log your first one',
  删除: 'Delete',
  '共 {n} 条记录': '{n} records',
  隐藏作废: 'Hide voided',
  '显示作废（{n}）': 'Show voided ({n})',
  '{n} 道菜': '{n} dishes',
  ' · 实付 ¥{x}': ' · paid ¥{x}',
  ' · 自评 {n} 星': ' · self-rated {n}★',
  彻底删除这条记录: 'Delete this record permanently',
  ' 道菜。明细、评级和它带来的图鉴进度都会回滚，删了找不回来。':
    ' dishes. Details, rating and the guide progress it earned will all roll back. This cannot be undone.',
  '如果只是不想让它计入统计，用详情页的「作废」就好。':
    'If you only want it excluded from stats, use "Void" on the detail page instead.',
  彻底删除: 'Delete permanently',
  已删除: 'Deleted',

  // ── 推荐 ──
  '单人预算（元）*': 'Budget per person (¥) *',
  '健康目标（可选）': 'Health goal (optional)',
  '热量区间（可选）': 'Calorie range (optional)',
  不限: 'Any',
  儿童套餐模式: 'Kids mode',
  '正在算三套…': 'Calculating three options…',
  '一次看三套（省钱 / 均衡 / 吃饱）': 'Compare three (cheap / balanced / filling)',
  '会先排除你的忌口 / 过敏标签，再按喜欢口味排序，尽量贴近预算。':
    'Excludes your avoid / allergy tags first, then sorts by preferred taste and stays close to your budget.',
  三套方案: 'Three options',
  '收起 ✕': 'Hide ✕',
  '同一个预算和热量区间，三种点法。都还没保存，选一套再生成。':
    'Same budget and calorie range, three ways to order. Nothing is saved yet — pick one to generate it.',
  '用「正常 500–700」再比': 'Compare again with "Normal 500–700"',
  不可行: 'Not possible',
  用这套: 'Use this one',
  '例如 80': 'e.g. 80',
  下限: 'Min',
  上限: 'Max',
  '轻食 300–500': 'Light 300–500',
  '正常 500–700': 'Normal 500–700',
  '吃饱 700–900': 'Filling 700–900',
  '大份 900–1200': 'Large 900–1200',
  '只填上限也行。下限留空时，系统会拿上限的 80% 作为「至少要吃够」的目标，然后在上限以内尽量往上凑；两框都填就按你填的来。下限填得比上限大时会直接报错，不会偷偷改你的数。':
    'Filling in just the max is fine. With min left blank, the system targets 80% of the max as "at least eat this much" and fills up to the max; fill both and your numbers are used as-is. A min above the max is a hard error — your numbers are never silently changed.',
  '开了之后：不选生食与苦味的菜、甜味的菜优先，每样只点一份。孩子的辣度和份量我们没有字段，这两项不做判断。':
    'When on: no raw or bitter dishes, sweet dishes come first, one serving of each. We have no spiciness or portion fields for children, so those two are not judged.',
  '计算中…': 'Calculating…',
  生成推荐组合: 'Generate options',
  '这次三套算出来是一样的 —— 三种策略的差别全在「热量目标」上，没填上限时它们就退化成同一种点法。':
    'All three came out identical this time — the only difference between the strategies is the calorie target, so without a max they collapse into one way of ordering.',
  填个区间再比一次就能看出区别: 'Fill in a range and compare again to see the difference.',
  ' · 达到{base}的 {n}%': ' · {n}% of {base}',
  目标: 'target',
  '上限2': 'max',
  '推荐结果': 'Recommended plan',
  '剩余预算 ¥{x}': 'Budget left ¥{x}',
  预计总价: 'Est. total',
  预计热量: 'Est. calories',
  '热量 ≈{a} / {b}': 'Calories ≈{a} / {b}',
  '（{n}%）': '({n}%)',
  ' · 你填的下限 {n}': ' · your min {n}',
  ' · 未填下限，按目标的 {n} 去凑': ' · no min set, aiming for the {n} target',
  '预算用完也只够这么多，想更接近{base}可以抬预算或换个区间。':
    'The budget only stretches this far. To get closer to the {base}, raise the budget or change the range.',
  '目标是「{g}」': 'Goal: "{g}"',
  '注意：我们只有「甜味」标签，没有糖分数据。咸味菜里的隐形糖、标了无糖但含淀粉的菜，这套都判不出来。':
    'Note: we only have a "sweet" tag, no sugar data. Hidden sugar in savoury dishes, or starch in dishes labelled sugar-free, cannot be detected.',
  用这个计划去记录: 'Log a meal with this plan',
  '历史计划': 'Past plans',
  '历史计划（{n}）': 'Past plans ({n})',
  刷新: 'Refresh',
  还没有生成过计划: 'No plans generated yet',
  '预算 ¥{a} · 预计 ¥{b}': 'Budget ¥{a} · est. ¥{b}',
  ' · 上限 {n} kcal': ' · max {n} kcal',
  '计划只是当时的推荐，删除不影响用餐记录。被记录引用过的会保留。':
    'Plans are just past recommendations — deleting one does not affect meal records. Plans referenced by a record are kept.',
  '清空历史计划（{n} 条）': 'Clear past plans ({n})',
  请输入预算: 'Enter a budget',
  这三套在当前预算下都排不出来: 'None of the three work with this budget',
  '已生成「{g}」计划': 'Created the "{g}" plan',
  删除这个计划: 'Delete this plan',
  '预算 ¥{a} · {d}。删了找不回来，但用餐记录不受影响。':
    'Budget ¥{a} · {d}. This cannot be undone, but meal records are unaffected.',
  清空历史计划: 'Clear past plans',
  '会删掉 {n} 条计划。被用餐记录引用过的会保留，用餐记录本身一条都不会动。':
    'This deletes {n} plans. Plans referenced by a meal record are kept; meal records themselves are untouched.',
  清空: 'Clear',
  '已清空 {n} 条': 'Cleared {n}',
  '已删除2': 'Deleted',

  // ── 我的 ──
  用餐: 'Meals',
  计划: 'Plans',
  解锁: 'Unlocked',
  勋章: 'Badges',
  我的: 'Me',
  推荐计划: 'Saved plans',
  图鉴与勋章: 'Guide & badges',
  七地区世界菜单: 'World menu, 7 regions',
  '1525 道 ›': '1,525 dishes ›',
  昵称: 'Nickname',
  保存: 'Save',
  口味偏好与忌口: 'Tastes & restrictions',
  保存偏好: 'Save preferences',
  '点击标签选择：喜欢 / 不喜欢 / 忌口 / 过敏 / 清除':
    'Tap a tag to set: like / dislike / avoid / allergy / clear',
  修改密码: 'Change password',
  确认修改: 'Confirm',
  管理后台: 'Admin',
  '菜品 / 标签 / 勋章 ›': 'Dishes / tags / badges ›',
  界面动效: 'Animations',
  '列表进场、加载闪动这类动画。觉得晃眼可以关掉。':
    'Entrance and loading animations. Turn off if they bother you.',
  显示系统评级: 'Show meal rating',
  '关掉后，首页、历史记录、详情页都不再显示「很棒 / 不错 / 一般」这类档位，分数也一并隐藏。预算、热量、口味匹配这些事实仍然照常显示，评分数据本身一条都不删。':
    'When off, the home, history and detail pages stop showing tiers like "Great / Good / Fine", and the score is hidden too. Budget, calories and taste match are facts and stay visible — no rating data is deleted.',
  退出登录: 'Sign out',
  原密码: 'Current password',
  '新密码（至少 6 位）': 'New password (6+ characters)',
  语言: 'Language',
  '界面文字用哪种语言。菜名和商家信息不翻译。': "Which language the interface uses. Dish names and shop data are not translated.",
  '{n} 条 ›': '{n} ›',
  喜欢: 'Like',
  不喜欢: 'Dislike',
  忌口: 'Avoid',
  过敏: 'Allergy',
  已关闭动效: 'Animations off',
  已开启动效: 'Animations on',
  已切回中文: 'Switched to Chinese',
  已保存: 'Saved',
  偏好已保存: 'Preferences saved',
  '新密码至少 6 位': 'New password needs 6+ characters',
  密码已修改: 'Password changed',
  已显示评级: 'Rating shown',
  已隐藏评级: 'Rating hidden',

  // ── 餐后记录 ──
  本次菜品: 'Dishes in this meal',
  '＋ 添加菜品': '＋ Add dish',
  '还没有菜品，点右上角添加，或用下方拍照识别':
    'No dishes yet. Add one above, or use photo recognition below.',
  菜单价估算: 'Est. menu price',
  热量估算: 'Est. calories',
  用餐提示: 'Dining notes',
  未命中: 'No match',
  '这条是按菜品的日本 28 品目过敏原数据查的，比中文标签全；宁可多提醒一次。':
    "Checked against each dish's Japanese 28-allergen data, which is more complete than the Chinese tags. One extra warning beats none.",
  '这一单可能含有（日本 28 品目推断）': "This order may contain (inferred from Japan's 28 allergens)",
  '过敏原由菜品配料推断，不是店家标注；对某样严重过敏请以店员确认为准。':
    'Allergens are inferred from ingredients, not labelled by the shop. For a severe allergy, ask the staff.',
  账单与评分: 'Bill & rating',
  用餐人数: 'Diners',
  '茶位费 / 服务费（每位，元）': 'Tea / service charge (per person, ¥)',
  '账单实付（元）': 'Amount paid (¥)',
  填入: 'Fill in',
  '自评（1-5 星）': 'Your rating (1-5 stars)',
  短评: 'Short note',
  '照片识别（演示）': 'Photo recognition (demo)',
  '上传账单或菜品照片后，系统会加入一份草稿，你可以自由修改。':
    'After you upload a bill or dish photo, a draft is added that you can edit freely.',
  上传账单照片: 'Upload bill photo',
  上传菜品照片: 'Upload dish photo',
  '已加入的菜品标记为 source=mock —— 演示数据，请逐条核对或删除。':
    'Added dishes are marked source=mock — demo data. Check or delete them one by one.',
  本次用餐评级: 'Rating for this meal',
  '🎉 新获得勋章：': '🎉 New badges:',
  查看用餐历史: 'View meal history',
  保存草稿: 'Save draft',
  没有匹配的菜品: 'No matching dishes',
  不清楚就留空: 'Leave blank if unsure',
  '例如 76': 'e.g. 76',
  '这顿吃得怎么样？': 'How was this meal?',
  '搜索菜名，如 三文鱼': 'Search a dish, e.g. salmon',
  '来自推荐计划 · 预算 ¥{x}': 'From a plan · budget ¥{x}',
  ' · 热量上限 {n} kcal': ' · calorie cap {n} kcal',
  '{n} 项过敏': '{n} allergen hits',
  '{n} 项存疑': '{n} uncertain',
  '{n} 项忌口': '{n} avoid hits',
  '{d} 含「{t}」（{k}）': '{d} contains "{t}" ({k})',
  '这一单里的菜被标注含「{l}」，和你设置的过敏项同名 —— 中文标签没标，所以上面查不到。':
    'A dish in this order is tagged as containing "{l}", which matches an allergen you set — the Chinese tag did not mark it, so the check above missed it.',
  '已选 {n} 道，都没有命中你设置的忌口与过敏项。':
    '{n} dishes selected, none hits your avoid or allergy settings.',
  '⚠ 已超出计划预算 ¥{x}': '⚠ ¥{x} over the plan budget',
  '✓ 在计划预算内': '✓ Within the plan budget',
  '⚠ 已超出热量上限 {n} kcal': '⚠ {n} kcal over the calorie cap',
  '✓ 在热量上限内': '✓ Within the calorie cap',
  '{n} 人': '{n} diners',
  '按 {n} 人拆计划：人均预算': 'Split across {n}: budget per person',
  '人均热量 {n} kcal': '{n} kcal per person',
  '这家店收不收茶位费我们没有依据，所以默认 0 —— 按实际小票填，填了才会算进下面的合计，不会自动给账单加钱。':
    'We have no basis for whether this shop charges a tea fee, so it defaults to 0. Fill it in from the actual receipt — only then does it count toward the total below. Nothing is added to your bill automatically.',
  '菜品 ¥{a} + 茶位费 ¥{b}（{n} 人 × ¥{c}）':
    'Dishes ¥{a} + tea fee ¥{b} ({n} × ¥{c})',
  '当前版本尚未接入真实 OCR：草稿是从在售菜品里随机取的示例数据，不是从照片里读出来的。':
    'This version does not use real OCR yet: the draft is random sample data from on-sale dishes, not read from your photo.',
  '已上传 {n} 张图片': '{n} photos uploaded',
  '综合得分 {n} 分': 'Overall score {n}',
  '预算：{x}': 'Budget: {x}',
  '热量：{x}': 'Calories: {x}',
  '口味匹配：{n}%': 'Taste match: {n}%',
  确认用餐: 'Confirm meal',
  '选择菜品（{n}）': 'Choose dishes ({n})',
  已保存草稿: 'Draft saved',
  请先添加菜品: 'Add a dish first',
  '已确认用餐2': 'Meal confirmed',
  '生成草稿…': 'Generating draft…',
  '已加入 {n} 条演示草稿，请核对后修改': 'Added {n} demo drafts — check and edit them',
  没有可加入的草稿: 'No drafts to add',

  // ── 记录详情 ──
  '这顿已作废，不计入图鉴进度与勋章统计，评级仅供参考。':
    "This meal is voided: it doesn't count toward guide progress or badges. The rating is for reference only.",
  菜品明细: 'Dish details',
  系统评级: 'System rating',
  '（已作废）': '(voided)',
  照片: 'Photos',
  '这些照片只有你自己能看到。长按可以删除。': 'Only you can see these photos. Long-press to delete.',
  删除照片: 'Delete photo',
  作废: 'Void',
  '你关掉了系统评级，档位与分数不显示。下面的预算 / 热量 / 口味匹配是这顿饭的事实，照常显示。':
    'You turned off the system rating, so the tier and score are hidden. Budget, calories and taste match are facts about this meal and stay visible.',
  '实付 ¥{x} · 自评 {s}': 'Paid ¥{x} · self-rated {s}',
  '作废只是打上标记、不计入统计，记录本身还在。彻底删除会把明细、评级和它带来的图鉴进度一起回滚，找不回来。':
    'Voiding only marks the meal and excludes it from stats; the record stays. Deleting permanently rolls back the details, rating and the guide progress it earned — that cannot be undone.',
  未设置计划: 'No plan set',
  '达成 ✓': 'Met ✓',
  '超支 {x} 元': 'Over by ¥{x}',
  未设置上限: 'No cap set',
  超出: 'Over',
  记录加载失败: 'Failed to load the record',
  '评级中…': 'Rating…',
  '明细、评级、图鉴进度都会一起回滚，删了找不回来。如果只是想让它不计入统计，用「作废」就好。':
    'Details, rating and guide progress all roll back — this cannot be undone. If you only want it excluded from stats, use "Void" instead.',
  '删除这条记录': 'Delete this record',
  ' · {n} 道': ' · {n} items',
  '密码至少 6 位': 'Password must be at least 6 characters',
  '已生成「{l}」计划': 'Created the "{l}" plan',
  '来自推荐计划 · 预算 ¥{b}': 'From a recommended plan · budget ¥{b}',
  '热量 ≈{a} / {b} {c} kcal（{d}%）': 'Calories ≈{a} / {b} {c} kcal ({d}%)',
  '目标：{n}': 'Target: {n}',
  '需要 {n} 次': '{n}×',
  '预算 ¥{a} · {b}。删了找不回来，但用餐记录不受影响。':
    'Budget ¥{a} · {b}. This cannot be undone, but meal records are not affected.',
  '预计热量 kcal': 'Est. calories (kcal)',
  '（{n}）': ' ({n})',
  '这一单里的菜被标注含「{a}」，和你设置的过敏项同名 —— 中文标签没标，所以上面查不到。':
    'A dish in this order is tagged as containing "{a}", matching one of your allergens — the Chinese tags do not list it, which is why it does not show above.',
  '这次三套算出来是一样的 —— 三种策略的差别全在「热量目标」上，没填上限时它们就退化成同一种点法。填个区间再比一次就能看出区别。':
    'All three came out the same this time — the three strategies only differ in their calorie target, so without a limit they collapse into one approach. Set a range and compare again to see the difference.',
  '已确认：{t}': 'Confirmed: {t}',
  确认作废: 'Void this meal',
  '作废后不计入图鉴进度，确定吗？': 'Voided meals do not count toward guide progress. Continue?',
  '已作废2': 'Voided',
  删除这张照片: 'Delete this photo',
  '照片会从服务器上删掉，删了找不回来。': 'The photo is deleted from the server. This cannot be undone.',
  缺少记录编号: 'Missing record id',

  // ── 登录 ──
  '🍣 一贯点餐测评': '🍣 IKKAN Ordering Review',
  '优化预算 · 判断口味 · 以最低成本得到良好体验':
    'Plan your budget, match your taste, get a good meal at the lowest cost',
  登录: 'Sign in',
  注册: 'Sign up',
  用户名: 'Username',
  密码: 'Password',
  '演示账号：demo / demo123 管理员：admin / admin123':
    'Demo: demo / demo123 · Admin: admin / admin123',
  '3-20 位字母/数字/下划线': '3-20 letters, digits or underscore',
  '至少 6 位': 'At least 6 characters',
  选填: 'Optional',
  '请稍候…': 'Please wait…',
  注册并登录: 'Sign up & sign in',
  请填写账号密码: 'Enter your username and password',
  欢迎回来: 'Welcome back',
  操作失败: 'Something went wrong',

  // ── 管理后台 ──
  '＋ 新增': '＋ New',
  编辑: 'Edit',
  '分类 / 标签': 'Categories / tags',
  添加: 'Add',
  勋章门槛: 'Badge threshold',
  菜名: 'Dish name',
  分类: 'Category',
  '价格（元）': 'Price (¥)',
  '热量（kcal）': 'Calories (kcal)',
  状态: 'Status',
  预计上架日期: 'Expected launch date',
  标签: 'Tags',
  取消: 'Cancel',
  登录已过期: 'Session expired — please sign in again',
  '请求失败 {n}': 'Request failed ({n})',
  '连不上后端，请确认服务已启动（{m}）': "Can't reach the server. Make sure it's running ({m})",
  网络异常: 'network error',
  '当前环境不支持读取图片，请用微信小程序调试': 'This environment cannot read images — use the WeChat mini program.',
  读取图片失败: 'Failed to read the image',
  '请输入大于 0 的预算': 'Enter a budget greater than 0',
  没有可用组合: 'No combination fits',
  记录不存在: 'Record not found',
  该记录已确认: 'This record is already confirmed',
  该记录已作废: 'This record is already voided',
  请先添加菜品再确认: 'Add at least one dish before confirming',
  热量下限不能大于上限: 'The calorie minimum cannot exceed the maximum',
  确定: 'OK',
  '切换界面动效': 'Toggle interface animations',
  '切换是否显示系统评级': 'Toggle system rating display',
  新分类名: 'New category name',
  '新标签名（食材/口味）': 'New tag name (ingredient / taste)',
  '勋章名称，如 天妇罗达人': 'Badge name, e.g. Tempura Master',
  次数: 'Count',
  '菜品管理（{n}）': 'Dishes ({n})',
  热量未录入: 'no calories',
  '目标：{t}': 'Target: {t}',
  首尝解锁: 'First taste',
  累计: 'Milestone',
  ' · 需要 {n} 次': ' · needs {n}',
  编辑菜品: 'Edit dish',
  新增菜品: 'New dish',
  选择标签: 'Pick a tag',
  未分类: 'Uncategorised',
  请填写菜名: 'Enter a dish name',
  删除菜品: 'Delete dish',
  '确定删除「{n}」？历史记录中的菜品会保留。':
    'Delete "{n}"? Dishes already in meal records are kept.',
  请输入分类名: 'Enter a category name',
  已添加: 'Added',
  请输入标签名: 'Enter a tag name',
  请输入勋章名称: 'Enter a badge name',
  请选择标签: 'Pick a tag first',
  '累计确认吃过「{t}」标签菜品 {n} 次解锁':
    'Unlocks after {n} confirmed meals containing the "{t}" tag',

  // ── 评级档位（config.js 的 TIER_LABEL / STATUS_LABEL / PREF_LABEL） ──
  很棒: 'Great',
  不错: 'Good',
  一般: 'Fine',
  偏多: 'A bit much',
  偏少: 'A bit little',

  // ── 导航标题 / tabBar ──
  '一贯点餐测评': 'IKKAN Ordering Review',
  一贯菜单: 'IKKAN menu',
  一贯图鉴: 'IKKAN guide',
  '登录 / 注册': 'Sign in / Sign up',
  记录详情: 'Meal details',
  首页: 'Home',

  // 后端返回的中文标签（三套对比 / 健康目标 / 目标说明）
  省钱: 'Save money',
  均衡: 'Balanced',
  吃饱: 'Fill up',
  '够到目标热量就停，花的钱最少': 'Stops once it hits the calorie target — the cheapest option',
  '补到上限的九成，同一道菜不重复': 'Fills to 90% of the limit, no dish repeated',
  '在上限内尽力填满，最多两份': 'Fills as much as the limit allows, up to two of each',
  减重: 'Weight loss',
  控糖: 'Blood sugar',
  轻食: 'Light meal',
  油炸: 'Deep-fried',
  甜味: 'Sweet',
  '按「{b}」标签排除了 {n} 个菜品；这不是营养学判定，是标签推断。':
    'Excluded {n} dishes tagged "{b}"; this is a tag-based inference, not a nutrition judgement.',
};

/**
 * 同形异义补丁：上面几个 `xx2` 是给「同一句中文、英文要不同」的场合留的后门。
 * 直接把 key 写成 `已删除2` 太脏，所以这里做一次别名映射，调用方仍然写中文原句。
 */
const ALIAS = {
  '已删除2': '已删除',
  '已作废2': '已作废',
  '已确认用餐2': '已确认用餐',
};

/** 翻译一条界面文案。英文缺失时原样返回中文，不返回 key 或空串。 */
export function t(zh, vars) {
  const key = ALIAS[zh] || zh;
  if (locale.value === 'zh') return fill(zh, vars);
  const en = DICT[key];
  return fill(en == null ? zh : en, vars);
}

/**
 * 后端拼好的「目标说明」是中文模板串（`按「油炸」标签排除了 12 个菜品；这不是营养学判定，是标签推断。`），
 * 里面带了数字和标签名，不能直接当字典 key。这里先把它拆回模板再翻；
 * 拆不出来就整句丢给 t()，最差情况也只是留着中文，不会报错。
 */
export function tGoalNote(note) {
  if (!note) return '';
  const m = String(note).match(/^按「(.+?)」标签排除了\s*(\d+)\s*个菜品；(.+)$/);
  if (!m) return t(note);
  return t('按「{b}」标签排除了 {n} 个菜品；这不是营养学判定，是标签推断。', { b: t(m[1]), n: m[2] });
}

/** 把 `{name}` 换成 vars.name；缺变量时保留原样，方便一眼看出漏传。 */
function fill(s, vars) {
  if (!vars) return s;
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
}

export function syncLocale() {
  try {
    const v = uni.getStorageSync(STORE_KEY);
    locale.value = v === 'en' ? 'en' : 'zh';
  } catch {
    locale.value = 'zh';
  }
  try {
    uni.setLocale(locale.value === 'en' ? 'en' : 'zh-Hans');
  } catch {
    /* 非 H5 端可能没有这个 API */
  }
}

/** 改语言。只写 storage + 触发响应式重渲染，不发请求。 */
export function setLocale(key) {
  const k = key === 'en' ? 'en' : 'zh';
  locale.value = k;
  try {
    uni.setStorageSync(STORE_KEY, k);
  } catch {
    /* storage 不可用时只在本次会话生效 */
  }
  // uni 自己的内置文案（showActionSheet / showModal 的取消、确定按钮）走的是
  // uni-h5 的 i18n 表，不受本文件控制，只能靠 setLocale 切过去。
  try {
    uni.setLocale(k === 'en' ? 'en' : 'zh-Hans');
  } catch {
    /* 非 H5 端可能没有这个 API */
  }
  applyChrome(lastTitle);
}

export function toggleLocale() {
  setLocale(locale.value === 'zh' ? 'en' : 'zh');
}

/**
 * 每个页面在 setup 顶层调一次，做两件事：
 *   1. 从 storage 同步语言（用户可能在别的页面改过）；
 *   2. 切回这个页面时重新刷导航栏标题 + tabBar —— 小程序切 tab 会把标题重置成 pages.json 里的中文。
 * 用 onShow 而不是 onLoad：onLoad 只跑一次，改了语言再切回来标题还是旧的。
 */
export function useLocale(title) {
  syncLocale();
  applyChrome(title);
  onShow(() => {
    syncLocale();
    applyChrome(title);
  });
}

const TAB_ZH = ['首页', '菜单', '世界', '图鉴', '我的'];
const TAB_EN = ['Home', 'Menu', 'World', 'Guide', 'Me'];

/**
 * tabBar 文字。
 * uni.setTabBarItem 在非 tab 页（record / history / admin / mealDetail / login）
 * 上会静默失效，所以 H5 下额外直接改 DOM 文本，
 * 否则从我的页切到记录页后 tab 会跳回中文。
 */
function syncTabBar() {
  const zh = locale.value === 'zh';
  TAB_ZH.forEach((label, i) => {
    try {
      uni.setTabBarItem({ index: i, text: zh ? label : TAB_EN[i] }, () => {});
    } catch {
      /* 非 tab 页下不支持 */
    }
  });
  // #ifdef H5
  try {
    const nodes = document.querySelectorAll('.uni-tabbar__label');
    nodes.forEach((el, i) => {
      if (i < TAB_EN.length) el.textContent = zh ? TAB_ZH[i] : TAB_EN[i];
    });
  } catch {
    /* 无 DOM 环境 */
  }
  // #endif
}

/** 导航栏标题 + tabBar 文字。页面 onShow 里也调一次，因为切页会重置标题。 */
let lastTitle = '';

export function applyChrome(title) {
  if (title) lastTitle = title;
  try {
    if (title) uni.setNavigationBarTitle({ title: t(title) });
    else if (lastTitle) uni.setNavigationBarTitle({ title: t(lastTitle) });
  } catch {
    /* 非 tab 页或基础库不支持时忽略 */
  }
  syncTabBar();
}
