const APP_STATE_EMPTY_LT_HASH = new Uint8Array(128);

function toHex(buf) {
  return Buffer.from(buf).toString("hex");
}

function keyEpoch(keyId) {
  return keyId.byteLength < 6
    ? -1
    : keyId[2] * 16777216 + keyId[3] * 65536 + keyId[4] * 256 + keyId[5];
}

function keyDeviceId(keyId) {
  return keyId.byteLength < 6 ? null : (keyId[0] << 8) | keyId[1];
}



export class LmdbAppStateStore {
  constructor(db, sessionId) {
    this.db = db;
    this.keyPrefix = "appKey:" + sessionId + ":";
    this.keyRangeEnd = "appKey:" + sessionId + ":\xff";
    this.colPrefix = "appCol:" + sessionId + ":";
    this.colRangeEnd = "appCol:" + sessionId + ":\xff";
  }

  _kK(idHex) {
    return this.keyPrefix + idHex;
  }

  _cK(name) {
    return this.colPrefix + name;
  }

  async exportData() {
    return { keys: [], collections: {} };
  }

  async upsertSyncKeys(keys) {
    let inserted = 0;
    await this.db.transaction(() => {
      for (let i = 0, len = keys.length; i < len; i++) {
        const k = keys[i];
        this.db.putSync(this._kK(toHex(k.keyId)), k);
        inserted++;
      }
    });
    return inserted;
  }

  async getSyncKeysBatch(keyIds) {
    const len = keyIds.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.get(this._kK(toHex(keyIds[i]))) ?? null;
    }
    return result;
  }

  async getSyncKeyData(keyId) {
    const k = this.db.get(this._kK(toHex(keyId)));
    return k !== undefined ? k.keyData : null;
  }

  async getSyncKeyDataBatch(keyIds) {
    const len = keyIds.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      const k = this.db.get(this._kK(toHex(keyIds[i])));
      result[i] = k !== undefined ? k.keyData : null;
    }
    return result;
  }

  async getActiveSyncKey() {
    let active = null;
    let activeEpoch = -2;
    let activeDeviceId = null;

    for (const { value } of this.db.getRange({ start: this.keyPrefix, end: this.keyRangeEnd })) {
      const key = value;
      if (active === null) {
        active = key;
        activeEpoch = keyEpoch(key.keyId);
        activeDeviceId = keyDeviceId(key.keyId);
        continue;
      }
      const nextEpoch = keyEpoch(key.keyId);
      if (nextEpoch > activeEpoch) {
        active = key;
        activeEpoch = nextEpoch;
        activeDeviceId = keyDeviceId(key.keyId);
        continue;
      }
      if (nextEpoch < activeEpoch) continue;
      const nextDeviceId = keyDeviceId(key.keyId);
      if (nextDeviceId !== null && activeDeviceId !== null && nextDeviceId < activeDeviceId) {
        active = key;
        activeEpoch = nextEpoch;
        activeDeviceId = nextDeviceId;
      }
    }
    return active;
  }

  async getCollectionState(collection) {
    const state = this.db.get(this._cK(collection));
    if (state !== undefined) {
      const raw = state.indexValueMap;
      const indexValueMap = new Map();
      if (raw) {
        const entries = Object.keys(raw);
        for (let i = 0, len = entries.length; i < len; i++) {
          const k = entries[i];
          indexValueMap.set(k, Buffer.from(raw[k]));
        }
      }
      return {
        initialized: state.initialized,
        version: state.version,
        hash: state.hash,
        indexValueMap,
      };
    }
    return {
      initialized: false,
      version: 0,
      hash: APP_STATE_EMPTY_LT_HASH,
      indexValueMap: new Map(),
    };
  }

  async getCollectionStates(collections) {
    const len = collections.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = await this.getCollectionState(collections[i]);
    }
    return result;
  }

  async setCollectionStates(updates) {
    await this.db.transaction(() => {
      for (let i = 0, len = updates.length; i < len; i++) {
        const update = updates[i];
        const indexValueMap = {};
        for (const [k, v] of update.indexValueMap.entries()) {
          indexValueMap[k] = v;
        }
        this.db.putSync(this._cK(update.collection), {
          initialized: true,
          version: update.version,
          hash: update.hash,
          indexValueMap,
        });
      }
    });
  }

  async clear() {
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.keyPrefix, end: this.keyRangeEnd, values: false })) {
        this.db.removeSync(key);
      }
      for (const key of this.db.getRange({ start: this.colPrefix, end: this.colRangeEnd, values: false })) {
        this.db.removeSync(key);
      }
    });
  }
}
