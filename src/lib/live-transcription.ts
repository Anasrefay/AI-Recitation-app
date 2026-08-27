export interface LiveTranscriptionResult {
  type: 'transcript' | 'error';
  text?: string;
  transcription_ms?: number;
  audio_duration_ms?: number;
  error?: string;
}

export interface LiveTranscriptionCallbacks {
  onResult: (result: LiveTranscriptionResult) => void;
  onError: (error: string) => void;
  onOpen: () => void;
  onClose: () => void;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
).replace(/\/$/, '');

function getWsUrl(): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws/live-transcribe`;
}

export class LiveTranscriptionClient {
  private ws: WebSocket | null = null;
  private callbacks: LiveTranscriptionCallbacks;
  private closed = false;

  constructor(callbacks: LiveTranscriptionCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.ws) return;

    const url = getWsUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      if (this.ws) {
        this.ws.send(JSON.stringify({}));
      }
      this.callbacks.onOpen();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveTranscriptionResult;
        this.callbacks.onResult(data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError('تعذر الاتصال بخادم التحليل المباشر');
    };

    this.ws.onclose = () => {
      this.closed = true;
      this.callbacks.onClose();
    };
  }

  sendChunk(chunk: Blob): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.closed) return;

    chunk.arrayBuffer().then((buffer) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.closed) {
        this.ws.send(buffer);
      }
    }).catch(() => {
      // Ignore chunk send errors
    });
  }

  stop(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.closed) {
      this.ws.send(JSON.stringify({ action: 'stop' }));
    }
  }

  close(): void {
    this.closed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }
}
