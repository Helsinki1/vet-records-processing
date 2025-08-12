"use client";

import { useState, useCallback } from "react";

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

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Summary | null>(null);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    setFiles((prev) => mergeFiles(prev, dt.files));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    if (!files || files.length === 0) {
      setError("Please select one or more PDFs");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }
      const json = (await res.json()) as Summary;
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const fileCount = files.length;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Vet Records Summarizer</h1>
          <div className="text-sm text-gray-500">Single-page prototype</div>
        </header>

        <section className="bg-gray-50 border rounded-lg p-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 bg-white text-center"
            >
              <p className="text-sm text-gray-700">Drag and drop PDFs here</p>
              <p className="text-xs text-gray-500">or</p>
              <label className="inline-block">
                <span className="sr-only">Choose PDF files</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) setFiles((prev) => mergeFiles(prev, e.target.files!));
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
                />
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
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        {data && (
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3">Frequently Asked Questions</h2>
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
                      <span className="font-medium text-gray-900">Wellness screen:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_wellness_screen_date || "Not specified"}</div>
                        {data.faqs.last_wellness_screen_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_wellness_screen_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Dental:</span>
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
                      <span className="font-medium text-gray-900">DHPP:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_dhpp_date || "Not specified"}</div>
                        {data.faqs.last_dhpp_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_dhpp_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Lepto:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_lepto_date || "Not specified"}</div>
                        {data.faqs.last_lepto_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_lepto_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Influenza:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_influenza_date || "Not specified"}</div>
                        {data.faqs.last_influenza_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_influenza_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Flea/tick prevention:</span>
                      <div className="text-right">
                        <div className="text-sm text-gray-700">{data.faqs.last_flea_tick_prevention_date || "Not specified"}</div>
                        {data.faqs.last_flea_tick_prevention_source && (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mt-1">{data.faqs.last_flea_tick_prevention_source}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-900">Lyme:</span>
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
              <h2 className="text-lg font-semibold mb-3">Vaccines</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.vaccines.map((v, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white text-sm shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900">{v.vaccine}</div>
                      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{v.source}</div>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">{v.date || "Date not specified"}</div>
                    {v.lot_or_notes && <div className="text-xs text-gray-500 italic">{v.lot_or_notes}</div>}
                  </div>
                ))}
              </div>
              {data.vaccines.length === 0 && (
                <div className="text-center py-8 text-gray-500">No vaccine records found</div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Surgeries & Procedures</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.surgeries.map((s, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white text-sm shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900">{s.procedure}</div>
                      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{s.source}</div>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">{s.date || "Date not specified"}</div>
                    {s.outcome_or_notes && <div className="text-xs text-gray-500 italic">{s.outcome_or_notes}</div>}
                  </div>
                ))}
              </div>
              {data.surgeries.length === 0 && (
                <div className="text-center py-8 text-gray-500">No surgical procedures found</div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Medications</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.medications.map((m, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white text-sm shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900">{m.drug}</div>
                      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{m.source}</div>
                    </div>
                    <div className="text-sm text-gray-700 mb-1">
                      {m.dose || "Dose not specified"} {m.frequency ? `• ${m.frequency}` : ""}
                    </div>
                    <div className="text-xs text-gray-500">
                      {m.start_date || "Start date not specified"}
                      {m.end_date ? ` → ${m.end_date}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              {data.medications.length === 0 && (
                <div className="text-center py-8 text-gray-500">No medication records found</div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Bloodwork & Lab Results</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.bloodwork.map((b, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white text-sm shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-semibold text-gray-900">{b.panel}</div>
                      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{b.source}</div>
                    </div>
                    <div className="text-sm text-gray-700 mb-2">{b.date || "Date not specified"}</div>
                    {b.highlights?.length > 0 && (
                      <ul className="text-xs text-gray-600 space-y-1">
                        {b.highlights.map((h, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-blue-500 mr-1">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(!b.highlights || b.highlights.length === 0) && (
                      <div className="text-xs text-gray-500 italic">No specific highlights noted</div>
                    )}
                  </div>
                ))}
              </div>
              {data.bloodwork.length === 0 && (
                <div className="text-center py-8 text-gray-500">No bloodwork records found</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
