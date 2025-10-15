const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { handleTelegramUpdate, getStatus } = require('./services/telegram');
const { ensureStoreReady } = require('./services/commandStore');
const { getSystemStatus } = require('./services/systemStatus');
const { ensureBotId, parseEnvBots } = require('./services/botRegistry');
const botRouter = require('./routes/bot');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', async (req, res, next) => {
  try {
    const [telegramStatus, systemStatus] = await Promise.all([
      getStatus(),
      getSystemStatus(),
    ]);
    res.json({ status: 'ok', ...systemStatus, telegram: telegramStatus });
  } catch (error) {
    next(error);
  }
});

app.post('/webhook/:botId', async (req, res) => {
  const botId = req.params.botId;
  try {
    await handleTelegramUpdate(botId, req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error(`Failed to handle Telegram update for bot ${botId}`, error);
    res.sendStatus(200);
  }
});

app.post('/webhook', async (req, res) => {
  const botId = ensureBotId(req.body?.botId);
  try {
    await handleTelegramUpdate(botId, req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error(`Failed to handle Telegram update for bot ${botId}`, error);
    res.sendStatus(200);
  }
});

app.use('/api', botRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Unexpected server error',
  });
});

const port = process.env.PORT || 3000;

async function bootstrapStore() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await ensureStoreReady();
    return;
  }

  const envBots = parseEnvBots();
  if (!envBots.length) {
    await ensureStoreReady('primary');
    return;
  }

  await Promise.all(envBots.map((bot) => ensureStoreReady(bot.id)));
}

bootstrapStore()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Unable to start server', error);
    process.exit(1);
  });
