const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');
const visionController = require('../controllers/visionController');
const periodController = require('../controllers/periodController');
const goalController = require('../controllers/goalController');
const tacticController = require('../controllers/tacticController');
const taskController = require('../controllers/taskController');
const logController = require('../controllers/logController');
const dashboardController = require('../controllers/dashboardController');

// Rotas publicas
router.post('/auth/login', authController.login);

// Middleware de autenticacao para rotas protegidas
router.use(authMiddleware);

// Rotas de autenticacao
router.get('/auth/me', authController.me);
router.put('/auth/password', authController.changePassword);

// Rotas de visoes
router.get('/visions', visionController.list);
router.post('/visions', visionController.create);
router.get('/visions/:id', visionController.get);
router.put('/visions/:id', visionController.update);
router.delete('/visions/:id', visionController.delete);

// Rotas de periodos
router.get('/periods', periodController.list);
router.get('/periods/active', periodController.getActive);
router.post('/periods', periodController.create);
router.get('/periods/:id', periodController.get);
router.put('/periods/:id', periodController.update);
router.delete('/periods/:id', periodController.delete);
router.get('/periods/:id/summary', periodController.getSummary);
router.post('/periods/:id/clone', periodController.clone);

// Rotas de metas
router.get('/goals', goalController.list);
router.post('/goals', goalController.create);
router.get('/goals/:id', goalController.get);
router.put('/goals/:id', goalController.update);
router.delete('/goals/:id', goalController.delete);
router.get('/goals/:id/progress', goalController.getProgress);

// Rotas de taticas
router.get('/tactics', tacticController.list);
router.post('/tactics', tacticController.create);
router.get('/tactics/:id', tacticController.get);
router.put('/tactics/:id', tacticController.update);
router.delete('/tactics/:id', tacticController.delete);

// Rotas de tarefas
router.get('/tasks', taskController.list);
router.get('/tasks/today', taskController.getToday);
router.post('/tasks', taskController.create);
router.get('/tasks/:id', taskController.get);
router.put('/tasks/:id', taskController.update);
router.delete('/tasks/:id', taskController.delete);
router.get('/tasks/:id/logs', taskController.getLogs);

// Rotas de logs
router.post('/tasks/:taskId/complete', logController.complete);
router.post('/tasks/:taskId/skip', logController.skip);
router.get('/logs/week/:weekNumber', logController.getWeek);
router.get('/logs/calendar', logController.getCalendar);

// Rotas do dashboard
router.get('/dashboard/summary', dashboardController.getSummary);
router.get('/dashboard/weekly-chart', dashboardController.getWeeklyChart);
router.get('/dashboard/goals-progress', dashboardController.getGoalsProgress);

// Rota de teste
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
