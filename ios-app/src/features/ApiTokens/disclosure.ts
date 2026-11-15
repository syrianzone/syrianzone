import type { IssuedToken } from './model';

/** Memory owned by one account/permission boundary, with no persistence or clipboard writes. */
export class TokenDisclosure {
  private value: IssuedToken | null = null;
  private epoch = 0;
  private closed = false;
  private listeners = new Set<() => void>();
  snapshot = (): IssuedToken | null => this.value;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  mount = (): (() => void) => {
    this.closed = false;
    this.clear();
    return () => this.close();
  };
  begin(): number {
    this.clear();
    return this.epoch;
  }
  offer(epoch: number, value: IssuedToken): boolean {
    if (this.closed || epoch !== this.epoch) return false;
    this.value = value;
    this.notify();
    return true;
  }
  clear(): void {
    this.epoch++;
    this.value = null;
    this.notify();
  }
  close(): void {
    this.closed = true;
    this.clear();
    this.listeners.clear();
  }
  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
