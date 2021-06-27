export interface Util {
  openUrl: (e: string) => void;
}

export interface Actions {
  openModpack: (payload: { name: string; id: string }) => void;
  openFriends: () => void;
  openLogin: (cb: (data: any) => void) => void;
}

export interface CB {
  copy: (e: string) => void;
  paste: () => string;
}

export interface Frame {
  close: (windowId: any, onClose: () => void) => void;
  min: (windowId: any) => void;
  max: (windowId: any) => void;
  // Overwolf specific
  handleDrag: (event: any, windowId: any) => void;
  setupTitleBar: (cb: (windowId: any) => void) => void;
}

export interface Config {
  apiURL: string;
  appVersion: string;
  webVersion: string;
  dateCompiled: string;
  javaLicenses: object;
}

export default interface ElectronOverwolfInterface {
  utils: Util;
  actions: Actions;
  cb: CB;
  frame: Frame;
  config: Config;
}
