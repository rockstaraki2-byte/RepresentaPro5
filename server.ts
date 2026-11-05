import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { handleOrderTextDraftRequest } from './src/orderTextDraftApi';
import { authorizeRepresentaApiUser, canCreateOrders, consumeApiRateLimit, isOrderEmailRecipientAllowed } from './src/apiSecurity';

dotenv.config();

async function startServer() {
  const app = express();
  // Bound ordinary API payloads; PDF mail attachments get a separate 7 MB ceiling.
  app.use('/api/email/send', express.json({ limit: '7mb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ limit: '8kb', extended: false, parameterLimit: 20 }));

  // Lazy-loaded Gemini Client helper
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required but was not found.');
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // --- API Endpoints ---

  // Main Gemini endpoint for authenticated, bounded writing assistance.
  app.post('/api/gemini/generate', async (req, res) => {
    const user = await authorizeRepresentaApiUser(req.header('authorization') || '');
    if (!user) return res.status(401).json({ error: 'Entre novamente para continuar.' });
    if (!consumeApiRateLimit('gemini', user.uid, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Limite de uso de IA atingido. Tente novamente mais tarde.' });
    }

    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
    if (!prompt || prompt.length > 8000) {
      return res.status(400).json({ error: 'Informe um texto com até 8.000 caracteres.' });
    }
    const temperature = payload.temperature === undefined ? 0.7 : payload.temperature;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
      return res.status(400).json({ error: 'Parâmetro de criatividade inválido.' });
    }
    const responseMimeType = payload.responseMimeType;
    if (responseMimeType !== undefined
      && responseMimeType !== 'application/json'
      && responseMimeType !== 'text/plain') {
      return res.status(400).json({ error: 'Formato de resposta inválido.' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Serviço de IA indisponível neste ambiente.' });
    }

    try {
      const config: Record<string, unknown> = {
        systemInstruction: 'Você é um assistente de escrita comercial do RepresentaPRO. Gere respostas objetivas e seguras.',
        temperature,
        maxOutputTokens: 2048,
      };
      if (responseMimeType) config.responseMimeType = responseMimeType;
      const response = await getGeminiClient().models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config,
      });
      return res.json({ text: response.text || '' });
    } catch {
      console.error('Gemini generation failed');
      return res.status(502).json({ error: 'Falha temporária ao gerar o conteúdo.' });
    }
  });

  // Convert pasted WhatsApp order text into a reviewable draft. This endpoint
  // never writes an order; the user must review and save it in the normal form.
  app.post('/api/orders/parse-text', async (req, res) => {
    const result = await handleOrderTextDraftRequest(req.header('authorization') || '', req.body?.text);
    return res.status(result.status).json(result.body);
  });

  // CNPJ proxy for authenticated, bounded lookups.
  app.get('/api/cnpj/:cnpj', async (req, res) => {
    const user = await authorizeRepresentaApiUser(req.header('authorization') || '');
    if (!user) return res.status(401).json({ error: 'Entre novamente para continuar.' });
    if (!consumeApiRateLimit('cnpj', user.uid, 40, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Limite de consultas atingido. Tente novamente mais tarde.' });
    }

    const cnpj = String(req.params.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido. Deve conter exatamente 14 dígitos.' });
    }

    const mapBrasilApi = (data: any) => ({
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
      cnae_fiscal_descricao: data.cnae_fiscal_descricao || '',
    });

    try {
      const response = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return res.json(mapBrasilApi(await response.json()));
    } catch {
      // The fixed backup endpoint below is used when BrasilAPI is unavailable.
    }

    try {
      const backupResponse = await fetch('https://publica.cnpj.ws/cnpj/' + cnpj, {
        signal: AbortSignal.timeout(5000),
      });
      if (backupResponse.ok) {
        const backupData = await backupResponse.json() as any;
        const establishment = backupData.estabelecimento || {};
        return res.json({
          cnpj: backupData.cnpj,
          razao_social: backupData.razao_social || '',
          nome_fantasia: establishment.nome_fantasia || backupData.razao_social || '',
          telefone1: establishment.ddd1 && establishment.telefone1 ? establishment.ddd1 + establishment.telefone1 : '',
          email: establishment.email || '',
          logradouro: establishment.logradouro || '',
          numero: establishment.numero || '',
          bairro: establishment.bairro || '',
          municipio: establishment.cidade?.nome || '',
          uf: establishment.estado?.sigla || '',
          cnae_fiscal_descricao: establishment.atividade_principal?.descricao || '',
        });
      }
    } catch {
      // Return a generic upstream error without exposing vendor diagnostics.
    }

    return res.status(502).json({ error: 'Não foi possível consultar o CNPJ agora.' });
  });

  // Send a sales-order copy. Credentials are server-only; request bodies can never supply them.
  app.post('/api/email/send', async (req, res) => {
    const user = await authorizeRepresentaApiUser(req.header('authorization') || '');
    if (!user) return res.status(401).json({ error: 'Entre novamente para continuar.' });
    if (!canCreateOrders(user)) {
      return res.status(403).json({ error: 'Seu perfil não pode enviar pedidos.' });
    }
    if (!consumeApiRateLimit('email', user.uid, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Limite de envios atingido. Tente novamente mais tarde.' });
    }

    const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const to = typeof payload.to === 'string' ? payload.to.trim() : '';
    const subject = typeof payload.subject === 'string' ? payload.subject.replace(/[\r\n]/g, ' ').trim() : '';
    const body = typeof payload.body === 'string' ? payload.body : '';
    if (!to || to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
      || !subject || subject.length > 180
      || !body.trim() || body.length > 20000) {
      return res.status(400).json({ error: 'Confira destinatário, assunto e conteúdo do e-mail.' });
    }

    const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';
    const authorization = req.header('authorization') || '';
    if (!await isOrderEmailRecipientAllowed(authorization, user, orderId, to)) {
      return res.status(403).json({ error: 'O destinatário não está vinculado a este pedido.' });
    }

    let attachmentBuffer: Buffer | undefined;
    const attachment = payload.attachment;
    if (attachment !== undefined && attachment !== null && attachment !== '') {
      if (typeof attachment !== 'string' || attachment.length > 7 * 1024 * 1024) {
        return res.status(413).json({ error: 'O anexo excede o limite de 5 MB.' });
      }
      const base64 = attachment.startsWith('data:application/pdf;base64,')
        ? attachment.slice('data:application/pdf;base64,'.length)
        : attachment;
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
        return res.status(400).json({ error: 'O anexo PDF está em formato inválido.' });
      }
      attachmentBuffer = Buffer.from(base64, 'base64');
      if (attachmentBuffer.length > 5 * 1024 * 1024
        || attachmentBuffer.toString('ascii', 0, 5) !== '%PDF-') {
        return res.status(400).json({ error: 'O anexo precisa ser um PDF de até 5 MB.' });
      }
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASS;
    if (!gmailUser || !gmailPass) {
      return res.status(501).json({
        error: 'Envio pelo servidor não está configurado. Use o aplicativo de e-mail do aparelho.',
        needsFallback: true,
      });
    }

    const requestedName = typeof payload.fromName === 'string' ? payload.fromName : 'RepresentaPRO';
    const fromName = requestedName.replace(/[\r\n"\\]/g, '').trim().slice(0, 80) || 'RepresentaPRO';
    const rawFilename = typeof payload.attachmentName === 'string' ? payload.attachmentName : 'pedido.pdf';
    const filename = rawFilename.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'pedido.pdf';
    const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf';

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      const mailOptions: any = {
        from: '"' + fromName + '" <' + gmailUser + '>',
        to,
        subject,
        text: body,
      };
      if (attachmentBuffer) {
        mailOptions.attachments = [{
          filename: safeFilename,
          content: attachmentBuffer,
          contentType: 'application/pdf',
        }];
      }
      await transporter.sendMail(mailOptions);
      return res.json({ success: true, message: 'Cópia do pedido enviada por e-mail.' });
    } catch {
      console.error('Order email delivery failed');
      return res.status(502).json({ error: 'Falha temporária ao enviar o e-mail.' });
    }
  });

  app.use((error: any, _req: any, res: any, next: any) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'A requisição excede o limite permitido.' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'O corpo da requisição está malformado.' });
    }
    return next(error);
  });

  // --- Serve Frontend ---
  
  if (process.env.NODE_ENV === 'production') {
    // Serve static files from the built dist/ directory
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    
    // Fallback to index.html for Single Page Applications (SPA)
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });

    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        // Apply Vite HTML transforms (injects HMR client if enabled, styling, etc.)
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start full-stack server:', err);
  process.exit(1);
});
