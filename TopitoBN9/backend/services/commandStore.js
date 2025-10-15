const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { z } = require('zod');

const { supabase, isSupabaseEnabled } = require('./supabaseClient');

const DATA_FILE = path.join(__dirname, '../data/bot-config.json');

const commandSchema = z.object({
  id: z.string().uuid().optional(),
  command: z.string().min(1, 'ต้องระบุชื่อคำสั่ง'),
  description: z.string().optional().default(''),
  response: z.string().min(1, 'ต้องระบุข้อความตอบกลับ'),
  buttons: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        type: z.enum(['command', 'url', 'web_app']).default('command'),
        value: z.string().optional().default(''),
      })
    )
    .optional()
    .default([]),
});

const quickReplySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, 'ต้องระบุชื่อหัวข้อ'),
  keyword: z.string().min(1, 'ต้องระบุคำค้นหา'),
  response: z.string().min(1, 'ต้องระบุข้อความตอบกลับ'),
});

const settingsSchema = z.object({
  defaultResponse: z.string().optional().default(''),
  aiPersona: z.string().optional().default(''),
  aiEnabled: z.boolean().optional().default(false),
  aiModel: z.string().optional().default(process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini'),
  aiTemperature: z.number().optional().default(0.2),
  autoKeyboard: z.boolean().optional().default(false),
  autoCommands: z.boolean().optional().default(false),
  miniAppUrl: z.string().optional().default(''),
  webhookUrl: z.string().optional().default(''),
});

const DEFAULT_STATE = {
  bots: {},
};

const COMMAND_TABLE = 'bot_commands';
const QUICK_REPLY_TABLE = 'bot_quick_replies';
const SETTINGS_TABLE = 'bot_settings';

async function ensureStoreReady(botId) {
  if (isSupabaseEnabled) {
    return;
  }

  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf8');
  }

  if (!botId) return;

  const state = await readLocalState();
  if (!state.bots[botId]) {
    state.bots[botId] = createEmptyBot(botId);
    await writeLocalState(state);
  }
}

function createEmptyBot(botId) {
  return {
    id: botId,
    commands: [],
    quickReplies: [],
    settings: settingsSchema.parse({}),
    updatedAt: new Date().toISOString(),
  };
}

async function readLocalState() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      bots: parsed.bots || {},
    };
  } catch (error) {
    return { bots: {} };
  }
}

async function writeLocalState(state) {
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function serialiseCommand(record) {
  if (!record) return null;
  return {
    id: record.id,
    command: record.command,
    description: record.description || '',
    response: record.response,
    buttons: Array.isArray(record.buttons) ? record.buttons : [],
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

function serialiseQuickReply(record) {
  if (!record) return null;
  return {
    id: record.id,
    title: record.title,
    keyword: record.keyword,
    response: record.response,
    createdAt: record.created_at || record.createdAt,
    updatedAt: record.updated_at || record.updatedAt,
  };
}

function serialiseSettings(record) {
  const mapped = {
    defaultResponse:
      record?.defaultResponse !== undefined
        ? record.defaultResponse
        : record?.default_response ?? undefined,
    aiPersona:
      record?.aiPersona !== undefined ? record.aiPersona : record?.ai_persona ?? undefined,
    aiEnabled:
      record?.aiEnabled !== undefined ? record.aiEnabled : record?.ai_enabled ?? undefined,
    aiModel:
      record?.aiModel !== undefined ? record.aiModel : record?.ai_model ?? undefined,
    aiTemperature:
      record?.aiTemperature !== undefined
        ? Number(record.aiTemperature)
        : record?.ai_temperature ?? undefined,
    autoKeyboard:
      record?.autoKeyboard !== undefined
        ? record.autoKeyboard
        : record?.auto_keyboard ?? undefined,
    autoCommands:
      record?.autoCommands !== undefined
        ? record.autoCommands
        : record?.auto_commands ?? undefined,
    miniAppUrl:
      record?.miniAppUrl !== undefined
        ? record.miniAppUrl
        : record?.miniapp_url ?? undefined,
    webhookUrl:
      record?.webhookUrl !== undefined
        ? record.webhookUrl
        : record?.webhook_url ?? undefined,
  };
  const base = settingsSchema.parse(mapped || {});
  return {
    defaultResponse: base.defaultResponse,
    aiPersona: base.aiPersona,
    aiEnabled: base.aiEnabled,
    aiModel: base.aiModel,
    aiTemperature: base.aiTemperature,
    autoKeyboard: base.autoKeyboard,
    autoCommands: base.autoCommands,
    miniAppUrl: base.miniAppUrl,
    webhookUrl: base.webhookUrl,
  };
}

async function getConfig(botId) {
  if (!botId) {
    throw new Error('ต้องระบุรหัสบอท');
  }

  if (isSupabaseEnabled) {
    const [commandRes, quickReplyRes, settingsRes] = await Promise.all([
      supabase
        .from(COMMAND_TABLE)
        .select('*')
        .eq('bot_id', botId)
        .order('command', { ascending: true }),
      supabase
        .from(QUICK_REPLY_TABLE)
        .select('*')
        .eq('bot_id', botId)
        .order('title', { ascending: true }),
      supabase
        .from(SETTINGS_TABLE)
        .select('*')
        .eq('bot_id', botId)
        .maybeSingle(),
    ]);

    if (commandRes.error) throw commandRes.error;
    if (quickReplyRes.error) throw quickReplyRes.error;
    if (settingsRes.error) throw settingsRes.error;

    return {
      commands: (commandRes.data || []).map(serialiseCommand),
      quickReplies: (quickReplyRes.data || []).map(serialiseQuickReply),
      settings: serialiseSettings(settingsRes.data),
    };
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  return {
    commands: bot.commands.map(serialiseCommand),
    quickReplies: bot.quickReplies.map(serialiseQuickReply),
    settings: serialiseSettings(bot.settings),
  };
}

async function saveCommand(botId, payload) {
  const parsed = commandSchema.parse(payload);
  const now = new Date().toISOString();

  if (isSupabaseEnabled) {
    const row = {
      id: parsed.id || randomUUID(),
      bot_id: botId,
      command: parsed.command,
      description: parsed.description,
      response: parsed.response,
      buttons: parsed.buttons,
      updated_at: now,
    };
    if (!parsed.id) {
      row.created_at = now;
      const { data, error } = await supabase
        .from(COMMAND_TABLE)
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return serialiseCommand(data);
    }
    const { data, error } = await supabase
      .from(COMMAND_TABLE)
      .update(row)
      .eq('id', parsed.id)
      .eq('bot_id', botId)
      .select()
      .single();
    if (error) throw error;
    return serialiseCommand(data);
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  let command;
  if (parsed.id) {
    bot.commands = bot.commands.map((item) => {
      if (item.id === parsed.id) {
        command = {
          ...item,
          ...parsed,
          updatedAt: now,
        };
        return command;
      }
      return item;
    });
  } else {
    command = {
      ...parsed,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    bot.commands.push(command);
  }

  bot.updatedAt = now;
  state.bots[botId] = bot;
  await writeLocalState(state);
  return serialiseCommand(command);
}

async function deleteCommand(botId, commandId) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from(COMMAND_TABLE)
      .delete()
      .eq('id', commandId)
      .eq('bot_id', botId);
    if (error) throw error;
    return;
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  bot.commands = bot.commands.filter((command) => command.id !== commandId);
  bot.updatedAt = new Date().toISOString();
  state.bots[botId] = bot;
  await writeLocalState(state);
}

async function saveQuickReply(botId, payload) {
  const parsed = quickReplySchema.parse(payload);
  const now = new Date().toISOString();

  if (isSupabaseEnabled) {
    const row = {
      id: parsed.id || randomUUID(),
      bot_id: botId,
      title: parsed.title,
      keyword: parsed.keyword,
      response: parsed.response,
      updated_at: now,
    };

    if (!parsed.id) {
      row.created_at = now;
      const { data, error } = await supabase
        .from(QUICK_REPLY_TABLE)
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return serialiseQuickReply(data);
    }

    const { data, error } = await supabase
      .from(QUICK_REPLY_TABLE)
      .update(row)
      .eq('id', parsed.id)
      .eq('bot_id', botId)
      .select()
      .single();
    if (error) throw error;
    return serialiseQuickReply(data);
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  let quickReply;
  if (parsed.id) {
    bot.quickReplies = bot.quickReplies.map((item) => {
      if (item.id === parsed.id) {
        quickReply = {
          ...item,
          ...parsed,
          updatedAt: now,
        };
        return quickReply;
      }
      return item;
    });
  } else {
    quickReply = {
      ...parsed,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    bot.quickReplies.push(quickReply);
  }

  bot.updatedAt = now;
  state.bots[botId] = bot;
  await writeLocalState(state);
  return serialiseQuickReply(quickReply);
}

async function deleteQuickReply(botId, quickReplyId) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from(QUICK_REPLY_TABLE)
      .delete()
      .eq('id', quickReplyId)
      .eq('bot_id', botId);
    if (error) throw error;
    return;
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  bot.quickReplies = bot.quickReplies.filter((item) => item.id !== quickReplyId);
  bot.updatedAt = new Date().toISOString();
  state.bots[botId] = bot;
  await writeLocalState(state);
}

async function updateSettings(botId, updates) {
  const parsed = settingsSchema.parse(updates || {});
  const now = new Date().toISOString();

  if (isSupabaseEnabled) {
    const payload = {
      bot_id: botId,
      default_response: parsed.defaultResponse,
      ai_persona: parsed.aiPersona,
      ai_enabled: parsed.aiEnabled,
      ai_model: parsed.aiModel,
      ai_temperature: parsed.aiTemperature,
      auto_keyboard: parsed.autoKeyboard,
      auto_commands: parsed.autoCommands,
      miniapp_url: parsed.miniAppUrl,
      webhook_url: parsed.webhookUrl,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(payload, { onConflict: 'bot_id' })
      .select()
      .single();
    if (error) throw error;
    return serialiseSettings(data);
  }

  await ensureStoreReady(botId);
  const state = await readLocalState();
  const bot = state.bots[botId] || createEmptyBot(botId);
  bot.settings = {
    ...serialiseSettings(bot.settings),
    ...parsed,
  };
  bot.updatedAt = now;
  state.bots[botId] = bot;
  await writeLocalState(state);
  return serialiseSettings(bot.settings);
}

async function listConfigs(botIds = []) {
  if (isSupabaseEnabled) {
    if (!botIds.length) {
      const { data, error } = await supabase.from(SETTINGS_TABLE).select('bot_id');
      if (error) throw error;
      botIds = (data || []).map((item) => item.bot_id);
    }

    const configs = await Promise.all(
      botIds.map(async (botId) => ({ botId, ...(await getConfig(botId)) }))
    );
    return configs;
  }

  const state = await readLocalState();
  const ids = botIds.length ? botIds : Object.keys(state.bots);
  return ids.map((id) => ({ botId: id, ...(state.bots[id] ? {
    commands: state.bots[id].commands.map(serialiseCommand),
    quickReplies: state.bots[id].quickReplies.map(serialiseQuickReply),
    settings: serialiseSettings(state.bots[id].settings),
  } : { commands: [], quickReplies: [], settings: serialiseSettings({}) }) }));
}

module.exports = {
  ensureStoreReady,
  getConfig,
  saveCommand,
  deleteCommand,
  saveQuickReply,
  deleteQuickReply,
  updateSettings,
  listConfigs,
};
