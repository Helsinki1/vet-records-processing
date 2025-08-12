import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PdfjsTextItem = { str?: string } | Record<string, unknown>;
interface PdfjsPage {
  getTextContent(): Promise<{ items: PdfjsTextItem[] }>;
}
interface PdfjsDocument {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
  destroy(): Promise<void> | void;
}

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsMod = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdfjs = pdfjsMod as unknown as {
      getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfjsDocument> };
    };
    
    const data = new Uint8Array(arrayBuffer);
    const doc = await pdfjs.getDocument({ data }).promise;
    let text = "";
    
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        const strings = content.items
          .map((item: PdfjsTextItem) => {
            if (typeof item === "object" && item && "str" in item && typeof (item as { str?: unknown }).str === "string") {
              return (item as { str: string }).str;
            }
            return "";
          })
          .filter(Boolean);
        text += strings.join(" ") + "\n";
      } catch (pageError) {
        console.warn(`Error processing page ${pageNum}:`, pageError);
        // Continue with other pages even if one fails
      }
    }
    
    await doc.destroy();
    return text.trim();
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    const client = new OpenAI({ apiKey });

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const form = await req.formData();
    const inputs = form.getAll("files");
    const fileObjs = inputs.filter((f): f is File => f instanceof File);

    const pdfFiles = fileObjs.filter((f) => {
      const name = (f.name || "").toLowerCase();
      const type = (f.type || "").toLowerCase();
      return name.endsWith(".pdf") || type.includes("pdf");
    });

    if (pdfFiles.length === 0) {
      return NextResponse.json({ error: "No PDF files uploaded" }, { status: 400 });
    }

    const parsed = await Promise.all(
      pdfFiles.map(async (file) => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const text = await extractTextFromPdf(arrayBuffer);
          return {
            title: file.name || "attachment.pdf",
            text,
          };
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          return {
            title: file.name || "attachment.pdf",
            text: `[Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          };
        }
      })
    );

    const systemPrompt = `You are a clinical data abstractor for veterinary records. Read the provided documents and produce a concise, skimmable summary for a veterinarian.
- Extract only objective, factual items explicitly present in the text. Do not infer.
- Return dates in ISO format (YYYY-MM-DD) if present; otherwise null.
- For each item, include the title of the source PDF where it was found as "source".
- Keep strings short, suitable for thin cards.

Required sections:
1) faqs: Answers to frequently asked questions for a single patient.
2) vaccines: list of prior vaccines.
3) surgeries: list of prior surgeries/procedures.
4) medications: list of prior prescribed medications.
5) bloodwork: list of prior lab panels with notable values.
`;

    const combinedText = parsed
      .map((p, i) => `--- DOCUMENT ${i + 1}: ${p.title} ---\n${p.text}`)
      .join("\n\n");

    const responseSchema = {
      type: "object",
      properties: {
        faqs: {
          type: "object",
          properties: {
            last_rabies_vaccine_date: { type: ["string", "null"] },
            last_rabies_vaccine_source: { type: ["string", "null"] },
            last_fecal_exam_date: { type: ["string", "null"] },
            last_fecal_exam_source: { type: ["string", "null"] },
            last_heartworm_exam_or_treatment_date: { type: ["string", "null"] },
            last_heartworm_exam_or_treatment_source: { type: ["string", "null"] },
            last_wellness_screen_date: { type: ["string", "null"] },
            last_wellness_screen_source: { type: ["string", "null"] },
            last_dental_date: { type: ["string", "null"] },
            last_dental_source: { type: ["string", "null"] },
            last_dhpp_date: { type: ["string", "null"] },
            last_dhpp_source: { type: ["string", "null"] },
            last_lepto_date: { type: ["string", "null"] },
            last_lepto_source: { type: ["string", "null"] },
            last_influenza_date: { type: ["string", "null"] },
            last_influenza_source: { type: ["string", "null"] },
            last_flea_tick_prevention_date: { type: ["string", "null"] },
            last_flea_tick_prevention_source: { type: ["string", "null"] },
            last_lyme_date: { type: ["string", "null"] },
            last_lyme_source: { type: ["string", "null"] },
          },
          required: [],
          additionalProperties: false,
        },
        vaccines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              vaccine: { type: "string" },
              date: { type: ["string", "null"] },
              lot_or_notes: { type: ["string", "null"] },
              source: { type: "string" },
            },
            required: ["vaccine", "source"],
            additionalProperties: false,
          },
        },
        surgeries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              procedure: { type: "string" },
              date: { type: ["string", "null"] },
              outcome_or_notes: { type: ["string", "null"] },
              source: { type: "string" },
            },
            required: ["procedure", "source"],
            additionalProperties: false,
          },
        },
        medications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              drug: { type: "string" },
              dose: { type: ["string", "null"] },
              frequency: { type: ["string", "null"] },
              start_date: { type: ["string", "null"] },
              end_date: { type: ["string", "null"] },
              source: { type: "string" },
            },
            required: ["drug", "source"],
            additionalProperties: false,
          },
        },
        bloodwork: {
          type: "array",
          items: {
            type: "object",
            properties: {
              panel: { type: "string" },
              date: { type: ["string", "null"] },
              highlights: { type: "array", items: { type: "string" } },
              source: { type: "string" },
            },
            required: ["panel", "source"],
            additionalProperties: false,
          },
        },
      },
      required: ["faqs", "vaccines", "surgeries", "medications", "bloodwork"],
      additionalProperties: false,
    } as const;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: combinedText },
        { role: "user", content: "Return a JSON object strictly matching the provided JSON Schema. Use null when unknown." },
      ],
      response_format: { type: "json_schema", json_schema: { name: "VetSummary", schema: responseSchema, strict: false } },
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const json = JSON.parse(raw);

    return NextResponse.json(json);
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 