/**
 * Quran Arabic Normalization & Word-Level Sequence Alignment Engine (v2)
 *
 * Compares the text recognized by Whisper / Gemini with the reference page ayahs.
 *
 * What changed vs v1 (see the review notes):
 *  1. Tiered matching instead of a boolean: exact | orthographic | phonetic | none.
 *       exact / orthographic -> 'correct'
 *       phonetic             -> 'correct' (only letters ASR commonly confuses: ق/ك, ص/س, ت/ط ...;
 *                                          disabled in 'strict' mode, where it becomes 'incorrect')
 *       none                 -> 'incorrect'
 *  2. Removed the rules that made unrelated words match
 *     (prefix / plural / pronoun stripping, الا↔ان, عما↔عن, any "50% similar" rule, isFuzzyAcceptable).
 *  3. Missing words ('missing') and extra words ('addition') are reported in EVERY mode.
 *     Strictness only changes how much they weigh in the accuracy score.
 *  4. One classifier is used by both the DP and the post-processing (no inconsistency).
 *  5. Exact matches score higher than orthographic, which score higher than phonetic.
 *  6. Token merge / split (e.g. spoken "يا" "ايها" <-> expected "يايها").
 *  7. Optional position hint (startWordIndex) to resolve repeated refrains.
 *  8. Everything is pre-normalized once (no regex work inside the N×M loop).
 *  9. Guard against aligning unrelated speech; the closing "صدق الله العظيم" is ignored.
 *
 * Extra spoken words are reported as mistakes of type 'addition' (they have no reference word to color).
 */

import { PageAyah, removeLeadingBasmala } from '../quran-verses';
import { AyahWordItem, RecitationAnalysisResponse, RecitationMistake, RecitationStrictness, WordMatchStatus } from './types';

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

/** Diacritics / Quranic marks stripped when we only need the base letters of a raw word. */
const MARKS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0600-\u0605\u0615-\u061A\u06DF-\u06E4\u200b-\u200f]/g;

export interface NormalizeOptions {
  /**
   * true  (default): dagger alif (ٰ) -> ا     (مَٰلِك -> مالك)
   * false          : dagger alif is removed  (مَٰلِك -> ملك)  — this is how ASR usually writes it
   */
  daggerAsAlif?: boolean;
}

/**
 * Arabic normalizer tailored for Quranic text / speech-recognition comparison.
 * Translates Uthmani orthography (dagger alifs, madds, hamzas) into plain phonetic Arabic.
 */
export function normalizeQuranicArabic(text: string, options: NormalizeOptions = {}): string {
  if (!text) return '';
  const daggerAsAlif = options.daggerAsAlif !== false;

  return (
    text
      // 0. Invisible / zero-width characters
      .replace(/[\ufeff\u200b-\u200f\u202a-\u202e]/g, '')
      // 0.1 Whisper special tokens e.g. <|startoftranscript|>, <|ar|>
      .replace(/<\|.*?\|>/g, '')
      // 1. Waw / Yaa + dagger alif -> alif (الصَّلَوٰة -> الصلاة)
      .replace(/[\u0648\u06E5]\u0670/g, 'ا')
      .replace(/[\u0649\u064A\u06D0\u06D1]\u0670/g, 'ا')
      // 2. Standalone dagger alif
      .replace(/\u0670/g, daggerAsAlif ? 'ا' : '')
      // 3. Silah marks (small waw / small yaa) are recitation marks, not root letters
      .replace(/[\u06E5\u06E6\u06E7\u06E8]/g, '')
      // 4. Pause marks, decorative symbols, zero-vowel signs
      .replace(/[\u06D6-\u06ED\u0600-\u0605\u0615-\u061A\u06DF-\u06E4]/g, '')
      // 5. Tashkeel (fatha, damma, kasra, sukun, shadda, tanween, maddah, hamza above/below)
      .replace(/[\u064B-\u065F]/g, '')
      // 6. Hamza followed by alif (ءا) -> ا ; leading hamza -> ا
      .replace(/\u0621[\u0627\u0671]/g, 'ا')
      .replace(/^\u0621/g, 'ا')
      // 7. Alif variants -> ا
      .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, 'ا')
      // 8. Yaa variants -> ي  (also Farsi yeh / Farsi kaf that some Quran datasets use)
      .replace(/[\u0649\u0626\u06D0\u06D1\u06CC]/g, 'ي')
      .replace(/\u06A9/g, 'ك')
      // 9. Taa marbouta -> ه
      .replace(/\u0629/g, 'ه')
      // 10. Waw with hamza -> و
      .replace(/\u0624/g, 'و')
      // 11. Tatweel
      .replace(/\u0640/g, '')
      // 12. Collapse repeated alifs
      .replace(/ا+/g, 'ا')
      // 13. Drop anything that is not an Arabic letter / space
      .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, '')
      // 14. Collapse spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/* ------------------------------------------------------------------ */
/* String distance helpers                                             */
/* ------------------------------------------------------------------ */

/** Levenshtein distance (two-row implementation). */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;

  let prev: number[] = Array.from({ length: s2.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s1.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[s2.length];
}

/** 0..1 similarity based on Levenshtein distance (kept for UI / debugging). */
export function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  if (!w1 || !w2) return 0.0;
  const dist = levenshteinDistance(w1, w2);
  return Math.max(0, 1 - dist / Math.max(w1.length, w2.length));
}

/* ------------------------------------------------------------------ */
/* Word classification (tiers)                                         */
/* ------------------------------------------------------------------ */

export type WordMatchTier = 'exact' | 'orthographic' | 'phonetic' | 'none';

interface StrictnessConfig {
  /** Accept letters ASR commonly confuses (ق/ك, ص/س, ت/ط, ...) as a match (tier 'phonetic'). */
  useAcousticKey: boolean;
  /** Weight of a missing word in the accuracy denominator. */
  missingWeight: number;
  /** Weight of an extra word in the accuracy denominator. */
  extraWeight: number;
}

const STRICTNESS_CONFIG: Record<RecitationStrictness, StrictnessConfig> = {
  lenient: {
    useAcousticKey: true,
    missingWeight: 0.5,
    extraWeight: 0.25
  },
  balanced: {
    useAcousticKey: true,
    missingWeight: 1,
    extraWeight: 0.5
  },
  strict: {
    useAcousticKey: false,
    missingWeight: 1,
    extraWeight: 1
  }
};

/** Letters Whisper often confuses. Groups are disjoint, so there is no chained merging. */
function toAcousticPhoneticKey(s: string): string {
  return s
    .replace(/[طت]/g, 'ت')
    .replace(/[ثذز]/g, 'ز')
    .replace(/[ضظ]/g, 'ض')
    .replace(/[صس]/g, 'س')
    .replace(/[قك]/g, 'ك')
    .replace(/[حخ]/g, 'ح');
}

/** A reference word with every comparison form computed once. */
interface PreparedWord {
  /** dagger alif -> ا   (مالك, الرحمان) */
  full: string;
  /** dagger alif removed (ملك, الرحمن) — how ASR usually writes it */
  short: string;
  /** raw word ends with ى (alif maqsura): موسى، هدى، على */
  endsMaqsura: boolean;
  /** raw word ends with ة: الصلاة، رحمة */
  endsTaaMarbuta: boolean;
}

function prepareWord(raw: string): PreparedWord {
  const letters = raw.replace(MARKS_RE, '');
  const full = normalizeQuranicArabic(raw, { daggerAsAlif: true });
  const short = normalizeQuranicArabic(raw, { daggerAsAlif: false });
  return {
    full,
    short,
    endsMaqsura: /\u0649$/.test(letters),
    endsTaaMarbuta: /\u0629$/.test(letters)
  };
}

const stripWawAlif = (s: string) => (s.length >= 4 ? s.replace(/وا$/, 'و') : s); // قالوا ~ قالو
const stripSilah = (s: string) => (s.length >= 3 ? s.replace(/ه[وي]$/, 'ه') : s); // له ~ لهو (not هو ~ هي)
const endYa = (s: string) => s.replace(/[يا]$/, 'ي'); // موسى ~ موسا
const stripHamza = (s: string) => s.replace(/\u0621/g, '');

/** Pure spelling variants of the same word (no change in letters pronounced). */
const ORTHOGRAPHIC_PAIRS: Array<[string, string]> = [['الياسين', 'ياسين']];

function orthographicEqual(exp: PreparedWord, v: string, spk: string): boolean {
  // قالوا / قالو
  if (stripWawAlif(v) === stripWawAlif(spk)) return true;

  // له / لهو  (silah). Never collapses 2-letter words, so هو != هي
  const sv = stripSilah(v);
  if (sv.length >= 2 && sv === stripSilah(spk)) return true;

  // موسى / موسا / موسي (alif maqsura written with ا or ي)
  if (exp.endsMaqsura && v.length >= 2 && endYa(v) === endYa(spk)) return true;

  // الصلاة read as الصلات when the reciter continues (wasl) — expected ends with ة only
  if (
    exp.endsTaaMarbuta &&
    spk.length >= 3 &&
    spk.endsWith('ت') &&
    v.endsWith('ه') &&
    spk.slice(0, -1) === v.slice(0, -1)
  ) {
    return true;
  }

  // Hamza written / dropped by ASR: شيء / شي
  const hv = stripHamza(v);
  if (hv.length >= 2 && hv === stripHamza(spk)) return true;

  for (const [a, b] of ORTHOGRAPHIC_PAIRS) {
    if ((v === a && spk === b) || (v === b && spk === a)) return true;
  }
  return false;
}

function classifyPrepared(
  exp: PreparedWord,
  spk: string,
  cfg: StrictnessConfig,
  allowPhonetic: boolean = true
): WordMatchTier {
  if (!spk) return 'none';

  if (spk === exp.full || spk === exp.short) return 'exact';

  const variants = exp.full === exp.short ? [exp.full] : [exp.full, exp.short];

  for (const v of variants) {
    if (orthographicEqual(exp, v, spk)) return 'orthographic';
  }
  if (!allowPhonetic) return 'none';

  for (const v of variants) {
    if (cfg.useAcousticKey && v.length >= 2 && toAcousticPhoneticKey(v) === toAcousticPhoneticKey(spk)) {
      return 'phonetic';
    }
  }
  return 'none';
}

/**
 * Classify a spoken word against a raw (Uthmani) reference word.
 * Useful for UI/debugging; the aligner uses the prepared/cached version internally.
 */
export function classifyQuranicWord(
  expectedRaw: string,
  spokenRaw: string,
  strictness: RecitationStrictness = 'lenient'
): WordMatchTier {
  if (!expectedRaw || !spokenRaw) return 'none';
  return classifyPrepared(prepareWord(expectedRaw), normalizeQuranicArabic(spokenRaw), STRICTNESS_CONFIG[strictness]);
}

/**
 * Backward-compatible boolean: true only for exact / orthographic matches.
 * (Acoustic 'phonetic' matches are counted as correct by the aligner, but not here —
 *  use classifyQuranicWord to get the tier.)
 */
export function isQuranicWordMatch(
  expectedRaw: string,
  spokenRaw: string,
  strictness: RecitationStrictness = 'lenient'
): boolean {
  const tier = classifyQuranicWord(expectedRaw, spokenRaw, strictness);
  return tier === 'exact' || tier === 'orthographic';
}

/* ------------------------------------------------------------------ */
/* Page words                                                          */
/* ------------------------------------------------------------------ */

/**
 * Break page ayahs down into a structured list of individual words.
 * Word ids use the original token index `i` so they stay identical to PageViewer's ids
 * (tokens that normalize to empty, e.g. standalone pause marks, are skipped but keep their index).
 */
export function extractPageWords(ayahs: PageAyah[]): AyahWordItem[] {
  const words: AyahWordItem[] = [];
  let globalWordCounter = 0;

  for (const ayah of ayahs) {
    const rawCleanText =
      ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9
        ? removeLeadingBasmala(ayah.text)
        : ayah.text;
    const cleanAyahText = rawCleanText.length > 0 ? rawCleanText : ayah.text;

    const tokens = cleanAyahText.trim().split(/\s+/).filter(t => t.trim().length > 0);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const clean = normalizeQuranicArabic(token);
      if (!clean) continue;

      words.push({
        id: `w_${ayah.surahNumber}_${ayah.numberInSurah}_${i}`,
        wordIndex: globalWordCounter++,
        text: token,
        cleanText: clean,
        surahNumber: ayah.surahNumber,
        ayahNumberInSurah: ayah.numberInSurah,
        ayahGlobalNumber: ayah.number,
        status: 'idle'
      });
    }
  }

  return words;
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

export interface AlignmentOptions {
  /**
   * Index (in `expectedWords`) of the word the reciter is expected to start from.
   * Soft prior only: starting elsewhere costs a small penalty, so repeated refrains
   * (e.g. فبأي آلاء ربكما تكذبان) are aligned to the nearest occurrence.
   */
  startWordIndex?: number;
}

export interface AlignmentResult {
  wordStatuses: Record<string, { status: WordMatchStatus; spoken?: string }>;
  mistakes: RecitationMistake[];
  accuracyScore: number;
  /** Number of reference words judged 'correct'. */
  matchedWordsCount: number;
  missingCount: number;
  extraCount: number;
}

const SCORE_EXACT = 3;
const SCORE_ORTHOGRAPHIC = 2.5;
const SCORE_PHONETIC = 1;
const SCORE_MERGE_SPLIT = 2.5;
// A substitution (-1.5) must be cheaper than "skip expected + extra spoken" (-2),
// but more expensive than a plain extra word (-1), so pure garbage does not get aligned.
const SCORE_MISMATCH = -1.5;
const SCORE_GAP = -1;

const START_PENALTY_PER_WORD = 0.05;
const START_PENALTY_CAP = 6;

const TB_START = 0;
const TB_DIAG = 1;
const TB_UP = 2; // expected word skipped (missing)
const TB_LEFT = 3; // extra spoken word
const TB_SPLIT = 4; // 1 expected word <-> 2 spoken tokens
const TB_MERGE = 5; // 2 expected words <-> 1 spoken token

type PairKind = 'diag' | 'up' | 'left' | 'split' | 'merge';
interface AlignedPair {
  kind: PairKind;
  exp: number[];
  spk: number[];
}

function tierScore(tier: WordMatchTier): number {
  switch (tier) {
    case 'exact':
      return SCORE_EXACT;
    case 'orthographic':
      return SCORE_ORTHOGRAPHIC;
    case 'phonetic':
      return SCORE_PHONETIC;
    default:
      return SCORE_MISMATCH;
  }
}

const emptyResult = (): AlignmentResult => ({
  wordStatuses: {},
  mistakes: [],
  accuracyScore: 0,
  matchedWordsCount: 0,
  missingCount: 0,
  extraCount: 0
});

/**
 * Word-by-word semi-global alignment between reference words and spoken tokens.
 * Handles partial-page readings (leading / trailing unread words are never penalized)
 * while reporting substitutions, omissions and insertions *inside* the recited span.
 */
export function alignRecitationWords(
  expectedWords: AyahWordItem[],
  recognizedTranscription: string,
  strictness: RecitationStrictness = 'lenient',
  options: AlignmentOptions = {}
): AlignmentResult {
  const cfg = STRICTNESS_CONFIG[strictness];

  const normalizedSpoken = normalizeQuranicArabic(recognizedTranscription);
  const rawSpokenTokens = normalizedSpoken.split(/\s+/).filter(t => t.length > 0);

  // Basmala handling: spoken starts with Basmala but the page does not
  let spokenTokens = rawSpokenTokens;
  if (
    rawSpokenTokens.length >= 4 &&
    expectedWords.length > 0 &&
    expectedWords[0].cleanText !== 'بسم' &&
    rawSpokenTokens[0] === 'بسم' &&
    rawSpokenTokens[1] === 'الله' &&
    (rawSpokenTokens[2] === 'الرحمن' || rawSpokenTokens[2] === 'الرحمان') &&
    rawSpokenTokens[3] === 'الرحيم'
  ) {
    spokenTokens = rawSpokenTokens.slice(4);
  }

  // Closing formula "صدق الله العظيم" is not part of the page text
  const L = spokenTokens.length;
  if (
    L > 3 &&
    spokenTokens[L - 3] === 'صدق' &&
    spokenTokens[L - 2] === 'الله' &&
    spokenTokens[L - 1] === 'العظيم'
  ) {
    spokenTokens = spokenTokens.slice(0, L - 3);
  }

  const N = expectedWords.length;
  const M = spokenTokens.length;
  if (N === 0 || M === 0) return emptyResult();

  // ---- Pre-compute everything once -------------------------------------------------
  const prepared: PreparedWord[] = expectedWords.map(w => prepareWord(w.text));
  const mergedCache = new Map<number, PreparedWord>();
  const getMerged = (i: number): PreparedWord => {
    // expected words (i-2, i-1) written as one word
    let m = mergedCache.get(i);
    if (!m) {
      m = prepareWord(expectedWords[i - 2].text + expectedWords[i - 1].text);
      mergedCache.set(i, m);
    }
    return m;
  };

  const tiers: WordMatchTier[][] = expectedWords.map((_, e) =>
    spokenTokens.map(spk => classifyPrepared(prepared[e], spk, cfg))
  );

  const isStrongMatch = (t: WordMatchTier) => t === 'exact' || t === 'orthographic';

  // 1 expected word <-> 2 spoken tokens (e.g. expected يايها, spoken "يا" "ايها")
  const canSplit = (e: number, s: number): boolean => {
    // collapse alifs at the join point: "يا" + "ايها" -> "يايها" (same as normalization step 12)
    const joined = (spokenTokens[s] + spokenTokens[s + 1]).replace(/ا+/g, 'ا');
    if (Math.abs(prepared[e].full.length - joined.length) > 3) return false;
    return isStrongMatch(classifyPrepared(prepared[e], joined, cfg, false));
  };
  // 2 expected words <-> 1 spoken token
  const canMerge = (i: number, s: number): boolean => {
    const merged = getMerged(i);
    if (Math.abs(merged.full.length - spokenTokens[s].length) > 3) return false;
    return isStrongMatch(classifyPrepared(merged, spokenTokens[s], cfg, false));
  };

  // ---- DP --------------------------------------------------------------------------
  const hint = options.startWordIndex;
  const startPenalty = (i: number): number =>
    hint === undefined ? 0 : -Math.min(START_PENALTY_CAP, START_PENALTY_PER_WORD * Math.abs(i - hint));

  const dp: Float64Array[] = Array.from({ length: N + 1 }, () => new Float64Array(M + 1));
  const tb: Uint8Array[] = Array.from({ length: N + 1 }, () => new Uint8Array(M + 1));

  for (let i = 0; i <= N; i++) {
    dp[i][0] = startPenalty(i); // free (soft-penalized) start inside the page
    tb[i][0] = TB_START;
  }
  for (let j = 1; j <= M; j++) {
    dp[0][j] = dp[0][j - 1] + SCORE_GAP;
    tb[0][j] = TB_LEFT;
  }

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      let best = dp[i - 1][j - 1] + tierScore(tiers[i - 1][j - 1]);
      let step = TB_DIAG;

      const up = dp[i - 1][j] + SCORE_GAP;
      if (up > best) {
        best = up;
        step = TB_UP;
      }
      const left = dp[i][j - 1] + SCORE_GAP;
      if (left > best) {
        best = left;
        step = TB_LEFT;
      }
      if (j >= 2) {
        const split = dp[i - 1][j - 2] + SCORE_MERGE_SPLIT;
        if (split > best && canSplit(i - 1, j - 2)) {
          best = split;
          step = TB_SPLIT;
        }
      }
      if (i >= 2) {
        const merge = dp[i - 2][j - 1] + SCORE_MERGE_SPLIT;
        if (merge > best && canMerge(i, j - 1)) {
          best = merge;
          step = TB_MERGE;
        }
      }

      dp[i][j] = best;
      tb[i][j] = step;
    }
  }

  // Free end: best row where all spoken tokens are consumed
  let bestI = N;
  let maxEndScore = -Infinity;
  for (let i = 1; i <= N; i++) {
    if (dp[i][M] > maxEndScore) {
      maxEndScore = dp[i][M];
      bestI = i;
    }
  }

  // ---- Traceback -------------------------------------------------------------------
  const pairs: AlignedPair[] = [];
  let ti = bestI;
  let tj = M;
  while (ti > 0 && tj > 0) {
    const step = tb[ti][tj];
    if (step === TB_DIAG) {
      pairs.push({ kind: 'diag', exp: [ti - 1], spk: [tj - 1] });
      ti--;
      tj--;
    } else if (step === TB_UP) {
      pairs.push({ kind: 'up', exp: [ti - 1], spk: [] });
      ti--;
    } else if (step === TB_LEFT) {
      pairs.push({ kind: 'left', exp: [], spk: [tj - 1] });
      tj--;
    } else if (step === TB_SPLIT) {
      pairs.push({ kind: 'split', exp: [ti - 1], spk: [tj - 2, tj - 1] });
      ti--;
      tj -= 2;
    } else if (step === TB_MERGE) {
      pairs.push({ kind: 'merge', exp: [ti - 2, ti - 1], spk: [tj - 1] });
      ti -= 2;
      tj--;
    } else {
      break;
    }
  }
  pairs.reverse();

  // The recited span = from the first to the last pair that links expected <-> spoken.
  // Unread words before / after it are never penalized.
  const isLinked = (p: AlignedPair) => p.exp.length > 0 && p.spk.length > 0;
  const firstLinked = pairs.findIndex(isLinked);
  let lastLinked = -1;
  for (let k = pairs.length - 1; k >= 0; k--) {
    if (isLinked(pairs[k])) {
      lastLinked = k;
      break;
    }
  }
  if (firstLinked === -1) return emptyResult();

  // Guard against aligning unrelated speech: need at least one solid anchor
  // (exact / orthographic), or at least two linked words (a lone acoustic hit is not enough evidence).
  let strongLinked = 0;
  let linkedWords = 0;
  for (let k = firstLinked; k <= lastLinked; k++) {
    const p = pairs[k];
    if (!isLinked(p)) continue;
    linkedWords++;
    if (p.kind !== 'diag' || isStrongMatch(tiers[p.exp[0]][p.spk[0]])) strongLinked++;
  }
  if (strongLinked === 0 && linkedWords < 2) return emptyResult();

  // ---- Build statuses & mistakes ---------------------------------------------------
  const wordStatuses: AlignmentResult['wordStatuses'] = {};
  const mistakes: RecitationMistake[] = [];
  let correct = 0;
  let incorrect = 0;
  let missing = 0;
  let extra = 0;

  let lastExpIdx = pairs[firstLinked].exp[0];

  const pushAddition = (spk: string) => {
    const anchor = expectedWords[lastExpIdx];
    extra++;
    mistakes.push({
      surahNumber: anchor.surahNumber,
      ayahNumberInSurah: anchor.ayahNumberInSurah,
      wordIndex: anchor.wordIndex,
      expectedText: '',
      spokenText: spk,
      type: 'addition',
      description: `كلمة زائدة بعد (${anchor.text}): قيل (${spk})`
    } as RecitationMistake);
  };

  for (let k = firstLinked; k <= lastLinked; k++) {
    const pair = pairs[k];

    if (pair.kind === 'diag') {
      const e = pair.exp[0];
      const s = pair.spk[0];
      const word = expectedWords[e];
      const spk = spokenTokens[s];
      const tier = tiers[e][s];
      lastExpIdx = e;

      if (tier !== 'none') {
        wordStatuses[word.id] = { status: 'correct', spoken: spk };
        correct++;
      } else {
        wordStatuses[word.id] = { status: 'incorrect', spoken: spk };
        incorrect++;
        mistakes.push({
          surahNumber: word.surahNumber,
          ayahNumberInSurah: word.ayahNumberInSurah,
          wordIndex: word.wordIndex,
          expectedText: word.text,
          spokenText: spk,
          type: 'substitution',
          description: `خطأ في الكلمة: قيل (${spk}) والصحيح (${word.text})`
        } as RecitationMistake);
      }
    } else if (pair.kind === 'split') {
      const e = pair.exp[0];
      const spk = pair.spk.map(s => spokenTokens[s]).join(' ');
      wordStatuses[expectedWords[e].id] = { status: 'correct', spoken: spk };
      correct++;
      lastExpIdx = e;
    } else if (pair.kind === 'merge') {
      const spk = spokenTokens[pair.spk[0]];
      for (const e of pair.exp) {
        wordStatuses[expectedWords[e].id] = { status: 'correct', spoken: spk };
        correct++;
        lastExpIdx = e;
      }
    } else if (pair.kind === 'up') {
      const word = expectedWords[pair.exp[0]];
      wordStatuses[word.id] = { status: 'missing' };
      missing++;
      mistakes.push({
        surahNumber: word.surahNumber,
        ayahNumberInSurah: word.ayahNumberInSurah,
        wordIndex: word.wordIndex,
        expectedText: word.text,
        type: 'omission',
        description: `كلمة منسية / تم تخطيها في التلاوة: (${word.text})`
      } as RecitationMistake);
      lastExpIdx = pair.exp[0];
    } else {
      // 'left' inside the recited span: extra spoken word
      pushAddition(spokenTokens[pair.spk[0]]);
    }
  }

  // Trailing extras: only if the reciter did NOT simply continue past the end of the page
  if (bestI < N) {
    for (let k = lastLinked + 1; k < pairs.length; k++) {
      if (pairs[k].kind === 'left') pushAddition(spokenTokens[pairs[k].spk[0]]);
    }
  }

  // ---- Accuracy --------------------------------------------------------------------
  const denominator = correct + incorrect + cfg.missingWeight * missing + cfg.extraWeight * extra;
  const accuracy = denominator > 0 ? Math.round((correct / denominator) * 100) : 0;

  return {
    wordStatuses,
    mistakes,
    accuracyScore: Math.min(100, Math.max(0, accuracy)),
    matchedWordsCount: correct,
    missingCount: missing,
    extraCount: extra
  };
}

/* ------------------------------------------------------------------ */
/* Response builder                                                    */
/* ------------------------------------------------------------------ */

/**
 * Generate the full recitation analysis response for the frontend.
 * `options.startWordIndex` is an optional hint (index in `expectedWords`) of where the reciter starts.
 */
export function buildRecitationAnalysis(
  expectedWords: AyahWordItem[],
  recognizedTranscription: string,
  durationSeconds: number = 0,
  processingTimeMs: number = 0,
  strictness: RecitationStrictness = 'lenient',
  options: AlignmentOptions = {}
): RecitationAnalysisResponse {
  const result = alignRecitationWords(expectedWords, recognizedTranscription, strictness, options);

  return {
    transcription: recognizedTranscription,
    normalizedTranscription: normalizeQuranicArabic(recognizedTranscription),
    accuracyScore: result.accuracyScore,
    totalExpectedWords: expectedWords.length,
    matchedWordsCount: result.matchedWordsCount,
    mistakesCount: result.mistakes.length,
    mistakes: result.mistakes,
    wordStatuses: result.wordStatuses,
    audioDurationSeconds: durationSeconds,
    processingTimeMs,
    modelName: 'Whisper Quran AI / Gemini'
  };
}