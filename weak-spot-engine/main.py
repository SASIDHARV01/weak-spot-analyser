from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from worker import process_error_image, celery_app
from celery.result import AsyncResult
import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from google.genai import types

# Load environment variables
load_dotenv()

# 1. Initialize Supabase for the web server
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"), 
    os.getenv("SUPABASE_SERVICE_KEY")
)

# 2. Make sure you also have the Gemini client initialized here if it isn't already!
from google import genai
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-app-name.vercel.app"], # We will update the Vercel URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class ChatRequest(BaseModel):
    submission_id: str
    message: str

class AnalyzeRequest(BaseModel):
    user_id: str
    file_url: str

class QuizRequest(BaseModel):
    submission_id: str

@app.post("/api/analyze")
async def analyze_error(request: AnalyzeRequest):
    try:
        task = process_error_image.delay(request.file_url, request.user_id)
        return {"task_id": task.id, "status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# NEW: Endpoint for the frontend to check task progress
@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    task = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task.status,
        "result": task.result if task.status == "SUCCESS" else None
    }
@app.post("/api/chat")
async def chat_tutor(payload: ChatRequest):
    try:
        # 1. Fetch the original error context from Supabase
        res = supabase.table("error_submissions").select("*").eq("id", payload.submission_id).single().execute()
        if not res.data:
            return {"reply": "Sorry, I couldn't find the context for this specific error submission."}
            
        error_context = res.data
        
        # 2. Construct a context-aware prompt for Gemini
        system_context = f"""
        You are an expert technical tutor assisting a student with a specific coding/technical error.
        
        The student is looking at this error report:
        - Core Issue: {error_context.get('weak_spot_tag')}
        - Why it failed: {error_context.get('error_type')}
        - Immediate Fix provided: {error_context.get('immediate_fix')}
        - Prerequisite Concept: {error_context.get('prerequisites')}
        
        The student has sent this follow-up question: "{payload.message}"
        
        Answer their question directly, clearly, and concisely. If they ask about a specific part of the immediate fix or concept, explain it simply like a helpful peer. Keep it interactive and encouraging.
        """
        
        # 3. Request reply from Gemini 2.5 Flash
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_context
        )
        
        return {"reply": response.text}
        
    except Exception as e:
        print(f"--> [CHAT ERROR] Failed to process tutor query: {str(e)}")
        return {"reply": "I ran into a small issue processing that question. Can you try again?"}
    
@app.post("/api/generate-quiz")
async def generate_on_demand_quiz(payload: QuizRequest):
    try:
        # 1. Fetch the original error context
        res = supabase.table("error_submissions").select("*").eq("id", payload.submission_id).single().execute()
        if not res.data:
            return {"status": "error", "message": "Submission not found."}
            
        error_context = res.data
        user_id = error_context.get("user_id")

        # 2. Force Gemini to build a strict JSON quiz
        system_context = f"""
        You are an expert technical tutor. Based on this user's specific error, generate a 3-question multiple-choice quiz to test their understanding of the core concept and the fix.

        Error Context:
        - Issue: {error_context.get('weak_spot_tag')}
        - Fix: {error_context.get('immediate_fix')}
        - Concept: {error_context.get('prerequisites')}

        You MUST respond with ONLY a valid, raw JSON object. Do not include markdown formatting.
        Use this exact structure:
        {{
            "quiz_title": "Understanding [Core Concept]",
            "questions": [
                {{
                    "question_text": "Clear question here?",
                    "options": ["A", "B", "C", "D"],
                    "correct_option": "The exact string of the correct option",
                    "explanation": "Why this is correct."
                }}
            ]
        }}
        """

        # 3. Call Gemini
        print(f"--> Generating quiz for submission {payload.submission_id}...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_context,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        quiz_data = json.loads(response.text)

        # 4. Save to Supabase
        # Insert Master Quiz Record
        db_quiz_data = {
            "user_id": user_id,
            "error_submission_id": payload.submission_id,
            "title": quiz_data.get("quiz_title", "Targeted Practice")
        }
        quiz_res = supabase.table("quizzes").insert(db_quiz_data).execute()
        quiz_id = quiz_res.data[0]['id']

        # Insert Individual Questions
        questions = []
        for q in quiz_data.get("questions", []):
            questions.append({
                "quiz_id": quiz_id,
                "question_text": q["question_text"],
                "options": q["options"],
                "correct_option": q["correct_option"],
                "explanation": q["explanation"]
            })
        
        if questions:
            supabase.table("quiz_questions").insert(questions).execute()

        print(f"--> [SUCCESS] Quiz {quiz_id} generated and saved!")
        return {"status": "success", "quiz_id": quiz_id}

    except Exception as e:
        print(f"--> [QUIZ ERROR] Failed to generate quiz: {str(e)}")
        return {"status": "error", "message": str(e)}
if __name__ == "__main__":
    import uvicorn
    # Render provides the PORT dynamically, default to 8000 for local dev
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)