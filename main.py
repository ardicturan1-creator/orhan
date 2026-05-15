from flask_socketio import SocketIO
from flask import Flask, render_template, request, jsonify
import requests
import datetime
import google.generativeai as genai

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
session = requests.Session()
# =========================
# GEMINI API
# =========================
GEMINI_API_KEY = "AIzaSyBNdWZGvTuOUDiMigd91YQwifn6BSSmOBo"
genai.configure(api_key=GEMINI_API_KEY)

GEMINI_MODELS = {
    "v1": "gemini-2.5-flash",
    "v6": "gemini-2.5-flash"
}

# =========================
# OLLAMA LOCAL
# =========================
OLLAMA_URL = "http://localhost:11434/api/generate"

OLLAMA_MODELS = {
    "v1": "gemma2:2b",
    "v6": "gemma2:9b-instruct-q4_K_M"
}

USE_API = False  # False yaparsan local Ollama çalışır


@app.route('/')
def index():
    yil = datetime.datetime.now().year
    return render_template('index.html', yil=yil)


@app.route('/chat', methods=['POST'])
def chat():

    data = request.json
    user_message = data.get("message", "")
    version = data.get("version", "v1")

    system_prompt = f"""
Senin adın Orhan AI.
Yapımcı: Melih (BYMEL)

Kurallar:
- Kendini model/API olarak açıklama
- Doğal Türkçe konuş
- Kısa ve net cevap ver

Kullanıcı: {user_message}
"""

    try:

        # =========================
        # GEMINI (CLOUD MODE)
        # =========================
        if USE_API:

            model_name = GEMINI_MODELS.get(version, "gemini-2.0-flash")
            model = genai.GenerativeModel(model_name)

            response = model.generate_content(system_prompt)

            return jsonify({
                "response": response.text.strip()
            })

        # =========================
        # OLLAMA (LOCAL MODE)
        # =========================
        else:

            model_name = OLLAMA_MODELS.get(version, "gemma2:2b")

            payload = {
                "model": model_name,
                "prompt": system_prompt,
                "stream": False
            }

            r = session.post(OLLAMA_URL, json=payload, timeout=120)

            if r.status_code == 200:
                result = r.json().get("response", "Boş cevap.")
                return jsonify({
                    "response": result
                })
            else:
                return jsonify({
                    "response": "Sunucu hatası oluştu."
                })

    except Exception as e:
        return jsonify({
            "response": f"Sistem hatası: {str(e)}"
        })


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=10000,
        allow_unsafe_werkzeug=True
    )