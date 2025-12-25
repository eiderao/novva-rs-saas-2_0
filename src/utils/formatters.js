import { format, parseISO } from 'date-fns';

export const formatStatus = (status) => {
  const statusMap = {
    active: 'Ativa',
    inactive: 'Inativa',
    filled: 'Preenchida',
  };
  return statusMap[status] || status;
};

export const formatPhone = (phone) => {
  if (!phone) return 'Não informado';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  return phone;
};

export const formatUrl = (url) => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) { return url; }
  return `//${url}`;
};

export const formatDate = (dateStr) => {
    if (!dateStr) return 'Não informado';
    try {
        return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch (error) {
        console.error("Erro ao formatar data:", dateStr, error);
        return 'Data inválida';
    }
};