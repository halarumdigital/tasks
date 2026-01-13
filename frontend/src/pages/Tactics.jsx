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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as TaskIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const Tactics = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalIdParam = searchParams.get('goal_id');

  const [tactics, setTactics] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTactic, setEditingTactic] = useState(null);
  const [formData, setFormData] = useState({
    goal_id: goalIdParam || '',
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [goalIdParam]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tacticsRes, goalsRes] = await Promise.all([
        api.get('/tactics', { params: goalIdParam ? { goal_id: goalIdParam } : {} }),
        api.get('/goals'),
      ]);
      setTactics(tacticsRes.data);
      setGoals(goalsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tactic = null) => {
    if (tactic) {
      setEditingTactic(tactic);
      setFormData({
        goal_id: tactic.goal_id,
        title: tactic.title,
        description: tactic.description || '',
      });
    } else {
      setEditingTactic(null);
      setFormData({
        goal_id: goalIdParam || '',
        title: '',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTactic(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.goal_id) return;

    try {
      setSaving(true);
      if (editingTactic) {
        await api.put(`/tactics/${editingTactic.id}`, {
          title: formData.title,
          description: formData.description,
        });
      } else {
        await api.post('/tactics', formData);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError('Erro ao salvar tatica');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tatica?')) return;

    try {
      await api.delete(`/tactics/${id}`);
      fetchData();
    } catch (err) {
      setError('Erro ao excluir tatica');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Taticas">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Taticas">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Taticas Semanais</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={goals.length === 0}
        >
          Nova Tatica
        </Button>
      </Box>

      {goals.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Crie uma meta primeiro antes de criar taticas.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {tactics.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              Nenhuma tatica cadastrada. Crie taticas para organizar suas acoes semanais.
            </Alert>
          </Grid>
        ) : (
          tactics.map((tactic) => (
            <Grid item xs={12} md={6} lg={4} key={tactic.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" gutterBottom>
                      {tactic.title}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(tactic)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(tactic.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Meta: {tactic.goal_title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {tactic.description || 'Sem descricao'}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<TaskIcon />}
                    onClick={() => navigate(`/tasks?tactic_id=${tactic.id}`)}
                  >
                    Tarefas
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTactic ? 'Editar Tatica' : 'Nova Tatica'}</DialogTitle>
        <DialogContent>
          {!editingTactic && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Meta</InputLabel>
              <Select
                value={formData.goal_id}
                label="Meta"
                onChange={(e) => setFormData({ ...formData, goal_id: e.target.value })}
              >
                {goals.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Titulo da Tatica"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Estudar diariamente, Praticar exercicios"
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

export default Tactics;
