import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Schedule as PendingIcon,
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const History = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [currentMonth, selectedTask]);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks', { params: { active_only: 'true' } });
      setTasks(response.data);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const params = {
        start_date: start,
        end_date: end,
      };

      if (selectedTask) {
        params.task_id = selectedTask;
      }

      const response = await api.get('/logs/calendar', { params });
      setLogs(response.data);
    } catch (err) {
      setError('Erro ao carregar historico');
    } finally {
      setLoading(false);
    }
  };

  const getLogForDay = (date, taskId = null) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return logs.filter(log => {
      const logDate = log.log_date.split('T')[0];
      if (taskId) {
        return logDate === dateStr && log.task_id === taskId;
      }
      return logDate === dateStr;
    });
  };

  const getDayStatus = (date) => {
    const dayLogs = getLogForDay(date);
    if (dayLogs.length === 0) return 'none';

    const completed = dayLogs.filter(l => l.completed).length;
    const total = dayLogs.length;

    if (completed === total) return 'complete';
    if (completed > 0) return 'partial';
    return 'missed';
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Adicionar dias vazios no inicio
    const startDayOfWeek = monthStart.getDay();
    const emptyDays = Array(startDayOfWeek).fill(null);

    const allDays = [...emptyDays, ...days];

    // Dividir em semanas
    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <NavigateBefore />
          </IconButton>
          <Typography variant="h6">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </Typography>
          <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <NavigateNext />
          </IconButton>
        </Box>

        <Grid container spacing={0.5}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day) => (
            <Grid item xs={12 / 7} key={day}>
              <Typography
                variant="body2"
                align="center"
                fontWeight={600}
                color="text.secondary"
                sx={{ py: 1 }}
              >
                {day}
              </Typography>
            </Grid>
          ))}

          {weeks.map((week, weekIndex) => (
            <React.Fragment key={weekIndex}>
              {week.map((day, dayIndex) => {
                if (!day) {
                  return <Grid item xs={12 / 7} key={`empty-${dayIndex}`} />;
                }

                const status = getDayStatus(day);
                const dayLogs = getLogForDay(day);

                const bgColor = {
                  complete: 'success.light',
                  partial: 'warning.light',
                  missed: 'error.light',
                  none: 'transparent',
                }[status];

                return (
                  <Grid item xs={12 / 7} key={day.toISOString()}>
                    <Tooltip
                      title={
                        dayLogs.length > 0
                          ? `${dayLogs.filter(l => l.completed).length}/${dayLogs.length} tarefas`
                          : 'Sem registros'
                      }
                    >
                      <Box
                        sx={{
                          p: 1,
                          textAlign: 'center',
                          borderRadius: 1,
                          bgcolor: bgColor,
                          border: isToday(day) ? 2 : 0,
                          borderColor: 'primary.main',
                          opacity: isSameMonth(day, currentMonth) ? 1 : 0.3,
                          cursor: 'pointer',
                          '&:hover': {
                            opacity: 0.8,
                          },
                        }}
                      >
                        <Typography variant="body2">
                          {format(day, 'd')}
                        </Typography>
                        {dayLogs.length > 0 && (
                          <Typography variant="caption" display="block">
                            {dayLogs.filter(l => l.completed).length}/{dayLogs.length}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  </Grid>
                );
              })}
            </React.Fragment>
          ))}
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Chip size="small" sx={{ bgcolor: 'success.light' }} label="Completo" />
          <Chip size="small" sx={{ bgcolor: 'warning.light' }} label="Parcial" />
          <Chip size="small" sx={{ bgcolor: 'error.light' }} label="Nao feito" />
        </Box>
      </Box>
    );
  };

  const renderLogTable = () => {
    const sortedLogs = [...logs].sort((a, b) => new Date(b.log_date) - new Date(a.log_date));

    return (
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Tarefa</TableCell>
              <TableCell>Semana</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progresso</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhum registro encontrado para este periodo
                </TableCell>
              </TableRow>
            ) : (
              sortedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.log_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{log.task_title}</TableCell>
                  <TableCell>Semana {log.week_number}</TableCell>
                  <TableCell>
                    {log.completed ? (
                      <Chip
                        icon={<CheckIcon />}
                        label="Feito"
                        size="small"
                        color="success"
                      />
                    ) : (
                      <Chip
                        icon={<CancelIcon />}
                        label="Nao feito"
                        size="small"
                        color="error"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {log.accumulated_progress > 0 && (
                      <Typography variant="body2">
                        {parseFloat(log.accumulated_progress).toFixed(1)}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <MainLayout title="Historico">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Historico de Tarefas</Typography>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Filtrar por Tarefa</InputLabel>
          <Select
            value={selectedTask}
            label="Filtrar por Tarefa"
            onChange={(e) => setSelectedTask(e.target.value)}
          >
            <MenuItem value="">Todas as tarefas</MenuItem>
            {tasks.map((task) => (
              <MenuItem key={task.id} value={task.id}>{task.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Calendario
                </Typography>
                {renderCalendar()}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Registros do Mes
                </Typography>
                {renderLogTable()}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </MainLayout>
  );
};

export default History;
