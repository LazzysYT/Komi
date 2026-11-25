/* Plain-text anime descriptions shared by first paint, hydration and details.
 * This module never returns HTML; callers escape markup or use textContent. */
(function (root) {
  'use strict';
  const HERO_LIMIT = 320;
  const entities = Object.freeze({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',
    ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»'});
  function decodeEntity(match, name) {
    const key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(entities,key)) return entities[key];
    if (key[0] !== '#') return match;
    const point = key[1] === 'x' ? Number.parseInt(key.slice(2),16) : Number(key.slice(1));
    return Number.isInteger(point) && point > 31 && point <= 0x10ffff &&
      !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : ' ';
  }
  function clean(value) {
    return String(value == null ? '' : value)
      .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,decodeEntity)
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
      .replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|li|section|article|h[1-6])\s*>/gi,' ')
      .replace(/<[^>]*>/g,'')
      // Paired references carry their visible label between the tags.
      .replace(/\[(character|anime|manga|person|user)(?:=\d+)?\]([\s\S]*?)\[\/\1\]/gi,(_tag,_kind,label)=>label)
      // Shikimori also supplies self-contained references. Preserve only the
      // supplied label; a bare numeric ID has no name we can truthfully infer.
      .replace(/\[(?:character|anime|manga|person|user)=\d+(?:[ \t]+([^\]\r\n]+))?\]/gi,(_tag,label)=>label || '')
      .replace(/\[\/?(?:character|anime|manga|person|user|url|b|i|s|u|spoiler|quote|code|size|color|center|left|right|poster|image|video|audio|youtube|html)\b[^\]]*\]/gi,'')
      .replace(/\[\/?[a-z][^\]]*$/gi,'')
      .replace(/(?:https?:\/\/|www\.)[^\s<>\[\]]+/gi,' ')
      .replace(/[\u0000-\u001f\s]+/g,' ')
      .replace(/ +([,.;:!?…\)\]»])/g,'$1')
      .replace(/([\(«]) +/g,'$1').trim();
  }
  function excerpt(value, limit = HERO_LIMIT) {
    const text = clean(value);
    if (/^(?:аниме|anime)$/i.test(text)) return '';
    const max = Number.isSafeInteger(limit) && limit > 1 ? limit : HERO_LIMIT;
    if (text.length <= max) return text;
    let end = max - 1;
    // Keep the last complete word. If a single token is longer than the whole
    // excerpt, omit it rather than pretending its prefix is a complete word.
    if (!/\s/.test(text[end])) end = text.lastIndexOf(' ',end);
    const prefix = end < 0 ? '' : text.slice(0,end).replace(/[\s,.;:!?…—–-]+$/g,'');
    return prefix + '…';
  }
  const api = Object.freeze({clean,excerpt,HERO_LIMIT});
  root.KomiDescription = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
