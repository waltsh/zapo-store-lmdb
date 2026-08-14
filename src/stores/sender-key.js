function addressKey(addr) {
  return addr.user + "|" + (addr.server ?? "lid") + "|" + addr.device;
}

export class LmdbSenderKeyStore {
  constructor(db, sessionId) {
    this.db = db;
    this.sId = sessionId;
    this.skPrefix = "sk:" + sessionId + ":";
    this.skdPrefix = "skd:" + sessionId + ":";
  }

  _sk(groupId, addr) {
    return this.skPrefix + groupId + ":" + addressKey(addr);
  }

  _skd(groupId, addr) {
    return this.skdPrefix + groupId + ":" + addressKey(addr);
  }

  async upsertSenderKey(r) {
    await this.db.put(this._sk(r.groupId, r.sender), r);
  }

  async upsertSenderKeyDistribution(r) {
    await this.db.put(this._skd(r.groupId, r.sender), r);
  }

  async upsertSenderKeyDistributions(rs) {
    await this.db.transaction(() => {
      for (let i = 0, len = rs.length; i < len; i++) {
        const r = rs[i];
        this.db.putSync(this._skd(r.groupId, r.sender), r);
      }
    });
  }

  async getGroupSenderKeyList(groupId) {
    const skStart = this.skPrefix + groupId + ":";
    const skEnd = this.skPrefix + groupId + ":\xff";
    const skdStart = this.skdPrefix + groupId + ":";
    const skdEnd = this.skdPrefix + groupId + ":\xff";

    const skList = [];
    for (const { value } of this.db.getRange({ start: skStart, end: skEnd })) {
      skList.push(value);
    }

    const skDistribList = [];
    for (const { value } of this.db.getRange({ start: skdStart, end: skdEnd })) {
      skDistribList.push(value);
    }

    return { skList, skDistribList };
  }

  async getDeviceSenderKey(groupId, sender) {
    return this.db.get(this._sk(groupId, sender)) ?? null;
  }

  async getDeviceSenderKeyDistributions(groupId, senders) {
    const len = senders.length;
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = this.db.get(this._skd(groupId, senders[i])) ?? null;
    }
    return result;
  }

  async deleteDeviceSenderKey(target, groupId = "") {
    let count = 0;
    const targetKey = addressKey(target);
    if (groupId) {
      const key = this._sk(groupId, target);
      if (this.db.doesExist(key)) {
        await this.db.remove(key);
        count = 1;
      }
    } else {
      await this.db.transaction(() => {
        const suffix = ":" + targetKey;
        for (const key of this.db.getRange({ start: this.skPrefix, end: this.skPrefix.slice(0, -1) + "\xff", values: false })) {
          if (String(key).endsWith(suffix)) {
            this.db.removeSync(key);
            count++;
          }
        }
      });
    }
    return count;
  }

  async markForgetSenderKey(groupId, participants) {
    let count = 0;
    await this.db.transaction(() => {
      for (let i = 0, len = participants.length; i < len; i++) {
        const k = this._skd(groupId, participants[i]);
        if (this.db.doesExist(k)) {
          this.db.removeSync(k);
          count++;
        }
      }
    });
    return count;
  }

  async clear() {
    const skEnd = this.skPrefix.slice(0, -1) + "\xff";
    const skdEnd = this.skdPrefix.slice(0, -1) + "\xff";
    await this.db.transaction(() => {
      for (const key of this.db.getRange({ start: this.skPrefix, end: skEnd, values: false })) {
        this.db.removeSync(key);
      }
      for (const key of this.db.getRange({ start: this.skdPrefix, end: skdEnd, values: false })) {
        this.db.removeSync(key);
      }
    });
  }
}
