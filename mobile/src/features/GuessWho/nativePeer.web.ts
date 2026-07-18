import type { PeerConnectionFactory } from './peer';

export const createNativePeerConnection: PeerConnectionFactory = () => {
  throw new Error('Guess Who WebRTC requires the Android or iOS native app.');
};
