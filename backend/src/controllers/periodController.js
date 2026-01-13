const { pool } = require('../config/database');

const periodController = {
  // GET /api/periods
  async list(req, res) {
    try {
      const [periods] = await pool.query(`
        SELECT p.*, v.title as vision_title
        FROM periods p
        JOIN visions v ON p.vision_id = v.id
        ORDER BY p.start_date DESC
      `);
      return res.json(periods);
    } catch (error) {
      console.error('Erro ao listar periodos:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/periods/active
  async getActive(req, res) {
    try {
      const [periods] = await pool.query(`
        SELECT p.*, v.title as vision_title
        FROM periods p
        JOIN visions v ON p.vision_id = v.id
        WHERE p.status = 'active'
        LIMIT 1
      `);

      if (periods.length === 0) {
        return res.json(null);
      }

      // Buscar metas do periodo
      const [goals] = await pool.query(
        'SELECT * FROM goals WHERE period_id = ?',
        [periods[0].id]
      );

      return res.json({ ...periods[0], goals });
    } catch (error) {
      console.error('Erro ao buscar periodo ativo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/periods/:id
  async get(req, res) {
    try {
      const { id } = req.params;
      const [periods] = await pool.query(`
        SELECT p.*, v.title as vision_title
        FROM periods p
        JOIN visions v ON p.vision_id = v.id
        WHERE p.id = ?
      `, [id]);

      if (periods.length === 0) {
        return res.status(404).json({ error: 'Periodo nao encontrado' });
      }

      // Buscar metas do periodo
      const [goals] = await pool.query(
        'SELECT * FROM goals WHERE period_id = ?',
        [id]
      );

      return res.json({ ...periods[0], goals });
    } catch (error) {
      console.error('Erro ao buscar periodo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/periods
  async create(req, res) {
    try {
      const { vision_id, name, start_date } = req.body;

      if (!vision_id || !name || !start_date) {
        return res.status(400).json({ error: 'vision_id, name e start_date sao obrigatorios' });
      }

      // Verificar se ja existe periodo ativo
      const [activePeriods] = await pool.query(
        'SELECT id FROM periods WHERE status = "active"'
      );

      if (activePeriods.length > 0) {
        return res.status(400).json({ error: 'Ja existe um periodo ativo. Finalize-o antes de criar um novo.' });
      }

      // Calcular end_date (12 semanas = 84 dias)
      const startDate = new Date(start_date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 83); // 12 semanas - 1 dia

      const [result] = await pool.query(
        'INSERT INTO periods (vision_id, name, start_date, end_date) VALUES (?, ?, ?, ?)',
        [vision_id, name, start_date, endDate.toISOString().split('T')[0]]
      );

      const [period] = await pool.query(
        'SELECT * FROM periods WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json(period[0]);
    } catch (error) {
      console.error('Erro ao criar periodo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/periods/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, status } = req.body;

      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }

      if (status) {
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Nenhum campo para atualizar' });
      }

      values.push(id);

      const [result] = await pool.query(
        `UPDATE periods SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Periodo nao encontrado' });
      }

      const [period] = await pool.query(
        'SELECT * FROM periods WHERE id = ?',
        [id]
      );

      return res.json(period[0]);
    } catch (error) {
      console.error('Erro ao atualizar periodo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/periods/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        'DELETE FROM periods WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Periodo nao encontrado' });
      }

      return res.json({ message: 'Periodo excluido com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir periodo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/periods/:id/summary
  async getSummary(req, res) {
    try {
      const { id } = req.params;

      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE id = ?',
        [id]
      );

      if (periods.length === 0) {
        return res.status(404).json({ error: 'Periodo nao encontrado' });
      }

      const period = periods[0];

      // Calcular semana atual
      const startDate = new Date(period.start_date);
      const today = new Date();
      const diffTime = today - startDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      // Buscar estatisticas
      const [goalsCount] = await pool.query(
        'SELECT COUNT(*) as count FROM goals WHERE period_id = ?',
        [id]
      );

      const [tasksStats] = await pool.query(`
        SELECT
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN t.is_active = 1 THEN t.id END) as active_tasks
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        WHERE g.period_id = ?
      `, [id]);

      // Calcular lead indicator (% tarefas completadas na semana)
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (currentWeek - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [weekLogs] = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
        FROM task_logs tl
        JOIN tasks t ON tl.task_id = t.id
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        WHERE g.period_id = ?
        AND tl.log_date BETWEEN ? AND ?
      `, [id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);

      const leadIndicator = weekLogs[0].total > 0
        ? Math.round((weekLogs[0].completed / weekLogs[0].total) * 100)
        : 0;

      // Dias restantes
      const endDate = new Date(period.end_date);
      const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

      return res.json({
        period,
        currentWeek,
        daysRemaining,
        goalsCount: goalsCount[0].count,
        tasksCount: tasksStats[0].total_tasks,
        activeTasksCount: tasksStats[0].active_tasks,
        leadIndicator,
        weekCompleted: weekLogs[0].completed || 0,
        weekTotal: weekLogs[0].total || 0
      });
    } catch (error) {
      console.error('Erro ao buscar resumo do periodo:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = periodController;
