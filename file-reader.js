// file-reader.js
// Extracts text AND a preview image from uploaded files.
// - PDF  → PDF.js text layer (fast, accurate) + renders page 1 to canvas for preview
// - Image → Tesseract.js OCR + uses the image itself as preview

const FileTextReader = (() => {

  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  function getPdfjsLib() {
    const lib = window['pdfjs-dist/build/pdf'];
    if (!lib) throw new Error('PDF.js not loaded');
    lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return lib;
  }

  // ── Extract text from PDF ─────────────────────────────────────
  async function extractPDFText(pdf, onProgress) {
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(`📄 Reading page ${i} of ${pdf.numPages}…`);
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText.trim();
  }

  // ── Render page 1 of PDF to a base64 image ────────────────────
  async function renderPDFPreview(pdf) {
    try {
      const page     = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });   // reasonable quality

      const canvas  = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.82);  // JPEG at 82% = good balance of size/quality
    } catch (err) {
      console.warn('Could not render PDF preview:', err);
      return null;
    }
  }

  // ── Convert image File to base64 ──────────────────────────────
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsDataURL(file);
    });
  }

  // ── OCR an image file ─────────────────────────────────────────
  async function extractImageText(file, onProgress) {
    onProgress('🔍 Reading image…');

    // Tesseract.js v5 API
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text')
          onProgress(`🔍 Reading image… ${Math.round(m.progress * 100)}%`);
      }
    });

    try {
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      return text;
    } catch (err) {
      try { await worker.terminate(); } catch {}
      throw new Error('OCR failed: ' + err.message);
    }
  }

  // ── Public: extract both text and preview from any file ───────
  // Returns: { text: string, preview: base64string|null }
  async function extract(file, onProgress = () => {}) {
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();

    const isPDF   = type === 'application/pdf' || name.endsWith('.pdf');
    const isImage = type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|bmp|heic|heif|tiff?)$/.test(name);
    // Fallback: if type is empty/unknown, try OCR anyway (iPhone files sometimes have no MIME)
    const tryOCR  = !isPDF && (isImage || !type);

    if (isPDF) {
      onProgress('📄 Loading PDF…');
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib    = getPdfjsLib();
      const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const [text, preview] = await Promise.all([
        extractPDFText(pdf, onProgress),
        renderPDFPreview(pdf),
      ]);
      onProgress('✅ PDF processed.');
      return { text, preview };

    } else if (tryOCR) {
      const [text, preview] = await Promise.all([
        extractImageText(file, onProgress),
        fileToDataURL(file),
      ]);
      onProgress('✅ Image processed.');
      return { text, preview };

    } else {
      throw new Error(`Unsupported file type: ${type || name}`);
    }
  }

  return { extract };
})();
