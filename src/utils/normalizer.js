function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeKey(artist, title) {
  const cleanArtist = slugify(artist);
  const cleanTitle = slugify(title);
  return `${cleanArtist}::${cleanTitle}`;
}

function sanitizeHeadline(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  // Strip leading tracklist numbering (e.g. "059 ", "01. ", "01 - ")
  s = s.replace(/^\d{2,3}[\s.\-_:]+/, '');

  // Strip common YouTube/SoundCloud trailing pipeline delimiters (e.g. "| Official Music Video", "| Intro", "| Post-Trash Premiere")
  s = s.replace(/\s*\|\s*(official\s*(music\s*)?video|official\s*audio|visualizer|music\s*video|premiere|intro|outro|album\s*review|track\s*review|ep\s*review|stream|interview|feature|news|announcement|watch|listen|post-trash|clash|the\s*line\s*of\s*best\s*fit|h\s*r\s*khai).*$/i, '');
  s = s.replace(/\s*\|\s*.*$/i, ''); // Any remaining trailing pipeline annotations

  // Strip video format brackets & parentheticals [Official Music Video], [Official Music Video}, (Lyric Video), (music video / short film)
  s = s.replace(/[\[(]\s*(official\s*(music\s*)?video|official\s*audio|official\s*lyric\s*video|lyric\s*video|visualizer|premiere|track\s*premiere|stream|video|audio|album|single|ep|lp|music\s*video\s*\/\s*short\s*film|short\s*film|4k|hd|hq|live\s*clip|clip\s*officiel)\s*[\])}]/gi, '');
  s = s.replace(/[\[(]\s*prod\.?\s*by\s*[^\])]+[\])]/gi, '');
  s = s.replace(/[\[(]\s*prod\.?\s*@[^\])]+[\])]/gi, '');
  s = s.replace(/[\[(]\s*(dream\s*pop|indie\s*rock|shoegaze|post\s*punk)\s*(mix)?\s*[\])]/gi, '');

  // Strip record label annotations: (self-released), (ATOM Records), (ATOM Records, [Aenaos Records]
  s = s.replace(/\s*[\(\[]\s*self-released\s*[\)\]]?/gi, '');
  s = s.replace(/\s*[\(\[]\s*[a-z0-9\s&._-]+(?:records|recordings|music|productions|tape|label)\s*[\)\]]?/gi, '');

  // Strip trailing upload counters like (1), (2)
  s = s.replace(/\s*\(\d+\)$/, '');

  // Clean conversational parentheticals e.g. (exploiting you since 1972), (just a guy)
  s = s.replace(/\s*\([a-z\s0-9:;,'"-]{4,}\)$/gi, '');
  s = s.replace(/\s*\([a-z\s0-9:;,'"-]{15,}\)/gi, '');

  // Strip episode/series numbers (e.g. "#03", "Ep. 4")
  s = s.replace(/#\d+\b/g, '');
  s = s.replace(/\b(ep|episode|vol|volume|pt|part)\.?\s*\d+\b/gi, '');

  // Strip "with [Artist]" or "by [Artist]" collaborations
  s = s.replace(/\s+with\s+[A-Z0-9\s&]+$/i, '');
  s = s.replace(/\s+by\s+[A-Z0-9\s&._-]+$/i, '');

  // Replace underscores with spaces if used as word separators (e.g. I_HAVE_DREAM -> I HAVE DREAM)
  if (s.includes('_') && !s.includes('http')) {
    s = s.replace(/_+/g, ' ');
  }

  // Clean unnecessary quotation marks around song names
  s = s.replace(/"([^"]+)"/g, '$1');
  s = s.replace(/“([^”]+)”/g, '$1');
  s = s.replace(/‘([^’]+)’/g, '$1');
  s = s.replace(/'([^']+)'/g, '$1');

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ');

  return s.trim();
}

function parseArtistTitle(rawTitle) {
  if (!rawTitle) return { artist: "Unknown Artist", title: "Unknown Track" };
  
  let clean = sanitizeHeadline(rawTitle);

  // Handle multiple dashes by taking the first separator
  let artist = "Unknown Artist";
  let title = clean;

  if (clean.includes(" – ")) {
    const parts = clean.split(" – ").map(s => s.trim()).filter(Boolean);
    artist = parts[0];
    title = parts.slice(1).join(" ");
  } else if (clean.includes(" - ")) {
    const parts = clean.split(" - ").map(s => s.trim()).filter(Boolean);
    artist = parts[0];
    title = parts.slice(1).join(" ");
  } else if (clean.includes(" : ")) {
    const parts = clean.split(" : ").map(s => s.trim()).filter(Boolean);
    artist = parts[0];
    title = parts.slice(1).join(" ");
  }

  return { 
    artist: sanitizeHeadline(artist), 
    title: sanitizeHeadline(title) 
  };
}

function isWithinHours(dateStr, maxHours = 36) {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const diffMs = Date.now() - d.getTime();
    const minMs = -14 * 60 * 60 * 1000;
    const maxMs = maxHours * 60 * 60 * 1000;
    return diffMs >= minMs && diffMs <= maxMs;
  } catch (e) {
    return false;
  }
}

function hasNegativeKeywords(text, negativeKeywords = []) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return negativeKeywords.some(kw => {
    const k = kw.toLowerCase().trim();
    if (k.length <= 3) {
      // Use boundary match for short words like "ft", "ft.", "feat"
      const reg = new RegExp(`\\b${k.replace('.', '\\.')}\\b`, 'i');
      return reg.test(lower);
    }
    return lower.includes(k);
  });
}

/**
 * Enforces the "Clean Track" Integrity Rule (EveryNoise principle):
 * Validates that an item is a pure (Artist) - (Song Title) original track,
 * rejecting live tracks, features, remixes, covers, and review headlines.
 */
function isCleanTrack(artist, title, negativeKeywords = [], bannedArtists = []) {
  if (!artist || !title) return false;
  if (artist === "Unknown Artist" || title === "Unknown Track") return false;

  const a = artist.trim();
  const t = title.trim();
  const fullText = `${a} ${t}`.toLowerCase();

  // 1. Check banned artists (check both artist & title in case of reversed formatting)
  if (bannedArtists.some(b => {
    const bLower = b.toLowerCase().trim();
    return fullText.includes(bLower);
  })) {
    return false;
  }

  // 2. Reject self-titled duplicate album entries (e.g. "Crystal Castles - Crystal Castles", "DegHerl - DegHerl")
  if (a.toLowerCase() === t.toLowerCase()) return false;

  // 3. Reject non-English / non-Western-European scripts (Vietnamese, Cyrillic, Asian, Arabic, emojis, etc.)
  // Allows strictly English ASCII (a-z, A-Z, 0-9, standard punctuation) and standard Western European Latin accents (é, ö, ü, ñ, etc.)
  const allowedScriptRegex = /^[\x20-\x7E\u00C0-\u017F]+$/;
  if (!allowedScriptRegex.test(a) || !allowedScriptRegex.test(t)) {
    return false;
  }

  // 3b. Reject non-English specific characters (Turkish ğ, ı, ş, Portuguese ã, õ)
  if (/[ğĞıİşŞãõ]/i.test(fullText)) {
    return false;
  }

  // 3c. Reject clear non-English titles (French, Spanish, Portuguese, Turkish stopwords and phrases)
  const foreignLanguagePhrases = [
    // French phrases & vocabulary
    /\b(quand\s+tu|quand\s+passes|c'est|dans\s+la|avec\s+toi|pour\s+moi|sur\s+la|les\s+yeux|je\s+suis|tu\s+es|mon\s+amour|au\s+revoir|sans\s+toi|d'un|d'une|l'amour|quand\s+tu\s+passes)\b/i,
    // Spanish & Portuguese phrases & vocabulary
    /\b(vizinha|gostosa|virado|dias\s+virado|corazon|te\s+quiero|para\s+ti|por\s+favor|sin\s+ti|todo\s+el|lo\s+que|el\s+amor|la\s+vida|los\s+ojos|nada\s+mas|que\s+te|yo\s+no|esta\s+noche|del\s+sur|una\s+vez|dias\s+virado)\b/i,
    // Turkish vocabulary
    /\b(dikenli|değilsin|degilsin|benim|senin|icin|için|nasıl|gibi|kadar|çünkü|böyle|radyo|şarkı|dünya|tel)\b/i,
    // Brazilian Funk & Latin club edits
    /\b(mc\s+[a-z]|speed\s*\+|speed\s*\+\s*grave|grave|mtg|funk\s*bh|funk\s*rj|brega|piseiro)\b/i
  ];
  if (foreignLanguagePhrases.some(rgx => rgx.test(fullText))) {
    return false;
  }

  // 4. Reject negative keywords in artist or title
  if (hasNegativeKeywords(fullText, negativeKeywords)) return false;

  // 4. Reject live recordings, feat/ft, remixes, covers explicitly via regex
  const uncleanPatterns = [
    /\b(feat\.?|ft\.?|featuring)\b/i,
    /\b(remix|rmx|re-mix|vip mix|club mix|dub mix)\b/i,
    /\b(cover|cover version|covered by)\b/i,
    /\b(live\s*@|live\s*at|live\s*from|live\s*in|live\s*session|live\s*20\d\d)\b/i,
    /\b(reissue|re-issue|remaster|remastered|deluxe|anniversary|expanded|edition|bootleg)\b/i,
    /\b(soundtrack|ost|score|instrumental|karaoke|tribute)\b/i,
    /\b(podcast|interview|review|track-by-track|q&a|reaction|reactions|reacting)\b/i,
    /\b(radio\s*(show|broadcast|set)?|operator\s*radio|nts\s*(radio|latest)?|dj\s*set|takeover\s*show)\b/i,
    /\b(show\s*[—–-]\s*number|show\s*#|episode\s*\d+|number\s*\d{2,4})\b/i,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+20\d\d\b/i,
    /\bw\s*\/\s*[a-z0-9]/i,
    /\b(hell-o-ween|halloween|xmas|christmas|holiday edition)\b/i
  ];

  if (uncleanPatterns.some(rgx => rgx.test(fullText))) {
    return false;
  }

  // 5. Reject amateur bedroom aesthetic (all-lowercase artist OR all-lowercase title)
  const isArtistAllLower = a === a.toLowerCase() && /[a-z]/.test(a);
  const isTitleAllLower = t === t.toLowerCase() && /[a-z]/.test(t);
  if (isArtistAllLower && isTitleAllLower) {
    return false;
  }
  // Professional releases capitalize song titles; reject all-lowercase titles (e.g. "black cockatoo", "now youre mine")
  if (isTitleAllLower) {
    return false;
  }

  // 6. Reject pseudo-stylized character/number substitutions (e.g. "Cold MØde", "lyc4n", "13kjohny", "k0vertessence")
  if (/[A-Za-z]+[Øø][A-Za-z]+/i.test(fullText) || /\b[A-Za-z]*[Øø][A-Za-z]*\b/.test(a)) {
    return false;
  }
  if (/[a-z]{2,}\d+[a-z]{2,}/i.test(fullText)) {
    return false;
  }

  // 7. Reject internet slang, unspaced run-on words, sound edits, and textisms
  const slangPatterns = [
    /\b(ur|pls|plz|thx|imma|gimme|wanna|idk|ngl|tbh|saddisfaction)\b/i,
    /\b(youre|dont|cant|wont|didnt|couldnt|shouldnt|isnt|arent)\b/i, // missing apostrophe in title
    /\b(mc\s+[a-z]|speed\s*\+|sped\s*up|slowed|reverb|nightcore|grave)\b/i, // rap/funk edits
    /\b(psalm|gospel|worship|radyo)\b/i,
    /\bby\s+[a-z0-9\s]+$/i, // "Song by Artist" in title
    /[a-z]{14,}/i // unspaced run-on words like "onmyfrontdresser"
  ];
  if (slangPatterns.some(rgx => rgx.test(fullText))) {
    return false;
  }

  // 8. Reject excessively long, convoluted, or run-on concatenated titles (e.g. "b side tramps The Goddess...")
  const titleWords = t.split(/\s+/).filter(Boolean);
  if (titleWords.length > 7) {
    return false;
  }
  if (t.length > 55) {
    return false;
  }

  // Reject redundant artist name repeated inside title
  if (t.toLowerCase().includes(a.toLowerCase())) {
    return false;
  }

  // 9. Must have a sensible length and clean characters
  if (t.length < 2 || t.length > 55) return false;
  if (a.length < 2 || a.length > 50) return false;

  return true;
}

module.exports = {
  slugify,
  normalizeKey,
  sanitizeHeadline,
  parseArtistTitle,
  isWithinHours,
  hasNegativeKeywords,
  isCleanTrack
};
