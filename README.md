# zapo-store-lmdb

Un backend de almacenamiento persistente basado en LMDB (Lightning Memory-Mapped Database) para [`zapo-js`](https://github.com/vinikjkkj/zapo).

## ¿Qué es?

Es un adaptador de base de datos que permite a `zapo-js` guardar toda su información criptográfica (llaves de sesión, tokens de privacidad, estado de la aplicación, etc.) directamente en el disco duro utilizando LMDB en lugar de almacenarlo en la memoria RAM.

## ¿Para qué sirve?

Sirve para mantener sesiones de WhatsApp activas a largo plazo sin consumir la memoria RAM del sistema. Al usar LMDB, la información se mapea en memoria de forma nativa, permitiendo lecturas extremadamente rápidas con un uso de recursos mínimo, lo que es ideal para bots en producción, servidores con memoria limitada o instancias que manejan múltiples sesiones simultáneas.

Admite los 8 dominios criptográficos requeridos por `zapo-js`: Auth, Signal, PreKey, Session, Identity, SenderKey, AppState y PrivacyToken.

## Instalación

Instala el paquete junto con su dependencia `lmdb`:

```bash
pnpm install waltsh/zapo-store-lmdb lmdb
# o usando npm: npm install waltsh/zapo-store-lmdb lmdb
# o usando yarn: yarn add waltsh/zapo-store-lmdb lmdb
```

## ¿Cómo usarlo?

Importa el creador de almacenes e inyéctalo en la configuración inicial de tu cliente `WaClient`.

```javascript
import { WaClient, createStore } from "zapo-js";
import { createLmdbStore } from "zapo-store-lmdb";

// 1. Inicializar el backend de LMDB indicando la ruta del archivo
const lmdbBackend = createLmdbStore({
  path: "./.auth/state.lmdb",
});

// 2. Mapear los proveedores criptográficos para que usen LMDB
const store = createStore({
  backends: {
    lmdb: lmdbBackend,
  },
  providers: {
    auth: "lmdb",
    signal: "lmdb",
    preKey: "lmdb",
    session: "lmdb",
    identity: "lmdb",
    senderKey: "lmdb",
    appState: "lmdb",
    privacyToken: "lmdb",
    // Puedes deshabilitar los que no utilices:
    messages: "none",
    threads: "none",
    contacts: "none",
  },
});

// 3. Iniciar el cliente con el store configurado
const client = new WaClient({ sessionId: "mi-sesion", store });
await client.connect();
```

## Configuración Avanzada

La función `createLmdbStore(options)` acepta los siguientes parámetros opcionales de LMDB:

| Opción       | Tipo      | Por defecto   | Descripción                                                                                                                                                                       |
| ------------ | --------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`       | `string`  | **Requerido** | Ruta del archivo o directorio donde se guardará la base de datos LMDB.                                                                                                            |
| `maxReaders` | `number`  | `126`         | Número máximo de lectores concurrentes permitidos por LMDB.                                                                                                                       |
| `mapSize`    | `number`  | `2147483648`  | Tamaño máximo de la base de datos en bytes (2GB por defecto). El archivo crecerá dinámicamente hasta este límite.                                                                 |
| `noSync`     | `boolean` | `false`       | Si se establece en `true`, omite el vaciado sincrónico al disco, lo cual acelera las escrituras pero conlleva riesgo de corrupción si el sistema operativo falla inesperadamente. |

## Licencia

MIT License
