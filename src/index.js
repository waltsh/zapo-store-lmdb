import { open } from "lmdb";
import { LmdbAuthStore } from "./stores/auth.js";
import { LmdbSignalStore } from "./stores/signal.js";
import { LmdbPreKeyStore } from "./stores/pre-key.js";
import { LmdbSessionStore } from "./stores/session.js";
import { LmdbIdentityStore } from "./stores/identity.js";
import { LmdbSenderKeyStore } from "./stores/sender-key.js";
import { LmdbAppStateStore } from "./stores/app-state.js";
import { LmdbPrivacyTokenStore } from "./stores/privacy-token.js";

export function createLmdbStore({
  path,
  maxReaders = 126,
  mapSize = 2147483648,
  noSync = false,
  compression = false,
}) {
  const db = open({
    path,
    maxReaders,
    mapSize,
    noSync,
    noMetaSync: true,
    compression,
    commitDelay: 0,
  });

  const storeCache = new Map();

  function getOrCreate(prefix, sessionId, Factory) {
    const cacheKey = prefix + sessionId;
    let store = storeCache.get(cacheKey);
    if (store === undefined) {
      store = new Factory(db, sessionId);
      storeCache.set(cacheKey, store);
    }
    return store;
  }

  const PREFIXES = ["a", "s", "p", "e", "i", "k", "t", "v"];

  return {
    stores: {
      auth: (sessionId) => getOrCreate("a", sessionId, LmdbAuthStore),
      signal: (sessionId) => getOrCreate("s", sessionId, LmdbSignalStore),
      preKey: (sessionId) => getOrCreate("p", sessionId, LmdbPreKeyStore),
      session: (sessionId) => getOrCreate("e", sessionId, LmdbSessionStore),
      identity: (sessionId) => getOrCreate("i", sessionId, LmdbIdentityStore),
      senderKey: (sessionId) => getOrCreate("k", sessionId, LmdbSenderKeyStore),
      appState: (sessionId) => getOrCreate("t", sessionId, LmdbAppStateStore),
      privacyToken: (sessionId) => getOrCreate("v", sessionId, LmdbPrivacyTokenStore),
    },
    caches: {},
    releaseSession(sessionId) {
      for (let i = 0; i < PREFIXES.length; i++) {
        storeCache.delete(PREFIXES[i] + sessionId);
      }
    },
    releaseAllSessions() {
      storeCache.clear();
    },
    destroy: () => {
      storeCache.clear();
      db.close();
    },
  };
}
