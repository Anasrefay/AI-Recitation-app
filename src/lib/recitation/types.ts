/**
 * Types for Quran Recitation AI Comparison ("ترتيل")
 */

export type WordMatchStatus = 'idle' | 'live_active' | 'correct' | 'incorrect' | 'missing' | 'extra';

export type RecitationStrictness = 'lenient' | 'balanced' | 'strict';

export interface AyahWordItem {
  id: string;              // unique word id e.g. "w_2_197_3"
  wordIndex: number;       // index in page or ayah
  text: string;            // original Uthmani text with tashkeel
  cleanText: string;       // normalized text for matching
  surahNumber: number;
  ayahNumberInSurah: number;
  ayahGlobalNumber: number;
  status: WordMatchStatus;
  spokenWord?: string;     // what the Whisper model recognized if incorrect
  confidence?: number;     // 0-1
}

export interface WordDiffResult {
  expectedWord: string;
  expectedWordIndex: number;
  spokenWord?: string;
  surahNumber: number;
  ayahNumberInSurah: number;
  status: WordMatchStatus;
  notes?: string;
}

export interface RecitationMistake {
  surahNumber: number;
  ayahNumberInSurah: number;
  wordIndex: number;
  expectedText: string;
  spokenText?: string;
  type: 'substitution' | 'omission' | 'addition';
  description: string;
}

export interface RecitationAnalysisResponse {
  transcription: string;             // full text recognized by Whisper
  normalizedTranscription: string;
  accuracyScore: number;             // percentage 0 - 100
  totalExpectedWords: number;
  matchedWordsCount: number;
  mistakesCount: number;
  mistakes: RecitationMistake[];
  wordStatuses: Record<string, { status: WordMatchStatus; spoken?: string }>; // key is wordId
  audioDurationSeconds: number;
  processingTimeMs: number;
  modelName: string;
  summary?: string;
  matchedWordIds?: string[];
}

export interface LiveStreamChunkResponse {
  partialTranscription: string;
  matchedWordIds: string[];          // IDs of words recognized so far in live stream
  lastRecognizedAyah?: number;
}
