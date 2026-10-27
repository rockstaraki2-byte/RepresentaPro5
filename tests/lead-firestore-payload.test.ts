import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { prepareLeadForCreate } from '../src/leadFirestorePayload';
import type { Lead } from '../src/types';

const lead: Lead = {
  id: 'lead-1',
  nomeFantasia: 'Prospect',
  razaoSocial: '',
  cnpj: '',
  endereco: '',
  cidade: '',
  uf: '',
  telefone: '',
  email: '',
  contato: '',
  origem: '',
  etapa: 'Novo',
  representadaId: '',
  responsavelUserId: 'user-1',
  proximaAcao: '',
  dataProximaAcao: '',
  observacoes: '',
  motivoPerda: '',
  criadoPorUserId: 'user-1',
  criadoEm: '2026-10-27T12:00:00.000Z',
  atualizadoEm: '2026-10-27T12:00:00.000Z',
  empresaRepresentacaoId: 'tenant-1',
};

test('omits empty optional fields but preserves populated values and tenant identity', () => {
  const result = prepareLeadForCreate({ ...lead, cidade: 'São Paulo', representadaId: 'rep-1' });

  assert.equal(result.cidade, 'São Paulo');
  assert.equal(result.representadaId, 'rep-1');
  assert.equal(result.nomeFantasia, lead.nomeFantasia);
  assert.equal(result.empresaRepresentacaoId, lead.empresaRepresentacaoId);
  assert.equal('razaoSocial' in result, false);
  assert.equal('cnpj' in result, false);
  assert.equal('proximaAcao' in result, false);
  assert.equal('dataProximaAcao' in result, false);
  assert.equal('observacoes' in result, false);
});
