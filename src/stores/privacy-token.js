export class LmdbPrivacyTokenStore {
  constructor(db, sessionId) {
    this.db = db;
    this.prefix = "pt:" + sessionId + ":";
    this.rangeEnd = "pt:" + sessionId + ":\xff";
  }

  _k(jid) {
    return this.prefix + jid;
  }

  async upsert(record) {
    await this.db.put(this._k(record.jid), record);
  }

  async upsertBatch(records) {
    await this.db.transaction(() => {
      for (let i = 0, len = records.length; i < len; i++) {
        const r = records[i];
        this.db.putSync(this._k(r.jid), r);
      }
    });
  }

  async getByJid(jid) {
    return this.db.get(this._k(jid)) ?? null;
  }

  async deleteByJid(jid) {
    const key = this._k(jid);
    if (this.db.doesExist(key)) {
      await this.db.remove(key);
      return 1;
    }
    return 0;
  }

  async clear() {
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.prefix, end: this.rangeEnd, values: false })) {
        this.db.removeSync(key);
      }
    });
  }
}
