import type { Lead } from './types';

const OPTIONAL_TEXT_FIELDS = [
  'razaoSocial', 'cnpj', 'endereco', 'cidade', 'uf', 'telefone', 'email',
  'contato', 'origem', 'representadaId', 'proximaAcao', 'dataProximaAcao', 'observacoes', 'motivoPerda',
] as const satisfies readonly (keyof Lead)[];

/** Keep the Firestore create payload compact while preserving non-empty optional values. */
export function prepareLeadForCreate(lead: Lead): Lead {
  const payload = { ...lead };
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (payload[field] === '') delete payload[field];
  }
  return payload;
}
