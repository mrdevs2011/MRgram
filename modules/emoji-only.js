/* emoji-only.js — xabar faqat emojidan iborat bo'lsa, chat.js/groups.js `.chat-msg` ga qo'shadigan klass.
   1 ta emoji eng katta, 2 > 3 > 4 kichrayadi, 4 va undan ko'pi bir xil (CSS: .emo-1..emo-4). */
const SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const EMO = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3)/u;

export function emojiOnlyCount(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t || t.length > 200) return 0;
  const parts = SEG ? [...SEG.segment(t)].map(s => s.segment) : Array.from(t);
  for (const g of parts) if (!EMO.test(g)) return 0;
  return parts.length;
}

export function emojiOnlyClass(text) {
  const n = emojiOnlyCount(text);
  return n ? ` emoji-only emo-${Math.min(n, 4)}` : '';
}
