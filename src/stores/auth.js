export class LmdbAuthStore {
  constructor(db, sessionId) {
    this.db = db;
    this.key = "auth:" + sessionId;
  }

  async load() {
    return this.db.get(this.key) ?? null;
  }

  async save(credentials) {
    await this.db.put(this.key, credentials);
  }

  async clear() {
    await this.db.remove(this.key);
  }
}
