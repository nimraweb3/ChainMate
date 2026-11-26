import { io, type Socket } from 'socket.io-client';
type Listener = (value?: any) => void;
let backend: Promise<boolean> | undefined;
export class Realtime {
  connected = false;
  private listeners = new Map<string, Listener[]>();
  private socket?: Socket;
  private ws?: WebSocket;
  private stopped = false;
  private retry = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private sequence = 0;
  private pending = new Map<number, { callback: Listener; timer: ReturnType<typeof setTimeout> }>();
  private queue?: unknown;
  constructor(private id: string) {
    backend ??= fetch('/api/health')
      .then((r) => r.json())
      .then((j) => j.realtime === 'durable-objects');
    backend
      .then((native) => {
        if (this.stopped) return;
        if (native) this.connect();
        else {
          this.socket = io({ withCredentials: true });
          this.socket.on('connect', () => {
            this.connected = true;
            this.fire('connect');
          });
          this.socket.on('disconnect', () => {
            this.connected = false;
            this.fire('disconnect');
          });
          for (const event of ['game:state', 'match:found', 'connect_error', 'queue:expired'])
            this.socket.on(event, (v) => this.fire(event, v));
        }
      })
      .catch(() => this.fire('connect_error', Error('The game service is unavailable.')));
  }
  on(event: string, fn: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) || []), fn]);
    return this;
  }
  private fire(event: string, value?: unknown) {
    for (const fn of this.listeners.get(event) || []) fn(value);
  }
  private connect() {
    const url = new URL('/api/realtime/' + encodeURIComponent(this.id), location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.fire('connect');
      if (this.queue) this.emit('queue:join', this.queue);
    };
    ws.onmessage = (e) => {
      try {
        const p = JSON.parse(e.data);
        if (p.ack) {
          const waiting = this.pending.get(p.ack);
          if (waiting) {
            clearTimeout(waiting.timer);
            this.pending.delete(p.ack);
            waiting.callback(p);
          }
        } else {
          if (p.event === 'match:found' || p.event === 'queue:expired') this.queue = undefined;
          this.fire(p.event, p.value);
        }
      } catch {
        this.fire('connect_error', Error('Invalid server response.'));
      }
    };
    ws.onerror = () => this.fire('connect_error', Error('Connection interrupted. Reconnecting…'));
    ws.onclose = () => {
      this.connected = false;
      this.fire('disconnect');
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.callback({
          ok: false,
          error: 'Connection interrupted. Wait for the current position before retrying.',
        });
      }
      this.pending.clear();
      if (!this.stopped)
        this.timer = setTimeout(() => this.connect(), Math.min(8000, 1000 * 2 ** this.retry++));
    };
  }
  emit(event: string, payload: unknown = {}, callback: Listener = () => {}) {
    if (this.socket) {
      this.socket.emit(event, payload, callback);
      return this;
    }
    if (event === 'queue:join') this.queue = payload;
    if (event === 'queue:leave') this.queue = undefined;
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      callback({ ok: false, error: 'Reconnecting. Please try again shortly.' });
      return this;
    }
    const id = ++this.sequence;
    const timer = setTimeout(() => {
      this.pending.delete(id);
      callback({
        ok: false,
        error: 'Confirmation timed out. Reconnect to check the current position.',
      });
    }, 10000);
    this.pending.set(id, { callback, timer });
    this.ws.send(JSON.stringify({ id, event, payload }));
    return this;
  }
  disconnect() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.socket?.disconnect();
    this.ws?.close();
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    this.connected = false;
  }
}
export const realtime = (id: string) => new Realtime(id);
