import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const WEEKDAYS = [
  { bit: 1, label: 'Dom', short: 'D' },
  { bit: 2, label: 'Seg', short: 'S' },
  { bit: 4, label: 'Ter', short: 'T' },
  { bit: 8, label: 'Qua', short: 'Q' },
  { bit: 16, label: 'Qui', short: 'Q' },
  { bit: 32, label: 'Sex', short: 'S' },
  { bit: 64, label: 'Sab', short: 'S' },
];

const getWeekdaysFromBitmask = (bitmask) => {
  return WEEKDAYS.filter(d => (bitmask & d.bit) !== 0).map(d => d.bit);
};

const getBitmaskFromWeekdays = (selectedDays) => {
  return selectedDays.reduce((acc, bit) => acc | bit, 0);
};

const formatWeekdays = (bitmask) => {
  return WEEKDAYS.filter(d => (bitmask & d.bit) !== 0).map(d => d.label).join(', ');
};

const Tasks = () => {
  const [searchParams] = useSearchParams();
  const tacticIdParam = searchParams.get('tactic_id');

  const [tasks, setTasks] = useState([]);
  const [tactics, setTactics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    tactic_id: tacticIdParam || '',
    title: '',
    description: '',
    metric_type: 'boolean',
    total_target: '',
    unit: '',
    speed_per_hour: '',
    daily_time_minutes: '',
    weekdays: 127,
    notification_time: '20:00',
    is_active: true,
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState([1, 2, 4, 8, 16, 32, 64]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tacticIdParam]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, tacticsRes] = await Promise.all([
        api.get('/tasks', { params: tacticIdParam ? { tactic_id: tacticIdParam } : {} }),
        api.get('/tactics'),
      ]);
      setTasks(tasksRes.data);
      setTactics(tacticsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (task = null) => {
    if (task) {
      setEditingTask(task);
      const weekdaysBits = getWeekdaysFromBitmask(task.weekdays);
      setSelectedWeekdays(weekdaysBits);
      setFormData({
        tactic_id: task.tactic_id,
        title: task.title,
        description: task.description || '',
        metric_type: task.metric_type,
        total_target: task.total_target || '',
        unit: task.unit || '',
        speed_per_hour: task.speed_per_hour || '',
        daily_time_minutes: task.daily_time_minutes || '',
        weekdays: task.weekdays,
        notification_time: task.notification_time?.substring(0, 5) || '20:00',
        is_active: task.is_active,
      });
    } else {
      setEditingTask(null);
      setSelectedWeekdays([1, 2, 4, 8, 16, 32, 64]);
      setFormData({
        tactic_id: tacticIdParam || '',
        title: '',
        description: '',
        metric_type: 'boolean',
        total_target: '',
        unit: '',
        speed_per_hour: '',
        daily_time_minutes: '',
        weekdays: 127,
        notification_time: '20:00',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleWeekdaysChange = (event, newWeekdays) => {
    if (newWeekdays.length > 0) {
      setSelectedWeekdays(newWeekdays);
      setFormData({ ...formData, weekdays: getBitmaskFromWeekdays(newWeekdays) });
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.tactic_id) return;

    try {
      setSaving(true);
      const dataToSend = {
        ...formData,
        total_target: formData.total_target ? parseFloat(formData.total_target) : null,
        speed_per_hour: formData.speed_per_hour ? parseFloat(formData.speed_per_hour) : null,
        daily_time_minutes: formData.daily_time_minutes ? parseInt(formData.daily_time_minutes) : null,
        notification_time: formData.notification_time + ':00',
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, dataToSend);
      } else {
        await api.post('/tasks', dataToSend);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError('Erro ao salvar tarefa');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
      await api.delete(`/tasks/${id}`);
      fetchData();
    } catch (err) {
      setError('Erro ao excluir tarefa');
    }
  };

  const getMetricTypeLabel = (type) => {
    switch (type) {
      case 'boolean': return 'Sim/Nao';
      case 'pages': return 'Paginas';
      case 'hours': return 'Horas';
      case 'custom': return 'Personalizado';
      default: return type;
    }
  };

  if (loading) {
    return (
      <MainLayout title="Tarefas">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Tarefas">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Tarefas Diarias</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={tactics.length === 0}
        >
          Nova Tarefa
        </Button>
      </Box>

      {tactics.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Crie uma tatica primeiro antes de criar tarefas.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {tasks.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              Nenhuma tarefa cadastrada. Crie tarefas para rastrear seu progresso diario.
            </Alert>
          </Grid>
        ) : (
          tasks.map((task) => (
            <Grid item xs={12} md={6} lg={4} key={task.id}>
              <Card sx={{ opacity: task.is_active ? 1 : 0.6 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" gutterBottom>
                      {task.title}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(task)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(task.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={getMetricTypeLabel(task.metric_type)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {!task.is_active && (
                      <Chip label="Inativa" size="small" color="error" />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Tatica: {task.tactic_title}
                  </Typography>

                  {task.metric_type !== 'boolean' && task.daily_target && (
                    <Typography variant="body2" color="text.secondary">
                      Meta diaria: {parseFloat(task.daily_target).toFixed(1)} {task.unit}
                    </Typography>
                  )}

                  {task.total_target && (
                    <Typography variant="body2" color="text.secondary">
                      Meta total: {task.total_target} {task.unit}
                    </Typography>
                  )}

                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ScheduleIcon fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {task.notification_time?.substring(0, 5)} - {formatWeekdays(task.weekdays)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              {!editingTask && (
                <FormControl fullWidth margin="dense">
                  <InputLabel>Tatica</InputLabel>
                  <Select
                    value={formData.tactic_id}
                    label="Tatica"
                    onChange={(e) => setFormData({ ...formData, tactic_id: e.target.value })}
                  >
                    {tactics.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{t.title} ({t.goal_title})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                autoFocus
                label="Titulo da Tarefa"
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Ler 30 paginas, Estudar ingles, Meditar"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Descricao"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Metrica</InputLabel>
                <Select
                  value={formData.metric_type}
                  label="Tipo de Metrica"
                  onChange={(e) => setFormData({ ...formData, metric_type: e.target.value })}
                >
                  <MenuItem value="boolean">Sim/Nao (fez ou nao fez)</MenuItem>
                  <MenuItem value="pages">Paginas (leitura)</MenuItem>
                  <MenuItem value="hours">Horas (tempo)</MenuItem>
                  <MenuItem value="custom">Personalizado (quantidade)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Horario de Notificacao"
                type="time"
                fullWidth
                value={formData.notification_time}
                onChange={(e) => setFormData({ ...formData, notification_time: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {formData.metric_type !== 'boolean' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Meta Total (periodo)"
                    type="number"
                    fullWidth
                    value={formData.total_target}
                    onChange={(e) => setFormData({ ...formData, total_target: e.target.value })}
                    placeholder="Ex: 100 (paginas), 50 (horas)"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Unidade"
                    fullWidth
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="Ex: paginas, horas, minutos, repeticoes"
                  />
                </Grid>

                {formData.metric_type === 'pages' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Velocidade (por hora)"
                      type="number"
                      fullWidth
                      value={formData.speed_per_hour}
                      onChange={(e) => setFormData({ ...formData, speed_per_hour: e.target.value })}
                      placeholder="Ex: 30 paginas/hora"
                    />
                  </Grid>
                )}

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Tempo Diario (minutos)"
                    type="number"
                    fullWidth
                    value={formData.daily_time_minutes}
                    onChange={(e) => setFormData({ ...formData, daily_time_minutes: e.target.value })}
                    placeholder="Ex: 60 (1 hora)"
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Dias da Semana
              </Typography>
              <ToggleButtonGroup
                value={selectedWeekdays}
                onChange={handleWeekdaysChange}
                aria-label="dias da semana"
                size="small"
              >
                {WEEKDAYS.map((day) => (
                  <ToggleButton key={day.bit} value={day.bit} aria-label={day.label}>
                    {day.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>

            {editingTask && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Tarefa ativa"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !formData.title.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default Tasks;
