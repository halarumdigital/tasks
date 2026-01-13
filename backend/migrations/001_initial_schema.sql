-- Migration: 001_initial_schema
-- Criacao das tabelas do sistema 12 Week Year Tracker

-- Tabela de usuarios (admin)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de visoes de longo prazo
CREATE TABLE IF NOT EXISTS visions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de periodos (12 semanas)
CREATE TABLE IF NOT EXISTS periods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vision_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vision_id) REFERENCES visions(id) ON DELETE CASCADE
);

-- Tabela de metas de 12 semanas
CREATE TABLE IF NOT EXISTS goals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  period_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);

-- Tabela de taticas semanais
CREATE TABLE IF NOT EXISTS tactics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  goal_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);

-- Tabela de tarefas diarias
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tactic_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Tipo de metrica
  metric_type ENUM('boolean', 'pages', 'hours', 'custom') NOT NULL DEFAULT 'boolean',

  -- Para metricas quantitativas
  total_target DECIMAL(10,2) NULL,
  unit VARCHAR(50) NULL,
  speed_per_hour DECIMAL(10,2) NULL,
  daily_time_minutes INT NULL,

  -- Calculo automatico
  daily_target DECIMAL(10,2) NULL,

  -- Dias da semana (bitmask: Dom=1, Seg=2, Ter=4, Qua=8, Qui=16, Sex=32, Sab=64)
  weekdays TINYINT NOT NULL DEFAULT 127,

  -- Horario de notificacao
  notification_time TIME NOT NULL DEFAULT '20:00:00',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON DELETE CASCADE
);

-- Tabela de logs de execucao das tarefas
CREATE TABLE IF NOT EXISTS task_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  log_date DATE NOT NULL,
  week_number TINYINT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,

  -- Progresso acumulado ate esta data
  accumulated_progress DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_task_date (task_id, log_date)
);

-- Tabela de configuracao do Telegram
CREATE TABLE IF NOT EXISTS telegram_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chat_id VARCHAR(100) NOT NULL,
  username VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de fila de notificacoes
CREATE TABLE IF NOT EXISTS notification_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  scheduled_time DATETIME NOT NULL,
  sent_at TIMESTAMP NULL,
  message_id VARCHAR(100) NULL,
  tasks_included JSON NOT NULL,
  status ENUM('pending', 'sent', 'responded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de controle de migrations
CREATE TABLE IF NOT EXISTS migrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
