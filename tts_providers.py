"""
Real TTS (Text-to-Speech) Provider Integrations
Supports ElevenLabs, Azure TTS, Google Cloud TTS, and Amazon Polly
"""
import os
import logging
import requests
import base64
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Provider API Keys
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY', '')
AZURE_SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY', '')
AZURE_SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION', 'eastus')
GOOGLE_CLOUD_API_KEY = os.getenv('GOOGLE_CLOUD_API_KEY', '')
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')


class TTSProviderManager:
    """Manages Text-to-Speech providers with fallback support"""
    
    def __init__(self):
        self.providers = {
            'elevenlabs': ElevenLabsTTS(),
            'azure': AzureTTS(),
            'google': GoogleCloudTTS(),
            'polly': AmazonPollyTTS()
        }
        self._check_availability()
    
    def _check_availability(self):
        """Check which providers are properly configured"""
        for name, provider in self.providers.items():
            if provider.is_configured():
                logger.info(f"✓ TTS Provider '{name}' is configured and ready")
            else:
                logger.warning(f"⚠ TTS Provider '{name}' is not configured (missing API keys)")
    
    def get_provider(self, provider_name: str):
        """Get a specific TTS provider"""
        return self.providers.get(provider_name.lower())
    
    def synthesize(self, text: str, provider: str = 'elevenlabs', **kwargs) -> Dict[str, Any]:
        """
        Synthesize speech with automatic fallback
        
        Args:
            text: Text to synthesize
            provider: Preferred provider (elevenlabs, azure, google, polly)
            **kwargs: Provider-specific options (voice_id, language, etc.)
        
        Returns:
            Dict with audio_data (base64), format, duration, provider_used
        """
        # Try preferred provider first
        provider_obj = self.get_provider(provider)
        if provider_obj and provider_obj.is_configured():
            try:
                result = provider_obj.synthesize(text, **kwargs)
                result['provider_used'] = provider
                logger.info(f"TTS synthesis successful with {provider}")
                return result
            except Exception as e:
                logger.warning(f"TTS synthesis failed with {provider}: {e}")
        
        # Try fallback providers
        for fallback_name, fallback_provider in self.providers.items():
            if fallback_name != provider and fallback_provider.is_configured():
                try:
                    result = fallback_provider.synthesize(text, **kwargs)
                    result['provider_used'] = fallback_name
                    logger.info(f"TTS synthesis successful with fallback provider {fallback_name}")
                    return result
                except Exception as e:
                    logger.warning(f"Fallback TTS synthesis failed with {fallback_name}: {e}")
        
        # All providers failed
        raise Exception("All TTS providers failed or are not configured")
    
    def get_available_voices(self, provider: str) -> List[Dict[str, Any]]:
        """Get list of available voices for a provider"""
        provider_obj = self.get_provider(provider)
        if provider_obj and provider_obj.is_configured():
            return provider_obj.get_voices()
        return []


class ElevenLabsTTS:
    """ElevenLabs Text-to-Speech Integration"""
    
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.base_url = "https://api.elevenlabs.io/v1"
    
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    def synthesize(self, text: str, voice_id: str = 'EXAVITQu4vr4xnSDxMaL', 
                   model_id: str = 'eleven_multilingual_v2', **kwargs) -> Dict[str, Any]:
        """
        Synthesize speech with ElevenLabs
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID (default: Rachel)
            model_id: Model to use
        """
        if not self.is_configured():
            raise Exception("ElevenLabs API key not configured")
        
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        data = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": kwargs.get('stability', 0.5),
                "similarity_boost": kwargs.get('similarity_boost', 0.75)
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        
        audio_data = base64.b64encode(response.content).decode('utf-8')
        
        return {
            'audio_data': audio_data,
            'format': 'mp3',
            'duration': self._estimate_duration(text),
            'voice_id': voice_id,
            'model_id': model_id
        }
    
    def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices"""
        if not self.is_configured():
            return []
        
        url = f"{self.base_url}/voices"
        headers = {"xi-api-key": self.api_key}
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get('voices', [])
        except Exception as e:
            logger.error(f"Failed to fetch ElevenLabs voices: {e}")
            return []
    
    def _estimate_duration(self, text: str, wpm: int = 150) -> float:
        """Estimate audio duration in seconds"""
        words = len(text.split())
        return (words / wpm) * 60


class AzureTTS:
    """Azure Cognitive Services Text-to-Speech Integration"""
    
    def __init__(self):
        self.speech_key = AZURE_SPEECH_KEY
        self.region = AZURE_SPEECH_REGION
    
    def is_configured(self) -> bool:
        return bool(self.speech_key and self.region)
    
    def synthesize(self, text: str, voice_name: str = 'en-US-AriaNeural', 
                   language: str = 'en-US', **kwargs) -> Dict[str, Any]:
        """
        Synthesize speech with Azure TTS
        
        Args:
            text: Text to synthesize
            voice_name: Voice name (e.g., en-US-AriaNeural)
            language: Language code
        """
        if not self.is_configured():
            raise Exception("Azure Speech key/region not configured")
        
        # Get access token
        token_url = f"https://{self.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
        token_headers = {"Ocp-Apim-Subscription-Key": self.speech_key}
        token_response = requests.post(token_url, headers=token_headers)
        token_response.raise_for_status()
        access_token = token_response.text
        
        # Synthesize speech
        url = f"https://{self.region}.tts.speech.microsoft.com/cognitiveservices/v1"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3"
        }
        
        ssml = f"""
        <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{language}'>
            <voice name='{voice_name}'>
                {text}
            </voice>
        </speak>
        """
        
        response = requests.post(url, headers=headers, data=ssml.encode('utf-8'))
        response.raise_for_status()
        
        audio_data = base64.b64encode(response.content).decode('utf-8')
        
        return {
            'audio_data': audio_data,
            'format': 'mp3',
            'duration': self._estimate_duration(text),
            'voice_name': voice_name,
            'language': language
        }
    
    def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices"""
        if not self.is_configured():
            return []
        
        # Return common voices (full list available via API)
        return [
            {'name': 'en-US-AriaNeural', 'language': 'en-US', 'gender': 'Female'},
            {'name': 'en-US-GuyNeural', 'language': 'en-US', 'gender': 'Male'},
            {'name': 'en-GB-SoniaNeural', 'language': 'en-GB', 'gender': 'Female'},
            {'name': 'en-GB-RyanNeural', 'language': 'en-GB', 'gender': 'Male'},
            {'name': 'es-ES-ElviraNeural', 'language': 'es-ES', 'gender': 'Female'},
            {'name': 'fr-FR-DeniseNeural', 'language': 'fr-FR', 'gender': 'Female'},
        ]
    
    def _estimate_duration(self, text: str, wpm: int = 150) -> float:
        """Estimate audio duration in seconds"""
        words = len(text.split())
        return (words / wpm) * 60


class GoogleCloudTTS:
    """Google Cloud Text-to-Speech Integration"""
    
    def __init__(self):
        self.api_key = GOOGLE_CLOUD_API_KEY
    
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    def synthesize(self, text: str, voice_name: str = 'en-US-Wavenet-D', 
                   language_code: str = 'en-US', **kwargs) -> Dict[str, Any]:
        """
        Synthesize speech with Google Cloud TTS
        
        Args:
            text: Text to synthesize
            voice_name: Voice name (e.g., en-US-Wavenet-D)
            language_code: Language code
        """
        if not self.is_configured():
            raise Exception("Google Cloud API key not configured")
        
        url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        data = {
            "input": {"text": text},
            "voice": {
                "languageCode": language_code,
                "name": voice_name
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "pitch": kwargs.get('pitch', 0),
                "speakingRate": kwargs.get('speaking_rate', 1.0)
            }
        }
        
        response = requests.post(url, json=data, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        audio_data = result['audioContent']
        
        return {
            'audio_data': audio_data,
            'format': 'mp3',
            'duration': self._estimate_duration(text),
            'voice_name': voice_name,
            'language_code': language_code
        }
    
    def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices"""
        if not self.is_configured():
            return []
        
        # Return common WaveNet voices (full list available via API)
        return [
            {'name': 'en-US-Wavenet-D', 'language': 'en-US', 'gender': 'Male'},
            {'name': 'en-US-Wavenet-F', 'language': 'en-US', 'gender': 'Female'},
            {'name': 'en-GB-Wavenet-A', 'language': 'en-GB', 'gender': 'Female'},
            {'name': 'en-GB-Wavenet-B', 'language': 'en-GB', 'gender': 'Male'},
        ]
    
    def _estimate_duration(self, text: str, wpm: int = 150) -> float:
        """Estimate audio duration in seconds"""
        words = len(text.split())
        return (words / wpm) * 60


class AmazonPollyTTS:
    """Amazon Polly Text-to-Speech Integration"""
    
    def __init__(self):
        self.access_key = AWS_ACCESS_KEY_ID
        self.secret_key = AWS_SECRET_ACCESS_KEY
        self.region = AWS_REGION
    
    def is_configured(self) -> bool:
        return bool(self.access_key and self.secret_key)
    
    def synthesize(self, text: str, voice_id: str = 'Joanna', 
                   engine: str = 'neural', **kwargs) -> Dict[str, Any]:
        """
        Synthesize speech with Amazon Polly
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID (e.g., Joanna, Matthew)
            engine: Engine type (neural or standard)
        """
        if not self.is_configured():
            raise Exception("AWS credentials not configured")
        
        try:
            import boto3
            
            polly_client = boto3.client(
                'polly',
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region
            )
            
            response = polly_client.synthesize_speech(
                Text=text,
                OutputFormat='mp3',
                VoiceId=voice_id,
                Engine=engine
            )
            
            audio_stream = response['AudioStream'].read()
            audio_data = base64.b64encode(audio_stream).decode('utf-8')
            
            return {
                'audio_data': audio_data,
                'format': 'mp3',
                'duration': self._estimate_duration(text),
                'voice_id': voice_id,
                'engine': engine
            }
        except ImportError:
            raise Exception("boto3 not installed. Install with: pip install boto3")
        except Exception as e:
            raise Exception(f"Amazon Polly synthesis failed: {e}")
    
    def get_voices(self) -> List[Dict[str, Any]]:
        """Get available voices"""
        if not self.is_configured():
            return []
        
        # Return common neural voices
        return [
            {'id': 'Joanna', 'language': 'en-US', 'gender': 'Female'},
            {'id': 'Matthew', 'language': 'en-US', 'gender': 'Male'},
            {'id': 'Amy', 'language': 'en-GB', 'gender': 'Female'},
            {'id': 'Brian', 'language': 'en-GB', 'gender': 'Male'},
        ]
    
    def _estimate_duration(self, text: str, wpm: int = 150) -> float:
        """Estimate audio duration in seconds"""
        words = len(text.split())
        return (words / wpm) * 60


# Global TTS manager instance
tts_manager = TTSProviderManager()
