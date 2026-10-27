import assert from 'node:assert/strict';
import { isValidIsoCalendarDate } from '../src/utils';

for (const value of ['0001-01-01', '2026-10-27', '2024-02-29', '2000-02-29']) {
  assert.equal(isValidIsoCalendarDate(value), true, `${value} deve ser uma data válida`);
}

for (const value of ['', '0000-01-01', '2026-1-01', '2026-13-01', '2026-00-01', '2026-04-31', '2026-02-30', '2025-02-29', '1900-02-29']) {
  assert.equal(isValidIsoCalendarDate(value), false, `${value} deve ser rejeitada`);
}

console.log('Datas de calendário validadas, incluindo anos bissextos e séculos.');
