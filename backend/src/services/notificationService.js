const { pool } = require('../config/database');
const { sendMessage } = require('./telegramBot');

const notificationService = {
  // Enviar notificacao diaria de tarefas
  async sendDailyNotification() {
    try {
      // Buscar configuracao do Telegram ativa
      const [configs] = await pool.query(
        'SELECT * FROM telegram_config WHERE is_active = 1'
      );

      if (configs.length === 0) {
        console.log('Nenhuma configuracao de Telegram ativa');
        return;
      }

      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayBit = Math.pow(2, dayOfWeek);
      const todayStr = today.toISOString().split('T')[0];

      // Buscar tarefas de hoje que ainda nao foram respondidas
      const [tasks] = await pool.query(`
        SELECT t.*, tc.title as tactic_title, g.title as goal_title,
          tl.completed
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        LEFT JOIN task_logs tl ON t.id = tl.task_id AND tl.log_date = ?
        WHERE p.status = 'active'
        AND t.is_active = 1
        AND (t.weekdays & ?) > 0
        AND tl.id IS NULL
        ORDER BY t.notification_time ASC
      `, [todayStr, dayBit]);

      if (tasks.length === 0) {
        console.log('Nenhuma tarefa pendente para notificar');
        return;
      }

      // Formatar mensagem
      const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
      const dia = diasSemana[today.getDay()];
      const dataFormatada = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;

      let message = `📋 *Tarefas de Hoje* - ${dia}, ${dataFormatada}\n\n`;

      const inlineKeyboard = [];

      tasks.forEach((task, index) => {
        let taskInfo = `${index + 1}. ${task.title}`;

        if (task.metric_type !== 'boolean' && task.daily_target) {
          taskInfo += ` (${parseFloat(task.daily_target).toFixed(1)} ${task.unit || ''})`;
        }

        message += `${taskInfo}\n`;

        inlineKeyboard.push([
          { text: `✅ ${task.title.substring(0, 15)}...`, callback_data: `done_${task.id}_${todayStr}` },
          { text: `❌ Nao fiz`, callback_data: `skip_${task.id}_${todayStr}` }
        ]);
      });

      // Buscar estatisticas da semana
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length > 0) {
        const period = periods[0];
        const startDate = new Date(period.start_date);
        const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

        const [weekStats] = await pool.query(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
          FROM task_logs tl
          JOIN tasks t ON tl.task_id = t.id
          JOIN tactics tc ON t.tactic_id = tc.id
          JOIN goals g ON tc.goal_id = g.id
          WHERE g.period_id = ?
          AND tl.week_number = ?
        `, [period.id, currentWeek]);

        const percentage = weekStats[0].total > 0
          ? Math.round((weekStats[0].completed / weekStats[0].total) * 100)
          : 0;

        message += `\n📊 Progresso da Semana ${currentWeek}: ${percentage}%`;
      }

      // Enviar para todos os chats configurados
      for (const config of configs) {
        try {
          const result = await sendMessage(config.chat_id, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineKeyboard }
          });

          // Registrar notificacao enviada
          if (result) {
            await pool.query(
              'INSERT INTO notification_queue (scheduled_time, sent_at, message_id, tasks_included, status) VALUES (NOW(), NOW(), ?, ?, "sent")',
              [result.message_id.toString(), JSON.stringify(tasks.map(t => t.id))]
            );
          }
        } catch (error) {
          console.error(`Erro ao enviar notificacao para ${config.chat_id}:`, error);
        }
      }

      console.log(`Notificacao enviada para ${configs.length} usuario(s)`);
    } catch (error) {
      console.error('Erro ao enviar notificacao diaria:', error);
    }
  },

  // Verificar e enviar notificacoes agendadas
  async checkAndSendNotifications() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Verificar se e horario de notificacao (com tolerancia de 1 minuto)
      const [tasks] = await pool.query(`
        SELECT DISTINCT t.notification_time
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE p.status = 'active'
        AND t.is_active = 1
        AND TIME_FORMAT(t.notification_time, '%H:%i') = ?
      `, [currentTime]);

      if (tasks.length > 0) {
        await this.sendDailyNotification();
      }
    } catch (error) {
      console.error('Erro ao verificar notificacoes:', error);
    }
  }
};

module.exports = notificationService;
