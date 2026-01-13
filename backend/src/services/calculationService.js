const { pool } = require('../config/database');

const calculationService = {
  // Calcular meta diaria baseado no tipo de metrica
  calculateDailyTarget(task) {
    const { metric_type, total_target, speed_per_hour, daily_time_minutes, weekdays } = task;

    if (metric_type === 'boolean' || !total_target) {
      return null;
    }

    // Para metricas de paginas (usa velocidade de leitura)
    if (metric_type === 'pages' && speed_per_hour && daily_time_minutes) {
      return speed_per_hour * (daily_time_minutes / 60);
    }

    // Para metricas de horas
    if (metric_type === 'hours' && daily_time_minutes) {
      return daily_time_minutes / 60;
    }

    // Para metricas custom, calcular baseado no total e dias disponiveis
    // Estimar 12 semanas * dias por semana
    const daysPerWeek = this.countBitsSet(weekdays || 127);
    const totalDays = 12 * daysPerWeek;

    if (totalDays > 0) {
      return total_target / totalDays;
    }

    return null;
  },

  // Contar bits setados (dias da semana ativos)
  countBitsSet(n) {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  },

  // Verificar se tarefa e para um dia especifico
  isTaskForDay(task, date) {
    const dayOfWeek = date.getDay(); // 0-6 (Dom-Sab)
    const bitmask = Math.pow(2, dayOfWeek);
    return (task.weekdays & bitmask) !== 0;
  },

  // Contar dias restantes no periodo para esta tarefa
  async countRemainingDays(taskId) {
    const [tasks] = await pool.query(`
      SELECT t.weekdays, p.end_date
      FROM tasks t
      JOIN tactics tc ON t.tactic_id = tc.id
      JOIN goals g ON tc.goal_id = g.id
      JOIN periods p ON g.period_id = p.id
      WHERE t.id = ?
    `, [taskId]);

    if (tasks.length === 0) {
      return 0;
    }

    const task = tasks[0];
    let count = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(task.end_date);

    while (currentDate <= endDate) {
      const dayBit = Math.pow(2, currentDate.getDay());
      if ((task.weekdays & dayBit) !== 0) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return count;
  },

  // Calcular semana atual do periodo (1-12)
  getCurrentWeek(period) {
    const start = new Date(period.start_date);
    const today = new Date();
    const diffTime = today - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));
  },

  // Calcular progresso esperado ate a data atual
  calculateExpectedProgress(task, period) {
    if (task.metric_type === 'boolean' || !task.total_target) {
      return null;
    }

    const startDate = new Date(period.start_date);
    const today = new Date();
    const endDate = new Date(period.end_date);

    // Contar dias que a tarefa deveria ter sido feita ate hoje
    let daysElapsed = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= today && currentDate <= endDate) {
      const dayBit = Math.pow(2, currentDate.getDay());
      if ((task.weekdays & dayBit) !== 0) {
        daysElapsed++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Contar total de dias no periodo
    let totalDays = 0;
    currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayBit = Math.pow(2, currentDate.getDay());
      if ((task.weekdays & dayBit) !== 0) {
        totalDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (totalDays === 0) return 0;

    return (daysElapsed / totalDays) * task.total_target;
  },

  // Formatar dias da semana para exibicao
  formatWeekdays(weekdays) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    const result = [];

    for (let i = 0; i < 7; i++) {
      if ((weekdays & Math.pow(2, i)) !== 0) {
        result.push(days[i]);
      }
    }

    return result.join(', ');
  },

  // Converter array de dias para bitmask
  daysArrayToBitmask(daysArray) {
    let bitmask = 0;
    for (const day of daysArray) {
      bitmask |= Math.pow(2, day);
    }
    return bitmask;
  },

  // Converter bitmask para array de dias
  bitmaskToDaysArray(bitmask) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      if ((bitmask & Math.pow(2, i)) !== 0) {
        days.push(i);
      }
    }
    return days;
  }
};

module.exports = calculationService;
