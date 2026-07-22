import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, Download, X, Eye, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CatalogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl?: string;
  pdfName?: string;
}

export default function CatalogViewerModal({
  isOpen,
  onClose,
  title,
  pdfUrl,
  pdfName = 'catalogo.pdf',
}: CatalogViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !pdfUrl) {
      setBlobUrl('');
      setIsLoading(false);
      setIsError(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    let createdUrl = '';

    try {
      if (pdfUrl.startsWith('data:')) {
        const parts = pdfUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
        const base64Data = parts[1] || parts[0];

        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mime });
        createdUrl = URL.createObjectURL(blob);
      } else {
        createdUrl = pdfUrl;
      }

      setBlobUrl(createdUrl);
      setIsLoading(false);
    } catch (err) {
      console.error('Erro ao preparar visualização do PDF:', err);
      setIsError(true);
      setIsLoading(false);
    }

    return () => {
      if (createdUrl && createdUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen || !pdfUrl) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = pdfName || 'catalogo.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    try {
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        handleDownload();
      }
    } catch (e) {
      console.warn('Erro ao abrir em nova aba:', e);
      handleDownload();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-sm md:text-base text-white flex items-center gap-2">
                  <span>Catálogo de Produtos</span>
                  <span className="text-emerald-400 font-mono text-xs font-normal">({title})</span>
                </h3>
                <p className="text-[11px] text-slate-400 truncate max-w-md">{pdfName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
                title="Baixar PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>

              <button
                type="button"
                onClick={handleOpenNewTab}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nova Aba</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer Container */}
          <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col justify-center items-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-medium">Carregando catálogo PDF...</span>
              </div>
            ) : isError ? (
              <div className="p-6 text-center max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
                <h4 className="font-serif font-bold text-slate-800 text-sm">Não foi possível carregar este PDF</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  O arquivo pode estar corrompido ou em um formato incompatível.
                </p>
              </div>
            ) : blobUrl ? (
              <>
                <object
                  data={blobUrl}
                  type="application/pdf"
                  className="w-full h-full border-0"
                >
                  <iframe
                    src={blobUrl}
                    title={`Catálogo - ${title}`}
                    className="w-full h-full border-0"
                  />
                </object>

                {/* Fallback floating bar for direct actions */}
                <div className="absolute bottom-3 right-3 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 backdrop-blur-md flex items-center gap-3">
                  <span className="text-slate-300 text-[11px]">Visualizador interativo:</span>
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="text-emerald-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir em Aba Cheia
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="text-slate-300 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
