import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authorizeRepresentaApiUser,
  canCreateOrders,
  consumeApiRateLimit,
  isOrderEmailRecipientAllowed,
} from '../src/apiSecurity.ts';

const projectId = 'test-representapro';
const now = 1_800_000_000_000;

function idToken(overrides: Record<string, unknown> = {}): string {
  const claims = {
    aud: projectId,
    iss: 'https://securetoken.google.com/' + projectId,
    sub: 'user-1',
    exp: Math.floor(now / 1000) + 60,
    iat: Math.floor(now / 1000),
    email: 'seller@example.com',
    email_verified: true,
    ...overrides,
  };
  return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
}

function stringValue(value: string) {
  return { stringValue: value };
}

function boolValue(value: boolean) {
  return { booleanValue: value };
}

function profileDocument(overrides: Record<string, unknown> = {}) {
  return {
    fields: {
      id: stringValue('user-1'),
      email: stringValue('seller@example.com'),
      ativo: boolValue(true),
      empresaRepresentacaoId: stringValue('tenant-1'),
      role: stringValue('Vendedor'),
      permissoes: { mapValue: { fields: {} } },
      ...overrides,
    },
  };
}

test('authorizes an active tenant profile using Firestore to validate the bearer token', async () => {
  const token = idToken();
  let requestedUrl = '';
  let authorization = '';
  const user = await authorizeRepresentaApiUser('Bearer ' + token, {
    projectId,
    now,
    fetcher: async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get('authorization') || '';
      return new Response(JSON.stringify(profileDocument()), { status: 200 });
    },
  });

  assert.equal(requestedUrl.endsWith('/usuarios/user-1'), true);
  assert.equal(authorization, 'Bearer ' + token);
  assert.deepEqual(user, {
    uid: 'user-1',
    email: 'seller@example.com',
    tenantId: 'tenant-1',
    role: 'Vendedor',
    permissions: {},
  });
});

test('rejects malformed, expired, unverified, and cross-project tokens before the profile lookup', async () => {
  const fetcher = async () => {
    throw new Error('A rejected token must not trigger a Firestore read.');
  };
  assert.equal(await authorizeRepresentaApiUser('not-a-token', { projectId, now, fetcher }), null);
  assert.equal(await authorizeRepresentaApiUser('Bearer ' + idToken({ exp: 1 }), { projectId, now, fetcher }), null);
  assert.equal(await authorizeRepresentaApiUser('Bearer ' + idToken({ email_verified: false }), { projectId, now, fetcher }), null);
  assert.equal(await authorizeRepresentaApiUser('Bearer ' + idToken({ aud: 'another-project' }), { projectId, now, fetcher }), null);
});

test('rejects inactive or email-mismatched tenant profiles', async () => {
  const token = idToken();
  const inactive = await authorizeRepresentaApiUser('Bearer ' + token, {
    projectId,
    now,
    fetcher: async () => new Response(JSON.stringify(profileDocument({ ativo: boolValue(false) })), { status: 200 }),
  });
  const mismatched = await authorizeRepresentaApiUser('Bearer ' + token, {
    projectId,
    now,
    fetcher: async () => new Response(JSON.stringify(profileDocument({ email: stringValue('other@example.com') })), { status: 200 }),
  });

  assert.equal(inactive, null);
  assert.equal(mismatched, null);
});

test('respects order permissions and rate limits each user bucket', async () => {
  const token = idToken();
  const user = await authorizeRepresentaApiUser('Bearer ' + token, {
    projectId,
    now,
    fetcher: async () => new Response(JSON.stringify(profileDocument({
      permissoes: { mapValue: { fields: { criarPedidos: boolValue(false) } } },
    })), { status: 200 }),
  });

  assert.ok(user);
  assert.equal(canCreateOrders(user), false);

  const key = 'rate-test-' + Math.random().toString(36).slice(2);
  assert.equal(consumeApiRateLimit('unit-test', key, 2, 1000, 10000), true);
  assert.equal(consumeApiRateLimit('unit-test', key, 2, 1000, 10001), true);
  assert.equal(consumeApiRateLimit('unit-test', key, 2, 1000, 10002), false);
  assert.equal(consumeApiRateLimit('unit-test', key, 2, 1000, 11001), true);
});

test('allows order email only to a client or represented company in the same tenant', async () => {
  const token = idToken();
  const user = await authorizeRepresentaApiUser('Bearer ' + token, {
    projectId,
    now,
    fetcher: async () => new Response(JSON.stringify(profileDocument()), { status: 200 }),
  });
  assert.ok(user);

  const fetcher = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/pedidos/order-1')) {
      return new Response(JSON.stringify({ fields: {
        empresaRepresentacaoId: stringValue('tenant-1'),
        clienteId: stringValue('client-1'),
        representadaId: stringValue('represented-1'),
      } }), { status: 200 });
    }
    if (url.endsWith('/clientes/client-1')) {
      return new Response(JSON.stringify({ fields: {
        empresaRepresentacaoId: stringValue('tenant-1'),
        email: stringValue('buyer@example.com'),
      } }), { status: 200 });
    }
    if (url.endsWith('/representadas/represented-1')) {
      return new Response(JSON.stringify({ fields: {
        empresaRepresentacaoId: stringValue('tenant-1'),
        email: stringValue('factory@example.com'),
      } }), { status: 200 });
    }
    return new Response('', { status: 404 });
  };

  assert.equal(await isOrderEmailRecipientAllowed('Bearer ' + token, user, 'order-1', 'buyer@example.com', { projectId, now, fetcher }), true);
  assert.equal(await isOrderEmailRecipientAllowed('Bearer ' + token, user, 'order-1', 'external@example.com', { projectId, now, fetcher }), false);
});
