export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface VoiceRecording {
  id: string;
  pageNumber: number;
  surahName?: string;
  blob: Blob;
  duration: number; // in seconds
  createdAt: number; // timestamp
  mimeType: string;
}

export interface RecorderOptions {
  onStateChange?: (state: RecordingState) => void;
  onTimeUpdate?: (seconds: number) => void;
  onVolumeChange?: (volume: number) => void; // 0 to 100
  onError?: (error: Error) => void;
  onSilenceDetected?: (audioBlob: Blob, durationSeconds: number) => void;
  silenceThresholdMs?: number; // e.g. 1100ms - 1500ms of pause/silence to trigger
  volumeThreshold?: number;    // volume below which is considered pause/silence (default ~5)
}
