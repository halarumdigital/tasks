const { pool } = require('../config/database');
const calculationService = require('../services/calculationService');
const redistributionService = require('../services/redistributionService');

const logController = {
  // POST /api/tasks/:taskId/complete
  async complete(req, res) {
    try {
      const { taskId } = req.params;
      const { date, progress } = req.body;

      const logDate = date || new Date().toISOString().split('T')[0];

      // Buscar tarefa e periodo
      const [tasks] = await pool.query(`
        SELECT t.*, p.start_date, p.end_date, p.id as period_id
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE t.id = ?
      `, [taskId]);

      if (tasks.length === 0) {
        return res.status(404).json({ error: 'Tarefa nao encontrada' });
      }

      const task = tasks[0];

      // Calcular semana do periodo
      const startDate = new Date(task.start_date);
      const currentDate = new Date(logDate);
      const diffDays = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      // Calcular progresso acumulado
      let accumulatedProgress = 0;
      if (task.metric_type !== 'boolean') {
        const [prevLogs] = await pool.query(
          'SELECT MAX(accumulated_progress) as prev FROM task_logs WHERE task_id = ? AND log_date < ?',
          [taskId, logDate]
        );

        const prevProgress = prevLogs[0].prev || 0;
        const dailyProgress = progress || task.daily_target || 0;
        accumulatedProgress = parseFloat(prevProgress) + parseFloat(dailyProgress);
      }

      // Inserir ou atualizar log
      await pool.query(`
        INSERT INTO task_logs (task_id, log_date, week_number, completed, completed_at, accumulated_progress)
        VALUES (?, ?, ?, 1, NOW(), ?)
        ON DUPLICATE KEY UPDATE
          completed = 1,
          completed_at = NOW(),
          accumulated_progress = ?
      `, [taskId, logDate, weekNumber, accumulatedProgress, accumulatedProgress]);

      const [log] = await pool.query(
        'SELECT * FROM task_logs WHERE task_id = ? AND log_date = ?',
        [taskId, logDate]
      );

      return res.json(log[0]);
    } catch (error) {
      console.error('Erro ao marcar tarefa como completa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/tasks/:taskId/skip
  async skip(req, res) {
    try {
      const { taskId } = req.params;
      const { date } = req.body;

      const logDate = date || new Date().toISOString().split('T')[0];

      // Buscar tarefa e periodo
      const [tasks] = await pool.query(`
        SELECT t.*, p.start_date, p.end_date, p.id as period_id
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE t.id = ?
      `, [taskId]);

      if (tasks.length === 0) {
        return res.status(404).json({ error: 'Tarefa nao encontrada' });
      }

      const task = tasks[0];

      // Calcular semana do periodo
      const startDate = new Date(task.start_date);
      const currentDate = new Date(logDate);
      const diffDays = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      // Manter progresso acumulado anterior
      const [prevLogs] = await pool.query(
        'SELECT MAX(accumulated_progress) as prev FROM task_logs WHERE task_id = ? AND log_date < ?',
        [taskId, logDate]
      );

      const accumulatedProgress = prevLogs[0].prev || 0;

      // Inserir ou atualizar log como nao completado
      await pool.query(`
        INSERT INTO task_logs (task_id, log_date, week_number, completed, accumulated_progress)
        VALUES (?, ?, ?, 0, ?)
        ON DUPLICATE KEY UPDATE
          completed = 0,
          completed_at = NULL,
          accumulated_progress = ?
      `, [taskId, logDate, weekNumber, accumulatedProgress, accumulatedProgress]);

      // Redistribuir meta se for tarefa quantitativa
      if (task.metric_type !== 'boolean' && task.total_target) {
        await redistributionService.redistribute(taskId);
      }

      const [log] = await pool.query(
        'SELECT * FROM task_logs WHERE task_id = ? AND log_date = ?',
        [taskId, logDate]
      );

      return res.json(log[0]);
    } catch (error) {
      console.error('Erro ao marcar tarefa como nao feita:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/logs/week/:weekNumber
  async getWeek(req, res) {
    try {
      const { weekNumber } = req.params;

      const [logs] = await pool.query(`
        SELECT tl.*, t.title as task_title, t.metric_type, t.unit, t.daily_target
        FROM task_logs tl
        JOIN tasks t ON tl.task_id = t.id
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE p.status = 'active'
        AND tl.week_number = ?
        ORDER BY tl.log_date DESC
      `, [weekNumber]);

      return res.json(logs);
    } catch (error) {
      console.error('Erro ao buscar logs da semana:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/logs/calendar
  async getCalendar(req, res) {
    try {
      const { start_date, end_date, task_id } = req.query;

      let query = `
        SELECT tl.*, t.title as task_title, t.metric_type
        FROM task_logs tl
        JOIN tasks t ON tl.task_id = t.id
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (start_date) {
        query += ' AND tl.log_date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND tl.log_date <= ?';
        params.push(end_date);
      }

      if (task_id) {
        query += ' AND tl.task_id = ?';
        params.push(task_id);
      }

      query += ' ORDER BY tl.log_date DESC';

      const [logs] = await pool.query(query, params);
      return res.json(logs);
    } catch (error) {
      console.error('Erro ao buscar dados do calendario:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = logController;
