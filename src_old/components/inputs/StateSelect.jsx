import React from 'react';
import { Label } from '../ui/label';
import { estados } from '../../data/brazil-locations'; 

const StateSelect = ({ value, onChange, error, disabled }) => {
  return (
    <div className="mb-4">
      <Label htmlFor="state">Em que estado você mora?</Label>
      <select
        id="state"
        name="state"
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>Selecione uma opção</option>
        {estados.map((estado) => (
          <option key={estado.sigla} value={estado.sigla}>
            {estado.nome}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </div>
  );
};

export default StateSelect;