import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function GET() {
  try {
    console.log('Testing API key...');
    
    // Test with a simple text-only request first
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100,
      }
    });

    const result = await model.generateContent('Say "API test successful"');
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
      message: 'API key is working',
      response: text,
      modelUsed: 'gemini-pro'
    });

  } catch (error: any) {
    console.error('API test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Check console for full error details'
    }, { status: 500 });
  }
} 