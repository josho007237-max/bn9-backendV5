import type {
  ApiError,
  BotConfigResponse,
  BotSettings,
  BotSummary,
  Command,
  QuickReply,
  SystemStatus,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!response.ok) {
    if (contentType?.includes('application/json')) {
      const error = (await response.json()) as ApiError;
      throw new Error(error.error || response.statusText);
    }
    throw new Error(response.statusText);
  }

  if (contentType?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
}

function buildUrl(path: string): string {
  if (API_BASE) {
    return `${API_BASE}${path}`;
  }
  return path;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(buildUrl('/api/system/status'));
  return handleResponse<SystemStatus>(res);
}

export async function fetchBots(): Promise<BotSummary[]> {
  const res = await fetch(buildUrl('/api/bots'));
  const payload = await handleResponse<{ bots: BotSummary[] }>(res);
  return payload.bots;
}

export async function fetchBotConfig(botId: string): Promise<BotConfigResponse> {
  const res = await fetch(buildUrl(`/api/bots/${botId}/config`));
  return handleResponse<BotConfigResponse>(res);
}

export async function createOrUpdateCommand(
  botId: string,
  command: Partial<Command>
): Promise<Command> {
  const method = command.id ? 'PUT' : 'POST';
  const path = command.id
    ? `/api/bots/${botId}/commands/${command.id}`
    : `/api/bots/${botId}/commands`;
  const res = await fetch(buildUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return handleResponse<Command>(res);
}

export async function deleteCommand(botId: string, commandId: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/bots/${botId}/commands/${commandId}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

export async function createOrUpdateQuickReply(
  botId: string,
  quickReply: Partial<QuickReply>
): Promise<QuickReply> {
  const method = quickReply.id ? 'PUT' : 'POST';
  const path = quickReply.id
    ? `/api/bots/${botId}/quick-replies/${quickReply.id}`
    : `/api/bots/${botId}/quick-replies`;
  const res = await fetch(buildUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quickReply),
  });
  return handleResponse<QuickReply>(res);
}

export async function deleteQuickReply(botId: string, quickReplyId: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/bots/${botId}/quick-replies/${quickReplyId}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    await handleResponse(res);
  }
}

export async function updateBotSettings(
  botId: string,
  settings: Partial<BotSettings>
): Promise<BotSettings> {
  const res = await fetch(buildUrl(`/api/bots/${botId}/settings`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return handleResponse<BotSettings>(res);
}
