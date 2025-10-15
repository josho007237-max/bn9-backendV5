const { randomUUID } = require('crypto');
const { supabase, isSupabaseEnabled } = require('./supabaseClient');

function parseEnvBots() {
  const bots = [];
  if (process.env.TELEGRAM_BOTS) {
    try {
      const parsed = JSON.parse(process.env.TELEGRAM_BOTS);
      if (Array.isArray(parsed)) {
        parsed.forEach((bot) => {
          if (bot && bot.id && bot.token) {
            bots.push({
              id: bot.id,
              name: bot.name || bot.id,
              username: bot.username || '',
              token: bot.token,
              miniAppUrl: bot.miniAppUrl,
            });
          }
        });
      }
    } catch (error) {
      console.warn('ไม่สามารถแปลง TELEGRAM_BOTS ได้', error.message);
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    bots.push({
      id: 'primary',
      name: process.env.TELEGRAM_BOT_NAME || 'Primary Bot',
      username: process.env.TELEGRAM_BOT_USERNAME || '',
      token: process.env.TELEGRAM_BOT_TOKEN,
      miniAppUrl: process.env.MINIAPP_URL,
    });
  }

  return bots;
}

async function listBots() {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('bots')
      .select('id, name, username, description, webhook_url, ai_persona, ai_enabled, miniapp_url, last_synced_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []).map((bot) => ({
      id: bot.id,
      name: bot.name || bot.id,
      username: bot.username,
      description: bot.description,
      webhookUrl: bot.webhook_url,
      aiPersona: bot.ai_persona,
      aiEnabled: bot.ai_enabled,
      miniAppUrl: bot.miniapp_url,
      lastSyncedAt: bot.last_synced_at,
    }));
  }

  const envBots = parseEnvBots();
  return envBots.map((bot) => ({
    id: bot.id,
    name: bot.name,
    username: bot.username,
    description: '',
    webhookUrl: '',
    aiPersona: '',
    aiEnabled: false,
    miniAppUrl: bot.miniAppUrl,
    lastSyncedAt: null,
  }));
}

async function getBot(botId) {
  if (!botId) throw new Error('ต้องระบุรหัสบอท');

  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('bots')
      .select('id, name, username, description, token, webhook_url, ai_persona, ai_enabled, miniapp_url')
      .eq('id', botId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name || data.id,
      username: data.username,
      description: data.description,
      token: data.token,
      webhookUrl: data.webhook_url,
      aiPersona: data.ai_persona,
      aiEnabled: data.ai_enabled,
      miniAppUrl: data.miniapp_url,
    };
  }

  const envBots = parseEnvBots();
  const bot = envBots.find((item) => item.id === botId);
  return bot || null;
}

async function upsertBot(bot) {
  if (!bot || !bot.id) throw new Error('ข้อมูลบอทไม่ถูกต้อง');

  if (isSupabaseEnabled) {
    const payload = {
      id: bot.id,
      name: bot.name,
      username: bot.username,
      description: bot.description,
      token: bot.token,
      webhook_url: bot.webhookUrl,
      ai_persona: bot.aiPersona,
      ai_enabled: bot.aiEnabled,
      miniapp_url: bot.miniAppUrl,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('bots').upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  throw new Error('โหมดไฟล์โลคอลไม่รองรับการเพิ่มบอทใหม่ กรุณาใช้ตัวแปรสภาพแวดล้อม TELEGRAM_BOTS');
}

async function markSynced(botId) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('bots')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', botId);
    if (error) throw error;
  }
}

function ensureBotId(botId) {
  if (botId) return botId;
  if (process.env.TELEGRAM_DEFAULT_BOT_ID) {
    return process.env.TELEGRAM_DEFAULT_BOT_ID;
  }
  const envBots = parseEnvBots();
  if (envBots.length) return envBots[0].id;
  return randomUUID();
}

async function getBotToken(botId) {
  const bot = await getBot(botId);
  return bot?.token || null;
}

module.exports = {
  listBots,
  getBot,
  upsertBot,
  markSynced,
  ensureBotId,
  parseEnvBots,
  getBotToken,
};
