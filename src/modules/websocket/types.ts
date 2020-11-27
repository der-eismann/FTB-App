import { ModalBox } from '@/types';

export interface SocketState {
    firstStart: boolean;
    socket: Socket;
    messages: {[index: string]: (data: any) => void};
    modal: ModalBox | null;
    reconnects: number;
    modProgressCallback: ((data: any) => void) | undefined;
}

export interface Socket {
    isConnected: boolean;
    message: string;
    reconnectError: boolean;
}
