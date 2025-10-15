export interface BotSummary {
  id: string;
  name: string;
  username?: string | null;
  description?: string | null;
  webhookUrl?: string | null;
  aiPersona?: string | null;
  aiEnabled?: boolean;
  miniAppUrl?: string | null;
  lastSyncedAt?: string | null;
}

export interface CommandButton {
  id?: string;
  label: string;
  type: 'command' | 'url' | 'web_app';
  value?: string;
}

export interface Command {
  id: string;
  command: string;
  description: string;
  response: string;
  buttons: CommandButton[];
  createdAt?: string;
  updatedAt?: string;
}

export interface QuickReply {
  id: string;
  title: string;
  keyword: string;
  response: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BotSettings {
  defaultResponse: string;
  aiPersona: string;
  aiEnabled: boolean;
  aiModel: string;
  aiTemperature: number;
  autoKeyboard: boolean;
  autoCommands: boolean;
  miniAppUrl: string;
  webhookUrl: string;
}

export interface BotConfigResponse {
  commands: Command[];
  quickReplies: QuickReply[];
  settings: BotSettings;
}

export interface SystemStatus {
  bots: {
    count: number;
    items: BotSummary[];
    error: string | null;
  };
  supabase: {
    enabled: boolean;
    connected: boolean;
    error?: string;
  };
  localStore: {
    inUse: boolean;
    ready: boolean;
    error?: string;
  };
  openai: {
    configured: boolean;
    defaultModel: string | null;
    supportedModels: string[];
  };
  environment: {
    domain: string | null;
    miniAppId: string | null;
    webhookDomain: string | null;
    defaultBotId: string | null;
  };
  telegram?: {
    reachable: boolean;
    error?: string;
  };
}

export interface ApiError {
  error: string;
}
