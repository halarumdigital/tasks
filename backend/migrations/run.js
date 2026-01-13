const { pool } = require('../src/config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const tables = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS visions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS periods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vision_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vision_id) REFERENCES visions(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS goals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    period_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS tactics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    goal_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tactic_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type ENUM('boolean', 'pages', 'hours', 'custom') NOT NULL DEFAULT 'boolean',
    total_target DECIMAL(10,2) NULL,
    unit VARCHAR(50) NULL,
    speed_per_hour DECIMAL(10,2) NULL,
    daily_time_minutes INT NULL,
    daily_target DECIMAL(10,2) NULL,
    weekdays TINYINT NOT NULL DEFAULT 127,
    notification_time TIME NOT NULL DEFAULT '20:00:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS task_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    log_date DATE NOT NULL,
    week_number TINYINT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    accumulated_progress DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_task_date (task_id, log_date)
  )`,

  `CREATE TABLE IF NOT EXISTS telegram_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(100) NOT NULL,
    username VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS notification_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scheduled_time DATETIME NOT NULL,
    sent_at TIMESTAMP NULL,
    message_id VARCHAR(100) NULL,
    tasks_included JSON NOT NULL,
    status ENUM('pending', 'sent', 'responded') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

const runMigrations = async () => {
  console.log('Iniciando migrations...\n');

  let connection;
  try {
    connection = await pool.getConnection();

    // Criar tabelas
    for (let i = 0; i < tables.length; i++) {
      const sql = tables[i];
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      try {
        await connection.query(sql);
        console.log(`[${i + 1}/${tables.length}] Tabela '${tableName}' OK`);
      } catch (err) {
        console.error(`Erro na tabela '${tableName}':`, err.message);
      }
    }

    // Criar usuario admin
    console.log('\nVerificando usuario admin...');
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      [process.env.ADMIN_USERNAME]
    );

    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      await connection.query(
        'INSERT INTO users (username, password, name) VALUES (?, ?, ?)',
        [process.env.ADMIN_USERNAME, hashedPassword, 'Administrador']
      );
      console.log('Usuario admin criado!');
    } else {
      console.log('Usuario admin ja existe.');
    }

    console.log('\n✓ Migrations executadas com sucesso!');
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    if (connection) connection.release();
    await pool.end();
    process.exit(0);
  }
};

runMigrations();
