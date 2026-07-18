export type GuessWhoCategorySelection = number | 'random';

export interface GuessWhoCategory {
  characters_count: number;
  id: number;
  name_ar: string;
  name_en: string;
  slug: string;
}

export interface GuessWhoCharacter {
  id: number;
  image_path: string;
  name_ar: string;
}

export type GuessWhoPlayerRole = 'player_1' | 'player_2';
export type GuessWhoRoomStatus = 'ended' | 'lobby' | 'playing' | 'selecting';

export interface GuessWhoCredential {
  credential: string;
  expires_at: string;
  session_id: string;
}

export interface GuessWhoBoundSession extends GuessWhoCredential {
  generation: number;
  role: GuessWhoPlayerRole;
  room_code: string;
}

export interface GuessWhoRoomSnapshot {
  category: {
    characters: readonly GuessWhoCharacter[];
    name_ar: string;
  };
  generation: number;
  role: GuessWhoPlayerRole;
  room_code: string;
  status: GuessWhoRoomStatus;
}

export interface GuessWhoIceServer {
  credential?: string;
  urls: string | readonly string[];
  username?: string;
}

export interface GuessWhoTurnCredentials {
  expires_at: string;
  ice_servers: readonly GuessWhoIceServer[];
}

export interface GuessWhoRealtimeConfig {
  force_tls: boolean;
  host: string;
  key: string;
  ws_port: number;
  wss_port: number;
}

export interface GuessWhoPresenceMember {
  name: string;
  session_id: string;
}

export type GuessWhoSignalType = 'answer' | 'candidate' | 'offer';

export interface GuessWhoSignal {
  data: unknown;
  generation: number;
  sender_session: string;
  target_session: string;
  type: GuessWhoSignalType;
}

export interface GuessWhoSignalRequest {
  data: unknown;
  generation: number;
  target_session: string;
  type: GuessWhoSignalType;
}
