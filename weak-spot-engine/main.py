from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from worker import process_error_image
import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai
from google.genai import types

load_dotenv()

# Initialize Clients
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Add redirect_slashes=False to prevent path conflicts
app = FastAPI(redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weak-spot-analyser-murex.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class AnalyzeRequest(BaseModel):
    user_id: str
    file_url: str

class ChatRequest(BaseModel):
    submission_id: str
    message: str

class QuizRequest(BaseModel):
    submission_id: str

@app.post("/api/analyze")
async def analyze_error(request: AnalyzeRequest):
    # Running synchronously now - no Celery/Redis needed
    result = process_error_image(request.file_url, request.user_id)
    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return result

@app.post("/api/chat")
async def chat_tutor(payload: ChatRequest):
    try:
        res = supabase.table("error_submissions").select("*").eq("id", payload.submission_id).single().execute()
        if not res.data:
            return {"reply": "Context not found."}
            
        error_context = res.data
        system_context = f"Analyze this error: {error_context.get('weak_spot_tag')}. Fix: {error_context.get('immediate_fix')}. Student asked: {payload.message}"
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_context
        )
        return {"reply": response.text}
    except Exception as e:
        return {"reply": "I ran into a small issue. Please try again."}
    
@app.post("/api/generate-quiz")
async def generate_on_demand_quiz(payload: QuizRequest):
    try:
        # 1. Fetch the original error context
        res = supabase.table("error_submissions").select("*").eq("id", payload.submission_id).single().execute()
        if not res.data:
            return {"status": "error", "message": "Submission not found."}
            
        error_context = res.data
        user_id = error_context.get("user_id")

        # 2. Force Gemini to build a strict JSON structure
        system_context = f"""
        You are an expert technical tutor. Based on this user's specific error, generate a 5-question multiple-choice quiz to test their understanding of the core concept and the fix.

        Error Context:
        - Issue: {error_context.get('weak_spot_tag')}
        - Fix: {error_context.get('immediate_fix')}
        - Concept: {error_context.get('prerequisites')}

        You MUST respond with ONLY a valid, raw JSON object matching this structure:
        {{
            "quiz_title": "Understanding {error_context.get('weak_spot_tag', 'Concept')}",
            "questions": [
                {{
                    "question_text": "Clear question here?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_option": "The exact string match of the correct option",
                    "explanation": "Why this option is correct."
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
        
        raw_data = json.loads(response.text)
        
        # Safe Object normalization structure check
        quiz_data = {}
        questions_list = []
        
        if isinstance(raw_data, list):
            # If Gemini ignored the shell object and generated just a raw list of questions
            questions_list = raw_data
            quiz_data["quiz_title"] = f"Practice: {error_context.get('weak_spot_tag', 'Targeted Review')}"
        elif isinstance(raw_data, dict):
            quiz_data = raw_data
            questions_list = raw_data.get("questions", [])
        else:
            raise ValueError("Unexpected JSON payload format received from model engine.")

        # 4. Save to Supabase
        # Insert Master Quiz Record
        db_quiz_data = {
            "user_id": user_id,
            "error_submission_id": payload.submission_id,
            "title": quiz_data.get("quiz_title", "Targeted Practice Review")
        }
        quiz_res = supabase.table("quizzes").insert(db_quiz_data).execute()
        
        if not quiz_res.data or len(quiz_res.data) == 0:
            raise Exception("Failed to record parent quiz transaction entry.")
            
        quiz_id = quiz_res.data[0]['id']

        # Clean and format Individual Questions entries
        db_questions = []
        for q in questions_list:
            if isinstance(q, dict):
                db_questions.append({
                    "quiz_id": quiz_id,
                    "question_text": q.get("question_text", "Review Question"),
                    "options": q.get("options", []),
                    "correct_option": q.get("correct_option", ""),
                    "explanation": q.get("explanation", "")
                })
        
        if db_questions:
            supabase.table("quiz_questions").insert(db_questions).execute()

        print(f"--> [SUCCESS] Quiz {quiz_id} generated and saved dynamically!")
        return {"status": "success", "quiz_id": quiz_id}

    except Exception as e:
        print(f"--> [QUIZ ERROR] Failed to generate quiz: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)