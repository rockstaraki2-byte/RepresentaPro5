export const formatarMoeda = (valor: number): string => {
  return (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatarCNPJ = (cnpj: string): string => {
  const limpo = (cnpj || '').replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
};

export const formatarData = (dataStr: string): string => {
  if (!dataStr) return '';
  const partes = dataStr.split('-');
  if (partes.length !== 3) return dataStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

export const formatarTelefone = (tel: string): string => {
  const limpo = (tel || '').replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (limpo.length === 10) {
    return limpo.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return tel;
};

export const consultarCNPJ = async (rawCnpj: string): Promise<any> => {
  const cnpj = rawCnpj.replace(/\D/g, '');
  if (cnpj.length !== 14) {
    throw new Error('CNPJ inválido. Deve conter exatamente 14 dígitos.');
  }

  // 1. Tentar primeiro o endpoint do nosso backend (Express)
  try {
    const response = await fetch(`/api/cnpj/${cnpj}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('Endpoint do backend indisponível (ex: Vercel estático). Tentando consulta direta...', err);
  }

  // 2. Fallback: Consulta direta via BrasilAPI no lado do cliente (suporta CORS)
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (response.ok) {
      const data = await response.json();
      return {
        ...data,
        razao_social: data.razao_social || data.razaoSocial || '',
        nome_fantasia: data.nome_fantasia || data.nomeFantasia || data.razao_social || '',
        telefone1: data.ddd_telefone_1 || data.telefone1 || '',
        telefone2: data.ddd_telefone_2 || '',
        email: data.email || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        cnae_fiscal_descricao: data.cnae_fiscal_descricao || ''
      };
    }
  } catch (err) {
    console.warn('Falha na consulta direta à BrasilAPI. Tentando API de backup CNPJ.ws...', err);
  }

  // 3. Backup: Consulta direta via CNPJ.ws no lado do cliente (suporta CORS)
  try {
    const backupResponse = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
    if (backupResponse.ok) {
      const backupData = await backupResponse.json();
      return {
        cnpj: backupData.cnpj,
        razao_social: backupData.razao_social,
        nome_fantasia: backupData.estabelecimento?.nome_fantasia || backupData.razao_social,
        telefone1: (backupData.estabelecimento?.ddd1 && backupData.estabelecimento?.telefone1) 
          ? `${backupData.estabelecimento.ddd1}${backupData.estabelecimento.telefone1}` 
          : '',
        email: backupData.estabelecimento?.email || '',
        logradouro: backupData.estabelecimento?.logradouro || '',
        numero: backupData.estabelecimento?.numero || '',
        bairro: backupData.estabelecimento?.bairro || '',
        municipio: backupData.estabelecimento?.cidade?.nome || '',
        uf: backupData.estabelecimento?.estado?.sigla || '',
        cnae_fiscal_descricao: backupData.estabelecimento?.atividade_principal?.descricao || ''
      };
    }
  } catch (err) {
    console.error('Todas as tentativas de consulta de CNPJ falharam:', err);
  }

  throw new Error('Não foi possível encontrar este CNPJ ou as APIs públicas estão instáveis. Por favor, tente preencher os dados manualmente.');
};

