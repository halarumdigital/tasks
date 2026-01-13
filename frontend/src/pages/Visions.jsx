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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import api from '../services/api';

const Visions = () => {
  const navigate = useNavigate();
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVision, setEditingVision] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVisions();
  }, []);

  const fetchVisions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/visions');
      setVisions(response.data);
    } catch (err) {
      setError('Erro ao carregar visoes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (vision = null) => {
    if (vision) {
      setEditingVision(vision);
      setFormData({ title: vision.title, description: vision.description || '' });
    } else {
      setEditingVision(null);
      setFormData({ title: '', description: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingVision(null);
    setFormData({ title: '', description: '' });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;

    try {
      setSaving(true);
      if (editingVision) {
        await api.put(`/visions/${editingVision.id}`, formData);
      } else {
        await api.post('/visions', formData);
      }
      handleCloseDialog();
      fetchVisions();
    } catch (err) {
      setError('Erro ao salvar visao');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta visao?')) return;

    try {
      await api.delete(`/visions/${id}`);
      fetchVisions();
    } catch (err) {
      setError('Erro ao excluir visao');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Visoes">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Visoes">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">Minhas Visoes de Longo Prazo</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Nova Visao
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {visions.length === 0 ? (
          <Grid item xs={12}>
            <Alert severity="info">
              Nenhuma visao cadastrada. Crie uma visao para comecar a definir seus objetivos de longo prazo.
            </Alert>
          </Grid>
        ) : (
          visions.map((vision) => (
            <Grid item xs={12} md={6} lg={4} key={vision.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" gutterBottom>
                      {vision.title}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleOpenDialog(vision)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(vision.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {vision.description || 'Sem descricao'}
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => navigate(`/periods?vision_id=${vision.id}`)}
                  >
                    Ver Periodos
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Dialog de criacao/edicao */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVision ? 'Editar Visao' : 'Nova Visao'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Titulo"
            fullWidth
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Descricao"
            fullWidth
            multiline
            rows={4}
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

export default Visions;
