// 过敏原与偏好共用的字典/工具。
//
// 库里有两套互不相通的词表，别混：
//   ① dish_nutrition.allergen_list —— 日本「特定原材料 28 品目」原文，
//      全是日文 token（大豆 / 小麦 / えび / 卵 / さけ …），接口里叫 d.allergens。
//   ② tags 表 —— 中文食物标签（三文鱼 / 虾 / 鸡蛋 / 乳制品 / 油炸 / 生食 …），
//      贴在 d.tags 上；用户偏好（喜欢/不喜欢/忌口/过敏）挂的也是这一套。

// 日文 token → 中文。原来硬编码在 pages/menu/menu.vue 里，多一个页面要显示就得再抄一份，
// 所以抽到这里；菜单页与点单卡共用同一份。
export const ALLERGEN_ZH = {
  卵: '蛋', 乳: '乳制品', 小麦: '小麦', えび: '虾', かに: '蟹', そば: '荞麦',
  落花生: '花生', くるみ: '核桃', アーモンド: '杏仁', あわび: '鲍鱼', いか: '乌贼',
  いくら: '鲑鱼卵', オレンジ: '橙', カシューナッツ: '腰果', キウイフルーツ: '奇异果',
  牛肉: '牛肉', ごま: '芝麻', さけ: '鲑鱼', さば: '鲭鱼', 大豆: '大豆',
  鶏肉: '鸡肉', バナナ: '香蕉', 豚肉: '猪肉', もも: '桃', やまいも: '山药',
  りんご: '苹果', ゼラチン: '明胶', マカダミアナッツ: '夏威夷果',
}

export function allergenLabel(token) {
  return ALLERGEN_ZH[token] || token
}

// 用户偏好里「需要回避」的两类。dislike 只是口味不喜欢，不算风险，不在这里。
export const AVOID_TYPES = ['avoid', 'allergy']

export const PREF_RISK_LABEL = { allergy: '过敏', avoid: '忌口' }

/**
 * 把 /api/user/preferences 返回的 { tags: [{ id, name, preference }] }
 * 压成一张「需要回避的 tagId → 类型」表。
 */
export function avoidMapFrom(prefTags) {
  const map = new Map()
  for (const t of prefTags || []) {
    if (AVOID_TYPES.indexOf(t.preference) >= 0) map.set(t.id, t.preference)
  }
  return map
}

/**
 * 一道菜命中了哪些需要回避的标签。
 * dish.tags = [{ id, name, type }]；avoidMap = Map(tagId → 'avoid'|'allergy')
 * 返回 [{ id, name, kind }]，kind 为 'allergy' 或 'avoid'。
 * 过敏排在忌口前面（严重程度不同）。
 */
export function dishHits(dish, avoidMap) {
  if (!dish || !avoidMap || !avoidMap.size) return []
  const out = []
  for (const t of dish.tags || []) {
    const kind = avoidMap.get(t.id)
    if (kind) out.push({ id: t.id, name: t.name, kind })
  }
  out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'allergy' ? -1 : 1))
  return out
}

/**
 * 把一组菜品的日文过敏原 token 并起来，给出「这一单可能含有」的中文清单。
 * 返回 [{ token, label, count }]，按出现次数降序、同次数按中文名排序。
 */
export function mergeAllergens(dishes) {
  const bag = new Map()
  for (const d of dishes || []) {
    for (const t of (d && d.allergens) || []) {
      bag.set(t, (bag.get(t) || 0) + 1)
    }
  }
  return [...bag.entries()]
    .map(([token, count]) => ({ token, label: allergenLabel(token), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'))
}
