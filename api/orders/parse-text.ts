import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleOrderTextDraftRequest } from '../../src/orderTextDraftApi';

type VercelRequest = IncomingMessage & { body?: unknown };

export const config = {
  api: { bodyParser: { sizeLimit: '64kb' } },
};

export default async function handler(req: VercelRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Método não permitido.' }));
    return;
  }

  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body) as unknown; } catch { return undefined; } })()
    : req.body;
  const text = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).text
    : undefined;
  const result = await handleOrderTextDraftRequest(req.headers.authorization || '', text);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(result.body));
}
