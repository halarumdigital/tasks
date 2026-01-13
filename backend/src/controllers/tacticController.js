const { pool } = require('../config/database');

const tacticController = {
  // GET /api/tactics
  async list(req, res) {
    try {
      const { goal_id } = req.query;

      let query = `
        SELECT tc.*, g.title as goal_title
        FROM tactics tc
        JOIN goals g ON tc.goal_id = g.id
      `;
      const params = [];

      if (goal_id) {
        query += ' WHERE tc.goal_id = ?';
        params.push(goal_id);
      }

      query += ' ORDER BY tc.created_at DESC';

      const [tactics] = await pool.query(query, params);
      return res.json(tactics);
    } catch (error) {
      console.error('Erro ao listar taticas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/tactics/:id
  async get(req, res) {
    try {
      const { id } = req.params;
      const [tactics] = await pool.query(`
        SELECT tc.*, g.title as goal_title
        FROM tactics tc
        JOIN goals g ON tc.goal_id = g.id
        WHERE tc.id = ?
      `, [id]);

      if (tactics.length === 0) {
        return res.status(404).json({ error: 'Tatica nao encontrada' });
      }

      // Buscar tarefas da tatica
      const [tasks] = await pool.query(
        'SELECT * FROM tasks WHERE tactic_id = ?',
        [id]
      );

      return res.json({ ...tactics[0], tasks });
    } catch (error) {
      console.error('Erro ao buscar tatica:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/tactics
  async create(req, res) {
    try {
      const { goal_id, title, description } = req.body;

      if (!goal_id || !title) {
        return res.status(400).json({ error: 'goal_id e title sao obrigatorios' });
      }

      // Verificar se meta existe
      const [goals] = await pool.query(
        'SELECT id FROM goals WHERE id = ?',
        [goal_id]
      );

      if (goals.length === 0) {
        return res.status(404).json({ error: 'Meta nao encontrada' });
      }

      const [result] = await pool.query(
        'INSERT INTO tactics (goal_id, title, description) VALUES (?, ?, ?)',
        [goal_id, title, description || null]
      );

      const [tactic] = await pool.query(
        'SELECT * FROM tactics WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json(tactic[0]);
    } catch (error) {
      console.error('Erro ao criar tatica:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/tactics/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title e obrigatorio' });
      }

      const [result] = await pool.query(
        'UPDATE tactics SET title = ?, description = ? WHERE id = ?',
        [title, description || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Tatica nao encontrada' });
      }

      const [tactic] = await pool.query(
        'SELECT * FROM tactics WHERE id = ?',
        [id]
      );

      return res.json(tactic[0]);
    } catch (error) {
      console.error('Erro ao atualizar tatica:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/tactics/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        'DELETE FROM tactics WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Tatica nao encontrada' });
      }

      return res.json({ message: 'Tatica excluida com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir tatica:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = tacticController;
