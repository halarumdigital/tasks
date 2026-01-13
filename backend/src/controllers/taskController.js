const { pool } = require('../config/database');
const calculationService = require('../services/calculationService');

const taskController = {
  // GET /api/tasks
  async list(req, res) {
    try {
      const { tactic_id, active_only } = req.query;

      let query = `
        SELECT t.*, tc.title as tactic_title, g.title as goal_title
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
      `;
      const params = [];
      const conditions = [];

      if (tactic_id) {
        conditions.push('t.tactic_id = ?');
        params.push(tactic_id);
      }

      if (active_only === 'true') {
        conditions.push('t.is_active = 1');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY t.created_at DESC';

      const [tasks] = await pool.query(query, params);
      return res.json(tasks);
    } catch (error) {
      console.error('Erro ao listar tarefas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/tasks/today
  async getToday(req, res) {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0-6 (Dom-Sab)
      const dayBit = Math.pow(2, dayOfWeek);
      const todayStr = today.toISOString().split('T')[0];

      // Buscar tarefas ativas do periodo ativo que sao para hoje
      const [tasks] = await pool.query(`
        SELECT t.*, tc.title as tactic_title, g.title as goal_title,
          tl.completed, tl.accumulated_progress
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

      return res.json(tasks);
    } catch (error) {
      console.error('Erro ao buscar tarefas de hoje:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/tasks/:id
  async get(req, res) {
    try {
      const { id } = req.params;
      const [tasks] = await pool.query(`
        SELECT t.*, tc.title as tactic_title, g.title as goal_title
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        WHERE t.id = ?
      `, [id]);

      if (tasks.length === 0) {
        return res.status(404).json({ error: 'Tarefa nao encontrada' });
      }

      return res.json(tasks[0]);
    } catch (error) {
      console.error('Erro ao buscar tarefa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/tasks
  async create(req, res) {
    try {
      const {
        tactic_id,
        title,
        description,
        metric_type,
        total_target,
        unit,
        speed_per_hour,
        daily_time_minutes,
        weekdays,
        notification_time
      } = req.body;

      if (!tactic_id || !title) {
        return res.status(400).json({ error: 'tactic_id e title sao obrigatorios' });
      }

      // Verificar se tatica existe
      const [tactics] = await pool.query(
        'SELECT id FROM tactics WHERE id = ?',
        [tactic_id]
      );

      if (tactics.length === 0) {
        return res.status(404).json({ error: 'Tatica nao encontrada' });
      }

      // Calcular daily_target se necessario
      let daily_target = null;
      if (metric_type !== 'boolean' && total_target) {
        daily_target = calculationService.calculateDailyTarget({
          metric_type,
          total_target,
          speed_per_hour,
          daily_time_minutes,
          weekdays: weekdays || 127
        });
      }

      const [result] = await pool.query(
        `INSERT INTO tasks
        (tactic_id, title, description, metric_type, total_target, unit, speed_per_hour, daily_time_minutes, daily_target, weekdays, notification_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tactic_id,
          title,
          description || null,
          metric_type || 'boolean',
          total_target || null,
          unit || null,
          speed_per_hour || null,
          daily_time_minutes || null,
          daily_target,
          weekdays || 127,
          notification_time || '20:00:00'
        ]
      );

      const [task] = await pool.query(
        'SELECT * FROM tasks WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json(task[0]);
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/tasks/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        metric_type,
        total_target,
        unit,
        speed_per_hour,
        daily_time_minutes,
        weekdays,
        notification_time,
        is_active
      } = req.body;

      // Verificar se tarefa existe
      const [existing] = await pool.query(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Tarefa nao encontrada' });
      }

      // Recalcular daily_target se necessario
      let daily_target = existing[0].daily_target;
      const newMetricType = metric_type || existing[0].metric_type;

      if (newMetricType !== 'boolean') {
        daily_target = calculationService.calculateDailyTarget({
          metric_type: newMetricType,
          total_target: total_target !== undefined ? total_target : existing[0].total_target,
          speed_per_hour: speed_per_hour !== undefined ? speed_per_hour : existing[0].speed_per_hour,
          daily_time_minutes: daily_time_minutes !== undefined ? daily_time_minutes : existing[0].daily_time_minutes,
          weekdays: weekdays !== undefined ? weekdays : existing[0].weekdays
        });
      } else {
        daily_target = null;
      }

      await pool.query(
        `UPDATE tasks SET
          title = ?,
          description = ?,
          metric_type = ?,
          total_target = ?,
          unit = ?,
          speed_per_hour = ?,
          daily_time_minutes = ?,
          daily_target = ?,
          weekdays = ?,
          notification_time = ?,
          is_active = ?
        WHERE id = ?`,
        [
          title || existing[0].title,
          description !== undefined ? description : existing[0].description,
          newMetricType,
          total_target !== undefined ? total_target : existing[0].total_target,
          unit !== undefined ? unit : existing[0].unit,
          speed_per_hour !== undefined ? speed_per_hour : existing[0].speed_per_hour,
          daily_time_minutes !== undefined ? daily_time_minutes : existing[0].daily_time_minutes,
          daily_target,
          weekdays !== undefined ? weekdays : existing[0].weekdays,
          notification_time || existing[0].notification_time,
          is_active !== undefined ? is_active : existing[0].is_active,
          id
        ]
      );

      const [task] = await pool.query(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );

      return res.json(task[0]);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/tasks/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        'DELETE FROM tasks WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Tarefa nao encontrada' });
      }

      return res.json({ message: 'Tarefa excluida com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/tasks/:id/logs
  async getLogs(req, res) {
    try {
      const { id } = req.params;
      const { week } = req.query;

      let query = 'SELECT * FROM task_logs WHERE task_id = ?';
      const params = [id];

      if (week) {
        query += ' AND week_number = ?';
        params.push(week);
      }

      query += ' ORDER BY log_date DESC';

      const [logs] = await pool.query(query, params);
      return res.json(logs);
    } catch (error) {
      console.error('Erro ao buscar logs da tarefa:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = taskController;
