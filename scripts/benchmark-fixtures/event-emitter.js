/**
 * A typed event emitter with once(), off(), and wildcard listeners.
 * Tests need to verify listener lifecycle, ordering, and cleanup.
 */

class TypedEmitter {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.wildcards = [];
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
    return this;
  }

  once(event, fn) {
    if (!this.onceListeners.has(event)) this.onceListeners.set(event, []);
    this.onceListeners.get(event).push(fn);
    return this;
  }

  onAny(fn) {
    this.wildcards.push(fn);
    return this;
  }

  off(event, fn) {
    if (fn === undefined) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      return this;
    }
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }
    return this;
  }

  emit(event, ...args) {
    let count = 0;
    const list = this.listeners.get(event) || [];
    for (const fn of list) {
      fn(...args);
      count++;
    }
    const onceList = this.onceListeners.get(event) || [];
    for (const fn of onceList) {
      fn(...args);
      count++;
    }
    this.onceListeners.delete(event);
    for (const fn of this.wildcards) {
      fn(event, ...args);
      count++;
    }
    return count;
  }

  listenerCount(event) {
    const regular = (this.listeners.get(event) || []).length;
    const once = (this.onceListeners.get(event) || []).length;
    return regular + once;
  }

  removeAllListeners() {
    this.listeners.clear();
    this.onceListeners.clear();
    this.wildcards = [];
    return this;
  }
}

module.exports = { TypedEmitter };
