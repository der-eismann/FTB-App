import {SettingsState} from '@/modules/settings/types';
import {RootState} from '@/types';
import {Socket} from '@/modules/websocket/types';
import {createLogger} from '@/core/logger';
// import { MCProtocol } from '@/modules/servers/types';
// import mcQuery from 'mcping-js';

const logger = createLogger("utils/utilities.ts");

export function debounce(func: () => void, wait: number): () => void {
  let timeout: NodeJS.Timeout | undefined;
  return function () {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      func();
    }, wait);
  };
}

export function logVerbose(state: RootState | SettingsState, ...message: any[]) {
  // @ts-ignore
  if (state.settings?.settings === undefined) {
    // @ts-ignore
    if (state.settings?.verbose === true || state.settings?.verbose === 'true') {
      logger.debug("[VERBOSE]", ...message);
    }
  } else {
    // @ts-ignore
    if (state.settings?.settings.verbose === true || state.settings?.settings.verbose === 'true') {
      logger.debug("[VERBOSE]", ...message);
    }
  }
}

export function shortenHash(longHash: string): string {
  return `MT${longHash.substring(0, 28).toUpperCase()}`;
}

export async function waitForWebsockets(websockets: Socket) {
  if (!websockets.isConnected) {
    logger.debug("WS not connected, delaying page load for 100ms")
    await new Promise((resolve) => {
      // Wait for 30 seconds for the websocket to connect
      const timoutRef = setTimeout(() => {
        clearTimeout(timoutRef);
        resolve(null);
      }, 30_000); // 30 seconds
      
      // Check every 100ms if the websocket is connected
      const interval = setInterval(() => {
        if (websockets.isConnected) {
          clearInterval(interval);
          resolve(null);
        }
      }, 100);
    });
  }
}

// TODO: We should just use an api for this. It's simpler. 
// export function queryServer(serverInfo: string): Promise<MCProtocol | undefined> {
//   return new Promise((resolve, reject) => {
//     if (serverInfo.includes(':')) {
//       const address = serverInfo.split(':');
//       const serverIP = address[0];
//       const serverPort = address[1];
//
//       const query = new mcQuery.MinecraftServer(serverIP, serverPort);
//
//       query.ping(5000, (err: any, res: any) => {
//         if (err) {
//           reject(err);
//           return;
//         }
//
//         resolve(res);
//       });
//     } else {
//       const query = new mcQuery.MinecraftServer(serverInfo);
//       query.ping(5000, 5, (err: any, res: any) => {
//         if (err) {
//           reject(err);
//           return;
//         }
//         resolve(res);
//       });
//     }
//   });
// }