const { pool } = require('../config/database');

const dashboardController = {
  // GET /api/dashboard/summary
  async getSummary(req, res) {
    try {
      // Buscar periodo ativo
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        return res.json({
          hasPeriod: false,
          message: 'Nenhum periodo ativo encontrado'
        });
      }

      const period = periods[0];

      // Calcular semana atual
      const startDate = new Date(period.start_date);
      const today = new Date();
      const diffTime = today - startDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const currentWeek = Math.min(12, Math.max(1, Math.floor(diffDays / 7) + 1));

      // Dias restantes
      const endDate = new Date(period.end_date);
      const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

      // Contar metas
      const [goalsCount] = await pool.query(
        'SELECT COUNT(*) as count FROM goals WHERE period_id = ?',
        [period.id]
      );

      // Buscar todas as tarefas do periodo ativo
      const [allTasks] = await pool.query(`
        SELECT t.*
        FROM tasks t
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        WHERE g.period_id = ? AND t.is_active = 1
      `, [period.id]);

      // Calcular inicio e fim da semana atual
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (currentWeek - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Buscar logs da semana atual
      const [weekLogs] = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
        FROM task_logs tl
        JOIN tasks t ON tl.task_id = t.id
        JOIN tactics tc ON t.tactic_id = tc.id
        JOIN goals g ON tc.goal_id = g.id
        WHERE g.period_id = ?
        AND tl.log_date BETWEEN ? AND ?
      `, [period.id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);

      // Lead Indicator - % tarefas completadas na semana
      const leadIndicator = weekLogs[0].total > 0
        ? Math.round((weekLogs[0].completed / weekLogs[0].total) * 100)
        : 0;

      // Lag Indicator - Calcular progresso medio das metas
      let totalLagProgress = 0;
      let lagCount = 0;

      for (const task of allTasks) {
        if (task.metric_type === 'boolean') {
          const [logs] = await pool.query(
            'SELECT COUNT(*) as total, SUM(completed) as completed FROM task_logs WHERE task_id = ?',
            [task.id]
          );
          if (logs[0].total > 0) {
            totalLagProgress += (logs[0].completed / logs[0].total) * 100;
            lagCount++;
          }
        } else if (task.total_target) {
          const [logs] = await pool.query(
            'SELECT MAX(accumulated_progress) as progress FROM task_logs WHERE task_id = ?',
            [task.id]
          );
          const progress = logs[0].progress || 0;
          totalLagProgress += (progress / task.total_target) * 100;
          lagCount++;
        }
      }

      const lagIndicator = lagCount > 0 ? Math.round(totalLagProgress / lagCount) : 0;

      return res.json({
        hasPeriod: true,
        period: {
          id: period.id,
          name: period.name,
          start_date: period.start_date,
          end_date: period.end_date
        },
        currentWeek,
        totalWeeks: 12,
        daysRemaining,
        goalsCount: goalsCount[0].count,
        tasksCount: allTasks.length,
        leadIndicator,
        lagIndicator,
        weekStats: {
          completed: weekLogs[0].completed || 0,
          total: weekLogs[0].total || 0
        }
      });
    } catch (error) {
      console.error('Erro ao buscar resumo do dashboard:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/dashboard/weekly-chart
  async getWeeklyChart(req, res) {
    try {
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        return res.json([]);
      }

      const period = periods[0];
      const chartData = [];

      // Para cada semana (1-12), calcular indicadores
      for (let week = 1; week <= 12; week++) {
        const weekStart = new Date(period.start_date);
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const [weekStats] = await pool.query(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
          FROM task_logs tl
          JOIN tasks t ON tl.task_id = t.id
          JOIN tactics tc ON t.tactic_id = tc.id
          JOIN goals g ON tc.goal_id = g.id
          WHERE g.period_id = ?
          AND tl.week_number = ?
        `, [period.id, week]);

        const leadIndicator = weekStats[0].total > 0
          ? Math.round((weekStats[0].completed / weekStats[0].total) * 100)
          : 0;

        chartData.push({
          week,
          name: `S${week}`,
          leadIndicator,
          completed: weekStats[0].completed || 0,
          total: weekStats[0].total || 0
        });
      }

      return res.json(chartData);
    } catch (error) {
      console.error('Erro ao buscar dados do grafico semanal:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  // GET /api/dashboard/goals-progress
  async getGoalsProgress(req, res) {
    try {
      const [periods] = await pool.query(
        'SELECT * FROM periods WHERE status = "active" LIMIT 1'
      );

      if (periods.length === 0) {
        return res.json([]);
      }

      const period = periods[0];

      const [goals] = await pool.query(
        'SELECT * FROM goals WHERE period_id = ?',
        [period.id]
      );

      const goalsProgress = [];

      for (const goal of goals) {
        // Buscar tarefas da meta
        const [tasks] = await pool.query(`
          SELECT t.*
          FROM tasks t
          JOIN tactics tc ON t.tactic_id = tc.id
          WHERE tc.goal_id = ?
        `, [goal.id]);

        let totalProgress = 0;
        let taskCount = 0;

        for (const task of tasks) {
          if (task.metric_type === 'boolean') {
            const [logs] = await pool.query(
              'SELECT COUNT(*) as total, SUM(completed) as completed FROM task_logs WHERE task_id = ?',
              [task.id]
            );
            if (logs[0].total > 0) {
              totalProgress += (logs[0].completed / logs[0].total) * 100;
              taskCount++;
            }
          } else if (task.total_target) {
            const [logs] = await pool.query(
              'SELECT MAX(accumulated_progress) as progress FROM task_logs WHERE task_id = ?',
              [task.id]
            );
            const progress = logs[0].progress || 0;
            totalProgress += Math.min(100, (progress / task.total_target) * 100);
            taskCount++;
          }
        }

        const avgProgress = taskCount > 0 ? Math.round(totalProgress / taskCount) : 0;

        goalsProgress.push({
          id: goal.id,
          title: goal.title,
          progress: avgProgress,
          tasksCount: tasks.length
        });
      }

      return res.json(goalsProgress);
    } catch (error) {
      console.error('Erro ao buscar progresso das metas:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = dashboardController;
