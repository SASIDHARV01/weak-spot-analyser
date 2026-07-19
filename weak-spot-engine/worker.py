import os
import json
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client, Client

load_dotenv()

# Initialize API Clients
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"), 
    os.getenv("SUPABASE_SERVICE_KEY")
)

def process_error_image(file_url: str, user_id: str):
    print(f"--> [BACKEND] Starting analysis for user: {user_id}")
    try:
        # 1. Download image
        headers = {'User-Agent': 'Mozilla/5.0'}
        image_response = requests.get(file_url, headers=headers, timeout=10)
        image_bytes = image_response.content
        detected_mime_type = image_response.headers.get('Content-Type', 'image/jpeg')
        
        # 2. Prompt
        prompt = "Analyze the coding error in this image. Return ONLY raw JSON (no markdown) with keys: weak_spot_identified, explanation, prerequisites, immediate_fix, resource_links."

        # 3. Send to Gemini
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=detected_mime_type),
            prompt
        ]
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        ai_analysis = json.loads(response.text)

        # 4. Save to Supabase
        submission_data = {
            "user_id": user_id,
            "file_url": file_url,
            "status": "completed",
            "weak_spot_tag": ai_analysis.get("weak_spot_identified"),
            "error_type": ai_analysis.get("explanation"),
            "prerequisites": ai_analysis.get("prerequisites"),
            "immediate_fix": ai_analysis.get("immediate_fix"),
            "resource_links": ai_analysis.get("resource_links", [])
        }
        
        sub_res = supabase.table("error_submissions").insert(submission_data).execute()
        return {"status": "success", "submission_id": sub_res.data[0]['id']}

    except Exception as e:
        print(f"--> [ERROR] Processing failed: {str(e)}")
        return {"status": "failed", "error": str(e)}