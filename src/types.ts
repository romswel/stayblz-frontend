export interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string;
  emailVerified?: boolean;
  passwordSetupRequired?: boolean;
  profile?: {firstName: string;lastName: string;country: string;racingRole: string};
}

export interface Message {
  id: string;
  from: string;
  body: string;
  sentAt: string;
  mine: boolean;
}

export interface ConversationPreview {
  id: string;
  title: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export interface Conversation extends ConversationPreview {
  messages: Message[];
}

export interface InventoryItem {
  id: string;
  saddlecloth: number;
  silksColor: string;
  coatColor: string;
  maneColor: string;
  blaze: boolean;
  horseName: string;
  breed: string;
  age: number;
  sex: string;
  status: string;
  stable: string;
  valueUsd: number;
  acquiredAt: string;
}

export interface TrackedHorse {
  id: string;
  saddlecloth: number;
  silksColor: string;
  coatColor: string;
  maneColor: string;
  blaze: boolean;
  name: string;
  breed: string;
  age: number;
  trainer: string;
  jockey: string;
  status: string;
  condition: number;
  form: string;
  lastWorkout: string;
  nextRace: string | null;
  location: string;
}
