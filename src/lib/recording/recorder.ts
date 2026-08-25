import { RecordingState, RecorderOptions } from './types';

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private state: RecordingState = 'idle';
  private duration = 0;
  private timerId: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private mimeType = 'audio/webm';
  private options: RecorderOptions;

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
      this.audioChunks = [];
      this.duration = 0;

      // Select best supported MIME type
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

      this.mediaRecorder = this.mimeType
        ? new MediaRecorder(this.audioStream, { mimeType: this.mimeType })
        : new MediaRecorder(this.audioStream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.setupVolumeAnalyzer(this.audioStream);

      this.mediaRecorder.start(250); // Collect data slices every 250ms
      this.setState('recording');
      this.startTimer();
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
      this.stopTimer();
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state === 'paused') {
      this.mediaRecorder.resume();
      this.startTimer();
      this.setState('recording');
    }
  }

  public stop(): Promise<{ blob: Blob; duration: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state === 'idle') {
        reject(new Error('لا يوجد تسجيل نشط لإيقافه'));
        return;
      }

      const recordedDuration = this.duration;
      const mime = this.mimeType || this.mediaRecorder.mimeType || 'audio/webm';

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mime });
        this.cleanup();
        this.setState('idle');
        resolve({
          blob: audioBlob,
          duration: recordedDuration,
          mimeType: mime
        });
      };

      this.stopTimer();
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
          // Scale to 0-100
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
    this.analyser = null;
  }
}
