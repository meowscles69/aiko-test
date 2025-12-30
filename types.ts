
export interface Message {
  id: string;
  role: 'user' | 'aiko';
  content: string;
  timestamp: number;
  audioUrl?: string;
  imageUrl?: string;
  isImageRequest?: boolean;
}

export interface AikoConfig {
  personality: 'playful-aiko';
  voiceEnabled: boolean;
}

export enum AppStatus {
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  ONLINE = 'online',
  ERROR = 'error'
}

export interface AikoSession {
  isFocused: boolean;
  interactionCount: number;
  lastActive: number;
}
