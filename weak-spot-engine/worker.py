import os
import json
import requests
from dotenv import load_dotenv
from google import genai
from google.genai import types
from supabase import create_client, Client

load_dotenv()

# init clients
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"), 
    os.getenv("SUPABASE_SERVICE_KEY")
)

def process_error_image(file_url: str, user_id: str):
    print('analyzing image for user:', user_id)
    try:
        # download the image first
        headers = {'User-Agent': 'Mozilla/5.0'}
        # TODO: maybe increase timeout for larger images
        img_resp = requests.get(file_url, headers=headers, timeout=10)
        img_bytes = img_resp.content
        mime_type = img_resp.headers.get('Content-Type', 'image/jpeg')
        
        prompt = """
Analyze the coding error in this image. 
Return ONLY a valid JSON object with these exact keys:
{
    "weak_spot_identified": "...",
    "explanation": "...",
    "prerequisites": "...",
    "immediate_fix": "...",
    "resource_links": [
        {
            "title": "Clear description of the link",
            "url": "https://example.com"
        }
    ]
}
"""

        # send to gemini api
        contents = [
            types.Part.from_bytes(data=img_bytes, mime_type=mime_type),
            prompt
        ]
        
        resp = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        # parse json
        parsed = json.loads(resp.text)

        # save to db
        data = {
            "user_id": user_id,
            "file_url": file_url,
            "status": "completed",
            "weak_spot_tag": parsed.get("weak_spot_identified"),
            "error_type": parsed.get("explanation"),
            "prerequisites": parsed.get("prerequisites"),
            "immediate_fix": parsed.get("immediate_fix"),
            "resource_links": parsed.get("resource_links", [])
        }
        
        db_res = supabase.table("error_submissions").insert(data).execute()
        return {"status": "success", "submission_id": db_res.data[0]['id']}

    except Exception as e:
        print("processing error:", str(e))
        return {"status": "failed", "error": str(e)}