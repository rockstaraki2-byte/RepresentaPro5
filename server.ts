import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

  // Main Gemini endpoint for writing assistance and content generation
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { prompt, systemInstruction, temperature, responseMimeType, responseSchema } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const ai = getGeminiClient();

      // Configure generation parameters
      const config: any = {
        systemInstruction: systemInstruction || "You are a helpful, creative literary writing assistant.",
        temperature: temperature !== undefined ? temperature : 0.7,
      };

      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (responseSchema) {
        config.responseSchema = responseSchema;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config,
      });

      const text = response.text;
      return res.json({ text });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      return res.status(500).json({ 
        error: error.message || 'An error occurred during content generation.' 
      });
    }
  });

  // Proxy CNPJ queries directly to BrasilAPI (Receita Federal)
  app.get('/api/cnpj/:cnpj', async (req, res) => {
    try {
      const cnpj = req.params.cnpj.replace(/\D/g, '');
      if (cnpj.length !== 14) {
        return res.status(400).json({ error: 'CNPJ inválido. Deve conter exatamente 14 dígitos.' });
      }

      console.log(`Buscando CNPJ: ${cnpj} no BrasilAPI...`);
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      
      if (!response.ok) {
        throw new Error(`BrasilAPI retornou status ${response.status}`);
      }

      const data = await response.json();
      const mapped = {
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
      return res.json(mapped);
    } catch (error: any) {
      console.warn('Erro ao consultar CNPJ no BrasilAPI, tentando backup:', error.message);
      
      // Fallback API: CNPJ.ws
      try {
        const cnpj = req.params.cnpj.replace(/\D/g, '');
        const backupResponse = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (backupResponse.ok) {
          const backupData = await backupResponse.json();
          // Map to BrasilAPI-like structure so the frontend can read it transparently
          const mapped = {
            cnpj: backupData.cnpj,
            razao_social: backupData.razao_social,
            nome_fantasia: backupData.estabelecimento.nome_fantasia || backupData.razao_social,
            telefone1: (backupData.estabelecimento.ddd1 && backupData.estabelecimento.telefone1) 
              ? `${backupData.estabelecimento.ddd1}${backupData.estabelecimento.telefone1}` 
              : '',
            email: backupData.estabelecimento.email || '',
            logradouro: backupData.estabelecimento.logradouro || '',
            numero: backupData.estabelecimento.numero || '',
            bairro: backupData.estabelecimento.bairro || '',
            municipio: backupData.estabelecimento.cidade?.nome || '',
            uf: backupData.estabelecimento.estado?.sigla || '',
            cnae_fiscal_descricao: backupData.estabelecimento.atividade_principal?.descricao || ''
          };
          console.log('CNPJ retornado com sucesso da API de Backup.');
          return res.json(mapped);
        }
      } catch (backupError: any) {
        console.error('Erro no backup CNPJ:', backupError.message);
      }

      return res.status(500).json({ 
        error: 'Erro ao buscar o CNPJ na Receita Federal. Por favor, verifique o número ou tente preencher manualmente.' 
      });
    }
  });

  // Send sales order copy via email
  app.post('/api/email/send', async (req, res) => {
    try {
      const { to, subject, body, attachment, attachmentName } = req.body;
      if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Os campos "to", "subject" e "body" são obrigatórios.' });
      }

      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASS;

      console.log(`========================================`);
      console.log(`[EMAIL SENDING SERVICE]`);
      console.log(`Destinatário: ${to}`);
      console.log(`Assunto: ${subject}`);
      console.log(`Gmail configurado: ${gmailUser ? 'Sim' : 'Não'}`);
      console.log(`Anexo recebido: ${attachment ? 'Sim' : 'Não'} (${attachmentName || 'sem nome'})`);
      console.log(`========================================`);

      if (gmailUser && gmailPass) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailPass,
          },
        });

        const fromName = process.env.SMTP_FROM_NAME || 'RepresentaPRO';
        const mailOptions: any = {
          from: `"${fromName}" <${gmailUser}>`,
          to,
          subject,
          text: body,
        };

        if (attachment) {
          let cleanBase64 = attachment;
          if (cleanBase64.includes('%')) {
            try {
              cleanBase64 = decodeURIComponent(cleanBase64);
            } catch (e) {
              console.warn('Falha ao decodificar URI do anexo:', e);
            }
          }
          if (cleanBase64.includes('base64,')) {
            cleanBase64 = cleanBase64.split('base64,')[1];
          }
          // Remove any potential whitespace or newlines that might disrupt decoding
          cleanBase64 = cleanBase64.replace(/\s/g, '');

          mailOptions.attachments = [
            {
              filename: attachmentName || 'pedido.pdf',
              content: Buffer.from(cleanBase64, 'base64'),
              contentType: 'application/pdf',
            }
          ];
        }

        await transporter.sendMail(mailOptions);

        return res.json({ 
          success: true, 
          message: 'Cópia do pedido enviada por e-mail com o anexo PDF!' 
        });
      } else {
        // No email credentials configured
        return res.status(501).json({
          error: 'Credenciais de e-mail (GMAIL_USER e GMAIL_APP_PASS) não configuradas no ambiente do servidor.',
          needsFallback: true
        });
      }
    } catch (error: any) {
      console.error('Erro ao processar envio de e-mail:', error);
      return res.status(500).json({ error: error.message || 'Erro interno ao processar o e-mail.' });
    }
  });

  // --- Serve Frontend ---
  
  if (process.env.NODE_ENV === 'production') {
    // Serve static files from the built dist/ directory
    app.use(express.static(path.resolve(__dirname, 'dist')));
    
    // Fallback to index.html for Single Page Applications (SPA)
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
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
