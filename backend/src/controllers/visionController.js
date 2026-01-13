const { pool } = require('../config/database');

const visionController = {
  // GET /api/visions
  async list(req, res) {
    try {
      const [visions] = await pool.query(
        'SELECT * FROM visions ORDER BY created_at DESC'
      );
      return res.json(visions);
    } catch (error) {
      console.error('Erro ao listar visoes:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/visions/:id
  async get(req, res) {
    try {
      const { id } = req.params;
      const [visions] = await pool.query(
        'SELECT * FROM visions WHERE id = ?',
        [id]
      );

      if (visions.length === 0) {
        return res.status(404).json({ error: 'Visao nao encontrada' });
      }

      // Buscar periodos associados
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE vision_id = ? ORDER BY start_date DESC',
        [id]
      );

      return res.json({ ...visions[0], periods });
    } catch (error) {
      console.error('Erro ao buscar visao:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // POST /api/visions
  async create(req, res) {
    try {
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Titulo e obrigatorio' });
      }

      const [result] = await pool.query(
        'INSERT INTO visions (title, description) VALUES (?, ?)',
        [title, description || null]
      );

      const [vision] = await pool.query(
        'SELECT * FROM visions WHERE id = ?',
        [result.insertId]
      );

      return res.status(201).json(vision[0]);
    } catch (error) {
      console.error('Erro ao criar visao:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/visions/:id
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Titulo e obrigatorio' });
      }

      const [result] = await pool.query(
        'UPDATE visions SET title = ?, description = ? WHERE id = ?',
        [title, description || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Visao nao encontrada' });
      }

      const [vision] = await pool.query(
        'SELECT * FROM visions WHERE id = ?',
        [id]
      );

      return res.json(vision[0]);
    } catch (error) {
      console.error('Erro ao atualizar visao:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // DELETE /api/visions/:id
  async delete(req, res) {
    try {
      const { id } = req.params;

      const [result] = await pool.query(
        'DELETE FROM visions WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Visao nao encontrada' });
      }

      return res.json({ message: 'Visao excluida com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir visao:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = visionController;
