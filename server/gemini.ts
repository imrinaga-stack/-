import { GoogleGenAI, Type } from '@google/genai';
import type { Product } from '../src/types';

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export interface ProductAnalysisResult {
  suggestedName: string;
  category: string;
  description: string;
  suggestedPrice: number;
  generatedBarcode: string;
  visualNotes: string;
}

export async function analyzeProductFromAngles(params: {
  images: Array<{ label: string; dataUrl: string }>;
  hintName?: string;
  existingBarcodes: string[];
}): Promise<ProductAnalysisResult> {
  const ai = getClient();
  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

  for (const img of params.images) {
    const parsed = parseDataUrl(img.dataUrl);
    if (parsed) {
      parts.push({ text: `זווית צילום (${img.label}):` });
      parts.push({ inlineData: parsed });
    }
  }

  parts.push({
    text: `אתה עוזר חכם של חנות משפחתית ביתית וכיפית בשם "קטן ושווה".
${params.hintName ? `שם המוצר שהמנהל הזין: "${params.hintName}".` : 'המנהל לא הזין שם — זהה מה המוצר מהתמונות.'}
נתח את התמונות מ-4 הזוויות והחזר JSON בעברית בלבד:
- suggestedName: שם קצר, ברור וחמוד למוצר בעברית.
- category: בחר קטגוריה מתאימה (משחקי קופסה / משחקי קלפים / פאזלים וחשיבה / פינוקים וחטיפים / יצירה ומתנות).
- description: תיאור קצר ומושך (משפט או שניים).
- suggestedPrice: מחיר סביר והגיוני בשקלים (מספר שלם בין 10 ל-150) לחנות משפחתית בבית לפי איך שהמוצר נראה.
- generatedBarcode: ברקוד חדש בן 13 ספרות שמתחיל ב-729009 (שוני מהברקודים הקיימים: ${params.existingBarcodes.slice(0, 10).join(', ')}). זו המצאה ייעודית לחנות, לא חייב להיות הברקוד האמיתי שעל האריזה.
- visualNotes: משפט קצר שמסביר מה ראית בזוויות הצילום ולמה קבעת את המחיר הזה.`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedName: { type: Type.STRING },
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          suggestedPrice: { type: Type.NUMBER },
          generatedBarcode: { type: Type.STRING },
          visualNotes: { type: Type.STRING },
        },
        required: [
          'suggestedName',
          'category',
          'description',
          'suggestedPrice',
          'generatedBarcode',
          'visualNotes',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as ProductAnalysisResult;
  // Clean barcode to digits only if needed
  const cleanDigits = (parsed.generatedBarcode || '').replace(/\D/g, '');
  if (cleanDigits.length < 8) {
    parsed.generatedBarcode = `729009${Math.floor(1000000 + Math.random() * 8999999)}`;
  } else {
    parsed.generatedBarcode = cleanDigits.slice(0, 13);
  }
  return parsed;
}

export interface BarcodeAssistantResult {
  action: 'show' | 'generate' | 'fix';
  productId: string | null;
  productName: string;
  barcode: string;
  replyText: string;
}

export async function runBarcodeAssistant(params: {
  prompt: string;
  products: Product[];
  targetProductId?: string;
}): Promise<BarcodeAssistantResult> {
  const ai = getClient();
  const catalogSummary = params.products
    .map((p) => `ID=${p.id} | שם="${p.name}" | מחיר=${p.price} | ברקוד=${p.barcode}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `אתה עוזר הברקודים של החנות המשפחתית "קטן ושווה".
רשימת המוצרים בקטלוג:
${catalogSummary}

${params.targetProductId ? `המנהל סימן מוצר ספציפי עם ID=${params.targetProductId}.` : ''}
בקשת המנהל: "${params.prompt}"

החלט מה הפעולה הנדרשת:
- אם המנהל ביקש לראות את הברקוד של מוצר קיים -> action="show", החזר את הברקוד הקיים שלו.
- אם המנהל אמר שהברקוד לא תקין או ביקש לתקן/להחליף ברקוד -> action="fix", צור ברקוד חדש וייחודי בן 13 ספרות שמתחיל ב-729009 ולא קיים ברשימה.
- אם המנהל ביקש לבנות ברקוד חדש למוצר -> action="generate", צור ברקוד חדש וייחודי בן 13 ספרות שמתחיל ב-729009.

החזר JSON בלבד.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          productId: { type: Type.STRING },
          productName: { type: Type.STRING },
          barcode: { type: Type.STRING },
          replyText: { type: Type.STRING },
        },
        required: ['action', 'productName', 'barcode', 'replyText'],
      },
    },
  });

  const result = JSON.parse((response.text ?? '{}').trim()) as BarcodeAssistantResult;
  const digits = (result.barcode || '').replace(/\D/g, '');
  if (result.action !== 'show' && digits.length < 8) {
    result.barcode = `729009${Math.floor(1000000 + Math.random() * 8999999)}`;
  }
  return result;
}

export async function estimateCustomTagWithAI(params: {
  prompt: string;
  productName?: string;
  price?: number;
  existingBarcodes: string[];
}): Promise<{ productName: string; price: number; category: string; barcode: string }> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `המנהל של החנות המשפחתית "קטן ושווה" ביקש ליצור תג מדבקה/משחק.
הבקשה: "${params.prompt}"
${params.productName ? `שם מוצר שסופק: "${params.productName}"` : ''}
${params.price ? `מחיר שסופק: ${params.price}` : ''}

צור פרטי תג קצרים ומדויקים בעברית, קבע מחיר סביר בשקלים אם לא סופק, והמצא ברקוד בן 13 ספרות שמתחיל ב-729008 ואינו מופיע כאן: ${params.existingBarcodes.slice(0, 10).join(', ')}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          price: { type: Type.NUMBER },
          category: { type: Type.STRING },
          barcode: { type: Type.STRING },
        },
        required: ['productName', 'price', 'category', 'barcode'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    productName: string;
    price: number;
    category: string;
    barcode: string;
  };
  const digits = (parsed.barcode || '').replace(/\D/g, '');
  parsed.barcode =
    digits.length >= 8 ? digits.slice(0, 13) : `729008${Math.floor(1000000 + Math.random() * 8999999)}`;
  return parsed;
}
