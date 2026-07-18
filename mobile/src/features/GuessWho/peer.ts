import { Base64 } from 'js-base64';

import type {
  GuessWhoIceServer,
  GuessWhoSignal,
  GuessWhoSignalRequest,
} from './types';

export interface PeerDescription {
  sdp: string;
  type: 'answer' | 'offer';
}

export interface PeerIceCandidate {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
}

export interface DataChannelAdapter {
  close: () => void;
  readyState: () => string;
  send: (message: string) => void;
  setHandlers: (handlers: DataChannelHandlers) => void;
}

export interface DataChannelHandlers {
  onClose: () => void;
  onMessage: (message: string) => void;
  onOpen: () => void;
}

export interface PeerConnectionAdapter {
  addIceCandidate: (candidate: PeerIceCandidate) => Promise<void>;
  close: () => void;
  createAnswer: () => Promise<PeerDescription>;
  createDataChannel: (
    label: string,
    options: { ordered: true },
  ) => DataChannelAdapter;
  createOffer: () => Promise<PeerDescription>;
  hasRemoteDescription: () => boolean;
  setHandlers: (handlers: PeerConnectionHandlers) => void;
  setLocalDescription: (description: PeerDescription) => Promise<void>;
  setRemoteDescription: (description: PeerDescription) => Promise<void>;
}

export interface PeerConnectionHandlers {
  onDataChannel: (channel: DataChannelAdapter) => void;
  onIceCandidate: (candidate: PeerIceCandidate) => void;
  onStateChange: (state: string) => void;
}

export type PeerConnectionFactory = (
  iceServers: readonly GuessWhoIceServer[],
) => PeerConnectionAdapter;

export interface GuessWhoPeerCallbacks {
  onChannelClose: () => void;
  onChannelOpen: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
  onStateChange: (state: string) => void;
}

interface GuessWhoPeerDependencies {
  callbacks: GuessWhoPeerCallbacks;
  createPeerConnection: PeerConnectionFactory;
  getIceServers: () => Promise<readonly GuessWhoIceServer[]>;
  sendSignal: (signal: GuessWhoSignalRequest) => Promise<void>;
}

interface EncodedDescription {
  sdp: string;
  type: 'answer' | 'offer';
}

function encodeDescription(description: PeerDescription): EncodedDescription {
  return {
    sdp: Base64.encode(description.sdp),
    type: description.type,
  };
}

export function decodeDescription(value: unknown): PeerDescription | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('type' in value) ||
    (value.type !== 'offer' && value.type !== 'answer') ||
    !('sdp' in value) ||
    typeof value.sdp !== 'string'
  ) {
    return null;
  }
  try {
    const sdp = Base64.decode(value.sdp);
    return sdp ? { sdp, type: value.type } : null;
  } catch {
    return null;
  }
}

export function parseIceCandidate(value: unknown): PeerIceCandidate | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('candidate' in value) ||
    typeof value.candidate !== 'string'
  ) {
    return null;
  }
  const sdpMid =
    'sdpMid' in value &&
    (typeof value.sdpMid === 'string' || value.sdpMid === null)
      ? value.sdpMid
      : undefined;
  const sdpMLineIndex =
    'sdpMLineIndex' in value &&
    (typeof value.sdpMLineIndex === 'number' ||
      value.sdpMLineIndex === null)
      ? value.sdpMLineIndex
      : undefined;
  return { candidate: value.candidate, sdpMLineIndex, sdpMid };
}

export class GuessWhoPeer {
  private channel: DataChannelAdapter | null = null;
  private currentGeneration = 0;
  private disposed = false;
  private operation = 0;
  private peer: PeerConnectionAdapter | null = null;
  private readonly queuedCandidates = new Map<number, PeerIceCandidate[]>();
  private targetSession: string | null = null;

  constructor(private readonly dependencies: GuessWhoPeerDependencies) {}

  get generation(): number {
    return this.currentGeneration;
  }

  get isOpen(): boolean {
    return this.channel?.readyState() === 'open';
  }

  async beginOffer(targetSession: string, generation: number): Promise<void> {
    if (this.disposed || generation <= this.currentGeneration) {
      return;
    }
    this.currentGeneration = generation;
    this.targetSession = targetSession;
    const operation = this.replaceConnection();
    const peer = await this.createConnection(operation, generation);
    if (!peer) {
      return;
    }
    const channel = peer.createDataChannel('game_sync', { ordered: true });
    this.attachChannel(channel);
    const offer = await peer.createOffer();
    if (!this.isCurrent(operation, generation, peer)) {
      return;
    }
    await peer.setLocalDescription(offer);
    if (!this.isCurrent(operation, generation, peer)) {
      return;
    }
    await this.dependencies.sendSignal({
      data: encodeDescription(offer),
      generation,
      target_session: targetSession,
      type: 'offer',
    });
  }

  async handleSignal(signal: GuessWhoSignal): Promise<void> {
    if (this.disposed || signal.generation < this.currentGeneration) {
      return;
    }
    if (signal.type === 'candidate') {
      await this.handleCandidate(signal);
      return;
    }
    const description = decodeDescription(signal.data);
    if (!description || description.type !== signal.type) {
      this.dependencies.callbacks.onError('تعذر قراءة إشارة الاتصال.');
      return;
    }
    if (signal.type === 'offer') {
      await this.handleOffer(signal, description);
      return;
    }
    await this.handleAnswer(signal, description);
  }

  send(message: string): boolean {
    if (!this.isOpen || !this.channel) {
      return false;
    }
    this.channel.send(message);
    return true;
  }

  disconnect(): void {
    if (this.disposed) {
      return;
    }
    this.operation += 1;
    this.closeTransport();
    this.queuedCandidates.clear();
  }

  close(): void {
    this.disposed = true;
    this.operation += 1;
    this.closeTransport();
    this.queuedCandidates.clear();
  }

  private async handleOffer(
    signal: GuessWhoSignal,
    description: PeerDescription,
  ): Promise<void> {
    if (
      signal.generation === this.currentGeneration &&
      this.peer !== null
    ) {
      return;
    }
    this.currentGeneration = signal.generation;
    this.targetSession = signal.sender_session;
    const operation = this.replaceConnection();
    const peer = await this.createConnection(operation, signal.generation);
    if (!peer) {
      return;
    }
    await peer.setRemoteDescription(description);
    await this.drainCandidates(signal.generation, peer);
    if (!this.isCurrent(operation, signal.generation, peer)) {
      return;
    }
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    if (!this.isCurrent(operation, signal.generation, peer)) {
      return;
    }
    await this.dependencies.sendSignal({
      data: encodeDescription(answer),
      generation: signal.generation,
      target_session: signal.sender_session,
      type: 'answer',
    });
  }

  private async handleAnswer(
    signal: GuessWhoSignal,
    description: PeerDescription,
  ): Promise<void> {
    if (
      signal.generation !== this.currentGeneration ||
      !this.peer ||
      signal.sender_session !== this.targetSession
    ) {
      return;
    }
    await this.peer.setRemoteDescription(description);
    await this.drainCandidates(signal.generation, this.peer);
  }

  private async handleCandidate(signal: GuessWhoSignal): Promise<void> {
    const candidate = parseIceCandidate(signal.data);
    if (!candidate) {
      this.dependencies.callbacks.onError('تعذر قراءة مرشح الاتصال.');
      return;
    }
    if (
      signal.generation !== this.currentGeneration ||
      !this.peer ||
      !this.peer.hasRemoteDescription()
    ) {
      const queued = this.queuedCandidates.get(signal.generation) ?? [];
      if (queued.length >= 64) {
        return;
      }
      queued.push(candidate);
      this.queuedCandidates.set(signal.generation, queued);
      while (this.queuedCandidates.size > 2) {
        const oldest = [...this.queuedCandidates.keys()].sort(
          (left, right) => left - right,
        )[0];
        if (oldest === undefined) {
          break;
        }
        this.queuedCandidates.delete(oldest);
      }
      return;
    }
    await this.peer.addIceCandidate(candidate);
  }

  private replaceConnection(): number {
    this.operation += 1;
    this.closeTransport();
    for (const generation of this.queuedCandidates.keys()) {
      if (generation < this.currentGeneration) {
        this.queuedCandidates.delete(generation);
      }
    }
    return this.operation;
  }

  private async createConnection(
    operation: number,
    generation: number,
  ): Promise<PeerConnectionAdapter | null> {
    try {
      const iceServers = await this.dependencies.getIceServers();
      if (this.disposed || operation !== this.operation) {
        return null;
      }
      const peer = this.dependencies.createPeerConnection(iceServers);
      this.peer = peer;
      peer.setHandlers({
        onDataChannel: (channel) => {
          if (this.isCurrent(operation, generation, peer)) {
            this.attachChannel(channel);
          } else {
            channel.close();
          }
        },
        onIceCandidate: (candidate) => {
          if (!this.isCurrent(operation, generation, peer) || !this.targetSession) {
            return;
          }
          void this.dependencies
            .sendSignal({
              data: candidate,
              generation,
              target_session: this.targetSession,
              type: 'candidate',
            })
            .catch(() => {
              this.dependencies.callbacks.onError(
                'تعذر إرسال معلومات الاتصال المباشر.',
              );
            });
        },
        onStateChange: (state) => {
          if (this.isCurrent(operation, generation, peer)) {
            this.dependencies.callbacks.onStateChange(state);
          }
        },
      });
      return peer;
    } catch {
      this.dependencies.callbacks.onError('تعذر إعداد الاتصال المباشر.');
      return null;
    }
  }

  private attachChannel(channel: DataChannelAdapter): void {
    this.channel?.close();
    this.channel = channel;
    channel.setHandlers({
      onClose: () => {
        if (this.channel === channel) {
          this.dependencies.callbacks.onChannelClose();
        }
      },
      onMessage: (message) => {
        if (this.channel === channel) {
          this.dependencies.callbacks.onMessage(message);
        }
      },
      onOpen: () => {
        if (this.channel === channel) {
          this.dependencies.callbacks.onChannelOpen();
        }
      },
    });
  }

  private async drainCandidates(
    generation: number,
    peer: PeerConnectionAdapter,
  ): Promise<void> {
    const queued = this.queuedCandidates.get(generation) ?? [];
    this.queuedCandidates.delete(generation);
    for (const candidate of queued) {
      if (peer !== this.peer) {
        return;
      }
      await peer.addIceCandidate(candidate);
    }
  }

  private isCurrent(
    operation: number,
    generation: number,
    peer: PeerConnectionAdapter,
  ): boolean {
    return (
      !this.disposed &&
      operation === this.operation &&
      generation === this.currentGeneration &&
      peer === this.peer
    );
  }

  private closeTransport(): void {
    const channel = this.channel;
    const peer = this.peer;
    this.channel = null;
    this.peer = null;
    channel?.close();
    peer?.close();
  }
}
