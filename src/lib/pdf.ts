import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function downloadElementAsA4Pdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toPng(element, {
    quality: 1,
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const margin = 8;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  const imgProps = pdf.getImageProperties(dataUrl);
  const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
  const renderW = imgProps.width * ratio;
  const renderH = imgProps.height * ratio;
  const offsetX = (pageWidth - renderW) / 2;
  const offsetY = margin;

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderW, renderH);
  pdf.save(filename);
}
