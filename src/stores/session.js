function addressKey(addr) {
  return addr.user + "|" + (addr.server ?? "lid") + "|" + addr.device;
}

export class LmdbSessionStore {
  constructor(db, sessionId) {
    this.db = db;
    this.prefix = "sess:" + sessionId + ":";
    this.rangeEnd = "sess:" + sessionId + ":\xff";
  }

  _k(addr) {
    return this.prefix + addressKey(addr);
  }

  async hasSession(addr) {
    return this.db.doesExist(this._k(addr));
  }

  async hasSessions(addrs) {
    const len = addrs.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.doesExist(this._k(addrs[i]));
    }
    return result;
  }

  async getSession(addr) {
    return this.db.get(this._k(addr)) ?? null;
  }

  async getSessionsBatch(addrs) {
    const len = addrs.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.get(this._k(addrs[i])) ?? null;
    }
    return result;
  }

  async setSession(addr, session) {
    await this.db.put(this._k(addr), session);
  }

  async setSessionsBatch(entries) {
    await this.db.transaction(() => {
      for (let i = 0, len = entries.length; i < len; i++) {
        const e = entries[i];
        this.db.putSync(this._k(e.address), e.session);
      }
    });
  }

  async deleteSession(addr) {
    await this.db.remove(this._k(addr));
  }

  async clear() {
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.prefix, end: this.rangeEnd, values: false })) {
        this.db.removeSync(key);
      }
    });
  }
}
