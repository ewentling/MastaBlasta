import os
import requests
import logging
import time
import hashlib
import shutil
from gtts import gTTS
from media_utils import MEDIA_DIR

logger = logging.getLogger(__name__)

# Fallback free TTS via gTTS (Google Translate TTS)
# Since Gemini-TTS isn't an official publicly available discrete endpoint to call without GCP keys,
# this serves as the local generator serving similar AI voice quality.
def generate_tts(text: str, output_path: str, lang='en') -> bool:
    """Generate TTS audio from text and save to output_path."""
    try:
        # Create TTS object
        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(output_path)
        return True
    except Exception as e:
        logger.error(f"Error generating TTS: {e}")
        return False

# Hugging Face Inference API for free AI Music generation
# Uses facebook/musicgen-small as a free default model
HF_API_URL = "https://api-inference.huggingface.co/models/facebook/musicgen-small"
HF_API_TOKEN = os.getenv("HF_API_TOKEN") # Optional, but helps with ratelimits

def generate_ai_music(prompt: str, output_path: str) -> bool:
    """Generate background music from a text prompt using a free AI API with caching."""
    cache_dir = os.path.join(str(MEDIA_DIR), "ai_music_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    prompt_hash = hashlib.md5(prompt.strip().lower().encode('utf-8')).hexdigest()
    cached_file = os.path.join(cache_dir, f"{prompt_hash}.wav")
    
    if os.path.exists(cached_file):
        logger.info(f"Using cached AI music for prompt: '{prompt}'")
        shutil.copy(cached_file, output_path)
        return True
        
    headers = {}
    if HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {HF_API_TOKEN}"
    
    payload = {
        "inputs": prompt,
    }

    try:
        logger.info(f"Generating AI music for prompt: '{prompt}'")
        response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
        
        # Hugging Face inference API might return 503 if the model is loading
        if response.status_code == 503:
            # Model is loading, we wait and retry
            logger.info("Model is loading, waiting 15 seconds to retry...")
            time.sleep(15)
            response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=60)

        if response.status_code == 200:
            with open(cached_file, 'wb') as f:
                f.write(response.content)
            shutil.copy(cached_file, output_path)
            logger.info(f"AI music generated and saved to {output_path} (cached internally)")
            return True
        else:
            logger.error(f"AI Music API Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Error in generate_ai_music: {e}")
        return False
