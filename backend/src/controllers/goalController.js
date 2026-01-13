const { pool } = require('../config/database');

const goalController = {
  // GET /api/goals
  async list(req, res) {
    try {
      const { period_id } = req.query;

      let query = `
        SELECT g.*, p.name as period_name
        FROM goals g
        JOIN periods p ON g.period_id = p.id
      `;
      const params = [];

      if (period_id) {
        query += ' WHERE g.period_id = ?';
        params.push(period_id);
      }

      query += ' ORDER BY g.created_at DESC';

      const [goals] = await pool.query(query, params);
      return res.json(goals);
    } catch (error) {
      console.error('Erro ao listar metas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/goals/:id
  async get(req, res) {
    try {
      const { id } = req.params;
      const [goals] = await pool.query(`
        SELECT g.*, p.name as period_name
        FROM goals g
        JOIN periods p ON g.period_id = p.id
        WHERE g.id = ?
      `, [id]);

      if (goals.length === 0) {
        return res.status(404).json({ error: 'Meta nao encontrada' });
      }

      // Buscar taticas da meta
      const [tactics] = await pool.query(
        'SELECT * FROM tactics WHERE goal_id = ?',
        [id]
      );

      return res.json({ ...goals[0], tactics });
    } catch (error) {
      console.error('Erro ao buscar meta:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/goals
  async create(req, res) {
    try {
      const { period_id, title, description } = req.body;

      if (!period_id || !title) {
        return res.status(400).json({ error: 'period_id e title sao obrigatorios' });
      }

      // Verificar se periodo existe
      const [periods] = await pool.query(
        'SELECT id FROM periods WHERE id = ?',
        [period_id]
      );

      if (periods.length === 0) {
        return res.status(404).json({ error: 'Periodo nao encontrado' });
      }

      const [result] = await pool.query(
        'INSERT INTO goals (period_id, title, description) VALUES (?, ?, ?)',
        [period_id, title, description || null]
      );

      const [goal] = await pool.query(
        'SELECT * FROM goals WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json(goal[0]);
    } catch (error) {
      console.error('Erro ao criar meta:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/goals/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title e obrigatorio' });
      }

      const [result] = await pool.query(
        'UPDATE goals SET title = ?, description = ? WHERE id = ?',
        [title, description || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Meta nao encontrada' });
      }

      const [goal] = await pool.query(
        'SELECT * FROM goals WHERE id = ?',
        [id]
      );

      return res.json(goal[0]);
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/goals/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        'DELETE FROM goals WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Meta nao encontrada' });
      }

      return res.json({ message: 'Meta excluida com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/goals/:id/progress
  async getProgress(req, res) {
    try {
      const { id } = req.params;

      const [goals] = await pool.query(
        'SELECT * FROM goals WHERE id = ?',
        [id]
      );

      if (goals.length === 0) {
        return res.status(404).json({ error: 'Meta nao encontrada' });
      }

      // Buscar tarefas da meta e calcular progresso
      const [tasks] = await pool.query(`
        SELECT t.*,
          (SELECT MAX(accumulated_progress) FROM task_logs WHERE task_id = t.id) as current_progress
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        WHERE tc.goal_id = ?
      `, [id]);

      let totalProgress = 0;
      let taskCount = 0;

      for (const task of tasks) {
        if (task.metric_type === 'boolean') {
          // Para boolean, calcular taxa de conclusao
          const [logs] = await pool.query(
            'SELECT COUNT(*) as total, SUM(completed) as completed FROM task_logs WHERE task_id = ?',
            [task.id]
          );
          if (logs[0].total > 0) {
            totalProgress += (logs[0].completed / logs[0].total) * 100;
            taskCount++;
          }
        } else if (task.total_target) {
          // Para metricas quantitativas
          const progress = task.current_progress || 0;
          totalProgress += (progress / task.total_target) * 100;
          taskCount++;
        }
      }

      const avgProgress = taskCount > 0 ? Math.round(totalProgress / taskCount) : 0;

      return res.json({
        goal: goals[0],
        progress: avgProgress,
        tasks: tasks.length,
        taskDetails: tasks
      });
    } catch (error) {
      console.error('Erro ao buscar progresso da meta:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = goalController;
