type WsHandler = (data: unknown) => void;
type QueuedEvent = { event: string; data?: unknown; ts: number };

class AlufWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<WsHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private token: string | null = null;
  private _connected = false;
  private boundVisibility: (() => void) | null = null;
  private boundOnline: (() => void) | null = null;
  private queue: QueuedEvent[] = [];
  private readonly queueKey = 'aluf_ws_queue_v1';
  private readonly maxQueueSize = 500;

  get connected() {
    return this._connected;
  }

  connect(token: string) {
    this.token = token;
    this.reconnectAttempts = 0;
    this.loadQueue();
    this.doConnect();
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners() {
    this.removeLifecycleListeners();

    this.boundVisibility = () => {
      if (document.visibilityState === 'visible' && this.token) {
        if (!this._connected || this.ws?.readyState !== WebSocket.OPEN) {
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.doConnect();
        }
      }
    };

    this.boundOnline = () => {
      if (this.token && (!this._connected || this.ws?.readyState !== WebSocket.OPEN)) {
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.doConnect();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundOnline);
    }
  }

  private removeLifecycleListeners() {
    if (this.boundVisibility && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibility);
    }
    if (this.boundOnline && typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundOnline);
    }
    this.boundVisibility = null;
    this.boundOnline = null;
  }

  private getWsUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (envUrl) return envUrl;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.host}/ws`;
  }

  private doConnect() {
    if (!this.token) return;
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }
    this.ws = new WebSocket(this.getWsUrl());

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectAttempts = 0;
      this.send('authenticate', { token: this.token });
      this.startHeartbeat();
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const eventName = msg.event as string;
        const data = msg.data;
        const handlers = this.handlers.get(eventName);
        if (handlers) {
          handlers.forEach((h) => h(data));
        }
      } catch {}
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ event: 'ping', data: { t: Date.now() } }));
        } catch {
          // ignore
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private loadQueue() {
    if (!this.isBrowser()) return;
    try {
      const raw = localStorage.getItem(this.queueKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as QueuedEvent[];
      if (!Array.isArray(parsed)) return;
      this.queue = parsed.filter((q) => q && typeof q.event === 'string').slice(-this.maxQueueSize);
    } catch {
      this.queue = [];
    }
  }

  private persistQueue() {
    if (!this.isBrowser()) return;
    try {
      localStorage.setItem(this.queueKey, JSON.stringify(this.queue.slice(-this.maxQueueSize)));
    } catch {
      // ignore
    }
  }

  private enqueue(event: string, data?: unknown) {
    this.queue.push({ event, data, ts: Date.now() });
    if (this.queue.length > this.maxQueueSize) {
      this.queue = this.queue.slice(-this.maxQueueSize);
    }
    this.persistQueue();
  }

  private flushQueue() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.queue.length === 0) return;

    const maxAgeMs = 10 * 60 * 1000;
    const now = Date.now();
    const toSend = this.queue.filter((q) => now - q.ts <= maxAgeMs);
    this.queue = [];
    this.persistQueue();

    for (const item of toSend) {
      try {
        this.ws.send(JSON.stringify({ event: item.event, data: item.data }));
      } catch {
        this.enqueue(item.event, item.data);
        break;
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.doConnect();
    }, delay);
  }

  send(event: string, data?: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
      return;
    }
    // Queue only important outgoing events when offline/backgrounded.
    if (event.startsWith('message.') || event === 'typing') {
      this.enqueue(event, data);
    }
  }

  on(event: string, handler: WsHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  disconnect() {
    this.removeLifecycleListeners();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.token = null;
  }
}

export const wsClient = new AlufWebSocket();
