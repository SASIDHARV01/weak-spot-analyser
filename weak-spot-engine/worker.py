import os
import json
import requests
from celery import Celery
from dotenv import load_dotenv

# Latest unified Google GenAI imports
from google import genai
from google.genai import types

# Latest Supabase v2+ imports
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize Celery
# Change your Celery initialization to this:
celery_app = Celery(
    "weak_spot_worker",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

# Initialize API Clients
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"), 
    os.getenv("SUPABASE_SERVICE_KEY")
)

@celery_app.task(name="process_error_image")
def process_error_image(file_url: str, user_id: str):
    print(f"--> [CELERY] Starting multimodal analysis for user: {user_id}")
    
    try:
        # 1. Download image
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        image_response = requests.get(file_url, headers=headers, timeout=10)
        image_bytes = image_response.content
        detected_mime_type = image_response.headers.get('Content-Type', 'image/jpeg')
        
        # 2. Define prompt
        prompt = """
You are an expert senior software engineer and technical tutor. 
Analyze the provided image containing a coding error, mathematical problem, or technical bug.

You MUST respond with ONLY a valid, raw JSON object. Do not include markdown formatting like ```json.
Use this exact structure:
{
    "weak_spot_identified": "A short 3-5 word summary of the core issue",
    "explanation": "A clear, 1-2 sentence explanation of why it failed",
    "prerequisites": "The fundamental concept the user misunderstood and needs to learn (e.g., 'Python Indentation & Scope')",
    "immediate_fix": "Step-by-step instructions on exactly how to fix the code shown in the image right now.",
    "resource_links": [
        {
            "title": "StackOverflow: Resolving this specific error",
            "url": "[https://stackoverflow.com/search?q=your+specific+search+query](https://stackoverflow.com/search?q=your+specific+search+query)"
        },
        {
            "title": "Official Docs or Medium Article",
            "url": "[https://google.com/search?q=core+concept+tutorial](https://google.com/search?q=core+concept+tutorial)"
        }
    ]
}
"""

        # 3. Package and send to Gemini
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=detected_mime_type),
            prompt
        ]
        
        print("--> Sending data to Gemini 2.5 Flash...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        ai_analysis = json.loads(response.text)
        print(f"--> [SUCCESS] AI identified weak spot: {ai_analysis.get('weak_spot_identified')}")

        # 4. Save to Supabase PostgreSQL
        print("--> Pushing data to Supabase...")
        
        # Insert Error Submission
        submission_data = {
            "user_id": user_id,
            "file_url": file_url,
            "status": "completed",
            
            # Map the new AI JSON keys to your existing Supabase columns
            "weak_spot_tag": ai_analysis.get("weak_spot_identified", "Unknown Error"),
            "error_type": ai_analysis.get("explanation", "No explanation provided."),
            "remediation_plan": "Upgraded to Interactive UI", # Deprecated field
            
            # The New Phase B Columns!
            "prerequisites": ai_analysis.get("prerequisites", ""),
            "immediate_fix": ai_analysis.get("immediate_fix", ""),
            "resource_links": ai_analysis.get("resource_links", [])
        }
        
        sub_res = supabase.table("error_submissions").insert(submission_data).execute()
        submission_id = sub_res.data[0]['id']

        # NOTE: The automated Quiz insertion code has been DELETED.
        # Quizzes will now be generated dynamically in Phase D when the user requests them!

        print("--> [DATABASE SUCCESS] Analysis updated perfectly!")
        return {"status": "success", "submission_id": submission_id}

    except Exception as e:
        print(f"--> [ERROR] Processing failed: {str(e)}")
        # If it fails, log the failure to the database (optional but good practice)
        return {"status": "failed", "error": str(e)}