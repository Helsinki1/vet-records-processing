import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Define the response schema for structured output
const dateExtractionSchema = {
  type: "object",
  properties: {
    dates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { 
            type: "string",
            description: "Date in YYYY-MM-DD format"
          },
          category: { 
            type: "string",
            enum: ["vaccination", "certificate", "exam", "prescribed_medication", "preventative_treatment", "bloodwork", "surgery", "reminder"],
            description: "Category of the veterinary event"
          },
          specific_type: { 
            type: "string",
            description: "Specific type of procedure, vaccine, or treatment"
          },
          source: { 
            type: "string",
            description: "Document identifier (e.g., Document 1, Document 2)"
          },
          notes: { 
            type: "string",
            description: "Optional additional context or notes"
          }
        },
        required: ["date", "category", "specific_type", "source"]
      }
    }
  },
  required: ["dates"]
};

// Define the new date-centric response structure
type CategorizedDate = {
  date: string; // YYYY-MM-DD format
  category: 'vaccination' | 'certificate' | 'exam' | 'prescribed_medication' | 'preventative_treatment' | 'bloodwork' | 'surgery' | 'reminder' | 'other';
  specific_type: string; // e.g., "rabies", "lyme", "fecal", "DHPP/DA2P", "Bloodwork result: CBC", etc.
  source: string; // document name
  notes?: string; // any additional context
};

type ExtractedData = {
  dates: CategorizedDate[];
};

// Final processed response structure (derived from dates)
type ProcessedSummary = {
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
  all_dates: CategorizedDate[];
};

// Date extraction prompt - simplified since we're using structured output
const getDateExtractionPrompt = (fileCount: number) => {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return `You are a veterinary date extraction specialist. Your job is to find EVERY relevant date in these ${fileCount} PDF documents and categorize it accurately.

CRITICAL DATE FORMAT REQUIREMENTS:
- ONLY process dates with NUMERIC formats: MM/DD/YYYY, MM-DD-YYYY, DD/MM/YYYY, etc.
- IGNORE dates written with full month names like "December 2024", "Spring 2023", "January 15, 2023"
- IGNORE vague date references like "last month", "next year", "recently"
- If a date doesn't fit the available categories, DO NOT include it

CRITICAL CATEGORIZATION PRIORITY (follow this order):
1. FIRST: Look for certificate context - "certificate issued", "certificate expires", "cert expires" → use "certificate" category
2. SECOND: Look for reminder context - "due", "next due", "reminder", "schedule" → use "reminder" category  
3. THIRD: DATE VALIDATION - If date is after ${currentDate}, it MUST be "reminder", NEVER "vaccination"
4. FOURTH: Look for administration context - "last done", "given", "administered", "completed", "received" → use "vaccination" category
5. LAST: Consider the procedure type and date timing

CONTEXT OVERRIDES VACCINE TYPE:
- "Rabies certificate issued" = "certificate" category (NOT vaccination)
- "DHPP reminder due" = "reminder" category (NOT vaccination)  
- "Rabies vaccine given" = "vaccination" category
- The word appearing near the date (certificate, reminder, given) is MORE IMPORTANT than the vaccine name

For each NUMERIC date you find:
1. Convert to YYYY-MM-DD format
2. Apply the categorization priority rules above
3. Identify the specific type of procedure/vaccine/treatment
4. Note which document it came from

AVAILABLE CATEGORIES (if date doesn't fit these, ignore it):
- "vaccination": Past vaccine administrations (when vaccines were actually given/administered)
- "reminder": Future vaccine due dates or reminders
- "certificate": Certificate issue/expiration dates (regardless of vaccine type)
- "exam": Physical exams, wellness checks, fecal exams, heartworm tests
- "prescribed_medication": Medication start/end dates
- "preventative_treatment": Flea/tick prevention, heartworm prevention
- "bloodwork": Lab work, blood panels, urinalysis
- "surgery": Surgical procedures, dental cleanings

Use "Document 1", "Document 2", etc. as source identifiers.
Only extract dates that are clearly numeric and fit the available categories.`;
};

// Helper function to call Gemini with structured output
async function callGeminiWithSchema(model: string, prompt: string, fileData?: { inlineData: { data: string; mimeType: string } }[], schema?: object) {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.0,
    maxOutputTokens: 8192,
    topP: 0.1,
    topK: 1,
  };

  // Add response schema if provided
  if (schema) {
    generationConfig.responseSchema = schema;
    generationConfig.responseMimeType = "application/json";
  }

  const geminiModel = genAI.getGenerativeModel({ 
    model,
    generationConfig
  });

  const content = fileData ? [prompt, ...fileData] : [prompt];
  const result = await geminiModel.generateContent(content);
  const response = await result.response;
  return response.text();
}

// Helper function to parse structured JSON response
function parseGeminiResponse(text: string): ExtractedData {
  try {
    // With structured output, the response should already be valid JSON
    return JSON.parse(text) as ExtractedData;
  } catch (error) {
    console.error('JSON parsing failed with structured output:', error);
    console.error('Response text:', text);
    throw new Error(`Structured output parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to derive FAQ answers from categorized dates
function deriveFAQsFromDates(dates: CategorizedDate[]): ProcessedSummary['faqs'] {
  const faqs: ProcessedSummary['faqs'] = {
    last_rabies_vaccine_date: null,
    last_rabies_vaccine_source: null,
    last_fecal_exam_date: null,
    last_fecal_exam_source: null,
    last_heartworm_exam_or_treatment_date: null,
    last_heartworm_exam_or_treatment_source: null,
    last_wellness_screen_date: null,
    last_wellness_screen_source: null,
    last_dental_date: null,
    last_dental_source: null,
    last_dhpp_date: null,
    last_dhpp_source: null,
    last_lepto_date: null,
    last_lepto_source: null,
    last_influenza_date: null,
    last_influenza_source: null,
    last_flea_tick_prevention_date: null,
    last_flea_tick_prevention_source: null,
    last_lyme_date: null,
    last_lyme_source: null,
  };

  // Helper function to find the most recent date for a specific type
  const findMostRecent = (filterFn: (date: CategorizedDate) => boolean) => {
    const filtered = dates.filter(filterFn).sort((a, b) => b.date.localeCompare(a.date));
    return filtered.length > 0 ? filtered[0] : null;
  };

  // Rabies vaccine - ONLY vaccination category
  const rabiesVaccine = findMostRecent(d => 
    d.category === 'vaccination' && d.specific_type.toLowerCase().includes('rabies')
  );
  if (rabiesVaccine) {
    faqs.last_rabies_vaccine_date = rabiesVaccine.date;
    faqs.last_rabies_vaccine_source = rabiesVaccine.source;
  }

  // Fecal exam - ONLY exam category
  const fecalExam = findMostRecent(d => 
    d.category === 'exam' && d.specific_type.toLowerCase().includes('fecal')
  );
  if (fecalExam) {
    faqs.last_fecal_exam_date = fecalExam.date;
    faqs.last_fecal_exam_source = fecalExam.source;
  }

  // Heartworm exam or treatment - ONLY exam/preventative_treatment categories
  const heartworm = findMostRecent(d => 
    (d.category === 'exam' || d.category === 'preventative_treatment') && 
    d.specific_type.toLowerCase().includes('heartworm')
  );
  if (heartworm) {
    faqs.last_heartworm_exam_or_treatment_date = heartworm.date;
    faqs.last_heartworm_exam_or_treatment_source = heartworm.source;
  }

  // Wellness/physical exam - ONLY exam category
  const wellness = findMostRecent(d => 
    d.category === 'exam' && (
      d.specific_type.toLowerCase().includes('wellness') || 
      d.specific_type.toLowerCase().includes('physical')
    )
  );
  if (wellness) {
    faqs.last_wellness_screen_date = wellness.date;
    faqs.last_wellness_screen_source = wellness.source;
  }

  // Dental - ONLY exam/surgery categories
  const dental = findMostRecent(d => 
    (d.category === 'exam' || d.category === 'surgery') && 
    d.specific_type.toLowerCase().includes('dental')
  );
  if (dental) {
    faqs.last_dental_date = dental.date;
    faqs.last_dental_source = dental.source;
  }

  // DHPP/DA2P vaccine - ONLY vaccination category
  const dhpp = findMostRecent(d => 
    d.category === 'vaccination' && (
      d.specific_type.toLowerCase().includes('dhpp') || 
      d.specific_type.toLowerCase().includes('da2p')
    )
  );
  if (dhpp) {
    faqs.last_dhpp_date = dhpp.date;
    faqs.last_dhpp_source = dhpp.source;
  }

  // Leptospirosis vaccine - ONLY vaccination category
  const lepto = findMostRecent(d => 
    d.category === 'vaccination' && d.specific_type.toLowerCase().includes('lepto')
  );
  if (lepto) {
    faqs.last_lepto_date = lepto.date;
    faqs.last_lepto_source = lepto.source;
  }

  // Influenza vaccine - ONLY vaccination category
  const influenza = findMostRecent(d => 
    d.category === 'vaccination' && d.specific_type.toLowerCase().includes('influenza')
  );
  if (influenza) {
    faqs.last_influenza_date = influenza.date;
    faqs.last_influenza_source = influenza.source;
  }

  // Flea/tick prevention - ONLY preventative_treatment category
  const fleaTick = findMostRecent(d => 
    d.category === 'preventative_treatment' && 
    (d.specific_type.toLowerCase().includes('flea') || d.specific_type.toLowerCase().includes('tick'))
  );
  if (fleaTick) {
    faqs.last_flea_tick_prevention_date = fleaTick.date;
    faqs.last_flea_tick_prevention_source = fleaTick.source;
  }

  // Lyme vaccine - ONLY vaccination category
  const lyme = findMostRecent(d => 
    d.category === 'vaccination' && d.specific_type.toLowerCase().includes('lyme')
  );
  if (lyme) {
    faqs.last_lyme_date = lyme.date;
    faqs.last_lyme_source = lyme.source;
  }

  return faqs;
}

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

    console.log(`Processing ${files.length} PDF files for date extraction...`);

    // Calculate total file size for debugging
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    console.log(`Total file size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Convert files to base64 for Gemini API
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

    // Extract dates using Gemini
    console.log('Extracting and categorizing all dates...');
    const extractionPrompt = getDateExtractionPrompt(files.length);
    
    let extractedData: ExtractedData;
    // Try most reliable models first to minimize failures
    const models = ['gemini-1.5-pro-latest', 'gemini-1.5-pro', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
    
    let lastError;
    let extractionSuccess = false;
    
    for (const modelName of models) {
      try {
        console.log(`Trying date extraction with: ${modelName}`);
        const text = await callGeminiWithSchema(modelName, extractionPrompt, fileData, dateExtractionSchema);
        extractedData = parseGeminiResponse(text);
        
        // Validate the structure
        if (!extractedData || !extractedData.dates || !Array.isArray(extractedData.dates)) {
          throw new Error('Invalid response structure: missing dates array');
        }
        
        console.log(`Date extraction successful with: ${modelName}`);
        console.log(`Extracted ${extractedData.dates.length} dates`);
        extractionSuccess = true;
        break;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Model ${modelName} failed:`, errorMessage);
        lastError = error;
        continue;
      }
    }

    if (!extractionSuccess) {
      console.error('All models failed for date extraction');
      throw lastError;
    }

    // Process the extracted dates to derive FAQ answers
    console.log('Deriving FAQ answers from extracted dates...');
    const faqs = deriveFAQsFromDates(extractedData!.dates);
    
    const finalData: ProcessedSummary = {
      faqs,
      all_dates: extractedData!.dates
    };
    
    console.log('Processing completed successfully');
    return NextResponse.json(finalData);

  } catch (error: unknown) {
    console.error('Error processing files:', error);
    
    // Enhanced error handling with more specific messages
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage) {
      if (errorMessage.includes('RATE_LIMIT_EXCEEDED') || errorMessage.includes('429')) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded', 
            details: 'You need to enable billing in Google Cloud Console. Free tier has very low limits. Go to https://console.cloud.google.com/ and set up billing.' 
          },
          { status: 429 }
        );
      } else if (errorMessage.includes('API_KEY_INVALID')) {
        return NextResponse.json(
          { 
            error: 'Invalid API key', 
            details: 'Please check your GOOGLE_API_KEY in .env.local' 
          },
          { status: 401 }
        );
      } else if (errorMessage.includes('PERMISSION_DENIED')) {
        return NextResponse.json(
          { 
            error: 'Permission denied', 
            details: 'Enable the Generative Language API in Google Cloud Console' 
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: 'Processing failed', details: errorMessage },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 