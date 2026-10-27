import assert from 'node:assert/strict';
import {
  getLocalDateTimeInputValue,
  isoDateTimeToLocalInput,
  isValidLocalDateTime,
  localDateTimeToIso,
} from '../src/utils';

for (const value of ['0001-01-01T00:00', '2026-10-27T16:45', '2024-02-29T23:59']) {
  assert.equal(isValidLocalDateTime(value), true, `${value} deve ser uma data e hora local válidas`);
}

for (const value of [
  '',
  '2026-2-07T10:00',
  '2026-02-29T10:00',
  '2026-10-27T24:00',
  '2026-10-27T10:60',
  '2026-10-27 10:00',
]) {
  assert.equal(isValidLocalDateTime(value), false, `${value} deve ser rejeitada`);
}

const localDate = new Date(2026, 9, 27, 16, 45, 0, 0);
const localInput = getLocalDateTimeInputValue(localDate);
assert.equal(localInput, '2026-10-27T16:45');
assert.equal(localDateTimeToIso(localInput), localDate.toISOString());
assert.equal(isoDateTimeToLocalInput(localDate.toISOString()), localInput);

console.log('Datas e horários da agenda validados no fuso local do dispositivo.');
