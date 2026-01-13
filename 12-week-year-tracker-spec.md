# 12 Week Year Tracker - Especificação Técnica

## Visão Geral

Sistema de rastreamento de metas pessoais baseado na metodologia "12 Week Year" (1 Ano em 12 Semanas). O sistema permite cadastrar objetivos em períodos de 12 semanas, com acompanhamento diário via Telegram e dashboard web completo com gráficos e indicadores de desempenho.

**Uso:** Pessoal (single user)

---

## Stack Tecnológica

- **Backend:** Node.js (Express)
- **Banco de Dados:** MySQL
- **Frontend:** React com gráficos (Chart.js ou Recharts)
- **Bot:** Telegram Bot API
- **Agendamento:** node-cron para notificações

---

## Hierarquia do Sistema

```
Visão (longo prazo)
  └── Período de 12 Semanas
        └── Meta de 12 Semanas
              └── Tática Semanal
                    └── Tarefa Diária (recorrente em dias específicos)
```

---

## Estrutura do Banco de Dados

### Tabela: `visions`
Visões de longo prazo do usuário.

```sql
CREATE TABLE visions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabela: `periods`
Períodos de 12 semanas.

```sql
CREATE TABLE periods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vision_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL, -- Sempre 12 semanas após start_date
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vision_id) REFERENCES visions(id) ON DELETE CASCADE
);
```

**Regra:** Só pode existir UM período ativo por vez. Novo período só pode ser criado quando o atual terminar.

### Tabela: `goals`
Metas de 12 semanas.

```sql
CREATE TABLE goals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  period_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
);
```

### Tabela: `tactics`
Táticas semanais para atingir as metas.

```sql
CREATE TABLE tactics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  goal_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
);
```

### Tabela: `tasks`
Tarefas diárias recorrentes.

```sql
CREATE TABLE tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tactic_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Tipo de métrica
  metric_type ENUM('boolean', 'pages', 'hours', 'custom') NOT NULL DEFAULT 'boolean',
  
  -- Para métricas quantitativas
  total_target DECIMAL(10,2) NULL,          -- Ex: 100 (páginas), 50 (horas)
  unit VARCHAR(50) NULL,                     -- Ex: 'páginas', 'horas', 'minutos'
  speed_per_hour DECIMAL(10,2) NULL,         -- Ex: 30 (páginas por hora)
  daily_time_minutes INT NULL,               -- Tempo dedicado por dia em minutos
  
  -- Cálculo automático
  daily_target DECIMAL(10,2) NULL,           -- Meta diária calculada automaticamente
  
  -- Dias da semana (bitmask: Dom=1, Seg=2, Ter=4, Qua=8, Qui=16, Sex=32, Sáb=64)
  weekdays TINYINT NOT NULL DEFAULT 127,     -- 127 = todos os dias
  
  -- Horário de notificação
  notification_time TIME NOT NULL DEFAULT '20:00:00',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON DELETE CASCADE
);
```

**Exemplo de cálculo de `daily_target`:**
- Livro: 100 páginas, velocidade 30 páginas/hora, 1h/dia = 30 páginas/dia
- Curso: 50 horas de vídeo, 2h/dia = não usa velocidade, apenas tempo

### Tabela: `task_logs`
Registro de execução das tarefas (histórico permanente).

```sql
CREATE TABLE task_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  log_date DATE NOT NULL,
  week_number TINYINT NOT NULL,             -- Semana 1-12 do período
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  
  -- Progresso acumulado até esta data
  accumulated_progress DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_task_date (task_id, log_date)
);
```

### Tabela: `telegram_config`
Configuração do Telegram do usuário.

```sql
CREATE TABLE telegram_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chat_id VARCHAR(100) NOT NULL,
  username VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Tabela: `notification_queue`
Fila de notificações enviadas (para controle).

```sql
CREATE TABLE notification_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  scheduled_time DATETIME NOT NULL,
  sent_at TIMESTAMP NULL,
  message_id VARCHAR(100) NULL,             -- ID da mensagem no Telegram
  tasks_included JSON NOT NULL,              -- Array de task_ids incluídos
  status ENUM('pending', 'sent', 'responded') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Regras de Negócio

### Cálculo de Meta Diária

Para tarefas com métrica quantitativa:

```javascript
// Para livros/leitura (páginas)
daily_target = speed_per_hour * (daily_time_minutes / 60)
// Ex: 30 páginas/hora * 1 hora = 30 páginas/dia

// Para cursos/vídeos (horas)
daily_target = daily_time_minutes / 60
// Ex: 120 minutos = 2 horas/dia
```

### Redistribuição de Meta Não Cumprida

Quando uma tarefa NÃO é completada em um dia:

```javascript
// Calcular dias restantes no período
const diasRestantes = calcularDiasRestantes(task, periodo);

// Calcular quanto falta
const progressoAtual = getProgressoAcumulado(task);
const faltante = task.total_target - progressoAtual;

// Nova meta diária
const novaDailyTarget = faltante / diasRestantes;

// Atualizar task.daily_target
```

**Importante:** A redistribuição considera apenas os dias em que a tarefa está programada (baseado no `weekdays`).

### Cálculo de Dias da Semana

```javascript
// Bitmask para dias da semana
const WEEKDAYS = {
  DOMINGO: 1,    // 2^0
  SEGUNDA: 2,    // 2^1
  TERCA: 4,      // 2^2
  QUARTA: 8,     // 2^3
  QUINTA: 16,    // 2^4
  SEXTA: 32,     // 2^5
  SABADO: 64     // 2^6
};

// Verificar se tarefa é para hoje
function isTaskForToday(task) {
  const hoje = new Date().getDay(); // 0-6 (Dom-Sáb)
  const bitmask = Math.pow(2, hoje);
  return (task.weekdays & bitmask) !== 0;
}

// Contar dias restantes no período para esta tarefa
function countRemainingDays(task, period) {
  let count = 0;
  let currentDate = new Date();
  const endDate = new Date(period.end_date);
  
  while (currentDate <= endDate) {
    const dayBit = Math.pow(2, currentDate.getDay());
    if ((task.weekdays & dayBit) !== 0) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return count;
}
```

### Semanas do Período

```javascript
// Calcular semana atual (1-12)
function getCurrentWeek(period) {
  const start = new Date(period.start_date);
  const today = new Date();
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.min(12, Math.floor(diffDays / 7) + 1);
}
```

---

## Integração Telegram

### Fluxo de Notificação

1. **Agendamento:** O sistema agrupa todas as tarefas do dia por horário de notificação
2. **Envio:** No horário configurado, envia UMA mensagem com todas as tarefas pendentes
3. **Interação:** Usuário clica em botões inline (✅/❌) para cada tarefa
4. **Atualização:** Sistema registra no `task_logs` e recalcula indicadores

### Formato da Mensagem

```
📋 Tarefas de Hoje - Segunda, 13/01

1. 📖 Ler livro "Os 7 Hábitos" (30 páginas)
   [✅ Feito] [❌ Não fiz]

2. 🇬🇧 Estudar inglês (1h)
   [✅ Feito] [❌ Não fiz]

3. 🧘 Meditar 10 minutos
   [✅ Feito] [❌ Não fiz]

📊 Progresso da Semana: 68%
```

### Callback dos Botões

```javascript
// Callback data format: action_taskId_logDate
// Exemplo: "done_5_2025-01-13" ou "skip_5_2025-01-13"

bot.on('callback_query', async (query) => {
  const [action, taskId, logDate] = query.data.split('_');
  
  if (action === 'done') {
    await markTaskCompleted(taskId, logDate);
    // Atualiza mensagem com ✅ verde
  } else if (action === 'skip') {
    await markTaskSkipped(taskId, logDate);
    await redistributeTarget(taskId);
    // Atualiza mensagem com ❌ vermelho
  }
  
  // Edita a mensagem original atualizando o botão clicado
  await bot.editMessageReplyMarkup(...);
});
```

### Comandos do Bot

| Comando | Descrição |
|---------|-----------|
| `/start` | Registra chat_id e inicia bot |
| `/hoje` | Lista tarefas de hoje |
| `/semana` | Resumo da semana atual |
| `/progresso` | Progresso geral do período |

---

## Dashboard Web

### Telas Necessárias

#### 1. Dashboard Principal
- **Resumo do período atual:** Semana X de 12, dias restantes
- **Gráfico de pizza:** % de tarefas completadas na semana
- **Gráfico de linha:** Evolução semanal (12 pontos)
- **Lead Indicator:** % de tarefas semanais completadas
- **Lag Indicator:** % de progresso nas metas
- **Cards por meta:** Progresso individual de cada meta

#### 2. Gestão de Visões
- CRUD de visões de longo prazo
- Lista de períodos associados

#### 3. Gestão de Períodos
- Criar novo período (só quando não houver ativo)
- Ver períodos anteriores (histórico)
- Detalhes do período com todas as metas

#### 4. Gestão de Metas
- CRUD de metas dentro do período
- Associar táticas às metas

#### 5. Gestão de Táticas
- CRUD de táticas
- Associar tarefas às táticas

#### 6. Gestão de Tarefas
- CRUD de tarefas
- Configurar:
  - Tipo de métrica (boolean/pages/hours/custom)
  - Total alvo (para métricas quantitativas)
  - Velocidade por hora
  - Tempo diário dedicado
  - Dias da semana
  - Horário de notificação

#### 7. Calendário/Histórico
- Visualização em calendário das tarefas
- Cores: verde (feito), vermelho (não feito), cinza (futuro)
- Filtro por tarefa/meta/período

#### 8. Relatórios
- Relatório semanal detalhado
- Comparativo entre semanas
- Taxa de conclusão por meta
- Histórico completo de todos os períodos

### Indicadores e Métricas

```javascript
// Lead Indicator - % de tarefas completadas na semana
const leadIndicator = (tarefasCompletadasSemana / totalTarefasSemana) * 100;

// Lag Indicator - % de progresso nas metas
const lagIndicator = goals.reduce((acc, goal) => {
  const tasks = getTasksByGoal(goal.id);
  const avgProgress = tasks.reduce((sum, task) => {
    if (task.metric_type === 'boolean') {
      return sum + (getCompletionRate(task) * 100);
    }
    return sum + ((task.accumulated_progress / task.total_target) * 100);
  }, 0) / tasks.length;
  return acc + avgProgress;
}, 0) / goals.length;

// Progresso individual da tarefa com métrica
const taskProgress = (accumulated_progress / total_target) * 100;
// Ex: 450 páginas lidas / 600 total = 75%
```

### Gráficos

1. **Gráfico de Linha (Evolução Semanal)**
   - Eixo X: Semanas 1-12
   - Eixo Y: % de conclusão
   - Duas linhas: Lead Indicator e Lag Indicator

2. **Gráfico de Pizza (Semana Atual)**
   - Tarefas completadas vs pendentes vs não feitas

3. **Gráfico de Barras (Por Meta)**
   - Uma barra por meta mostrando % de progresso

4. **Gráfico de Área (Progresso Acumulado)**
   - Para tarefas com métricas (páginas, horas)
   - Mostra progresso real vs esperado

---

## API Endpoints

### Visões
```
GET    /api/visions
POST   /api/visions
GET    /api/visions/:id
PUT    /api/visions/:id
DELETE /api/visions/:id
```

### Períodos
```
GET    /api/periods
POST   /api/periods
GET    /api/periods/:id
GET    /api/periods/active         # Retorna período ativo
GET    /api/periods/:id/summary    # Resumo com métricas
```

### Metas
```
GET    /api/periods/:periodId/goals
POST   /api/periods/:periodId/goals
GET    /api/goals/:id
PUT    /api/goals/:id
DELETE /api/goals/:id
GET    /api/goals/:id/progress     # Progresso da meta
```

### Táticas
```
GET    /api/goals/:goalId/tactics
POST   /api/goals/:goalId/tactics
GET    /api/tactics/:id
PUT    /api/tactics/:id
DELETE /api/tactics/:id
```

### Tarefas
```
GET    /api/tactics/:tacticId/tasks
POST   /api/tactics/:tacticId/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
GET    /api/tasks/today            # Tarefas de hoje
GET    /api/tasks/:id/logs         # Histórico da tarefa
```

### Logs
```
POST   /api/tasks/:taskId/complete    # Marcar como feito
POST   /api/tasks/:taskId/skip        # Marcar como não feito
GET    /api/logs/week/:weekNumber     # Logs da semana
GET    /api/logs/calendar             # Dados para calendário
```

### Dashboard
```
GET    /api/dashboard/summary         # Dados do dashboard
GET    /api/dashboard/weekly-chart    # Dados do gráfico semanal
GET    /api/dashboard/goals-progress  # Progresso por meta
```

### Telegram
```
POST   /api/telegram/webhook          # Webhook do Telegram
GET    /api/telegram/config           # Configuração atual
POST   /api/telegram/test             # Enviar mensagem de teste
```

---

## Estrutura de Pastas Sugerida

```
12-week-tracker/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── telegram.js
│   │   ├── controllers/
│   │   │   ├── visionController.js
│   │   │   ├── periodController.js
│   │   │   ├── goalController.js
│   │   │   ├── tacticController.js
│   │   │   ├── taskController.js
│   │   │   ├── logController.js
│   │   │   └── dashboardController.js
│   │   ├── models/
│   │   │   ├── Vision.js
│   │   │   ├── Period.js
│   │   │   ├── Goal.js
│   │   │   ├── Tactic.js
│   │   │   ├── Task.js
│   │   │   └── TaskLog.js
│   │   ├── routes/
│   │   │   └── index.js
│   │   ├── services/
│   │   │   ├── telegramBot.js
│   │   │   ├── notificationService.js
│   │   │   ├── calculationService.js
│   │   │   └── redistributionService.js
│   │   ├── jobs/
│   │   │   └── notificationJob.js
│   │   └── app.js
│   ├── migrations/
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── Charts/
│   │   │   ├── Forms/
│   │   │   └── Calendar/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Visions.jsx
│   │   │   ├── Periods.jsx
│   │   │   ├── Goals.jsx
│   │   │   ├── Tasks.jsx
│   │   │   └── History.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── hooks/
│   │   ├── context/
│   │   └── App.jsx
│   └── package.json
└── README.md
```

---

## Fluxo de Uso

### Configuração Inicial
1. Usuário acessa o painel web
2. Cria uma Visão de longo prazo
3. Inicia um Período de 12 semanas
4. Cadastra Metas para o período
5. Define Táticas para cada meta
6. Cria Tarefas para cada tática (com métricas, dias, horário)
7. Conecta o Telegram (/start no bot)

### Uso Diário
1. No horário configurado, recebe notificação no Telegram
2. Clica ✅ ou ❌ para cada tarefa
3. Sistema atualiza progresso automaticamente
4. Se não fez, redistribui a meta nos dias restantes

### Fim de Período
1. Período encerra automaticamente após 12 semanas
2. Sistema calcula métricas finais
3. Histórico fica disponível para consulta
4. Usuário pode criar novo período

---

## Variáveis de Ambiente

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=twelve_week_tracker

# Telegram
TELEGRAM_BOT_TOKEN=seu_token_aqui

# App
PORT=3000
NODE_ENV=development
```

---

## Considerações Técnicas

1. **Timezone:** Usar timezone do Brasil (America/Sao_Paulo) para cálculos de data
2. **Cron Jobs:** Executar a cada minuto para verificar notificações pendentes
3. **Webhook vs Polling:** Usar webhook do Telegram em produção
4. **Backup:** Configurar backup automático do MySQL
5. **Logs:** Manter logs de todas as operações para debug

---

## Próximos Passos para Implementação

1. Configurar ambiente Node.js com Express
2. Criar banco de dados e rodar migrations
3. Implementar models e controllers
4. Criar bot do Telegram e configurar webhook
5. Implementar sistema de notificações com node-cron
6. Desenvolver frontend React com dashboard
7. Implementar gráficos com Recharts
8. Testar fluxo completo
9. Deploy em VPS
