import {
  RTCPeerConnection,
  type RTCIceCandidate,
} from 'react-native-webrtc';

import type { GuessWhoIceServer } from './types';
import type {
  DataChannelAdapter,
  DataChannelHandlers,
  PeerConnectionAdapter,
  PeerConnectionFactory,
  PeerConnectionHandlers,
  PeerDescription,
  PeerIceCandidate,
} from './peer';

type NativeDataChannel = ReturnType<RTCPeerConnection['createDataChannel']>;
type NativeDataChannelWithHandlers = NativeDataChannel & {
  onclose: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: (() => void) | null;
};
type NativePeerWithHandlers = RTCPeerConnection & {
  onconnectionstatechange: (() => void) | null;
  ondatachannel:
    | ((event: { channel: NativeDataChannel }) => void)
    | null;
  onicecandidate:
    | ((event: { candidate: RTCIceCandidate | null }) => void)
    | null;
};

class NativeDataChannelAdapter implements DataChannelAdapter {
  private handlers: DataChannelHandlers | null = null;

  private readonly nativeChannel: NativeDataChannelWithHandlers;

  constructor(channel: NativeDataChannel) {
    this.nativeChannel = channel as NativeDataChannelWithHandlers;
    this.nativeChannel.onopen = this.handleOpen;
    this.nativeChannel.onclose = this.handleClose;
    this.nativeChannel.onmessage = this.handleMessage;
  }

  readyState(): string {
    return this.nativeChannel.readyState;
  }

  send(message: string): void {
    this.nativeChannel.send(message);
  }

  setHandlers(handlers: DataChannelHandlers): void {
    this.handlers = handlers;
  }

  close(): void {
    this.handlers = null;
    this.nativeChannel.onopen = null;
    this.nativeChannel.onclose = null;
    this.nativeChannel.onmessage = null;
    if (this.nativeChannel.readyState !== 'closed') {
      this.nativeChannel.close();
    }
  }

  private readonly handleOpen = () => this.handlers?.onOpen();
  private readonly handleClose = () => this.handlers?.onClose();
  private readonly handleMessage = (event: { data: unknown }) => {
    if (typeof event.data === 'string') {
      this.handlers?.onMessage(event.data);
    }
  };
}

class NativePeerConnectionAdapter implements PeerConnectionAdapter {
  private handlers: PeerConnectionHandlers | null = null;
  private readonly peer: NativePeerWithHandlers;

  constructor(iceServers: readonly GuessWhoIceServer[]) {
    this.peer = new RTCPeerConnection({
      iceServers: iceServers.map((server) => ({
        ...server,
        urls:
          typeof server.urls === 'string'
            ? server.urls
            : Array.from(server.urls),
      })),
    }) as NativePeerWithHandlers;
    this.peer.onicecandidate = this.handleIceCandidate;
    this.peer.ondatachannel = this.handleDataChannel;
    this.peer.onconnectionstatechange = this.handleConnectionState;
  }

  setHandlers(handlers: PeerConnectionHandlers): void {
    this.handlers = handlers;
  }

  createDataChannel(
    label: string,
    options: { ordered: true },
  ): DataChannelAdapter {
    return new NativeDataChannelAdapter(
      this.peer.createDataChannel(label, options),
    );
  }

  async createOffer(): Promise<PeerDescription> {
    const description = await this.peer.createOffer();
    return { sdp: description.sdp, type: 'offer' };
  }

  async createAnswer(): Promise<PeerDescription> {
    const description = await this.peer.createAnswer();
    return { sdp: description.sdp, type: 'answer' };
  }

  setLocalDescription(description: PeerDescription): Promise<void> {
    return this.peer.setLocalDescription(description);
  }

  setRemoteDescription(description: PeerDescription): Promise<void> {
    return this.peer.setRemoteDescription(description);
  }

  addIceCandidate(candidate: PeerIceCandidate): Promise<void> {
    return this.peer.addIceCandidate(candidate);
  }

  hasRemoteDescription(): boolean {
    return this.peer.remoteDescription !== null;
  }

  close(): void {
    this.handlers = null;
    this.peer.onicecandidate = null;
    this.peer.ondatachannel = null;
    this.peer.onconnectionstatechange = null;
    this.peer.close();
  }

  private readonly handleIceCandidate = (event: {
    candidate: RTCIceCandidate | null;
  }) => {
    if (event.candidate) {
      this.handlers?.onIceCandidate(event.candidate.toJSON());
    }
  };

  private readonly handleDataChannel = (event: {
    channel: NativeDataChannel;
  }) => {
    this.handlers?.onDataChannel(new NativeDataChannelAdapter(event.channel));
  };

  private readonly handleConnectionState = () => {
    this.handlers?.onStateChange(this.peer.connectionState);
  };
}

export const createNativePeerConnection: PeerConnectionFactory = (iceServers) =>
  new NativePeerConnectionAdapter(iceServers);
