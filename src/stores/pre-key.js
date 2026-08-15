export class LmdbPreKeyStore {
  constructor(db, sessionId) {
    this.db = db;
    this.prefix = "pk:" + sessionId + ":";
    this.rangeEnd = "pk:" + sessionId + ":\xff";
    this.stateKey = "pkState:" + sessionId;
  }

  _k(id) {
    return this.prefix + id;
  }

  _getState() {
    const state = this.db.get(this.stateKey);
    if (state === undefined) return { nextId: 1, uploadedUntil: 0, serverHas: false };
    // Migrate old format: uploaded[] → uploadedUntil
    if (state.uploadedUntil === undefined) {
      const uploaded = state.uploaded;
      let max = 0;
      if (uploaded) {
        for (let i = 0, len = uploaded.length; i < len; i++) {
          if (uploaded[i] > max) max = uploaded[i];
        }
      }
      state.uploadedUntil = max;
      delete state.uploaded;
    }
    return state;
  }

  async putPreKey(record) {
    const state = this._getState();
    const id = record.keyId;
    if (id >= state.nextId) state.nextId = id + 1;
    await this.db.transaction(() => {
      this.db.putSync(this._k(id), record);
      this.db.putSync(this.stateKey, state);
    });
  }

  async getOrGenPreKeys(count, generator) {
    const state = this._getState();
    const uploadedUntil = state.uploadedUntil;
    const available = [];

    for (const { key, value } of this.db.getRange({ start: this.prefix, end: this.rangeEnd })) {
      const id = parseInt(String(key).slice(this.prefix.length), 10);
      if (id > uploadedUntil && value !== undefined) {
        available.push(value);
        if (available.length >= count) return available;
      }
    }

    const generated = [];
    while (available.length + generated.length < count) {
      const record = await generator(state.nextId++);
      generated.push(record);
    }

    if (generated.length > 0) {
      await this.db.transaction(() => {
        for (let i = 0, len = generated.length; i < len; i++) {
          this.db.putSync(this._k(generated[i].keyId), generated[i]);
        }
        this.db.putSync(this.stateKey, state);
      });
      for (let i = 0, len = generated.length; i < len; i++) {
        available.push(generated[i]);
      }
    }

    return available;
  }

  async getPreKeyById(id) {
    return this.db.get(this._k(id)) ?? null;
  }

  async getPreKeysById(ids) {
    const len = ids.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.get(this._k(ids[i])) ?? null;
    }
    return result;
  }

  async consumePreKeyById(id) {
    const record = this.db.get(this._k(id));
    if (record !== undefined) {
      await this.db.remove(this._k(id));
      return record;
    }
    return null;
  }

  async getOrGenSinglePreKey(gen) {
    return (await this.getOrGenPreKeys(1, gen))[0];
  }

  async markKeyAsUploaded(id) {
    const state = this._getState();
    if (id > state.uploadedUntil) {
      state.uploadedUntil = id;
      await this.db.put(this.stateKey, state);
    }
  }

  async setServerHasPreKeys(val) {
    const state = this._getState();
    state.serverHas = val;
    await this.db.put(this.stateKey, state);
  }

  async getServerHasPreKeys() {
    return this._getState().serverHas;
  }

  async clear() {
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.prefix, end: this.rangeEnd, values: false })) {
        this.db.removeSync(key);
      }
      this.db.removeSync(this.stateKey);
    });
  }
}
