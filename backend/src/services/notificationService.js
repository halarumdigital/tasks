const { pool } = require('../config/database');
const { sendMessage } = require('./telegramBot');

const notificationService = {
  // Enviar notificacao individual de uma tarefa
  async sendTaskNotification(task, config, todayStr, currentWeek) {
    try {
      let message = `📋 *${task.title}*\n\n`;
      message += `🎯 Meta: ${task.goal_title}\n`;
      message += `📌 Tatica: ${task.tactic_title}\n`;

      if (task.metric_type !== 'boolean' && task.daily_target) {
        message += `📊 Meta de hoje: ${parseFloat(task.daily_target).toFixed(1)} ${task.unit || ''}\n`;
      }

      if (task.total_target) {
        // Buscar progresso acumulado
        const [progress] = await pool.query(
          'SELECT MAX(accumulated_progress) as current FROM task_logs WHERE task_id = ?',
          [task.id]
        );
        const current = progress[0].current || 0;
        const percentage = Math.round((current / task.total_target) * 100);
        message += `📈 Progresso total: ${current}/${task.total_target} ${task.unit || ''} (${percentage}%)\n`;
      }

      message += `\n⏰ Voce fez essa tarefa hoje?`;

      const inlineKeyboard = [
        [
          { text: `✅ Sim, fiz!`, callback_data: `done_${task.id}_${todayStr}` },
          { text: `❌ Nao fiz`, callback_data: `skip_${task.id}_${todayStr}` }
        ]
      ];

      const result = await sendMessage(config.chat_id, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });

      if (result) {
        console.log(`Notificacao enviada: ${task.title} para ${config.chat_id}`);
      }

      return result;
    } catch (error) {
      console.error(`Erro ao enviar notificacao da tarefa ${task.id}:`, error);
      return null;
    }
  },

  // Verificar e enviar notificacoes no horario correto
  async checkAndSendNotifications() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
      const dayOfWeek = now.getDay();
      const dayBit = Math.pow(2, dayOfWeek);
      const todayStr = now.toISOString().split('T')[0];

      // Buscar configuracao do Telegram ativa
      const [configs] = await pool.query(
        'SELECT * FROM telegram_config WHERE is_active = 1'
      );

      if (configs.length === 0) {
        return;
      }

      // Buscar periodo ativo
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        return;
      }

      const period = periods[0];
      const startDate = new Date(period.start_date);
      const diffDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      // Buscar tarefas que devem ser notificadas AGORA (horario exato)
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
        AND TIME_FORMAT(t.notification_time, '%H:%i:%s') = ?
        AND tl.id IS NULL
      `, [todayStr, dayBit, currentTime]);

      if (tasks.length === 0) {
        return;
      }

      console.log(`${tasks.length} tarefa(s) para notificar as ${currentTime}`);

      // Enviar cada tarefa individualmente para todos os usuarios
      for (const config of configs) {
        for (const task of tasks) {
          await this.sendTaskNotification(task, config, todayStr, currentWeek);

          // Pequeno delay entre mensagens para evitar flood
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

    } catch (error) {
      console.error('Erro ao verificar notificacoes:', error);
    }
  },

  // Enviar resumo diario (opcional - pode ser chamado em um horario especifico)
  async sendDailySummary() {
    try {
      const [configs] = await pool.query(
        'SELECT * FROM telegram_config WHERE is_active = 1'
      );

      if (configs.length === 0) return;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Buscar estatisticas do dia
      const [dayStats] = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as missed
        FROM task_logs
        WHERE log_date = ?
      `, [todayStr]);

      if (dayStats[0].total === 0) return;

      const stats = dayStats[0];
      const percentage = Math.round((stats.completed / stats.total) * 100);

      let message = `📊 *Resumo do Dia*\n\n`;
      message += `✅ Concluidas: ${stats.completed}\n`;
      message += `❌ Nao feitas: ${stats.missed}\n`;
      message += `📈 Taxa: ${percentage}%\n\n`;

      if (percentage >= 80) {
        message += `🏆 Excelente! Continue assim!`;
      } else if (percentage >= 50) {
        message += `💪 Bom progresso, mas pode melhorar!`;
      } else {
        message += `⚠️ Dia fraco. Amanha sera diferente!`;
      }

      for (const config of configs) {
        await sendMessage(config.chat_id, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('Erro ao enviar resumo diario:', error);
    }
  }
};

module.exports = notificationService;
