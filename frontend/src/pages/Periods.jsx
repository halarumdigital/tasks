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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Flag as GoalIcon,
  ContentCopy as CloneIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const Periods = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visionIdParam = searchParams.get('vision_id');

  const [periods, setPeriods] = useState([]);
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [cloningPeriod, setCloningPeriod] = useState(null);
  const [formData, setFormData] = useState({
    vision_id: visionIdParam || '',
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [cloneFormData, setCloneFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [periodsRes, visionsRes] = await Promise.all([
        api.get('/periods'),
        api.get('/visions'),
      ]);
      setPeriods(periodsRes.data);
      setVisions(visionsRes.data);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (period = null) => {
    if (period) {
      setEditingPeriod(period);
      setFormData({
        vision_id: period.vision_id,
        name: period.name,
        start_date: period.start_date,
        status: period.status,
      });
    } else {
      setEditingPeriod(null);
      setFormData({
        vision_id: visionIdParam || (visions[0]?.id || ''),
        name: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPeriod(null);
  };

  const handleOpenCloneDialog = (period) => {
    setCloningPeriod(period);
    setCloneFormData({
      name: `${period.name} (Novo Ciclo)`,
      start_date: format(new Date(), 'yyyy-MM-dd'),
    });
    setCloneDialogOpen(true);
  };

  const handleCloseCloneDialog = () => {
    setCloneDialogOpen(false);
    setCloningPeriod(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.vision_id) return;

    try {
      setSaving(true);
      setError('');
      if (editingPeriod) {
        await api.put(`/periods/${editingPeriod.id}`, {
          name: formData.name,
          status: formData.status,
        });
      } else {
        await api.post('/periods', formData);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar periodo');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!cloneFormData.name.trim() || !cloningPeriod) return;

    try {
      setSaving(true);
      setError('');
      const response = await api.post(`/periods/${cloningPeriod.id}/clone`, cloneFormData);
      setSuccess(response.data.message);
      handleCloseCloneDialog();
      fetchData();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao clonar periodo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este periodo?')) return;

    try {
      await api.delete(`/periods/${id}`);
      fetchData();
    } catch (err) {
      setError('Erro ao excluir periodo');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'completed': return 'Concluido';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <MainLayout title="Periodos">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  const hasActivePeriod = periods.some(p => p.status === 'active');
  const completedPeriods = periods.filter(p => p.status === 'completed');

  return (
    <MainLayout title="Periodos">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Periodos de 12 Semanas</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={hasActivePeriod || visions.length === 0}
        >
          Novo Periodo
        </Button>
      </Box>

      {hasActivePeriod && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ja existe um periodo ativo. Finalize-o antes de criar um novo.
        </Alert>
      )}

      {!hasActivePeriod && completedPeriods.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Voce pode criar um novo periodo do zero ou clonar um periodo anterior (copiando todas as metas, taticas e tarefas).
        </Alert>
      )}

      {visions.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Crie uma visao primeiro antes de criar periodos.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={3}>
        {periods.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              Nenhum periodo cadastrado. Crie um periodo de 12 semanas para comecar.
            </Alert>
          </Grid>
        ) : (
          periods.map((period) => (
            <Grid item xs={12} md={6} lg={4} key={period.id}>
              <Card sx={{ opacity: period.status === 'active' ? 1 : 0.7 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6">{period.name}</Typography>
                    <Chip
                      label={getStatusLabel(period.status)}
                      color={getStatusColor(period.status)}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Visao: {period.vision_title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(period.start_date), 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                    {format(new Date(period.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      startIcon={<GoalIcon />}
                      onClick={() => navigate(`/goals?period_id=${period.id}`)}
                    >
                      Metas
                    </Button>
                    {period.status !== 'active' && !hasActivePeriod && (
                      <Tooltip title="Clonar para novo ciclo">
                        <Button
                          size="small"
                          color="success"
                          startIcon={<CloneIcon />}
                          onClick={() => handleOpenCloneDialog(period)}
                        >
                          Clonar
                        </Button>
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => handleOpenDialog(period)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(period.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog Novo/Editar */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPeriod ? 'Editar Periodo' : 'Novo Periodo'}</DialogTitle>
        <DialogContent>
          {!editingPeriod && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Visao</InputLabel>
              <Select
                value={formData.vision_id}
                label="Visao"
                onChange={(e) => setFormData({ ...formData, vision_id: e.target.value })}
              >
                {visions.map((v) => (
                  <MenuItem key={v.id} value={v.id}>{v.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            margin="dense"
            label="Nome do Periodo"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Q1 2025, Primeiro Trimestre"
          />
          {!editingPeriod && (
            <TextField
              margin="dense"
              label="Data de Inicio"
              type="date"
              fullWidth
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          )}
          {editingPeriod && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="completed">Concluido</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !formData.name.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Clonar */}
      <Dialog open={cloneDialogOpen} onClose={handleCloseCloneDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Clonar Periodo</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ao clonar, todas as metas, taticas e tarefas serao copiadas para o novo periodo.
            O progresso sera resetado para zero.
          </Alert>
          {cloningPeriod && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Clonando de: <strong>{cloningPeriod.name}</strong>
            </Typography>
          )}
          <TextField
            margin="dense"
            label="Nome do Novo Periodo"
            fullWidth
            value={cloneFormData.name}
            onChange={(e) => setCloneFormData({ ...cloneFormData, name: e.target.value })}
            placeholder="Ex: Q2 2025, Segundo Trimestre"
          />
          <TextField
            margin="dense"
            label="Data de Inicio"
            type="date"
            fullWidth
            value={cloneFormData.start_date}
            onChange={(e) => setCloneFormData({ ...cloneFormData, start_date: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCloneDialog}>Cancelar</Button>
          <Button
            onClick={handleClone}
            variant="contained"
            color="success"
            startIcon={<CloneIcon />}
            disabled={saving || !cloneFormData.name.trim()}
          >
            {saving ? 'Clonando...' : 'Clonar Periodo'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};

export default Periods;
