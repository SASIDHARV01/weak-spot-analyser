import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validate the incoming data from the extension/LMS
    if (!body.file_url) {
      return NextResponse.json(
        { error: "Missing 'file_url' in the request body." }, 
        { status: 400 }
      );
    }

    // 2. Map the data to your existing FastAPI payload structure
    // We default to your test user ID if the extension doesn't provide one yet
    const payload = {
      user_id: body.user_id || "16871a0d-d17c-48a3-a34f-caee964dc603",
      file_url: body.file_url
    };

    // 3. Forward the request to your Python engine
    const apiResponse = await fetch('http://localhost:8000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      throw new Error("FastAPI backend failed to process the request.");
    }

    const data = await apiResponse.json();

    // 4. Return success to the Chrome Extension with CORS headers!
    return NextResponse.json({ 
      success: true, 
      message: "Diagnosis task queued successfully.",
      task_id: data.task_id 
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Crucial for Chrome Extensions to bypass CORS
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    console.error("Ingestion API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}

// Next.js requires an OPTIONS handler to pre-flight CORS requests from extensions
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}