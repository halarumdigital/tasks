const TelegramBot = require('node-telegram-bot-api');
const { pool } = require('../config/database');
const telegramConfig = require('../config/telegram');

let bot = null;

// Mensagens de incentivo para tarefas concluidas
const INCENTIVE_MESSAGES = [
  "🔥 ISSO AI! Voce e uma maquina de produtividade!",
  "💪 CAMPEAO! Mais uma tarefa conquistada!",
  "🚀 VOANDO! Continue assim e ninguem te para!",
  "⭐ EXCELENTE! Voce esta construindo seu sucesso!",
  "🏆 VENCEDOR! Cada tarefa completada e uma vitoria!",
  "💎 BRILHANTE! Sua disciplina e inspiradora!",
  "🎯 CERTEIRO! Foco total, resultado total!",
  "👊 ARRASOU! A consistencia leva a excelencia!",
  "🌟 MAGNIFICO! Voce esta no caminho certo!",
  "⚡ IMPARAVEL! Nada pode te deter!",
  "🦁 GUERREIRO! Sua determinacao e admiravel!",
  "🎖️ ORGULHO! Voce e exemplo de comprometimento!",
  "💯 PERFEITO! Meta batida, vida transformada!",
  "🏅 CRAQUE! Disciplina hoje, sucesso amanha!",
  "🔱 LENDARIO! Continue escrevendo sua historia de sucesso!"
];

// Mensagens de chamada de atencao para tarefas nao concluidas
const WARNING_MESSAGES = [
  "😤 ACORDA! Voce prometeu isso pra si mesmo! Vai desistir agora?",
  "🚨 ATENCAO! Cada dia perdido e um dia a menos para suas metas!",
  "💀 CUIDADO! A mediocridade esta te chamando. Vai atender?",
  "⚠️ ALERTA VERMELHO! Seu eu do futuro esta decepcionado!",
  "😠 SERIO ISSO? Voce e melhor que essa desculpa!",
  "🔴 PARE! Reflita! Essa tarefa nao vai se fazer sozinha!",
  "💢 CHEGA DE DESCULPAS! Ou voce faz, ou fica pelo caminho!",
  "⛔ NAO ACEITO! Voce tem potencial demais pra desperdicar assim!",
  "🆘 EMERGENCIA! Sua meta esta sangrando e voce esta parado!",
  "😡 VERGONHA! Prometeu e nao cumpriu. E assim que quer vencer?",
  "🚫 INADMISSIVEL! Cadê aquela pessoa determinada que comecou?",
  "💔 DECEPCIONANTE! Voce esta sabotando seu proprio sucesso!",
  "⚰️ RIP suas metas se continuar assim! REAJA!",
  "🤬 ACORDA PRA VIDA! Ninguem vai fazer isso por voce!",
  "👎 FRACO! E isso que voce quer ser? Levanta e faz acontecer!"
];

// Funcao para pegar mensagem aleatoria
const getRandomMessage = (messages) => {
  return messages[Math.floor(Math.random() * messages.length)];
};

const initBot = () => {
  if (!telegramConfig.token) {
    console.log('Token do Telegram nao configurado');
    return null;
  }

  bot = new TelegramBot(telegramConfig.token, { polling: true });

  // Comando /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'Usuario';

    try {
      // Verificar se ja existe configuracao
      const [existing] = await pool.query(
        'SELECT id FROM telegram_config WHERE chat_id = ?',
        [chatId.toString()]
      );

      if (existing.length === 0) {
        await pool.query(
          'INSERT INTO telegram_config (chat_id, username) VALUES (?, ?)',
          [chatId.toString(), username]
        );
        bot.sendMessage(chatId,
          `Ola, ${username}! Seu Telegram foi conectado ao 12 Week Year Tracker.\n\n` +
          `Voce recebera notificacoes diarias das suas tarefas.\n\n` +
          `Comandos disponiveis:\n` +
          `/hoje - Ver tarefas de hoje\n` +
          `/semana - Resumo da semana atual\n` +
          `/progresso - Progresso geral do periodo`
        );
      } else {
        await pool.query(
          'UPDATE telegram_config SET is_active = 1, username = ? WHERE chat_id = ?',
          [username, chatId.toString()]
        );
        bot.sendMessage(chatId, `Bem-vindo de volta, ${username}! Suas notificacoes estao ativas.`);
      }
    } catch (error) {
      console.error('Erro no comando /start:', error);
      bot.sendMessage(chatId, 'Ocorreu um erro ao configurar. Tente novamente mais tarde.');
    }
  });

  // Comando /hoje
  bot.onText(/\/hoje/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayBit = Math.pow(2, dayOfWeek);
      const todayStr = today.toISOString().split('T')[0];

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
        ORDER BY t.notification_time ASC
      `, [todayStr, dayBit]);

      if (tasks.length === 0) {
        bot.sendMessage(chatId, 'Nenhuma tarefa para hoje ou nenhum periodo ativo.');
        return;
      }

      const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
      const dia = diasSemana[today.getDay()];
      const dataFormatada = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;

      let message = `📋 *Tarefas de Hoje* - ${dia}, ${dataFormatada}\n\n`;

      const inlineKeyboard = [];

      tasks.forEach((task, index) => {
        const status = task.completed === 1 ? '✅' : task.completed === 0 ? '❌' : '⏳';
        let taskInfo = `${index + 1}. ${status} ${task.title}`;

        if (task.metric_type !== 'boolean' && task.daily_target) {
          taskInfo += ` (${task.daily_target} ${task.unit || ''})`;
        }

        message += `${taskInfo}\n`;

        // Adicionar botoes apenas se nao foi respondido ainda
        if (task.completed === null) {
          inlineKeyboard.push([
            { text: `✅ ${task.title.substring(0, 20)}`, callback_data: `done_${task.id}_${todayStr}` },
            { text: `❌`, callback_data: `skip_${task.id}_${todayStr}` }
          ]);
        }
      });

      // Calcular estatisticas
      const completed = tasks.filter(t => t.completed === 1).length;
      const total = tasks.length;
      message += `\n📊 *Progresso*: ${completed}/${total} (${Math.round(completed / total * 100)}%)`;

      const options = {
        parse_mode: 'Markdown'
      };

      if (inlineKeyboard.length > 0) {
        options.reply_markup = { inline_keyboard: inlineKeyboard };
      }

      bot.sendMessage(chatId, message, options);
    } catch (error) {
      console.error('Erro no comando /hoje:', error);
      bot.sendMessage(chatId, 'Ocorreu um erro ao buscar as tarefas.');
    }
  });

  // Comando /semana
  bot.onText(/\/semana/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        bot.sendMessage(chatId, 'Nenhum periodo ativo encontrado.');
        return;
      }

      const period = periods[0];
      const startDate = new Date(period.start_date);
      const today = new Date();
      const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (currentWeek - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [stats] = await pool.query(`
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

      const percentage = stats[0].total > 0
        ? Math.round((stats[0].completed / stats[0].total) * 100)
        : 0;

      let message = `📊 *Resumo da Semana ${currentWeek}*\n\n`;
      message += `📅 Periodo: ${period.name}\n`;
      message += `📆 Semana: ${currentWeek} de 12\n\n`;
      message += `✅ Tarefas completadas: ${stats[0].completed || 0}\n`;
      message += `📋 Total de tarefas: ${stats[0].total || 0}\n`;
      message += `📈 Taxa de conclusao: ${percentage}%\n\n`;

      // Barra de progresso visual
      const filled = Math.round(percentage / 10);
      const empty = 10 - filled;
      message += `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro no comando /semana:', error);
      bot.sendMessage(chatId, 'Ocorreu um erro ao buscar o resumo da semana.');
    }
  });

  // Comando /progresso
  bot.onText(/\/progresso/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        bot.sendMessage(chatId, 'Nenhum periodo ativo encontrado.');
        return;
      }

      const period = periods[0];
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      const today = new Date();
      const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));
      const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

      // Buscar metas e progresso
      const [goals] = await pool.query(
        'SELECT * FROM goals WHERE period_id = ?',
        [period.id]
      );

      let message = `🎯 *Progresso Geral*\n\n`;
      message += `📅 Periodo: ${period.name}\n`;
      message += `📆 Semana ${currentWeek} de 12\n`;
      message += `⏳ ${daysRemaining} dias restantes\n\n`;
      message += `*Metas:*\n`;

      for (const goal of goals) {
        const [tasks] = await pool.query(`
          SELECT t.*
          FROM tasks t
          JOIN tactics tc ON t.tactic_id = tc.id
          WHERE tc.goal_id = ?
        `, [goal.id]);

        let goalProgress = 0;
        let taskCount = 0;

        for (const task of tasks) {
          if (task.metric_type === 'boolean') {
            const [logs] = await pool.query(
              'SELECT COUNT(*) as total, SUM(completed) as completed FROM task_logs WHERE task_id = ?',
              [task.id]
            );
            if (logs[0].total > 0) {
              goalProgress += (logs[0].completed / logs[0].total) * 100;
              taskCount++;
            }
          } else if (task.total_target) {
            const [logs] = await pool.query(
              'SELECT MAX(accumulated_progress) as progress FROM task_logs WHERE task_id = ?',
              [task.id]
            );
            const progress = logs[0].progress || 0;
            goalProgress += Math.min(100, (progress / task.total_target) * 100);
            taskCount++;
          }
        }

        const avgProgress = taskCount > 0 ? Math.round(goalProgress / taskCount) : 0;
        const filled = Math.round(avgProgress / 10);
        const empty = 10 - filled;

        message += `\n• ${goal.title}\n`;
        message += `  [${'█'.repeat(filled)}${'░'.repeat(empty)}] ${avgProgress}%\n`;
      }

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro no comando /progresso:', error);
      bot.sendMessage(chatId, 'Ocorreu um erro ao buscar o progresso.');
    }
  });

  // Callback dos botoes
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {
      const [action, taskId, logDate] = data.split('_');

      // Buscar tarefa
      const [tasks] = await pool.query(`
        SELECT t.*, p.start_date
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE t.id = ?
      `, [taskId]);

      if (tasks.length === 0) {
        bot.answerCallbackQuery(query.id, { text: 'Tarefa nao encontrada' });
        return;
      }

      const task = tasks[0];

      // Calcular semana
      const startDate = new Date(task.start_date);
      const currentDate = new Date(logDate);
      const diffDays = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      if (action === 'done') {
        // Calcular progresso acumulado
        let accumulatedProgress = 0;
        if (task.metric_type !== 'boolean') {
          const [prevLogs] = await pool.query(
            'SELECT MAX(accumulated_progress) as prev FROM task_logs WHERE task_id = ? AND log_date < ?',
            [taskId, logDate]
          );
          const prevProgress = prevLogs[0].prev || 0;
          accumulatedProgress = parseFloat(prevProgress) + parseFloat(task.daily_target || 0);
        }

        await pool.query(`
          INSERT INTO task_logs (task_id, log_date, week_number, completed, completed_at, accumulated_progress)
          VALUES (?, ?, ?, 1, NOW(), ?)
          ON DUPLICATE KEY UPDATE completed = 1, completed_at = NOW(), accumulated_progress = ?
        `, [taskId, logDate, weekNumber, accumulatedProgress, accumulatedProgress]);

        bot.answerCallbackQuery(query.id, { text: '✅ Tarefa concluida!' });

        // Enviar mensagem de incentivo
        const incentiveMsg = getRandomMessage(INCENTIVE_MESSAGES);
        bot.sendMessage(chatId, `✅ *${task.title}* - CONCLUIDA!\n\n${incentiveMsg}`, { parse_mode: 'Markdown' });

      } else if (action === 'skip') {
        const [prevLogs] = await pool.query(
          'SELECT MAX(accumulated_progress) as prev FROM task_logs WHERE task_id = ? AND log_date < ?',
          [taskId, logDate]
        );
        const accumulatedProgress = prevLogs[0].prev || 0;

        await pool.query(`
          INSERT INTO task_logs (task_id, log_date, week_number, completed, accumulated_progress)
          VALUES (?, ?, ?, 0, ?)
          ON DUPLICATE KEY UPDATE completed = 0, completed_at = NULL, accumulated_progress = ?
        `, [taskId, logDate, weekNumber, accumulatedProgress, accumulatedProgress]);

        // Redistribuir se necessario
        if (task.metric_type !== 'boolean' && task.total_target) {
          const redistributionService = require('./redistributionService');
          await redistributionService.redistribute(taskId);
        }

        bot.answerCallbackQuery(query.id, { text: '❌ Tarefa nao concluida' });

        // Enviar mensagem de chamada de atencao
        const warningMsg = getRandomMessage(WARNING_MESSAGES);
        bot.sendMessage(chatId, `❌ *${task.title}* - NAO CONCLUIDA!\n\n${warningMsg}`, { parse_mode: 'Markdown' });
      }

      // Atualizar mensagem original
      const originalText = query.message.text;
      const updatedKeyboard = query.message.reply_markup.inline_keyboard.map(row => {
        return row.map(button => {
          if (button.callback_data === data) {
            if (action === 'done') {
              return { text: '✅ Feito!', callback_data: 'noop' };
            } else {
              return { text: '❌ Nao fiz', callback_data: 'noop' };
            }
          }
          return button;
        });
      });

      bot.editMessageReplyMarkup(
        { inline_keyboard: updatedKeyboard },
        { chat_id: chatId, message_id: messageId }
      );
    } catch (error) {
      console.error('Erro no callback:', error);
      bot.answerCallbackQuery(query.id, { text: 'Erro ao processar' });
    }
  });

  console.log('Bot do Telegram inicializado');
  return bot;
};

const getBot = () => bot;

const sendMessage = async (chatId, message, options = {}) => {
  if (!bot) {
    console.log('Bot nao inicializado');
    return null;
  }
  return bot.sendMessage(chatId, message, options);
};

module.exports = { initBot, getBot, sendMessage };
