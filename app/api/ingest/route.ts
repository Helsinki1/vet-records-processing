import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Define the expected response structure
type Vaccine = { vaccine: string; date: string | null; lot_or_notes: string | null; source: string };
type Surgery = { procedure: string; date: string | null; outcome_or_notes: string | null; source: string };
type Medication = { drug: string; dose: string | null; frequency: string | null; start_date: string | null; end_date: string | null; source: string };
type Bloodwork = { panel: string; date: string | null; highlights: string[]; source: string };

type Summary = {
  faqs: {
    last_rabies_vaccine_date: string | null;
    last_rabies_vaccine_source: string | null;
    last_fecal_exam_date: string | null;
    last_fecal_exam_source: string | null;
    last_heartworm_exam_or_treatment_date: string | null;
    last_heartworm_exam_or_treatment_source: string | null;
    last_wellness_screen_date: string | null;
    last_wellness_screen_source: string | null;
    last_dental_date: string | null;
    last_dental_source: string | null;
    last_dhpp_date: string | null;
    last_dhpp_source: string | null;
    last_lepto_date: string | null;
    last_lepto_source: string | null;
    last_influenza_date: string | null;
    last_influenza_source: string | null;
    last_flea_tick_prevention_date: string | null;
    last_flea_tick_prevention_source: string | null;
    last_lyme_date: string | null;
    last_lyme_source: string | null;
  };
  vaccines: Vaccine[];
  surgeries: Surgery[];
  medications: Medication[];
  bloodwork: Bloodwork[];
};

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log(`Processing ${files.length} PDF files...`);

    // Calculate total file size for debugging
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Convert files to base64 for Gemini API - Gemini 1.5 Pro can handle large contexts
    const fileData = await Promise.all(
      files.map(async (file, index) => {
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        console.log(`File ${index + 1} (${file.name}): ${(base64.length / 1024).toFixed(2)} KB base64`);
        return {
          inlineData: {
            data: base64,
            mimeType: 'application/pdf'
          }
        };
      })
    );

    // Try with Gemini 1.5 Pro first (best for large contexts)
    let model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro-latest',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });

    const prompt = `Please analyze these veterinary PDF records and extract the following information in JSON format:

{
  "faqs": {
    "last_rabies_vaccine_date": "YYYY-MM-DD or null",
    "last_rabies_vaccine_source": "document name or null",
    "last_fecal_exam_date": "YYYY-MM-DD or null", 
    "last_fecal_exam_source": "document name or null",
    "last_heartworm_exam_or_treatment_date": "YYYY-MM-DD or null",
    "last_heartworm_exam_or_treatment_source": "document name or null",
    "last_wellness_screen_date": "YYYY-MM-DD or null",
    "last_wellness_screen_source": "document name or null",
    "last_dental_date": "YYYY-MM-DD or null",
    "last_dental_source": "document name or null",
    "last_dhpp_date": "YYYY-MM-DD or null",
    "last_dhpp_source": "document name or null",
    "last_lepto_date": "YYYY-MM-DD or null",
    "last_lepto_source": "document name or null",
    "last_influenza_date": "YYYY-MM-DD or null",
    "last_influenza_source": "document name or null",
    "last_flea_tick_prevention_date": "YYYY-MM-DD or null",
    "last_flea_tick_prevention_source": "document name or null",
    "last_lyme_date": "YYYY-MM-DD or null",
    "last_lyme_source": "document name or null"
  },
  "vaccines": [
    {
      "vaccine": "vaccine name",
      "date": "YYYY-MM-DD or null",
      "lot_or_notes": "lot number or notes or null",
      "source": "document name"
    }
  ],
  "surgeries": [
    {
      "procedure": "procedure name",
      "date": "YYYY-MM-DD or null",
      "outcome_or_notes": "outcome or notes or null",
      "source": "document name"
    }
  ],
  "medications": [
    {
      "drug": "medication name",
      "dose": "dosage or null",
      "frequency": "frequency or null",
      "start_date": "YYYY-MM-DD or null",
      "end_date": "YYYY-MM-DD or null",
      "source": "document name"
    }
  ],
  "bloodwork": [
    {
      "panel": "panel name",
      "date": "YYYY-MM-DD or null",
      "highlights": ["highlight1", "highlight2"],
      "source": "document name"
    }
  ]
}

Instructions:
- Use OCR to read all text from the PDF documents
- Extract ALL veterinary information including vaccines, medications, procedures, lab work
- For the "faqs" section, find the MOST RECENT date for each category across all documents
- Use "Document 1", "Document 2", etc. as the "source" identifiers
- Convert all dates to YYYY-MM-DD format (e.g., "12/15/2023" becomes "2023-12-15")
- If a date cannot be determined, use null
- Include all relevant medical information found in the documents
- Return ONLY valid JSON, no additional text or formatting
- Do not include markdown code blocks in your response

Analyzing ${files.length} PDF document(s).`;

    console.log('Attempting to generate content with Gemini 1.5 Pro...');

    let result;
    const modelFallbacks = [
      'gemini-1.5-flash',     // Start with Flash - it's fast and supports PDFs
      'gemini-1.5-pro',       // Then Pro for better quality
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest'
    ];

    let lastError;
    for (const modelName of modelFallbacks) {
      try {
        console.log(`Trying model: ${modelName}`);
        model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          }
        });
        
        result = await model.generateContent([prompt, ...fileData]);
        console.log(`Success with model: ${modelName}`);
        break;
      } catch (error: any) {
        console.error(`Model ${modelName} failed:`, error.message);
        lastError = error;
        
        // If it's not a rate limit error, don't try other models
        if (!error.message.includes('RATE_LIMIT_EXCEEDED') && !error.message.includes('429')) {
          console.log('Non-rate-limit error, stopping fallback attempts');
          break;
        }
        continue;
      }
    }

    if (!result) {
      console.error('All models failed, throwing last error');
      throw lastError;
    }

    const response = await result.response;
    const text = response.text();

    console.log('Content generated successfully');

    // Parse the JSON response
    let parsedData: Summary;
    try {
      // Clean up the response text (remove markdown formatting if present)
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', text);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: text },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Error processing files:', error);
    
    // Enhanced error handling with more specific messages
    if (error?.message) {
      if (error.message.includes('RATE_LIMIT_EXCEEDED') || error.message.includes('429')) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded', 
            details: 'You need to enable billing in Google Cloud Console. Free tier has very low limits. Go to https://console.cloud.google.com/ and set up billing.' 
          },
          { status: 429 }
        );
      } else if (error.message.includes('API_KEY_INVALID')) {
        return NextResponse.json(
          { 
            error: 'Invalid API key', 
            details: 'Please check your GOOGLE_API_KEY in .env.local' 
          },
          { status: 401 }
        );
      } else if (error.message.includes('PERMISSION_DENIED')) {
        return NextResponse.json(
          { 
            error: 'Permission denied', 
            details: 'Enable the Generative Language API in Google Cloud Console' 
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Processing failed', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 