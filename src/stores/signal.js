export class LmdbSignalStore {
  constructor(db, sessionId) {
    this.db = db;
    this.kReg = "sig:" + sessionId + ":reg";
    this.kSpk = "sig:" + sessionId + ":spk";
    this.kSpkTs = "sig:" + sessionId + ":spk_ts";
  }

  async getRegistrationInfo() {
    return this.db.get(this.kReg) ?? null;
  }

  async setRegistrationInfo(info) {
    await this.db.put(this.kReg, info);
  }

  async getSignedPreKey() {
    return this.db.get(this.kSpk) ?? null;
  }

  async setSignedPreKey(record) {
    await this.db.put(this.kSpk, record);
  }

  async getSignedPreKeyById(id) {
    const k = this.db.get(this.kSpk);
    return k !== undefined && k.keyId === id ? k : null;
  }

  async setSignedPreKeyRotationTs(ts) {
    await this.db.put(this.kSpkTs, ts);
  }

  async getSignedPreKeyRotationTs() {
    return this.db.get(this.kSpkTs) ?? null;
  }

  async clear() {
    await this.db.transaction(() => {
      this.db.removeSync(this.kReg);
      this.db.removeSync(this.kSpk);
      this.db.removeSync(this.kSpkTs);
    });
  }
}
