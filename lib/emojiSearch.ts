/**
 * Curated emoji pool and its Chinese keyword search.
 *
 * emoji-picker-react's built-in search only matches English emoji names and
 * exposes no way to add aliases to its bundled Unicode dataset — so Chinese
 * search is only practical against our own curated list, not the full
 * ~3600-emoji picker. The pool and its keywords live in this one module so
 * they can't drift apart unnoticed; emojiSearch.test.ts asserts full 1:1
 * coverage between them.
 */

// Curated selection of fun and expressive emojis for face replacement.
// Intentional duplicates weight the random button toward common expressions.
export const POPULAR_EMOJIS = [
  // 🎭 经典笑脸 - Classic Smiles
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',

  // 😘 调情可爱 - Flirty & Cute
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',

  // 🤪 搞怪卖萌 - Goofy & Playful
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤑',

  // 🤔 思考疑惑 - Thinking & Curious
  '🤔', '🤨', '😐', '😑', '😶', '😏', '🙄', '😬', '🤓', '🧐',

  // 😴 疲惫无奈 - Tired & Reluctant
  '😴', '😪', '🤤', '😔', '😌', '🥱', '😕', '😟', '🙁', '☹️',

  // 🤯 夸张震惊 - Dramatic & Shocked
  '🤯', '😵', '🥴', '😮', '😯', '😲', '😳', '🥺', '😱', '🤠',

  // 😎 酷炫自信 - Cool & Confident
  '😎', '🥳', '🥸', '🤠', '😏', '🤑', '🤩', '🤪', '😜', '😉',

  // 😢 悲伤难过 - Sad & Emotional
  '🥺', '😢', '😭', '😥', '😦', '😧', '😨', '😰', '😓', '😩',

  // 😡 生气愤怒 - Angry & Furious
  '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',

  // 👻 恐怖惊悚 - Spooky & Scary
  '👻', '👹', '👺', '💀', '☠️', '🤡', '👽', '👾', '🎃', '🤖',

  // 🐱 可爱动物 - Cute Animals
  '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐶',
  '🐕', '🐩', '🦁', '🐯', '🐺', '🦄', '🐷', '🐗', '🐨', '🐼',

  // 🤒 生病不适 - Sick & Unwell
  '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🤥', '😵'
];

// Deduped version used for the search grid
export const CURATED_EMOJI_POOL = [...new Set(POPULAR_EMOJIS)];

export const EMOJI_KEYWORDS_ZH: Record<string, string[]> = {
  // 经典笑脸 - Classic Smiles
  '😀': ['笑', '开心', '微笑', '高兴'],
  '😃': ['笑', '开心', '大笑'],
  '😄': ['笑', '开心', '眯眼笑'],
  '😁': ['露齿笑', '开心', '笑'],
  '😆': ['大笑', '眯眼', '哈哈'],
  '😅': ['尴尬笑', '苦笑', '冷汗', '尴尬'],
  '🤣': ['笑哭', '爆笑', '太好笑了', '捧腹大笑'],
  '😂': ['笑哭', '哭笑', '泪目'],
  '🙂': ['微笑', '淡定', '礼貌笑'],
  '🙃': ['倒脸', '无奈', '讽刺', '皮'],

  // 调情可爱 - Flirty & Cute
  '😉': ['眨眼', '调皮', '卖萌'],
  '😊': ['害羞笑', '开心', '温柔笑'],
  '😇': ['天使', '无辜', '装乖'],
  '🥰': ['喜欢', '爱心', '宠溺', '心动'],
  '😍': ['花痴', '爱心眼', '喜欢', '心动'],
  '🤩': ['星星眼', '崇拜', '惊艳'],
  '😘': ['飞吻', '亲亲', '么么哒'],
  '😗': ['亲亲', '嘟嘴'],
  '😚': ['亲亲', '害羞亲'],
  '😙': ['亲亲', '微笑亲'],

  // 搞怪卖萌 - Goofy & Playful
  '🥲': ['破涕为笑', '感动哭', '又哭又笑'],
  '😋': ['好吃', '馋', '舔嘴', '美味'],
  '😛': ['吐舌头', '调皮', '卖萌'],
  '😜': ['吐舌卖萌', '调皮', '眨眼吐舌'],
  '🤪': ['疯狂', '无厘头', '搞怪'],
  '😝': ['吐舌头', '逗比'],
  '🤗': ['抱抱', '拥抱', '求抱抱'],
  '🤭': ['捂嘴笑', '偷笑', '惊讶'],
  '🤫': ['嘘', '保密', '安静'],
  '🤑': ['数钱', '发财', '有钱', '财迷'],

  // 思考疑惑 - Thinking & Curious
  '🤔': ['思考', '想一想', '疑惑'],
  '🤨': ['怀疑', '质疑', '挑眉'],
  '😐': ['面无表情', '无语', '平静'],
  '😑': ['无语', '冷漠', '面瘫'],
  '😶': ['无语', '沉默', '无话可说'],
  '😏': ['得意', '坏笑', '暗爽'],
  '🙄': ['翻白眼', '无语', '嫌弃'],
  '😬': ['尴尬', '龇牙', '咬牙'],
  '🤓': ['书呆子', '学霸', '眼镜'],
  '🧐': ['单片眼镜', '审视', '疑惑'],

  // 疲惫无奈 - Tired & Reluctant
  '😴': ['睡觉', '困', '呼呼大睡'],
  '😪': ['困', '犯困', '想睡觉'],
  '🤤': ['流口水', '馋', '想睡'],
  '😔': ['失落', '难过', '沮丧'],
  '😌': ['安心', '释然', '满足'],
  '🥱': ['打哈欠', '困', '无聊'],
  '😕': ['困惑', '迷惑', '不解'],
  '😟': ['担心', '忧虑', '焦虑'],
  '🙁': ['不开心', '难过', '皱眉'],
  '☹️': ['难过', '郁闷', '苦脸'],

  // 夸张震惊 - Dramatic & Shocked
  '🤯': ['炸裂', '震惊', '脑子炸了'],
  '😵': ['晕', '头晕', '崩溃'],
  '🥴': ['晕乎乎', '醉了', '眩晕'],
  '😮': ['惊讶', '哦', '吃惊'],
  '😯': ['惊呆', '无语', '惊讶'],
  '😲': ['震惊', '目瞪口呆'],
  '😳': ['脸红', '尴尬', '害羞'],
  '🥺': ['委屈', '求求你', '可怜巴巴'],
  '😱': ['尖叫', '吓死了', '惊恐'],
  '🤠': ['牛仔', '潇洒', '帅气'],

  // 酷炫自信 - Cool & Confident
  '😎': ['酷', '墨镜', '帅'],
  '🥳': ['庆祝', '派对', '生日快乐'],
  '🥸': ['伪装', '变装', '假胡子'],

  // 悲伤难过 - Sad & Emotional
  '😢': ['哭', '伤心', '流泪'],
  '😭': ['大哭', '泪崩', '嚎啕大哭'],
  '😥': ['难过', '松了口气', '委屈'],
  '😦': ['惊讶', '难过'],
  '😧': ['痛苦', '崩溃'],
  '😨': ['害怕', '恐惧'],
  '😰': ['焦虑', '紧张', '冷汗'],
  '😓': ['汗颜', '尴尬', '无奈'],
  '😩': ['疲惫', '累', '崩溃'],

  // 生气愤怒 - Angry & Furious
  '😤': ['生气', '不服', '加油'],
  '😡': ['生气', '愤怒', '恼火'],
  '😠': ['生气', '愤怒'],
  '🤬': ['骂人', '爆粗口', '气疯了'],
  '😈': ['坏笑', '邪恶', '恶魔'],
  '👿': ['恶魔', '愤怒'],
  '💀': ['骷髅', '死亡', '笑死'],
  '☠️': ['骷髅', '危险', '死亡'],
  '💩': ['便便', '屎', '搞笑'],
  '🤡': ['小丑', '搞笑', '沙雕'],

  // 恐怖惊悚 - Spooky & Scary
  '👻': ['鬼', '幽灵', '万圣节'],
  '👹': ['妖怪', '鬼怪'],
  '👺': ['天狗', '妖怪'],
  '👽': ['外星人', 'ufo'],
  '👾': ['外星怪物', '游戏怪兽'],
  '🎃': ['南瓜灯', '万圣节'],
  '🤖': ['机器人'],

  // 可爱动物 - Cute Animals
  '😺': ['笑脸猫', '开心猫'],
  '😸': ['猫笑', '开心猫'],
  '😹': ['猫笑哭'],
  '😻': ['喜欢猫', '爱心猫'],
  '😼': ['得意猫', '坏笑猫'],
  '😽': ['亲亲猫'],
  '🙀': ['惊恐猫', '崩溃猫'],
  '😿': ['哭猫', '伤心猫'],
  '😾': ['生气猫', '不爽猫'],
  '🐶': ['狗', '小狗', '汪'],
  '🐕': ['狗', '小狗'],
  '🐩': ['贵宾犬', '卷毛狗'],
  '🦁': ['狮子'],
  '🐯': ['老虎'],
  '🐺': ['狼'],
  '🦄': ['独角兽'],
  '🐷': ['猪'],
  '🐗': ['野猪'],
  '🐨': ['考拉'],
  '🐼': ['熊猫'],

  // 生病不适 - Sick & Unwell
  '😷': ['口罩', '生病', '感冒'],
  '🤒': ['发烧', '生病'],
  '🤕': ['受伤', '头疼'],
  '🤢': ['恶心', '想吐'],
  '🤮': ['呕吐', '吐了'],
  '🤧': ['打喷嚏', '感冒'],
  '🥵': ['热', '中暑', '热死了'],
  '🥶': ['冷', '冻死了'],
  '🤥': ['说谎', '撒谎', '皮诺曹'],
};

/**
 * Filter a pool of emoji by Chinese (or other) keyword search.
 * Matches bidirectionally (query-in-keyword or keyword-in-query) since both
 * queries and keywords here are short CJK substrings without clean tokenization.
 * Preserves the pool's original order; returns the full pool for an empty query.
 */
export function searchCuratedEmojis(query: string, pool: string[]): string[] {
  const trimmed = query.trim();
  if (!trimmed) return pool;

  return pool.filter((emoji) => {
    const keywords = EMOJI_KEYWORDS_ZH[emoji];
    if (!keywords) return false;
    return keywords.some((keyword) => keyword.includes(trimmed) || trimmed.includes(keyword));
  });
}
