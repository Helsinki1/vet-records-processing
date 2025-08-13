# Veterinary Records Processing Tool

A Next.js application that uses Google's Gemini AI to process veterinary PDF records and extract structured information including vaccines, surgeries, medications, and bloodwork.

## Setup

1. **Get Google API Key**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - **Important**: Enable billing for higher rate limits (recommended for production use)

2. **Set Environment Variable**
   Create a `.env.local` file in the project root:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   ```

3. **Install Dependencies & Run**
   ```bash
   npm install
   npm run dev
   ```

4. **Open Application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Features

- **PDF Upload**: Drag and drop multiple PDF files
- **Large File Support**: Uses Gemini 1.5 Pro with 1M token context window
- **Structured Extraction**: Extracts vaccines, surgeries, medications, and bloodwork
- **FAQ Summary**: Answers common questions about recent treatments
- **Source Attribution**: Each piece of information is linked to its source document

## Usage

1. Drag and drop PDF files containing veterinary records
2. Click "Generate Summary" to process the files
3. View the extracted information organized by category

## Technical Details

- **AI Model**: Google Gemini 1.5 Pro (1M token context window)
- **File Processing**: Native PDF processing with built-in OCR
- **Large Context**: Can handle multiple large PDFs (33+ pages) in one request
- **Rate Limits**: Requires paid Google AI account for production use 