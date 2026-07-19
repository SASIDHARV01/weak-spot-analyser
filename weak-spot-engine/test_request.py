import requests

payload = {
    "user_id": "16871a0d-d17c-48a3-a34f-caee964dc603",
    "file_url": "https://placehold.co/600x400/png?text=Math+Error:+2%2B2%3D5"
}

response = requests.post("http://localhost:8000/api/analyze", json=payload)
print("API Response:", response.json())