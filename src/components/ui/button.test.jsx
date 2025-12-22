import { render, screen } from '@testing-library/react';
import { Button } from './button';
import { describe, it, expect } from 'vitest';

describe('Componente Button', () => {
  it('deve renderizar o texto corretamente', () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByText('Clique aqui')).toBeInTheDocument();
  });

  it('deve aplicar a classe de variante destructive', () => {
    render(<Button variant="destructive">Excluir</Button>);
    const button = screen.getByText('Excluir');
    // Verifica se a classe do tailwind para background vermelho está presente
    expect(button).toHaveClass('bg-red-500');
  });
});