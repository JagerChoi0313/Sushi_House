/**
 * 过敏原 token → 中文名。
 *
 * 背景：`dish_nutrition.allergen_list` 存的是**日本 28 品目的原样 token**
 * （`大豆`、`えび`、`さけ`…），`GET /api/allergens` 原来直接把 token 当名字返回，
 * 于是每个要显示过敏原的前端都得自己抄一份翻译表。
 * 这里把翻译表收到后端一处，接口一并返回 `label`，前端优先用 `label`。
 *
 * 表里是 28 品目的全集（现行库里只出现 14 个），未出现的也留着，
 * 免得将来数据变多又要在前端补。
 */
export const ALLERGEN_ZH = {
  卵: '蛋',
  乳: '乳制品',
  小麦: '小麦',
  えび: '虾',
  かに: '蟹',
  そば: '荞麦',
  落花生: '花生',
  くるみ: '核桃',
  アーモンド: '杏仁',
  あわび: '鲍鱼',
  いか: '乌贼',
  いくら: '鲑鱼卵',
  オレンジ: '橙',
  カシューナッツ: '腰果',
  キウイフルーツ: '奇异果',
  牛肉: '牛肉',
  ごま: '芝麻',
  さけ: '鲑鱼',
  さば: '鲭鱼',
  大豆: '大豆',
  鶏肉: '鸡肉',
  バナナ: '香蕉',
  豚肉: '猪肉',
  もも: '桃',
  やまいも: '山药',
  りんご: '苹果',
  ゼラチン: '明胶',
  マカダミアナッツ: '夏威夷果',
};

/** 查不到就原样返回 token（宁可显示日文，也不要显示空白） */
export function allergenLabel(token) {
  return ALLERGEN_ZH[token] || token;
}

/**
 * 中文名 → 日文 token 的反查表。
 *
 * 为什么需要反向：`user_preferences` 挂的是 `tags` 表里的**中文**食物标签
 * （三文鱼 / 乳制品 / 小麦 …），而 `dish_nutrition.allergen_list` 存的是
 * **日文** 28 品目 token（さけ / 乳 / 小麦 …）。两套词表不通，所以光是拿中文
 * 标签去过滤 `dish_tags` 是查不出「日文标注了含乳、但中文标签没写乳制品」的菜的
 * —— 审计里的 A1/A2 就是这个原因造成的。
 *
 * 一个中文名可能对应多个 token：乳 → 乳；小麦 → 小麦；大豆 → 大豆。
 * 目前 ALLERGEN_ZH 是一对一，但同名 token 出现在两处时（如「小麦」既是中文标签
 * 也是日文 token）反查也要能同时命中，所以值统一收成数组。
 */
export const LABEL_TO_TOKENS = (() => {
  const out = Object.create(null);
  for (const [token, label] of Object.entries(ALLERGEN_ZH)) {
    if (!out[label]) out[label] = [];
    out[label].push(token);
  }
  // 中文标签里也有直接就是日文 token 写法的（大豆/小麦/牛肉 中日同形），
  // 上面那轮已经覆盖；这里再补「不在 28 品目表里但确实是过敏原」的常见别名。
  const alias = {
    蛋: ['卵'],
    鸡蛋: ['卵'],
    奶: ['乳'],
    牛奶: ['乳'],
    乳制品: ['乳'],
    虾: ['えび'],
    蟹: ['かに'],
    蟹肉: ['かに'],
    鱼: ['さけ', 'さば'],
    鲑鱼: ['さけ'],
    三文鱼: ['さけ'], // 中文标签「三文鱼」是 tag 1，不是过敏原，但用户可能挂成过敏
    鲭鱼: ['さば'],
    鲑鱼卵: ['いくら'],
    乌贼: ['いか'],
    鱿鱼: ['いか'],
    鸡肉: ['鶏肉'],
    猪肉: ['豚肉'],
    牛肉: ['牛肉'],
    芝麻: ['ごま'],
    花生: ['落花生'],
    核桃: ['くるみ'],
    腰果: ['カシューナッツ'],
    杏仁: ['アーモンド'],
    夏威夷果: ['マカダミアナッツ'],
    荞麦: ['そば'],
    明胶: ['ゼラチン'],
    苹果: ['りんご'],
    香蕉: ['バナナ'],
    桃: ['もも'],
    橙: ['オレンジ'],
    奇异果: ['キウイフルーツ'],
    山药: ['やまいも'],
    鲍鱼: ['あわび'],
  };
  for (const [label, tokens] of Object.entries(alias)) {
    const cur = out[label] || [];
    for (const t of tokens) if (!cur.includes(t)) cur.push(t);
    out[label] = cur;
  }
  return out;
})();

/**
 * 把一组中文过敏标签名展开成日文 token 集合。
 * 认不出的一律忽略 —— 宁可漏掉一个不认识的别名，也不要把无关的菜全排掉。
 */
export function tokensForLabels(labels) {
  const out = new Set();
  for (const l of labels || []) {
    const hit = LABEL_TO_TOKENS[l];
    if (hit) for (const t of hit) out.add(t);
  }
  return out;
}
