/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================================
 * ROOT-CAUSE FIX #1: REAL CV TEXT EXTRACTION
 * ============================================================================
 * The previous implementation NEVER read the actual content of uploaded PDF/
 * DOCX files. It generated a generic, templated fake CV based only on the
 * filename (see git history of CVBulkAnalyzer.tsx's old `readFileContent`).
 * That fake text was then sent to Gemini for scoring — meaning a candidate's
 * real qualifications were completely invisible to the AI. This is the
 * primary reason well-qualified candidates could score as low as 5%: the AI
 * was correctly scoring a generic boilerplate CV against the job criteria,
 * not the real person.
 *
 * This module replaces that mock with genuine text extraction:
 *  - .pdf  -> parsed with pdfjs-dist (text layer extraction)
 *  - .docx -> parsed with mammoth (raw text extraction)
 *  - .doc  -> legacy binary format, not reliably parseable in-browser.
 *             We surface a clear warning instead of silently guessing.
 *  - .txt/.md/.csv -> read directly (unchanged, this part was already correct)
 *
 * We also detect "suspiciously short" extraction results (e.g. scanned/
 * image-only PDFs with no real text layer) and flag them with a warning so
 * the recruiter knows to paste the CV text manually instead of unknowingly
 * screening an empty/near-empty document.
 * ============================================================================
 */

// pdfjs-dist and mammoth are both loaded lazily (dynamic import) so the
// initial app bundle stays small for users who never upload a PDF/DOCX.

// Below this many characters of extracted text, we treat the result as
// unreliable (most real CVs produce several hundred to several thousand
// characters of text). This threshold is intentionally conservative and can
// be tuned as real-world usage data comes in.
const MIN_RELIABLE_TEXT_LENGTH = 120;

export interface ExtractionResult {
  text: string;
  warning?: string;
}

async function extractFromPdf(file: File): Promise<ExtractionResult> {
  const [pdfjsLib, { default: pdfWorkerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  const text = pageTexts.join("\n\n").replace(/[ \t]+/g, " ").trim();

  if (text.length < MIN_RELIABLE_TEXT_LENGTH) {
    return {
      text,
      warning:
        "Hanya sedikit atau tidak ada teks yang berhasil diekstrak dari PDF ini. Kemungkinan besar file berupa hasil scan/gambar (tanpa lapisan teks). Silakan tempel isi CV secara manual melalui mode 'Single Add' agar hasil screening akurat.",
    };
  }

  return { text };
}

async function extractFromDocx(file: File): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();

  if (text.length < MIN_RELIABLE_TEXT_LENGTH) {
    return {
      text,
      warning:
        "Hanya sedikit teks yang berhasil diekstrak dari file DOCX ini. Silakan periksa kembali isi file atau tempel teks CV secara manual.",
    };
  }

  return { text };
}

async function extractFromPlainText(file: File): Promise<ExtractionResult> {
  const text = await file.text();
  return { text: text.trim() };
}

/**
 * Extracts real text content from an uploaded CV file. This is the function
 * that MUST be called instead of fabricating placeholder content — every
 * candidate's score is only as good as the text we actually send to the AI.
 */
export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const lowerName = file.name.toLowerCase();

  if (
    file.type === "text/plain" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".csv")
  ) {
    return extractFromPlainText(file);
  }

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      return await extractFromPdf(file);
    } catch (err) {
      console.error("PDF extraction failed", file.name, err);
      return {
        text: "",
        warning: `Gagal membaca file PDF "${file.name}". File mungkin rusak, terenkripsi, atau berformat tidak standar. Silakan tempel teks CV secara manual.`,
      };
    }
  }

  if (lowerName.endsWith(".docx")) {
    try {
      return await extractFromDocx(file);
    } catch (err) {
      console.error("DOCX extraction failed", file.name, err);
      return {
        text: "",
        warning: `Gagal membaca file DOCX "${file.name}". Silakan tempel teks CV secara manual.`,
      };
    }
  }

  if (lowerName.endsWith(".doc")) {
    // Legacy binary .doc (pre-2007 Word format) cannot be reliably parsed
    // in-browser. Rather than silently faking content (the original bug),
    // we are explicit about the limitation.
    return {
      text: "",
      warning: `Format .doc lama tidak didukung untuk ekstraksi otomatis ("${file.name}"). Silakan simpan ulang sebagai .docx/.pdf, atau tempel teks CV secara manual.`,
    };
  }

  return {
    text: "",
    warning: `Format file "${file.name}" tidak dikenali/didukung. Silakan gunakan PDF, DOCX, atau TXT.`,
  };
}
