const fs = require('fs/promises');
const path = require('path');

const { supabase, isSupabaseEnabled } = require('./supabaseClient');
const botRegistry = require('./botRegistry');
const { ensureStoreReady } = require('./commandStore');
const { DEFAULT_MODEL } = require('./openai');

const DATA_FILE = path.join(__dirname, '../data/bot-config.json');

async function checkSupabase() {
  if (!isSupabaseEnabled) {
    return {
      enabled: false,
      connected: false,
    };
  }

  try {
    const { error } = await supabase.from('bots').select('id').limit(1);
    if (error) throw error;
    return {
      enabled: true,
      connected: true,
    };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      error: error.message,
    };
  }
}

async function checkLocalStore() {
  if (isSupabaseEnabled) {
    return {
      inUse: false,
      ready: false,
    };
  }

  try {
    await ensureStoreReady();
    await fs.access(DATA_FILE);
    return {
      inUse: true,
      ready: true,
    };
  } catch (error) {
    return {
      inUse: true,
      ready: false,
      error: error.message,
    };
  }
}

function checkOpenAI() {
  const apiKeySet = Boolean(process.env.OPENAI_API_KEY);
  return {
    configured: apiKeySet,
    defaultModel: DEFAULT_MODEL,
    supportedModels: (process.env.OPENAI_SUPPORTED_MODELS || '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
  };
}

async function getSystemStatus() {
  const [supabaseStatus, localStoreStatus] = await Promise.all([
    checkSupabase(),
    checkLocalStore(),
  ]);

  let bots = [];
  let botsError = null;
  try {
    bots = await botRegistry.listBots();
  } catch (error) {
    botsError = error.message;
  }

  return {
    bots: {
      count: bots.length,
      items: bots,
      error: botsError,
    },
    supabase: supabaseStatus,
    localStore: localStoreStatus,
    openai: checkOpenAI(),
    environment: {
      domain: process.env.DOMAIN || null,
      miniAppId: process.env.MINIAPP_ID || null,
      webhookDomain: process.env.DOMAIN || null,
      defaultBotId: process.env.TELEGRAM_DEFAULT_BOT_ID || null,
    },
  };
}

module.exports = {
  getSystemStatus,
};
