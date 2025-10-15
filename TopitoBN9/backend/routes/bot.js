const express = require('express');
const router = express.Router();

const commandStore = require('../services/commandStore');
const telegram = require('../services/telegram');
const botRegistry = require('../services/botRegistry');
const { generateStructuredResponse, DEFAULT_MODEL } = require('../services/openai');
const { getSystemStatus } = require('../services/systemStatus');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function getBotId(req) {
  return req.params.botId || req.query.botId || req.body.botId;
}

router.get(
  '/bots',
  asyncHandler(async (req, res) => {
    const bots = await botRegistry.listBots();
    res.json({ bots });
  })
);

router.get(
  '/system/status',
  asyncHandler(async (req, res) => {
    const [systemStatus, telegramStatus] = await Promise.all([
      getSystemStatus(),
      telegram.getStatus(),
    ]);
    res.json({ ...systemStatus, telegram: telegramStatus });
  })
);

router.get(
  '/bots/:botId/config',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const config = await commandStore.getConfig(botId);
    res.json(config);
  })
);

router.put(
  '/bots/:botId/settings',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const settings = await commandStore.updateSettings(botId, req.body || {});
    res.json(settings);
  })
);

router.post(
  '/bots/:botId/commands',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const command = await commandStore.saveCommand(botId, req.body || {});
    res.status(201).json(command);
  })
);

router.put(
  '/bots/:botId/commands/:id',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const command = await commandStore.saveCommand(botId, {
      ...req.body,
      id: req.params.id,
    });
    res.json(command);
  })
);

router.delete(
  '/bots/:botId/commands/:id',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    await commandStore.deleteCommand(botId, req.params.id);
    res.sendStatus(204);
  })
);

router.post(
  '/bots/:botId/quick-replies',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const quickReply = await commandStore.saveQuickReply(botId, req.body || {});
    res.status(201).json(quickReply);
  })
);

router.put(
  '/bots/:botId/quick-replies/:id',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const quickReply = await commandStore.saveQuickReply(botId, {
      ...req.body,
      id: req.params.id,
    });
    res.json(quickReply);
  })
);

router.delete(
  '/bots/:botId/quick-replies/:id',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    await commandStore.deleteQuickReply(botId, req.params.id);
    res.sendStatus(204);
  })
);

router.post(
  '/bots/:botId/test-message',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const { chatId, message, buttons, parseMode } = req.body || {};
    if (!chatId || !message) {
      return res.status(400).json({ error: 'chatId และ message เป็นข้อมูลที่จำเป็น' });
    }
    await telegram.sendMessage(botId, {
      chatId,
      text: message,
      buttons,
      parseMode,
    });
    res.json({ success: true });
  })
);

router.post(
  '/bots/:botId/webhook',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const { url } = req.body || {};
    const webhookUrl = await telegram.setWebhook(botId, url);
    res.json({ webhookUrl });
  })
);

router.delete(
  '/bots/:botId/webhook',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    await telegram.deleteWebhook(botId);
    res.sendStatus(204);
  })
);

router.get(
  '/bots/:botId/status',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const status = await telegram.getStatus(botId);
    res.json(status);
  })
);

router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const status = await telegram.getStatus();
    res.json(status);
  })
);

router.post(
  '/bots/:botId/ai/preview',
  asyncHandler(async (req, res) => {
    const botId = getBotId(req);
    const config = await commandStore.getConfig(botId);
    const { prompt, model, temperature } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'กรุณาระบุ prompt สำหรับการสร้างข้อความ' });
    }
    const text = await generateStructuredResponse({
      prompt,
      persona: config.settings.aiPersona,
      model: model || config.settings.aiModel,
      temperature: typeof temperature === 'number' ? temperature : config.settings.aiTemperature,
    });
    res.json({ text });
  })
);

router.get(
  '/ai/models',
  asyncHandler(async (req, res) => {
    const supportedModels = (
      process.env.OPENAI_SUPPORTED_MODELS ||
      'gpt-5, gpt-4o, gpt-4o-mini, gpt-3.5-turbo'
    )
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);

    const models = Array.from(new Set([DEFAULT_MODEL, ...supportedModels]));
    res.json({ models });
  })
);

module.exports = router;
