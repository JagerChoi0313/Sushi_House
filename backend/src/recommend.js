import { round } from './util.js';

// 同一道菜最多出现在一份计划里的份数。
// 不设这个上限时，凑预算的最后一步会把便宜菜反复叠份 —— 实测出现过
// 「4× 乌龙茶 + 5× 抹茶」这种把 ¥64 花在饮料上的组合。
const MAX_QTY = 2;

/**
 * 餐前推荐：根据预算 + 可选热量区间 + 用户偏好，生成菜品组合并落库。
 * 返回 { planId, budget, calorieLimit, calorieMin, calorieFill, estimatedPrice,
 *        estimatedCalories, remaining, items } 或 { error }。
 *
 * calorieLimit = 上限（硬约束，不许超过）
 * calorieMin   = 下限（目标，尽量够到）；不传时默认取上限的 80%
 *
 * 为什么要下限：生成器过去只有「天花板」没有「目标」——所有推进条件都是价格
 * （见下面 totalPrice >= b * 0.95 那两处），于是预算一用完就停，热量落在哪全看运气。
 * 实测预算 80 时，上限填 400 / 800 / 1200，拿到的都是 325 kcal（81% → 27%）。
 * 详见 docs/_需求清单_2026-11-13.md 第 2 条。
 */
export function generatePlan(db, userId, { budget, calorieLimit, calorieMin, strategy, dryRun, kidMode, goal }) {
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return { error: '请输入大于 0 的预算' };

  // 三套方案的差别只在这几行，其余流程完全共用：
  //   value（省钱）  —— 够到目标热量就停，不补、不换。花的钱最少。
  //   balanced（均衡）—— 补到上限的 90%，且同一道菜不重复（每人一份，更像是「一套正常点单」）。
  //   full（吃饱）   —— 一直补到贴住上限，同一道菜最多 2 份。默认。
  const STRATEGIES = ['value', 'balanced', 'full'];
  const strat = STRATEGIES.includes(strategy) ? strategy : 'full';
  const dry = dryRun === true; // 只看方案、不落库（三套对比用）

  // 「均衡」不重复点同一道菜；「吃饱」用满上限、同一道菜最多 2 份。
  // 儿童模式也是每样只来 1 份（孩子吃不完两份同样的），所以并到 1。
  const kid = kidMode === true;
  const maxQty = strat === 'balanced' || kid ? 1 : MAX_QTY;

  let calLimit = calorieLimit == null || calorieLimit === '' ? null : Number(calorieLimit);
  if (calLimit != null && (!Number.isFinite(calLimit) || calLimit <= 0)) calLimit = null;

  // 热量下限：夹在 (0, 上限] 之内；上限没给就不谈下限
  let calMin = calorieMin == null || calorieMin === '' ? null : Number(calorieMin);
  if (calMin != null && (!Number.isFinite(calMin) || calMin <= 0)) calMin = null;

  // 健康目标（问卷第 3 题第 21 条：按减重 / 控糖 / 轻食分组的套餐）。
  // 库里没有营养指标 —— 没有糖分、没有蛋白质、没有钠，只有 18 个标签和 calories。
  // 所以这三档只做两件事，而且两件都在界面上写明是「推断」：
  //   ① 一个默认热量区间：只在用户没填上限时套用；填了就以用户的数为准，不擅自改
  //   ② 一个排除集：减重 / 轻食排油炸（tag 7），控糖排甜味（tag 15）
  // 「控糖」是按甜味推的，不是真实含糖量 —— 咸味菜里的隐形糖、标了「无糖」的甜点都判不出来。
  // 也不给「减重」排碳水、给「控糖」排油炸：前者库里分不出主食，后者是脂肪不是糖，硬排等于编。
  const GOAL_RULES = {
    weight_loss: { label: '减重', min: 500, max: 700, blockTags: [7], blocked: '油炸' },
    blood_sugar: { label: '控糖', min: 400, max: 600, blockTags: [15], blocked: '甜味' },
    light: { label: '轻食', min: 300, max: 500, blockTags: [7], blocked: '油炸' },
  };
  const goalKey = goal && Object.prototype.hasOwnProperty.call(GOAL_RULES, goal) ? goal : null;
  const goalRule = goalKey ? GOAL_RULES[goalKey] : null;
  let goalRangeApplied = false;
  if (goalRule && calLimit == null) {
    calLimit = goalRule.max;
    if (calMin == null) calMin = goalRule.min;
    goalRangeApplied = true;
  }

  let calTarget = null;
  if (calLimit != null) {
    calTarget = calMin == null
      ? Math.round(calLimit * 0.8)
      : Math.min(Math.round(calMin), Math.round(calLimit));
  }

  // 补足的目标线：均衡只用到上限的 90%（留一点余地，也更像一份正常点单），吃饱用满。
  const fillTo = calLimit == null ? null : (strat === 'balanced' ? Math.round(calLimit * 0.9) : calLimit);

  const prefRows = db.prepare('SELECT tag_id, type FROM user_preferences WHERE user_id=?').all(userId);
  const prefType = new Map(prefRows.map((r) => [r.tag_id, r.type]));
  const snapshot = prefRows.map((r) => ({ tagId: r.tag_id, type: r.type }));

  const dishes = db.prepare("SELECT * FROM dishes WHERE status='on_sale' ORDER BY id ASC").all();
  const tagRows = db.prepare('SELECT dish_id, tag_id FROM dish_tags').all();
  const tagsByDish = new Map();
  for (const r of tagRows) {
    if (!tagsByDish.has(r.dish_id)) tagsByDish.set(r.dish_id, []);
    tagsByDish.get(r.dish_id).push(r.tag_id);
  }

  // 1. 过滤忌口/过敏；热量上限时只保留已录入热量的菜
  // 同时按菜名去重：库里在售 269 道有 78 组同名重复（156 道，只有 category_id 不同，
  // 名字/价格/热量全一样）。不去重的话同一道菜会被选两次、菜单也会看起来重复。
  // dishes 已按 id ASC 排序，所以「先到先留」= 保留 id 最小的那一份。
  // 注意：去重标记放在过滤之后，这样先出现的那份若被忌口筛掉，同名的另一份仍可进入。
  // 儿童模式（第 7 条）能用的信号只有标签：没有「辣度」也没有「份量」字段，
  // 所以只做保守的两件事 —— 排掉生食与苦味，并对甜味加分。
  // 生食（tag 8）对小孩是实打实的风险点；苦味（tag 18）是多数小孩不会碰的味道。
  // 不排「油炸」：库里油炸项是小食和天妇罗，全排掉反而凑不出餐。
  const KID_BLOCK = [8, 18]; // 8 = 生食, 18 = 苦
  const KID_BONUS = [15]; // 15 = 甜

  const candidates = [];
  const seenName = new Set();
  // 记一笔「因为这个目标被排掉了多少道」，好让接口和界面能说清代价，而不是悄悄少给
  let goalBlockedCount = 0;
  for (const d of dishes) {
    const tags = tagsByDish.get(d.id) || [];
    if (tags.some((t) => prefType.get(t) === 'avoid' || prefType.get(t) === 'allergy')) continue;
    if (kid && tags.some((t) => KID_BLOCK.includes(t))) continue;
    if (goalRule && tags.some((t) => goalRule.blockTags.includes(t))) {
      goalBlockedCount++;
      continue;
    }
    if (calLimit != null) {
      if (d.calories == null || d.calories > calLimit) continue;
    }
    if (seenName.has(d.name)) continue;
    seenName.add(d.name);
    let likeHit = 0;
    let dislikeHit = 0;
    for (const t of tags) {
      const p = prefType.get(t);
      if (p === 'like') likeHit++;
      else if (p === 'dislike') dislikeHit++;
      if (kid && KID_BONUS.includes(t)) likeHit++; // 甜味在儿童模式下当成「会喜欢」
    }
    candidates.push({ dish: d, tags, likeHit, dislikeHit, score: likeHit * 2 - dislikeHit });
  }

  // 2. 按偏好分排序，同分便宜的优先
  candidates.sort((a, b2) => b2.score - a.score || a.dish.price - b2.dish.price);

  // 「每块钱能买到多少热量」——下面 3b / 3c 都用它衡量划算程度
  const densityOf = (d) => (d.price > 0 ? (d.calories || 0) / d.price : 0);

  const items = [];
  let totalPrice = 0;
  let totalCal = 0;

  // 「省钱」不是「偏好优先」，而是「用最少的钱够到目标热量」——
  // 所以这一档改成按每块钱热量从高到低拿，够到 calTarget 就停手。
  // 偏好优先那套会把预算全花在喜欢的贵菜上（实测预算 80 花光 80 只拿到 325 kcal）。
  // 注意：不给热量上限时不换序 —— 「省钱」此时只表示「不做后续补足」。
  // 否则会变成「按热量密度优先」，实测预算 60 能拼出 3060 kcal 的一桌（荒谬）。
  const greedyOrder =
    strat === 'value' && calLimit != null
      ? candidates.slice().sort((x, y) => densityOf(y.dish) - densityOf(x.dish) || x.dish.price - y.dish.price)
      : candidates;

  // 3. 每种菜先各来 1 份（贪心）
  for (const c of greedyOrder) {
    // 「省钱」：够到目标热量就停手，后面的补足/换菜/叠份全都不做 —— 花的钱最少。
    if (strat === 'value' && calLimit != null && totalCal >= calTarget) break;
    if (totalPrice + c.dish.price > b) continue;
    if (calLimit != null && totalCal + (c.dish.calories || 0) > calLimit) continue;
    items.push({ dish: c.dish, quantity: 1 });
    totalPrice += c.dish.price;
    totalCal += c.dish.calories || 0;
  }

  // 3b. ★ 热量补足 —— 把热量当「目标」，不够就加、预算不够就换
  // 前面那步唯一的推进条件只有价格，热量只是「别超上限」；所以预算一用完计划就停，
  // 热量落在哪全看运气（预算 80 / 上限 800 实测只拿到 325 kcal = 41%）。
  // 这里一直补到「贴住上限」为止（上限内尽力吃饱，同样预算不该只拿到三成）；
  // calTarget（下限）只用来判断「有没有进到用户要的区间」，不作收手条件 ——
  // 否则填 300–500 会在 305 就停，白留一半额度。
  // 具体做两件事：
  //   ① 预算还有剩 → 加「每块钱热量」最高的那份；
  //   ② 预算不够了 → 把篮子里密度最低的一份换掉，腾出钱给密度更高的（严格递增，必然终止）。
  // 上限永远是硬约束；不喜欢的菜排最后，实在没别的才用。上限没给就不做这一步。
  if (strat !== 'value' && calLimit != null && totalCal < fillTo) {
    let guard = 0;
    while (totalCal < fillTo && guard++ < 80) {
      const room = b - totalPrice;

      // ① 预算够：加密度最高的（同一道菜最多 MAX_QTY 份）
      let add = null;
      for (const c of candidates) {
        const p = c.dish.price;
        const cal = c.dish.calories || 0;
        if (p <= 0 || cal <= 0) continue; // 茶/水这类 0 热量，补不了热量
        if (p > room) continue; // 预算不能超
        if (calLimit != null && totalCal + cal > calLimit) continue; // 上限仍是硬约束
        const have = items.find((it) => it.dish.id === c.dish.id);
        if (have && have.quantity >= maxQty) continue;
        const disliked = c.dislikeHit > 0 ? 1 : 0;
        if (!add || disliked < add.disliked || (disliked === add.disliked && cal / p > add.density)) {
          add = { c, density: cal / p, disliked };
        }
      }
      if (add) {
        const exist = items.find((it) => it.dish.id === add.c.dish.id);
        if (exist) exist.quantity += 1;
        else items.push({ dish: add.c.dish, quantity: 1 });
        totalPrice += add.c.dish.price;
        totalCal += add.c.dish.calories || 0;
        continue;
      }

      // ② 预算不够：换掉密度最低的一份
      let victim = null;
      for (const it of items) {
        if (it.dish.price <= 0) continue;
        if (!victim || densityOf(it.dish) < densityOf(victim.dish)) victim = it;
      }
      if (!victim) break;

      let better = null;
      for (const c of candidates) {
        const p = c.dish.price;
        const cal = c.dish.calories || 0;
        if (p <= 0 || cal <= 0 || c.dish.id === victim.dish.id) continue;
        if (p > room + victim.dish.price) continue;
        if (calLimit != null && totalCal - (victim.dish.calories || 0) + cal > calLimit) continue;
        if (cal / p <= densityOf(victim.dish)) continue; // 换了不更划算就别换
        // 换进来的那份也要守 MAX_QTY（否则 3b 和步骤 4 各加一份，同一道菜能叠到 3 份）
        const has = items.find((it) => it.dish.id === c.dish.id);
        if (has && has.quantity >= maxQty) continue;
        if (!better || cal / p > better.density) better = { c, density: cal / p };
      }
      if (!better) break;

      totalPrice -= victim.dish.price;
      totalCal -= victim.dish.calories || 0;
      victim.quantity -= 1;
      if (victim.quantity <= 0) items.splice(items.indexOf(victim), 1);

      const exist = items.find((it) => it.dish.id === better.c.dish.id);
      if (exist) exist.quantity += 1;
      else items.push({ dish: better.c.dish, quantity: 1 });
      totalPrice += better.c.dish.price;
      totalCal += better.c.dish.calories || 0;
    }
  }

  // 3c. 还是离上限太远（不到 80%）→ 换一套「每块钱热量优先」的篮子再比一次
  // 3b 的换菜是「一对一」的：预算已经花光时只能拿一份去换价格相近的一份，
  // 于是买不起「贵一点但热量高得多」的菜 —— 实测预算 40 / 上限 1500 只到 55%
  // （篮子里全是 7 kcal/元 的蒸蛋和味噌汤，换不动 ¥18 的天婦羅拼盤）。
  // 这里干脆按热量密度重排整篮，两套谁热量高用谁。只在「填不到目标的 80%」时触发，
  // 所以偏好优先的那套只要够得着目标就不会被换掉。
  if (strat !== 'value' && calLimit != null && totalCal < calLimit * 0.8) {
    const buildByDensity = (allowDisliked) => {
      const pool = candidates
        .filter((c) => allowDisliked || c.dislikeHit === 0)
        .filter((c) => c.dish.price > 0 && (c.dish.calories || 0) > 0)
        .slice()
        .sort((x, y) => densityOf(y.dish) - densityOf(x.dish) || x.dish.price - y.dish.price);
      const basket = [];
      let price = 0;
      let cal = 0;
      for (const c of pool) {
        const p = c.dish.price;
        const k = c.dish.calories || 0;
        if (price + p > b) continue;
        if (cal + k > fillTo) continue;
        basket.push({ dish: c.dish, quantity: 1 });
        price += p;
        cal += k;
      }
      for (let r = 0; r < 3; r++) {
        let added = false;
        for (const it of basket) {
          if (price >= b * 0.95) break;
          const p = it.dish.price;
          const k = it.dish.calories || 0;
          if (it.quantity >= maxQty) continue;
          if (price + p > b) continue;
          if (cal + k > fillTo) continue;
          it.quantity += 1;
          price += p;
          cal += k;
          added = true;
        }
        if (!added || price >= b * 0.95) break;
      }
      return { basket, price, cal };
    };

    let alt = buildByDensity(false); // 先只用不讨厌的菜
    if (alt.cal < calLimit * 0.8) {
      const loose = buildByDensity(true); // 还不够就放开忌口偏好（过敏/忌口早就在候选集里滤掉了）
      if (loose.cal > alt.cal) alt = loose;
    }
    if (alt.cal > totalCal) {
      items.length = 0;
      for (const it of alt.basket) items.push(it);
      totalPrice = alt.price;
      totalCal = alt.cal;
    }
  }

  if (items.length === 0) {
    const cheapest = candidates
      .filter((c) => c.dish.price <= b && (calLimit == null || (c.dish.calories || 0) <= calLimit))
      .sort((a, b2) => a.dish.price - b2.dish.price)[0];
    if (!cheapest) {
      return {
        error:
          calLimit != null
            ? '当前预算和热量上限下没有可行组合，请调高预算或热量上限'
            : '当前预算过低，没有可选菜品',
      };
    }
    items.push({ dish: cheapest.dish, quantity: 1 });
    totalPrice = cheapest.dish.price;
    totalCal = cheapest.dish.calories || 0;
  } else if (strat !== 'value') {
    // 4. 补充份数：在预算和热量上限内尽量多给，最多补 3 轮
    // 注意：这里不按「目标」提前收手 —— 3b 保证了下限，这一段负责在上限内继续往上靠。
    // 两个上限：同一道菜最多 MAX_QTY 份（否则会把预算全塞成 5 杯抹茶），
    // 且不叠 0 热量的饮料（凑预算对「吃饱」没有贡献）。
    for (let r = 0; r < 3; r++) {
      let added = false;
      for (const it of items) {
        if (totalPrice >= b * 0.95) break;
        const p = it.dish.price;
        const c = it.dish.calories || 0;
        if (p <= 0) continue;
        if (c <= 0) continue;
        if (it.quantity >= maxQty) continue;
        if (totalPrice + p > b) continue;
        if (fillTo != null && totalCal + c > fillTo) continue;
        it.quantity += 1;
        totalPrice += p;
        totalCal += c;
        added = true;
      }
      if (!added || totalPrice >= b * 0.95) break;
    }
  }

  if (items.length === 0) return { error: '没有可用组合' };

  // 5. 落库（含快照）
  // dryRun（三套对比）时整段跳过 —— 比对方案不应该在库里留下三行计划。
  let planId = null;
  if (!dry) {
    const r = db.prepare(
      `INSERT INTO meal_plans
         (user_id, budget, calorie_limit, preferences_snapshot, estimated_price, estimated_calories)
       VALUES (?,?,?,?,?,?)`
    ).run(
      userId,
      round(b, 1),
      calLimit == null ? null : round(calLimit, 0),
      JSON.stringify(snapshot),
      round(totalPrice, 1),
      round(totalCal, 0)
    );
    planId = Number(r.lastInsertRowid);

    const insItem = db.prepare(
      `INSERT INTO meal_plan_items
         (meal_plan_id, dish_id, dish_name, quantity, unit_price, unit_calories)
       VALUES (?,?,?,?,?,?)`
    );
    for (const it of items) {
      insItem.run(planId, it.dish.id, it.dish.name, it.quantity, it.dish.price, it.dish.calories);
    }
  }

  return {
    planId,
    strategy: strat,
    kidMode: kid,
    goal: goalKey,
    goalLabel: goalRule ? goalRule.label : null,
    // 目标只是「推断」：按哪个标签排的、因为这条规则被排掉了几道、热量区间是不是目标套上去的
    goalNote: goalRule
      ? `按「${goalRule.blocked}」标签排除了 ${goalBlockedCount} 道菜；这不是营养学判定，是标签推断。`
      : null,
    goalRangeApplied,
    budget: round(b, 1),
    calorieLimit: calLimit == null ? null : round(calLimit, 0),
    // 目标是「至少够到多少」；calorieFill 是相对上限的达成率，前端直接展示
    calorieMin: calTarget,
    calorieFill: calLimit == null ? null : Math.round((totalCal / calLimit) * 100),
    estimatedPrice: round(totalPrice, 1),
    estimatedCalories: round(totalCal, 0),
    remaining: round(b - totalPrice, 1),
    items: items.map((it) => ({
      dishId: it.dish.id,
      name: it.dish.name,
      image: it.dish.image,
      quantity: it.quantity,
      unitPrice: it.dish.price,
      unitCalories: it.dish.calories,
    })),
  };
}
