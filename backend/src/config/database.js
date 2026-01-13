const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-03:00'
});

// Testar conexão
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Conexao com MySQL estabelecida com sucesso!');
    connection.release();
    return true;
  } catch (error) {
    console.error('Erro ao conectar com MySQL:', error.message);
    return false;
  }
};

module.exports = { pool, testConnection };
