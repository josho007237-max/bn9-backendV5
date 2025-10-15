const axios = require('axios');
const { URL } = require('url');

const commandStore = require('./commandStore');
const { generateStructuredResponse } = require('./openai');
const botRegistry = require('./botRegistry');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

function ensureToken(token, botId) {
  if (!token) {
    const error = new Error(`ไม่พบโทเคนสำหรับบอท ${botId || 'unknown'}`);
    error.status = 400;
    throw error;
  }
  return token;
}

async function getToken(botId) {
  const bot = await botRegistry.getBot(botId);
  if (!bot || !bot.token) {
    const fallback = process.env.TELEGRAM_BOT_TOKEN;
    if (fallback && (!botId || botId === 'primary')) {
      return fallback;
    }
  }
  return bot?.token || null;
}

async function getTelegramApiUrl(botId, method) {
  const token = ensureToken(await getToken(botId), botId);
  return `${TELEGRAM_API_BASE}${token}/${method}`;
}

async function sendTelegramRequest(botId, method, payload, options = {}) {
  const url = await getTelegramApiUrl(botId, method);
  try {
    const response = await axios({
      method: options.method || 'post',
      url,
      data: options.method === 'get' ? undefined : payload,
      params: options.method === 'get' ? payload : undefined,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`Telegram API error on ${method}`, error.response.data);
    } else {
      console.error(`Telegram API error on ${method}`, error.message);
    }
    throw error;
  }
}

function buildWebAppUrl(botId, settings) {
  if (settings?.miniAppUrl) return settings.miniAppUrl;
  if (process.env.MINIAPP_URL) return process.env.MINIAPP_URL;
  if (process.env.DOMAIN) {
    const base = process.env.DOMAIN.startsWith('http')
      ? process.env.DOMAIN
      : `https://${process.env.DOMAIN}`;
    const miniAppId = process.env.MINIAPP_ID || botId || 'miniapp';
    return `${base.replace(/\/$/, '')}/miniapp/${miniAppId}`;
  }
  return null;
}

function buildReplyMarkup(buttons = [], botId, settings) {
  const filtered = buttons.filter((button) => button && button.label && button.type);
  if (!filtered.length) return undefined;

  const hasInlineButton = filtered.some((button) => button.type !== 'command');
  if (hasInlineButton) {
    const inlineKeyboard = filtered.map((button) => {
      if (button.type === 'url') {
        return [
          {
            text: button.label,
            url: button.value,
          },
        ];
      }
      if (button.type === 'web_app') {
        const url = button.value || buildWebAppUrl(botId, settings);
        if (!url) {
          return [{ text: button.label, callback_data: button.value || button.label }];
        }
        return [
          {
            text: button.label,
            web_app: {
              url,
            },
          },
        ];
      }
      const callbackData = button.value || button.label;
      return [
        {
          text: button.label,
          callback_data: callbackData,
        },
      ];
    });
    return { inline_keyboard: inlineKeyboard };
  }

  const keyboard = filtered.map((button) => [
    {
      text: button.value || button.label,
    },
  ]);
  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

async function sendMessage(botId, { chatId, text, buttons, parseMode = 'Markdown' }) {
  if (!chatId || !text) {
    const error = new Error('chatId และข้อความเป็นข้อมูลที่จำเป็น');
    error.status = 400;
    throw error;
  }
  const config = await commandStore.getConfig(botId);
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  };
  const replyMarkup = buildReplyMarkup(buttons, botId, config.settings);
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  await sendTelegramRequest(botId, 'sendMessage', payload);
}

async function answerCallbackQuery(botId, callbackQueryId) {
  if (!callbackQueryId) return;
  try {
    await sendTelegramRequest(botId, 'answerCallbackQuery', {
      callback_query_id: callbackQueryId,
    });
  } catch (error) {
    console.error('answerCallbackQuery failed', error.message);
  }
}

function normalise(text) {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('/')) {
    return trimmed.toLowerCase();
  }
  return trimmed.toLowerCase();
}

async function handleCommandMatch(botId, chatId, command) {
  if (!command) return false;
  await sendMessage(botId, {
    chatId,
    text: command.response,
    buttons: command.buttons,
  });
  return true;
}

async function handleTelegramUpdate(botId, update) {
  if (!update) return;

  const config = await commandStore.getConfig(botId);

  if (update.callback_query) {
    const callback = update.callback_query;
    const chatId = callback.message?.chat?.id;
    const data = callback.data;
    if (!chatId) {
      await answerCallbackQuery(botId, callback.id);
      return;
    }
    const commands = config.commands || [];
    const matched = commands.find((command) => {
      if (!command) return false;
      if (command.command && normalise(command.command) === normalise(data)) return true;
      return command.buttons?.some(
        (button) => normalise(button.value || button.label) === normalise(data)
      );
    });
    if (matched) {
      await sendMessage(botId, { chatId, text: matched.response, buttons: matched.buttons });
    }
    await answerCallbackQuery(botId, callback.id);
    return;
  }

  const message = update.message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = normalise(message.text || '');
  if (!text) return;

  const commands = config.commands || [];
  const quickReplies = config.quickReplies || [];

  const commandMatch = commands.find((command) => normalise(command.command) === text);
  if (await handleCommandMatch(botId, chatId, commandMatch)) {
    return;
  }

  const buttonMatch = commands.find((command) =>
    command.buttons?.some((button) => normalise(button.value || button.label) === text)
  );
  if (await handleCommandMatch(botId, chatId, buttonMatch)) {
    return;
  }

  const quickReplyMatch = quickReplies.find((reply) => text.includes(normalise(reply.keyword)));
  if (quickReplyMatch) {
    await sendMessage(botId, {
      chatId,
      text: quickReplyMatch.response,
    });
    return;
  }

  if (config.settings.aiEnabled && process.env.OPENAI_API_KEY) {
    try {
      const aiText = await generateStructuredResponse({
        prompt: message.text,
        persona: config.settings.aiPersona,
        model: config.settings.aiModel,
        temperature: config.settings.aiTemperature,
      });
      await sendMessage(botId, { chatId, text: aiText });
      return;
    } catch (error) {
      console.error('AI fallback failed', error.message);
    }
  }

  if (config.settings.defaultResponse) {
    await sendMessage(botId, { chatId, text: config.settings.defaultResponse });
  }
}

async function resolveWebhookUrl(botId, urlFromRequest) {
  if (urlFromRequest) return urlFromRequest;
  if (process.env.DOMAIN) {
    const base = process.env.DOMAIN.startsWith('http')
      ? process.env.DOMAIN
      : `https://${process.env.DOMAIN}`;
    return `${base.replace(/\/$/, '')}/webhook/${botId}`;
  }
  return null;
}

async function setWebhook(botId, urlFromRequest) {
  const webhookUrl = await resolveWebhookUrl(botId, urlFromRequest);
  if (!webhookUrl) {
    const error = new Error('กรุณาระบุ URL สำหรับ Webhook');
    error.status = 400;
    throw error;
  }

  try {
    new URL(webhookUrl);
  } catch (error) {
    const invalid = new Error('URL สำหรับ Webhook ไม่ถูกต้อง');
    invalid.status = 400;
    throw invalid;
  }

  const result = await sendTelegramRequest(botId, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  });

  await commandStore.updateSettings(botId, { webhookUrl });
  await botRegistry.markSynced(botId);
  return result.result ? webhookUrl : null;
}

async function deleteWebhook(botId) {
  await sendTelegramRequest(botId, 'deleteWebhook');
  await commandStore.updateSettings(botId, { webhookUrl: '' });
}

async function fetchBotStatus(botId) {
  try {
    const token = await getToken(botId);
    ensureToken(token, botId);
  } catch (error) {
    return {
      botId,
      connected: false,
      error: error.message,
    };
  }

  const [me, webhookInfo, config] = await Promise.all([
    sendTelegramRequest(botId, 'getMe', null, { method: 'get' }),
    sendTelegramRequest(botId, 'getWebhookInfo', null, { method: 'get' }),
    commandStore.getConfig(botId),
  ]);

  return {
    botId,
    username: me?.result?.username,
    firstName: me?.result?.first_name,
    webhookUrl: webhookInfo?.result?.url || config.settings.webhookUrl,
    hasCustomCertificate: webhookInfo?.result?.has_custom_certificate,
    pendingUpdateCount: webhookInfo?.result?.pending_update_count,
    lastErrorDate: webhookInfo?.result?.last_error_date,
    lastErrorMessage: webhookInfo?.result?.last_error_message,
    maxConnections: webhookInfo?.result?.max_connections,
    connected: Boolean(webhookInfo?.result?.url),
  };
}

async function getStatus(botId) {
  if (botId) {
    return fetchBotStatus(botId);
  }

  const bots = await botRegistry.listBots();
  if (!bots.length) {
    return { bots: [] };
  }

  const statuses = await Promise.all(bots.map((bot) => fetchBotStatus(bot.id)));
  return { bots: statuses };
}

module.exports = {
  handleTelegramUpdate,
  sendMessage,
  setWebhook,
  deleteWebhook,
  getStatus,
};
