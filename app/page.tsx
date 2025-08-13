"use client";

import { useState, useCallback } from "react";

// New date-centric types to match the API
type CategorizedDate = {
  date: string; // YYYY-MM-DD format
  category: 'vaccination' | 'certificate' | 'exam' | 'prescribed_medication' | 'preventative_treatment' | 'bloodwork' | 'surgery' | 'other';
  specific_type: string; // e.g., "rabies", "lyme", "fecal", "DHPP/DA2P", "Bloodwork result: CBC", etc.
  source: string; // document name
  notes?: string; // any additional context
};

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
  all_dates: CategorizedDate[];
};

// Fixed function to merge files without DataTransfer issues
function mergeFiles(existing: File[], incoming: FileList): File[] {
  const existingFiles = [...existing];
  const newFiles = Array.from(incoming);
  
  // Add only new files (avoid duplicates by name and size)
  for (const newFile of newFiles) {
    const isDuplicate = existingFiles.some(
      existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size
    );
    if (!isDuplicate) {
      existingFiles.push(newFile);
    }
  }
  
  return existingFiles;
}

// Helper function to get category display name
function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'vaccination': return '💉 Vaccination';
    case 'certificate': return '📜 Certificate';
    case 'exam': return '🔍 Examination';
    case 'prescribed_medication': return '💊 Prescribed Medication';
    case 'preventative_treatment': return '🛡️ Preventative Treatment';
    case 'bloodwork': return '🩸 Bloodwork';
    case 'surgery': return '🏥 Surgery';
    case 'other': return '📋 Other';
    default: return '📋 Unknown';
  }
}

// Helper function to get category color
function getCategoryColor(category: string): string {
  switch (category) {
    case 'vaccination': return 'bg-green-50 border-green-200 text-green-800';
    case 'certificate': return 'bg-purple-50 border-purple-200 text-purple-800';
    case 'exam': return 'bg-blue-50 border-blue-200 text-blue-800';
    case 'prescribed_medication': return 'bg-orange-50 border-orange-200 text-orange-800';
    case 'preventative_treatment': return 'bg-teal-50 border-teal-200 text-teal-800';
    case 'bloodwork': return 'bg-red-50 border-red-200 text-red-800';
    case 'surgery': return 'bg-indigo-50 border-indigo-200 text-indigo-800';
    case 'other': return 'bg-gray-50 border-gray-200 text-gray-800';
    default: return 'bg-gray-50 border-gray-200 text-gray-800';
  }
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    
    // Filter for PDF files only
    const pdfFiles = Array.from(dt.files).filter(file => 
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    
    if (pdfFiles.length === 0) {
      setError("Please drop only PDF files");
      return;
    }
    
    // Create a FileList-like object from the filtered PDF files
    const fileList = {
      length: pdfFiles.length,
      item: (index: number) => pdfFiles[index] || null,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < pdfFiles.length; i++) {
          yield pdfFiles[i];
        }
      }
    } as FileList;
    
    setFiles((prev) => mergeFiles(prev, fileList));
    setError(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Set the dropEffect to show the user that dropping is allowed
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    setProcessingStatus("");
    
    if (!files || files.length === 0) {
      setError("Please select one or more PDFs");
      return;
    }
    
    setLoading(true);
    setProcessingStatus("Starting date extraction...");
    
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      
      setProcessingStatus("Extracting and categorizing dates...");
      
      const res = await fetch("/api/ingest", { 
        method: "POST", 
        body: form,
        // Add a longer timeout for the fetch request
        signal: AbortSignal.timeout(300000) // 5 minutes
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string, details?: string }));
        console.error("API Error:", err);
        throw new Error(err.error || `Request failed: ${res.status}. ${err.details || ''}`);
      }
      
      setProcessingStatus("Generating summary from dates...");
      const json = (await res.json()) as Summary;
      
      setProcessingStatus("Complete!");
      setData(json);
    } catch (err: unknown) {
      console.error("Request error:", err);
      let message = "Something went wrong";
      
      if (err instanceof Error) {
        if (err.name === 'TimeoutError') {
          message = "Processing timed out. This can happen with large PDFs. Try processing fewer pages or smaller files.";
        } else if (err.message.includes('fetch')) {
          message = `Network error: ${err.message}`;
        } else {
          message = err.message;
        }
      }
      
      setError(message);
      setProcessingStatus("");
    } finally {
      setLoading(false);
    }
  }

  const fileCount = files.length;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Vet Records Extractor</h1>
          <div className="text-sm text-gray-500">Date-focused PDF processing</div>
        </header>

        <section className="bg-gray-50 border rounded-lg p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 text-center transition-all duration-200 ${
                isDragOver 
                  ? 'border-blue-500 bg-blue-50 border-solid' 
                  : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            >
              {isDragOver ? (
                <>
                  <div className="text-blue-600 text-lg">📁</div>
                  <p className="text-sm text-blue-700 font-medium">Drop PDF files here</p>
                </>
              ) : (
                <>
                  <div className="text-gray-400 text-lg">📄</div>
                  <p className="text-sm text-gray-700">Drag and drop PDF files here</p>
                  <p className="text-xs text-gray-500">or click to browse</p>
                </>
              )}
              <label className="inline-block cursor-pointer">
                <span className="sr-only">Choose PDF files</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) setFiles((prev) => mergeFiles(prev, e.target.files!));
                  }}
                  className="hidden"
                />
                {!isDragOver && (
                  <span className="inline-flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 text-xs font-medium transition-colors">
                    Browse Files
                  </span>
                )}
              </label>
              {fileCount > 0 && (
                <div className="text-xs text-gray-600 mt-2 max-w-full">
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-medium">Selected {fileCount} file(s):</div>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-red-500 hover:text-red-700 text-xs underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {files.slice(0, 5).map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center text-left bg-gray-50 px-2 py-1 rounded">
                        <span className="truncate flex-1 mr-2">{file.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs whitespace-nowrap">
                            {(file.size / 1024).toFixed(1)}KB
                          </span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="Remove file"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {fileCount > 5 && (
                      <div className="text-gray-500 text-center">... and {fileCount - 5} more files</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Processing..." : "Generate Summary"}
              </button>
            </div>
          </form>
          
          {loading && processingStatus && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span className="text-sm text-blue-700">{processingStatus}</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </section>

        {data && (
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3">Quick Reference (FAQ)</h2>
              <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last rabies vaccine:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_rabies_vaccine_date || "Not specified"}</div>
                        {data.faqs.last_rabies_vaccine_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_rabies_vaccine_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last fecal exam:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_fecal_exam_date || "Not specified"}</div>
                        {data.faqs.last_fecal_exam_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_fecal_exam_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last heartworm exam/treatment:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_heartworm_exam_or_treatment_date || "Not specified"}</div>
                        {data.faqs.last_heartworm_exam_or_treatment_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_heartworm_exam_or_treatment_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last wellness / physical:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_wellness_screen_date || "Not specified"}</div>
                        {data.faqs.last_wellness_screen_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_wellness_screen_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last dental exam:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_dental_date || "Not specified"}</div>
                        {data.faqs.last_dental_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_dental_source}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last DHPP/DA2P vaccine:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_dhpp_date || "Not specified"}</div>
                        {data.faqs.last_dhpp_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_dhpp_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last leptospirosis vaccine:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_lepto_date || "Not specified"}</div>
                        {data.faqs.last_lepto_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_lepto_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last influenza vaccine:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_influenza_date || "Not specified"}</div>
                        {data.faqs.last_influenza_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_influenza_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last flea/tick prevention:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_flea_tick_prevention_date || "Not specified"}</div>
                        {data.faqs.last_flea_tick_prevention_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_flea_tick_prevention_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Last lyme disease vaccine:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_lyme_date || "Not specified"}</div>
                        {data.faqs.last_lyme_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_lyme_source}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">All Extracted Dates ({data.all_dates.length} total)</h2>
              <div className="space-y-4">
                {/* Group dates by category */}
                {['vaccination', 'exam', 'preventative_treatment', 'bloodwork', 'surgery', 'prescribed_medication', 'certificate', 'other'].map(category => {
                  const categoryDates = data.all_dates
                    .filter(d => d.category === category)
                    .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
                  
                  if (categoryDates.length === 0) return null;
                  
                  return (
                    <div key={category} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                      <div className={`px-4 py-3 border-b border-gray-200 ${getCategoryColor(category)} rounded-t-lg`}>
                        <h3 className="font-medium">{getCategoryDisplayName(category)} ({categoryDates.length})</h3>
                      </div>
                      <div className="p-4">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categoryDates.map((dateItem, idx) => (
                            <div key={idx} className="border border-gray-100 rounded p-3 bg-gray-50">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-gray-900 capitalize">{dateItem.specific_type}</div>
                                <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded">{dateItem.source}</div>
                              </div>
                              <div className="text-sm text-gray-700 font-mono">{dateItem.date}</div>
                              {dateItem.notes && (
                                <div className="text-xs text-gray-600 mt-1 italic">{dateItem.notes}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {data.all_dates.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No dates found in the documents</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
