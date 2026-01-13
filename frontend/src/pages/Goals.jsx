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
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as TacticIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const Goals = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const periodIdParam = searchParams.get('period_id');

  const [goals, setGoals] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState({
    period_id: periodIdParam || '',
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodIdParam]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsRes, periodsRes] = await Promise.all([
        api.get('/goals', { params: periodIdParam ? { period_id: periodIdParam } : {} }),
        api.get('/periods'),
      ]);
      setGoals(goalsRes.data);
      setPeriods(periodsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        period_id: goal.period_id,
        title: goal.title,
        description: goal.description || '',
      });
    } else {
      setEditingGoal(null);
      const activePeriod = periods.find(p => p.status === 'active');
      setFormData({
        period_id: periodIdParam || activePeriod?.id || '',
        title: '',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGoal(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.period_id) return;

    try {
      setSaving(true);
      if (editingGoal) {
        await api.put(`/goals/${editingGoal.id}`, {
          title: formData.title,
          description: formData.description,
        });
      } else {
        await api.post('/goals', formData);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError('Erro ao salvar meta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta meta?')) return;

    try {
      await api.delete(`/goals/${id}`);
      fetchData();
    } catch (err) {
      setError('Erro ao excluir meta');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Metas">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  const activePeriods = periods.filter(p => p.status === 'active');

  return (
    <MainLayout title="Metas">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Metas de 12 Semanas</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={periods.length === 0}
        >
          Nova Meta
        </Button>
      </Box>

      {periods.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Crie um periodo primeiro antes de criar metas.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {goals.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              Nenhuma meta cadastrada. Crie metas para o periodo atual.
            </Alert>
          </Grid>
        ) : (
          goals.map((goal) => (
            <Grid item xs={12} md={6} lg={4} key={goal.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" gutterBottom>
                      {goal.title}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(goal)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(goal.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Periodo: {goal.period_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {goal.description || 'Sem descricao'}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<TacticIcon />}
                    onClick={() => navigate(`/tactics?goal_id=${goal.id}`)}
                  >
                    Taticas
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
        <DialogContent>
          {!editingGoal && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Periodo</InputLabel>
              <Select
                value={formData.period_id}
                label="Periodo"
                onChange={(e) => setFormData({ ...formData, period_id: e.target.value })}
              >
                {periods.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} {p.status === 'active' && '(Ativo)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Titulo da Meta"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Aprender ingles, Ler 12 livros"
          />
          <TextField
            margin="dense"
            label="Descricao"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
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

export default Goals;
