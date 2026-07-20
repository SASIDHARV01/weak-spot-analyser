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

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(redirect_slashes=False)

# allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://weak-spot-analyser-murex.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeReq(BaseModel):
    user_id: str
    file_url: str

class ChatReq(BaseModel):
    submission_id: str
    message: str

class QuizReq(BaseModel):
    submission_id: str

@app.post("/api/analyze")
async def analyze_error(req: AnalyzeReq):
    res = process_error_image(req.file_url, req.user_id)
    if res.get("status") == "failed":
        raise HTTPException(status_code=500, detail=res.get("error", "unknown error"))
    return res

@app.post("/api/chat")
async def chat_tutor(req: ChatReq):
    try:
        # fetch context from db
        db_res = supabase.table("error_submissions").select("*").eq("id", req.submission_id).single().execute()
        if not db_res.data:
            return {"reply": "Context not found."}
            
        ctx = db_res.data
        prompt = f"Analyze this error: {ctx.get('weak_spot_tag')}. Fix: {ctx.get('immediate_fix')}. Student asked: {req.message}"
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return {"reply": response.text}
    except Exception as e:
        print("chat error:", str(e))
        return {"reply": "I ran into a small issue. Please try again."}
    
@app.post("/api/generate-quiz")
async def generate_on_demand_quiz(req: QuizReq):
    try:
        # get original context
        db_res = supabase.table("error_submissions").select("*").eq("id", req.submission_id).single().execute()
        if not db_res.data:
            return {"status": "error", "message": "Submission not found"}
            
        ctx = db_res.data
        uid = ctx.get("user_id")

        prompt = f"""
You are an expert tutor. Create a 5-question multiple-choice quiz based on this error to test understanding.

Error Context:
- Issue: {ctx.get('weak_spot_tag')}
- Fix: {ctx.get('immediate_fix')}
- Concept: {ctx.get('prerequisites')}

Return ONLY valid JSON matching this structure:
{{
    "quiz_title": "Understanding {ctx.get('weak_spot_tag', 'Concept')}",
    "questions": [
        {{
            "question_text": "question here?",
            "options": ["A", "B", "C", "D"],
            "correct_option": "exact string match",
            "explanation": "why it is correct"
        }}
    ]
}}
"""

        print(f"generating quiz for {req.submission_id}")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        parsed = json.loads(response.text)
        
        # normalize data if model gets creative
        q_data = {}
        q_list = []
        
        if isinstance(parsed, list):
            q_list = parsed
            q_data["quiz_title"] = f"Practice: {ctx.get('weak_spot_tag', 'Review')}"
        elif isinstance(parsed, dict):
            q_data = parsed
            q_list = parsed.get("questions", [])
        else:
            raise ValueError("bad json format from model")

        # insert parent record
        master_quiz = {
            "user_id": uid,
            "error_submission_id": req.submission_id,
            "title": q_data.get("quiz_title", "Practice Quiz")
        }
        quiz_res = supabase.table("quizzes").insert(master_quiz).execute()
        
        if not quiz_res.data:
            raise Exception("couldnt save quiz")
            
        qid = quiz_res.data[0]['id']

        # insert questions
        rows = []
        for q in q_list:
            if isinstance(q, dict):
                rows.append({
                    "quiz_id": qid,
                    "question_text": q.get("question_text", "Review Question"),
                    "options": q.get("options", []),
                    "correct_option": q.get("correct_option", ""),
                    "explanation": q.get("explanation", "")
                })
        
        if rows:
            supabase.table("quiz_questions").insert(rows).execute()

        print("quiz generated:", qid)
        return {"status": "success", "quiz_id": qid}

    except Exception as e:
        print("quiz err:", str(e))
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)