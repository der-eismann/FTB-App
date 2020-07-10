import { Friend } from './modules/auth/types';
'use strict';

import {app, protocol, BrowserWindow, remote, shell, ipcMain, dialog, session} from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {createProtocol} from 'vue-cli-plugin-electron-builder/lib';
import * as log from 'electron-log';
import childProcess from 'child_process';
//@ts-ignore
import {Client} from 'irc-framework';
//@ts-ignore
import fetch from 'node-fetch';

Object.assign(console, log.functions);
app.console = log;
const isDevelopment = process.env.NODE_ENV !== 'production';

const userPath = (app || remote.app).getPath('userData');

let win: BrowserWindow | null;
let friendsWindow: BrowserWindow | null;

let mtIRCCLient: Client | null;
declare const __static: string;

protocol.registerSchemesAsPrivileged([{scheme: 'app', privileges: {secure: true, standard: true}}]);

let wsPort: number;
let wsSecret: string;
if (process.argv.indexOf('--ws') !== -1) {
    console.log('We have a --ws');
    const wsArg =  process.argv[process.argv.indexOf('--ws') + 1];
    const wsArgSplit = wsArg.split(':');
    wsPort = Number(wsArgSplit[0]);
    wsSecret = wsArgSplit[1];
} else {
    console.log('Setting default port and secret');
    wsPort = 13377;
    wsSecret = '';
}

export interface MTModpacks {
    [index: string]: string;
}

let authData: any;
let seenModpacks: MTModpacks = {};
let friends: Friend[] = [];

ipcMain.on('sendMeSecret', (event) => {
    event.reply('hereIsSecret', {port: wsPort, secret: wsSecret, isDevMode: process.env.NODE_ENV !== 'production'});
});

ipcMain.on('openOauthWindow', (event, data) => {
    createOauthWindow();
});

ipcMain.on('showFriends', () => {
    createFriendsWindow();
})

ipcMain.on('getFriends', (event) => {
    // If only I had some friends...
    event.reply('ooohFriend', friends);
})

ipcMain.on('checkFriends', async (event) => {
    friends = await getFriends();
    friends.forEach((friend: Friend) => {
        mtIRCCLient.whois(friend.shortHash);
    });
});

ipcMain.on('sendMessage', async (event, data) => {
    if(!mtIRCCLient){
        return;
    }
    let friend: Friend = data.friend;
    let message = data.message;
    mtIRCCLient.say(friend.shortHash, message);
});

async function getMTIRC(){
    return fetch(`https://api.creeper.host/minetogether/chatserver`).then((resp) => resp.json()).then((data) => {
        return {
            host: data.server.address,
            port: data.server.port,
        }
    }).catch((err) => {
        log.error("Failed to get details about MineTogether servers", err);
        return undefined;
    })
}

async function getFriends(): Promise<Friend[]>{
    return fetch(`https://api.creeper.host/minetogether/listfriend`, {headers: {
        'Content-Type': "application/json"
    }, method: "POST", body: JSON.stringify({hash: authData.mc.hash})})
    .then((response: any) => response.json())
    .then(async (data: any) => {
        return data.friends.map((friend: Friend) => {
            let shortHash = `MT${friend.hash.substring(0, 15).toUpperCase()}`
            friend.shortHash = shortHash;
            return friend;
        });
    }).catch((err: any) => {
        log.error("Failed to get details about MineTogether friends", err);
        return [];
    });
}

ipcMain.on('authData', async (event, data) => {
    authData = JSON.parse(data.replace(/(<([^>]+)>)/ig, ''));
    // @ts-ignore
    win.webContents.send('hereAuthData', authData);
    // @ts-ignore
    if(friendsWindow !== undefined && friendsWindow !== null){
        friendsWindow.webContents.send('hereAuthData', authData);
    }
    let mtDetails = await getMTIRC();
    if(mtDetails === undefined){
        log.error("Failed to get details about MineTogether servers");
        return;
    }
    mtIRCCLient = new Client();
    mtIRCCLient.connect({
        host: mtDetails.host,
        port: mtDetails.port,
        nick: authData.mc.mtusername,
    });
    friends = await getFriends();
    friends.forEach((friend: Friend) => {
        mtIRCCLient.whois(friend.shortHash);
    });
    mtIRCCLient.on('whois', async (event: any) => {
        if(event.nick){
            let friend = friends.find((f: Friend) => f.shortHash === event.nick);   
            if(friend === undefined){
                return;
            }
            if(event.error){
                friend.online = false;
            } else {
                friend.online  = true;
                if(event.real_name){
                    let realName = JSON.parse(event.real_name);
                    friend.currentPack = "";
                    if(realName.b){
                        friend.currentPack = realName.b;
                    } else if(realName.p){
                        friend.currentPack = realName.p;
                    }
                    if(friend.currentPack === undefined){
                        return;
                    }
                    if(seenModpacks[friend.currentPack] !== undefined){
                        friend.currentPack = seenModpacks[friend.currentPack];
                    } else {
                        if(!isNaN(parseInt(friend.currentPack, 10))){
                            await fetch(`https://creeperhost.net/json/modpacks/twitch/${friend.currentPack}`).then((resp) => resp.json()).then((data) => {
                                if(data.name){
                                    let fixedString = data.name.replace(/[CurseForge/UNSUPPORTED]/, '');
                                    //@ts-ignore
                                    seenModpacks[friend.currentPack] = fixedString
                                    //@ts-ignore
                                    friend.currentPack = fixedString
                                }
                            });
                        } else if(friend.currentPack.length > 0) {
                            let fixedString = friend.currentPack.replace(/\\u003/, '=');
                            await fetch(`https://creeperhost.net/json/modpacks/modpacksch/${fixedString}`).then((resp) => resp.json()).then((data) => {
                                if(data.name){
                                    //@ts-ignore
                                    seenModpacks[friend.currentPack] = data.name
                                    //@ts-ignore
                                    friend.currentPack = data.name
                                }
                            });
                        }
                    }
                }
            }
            if(win){
                win.webContents.send('ooohFriend', friends);
            }
            if(friendsWindow){
                friendsWindow.webContents.send('ooohFriend', friends);
            }
        }
    });
    mtIRCCLient.on('message', (event: any) => {
        if(event.type === "privmsg"){
            if(friendsWindow){
                let friend = friends.find((f: Friend) => f.shortHash === event.nick);   
                if(friend === undefined){
                    return;
                }
                friendsWindow.webContents.send('newMessage', {from: event.nick, friend: friend, message: event.message, date: new Date().getTime()})
            }
        }
    })
});

ipcMain.on('gimmeAuthData', (event) => {
    if(authData){
        event.reply('hereAuthData', authData);
    }
});

ipcMain.on('expandMeScotty', (event, data) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    if(window){
        let [width, height] = window.getSize();
        if(data.width){
            width = data.width
        }
        if(data.height){
            height = data.height
        }
        window.setSize(width, height);
    }
});


ipcMain.on('selectFolder', async (event, data) => {
    if (win === null) {
        return;
    }
    const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        defaultPath: data,
    });
    if (result.filePaths.length > 0) {
        event.reply('setInstanceFolder', result.filePaths[0]);
    }
});

if (process.argv.indexOf('--pid') === -1) {
    console.log('No backend found, starting our own');
    const ourPID = process.pid;
    console.log('Our PID is', ourPID);
    const currentPath = process.cwd();
    console.log('Current working directory is', currentPath);
    let binaryFile = 'FTBApp';
    const operatingSystem = os.platform();
    if (operatingSystem === 'win32') {
        binaryFile += '.exe';
    }
    binaryFile = path.join(currentPath, '..', binaryFile);
    if (fs.existsSync(binaryFile)) {
        console.log('Starting process of backend', binaryFile);
        const child = childProcess.execFile(binaryFile, ['--pid', ourPID.toString()]);
        child.on('exit', (code, signal) => {
            console.log('child process exited with ' +
            `code ${code} and signal ${signal}`);
        });
        child.on('error', (err) => {
            console.error('Error starting binary', err);
        });
        // @ts-ignore
        child.stdout.on('data', (data) => {
            console.log(`child stdout:\n${data}`);
        });
        // @ts-ignore
        child.stderr.on('data', (data) => {
            console.error(`child stderr:\n${data}`);
        });
    } else {
        console.log('Could not find the binary to launch backend', binaryFile);
    }
}

function createFriendsWindow(){
    if(friendsWindow !== null && friendsWindow !== undefined){
        friendsWindow.focus();
        return;
    }
    friendsWindow = new BrowserWindow({
        title: 'FTB Desktop App',

        // Other
        icon: path.join(__static, 'favicon.ico'),
        // Size Settings
        minWidth: 300,
        minHeight: 626,
        // maxWidth: 1000,
        // maxHeight: 626,
        height: 626,
        width: 300,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#313131', 
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            disableBlinkFeatures: 'Auxclick',
        },
    });

    friendsWindow.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        friendsWindow.loadURL(`${process.env.WEBPACK_DEV_SERVER_URL as string}#chat`);
        if (!process.env.IS_TEST) {
            friendsWindow.webContents.openDevTools();
        }
    } else {
        createProtocol('app');
        friendsWindow.loadURL('app://./index.html#friends');
    }

    friendsWindow.on('closed', () => {
        friendsWindow = null;
    });
}

function createWindow() {

    win = new BrowserWindow({
        title: 'FTB Desktop App',

        // Other
        icon: path.join(__static, 'favicon.ico'),
        // Size Settings
        minWidth: 1000,
        minHeight: 626,
        // maxWidth: 1000,
        // maxHeight: 626,
        height: 626,
        width: 1000,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            disableBlinkFeatures: 'Auxclick',
        },
    });

    win.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        shell.openExternal(url);
    });

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string);
        if (!process.env.IS_TEST) {
            win.webContents.openDevTools();
        }
    } else {
        createProtocol('app');
        win.loadURL('app://./index.html');
    }

    win.on('closed', () => {
        win = null;
    });
    if (process.env.NODE_ENV !== 'production') {
        BrowserWindow.addDevToolsExtension('node_modules/vue-devtools/vender');
    }
}


app.on('window-all-closed', () => {
    // if (process.platform !== 'darwin') {
    app.quit();
    // }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});


app.on('ready', async () => {
    createWindow();
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if(details.url.indexOf('twitch.tv') !== -1){
            if(details.responseHeaders){
                if(details.responseHeaders['Content-Security-Policy'] !== undefined){
                    details.responseHeaders['Content-Security-Policy'] = [];
                }
            }
        }
        callback({ responseHeaders: details.responseHeaders })
    }) 
});

if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit();
            }
        });
    } else {
        process.on('SIGTERM', () => {
            app.quit();
        });
    }
}


// Oauth Window

function createOauthWindow() {
    const window = new BrowserWindow({
        title: 'FTB Desktop App',

        // Other
        icon: path.join(__static, 'favicon.ico'),
        // Size Settings
        minWidth: 0,
        minHeight: 0,
        // maxWidth: 1000,
        // maxHeight: 626,
        height: 800,
        width: 550,
        // frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            disableBlinkFeatures: 'Auxclick',
        },
    });
    // window.setMenu(null);
    window.loadURL('https://auth.modpacks.ch/login');
    window.webContents.on('did-redirect-navigation', async (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
        if (url.startsWith('https://auth.modpacks.ch/auth')) {
            await window.webContents.executeJavaScript(`
                require('electron').ipcRenderer.send('authData', document.body.innerHTML);
            `);
            window.close();
        }
    });
}
