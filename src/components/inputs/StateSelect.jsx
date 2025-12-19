import React from 'react';
import PropTypes from 'prop-types';
import { FormControl, InputLabel, Select, MenuItem, FormHelperText } from '@mui/material';
// Importando seus dados diretamente no componente que precisa deles
import { estados } from '../../data/brazil-locations'; 

const StateSelect = ({ 
  value, 
  onChange, 
  name = "state", 
  label = "Em que estado você mora?", 
  required = true,
  error = false,
  helperText = "",
  disabled = false
}) => {
  return (
    <FormControl 
      fullWidth 
      margin="normal" 
      required={required} 
      error={!!error} // Garante booleano
      disabled={disabled}
    >
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select
        labelId={`${name}-label`}
        id={name}
        name={name}
        value={value || ''} // Evita warning de componente não controlado
        label={label}
        onChange={onChange}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 300, // UX: Scroll suave para listas longas
            },
          },
        }}
      >
        <MenuItem value="" disabled>
          <em>Selecione uma opção</em>
        </MenuItem>
        {estados.map((estado) => (
          <MenuItem key={estado.sigla} value={estado.sigla}>
            {estado.nome}
          </MenuItem>
        ))}
      </Select>
      {/* Exibe mensagem de erro ou texto de ajuda se houver */}
      {(error || helperText) && (
        <FormHelperText>{error || helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

StateSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string,
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string, // Pode receber a string de mensagem de erro
  helperText: PropTypes.string,
  disabled: PropTypes.bool
};

export default StateSelect;