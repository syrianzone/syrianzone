import { Base64 } from 'js-base64';

import {
  GuessWhoPeer,
  decodeDescription,
  type DataChannelAdapter,
  type DataChannelHandlers,
  type PeerConnectionAdapter,
  type PeerConnectionHandlers,
  type PeerDescription,
  type PeerIceCandidate,
} from './peer';
import type { GuessWhoSignal, GuessWhoSignalRequest } from './types';

class FakeChannel implements DataChannelAdapter {
  closed = false;
  handlers: DataChannelHandlers | null = null;
  messages: string[] = [];
  state = 'connecting';

  close(): void {
    this.closed = true;
    this.state = 'closed';
  }

  readyState(): string {
    return this.state;
  }

  send(message: string): void {
    this.messages.push(message);
  }

  setHandlers(handlers: DataChannelHandlers): void {
    this.handlers = handlers;
  }

  open(): void {
    this.state = 'open';
    this.handlers?.onOpen();
  }
}

class FakePeer implements PeerConnectionAdapter {
  addedCandidates: PeerIceCandidate[] = [];
  channel = new FakeChannel();
  closed = false;
  dataChannelRequest: { label: string; options: { ordered: true } } | null = null;
  handlers: PeerConnectionHandlers | null = null;
  localDescriptions: PeerDescription[] = [];
  remoteDescriptions: PeerDescription[] = [];

  async addIceCandidate(candidate: PeerIceCandidate): Promise<void> {
    this.addedCandidates.push(candidate);
  }

  close(): void {
    this.closed = true;
  }

  async createAnswer(): Promise<PeerDescription> {
    return { sdp: 'v=0\r\na=answer:نعم', type: 'answer' };
  }

  createDataChannel(
    label: string,
    options: { ordered: true },
  ): DataChannelAdapter {
    this.dataChannelRequest = { label, options };
    return this.channel;
  }

  async createOffer(): Promise<PeerDescription> {
    return { sdp: 'v=0\r\na=offer:مرحبا', type: 'offer' };
  }

  hasRemoteDescription(): boolean {
    return this.remoteDescriptions.length > 0;
  }

  setHandlers(handlers: PeerConnectionHandlers): void {
    this.handlers = handlers;
  }

  async setLocalDescription(description: PeerDescription): Promise<void> {
    this.localDescriptions.push(description);
  }

  async setRemoteDescription(description: PeerDescription): Promise<void> {
    this.remoteDescriptions.push(description);
  }
}

function signal(
  type: GuessWhoSignal['type'],
  generation: number,
  data: unknown,
): GuessWhoSignal {
  return {
    data,
    generation,
    sender_session: 'public-session-2',
    target_session: 'public-session-1',
    type,
  };
}

function createHarness() {
  const peers: FakePeer[] = [];
  const signals: GuessWhoSignalRequest[] = [];
  const errors: string[] = [];
  const channelMessages: string[] = [];
  const peer = new GuessWhoPeer({
    callbacks: {
      onChannelClose: jest.fn(),
      onChannelOpen: jest.fn(),
      onError: (message) => errors.push(message),
      onMessage: (message) => channelMessages.push(message),
      onStateChange: jest.fn(),
    },
    createPeerConnection: () => {
      const created = new FakePeer();
      peers.push(created);
      return created;
    },
    getIceServers: async () => [
      {
        credential: 'short-secret',
        urls: 'turns:turn.example.test:443',
        username: 'short-user',
      },
    ],
    sendSignal: async (outbound) => {
      signals.push(outbound);
    },
  });
  return { channelMessages, errors, peer, peers, signals };
}

describe('Guess Who data-only WebRTC negotiation', () => {
  test('encodes UTF-8 SDP and creates an ordered reliable channel', async () => {
    const harness = createHarness();
    await harness.peer.beginOffer('public-session-2', 4);

    expect(harness.peers).toHaveLength(1);
    expect(harness.peers[0]?.dataChannelRequest).toEqual({
      label: 'game_sync',
      options: { ordered: true },
    });
    expect(harness.peers[0]?.localDescriptions[0]).toEqual({
      sdp: 'v=0\r\na=offer:مرحبا',
      type: 'offer',
    });
    expect(harness.signals[0]).toMatchObject({
      generation: 4,
      target_session: 'public-session-2',
      type: 'offer',
    });
    expect(decodeDescription(harness.signals[0]?.data)).toEqual({
      sdp: 'v=0\r\na=offer:مرحبا',
      type: 'offer',
    });
    expect(JSON.stringify(harness.signals[0]?.data)).not.toContain('مرحبا');
  });

  test('queues early ICE, drains it after the offer, and answers once', async () => {
    const harness = createHarness();
    const candidate = {
      candidate: 'candidate:1 1 udp 1 192.0.2.1 4000 typ host',
      sdpMLineIndex: 0,
      sdpMid: '0',
    };
    await harness.peer.handleSignal(signal('candidate', 6, candidate));
    await harness.peer.handleSignal(
      signal('offer', 6, {
        sdp: Base64.encode('v=0\r\na=offer:peer'),
        type: 'offer',
      }),
    );

    expect(harness.peers).toHaveLength(1);
    expect(harness.peers[0]?.addedCandidates).toEqual([candidate]);
    expect(harness.signals).toHaveLength(1);
    expect(harness.signals[0]).toMatchObject({
      generation: 6,
      target_session: 'public-session-2',
      type: 'answer',
    });

    await harness.peer.handleSignal(
      signal('offer', 6, {
        sdp: Base64.encode('duplicate'),
        type: 'offer',
      }),
    );
    expect(harness.peers).toHaveLength(1);
    expect(harness.signals).toHaveLength(1);
  });

  test('ignores stale generations and closes every transport handler', async () => {
    const harness = createHarness();
    await harness.peer.beginOffer('public-session-2', 8);
    await harness.peer.handleSignal(
      signal('answer', 7, {
        sdp: Base64.encode('stale-answer'),
        type: 'answer',
      }),
    );
    expect(harness.peers[0]?.remoteDescriptions).toEqual([]);

    const channel = harness.peers[0]?.channel;
    channel?.open();
    expect(harness.peer.send('{"action":"pass_turn","payload":{}}')).toBe(true);
    harness.peer.close();

    expect(channel?.closed).toBe(true);
    expect(harness.peers[0]?.closed).toBe(true);
    expect(harness.peer.send('late')).toBe(false);
    await harness.peer.beginOffer('public-session-2', 9);
    expect(harness.peers).toHaveLength(1);
  });

  test('rejects malformed SDP and candidates without leaking their payload', async () => {
    const harness = createHarness();
    await harness.peer.handleSignal(
      signal('offer', 2, { sdp: '%%%', type: 'offer' }),
    );
    await harness.peer.handleSignal(signal('candidate', 2, { token: 'secret' }));

    expect(harness.errors).toEqual([
      'تعذر قراءة إشارة الاتصال.',
      'تعذر قراءة مرشح الاتصال.',
    ]);
    expect(harness.peers).toEqual([]);
  });
});
