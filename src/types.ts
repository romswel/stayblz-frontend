export interface User {
  id: string;
  username: string;
  displayName: string;
  /** The role in use now (after any "View as" choice): member | admin | superadmin. */
  role: string;
  /** The account's real role. */
  platformRole?: string;
  actingRole?: string | null;
  accountStatus?: string;
  email?: string;
  emailVerified?: boolean;
  passwordSetupRequired?: boolean;
  mfa?: { enabled: boolean; verified: boolean };
  /** 2-step login is on and this session still needs the code. */
  mfaPending?: boolean;
  profile?: {
    firstName: string;
    lastName: string;
    country: string;
    racingRole: string;
  };
}

export interface Message {
  id: string;
  from: string;
  body: string;
  sentAt: string;
  mine: boolean;
}

export interface ConversationPreview {
  canInvite?: boolean;
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
