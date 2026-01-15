"""
Advanced Features Integration
Integrates TTS providers, social listening, and AI training into the main app
"""
from flask import Blueprint, request, jsonify
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Import new modules
try:
    from tts_providers import tts_manager
    TTS_AVAILABLE = True
except ImportError as e:
    logger.warning(f"TTS providers not available: {e}")
    TTS_AVAILABLE = False

try:
    from social_listening import social_listening
    SOCIAL_LISTENING_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Social listening not available: {e}")
    SOCIAL_LISTENING_AVAILABLE = False

try:
    from ai_training import ai_trainer
    AI_TRAINING_AVAILABLE = True
except ImportError as e:
    logger.warning(f"AI training not available: {e}")
    AI_TRAINING_AVAILABLE = False

# Create blueprint
advanced_bp = Blueprint('advanced', __name__, url_prefix='/api/advanced')


# ==================== TTS PROVIDERS ====================

@advanced_bp.route('/tts/providers', methods=['GET'])
def list_tts_providers():
    """List available TTS providers and their status"""
    if not TTS_AVAILABLE:
        return jsonify({'error': 'TTS providers not available'}), 503
    
    providers_status = {}
    for name, provider in tts_manager.providers.items():
        providers_status[name] = {
            'name': name,
            'configured': provider.is_configured(),
            'description': f"{name.title()} Text-to-Speech"
        }
    
    return jsonify({
        'providers': providers_status,
        'default_provider': 'elevenlabs',
        'available': TTS_AVAILABLE
    })


@advanced_bp.route('/tts/synthesize', methods=['POST'])
def synthesize_speech():
    """Synthesize speech from text"""
    if not TTS_AVAILABLE:
        return jsonify({'error': 'TTS providers not available'}), 503
    
    data = request.json
    text = data.get('text')
    provider = data.get('provider', 'elevenlabs')
    
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    
    try:
        result = tts_manager.synthesize(
            text=text,
            provider=provider,
            voice_id=data.get('voice_id'),
            voice_name=data.get('voice_name'),
            language=data.get('language', 'en-US')
        )
        
        return jsonify({
            'success': True,
            'audio_data': result['audio_data'],
            'format': result['format'],
            'duration': result['duration'],
            'provider_used': result['provider_used']
        })
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/tts/voices/<provider>', methods=['GET'])
def get_tts_voices(provider):
    """Get available voices for a TTS provider"""
    if not TTS_AVAILABLE:
        return jsonify({'error': 'TTS providers not available'}), 503
    
    try:
        voices = tts_manager.get_available_voices(provider)
        return jsonify({
            'provider': provider,
            'voices': voices,
            'count': len(voices)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== SOCIAL LISTENING ====================

@advanced_bp.route('/social-listening/monitors', methods=['POST'])
def create_monitor():
    """Create a new social listening monitor"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    data = request.json
    monitor_id = data.get('monitor_id')
    keywords = data.get('keywords', [])
    platforms = data.get('platforms', ['twitter', 'reddit'])
    filters = data.get('filters', {})
    
    if not monitor_id or not keywords:
        return jsonify({'error': 'monitor_id and keywords are required'}), 400
    
    try:
        monitor = social_listening.create_monitor(
            monitor_id=monitor_id,
            keywords=keywords,
            platforms=platforms,
            filters=filters
        )
        
        return jsonify({
            'success': True,
            'monitor': monitor
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/social-listening/monitors/<monitor_id>/scan', methods=['GET'])
def scan_monitor(monitor_id):
    """Scan for mentions matching monitor criteria"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    limit = int(request.args.get('limit', 100))
    
    try:
        mentions = social_listening.scan_mentions(monitor_id, limit=limit)
        
        return jsonify({
            'monitor_id': monitor_id,
            'mentions': mentions,
            'count': len(mentions)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/social-listening/monitors/<monitor_id>/sentiment', methods=['GET'])
def get_sentiment_analysis(monitor_id):
    """Get sentiment analysis for a monitor"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    time_range = request.args.get('time_range', '24h')
    
    try:
        analysis = social_listening.get_sentiment_analysis(monitor_id, time_range)
        
        return jsonify({
            'success': True,
            'analysis': analysis
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/social-listening/monitors/<monitor_id>/influencers', methods=['GET'])
def identify_influencers(monitor_id):
    """Identify influencers for a monitor"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    min_followers = int(request.args.get('min_followers', 10000))
    
    try:
        influencers = social_listening.identify_influencers(monitor_id, min_followers)
        
        return jsonify({
            'monitor_id': monitor_id,
            'influencers': influencers,
            'count': len(influencers)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/social-listening/competitive-intelligence', methods=['POST'])
def get_competitive_intelligence():
    """Analyze competitor social media activity"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    data = request.json
    competitors = data.get('competitors', [])
    
    if not competitors:
        return jsonify({'error': 'competitors list is required'}), 400
    
    try:
        intelligence = social_listening.get_competitive_intelligence(competitors)
        
        return jsonify({
            'success': True,
            'competitors': intelligence
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/social-listening/alerts', methods=['GET'])
def get_alerts():
    """Get active alerts"""
    if not SOCIAL_LISTENING_AVAILABLE:
        return jsonify({'error': 'Social listening not available'}), 503
    
    severity = request.args.get('severity')
    
    try:
        alerts = social_listening.get_alerts(severity)
        
        return jsonify({
            'alerts': alerts,
            'count': len(alerts)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AI TRAINING ====================

@advanced_bp.route('/ai-training/models', methods=['GET'])
def list_trained_models():
    """List all trained models"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    try:
        models = ai_trainer.list_models()
        
        return jsonify({
            'models': models,
            'count': len(models)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/train/engagement-predictor', methods=['POST'])
def train_engagement_predictor():
    """Train engagement prediction model"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    data = request.json
    training_data = data.get('training_data', [])
    target_metric = data.get('target_metric', 'engagement')
    
    if len(training_data) < 10:
        return jsonify({'error': 'Need at least 10 training samples'}), 400
    
    try:
        results = ai_trainer.train_engagement_predictor(training_data, target_metric)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/train/content-classifier', methods=['POST'])
def train_content_classifier():
    """Train content classification model"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    data = request.json
    training_data = data.get('training_data', [])
    
    if len(training_data) < 20:
        return jsonify({'error': 'Need at least 20 training samples'}), 400
    
    try:
        results = ai_trainer.train_content_classifier(training_data)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/train/optimal-time', methods=['POST'])
def train_optimal_time():
    """Train optimal posting time model"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    data = request.json
    training_data = data.get('training_data', [])
    
    if len(training_data) < 50:
        return jsonify({'error': 'Need at least 50 training samples'}), 400
    
    try:
        results = ai_trainer.train_optimal_time_predictor(training_data)
        
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/predict/engagement', methods=['POST'])
def predict_engagement():
    """Predict engagement for content"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    data = request.json
    content = data.get('content', '')
    features = data.get('features', {})
    
    if not content:
        return jsonify({'error': 'content is required'}), 400
    
    try:
        prediction = ai_trainer.predict_engagement(content, features)
        
        return jsonify({
            'success': True,
            'predicted_engagement': prediction,
            'content_length': len(content.split())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/predict/content-performance', methods=['POST'])
def predict_content_performance():
    """Classify content performance potential"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    data = request.json
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': 'content is required'}), 400
    
    try:
        classification = ai_trainer.classify_content(content)
        
        return jsonify({
            'success': True,
            'classification': classification
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/optimal-times', methods=['GET'])
def get_optimal_times():
    """Get optimal posting times"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    is_weekday = request.args.get('is_weekday', 'true').lower() == 'true'
    
    try:
        times = ai_trainer.get_optimal_posting_time(is_weekday)
        
        return jsonify({
            'success': True,
            'is_weekday': is_weekday,
            'optimal_times': times
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@advanced_bp.route('/ai-training/history', methods=['GET'])
def get_training_history():
    """Get training history"""
    if not AI_TRAINING_AVAILABLE:
        return jsonify({'error': 'AI training not available'}), 503
    
    try:
        history = ai_trainer.get_training_history()
        
        return jsonify({
            'history': history,
            'count': len(history)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== STATUS ====================

@advanced_bp.route('/status', methods=['GET'])
def advanced_features_status():
    """Get status of all advanced features"""
    return jsonify({
        'tts_providers': {
            'available': TTS_AVAILABLE,
            'configured_count': sum(1 for p in tts_manager.providers.values() if p.is_configured()) if TTS_AVAILABLE else 0
        },
        'social_listening': {
            'available': SOCIAL_LISTENING_AVAILABLE,
            'monitors_count': len(social_listening.monitors) if SOCIAL_LISTENING_AVAILABLE else 0
        },
        'ai_training': {
            'available': AI_TRAINING_AVAILABLE,
            'models_count': len(ai_trainer.models) if AI_TRAINING_AVAILABLE else 0
        },
        'endpoints_count': 20  # Total new endpoints
    })
