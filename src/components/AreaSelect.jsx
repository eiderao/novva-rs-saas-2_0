import React, { useState, useEffect } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Button, 
  Box, 
  CircularProgress,
  FormHelperText
} from '@mui/material';
import { supabase } from '../supabase/client'; // Ajustei para o caminho que vi na sua árvore

export default function AreaSelect({ currentTenantId, selectedAreaId, onSelectArea, error }) {
  const [departments, setDepartments] = useState([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [loading, setLoading] = useState(false);

  // Busca áreas da empresa atual
  useEffect(() => {
    if (!currentTenantId) return;

    async function fetchDepartments() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_departments')
          .select('id, name')
          .eq('tenantId', currentTenantId)
          .order('name', { ascending: true });

        if (error) throw error;
        setDepartments(data || []);
      } catch (error) {
        console.error('Erro ao buscar áreas:', error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDepartments();
  }, [currentTenantId]);

  // Salva nova área
  const handleSaveNew = async () => {
    if (!newDeptName.trim()) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_departments')
        .insert([{ 
          name: newDeptName.trim(), 
          tenantId: currentTenantId 
        }])
        .select()
        .single();

      if (error) throw error;

      setDepartments([...departments, data]);
      onSelectArea(data.id);
      setIsCreatingNew(false);
      setNewDeptName('');
    } catch (error) {
      alert('Erro ao criar área: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && departments.length === 0) return <Box sx={{p: 2}}><CircularProgress size={20} /></Box>;

  // Modo de Criação (Input de Texto)
  if (isCreatingNew) {
    return (
      <Box sx={{ mb: 2, mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
        <TextField
          label="Nome da Nova Área"
          value={newDeptName}
          onChange={(e) => setNewDeptName(e.target.value)}
          size="small"
          fullWidth
          autoFocus
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button 
            variant="text" 
            color="inherit" 
            onClick={() => setIsCreatingNew(false)}
            size="small"
            >
            Cancelar
            </Button>
            <Button 
            variant="contained" 
            onClick={handleSaveNew}
            disabled={!newDeptName.trim()}
            size="small"
            >
            Salvar Área
            </Button>
        </Box>
      </Box>
    );
  }

  // Modo de Seleção (Dropdown)
  return (
    <FormControl fullWidth margin="normal" error={!!error}>
      <InputLabel id="area-select-label">Área / Departamento</InputLabel>
      <Select
        labelId="area-select-label"
        value={selectedAreaId || ''}
        label="Área / Departamento"
        onChange={(e) => {
          if (e.target.value === 'NEW') setIsCreatingNew(true);
          else onSelectArea(e.target.value);
        }}
      >
        <MenuItem value="">
          <em>Sem área definida</em>
        </MenuItem>
        {departments.map((dept) => (
          <MenuItem key={dept.id} value={dept.id}>
            {dept.name}
          </MenuItem>
        ))}
        <MenuItem value="NEW" sx={{ color: 'primary.main', fontWeight: 'bold', borderTop: '1px solid #eee' }}>
          + Cadastrar Nova Área
        </MenuItem>
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}