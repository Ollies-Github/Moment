import { EventEmitter } from "node:events";

export type EventMap = Record<string, unknown>;

export class TypedEventBus<TEvents extends EventMap> {
  private readonly emitter = new EventEmitter();

  on<TName extends keyof TEvents>(eventName: TName, handler: (payload: TEvents[TName]) => void): () => void {
    const wrapped = (payload: TEvents[TName]) => handler(payload);
    this.emitter.on(String(eventName), wrapped);
    return () => this.emitter.off(String(eventName), wrapped);
  }

  once<TName extends keyof TEvents>(eventName: TName, handler: (payload: TEvents[TName]) => void): () => void {
    const wrapped = (payload: TEvents[TName]) => handler(payload);
    this.emitter.once(String(eventName), wrapped);
    return () => this.emitter.off(String(eventName), wrapped);
  }

  off<TName extends keyof TEvents>(eventName: TName, handler: (payload: TEvents[TName]) => void): void {
    this.emitter.off(String(eventName), handler as (...args: unknown[]) => void);
  }

  emit<TName extends keyof TEvents>(eventName: TName, payload: TEvents[TName]): void {
    this.emitter.emit(String(eventName), payload);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
