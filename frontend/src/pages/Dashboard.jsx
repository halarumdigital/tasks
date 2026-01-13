import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Flag as FlagIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const StatCard = ({ title, value, subtitle, icon, color }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: `${color}.main`,
            color: 'white',
            opacity: 0.9,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [goalsProgress, setGoalsProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryRes, weeklyRes, goalsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/weekly-chart'),
        api.get('/dashboard/goals-progress'),
      ]);

      setSummary(summaryRes.data);
      setWeeklyData(weeklyRes.data);
      setGoalsProgress(goalsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados do dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="Dashboard">
        <Alert severity="error">{error}</Alert>
      </MainLayout>
    );
  }

  if (!summary?.hasPeriod) {
    return (
      <MainLayout title="Dashboard">
        <Alert severity="info">
          Nenhum periodo ativo encontrado. Crie um novo periodo para comecar a acompanhar suas metas.
        </Alert>
      </MainLayout>
    );
  }

  const pieData = [
    { name: 'Completadas', value: summary.weekStats.completed, color: '#4caf50' },
    { name: 'Pendentes', value: summary.weekStats.total - summary.weekStats.completed, color: '#ff9800' },
  ];

  return (
    <MainLayout title="Dashboard">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {summary.period.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label={`Semana ${summary.currentWeek} de ${summary.totalWeeks}`} color="primary" />
          <Chip label={`${summary.daysRemaining} dias restantes`} variant="outlined" />
        </Box>
      </Box>

      {/* Cards de estatisticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Lead Indicator"
            value={`${summary.leadIndicator}%`}
            subtitle="Tarefas da semana"
            icon={<TrendingUpIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Lag Indicator"
            value={`${summary.lagIndicator}%`}
            subtitle="Progresso geral"
            icon={<FlagIcon />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Metas Ativas"
            value={summary.goalsCount}
            subtitle={`${summary.tasksCount} tarefas`}
            icon={<CheckIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Dias Restantes"
            value={summary.daysRemaining}
            subtitle={`Semana ${summary.currentWeek}`}
            icon={<ScheduleIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Graficos */}
      <Grid container spacing={3}>
        {/* Grafico de evolucao semanal */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Evolucao Semanal
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line
                      type="monotone"
                      dataKey="leadIndicator"
                      stroke="#1976d2"
                      strokeWidth={2}
                      name="% Conclusao"
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Grafico de pizza da semana */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Semana Atual
              </Typography>
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {summary.weekStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">
                    Nenhuma tarefa registrada esta semana
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Progresso por meta */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progresso por Meta
              </Typography>
              {goalsProgress.length > 0 ? (
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={goalsProgress} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="title" type="category" width={150} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="progress" fill="#1976d2" name="Progresso" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography color="text.secondary">
                  Nenhuma meta cadastrada ainda
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Lista de metas com progresso */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detalhes das Metas
              </Typography>
              {goalsProgress.length > 0 ? (
                <Grid container spacing={2}>
                  {goalsProgress.map((goal) => (
                    <Grid item xs={12} sm={6} md={4} key={goal.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {goal.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {goal.tasksCount} tarefas
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={goal.progress}
                              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                            />
                            <Typography variant="body2" fontWeight={600}>
                              {goal.progress}%
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography color="text.secondary">
                  Crie metas para acompanhar seu progresso
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </MainLayout>
  );
};

export default Dashboard;
