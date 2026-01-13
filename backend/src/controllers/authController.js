const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const authController = {
  // POST /api/auth/login
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username e password sao obrigatorios' });
      }

      const [users] = await pool.query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
      }

      const user = users[0];
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Credenciais invalidas' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Erro no login:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/auth/me
  async me(req, res) {
    try {
      const [users] = await pool.query(
        'SELECT id, username, name, created_at FROM users WHERE id = ?',
        [req.userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Usuario nao encontrado' });
      }

      return res.json(users[0]);
    } catch (error) {
      console.error('Erro ao buscar usuario:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // PUT /api/auth/password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senhas atual e nova sao obrigatorias' });
      }

      const [users] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [req.userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ error: 'Usuario nao encontrado' });
      }

      const user = users[0];
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Senha atual incorreta' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, req.userId]
      );

      return res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = authController;
