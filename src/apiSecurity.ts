export interface RepresentaApiUser {
  uid: string;
  email: string;
  tenantId: string;
  role: 'Administrador' | 'Representante' | 'Vendedor';
  permissions: Record<string, unknown>;
}

interface FirebaseTokenClaims {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  email?: unknown;
  email_verified?: unknown;
}

interface FirestoreDocument {
  fields?: Record<string, unknown>;
}

interface AuthorizeOptions {
  projectId?: string;
  fetcher?: typeof fetch;
  now?: number;
  timeoutMs?: number;
}

const DEFAULT_FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'representapro-b84c3';
const rateLimitBuckets = new Map<string, number[]>();

function parseFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if ('stringValue' in record) return record.stringValue;
  if ('booleanValue' in record) return record.booleanValue;
  if ('integerValue' in record) return Number(record.integerValue);
  if ('doubleValue' in record) return Number(record.doubleValue);
  if ('nullValue' in record) return null;
  if ('mapValue' in record) {
    const map = record.mapValue as { fields?: Record<string, unknown> } | undefined;
    return parseFirestoreFields(map?.fields || {});
  }
  if ('arrayValue' in record) {
    const array = record.arrayValue as { values?: unknown[] } | undefined;
    return (array?.values || []).map(parseFirestoreValue);
  }
  return undefined;
}

function parseFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, parseFirestoreValue(value)]));
}

function parseFirebaseToken(authorization: string, projectId: string, nowMs: number): { token: string; uid: string; email: string } | null {
  const match = authorization.match(/^Bearer\s+([A-Za-z0-9._-]+)$/i);
  if (!match) return null;
  const token = match[1];
  if (token.length > 8192) return null;

  try {
    const pieces = token.split('.');
    if (pieces.length !== 3) return null;
    const claims = JSON.parse(Buffer.from(pieces[1], 'base64url').toString('utf8')) as FirebaseTokenClaims;
    const now = Math.floor(nowMs / 1000);
    if (claims.aud !== projectId
      || claims.iss !== 'https://securetoken.google.com/' + projectId
      || typeof claims.sub !== 'string'
      || claims.sub.length === 0
      || claims.sub.length > 128
      || typeof claims.email !== 'string'
      || claims.email_verified !== true
      || typeof claims.exp !== 'number'
      || claims.exp <= now
      || (typeof claims.iat === 'number' && claims.iat > now + 60)) return null;
    return { token, uid: claims.sub, email: claims.email, };
  } catch {
    return null;
  }
}

/**
 * Parses the token only to select the profile path. The Firestore REST read below
 * validates the Firebase ID token and applies Firestore Security Rules.
 */
export async function authorizeRepresentaApiUser(
  authorization: string,
  options: AuthorizeOptions = {},
): Promise<RepresentaApiUser | null> {
  const projectId = options.projectId || DEFAULT_FIREBASE_PROJECT_ID;
  const parsed = parseFirebaseToken(authorization, projectId, options.now ?? Date.now());
  if (!parsed) return null;

  const fetcher = options.fetcher || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const url = 'https://firestore.googleapis.com/v1/projects/' + projectId
      + '/databases/(default)/documents/usuarios/' + encodeURIComponent(parsed.uid);
    const response = await fetcher(url, {
      headers: { Authorization: 'Bearer ' + parsed.token },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const document = await response.json() as FirestoreDocument;
    const profile = parseFirestoreFields(document.fields || {});
    const tenantId = profile.empresaRepresentacaoId;
    const role = profile.role;
    const email = typeof profile.email === 'string' ? profile.email : '';
    if (profile.id !== parsed.uid
      || profile.ativo !== true
      || email.toLowerCase() !== parsed.email.toLowerCase()
      || typeof tenantId !== 'string'
      || tenantId.length === 0
      || tenantId.length > 128
      || !['Administrador', 'Representante', 'Vendedor'].includes(String(role))) return null;

    const rawPermissions = profile.permissoes;
    const permissions = rawPermissions && typeof rawPermissions === 'object' && !Array.isArray(rawPermissions)
      ? rawPermissions as Record<string, unknown>
      : {};
    return {
      uid: parsed.uid,
      email,
      tenantId,
      role: role as RepresentaApiUser['role'],
      permissions,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isOrderEmailRecipientAllowed(
  authorization: string,
  user: RepresentaApiUser,
  orderId: unknown,
  recipient: string,
  options: AuthorizeOptions = {},
): Promise<boolean> {
  if (typeof orderId !== 'string' || orderId.length === 0 || orderId.length > 128) return false;
  const projectId = options.projectId || DEFAULT_FIREBASE_PROJECT_ID;
  const parsed = parseFirebaseToken(authorization, projectId, options.now ?? Date.now());
  if (!parsed || parsed.uid !== user.uid) return false;

  const fetcher = options.fetcher || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  try {
    const getDocument = async (collectionName: string, documentId: string): Promise<Record<string, unknown> | null> => {
      const url = 'https://firestore.googleapis.com/v1/projects/' + projectId
        + '/databases/(default)/documents/' + collectionName + '/' + encodeURIComponent(documentId);
      const response = await fetcher(url, {
        headers: { Authorization: 'Bearer ' + parsed.token },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const document = await response.json() as FirestoreDocument;
      return parseFirestoreFields(document.fields || {});
    };

    const order = await getDocument('pedidos', orderId);
    if (!order || order.empresaRepresentacaoId !== user.tenantId) return false;
    const clientId = typeof order.clienteId === 'string' ? order.clienteId : '';
    const representedId = typeof order.representadaId === 'string' ? order.representadaId : '';
    if (!clientId || !representedId) return false;

    const [client, represented] = await Promise.all([
      getDocument('clientes', clientId),
      getDocument('representadas', representedId),
    ]);
    if (!client || client.empresaRepresentacaoId !== user.tenantId
      || !represented || represented.empresaRepresentacaoId !== user.tenantId) return false;

    const normalizedRecipient = recipient.trim().toLowerCase();
    const allowedEmails = [
      client.email,
      client.emailFaturamento,
      represented.email,
    ].filter((email): email is string => typeof email === 'string');
    return allowedEmails.some((email) => email.trim().toLowerCase() === normalizedRecipient);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function canCreateOrders(user: RepresentaApiUser): boolean {
  return user.role === 'Administrador' || user.permissions.criarPedidos !== false;
}

/**
 * Per-process rate limiting. Deployments with multiple serverless instances
 * should also configure a shared edge or Redis limiter.
 */
export function consumeApiRateLimit(
  namespace: string,
  key: string,
  maximum: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  if (!namespace || !key || maximum < 1 || windowMs < 1) return false;
  const bucketKey = namespace + ':' + key;
  const cutoff = now - windowMs;
  const recent = (rateLimitBuckets.get(bucketKey) || []).filter((time) => time > cutoff);
  if (recent.length >= maximum) {
    rateLimitBuckets.set(bucketKey, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(bucketKey, recent);

  if (rateLimitBuckets.size > 5000) {
    for (const [storedKey, times] of rateLimitBuckets) {
      if (times.every((time) => time <= cutoff)) rateLimitBuckets.delete(storedKey);
    }
  }
  return true;
}
