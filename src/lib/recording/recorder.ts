import { RecordingState, RecorderOptions } from './types';

const RESTART_INTERVAL_MS = 3000;

export class VoiceRecorder {
  // ── Live-transcription recorder (restarts every 3s) ────────────
  // Each restart emits a complete, independent WebM blob.  The
  // onDataAvailable callback sends each blob to the WebSocket for
  // real-time ASR.  This recorder is NEVER used for the saved/
  // played/analyzed recording.
  private mediaRecorder: MediaRecorder | null = null;

  // ── Full-session recorder (continuous, never restarted) ─────────
  // Records the entire session as one seamless WebM file.  Its
  // output is what gets saved to IndexedDB, played back, downloaded,
  // and sent to POST /api/v1/recitations/analyze.
  private fullRecorder: MediaRecorder | null = null;
  private fullChunks: Blob[] = [];

  private audioStream: MediaStream | null = null;
  private state: RecordingState = 'idle';
  private duration = 0;
  private timerId: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private mimeType = 'audio/webm';
  private options: RecorderOptions;
  private restartTimerId: number | null = null;
  private isRestarting = false;
  private stopResolve: ((value: { blob: Blob; duration: number; mimeType: string }) => void) | null = null;
  private chunkIndex = 0;

  constructor(options: RecorderOptions = {}) {
    this.options = options;
  }

  public isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder === 'function'
    );
  }

  public getState(): RecordingState {
    return this.state;
  }

  public getDuration(): number {
    return this.duration;
  }

  public async start(): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('تسجيل الصوت غير مدعوم في هذا المتصفح');
    }

    try {
      this.duration = 0;
      this.chunkIndex = 0;
      this.fullChunks = [];

      const supportedMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac'
      ];
      this.mimeType = supportedMimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';

      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.setupVolumeAnalyzer(this.audioStream);

      // 1. Live-transcription recorder (restarts every 3s)
      this.createAndStartRecorder();

      // 2. Full-session recorder (continuous, never restarted)
      this.createFullRecorder();

      this.setState('recording');
      this.startTimer();
      this.startRestartTimer();
    } catch (err: unknown) {
      this.cleanup();
      let friendlyMessage = 'تعذر الوصول إلى الميكروفون';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('denied')) {
          friendlyMessage = 'تم رفض إذن استخدام الميكروفون. يُرجى السماح بالوصول للميكروفون من إعدادات المتصفح (رمز 🔒 في شريط العنوان أعلى المتصفح) ثم المحاولة مرة أخرى.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          friendlyMessage = 'لم يتم العثور على ميكروفون متصل بجهازك. يرجى توصيل ميكروفون والمحاولة ثانية.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          friendlyMessage = 'الميكروفون قيد الاستخدام بواسطة تطبيق آخر في جهازك.';
        } else {
          friendlyMessage = err.message || friendlyMessage;
        }
      }
      const error = new Error(friendlyMessage);
      if (this.options.onError) {
        this.options.onError(error);
      }
      throw error;
    }
  }

  public pause(): void {
    if (this.mediaRecorder && this.state === 'recording') {
      this.mediaRecorder.pause();
      if (this.fullRecorder && this.fullRecorder.state === 'recording') {
        this.fullRecorder.pause();
      }
      this.stopTimer();
      this.stopRestartTimer();
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state === 'paused') {
      this.mediaRecorder.resume();
      if (this.fullRecorder && this.fullRecorder.state === 'paused') {
        this.fullRecorder.resume();
      }
      this.startTimer();
      this.startRestartTimer();
      this.setState('recording');
    }
  }

  public stop(): Promise<{ blob: Blob; duration: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state === 'idle') {
        reject(new Error('لا يوجد تسجيل نشط لإيقافه'));
        return;
      }

      this.stopResolve = resolve;
      this.stopRestartTimer();
      this.isRestarting = false;
      this.stopTimer();

      // Stop the full-session recorder first so its final chunk lands
      // before we build the blob.
      if (this.fullRecorder && this.fullRecorder.state !== 'inactive') {
        this.fullRecorder.stop();
      }

      this.mediaRecorder.stop();
    });
  }

  public discard(): void {
    this.cleanup();
    this.setState('idle');
    this.duration = 0;
    if (this.options.onTimeUpdate) {
      this.options.onTimeUpdate(0);
    }
  }

  // ── Live-transcription recorder (restarts every RESTART_INTERVAL_MS) ──

  private createAndStartRecorder(): void {
    if (!this.audioStream) return;

    this.mediaRecorder = this.mimeType
      ? new MediaRecorder(this.audioStream, { mimeType: this.mimeType })
      : new MediaRecorder(this.audioStream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        const idx = this.chunkIndex++;
        const ct = event.data.type || this.mimeType || 'unknown';

        event.data.arrayBuffer().then((buffer) => {
          const bytes = new Uint8Array(buffer);
          const magicHex = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          const hasWebmHeader = bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
          console.log(
            `[Recorder] live chunk #${idx}: mimeType=${ct}, size=${event.data.size}, magic=[${magicHex}], validWebM=${hasWebmHeader}`
          );
        }).catch(() => {});

        // Send to live-transcription WebSocket (each blob is a
        // complete, independent WebM file).
        if (this.options.onDataAvailable) {
          this.options.onDataAvailable(event.data);
        }
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.isRestarting) {
        this.isRestarting = false;
        this.createAndStartRecorder();
      } else if (this.stopResolve) {
        // User-initiated stop.  The actual blob comes from the
        // full-session recorder, not this one.
        this.buildFullBlobAndResolve();
      }
    };

    this.mediaRecorder.start();
  }

  // ── Full-session recorder (continuous, never restarted) ─────────

  private createFullRecorder(): void {
    if (!this.audioStream) return;

    this.fullRecorder = this.mimeType
      ? new MediaRecorder(this.audioStream, { mimeType: this.mimeType })
      : new MediaRecorder(this.audioStream);

    this.fullRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        console.log(
          `[Recorder] full chunk: size=${event.data.size}, mimeType=${event.data.type || this.mimeType}`
        );
        this.fullChunks.push(event.data);
      }
    };

    this.fullRecorder.start();
  }

  // ── Blob assembly ──────────────────────────────────────────────

  private buildFullBlobAndResolve(): void {
    const recordedDuration = this.duration;
    const mime = this.mimeType || this.fullRecorder?.mimeType || 'audio/webm';

    console.log(
      '[Recorder] Final blob assembly — full chunk count:',
      this.fullChunks.length,
      'sizes:',
      this.fullChunks.map(c => c.size)
    );

    const audioBlob = new Blob(this.fullChunks, { type: mime });
    const resolve = this.stopResolve!;
    this.stopResolve = null;
    this.cleanup();
    this.setState('idle');
    resolve({
      blob: audioBlob,
      duration: recordedDuration,
      mimeType: mime
    });
  }

  // ── Shared helpers ─────────────────────────────────────────────

  private startRestartTimer(): void {
    this.stopRestartTimer();
    this.restartTimerId = window.setInterval(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.isRestarting = true;
        this.mediaRecorder.stop();
      }
    }, RESTART_INTERVAL_MS);
  }

  private stopRestartTimer(): void {
    if (this.restartTimerId) {
      clearInterval(this.restartTimerId);
      this.restartTimerId = null;
    }
  }

  private setupVolumeAnalyzer(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (this.state !== 'recording') {
          if (this.options.onVolumeChange) this.options.onVolumeChange(0);
          return;
        }

        if (this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const volume = Math.min(100, Math.round((average / 128) * 100));
          if (this.options.onVolumeChange) {
            this.options.onVolumeChange(volume);
          }
        }

        this.animFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch {
      // AudioContext may fail on some restricted webviews, fail silently for meter
    }
  }

  private startTimer(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = window.setInterval(() => {
      this.duration += 1;
      if (this.options.onTimeUpdate) {
        this.options.onTimeUpdate(this.duration);
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private setState(state: RecordingState): void {
    this.state = state;
    if (this.options.onStateChange) {
      this.options.onStateChange(state);
    }
  }

  private cleanup(): void {
    this.stopTimer();
    this.stopRestartTimer();
    this.isRestarting = false;
    this.stopResolve = null;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    this.mediaRecorder = null;
    this.fullRecorder = null;
    this.fullChunks = [];
    this.analyser = null;
  }
}
