const cron = require('node-cron');
const notificationService = require('../services/notificationService');

let job = null;

const startNotificationJob = () => {
  // Executar a cada minuto para verificar notificacoes agendadas
  job = cron.schedule('* * * * *', async () => {
    await notificationService.checkAndSendNotifications();
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('Job de notificacoes iniciado (verifica a cada minuto)');
  return job;
};

const stopNotificationJob = () => {
  if (job) {
    job.stop();
    console.log('Job de notificacoes parado');
  }
};

module.exports = { startNotificationJob, stopNotificationJob };
