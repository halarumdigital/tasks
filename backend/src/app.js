const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { testConnection } = require('./config/database');
const routes = require('./routes');
const { initBot } = require('./services/telegramBot');
const { startNotificationJob } = require('./jobs/notificationJob');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Servir frontend em producao
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
  });
} else {
  // Em desenvolvimento, servir o build se existir
  const buildPath = path.join(__dirname, '../../frontend/build');
  if (require('fs').existsSync(buildPath)) {
    app.use(express.static(buildPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  }
}

// Iniciar servidor
const startServer = async () => {
  // Testar conexao com banco
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('Nao foi possivel conectar ao banco de dados. Verifique as configuracoes.');
    process.exit(1);
  }

  // Iniciar bot do Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    initBot();
    startNotificationJob();
    console.log('Bot do Telegram iniciado!');
  } else {
    console.log('TELEGRAM_BOT_TOKEN nao configurado. Bot desativado.');
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`API disponivel em http://localhost:${PORT}/api`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Frontend em desenvolvimento: http://localhost:3001`);
    }
  });
};

startServer();
