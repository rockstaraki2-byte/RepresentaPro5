import { jsPDF } from 'jspdf';
import { Pedido, Cliente, Representada } from '../types';
import { formatarMoeda, formatarData, calcularParcelas, formatarTipoFaturamento } from '../utils';

/**
 * Generates a clean, professional vector-based PDF for a single sales order.
 */
export function gerarPedidoPDF(
  pedido: Pedido, 
  cliente?: Cliente, 
  representada?: Representada,
  empresaRepresentacao?: any,
  skipSave?: boolean
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Colors
  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 40, 'F');

  let headerTextOffset = 30;

  // Draw logo of represented brand (Fábrica) or representing company if present
  const logoToUse = representada?.logoUrl || empresaRepresentacao?.logoUrl;
  if (logoToUse && logoToUse.startsWith('data:image/')) {
    try {
      const format = logoToUse.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      // Draw logo in white card in header
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 6, 26, 26, 2, 2, 'F');
      doc.addImage(logoToUse, format, 14, 8, 22, 22);
      headerTextOffset = 44;
    } catch (err) {
      console.error('Erro ao adicionar logo no PDF:', err);
    }
  } else {
    // App Logo/Badge (Simulated in drawing)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 12, 10, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('R', 20, 19.5, { align: 'center' });
    headerTextOffset = 30;
  }

  // Header Text adaptive to company representation (Multi-company / multi-tenant)
  const repName = empresaRepresentacao?.nomeFantasia || 'REPRESENTAÇÃO COMERCIAL';
  const repRazao = empresaRepresentacao?.razaoSocial || 'Sistema Integrado RepresentaPRO';
  const repCNPJ = empresaRepresentacao?.cnpj ? `CNPJ: ${empresaRepresentacao.cnpj}` : 'Cópia Digital de Pedido de Venda';

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(repName.toUpperCase(), headerTextOffset, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 200, 210);
  doc.text(repRazao, headerTextOffset, 21);
  doc.setTextColor(148, 163, 184); // light gray
  doc.text(repCNPJ, headerTextOffset, 27);
  if (empresaRepresentacao?.telefone || empresaRepresentacao?.email) {
    const contactInfo = [empresaRepresentacao.telefone, empresaRepresentacao.email].filter(Boolean).join(' | ');
    doc.text(contactInfo, headerTextOffset, 32);
  } else {
    doc.text('Gerado através do RepresentaPRO', headerTextOffset, 32);
  }

  // Order Title & ID
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 48, 180, 20, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(15, 48, 180, 20, 'D');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`PEDIDO DE VENDA: #${pedido.numeroPedido}`, 20, 55);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const fatRaw = pedido.tipoFaturamento || cliente?.tipoFaturamento;
  const fatTxt = formatarTipoFaturamento(fatRaw, pedido.percentualNfPauta);
  const freteTxt = pedido.opcaoFrete && pedido.opcaoFrete !== 'nenhum' 
    ? `${pedido.tipoFrete || 'FOB'} (${pedido.valorFrete ? formatarMoeda(pedido.valorFrete) : 'R$ 0,00'})` 
    : 'Sem Frete';
  doc.text(`Emissão: ${formatarData(pedido.dataPedido)}   |   Faturamento: ${fatTxt}   |   Frete: ${freteTxt}   |   Status: ${pedido.status.toUpperCase()}`, 20, 62);

  let y = 74;

  // Representada (Fábrica)
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15, y, 88, 32, 'F');
  doc.rect(15, y, 88, 32, 'D');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REPRESENTADA / FÁBRICA', 20, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nome: ${representada?.nomeFantasia || 'N/A'}`, 20, y + 13);
  doc.text(`CNPJ: ${representada?.cnpj || 'N/A'}`, 20, y + 19);
  doc.text(`Contato: ${representada?.contato || 'N/A'}`, 20, y + 25);

  // Cliente (Comprador)
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(107, y, 88, 32, 'F');
  doc.rect(107, y, 88, 32, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENTE / COMPRADOR', 112, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Nome: ${cliente?.nomeFantasia || 'N/A'}`, 112, y + 13);
  doc.text(`CNPJ: ${cliente?.cnpj || 'N/A'}`, 112, y + 19);
  doc.text(`Local: ${cliente?.cidade || 'N/A'} - ${cliente?.uf || ''}`, 112, y + 25);

  y += 38;

  // Item List Table Header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(15, y, 180, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Foto', 27, y + 5.5, { align: 'center' });
  doc.text('Descrição do Produto', 42, y + 5.5);
  doc.text('Quant.', 126, y + 5.5, { align: 'center' });
  doc.text('Preço Unit.', 157, y + 5.5, { align: 'right' });
  doc.text('Total Item', 188, y + 5.5, { align: 'right' });

  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  // Table Body
  (pedido.itens || []).forEach((item, index) => {
    let fullDesc = '';
    if (item.codigo) fullDesc += `[${item.codigo}] `;
    fullDesc += item.descricao;
    if (item.cor) fullDesc += ` | Cor: ${item.cor}`;
    if (item.variacao) fullDesc += ` | Var: ${item.variacao}`;

    const splitDesc = doc.splitTextToSize(fullDesc, 73);
    const lineCount = splitDesc.length;
    const rowHeight = Math.max(20, 8 + (lineCount - 1) * 3.5);

    // Check pagination
    if (y + rowHeight > 270) {
      doc.addPage();
      y = 15;

      // Re-draw table header
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(15, y, 180, 8, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Foto', 27, y + 5.5, { align: 'center' });
      doc.text('Descrição do Produto', 42, y + 5.5);
      doc.text('Quant.', 126, y + 5.5, { align: 'center' });
      doc.text('Preço Unit.', 157, y + 5.5, { align: 'right' });
      doc.text('Total Item', 188, y + 5.5, { align: 'right' });

      y += 8;
    }

    if (index % 2 === 1) {
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.rect(15, y, 180, rowHeight, 'F');
    }
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(15, y + rowHeight, 195, y + rowHeight);

    // Keep a clear photo cell for every item. Products without a photo stay blank.
    const photoX = 17;
    const photoY = y + 2;
    const photoWidth = 20;
    const photoHeight = 16;
    doc.setFillColor(255, 255, 255);
    doc.rect(photoX, photoY, photoWidth, photoHeight, 'F');
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.rect(photoX, photoY, photoWidth, photoHeight, 'D');

    if (item.fotoUrl?.startsWith('data:image/')) {
      try {
        const imageProperties = doc.getImageProperties(item.fotoUrl);
        const imageScale = Math.min((photoWidth - 1) / imageProperties.width, (photoHeight - 1) / imageProperties.height);
        const imageWidth = imageProperties.width * imageScale;
        const imageHeight = imageProperties.height * imageScale;
        const imageX = photoX + (photoWidth - imageWidth) / 2;
        const imageY = photoY + (photoHeight - imageHeight) / 2;
        const imageFormat = item.fotoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'JPEG';
        doc.addImage(item.fotoUrl, imageFormat, imageX, imageY, imageWidth, imageHeight, `produto-${index}`, 'FAST');
      } catch (err) {
        console.error('Erro ao adicionar foto do produto no PDF:', err);
      }
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

    // Draw description lines
    for (let i = 0; i < lineCount; i++) {
      doc.text(splitDesc[i], 42, y + 4.5 + (i * 3.5));
    }

    const verticalCenterOffset = y + (rowHeight / 2) + 1.2;
    doc.text(String(item.quantidade), 126, verticalCenterOffset, { align: 'center' });
    doc.text(formatarMoeda(item.precoUnitario), 157, verticalCenterOffset, { align: 'right' });
    doc.text(formatarMoeda(item.totalItem), 188, verticalCenterOffset, { align: 'right' });

    y += rowHeight;
  });

  y += 6;

  // Condições de Pagamento se houver
  if (pedido.condicoesPagamento) {
    if (y > 240) {
      doc.addPage();
      y = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Condições de Pagamento:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitCond = doc.splitTextToSize(pedido.condicoesPagamento, 180);
    doc.text(splitCond, 15, y + 4.5);
    y += 6 + (splitCond.length * 4.5);

    const parcelas = calcularParcelas(pedido.valorTotal, pedido.dataPedido, pedido.condicoesPagamento);
    if (parcelas.length > 0) {
      y += 2;
      const boxWidth = 32;
      const boxHeight = 12;
      const startX = 15;
      let currentX = startX;
      
      parcelas.forEach((p) => {
        if (currentX + boxWidth > 195) {
          currentX = startX;
          y += boxHeight + 4;
        }
        
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(currentX, y, boxWidth, boxHeight, 1.5, 1.5, 'FD');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(formatarData(p.dataVencimento), currentX + (boxWidth / 2), y + 4.5, { align: 'center' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(formatarMoeda(p.valor), currentX + (boxWidth / 2), y + 9.5, { align: 'center' });
        
        currentX += boxWidth + 4;
      });
      y += boxHeight + 4;
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]); // reset text color
    }
  }

  // Observações se houver
  if (pedido.observacoes) {
    if (y > 240) {
      doc.addPage();
      y = 15;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Observações de Faturamento:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitObs = doc.splitTextToSize(pedido.observacoes, 180);
    doc.text(splitObs, 15, y + 4.5);
    y += 6 + (splitObs.length * 4.5);
  }

  y += 5;

  // Total Summary Panel
  if (y > 240) {
    doc.addPage();
    y = 15;
  }
  const temFrete = Boolean(pedido.valorFrete && pedido.valorFrete > 0);
  const panelHeight = temFrete ? 32 : 24;
  const subtotalProd = pedido.valorSubtotal || (temFrete ? (pedido.valorTotal - (pedido.valorFrete || 0)) : pedido.valorTotal);

  doc.setFillColor(248, 250, 252);
  doc.rect(115, y, 80, panelHeight, 'F');
  doc.rect(115, y, 80, panelHeight, 'D');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RESUMO FINANCEIRO DO PEDIDO', 120, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Subtotal dos Produtos:', 120, y + 12);
  doc.text(formatarMoeda(subtotalProd), 190, y + 12, { align: 'right' });

  if (temFrete) {
    const labelFrete = `Frete (${pedido.tipoFrete || 'FOB'}):`;
    doc.text(labelFrete, 120, y + 18);
    doc.text(formatarMoeda(pedido.valorFrete || 0), 190, y + 18, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('VALOR TOTAL FINAL:', 120, y + 25);
    doc.text(formatarMoeda(pedido.valorTotal), 190, y + 25, { align: 'right' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('VALOR TOTAL DO PEDIDO:', 120, y + 18);
    doc.text(formatarMoeda(pedido.valorTotal), 190, y + 18, { align: 'right' });
  }

  // Add a nice footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Este documento é uma cópia digital informativa de representação comercial.', 105, 280, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468', 105, 285, { align: 'center' });

  // Save
  if (!skipSave) {
    doc.save(`Pedido_${pedido.numeroPedido}_${representada?.nomeFantasia || 'Venda'}.pdf`);
  }
  return doc;
}

/**
 * Generates a monthly summary report in PDF.
 */
export function gerarResumoMensalPDF(
  pedidos: Pedido[], 
  clientes: Cliente[], 
  representadas: Representada[], 
  anoMes: string,
  empresaRepresentacao?: any
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  // Filter orders of the given month (e.g. "2026-07")
  const pedidosMes = pedidos.filter(p => p.dataPedido.startsWith(anoMes));
  const pedidosValidos = pedidosMes.filter(p => p.status !== 'Cancelado');

  const totalVendas = pedidosValidos.reduce((sum, p) => sum + p.valorTotal, 0);
  const totalComissoes = pedidosValidos.reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPaga = pedidosMes.filter(p => p.status === 'Pago').reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPendente = pedidosMes.filter(p => p.status === 'Faturado' || p.status === 'Pendente').reduce((sum, p) => sum + p.valorComissao, 0);

  const [ano, mes] = anoMes.split('-');
  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mesNome = mesesNomes[parseInt(mes) - 1] || mes;

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  let headerTextOffset = 15;
  
  // Render active company logo close to the title if available, otherwise a nice green badge
  if (empresaRepresentacao?.logoUrl && empresaRepresentacao.logoUrl.startsWith('data:image/')) {
    try {
      const format = empresaRepresentacao.logoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 24, 24, 2, 2, 'F');
      doc.addImage(empresaRepresentacao.logoUrl, format, 14, 7, 20, 20);
      headerTextOffset = 42;
    } catch (err) {
      console.error('Erro ao adicionar logo no PDF do Relatório:', err);
    }
  } else {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(12, 8, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('R', 18, 16.5, { align: 'center' });
    headerTextOffset = 28;
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO DE VENDAS E COMISSÕES', headerTextOffset, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Período de Referência: ${mesNome} de ${ano} | ${empresaRepresentacao?.nomeFantasia || 'RepresentaPRO'}`, headerTextOffset, 21);

  // Quick stats panels (4 cols)
  const colW = 42;
  const colY = 44;
  
  // Stat 1: Total faturado
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15, colY, colW, 20, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(15, colY, colW, 20, 'D');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('TOTAL DE VENDAS', 18, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(totalVendas), 18, colY + 13);

  // Stat 2: Total comissoes
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15 + colW + 4, colY, colW, 20, 'F');
  doc.rect(15 + colW + 4, colY, colW, 20, 'D');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('COMISSÕES TOTAIS', 15 + colW + 7, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(totalComissoes), 15 + colW + 7, colY + 13);

  // Stat 3: Comissões Recebidas
  doc.setFillColor(240, 253, 244); // light green bg
  doc.rect(15 + (colW * 2) + 8, colY, colW, 20, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(15 + (colW * 2) + 8, colY, colW, 20, 'D');
  doc.setTextColor(21, 128, 61); // green-700
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('VALORES RECEBIDOS', 15 + (colW * 2) + 11, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(comissaoPaga), 15 + (colW * 2) + 11, colY + 13);

  // Stat 4: Comissões Pendentes
  doc.setFillColor(254, 243, 199); // light amber bg
  doc.rect(15 + (colW * 3) + 12, colY, colW, 20, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.rect(15 + (colW * 3) + 12, colY, colW, 20, 'D');
  doc.setTextColor(180, 83, 9); // amber-700
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('VALORES A RECEBER', 15 + (colW * 3) + 15, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(comissaoPendente), 15 + (colW * 3) + 15, colY + 13);

  let y = 72;

  // Table header (Optimized Spacing to prevent any overlap)
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  doc.text('Cód. Pedido', 16, y + 5.5);
  doc.text('Data', 44, y + 5.5);
  doc.text('Cliente', 62, y + 5.5);
  doc.text('Representada', 102, y + 5.5);
  doc.text('Status', 140, y + 5.5);
  doc.text('Valor Total', 170, y + 5.5, { align: 'right' });
  doc.text('Comissão', 195, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  if (pedidosMes.length === 0) {
    doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
    doc.rect(15, y, 180, 12, 'F');
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhum pedido de venda registrado para este mês.', 105, y + 7, { align: 'center' });
    y += 12;
  } else {
    pedidosMes.forEach((p, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
        doc.rect(15, y, 180, 8, 'F');
      }
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.line(15, y + 8, 195, y + 8);

      const cli = clientes.find(c => c.id === p.clienteId);
      const rep = representadas.find(r => r.id === p.representadaId);

      // Truncate values to fit precisely within allocated columns
      const displayPedidoNum = p.numeroPedido.length > 13 ? p.numeroPedido.substring(0, 11) + '..' : p.numeroPedido;
      const displayCliente = cli?.nomeFantasia ? (cli.nomeFantasia.length > 18 ? cli.nomeFantasia.substring(0, 16) + '..' : cli.nomeFantasia) : 'N/A';
      const displayRepresentada = rep?.nomeFantasia ? (rep.nomeFantasia.length > 16 ? rep.nomeFantasia.substring(0, 14) + '..' : rep.nomeFantasia) : 'N/A';

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${displayPedidoNum}`, 16, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(formatarData(p.dataPedido), 44, y + 5.5);
      doc.text(displayCliente, 62, y + 5.5);
      doc.text(displayRepresentada, 102, y + 5.5);
      doc.text(p.status.toUpperCase(), 140, y + 5.5);
      doc.text(formatarMoeda(p.valorTotal), 170, y + 5.5, { align: 'right' });
      doc.text(formatarMoeda(p.valorComissao), 195, y + 5.5, { align: 'right' });

      y += 8;
    });
  }

  // Totals Row
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 10, 'F');
  doc.rect(15, y, 180, 10, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RESUMO DE TOTAIS:', 18, y + 6.5);
  
  doc.setFontSize(8);
  doc.text(`Vendas Ativas: ${formatarMoeda(totalVendas)}`, 75, y + 6.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Comissões Est.: ${formatarMoeda(totalComissoes)}`, 135, y + 6.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 105, 280, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468', 105, 285, { align: 'center' });

  doc.save(`Resumo_Mensal_${ano}_${mes}.pdf`);
}

/**
 * Generates a period summary report in PDF based on filtered orders.
 */
export function gerarResumoPeriodoPDF(
  pedidosFiltrados: Pedido[], 
  clientes: Cliente[], 
  representadas: Representada[], 
  dataDe: string,
  dataAte: string,
  empresaRepresentacao?: any
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  const pedidosValidos = pedidosFiltrados.filter(p => p.status !== 'Cancelado');

  const totalVendas = pedidosValidos.reduce((sum, p) => sum + p.valorTotal, 0);
  const totalComissoes = pedidosValidos.reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPaga = pedidosFiltrados.filter(p => p.status === 'Pago').reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPendente = pedidosFiltrados.filter(p => p.status === 'Faturado' || p.status === 'Pendente').reduce((sum, p) => sum + p.valorComissao, 0);

  // Period label
  let periodoLabel = 'Período Completo';
  if (dataDe && dataAte) {
    periodoLabel = `De ${formatarData(dataDe)} até ${formatarData(dataAte)}`;
  } else if (dataDe) {
    periodoLabel = `A partir de ${formatarData(dataDe)}`;
  } else if (dataAte) {
    periodoLabel = `Até ${formatarData(dataAte)}`;
  }

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  let headerTextOffset = 15;
  
  if (empresaRepresentacao?.logoUrl && empresaRepresentacao.logoUrl.startsWith('data:image/')) {
    try {
      const format = empresaRepresentacao.logoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 24, 24, 2, 2, 'F');
      doc.addImage(empresaRepresentacao.logoUrl, format, 14, 7, 20, 20);
      headerTextOffset = 42;
    } catch (err) {
      console.error('Erro ao adicionar logo no PDF do Relatório:', err);
    }
  } else {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(12, 8, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('R', 18, 16.5, { align: 'center' });
    headerTextOffset = 28;
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RESUMO DE VENDAS E COMISSÕES POR PERÍODO', headerTextOffset, 15);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Período: ${periodoLabel} | ${empresaRepresentacao?.nomeFantasia || 'RepresentaPRO'}`, headerTextOffset, 21);

  // Quick stats panels (4 cols)
  const colW = 42;
  const colY = 44;
  
  // Stat 1: Total faturado
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15, colY, colW, 20, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.rect(15, colY, colW, 20, 'D');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('TOTAL DE VENDAS', 18, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(totalVendas), 18, colY + 13);

  // Stat 2: Total comissoes
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.rect(15 + colW + 4, colY, colW, 20, 'F');
  doc.rect(15 + colW + 4, colY, colW, 20, 'D');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('COMISSÕES TOTAIS', 15 + colW + 7, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(totalComissoes), 15 + colW + 7, colY + 13);

  // Stat 3: Comissões Recebidas
  doc.setFillColor(240, 253, 244); // light green bg
  doc.rect(15 + (colW * 2) + 8, colY, colW, 20, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(15 + (colW * 2) + 8, colY, colW, 20, 'D');
  doc.setTextColor(21, 128, 61); // green-700
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('VALORES RECEBIDOS', 15 + (colW * 2) + 11, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(comissaoPaga), 15 + (colW * 2) + 11, colY + 13);

  // Stat 4: Comissões Pendentes
  doc.setFillColor(254, 243, 199); // light amber bg
  doc.rect(15 + (colW * 3) + 12, colY, colW, 20, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.rect(15 + (colW * 3) + 12, colY, colW, 20, 'D');
  doc.setTextColor(180, 83, 9); // amber-700
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('VALORES A RECEBER', 15 + (colW * 3) + 15, colY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(formatarMoeda(comissaoPendente), 15 + (colW * 3) + 15, colY + 13);

  let y = 72;

  // Table header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  doc.text('Cód. Pedido', 16, y + 5.5);
  doc.text('Data', 44, y + 5.5);
  doc.text('Cliente', 62, y + 5.5);
  doc.text('Representada', 102, y + 5.5);
  doc.text('Status', 140, y + 5.5);
  doc.text('Valor Total', 170, y + 5.5, { align: 'right' });
  doc.text('Comissão', 195, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

  if (pedidosFiltrados.length === 0) {
    doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
    doc.rect(15, y, 180, 12, 'F');
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhum pedido de venda registrado para os filtros selecionados.', 105, y + 7, { align: 'center' });
    y += 12;
  } else {
    pedidosFiltrados.forEach((p, index) => {
      // Check pagination
      if (y > 260) {
        doc.addPage();
        y = 15;
        // Reprint header on new page
        doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.rect(15, y, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Cód. Pedido', 16, y + 5.5);
        doc.text('Data', 44, y + 5.5);
        doc.text('Cliente', 62, y + 5.5);
        doc.text('Representada', 102, y + 5.5);
        doc.text('Status', 140, y + 5.5);
        doc.text('Valor Total', 170, y + 5.5, { align: 'right' });
        doc.text('Comissão', 195, y + 5.5, { align: 'right' });
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      }

      if (index % 2 === 1) {
        doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
        doc.rect(15, y, 180, 8, 'F');
      }
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.line(15, y + 8, 195, y + 8);

      const cli = clientes.find(c => c.id === p.clienteId);
      const rep = representadas.find(r => r.id === p.representadaId);

      const displayPedidoNum = p.numeroPedido.length > 13 ? p.numeroPedido.substring(0, 11) + '..' : p.numeroPedido;
      const displayCliente = cli?.nomeFantasia ? (cli.nomeFantasia.length > 18 ? cli.nomeFantasia.substring(0, 16) + '..' : cli.nomeFantasia) : 'N/A';
      const displayRepresentada = rep?.nomeFantasia ? (rep.nomeFantasia.length > 16 ? rep.nomeFantasia.substring(0, 14) + '..' : rep.nomeFantasia) : 'N/A';

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`#${displayPedidoNum}`, 16, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(formatarData(p.dataPedido), 44, y + 5.5);
      doc.text(displayCliente, 62, y + 5.5);
      doc.text(displayRepresentada, 102, y + 5.5);
      doc.text(p.status.toUpperCase(), 140, y + 5.5);
      doc.text(formatarMoeda(p.valorTotal), 170, y + 5.5, { align: 'right' });
      doc.text(formatarMoeda(p.valorComissao), 195, y + 5.5, { align: 'right' });

      y += 8;
    });
  }

  // Totals Row
  if (y > 260) {
    doc.addPage();
    y = 15;
  }
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 180, 10, 'F');
  doc.rect(15, y, 180, 10, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('RESUMO DE TOTAIS:', 18, y + 6.5);
  
  doc.setFontSize(8);
  doc.text(`Vendas Ativas: ${formatarMoeda(totalVendas)}`, 75, y + 6.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Comissões Est.: ${formatarMoeda(totalComissoes)}`, 135, y + 6.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Relatório de período gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 105, 280, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468', 105, 285, { align: 'center' });

  doc.save(`Resumo_Periodo_${dataDe || 'inicio'}_a_${dataAte || 'fim'}.pdf`);
}

/**
 * Generates a complete Dashboard summary report in PDF with custom filters.
 */
export function gerarDashboardPDF(
  pedidos: Pedido[],
  clientes: Cliente[],
  representadas: Representada[],
  filtros: { representadaId: string; clienteId: string; status: string; dataDe: string; dataAte: string },
  empresaRepresentacao?: any
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  // Apply filters to calculate stats
  let filteredPedidos = pedidos;
  if (filtros.representadaId && filtros.representadaId !== 'Todos') {
    filteredPedidos = filteredPedidos.filter(p => p.representadaId === filtros.representadaId);
  }
  if (filtros.clienteId && filtros.clienteId !== 'Todos') {
    filteredPedidos = filteredPedidos.filter(p => p.clienteId === filtros.clienteId);
  }
  if (filtros.status && filtros.status !== 'Todos') {
    filteredPedidos = filteredPedidos.filter(p => p.status === filtros.status);
  }
  if (filtros.dataDe) {
    filteredPedidos = filteredPedidos.filter(p => p.dataPedido >= filtros.dataDe);
  }
  if (filtros.dataAte) {
    filteredPedidos = filteredPedidos.filter(p => p.dataPedido <= filtros.dataAte);
  }

  const activePedidos = filteredPedidos.filter(p => p.status !== 'Cancelado');
  const totalVendas = activePedidos.reduce((sum, p) => sum + p.valorTotal, 0);
  const totalComissoes = activePedidos.reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPaga = filteredPedidos.filter(p => p.status === 'Pago').reduce((sum, p) => sum + p.valorComissao, 0);
  const comissaoPendente = filteredPedidos.filter(p => p.status === 'Faturado' || p.status === 'Pendente').reduce((sum, p) => sum + p.valorComissao, 0);

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  let headerTextOffset = 15;
  
  if (empresaRepresentacao?.logoUrl && empresaRepresentacao.logoUrl.startsWith('data:image/')) {
    try {
      const format = empresaRepresentacao.logoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 24, 24, 2, 2, 'F');
      doc.addImage(empresaRepresentacao.logoUrl, format, 14, 7, 20, 20);
      headerTextOffset = 42;
    } catch (err) {
      console.error('Erro ao adicionar logo no PDF do Relatório:', err);
    }
  } else {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(12, 8, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('R', 18, 16.5, { align: 'center' });
    headerTextOffset = 28;
  }

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  
  const repName = empresaRepresentacao?.nomeFantasia || 'PAINEL DE REPRESENTAÇÃO COMERCIAL';
  const repDetails = empresaRepresentacao?.razaoSocial 
    ? `${empresaRepresentacao.razaoSocial} | CNPJ: ${empresaRepresentacao.cnpj}`
    : 'Relatório Executivo de Desempenho e Métricas';

  doc.text(repName.toUpperCase(), headerTextOffset, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 200, 210);
  doc.text(repDetails, headerTextOffset, 20);

  // Filter labels
  let filterText = 'Filtros aplicados: ';
  const repSelected = representadas.find(r => r.id === filtros.representadaId);
  const cliSelected = clientes.find(c => c.id === filtros.clienteId);
  filterText += `Fábrica: ${repSelected ? repSelected.nomeFantasia : 'Todas'} | `;
  filterText += `Cliente: ${cliSelected ? cliSelected.nomeFantasia : 'Todos'} | `;
  filterText += `Status: ${filtros.status || 'Todos'}`;
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(doc.splitTextToSize(filterText, 210 - headerTextOffset - 15), headerTextOffset, 26, { lineHeightFactor: 1 });

  // Quick stats panels with softer, rounded cards.
  const colW = 42;
  const colY = 42;
  const statCards = [
    { label: 'TOTAL DE VENDAS', value: formatarMoeda(totalVendas), fill: lightColor, border: borderColor, text: darkColor },
    { label: 'COMISSÕES TOTAIS', value: formatarMoeda(totalComissoes), fill: lightColor, border: borderColor, text: darkColor },
    { label: 'COMISSÃO RECEBIDA', value: formatarMoeda(comissaoPaga), fill: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
    { label: 'COMISSÃO A RECEBER', value: formatarMoeda(comissaoPendente), fill: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] }
  ];

  statCards.forEach((card, index) => {
    const x = 15 + (colW + 4) * index;
    doc.setFillColor(card.fill[0], card.fill[1], card.fill[2]);
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.roundedRect(x, colY, colW, 20, 3, 3, 'FD');
    doc.setTextColor(card.text[0], card.text[1], card.text[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(card.label, x + 3, colY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(card.value, x + 3, colY + 13);
  });

  const tableX = 15;
  const tableWidth = 180;
  const contentBottom = 270;
  const tableFontSize = 7;
  const lineHeightMm = tableFontSize * 1.15 * 25.4 / 72;

  type DashboardPdfColumn = {
    label: string;
    width: number;
    value: (item: any) => string;
    align?: 'left' | 'right';
    bold?: boolean;
  };

  const wrapCell = (value: string, width: number, bold = false): string[] => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(tableFontSize);
    const lines = doc.splitTextToSize(value || 'N/A', Math.max(4, width - 4));
    return Array.isArray(lines) ? lines : [lines];
  };

  const drawSectionBand = (title: string, top: number): number => {
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.roundedRect(tableX, top, tableWidth, 7, 1.8, 1.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(title, tableX + 3, top + 4.8);
    return top + 7;
  };

  const getHeaderHeight = (columns: DashboardPdfColumn[]): number => {
    const lineCounts = columns.map(column => wrapCell(column.label, column.width, true).length);
    return Math.max(7, 2 + Math.max(...lineCounts) * lineHeightMm);
  };

  const drawTableHeader = (columns: DashboardPdfColumn[], top: number): number => {
    const headerHeight = getHeaderHeight(columns);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(tableX, top, tableWidth, headerHeight, 1.4, 1.4, 'F');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tableFontSize);

    let x = tableX;
    columns.forEach(column => {
      const lines = wrapCell(column.label, column.width, true);
      const textY = top + (headerHeight - lines.length * lineHeightMm) / 2 + tableFontSize * 0.3528 * 0.85;
      doc.text(lines, x + 2, textY, { lineHeightFactor: 1.15 });
      x += column.width;
    });

    return top + headerHeight;
  };

  const prepareDashboardRow = (item: any, columns: DashboardPdfColumn[]) => {
    const cells = columns.map(column => wrapCell(column.value(item), column.width, Boolean(column.bold)));
    const maxLines = Math.max(...cells.map(lines => lines.length));
    return {
      cells,
      height: Math.max(7, 2.2 + maxLines * lineHeightMm)
    };
  };

  const drawDashboardRow = (
    prepared: ReturnType<typeof prepareDashboardRow>,
    columns: DashboardPdfColumn[],
    top: number,
    index: number
  ) => {
    if (index % 2 === 1) {
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.rect(tableX, top, tableWidth, prepared.height, 'F');
    }

    let x = tableX;
    columns.forEach((column, cellIndex) => {
      const lines = prepared.cells[cellIndex];
      const textY = top + (prepared.height - lines.length * lineHeightMm) / 2 + tableFontSize * 0.3528 * 0.85;
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont('helvetica', column.bold ? 'bold' : 'normal');
      doc.setFontSize(tableFontSize);
      const align = column.align || 'left';
      const textX = align === 'right' ? x + column.width - 2 : x + 2;
      doc.text(lines, textX, textY, { align, lineHeightFactor: 1.15 });
      x += column.width;
    });

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(tableX, top + prepared.height, tableX + tableWidth, top + prepared.height);
  };

  let y = 70;
  const startContinuationPage = (sectionTitle: string, columns: DashboardPdfColumn[]) => {
    doc.addPage('a4', 'portrait');
    y = 18;
    y = drawSectionBand(sectionTitle + ' (continuação)', y);
    y = drawTableHeader(columns, y);
  };

  const drawDashboardRows = (items: any[], columns: DashboardPdfColumn[], sectionTitle: string) => {
    items.forEach((item, index) => {
      const prepared = prepareDashboardRow(item, columns);
      if (y + prepared.height > contentBottom) {
        startContinuationPage(sectionTitle, columns);
      }
      drawDashboardRow(prepared, columns, y, index);
      y += prepared.height;
    });
  };

  // Section 1: Performance by Factory. Every cell wraps instead of shortening names.
  const performanceColumns: DashboardPdfColumn[] = [
    { label: 'Fábrica / Marca', width: 72, value: row => row.name, bold: true },
    { label: 'Volume Faturado', width: 38, value: row => row.volume, align: 'right' },
    { label: 'Comissão Estimada', width: 43, value: row => row.commission, align: 'right' },
    { label: '% do Total', width: 27, value: row => row.percent, align: 'right' }
  ];

  y = drawSectionBand('DESEMPENHO POR FABRICANTE / REPRESENTADA', y);
  y = drawTableHeader(performanceColumns, y);

  const performanceRows = representadas.map(rep => {
    const repPedidos = activePedidos.filter(p => p.representadaId === rep.id);
    const repVendas = repPedidos.reduce((sum, p) => sum + p.valorTotal, 0);
    const repComissao = repPedidos.reduce((sum, p) => sum + p.valorComissao, 0);
    const percent = totalVendas > 0 ? (repVendas / totalVendas) * 100 : 0;
    return {
      name: rep.nomeFantasia,
      volume: formatarMoeda(repVendas),
      commission: formatarMoeda(repComissao),
      percent: percent.toFixed(1) + '%'
    };
  });
  drawDashboardRows(performanceRows, performanceColumns, 'DESEMPENHO POR FABRICANTE / REPRESENTADA');
  y += 6;

  // Section 2: Recent Transactions under active filters.
  const transactionTitle = 'TRANSAÇÕES RECENTES FILTRADAS (MÁXIMO 12)';
  const transactionColumns: DashboardPdfColumn[] = [
    { label: 'Cód. Pedido', width: 26, value: row => '#' + row.orderNumber, bold: true },
    { label: 'Emissão', width: 18, value: row => row.date },
    { label: 'Cliente', width: 38, value: row => row.client },
    { label: 'Representada', width: 36, value: row => row.company },
    { label: 'Status', width: 24, value: row => row.status },
    { label: 'Total', width: 19, value: row => row.total, align: 'right' },
    { label: 'Comissão', width: 19, value: row => row.commission, align: 'right' }
  ];

  const transactionStartHeight = 7 + getHeaderHeight(transactionColumns) + 7;
  if (y + transactionStartHeight > contentBottom) {
    doc.addPage('a4', 'portrait');
    y = 18;
  }
  y = drawSectionBand(transactionTitle, y);
  y = drawTableHeader(transactionColumns, y);

  const transactionRows = filteredPedidos.slice(0, 12).map(p => {
    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);
    return {
      orderNumber: p.numeroPedido,
      date: formatarData(p.dataPedido),
      client: cli?.nomeFantasia || 'N/A',
      company: rep?.nomeFantasia || 'N/A',
      status: p.status.toUpperCase(),
      total: formatarMoeda(p.valorTotal),
      commission: formatarMoeda(p.valorComissao)
    };
  });

  if (transactionRows.length > 0) {
    drawDashboardRows(transactionRows, transactionColumns, transactionTitle);
  } else {
    const emptyLines = wrapCell('Nenhum pedido atende aos filtros definidos.', tableWidth, false);
    const emptyHeight = Math.max(10, 2.2 + emptyLines.length * lineHeightMm);
    if (y + emptyHeight > contentBottom) {
      startContinuationPage(transactionTitle, transactionColumns);
    }
    doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
    doc.rect(tableX, y, tableWidth, emptyHeight, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(tableFontSize);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    const emptyY = y + (emptyHeight - emptyLines.length * lineHeightMm) / 2 + tableFontSize * 0.3528 * 0.85;
    doc.text(emptyLines, tableX + 4, emptyY, { lineHeightFactor: 1.15 });
    y += emptyHeight;
  }

  // Keep the footer clear of wrapped rows on every page.
  const generatedAt = new Date();
  const generatedAtText = 'Relatório Executivo Gerencial gerado em ' + generatedAt.toLocaleDateString('pt-BR') + ' às ' + generatedAt.toLocaleTimeString('pt-BR');
  const copyrightText = '© ' + generatedAt.getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468';
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(generatedAtText, 105, 280, { align: 'center' });
    doc.text(copyrightText, 105, 285, { align: 'center' });
  }

  doc.save('Dashboard_Executivo_' + new Date().toISOString().split('T')[0] + '.pdf');
}

/**
 * Generates a commission summary report in PDF.
 */
export function gerarComissoesPDF(
  pedidos: Pedido[], 
  clientes: Cliente[], 
  representadas: Representada[], 
  empresaRepresentacao?: any
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  let headerTextOffset = 30;

  if (empresaRepresentacao?.logoUrl && empresaRepresentacao.logoUrl.startsWith('data:image/')) {
    try {
      const format = empresaRepresentacao.logoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 22, 22, 2, 2, 'F');
      doc.addImage(empresaRepresentacao.logoUrl, format, 14, 7, 18, 18);
      headerTextOffset = 38;
    } catch (err) {
      console.error('Erro ao adicionar logo:', err);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RECONCILIAÇÃO E CONTROLE DE COMISSÕES', headerTextOffset, 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(empresaRepresentacao?.nomeFantasia || 'RepresentaPRO', headerTextOffset, 22);
  doc.text(`Cnpj: ${empresaRepresentacao?.cnpj || 'N/A'} | Contato: ${empresaRepresentacao?.telefone || 'N/A'}`, headerTextOffset, 26);

  let y = 45;

  // Overview box
  const totalComissoes = pedidos.reduce((sum, p) => sum + (p.statusComissao !== 'Excluida' ? p.valorComissao : 0), 0);
  const comissoesPagas = pedidos.filter(p => p.statusComissao === 'Paga').reduce((sum, p) => sum + p.valorComissao, 0);
  const comissoesLiberadas = pedidos.filter(p => p.statusComissao === 'Liberada').reduce((sum, p) => sum + p.valorComissao, 0);
  const comissoesPendentes = pedidos.filter(p => !p.statusComissao || p.statusComissao === 'Pendente').reduce((sum, p) => sum + p.valorComissao, 0);

  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RESUMO DO PERÍODO', 18, y + 5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL DE COMISSÕES', 18, y + 11);
  doc.text('COMISSÕES PAGAS', 65, y + 11);
  doc.text('COMISSÕES LIBERADAS', 112, y + 11);
  doc.text('COMISSÕES PENDENTES', 158, y + 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(formatarMoeda(totalComissoes), 18, y + 17);
  
  doc.setTextColor(16, 185, 129); // Green for Paid
  doc.text(formatarMoeda(comissoesPagas), 65, y + 17);
  
  doc.setTextColor(59, 130, 246); // Blue for Released
  doc.text(formatarMoeda(comissoesLiberadas), 112, y + 17);
  
  doc.setTextColor(245, 158, 11); // Amber for Pending
  doc.text(formatarMoeda(comissoesPendentes), 158, y + 17);

  y += 30;

  // Table header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Cód. Pedido', 16, y + 4.8);
  doc.text('Emissão', 44, y + 4.8);
  doc.text('Cliente', 62, y + 4.8);
  doc.text('Representada', 102, y + 4.8);
  doc.text('Status Com.', 138, y + 4.8);
  doc.text('Vlr. Pedido', 168, y + 4.8, { align: 'right' });
  doc.text('%', 178, y + 4.8, { align: 'right' });
  doc.text('Comissão', 194, y + 4.8, { align: 'right' });

  y += 7;

  pedidos.forEach((p, idx) => {
    // Page brake safety
    if (y > 270) {
      doc.addPage();
      y = 15;
      // Header again
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(14, y, 182, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('Cód. Pedido', 16, y + 4.8);
      doc.text('Emissão', 44, y + 4.8);
      doc.text('Cliente', 62, y + 4.8);
      doc.text('Representada', 102, y + 4.8);
      doc.text('Status Com.', 138, y + 4.8);
      doc.text('Vlr. Pedido', 168, y + 4.8, { align: 'right' });
      doc.text('%', 178, y + 4.8, { align: 'right' });
      doc.text('Comissão', 194, y + 4.8, { align: 'right' });
      y += 7;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.rect(14, y, 182, 7, 'F');
    }

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(14, y + 7, 196, y + 7);

    const cli = clientes.find(c => c.id === p.clienteId);
    const rep = representadas.find(r => r.id === p.representadaId);

    const displayPedidoNum = p.numeroPedido.length > 13 ? p.numeroPedido.substring(0, 11) + '..' : p.numeroPedido;
    const displayCliente = cli?.nomeFantasia ? (cli.nomeFantasia.length > 18 ? cli.nomeFantasia.substring(0, 16) + '..' : cli.nomeFantasia) : 'N/A';
    const displayRepresentada = rep?.nomeFantasia ? (rep.nomeFantasia.length > 16 ? rep.nomeFantasia.substring(0, 14) + '..' : rep.nomeFantasia) : 'N/A';
    const statusCom = p.statusComissao || 'Pendente';

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(`#${displayPedidoNum}`, 16, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.text(formatarData(p.dataPedido), 44, y + 4.8);
    doc.text(displayCliente, 62, y + 4.8);
    doc.text(displayRepresentada, 102, y + 4.8);
    
    // Status color
    if (statusCom === 'Paga') {
      doc.setTextColor(16, 185, 129);
    } else if (statusCom === 'Liberada') {
      doc.setTextColor(59, 130, 246);
    } else {
      doc.setTextColor(245, 158, 11);
    }
    doc.setFont('helvetica', 'bold');
    doc.text(statusCom.toUpperCase(), 138, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(formatarMoeda(p.valorTotal), 168, y + 4.8, { align: 'right' });
    doc.text(`${p.comissaoPercentual}%`, 178, y + 4.8, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(p.valorComissao), 194, y + 4.8, { align: 'right' });

    y += 7;
  });

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Relatório de Controle de Comissões - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 280, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468', 105, 285, { align: 'center' });

  doc.save(`Controle_Comissoes_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Generates a financial forecasting and provisioning report in PDF.
 */
export function gerarProvisionamentoPDF(
  installments: {
    id: string;
    numeroPedido: string;
    clienteNome: string;
    representadaNome: string;
    parcelaIndex: number;
    parcelaTotal: number;
    dataVencimento: string;
    valorTotal: number;
    valorComissao: number;
    valorDespesa: number;
  }[],
  selectedMonth: string,
  totalRevenue: number,
  totalExpense: number,
  empresaRepresentacao?: any
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [16, 185, 129]; // Emerald 500
  const darkColor = [30, 41, 59]; // Slate 800
  const lightColor = [248, 250, 252]; // Slate 50
  const borderColor = [226, 232, 240]; // Slate 200

  // Header Banner
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  let headerTextOffset = 30;

  if (empresaRepresentacao?.logoUrl && empresaRepresentacao.logoUrl.startsWith('data:image/')) {
    try {
      const format = empresaRepresentacao.logoUrl.split(';')[0].split('/')[1]?.toUpperCase() || 'PNG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(12, 5, 22, 22, 2, 2, 'F');
      doc.addImage(empresaRepresentacao.logoUrl, format, 14, 7, 18, 18);
      headerTextOffset = 38;
    } catch (err) {
      console.error('Erro ao adicionar logo:', err);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FLUXO DE CAIXA E PROVISIONAMENTO FINANCEIRO', headerTextOffset, 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(empresaRepresentacao?.nomeFantasia || 'RepresentaPRO', headerTextOffset, 22);
  doc.text(`Período de Referência: ${selectedMonth === 'Todos' ? 'Geral' : selectedMonth} | Gerado em ${new Date().toLocaleDateString('pt-BR')}`, headerTextOffset, 26);

  let y = 45;

  // Overview Card
  doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F');

  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`PROVISÃO DE RESULTADOS (${selectedMonth === 'Todos' ? 'TOTAL GERAL' : selectedMonth.toUpperCase()})`, 18, y + 5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('RECEITAS PREVISTAS (COMISSÕES)', 18, y + 11);
  doc.text('DESPESAS PREVISTAS (REPASSE)', 75, y + 11);
  doc.text('RESULTADO LÍQUIDO PROVISIONADO', 132, y + 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Green for revenue
  doc.text(formatarMoeda(totalRevenue), 18, y + 17);
  
  doc.setTextColor(239, 68, 68); // Red for expense
  doc.text(formatarMoeda(totalExpense), 75, y + 17);
  
  doc.setTextColor(59, 130, 246); // Blue for net
  doc.text(formatarMoeda(totalRevenue - totalExpense), 132, y + 17);

  y += 30;

  // Table Title
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DETALHAMENTO DE VENCIMENTOS E REPASSES', 14, y);
  
  y += 4;

  // Table header
  doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Vencimento', 16, y + 4.8);
  doc.text('Pedido', 44, y + 4.8);
  doc.text('Cliente', 62, y + 4.8);
  doc.text('Representada', 102, y + 4.8);
  doc.text('Parcela', 138, y + 4.8);
  doc.text('Receita (+)', 166, y + 4.8, { align: 'right' });
  doc.text('Despesa (-)', 194, y + 4.8, { align: 'right' });

  y += 7;

  installments.forEach((inst, idx) => {
    // Page break safety
    if (y > 270) {
      doc.addPage();
      y = 15;
      // Header again
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(14, y, 182, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('Vencimento', 16, y + 4.8);
      doc.text('Pedido', 44, y + 4.8);
      doc.text('Cliente', 62, y + 4.8);
      doc.text('Representada', 102, y + 4.8);
      doc.text('Parcela', 138, y + 4.8);
      doc.text('Receita (+)', 166, y + 4.8, { align: 'right' });
      doc.text('Despesa (-)', 194, y + 4.8, { align: 'right' });
      y += 7;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
      doc.rect(14, y, 182, 7, 'F');
    }

    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(14, y + 7, 196, y + 7);

    const displayPedidoNum = inst.numeroPedido.length > 13 ? inst.numeroPedido.substring(0, 11) + '..' : inst.numeroPedido;
    const displayCliente = inst.clienteNome.length > 18 ? inst.clienteNome.substring(0, 16) + '..' : inst.clienteNome;
    const displayRepresentada = inst.representadaNome.length > 16 ? inst.representadaNome.substring(0, 14) + '..' : inst.representadaNome;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(formatarData(inst.dataVencimento), 16, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.text(`#${displayPedidoNum}`, 44, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.text(displayCliente, 62, y + 4.8);
    doc.text(displayRepresentada, 102, y + 4.8);
    doc.text(`${inst.parcelaIndex}/${inst.parcelaTotal}`, 138, y + 4.8);
    
    doc.setTextColor(16, 185, 129); // Green
    doc.setFont('helvetica', 'bold');
    doc.text(formatarMoeda(inst.valorComissao), 166, y + 4.8, { align: 'right' });
    
    doc.setTextColor(239, 68, 68); // Red
    doc.text(formatarMoeda(inst.valorDespesa), 194, y + 4.8, { align: 'right' });

    y += 7;
  });

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Fluxo de Provisão Financeira - Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, 280, { align: 'center' });
  doc.text('© ' + new Date().getFullYear() + ' Desenvolvido por Raul Soares | WhatsApp: (32) 99909-8468', 105, 285, { align: 'center' });

  doc.save(`Provisionamento_Financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
}

