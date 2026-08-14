function addressKey(addr) {
  return addr.user + "|" + (addr.server ?? "lid") + "|" + addr.device;
}

export class LmdbIdentityStore {
  constructor(db, sessionId) {
    this.db = db;
    this.prefix = "id:" + sessionId + ":";
    this.rangeEnd = "id:" + sessionId + ":\xff";
  }

  _k(addr) {
    return this.prefix + addressKey(addr);
  }

  async getRemoteIdentity(addr) {
    return this.db.get(this._k(addr)) ?? null;
  }

  async getRemoteIdentities(addrs) {
    const len = addrs.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.get(this._k(addrs[i])) ?? null;
    }
    return result;
  }

  async setRemoteIdentity(addr, key) {
    await this.db.put(this._k(addr), key);
  }

  async setRemoteIdentities(entries) {
    await this.db.transaction(() => {
      for (let i = 0, len = entries.length; i < len; i++) {
        const e = entries[i];
        this.db.putSync(this._k(e.address), e.identityKey);
      }
    });
  }

  async clear() {
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.prefix, end: this.rangeEnd, values: false })) {
        this.db.removeSync(key);
      }
    });
  }
}
