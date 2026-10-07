// Slurs never get through: not into the chat, the note wall, private notes
// or Messages, and not out of the head either. The list is stored encoded so
// the public repo doesn't print it.
const LIST = new Set(JSON.parse(Buffer.from('WyJiZWFuZXIiLCAiYmVhbmVycyIsICJjaGluYW1hbiIsICJjaGluayIsICJjaGlua3MiLCAiY29vbiIsICJjb29ucyIsICJkYXJraWUiLCAiZGFya3kiLCAiZmFnIiwgImZhZ2dvdCIsICJmYWdnb3RzIiwgImdvb2siLCAiZ29va3MiLCAiaGFsZmJyZWVkIiwgImphcCIsICJqYXBzIiwgImppZ2Fib28iLCAia2lrZSIsICJraWtlcyIsICJuaWdhIiwgIm5pZ2ciLCAibmlnZ2EiLCAibmlnZ2FzIiwgIm5pZ2dlciIsICJuaWdnZXJzIiwgInBha2kiLCAicGFraXMiLCAicG9yY2htb25rZXkiLCAicmFnaGVhZCIsICJyZWRza2luIiwgInJlZHNraW5zIiwgInNhbmRuaWdnZXIiLCAic3BpYyIsICJzcGljayIsICJzcGljcyIsICJ0b3dlbGhlYWQiLCAid2V0YmFjayIsICJ3ZXRiYWNrcyIsICJ6aXBwZXJoZWFkIl0=', 'base64').toString('utf8')));

// Undo the usual tricks: case, accents, leetspeak, repeated letters, letters
// split by spaces or dots ("n i g g a", "n.i.g"), and joined phrases.
const LEET = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g', '|': 'i' };
function norm(text) {
  let t = String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  t = t.replace(/[0-9!@$|]/g, (c) => LEET[c] || c);
  // join single letters separated by spaces/dots/dashes: "n i g" -> "nig"
  t = t.replace(/\b(?:[a-z][\s._*-]+){2,}[a-z]\b/g, (m) => m.replace(/[\s._*-]+/g, ''));
  return t;
}
const collapse = (w) => w.replace(/(.)\1+/g, '$1');
const LIST_C = new Set([...LIST].map(collapse));

export function hasSlur(text) {
  const t = norm(text);
  const words = t.split(/[^a-z]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const stem = w.replace(/(?:es|s)$/, '');
    if (LIST.has(w) || LIST_C.has(collapse(w)) || LIST.has(stem) || LIST_C.has(collapse(stem))) return true;
    // two-word slurs written apart ("sand n...", "porch monkey")
    if (i + 1 < words.length && (LIST.has(w + words[i + 1]) || LIST_C.has(collapse(w + words[i + 1])))) return true;
  }
  return false;
}

// For text that already went out or gets stored: stars over the word.
export function maskSlurs(text) {
  return String(text || '').replace(/[A-Za-z0-9@$!|]+(?:[\s._*-]+[A-Za-z0-9@$!|]+)*/g, (chunk) =>
    chunk.split(/(\s+)/).map((part) => (hasSlur(part) ? '*'.repeat(Math.min(part.length, 6)) : part)).join(''));
}
