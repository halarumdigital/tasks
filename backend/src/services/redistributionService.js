const { pool } = require('../config/database');
const calculationService = require('./calculationService');

const redistributionService = {
  // Redistribuir meta nao cumprida nos dias restantes
  async redistribute(taskId) {
    try {
      // Buscar tarefa e periodo
      const [tasks] = await pool.query(`
        SELECT t.*, p.start_date, p.end_date
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE t.id = ?
      `, [taskId]);

      if (tasks.length === 0 || tasks[0].metric_type === 'boolean') {
        return null;
      }

      const task = tasks[0];

      // Se nao tem total_target, nao redistribuir
      if (!task.total_target) {
        return null;
      }

      // Buscar progresso acumulado atual
      const [logs] = await pool.query(
        'SELECT MAX(accumulated_progress) as progress FROM task_logs WHERE task_id = ?',
        [taskId]
      );

      const currentProgress = logs[0].progress || 0;
      const remaining = task.total_target - currentProgress;

      // Se ja atingiu a meta, nao redistribuir
      if (remaining <= 0) {
        return null;
      }

      // Contar dias restantes
      const remainingDays = await calculationService.countRemainingDays(taskId);

      if (remainingDays <= 0) {
        return null;
      }

      // Calcular nova meta diaria
      const newDailyTarget = remaining / remainingDays;

      // Atualizar tarefa
      await pool.query(
        'UPDATE tasks SET daily_target = ? WHERE id = ?',
        [newDailyTarget, taskId]
      );

      return {
        taskId,
        previousDailyTarget: task.daily_target,
        newDailyTarget,
        remainingDays,
        remaining
      };
    } catch (error) {
      console.error('Erro ao redistribuir meta:', error);
      throw error;
    }
  },

  // Redistribuir todas as tarefas do periodo ativo
  async redistributeAll() {
    try {
      // Buscar todas as tarefas ativas do periodo ativo com metricas quantitativas
      const [tasks] = await pool.query(`
        SELECT t.id
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        JOIN periods p ON g.period_id = p.id
        WHERE p.status = 'active'
        AND t.is_active = 1
        AND t.metric_type != 'boolean'
        AND t.total_target IS NOT NULL
      `);

      const results = [];

      for (const task of tasks) {
        const result = await this.redistribute(task.id);
        if (result) {
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      console.error('Erro ao redistribuir todas as metas:', error);
      throw error;
    }
  }
};

module.exports = redistributionService;
