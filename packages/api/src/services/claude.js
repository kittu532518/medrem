import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-opus-4-5';

function imageToBase64(imagePath) {
  const buf = fs.readFileSync(imagePath);
  const ext = imagePath.toLowerCase();
  let mediaType;
  if (ext.endsWith('.png'))       mediaType = 'image/png';
  else if (ext.endsWith('.webp')) mediaType = 'image/webp';
  else if (ext.endsWith('.gif'))  mediaType = 'image/gif';
  else                            mediaType = 'image/jpeg'; // default for jpg/jpeg/heic/etc.
  return { base64: buf.toString('base64'), mediaType };
}

/**
 * Validate a dose photo using Claude vision.
 * If referencePhotoPath is supplied, Claude also checks that the
 * person in today's photo is the same as in the reference selfie.
 */
export async function validateDosePhoto(imagePath, expectedMedicines, languageHint = 'en', referencePhotoPath = null) {
  try {
    const { base64: doseB64, mediaType: doseMime } = imageToBase64(imagePath);
    const expectedMedStr = expectedMedicines.length
      ? expectedMedicines.map(m => `- ${m.name} (${m.dosage || 'any dosage'})`).join('\n')
      : '(no specific medicines listed — any medicine is acceptable)';

    const content = [];

    if (referencePhotoPath && fs.existsSync(referencePhotoPath)) {
      const { base64: refB64, mediaType: refMime } = imageToBase64(referencePhotoPath);
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: refMime, data: refB64 },
      });
      content.push({
        type: 'text',
        text: "IMAGE 1: This is the patient's registered reference selfie.",
      });
    }

    content.push({
      type: 'image',
      source: { type: 'base64', media_type: doseMime, data: doseB64 },
    });

    const faceMatchInstruction = referencePhotoPath && fs.existsSync(referencePhotoPath)
      ? '- face_matched: true if the face in this dose photo appears to be the SAME person as in the reference selfie (IMAGE 1). If no reference was provided, set true whenever a face is visible.'
      : '- face_matched: true if a human face is clearly visible in the photo (no reference photo to compare against)';

    content.push({
      type: 'text',
      text: `IMAGE ${referencePhotoPath ? '2' : '1'}: This is today's dose verification photo submitted by the patient.

Language preference: ${languageHint}
Expected medicines for this session:
${expectedMedStr}

Analyze the dose photo and respond with ONLY a JSON object (no markdown, no explanation):
{
  "face_detected": boolean,
  "face_matched": boolean,
  "medicine_detected": boolean,
  "medicine_name_matched": boolean,
  "confidence": number between 0 and 1,
  "reason": "concise explanation of any failures, or 'All checks passed'"
}

Rules:
- face_detected: true if a human face is clearly visible in the dose photo
${faceMatchInstruction}
- medicine_detected: true if any medicine (tablet, capsule, blister pack, bottle, etc.) is visible
- medicine_name_matched: true if detected medicine matches one of the expected medicines (be lenient with brand vs generic names)
- confidence: overall confidence 0.0–1.0
- A dose is VALID only if face_detected AND medicine_detected are both true${referencePhotoPath ? ' AND face_matched is true' : ''}`,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content }],
    });

    const text = response.content[0].text.trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(jsonStr);

    const passed = result.face_detected && result.medicine_detected &&
      (referencePhotoPath ? result.face_matched !== false : true);

    return {
      face_detected: Boolean(result.face_detected),
      face_matched: result.face_matched !== undefined ? Boolean(result.face_matched) : null,
      medicine_detected: Boolean(result.medicine_detected),
      medicine_name_matched: Boolean(result.medicine_name_matched),
      confidence: Number(result.confidence) || 0,
      reason: result.reason || 'No reason provided',
      passed,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('[Claude] JSON parse error in dose validation:', err.message);
      return { face_detected: false, face_matched: null, medicine_detected: false, medicine_name_matched: false, confidence: 0, reason: 'AI returned an unexpected response. Please try again.', passed: false, error: 'parse_error' };
    }
    console.error('[Claude] API error in dose validation:', err.message, '| status:', err.status);
    return { face_detected: false, face_matched: null, medicine_detected: false, medicine_name_matched: false, confidence: 0, reason: `AI validation failed: ${err.message || 'service unavailable'}. Check your ANTHROPIC_API_KEY in .env.`, passed: false, error: 'api_error' };
  }
}

/**
 * Extract medicines from a prescription image using Claude OCR.
 * Optimised for handwritten Indian doctor prescriptions.
 */
export async function extractPrescriptionMedicines(imagePath, languageHint = 'en') {
  try {
    const { base64, mediaType } = imageToBase64(imagePath);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are a medical prescription OCR specialist for India. Your task is to extract ALL prescribed medicines from this prescription image.

CONTEXT — INDIAN PRESCRIPTION FORMAT:
- Prescriptions are often handwritten by Indian doctors in English or Telugu/Hindi mixed with English medical terms
- Many prescriptions use a table with columns: Morning | Afternoon | Night  (or M | A/N | N)
- Some use numeric notation: 1-0-1 means take in morning (1) and night (1), skip afternoon (0)
- Medicine names often start with: Tab / T. (tablet), Cap / C. (capsule), Syr / Syp (syrup), Susp (suspension), Inj (injection), Drop, Oint/Cream
- Indian brand names (e.g., Dolo, Combiflam, Pan-D, Augmentin, Metformin, Florafill, PCO 360, Bovoline, Meftal, Pantocid, Chymomax, Duvadilan, Ornof, Diclomol) are common
- Dosage strength is often in mg, ml, mcg or IU
- Duration: "x 5", "x 15", "x 30" or "5 days", "1 month", "1 year" etc.

WHAT TO EXTRACT (medicines only):
- Look for numbered lists (1., 2., 3.) — each number is typically one medicine
- Look for lines starting with Tab/Cap/Syr/Inj etc.
- Ticks or numbers in Morning/Afternoon/Night columns tell you the session schedule

WHAT TO IGNORE (clinical data — do NOT include):
- Patient name, age, address, S/o W/o D/o
- Doctor name, hospital name, registration number
- Diagnosis / chief complaint (c/o, h/o)
- Vital signs: BP, Pulse, SpO2, weight, height
- Examination findings: P/A soft, P/S/V, BV, Cx etc.
- Referrals, lab tests, follow-up instructions
- Salt restriction, lifestyle advice

FREQUENCY → SESSION MAPPING:
- OD / once daily / 1-0-0 / once a day          → sessions: ["morning"]
- BD / BID / twice daily / 1-0-1                 → sessions: ["morning", "evening"]
- TDS / TID / three times / 1-1-1               → sessions: ["morning", "afternoon", "evening"]
- QID / four times daily / 1-1-1-1              → sessions: ["morning", "afternoon", "evening", "night"]
- HS / at bedtime / nocte / night / 0-0-1        → sessions: ["night"]
- Morning only / AM only                         → sessions: ["morning"]
- Afternoon / Midday only                        → sessions: ["afternoon"]
- SOS / as needed / PRN                          → sessions: ["morning"], needs_review: true
- Column table: use the columns that have a tick/number/text entry

Language hint: ${languageHint}

Respond ONLY with this JSON object — no markdown fences, no explanation, just raw JSON:
{
  "medicines": [
    {
      "name": "exact medicine name as written (keep brand name)",
      "dosage": "strength e.g. 500mg, or null",
      "form": "tablet/capsule/syrup/suspension/drops/cream/injection/other",
      "quantity": "total count e.g. x15, 15 tablets — or null",
      "frequency": "raw frequency text exactly as written",
      "special_instructions": "after food / empty stomach / vaginal / before sleep / mixed with water — or null",
      "sessions": ["morning"],
      "duration": "e.g. 15 days / 1 month / 1 year — or null",
      "needs_review": false,
      "confidence": 0.9
    }
  ],
  "overall_confidence": 0.85,
  "notes": "any clarifying note e.g. handwriting unclear on item 2 — or null"
}

RULES:
- sessions array must only contain values from: morning, afternoon, evening, night
- Set needs_review: true when confidence < 0.7 OR frequency is ambiguous OR medicine name is uncertain
- Extract EVERY medicine you can identify — even uncertain ones (set needs_review: true + lower confidence)
- Do NOT merge medicines — each numbered item or line is a separate medicine entry
- If handwriting is partially illegible, make your best guess and set needs_review: true
- Return empty medicines array [] ONLY if truly no medicines are visible anywhere in the image
- Typed/printed prescriptions should yield high confidence; handwritten may be lower — that is expected`,
          },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(jsonStr);

    const medicines = (result.medicines || []).map(m => ({
      name:                 m.name || 'Unknown Medicine',
      dosage:               m.dosage || null,
      form:                 m.form || null,
      quantity:             m.quantity || null,
      frequency:            m.frequency || null,
      special_instructions: m.special_instructions || null,
      sessions:             Array.isArray(m.sessions)
        ? m.sessions.filter(s => ['morning', 'afternoon', 'evening', 'night'].includes(s))
        : ['morning'],
      duration:             m.duration || null,
      needs_review:         Boolean(m.needs_review) || (m.confidence || 1) < 0.7,
      confidence:           m.confidence || result.overall_confidence || 0.8,
    }));

    return {
      medicines,
      overall_confidence: result.overall_confidence || 0.8,
      notes: result.notes || null,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('[Claude] JSON parse error in prescription OCR:', err.message);
      return { medicines: [], overall_confidence: 0, notes: 'OCR returned unexpected response.', error: 'parse_error' };
    }
    console.error('[Claude] API error in prescription OCR:', err.message, '| status:', err.status);
    return { medicines: [], overall_confidence: 0, notes: `OCR failed: ${err.message || 'service unavailable'}`, error: 'api_error' };
  }
}
