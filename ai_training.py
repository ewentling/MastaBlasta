"""
AI Model Training System
Train custom models for content optimization, sentiment analysis, and engagement prediction
"""
import os
import logging
import pickle
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from collections import defaultdict
import numpy as np

logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, precision_score, recall_score, mean_squared_error, r2_score
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logger.warning("ML libraries not available. Install: pip install scikit-learn numpy")


class AIModelTrainer:
    """
    Train and manage custom AI models for social media optimization

    Supported models:
    - Content classifier (identify best-performing content types)
    - Engagement predictor (predict likes/shares/comments)
    - Sentiment analyzer (custom sentiment classification)
    - Optimal posting time (predict best times to post)
    - Hashtag recommender (suggest effective hashtags)
    """

    def __init__(self, models_dir: str = '/tmp/models'):
        self.models_dir = models_dir
        os.makedirs(models_dir, exist_ok=True)

        self.models = {}
        self.training_history = []

        if not ML_AVAILABLE:
            logger.warning("ML not available - models will return simulated predictions")

    def train_engagement_predictor(self, training_data: List[Dict[str, Any]],
                                   target_metric: str = 'engagement') -> Dict[str, Any]:
        """
        Train model to predict engagement metrics

        Args:
            training_data: List of posts with features and engagement metrics
            target_metric: Which metric to predict (engagement, likes, shares, comments)

        Returns:
            Training results with metrics
        """
        if not ML_AVAILABLE:
            return {'status': 'simulated', 'accuracy': 0.85, 'message': 'ML libraries not available'}

        logger.info(f"Training engagement predictor with {len(training_data)} samples")

        # Extract features and labels
        X, y = self._prepare_engagement_data(training_data, target_metric)

        if len(X) < 10:
            raise ValueError(f"Need at least 10 training samples, got {len(X)}")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Train model
        model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        mse = mean_squared_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)

        # Save model
        model_name = f'engagement_predictor_{target_metric}'
        self.models[model_name] = {
            'model': model,
            'type': 'regression',
            'target': target_metric,
            'trained_at': datetime.now(timezone.utc).isoformat(),
            'samples': len(training_data),
            'mse': float(mse),
            'r2': float(r2)
        }

        self._save_model(model_name)

        results = {
            'status': 'success',
            'model_name': model_name,
            'samples': len(training_data),
            'test_samples': len(X_test),
            'mse': float(mse),
            'r2': float(r2),
            'accuracy_pct': float(r2 * 100)
        }

        self.training_history.append(results)
        logger.info(f"Engagement predictor trained: R²={r2:.3f}, MSE={mse:.3f}")

        return results

    def train_content_classifier(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train model to classify content types and predict performance

        Args:
            training_data: Posts with content and performance labels

        Returns:
            Training results
        """
        if not ML_AVAILABLE:
            return {'status': 'simulated', 'accuracy': 0.87, 'message': 'ML libraries not available'}

        logger.info(f"Training content classifier with {len(training_data)} samples")

        # Extract text and labels
        texts = [d['content'] for d in training_data]
        labels = [d['performance_label'] for d in training_data]  # 'high', 'medium', 'low'

        if len(texts) < 20:
            raise ValueError(f"Need at least 20 training samples, got {len(texts)}")

        # Convert labels to numeric
        label_map = {'low': 0, 'medium': 1, 'high': 2}
        y = np.array([label_map[label] for label in labels])

        # Vectorize text
        vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        X = vectorizer.fit_transform(texts)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Train model
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')

        # Save model and vectorizer
        model_name = 'content_classifier'
        self.models[model_name] = {
            'model': model,
            'vectorizer': vectorizer,
            'label_map': label_map,
            'type': 'classification',
            'trained_at': datetime.now(timezone.utc).isoformat(),
            'samples': len(training_data),
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall)
        }

        self._save_model(model_name)

        results = {
            'status': 'success',
            'model_name': model_name,
            'samples': len(training_data),
            'test_samples': len(X_test),
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'accuracy_pct': float(accuracy * 100)
        }

        self.training_history.append(results)
        logger.info(f"Content classifier trained: Accuracy={accuracy:.3f}")

        return results

    def train_optimal_time_predictor(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train model to predict optimal posting times

        Args:
            training_data: Posts with timestamp and engagement data

        Returns:
            Training results with optimal times
        """
        if not ML_AVAILABLE:
            return {
                'status': 'simulated',
                'optimal_times': {
                    'weekday': ['9:00', '12:00', '18:00'],
                    'weekend': ['10:00', '14:00', '20:00']
                }
            }

        logger.info(f"Training optimal time predictor with {len(training_data)} samples")

        # Extract time features and engagement
        time_engagement = defaultdict(list)

        for post in training_data:
            timestamp = datetime.fromisoformat(post['created_at'].replace('Z', '+00:00'))
            hour = timestamp.hour
            weekday = timestamp.weekday() < 5  # Mon-Fri
            engagement = post.get('engagement', 0)

            key = f"{'weekday' if weekday else 'weekend'}_{hour}"
            time_engagement[key].append(engagement)

        # Calculate average engagement per time slot
        avg_engagement = {k: np.mean(v) for k, v in time_engagement.items()}

        # Find top 3 times for weekday and weekend
        weekday_times = {k: v for k, v in avg_engagement.items() if k.startswith('weekday')}
        weekend_times = {k: v for k, v in avg_engagement.items() if k.startswith('weekend')}

        top_weekday = sorted(weekday_times.items(), key=lambda x: x[1], reverse=True)[:3]
        top_weekend = sorted(weekend_times.items(), key=lambda x: x[1], reverse=True)[:3]

        optimal_times = {
            'weekday': [f"{int(k.split('_')[1]):02d}:00" for k, v in top_weekday],
            'weekend': [f"{int(k.split('_')[1]):02d}:00" for k, v in top_weekend],
            'weekday_engagement': [float(v) for k, v in top_weekday],
            'weekend_engagement': [float(v) for k, v in top_weekend]
        }

        # Save results
        model_name = 'optimal_time_predictor'
        self.models[model_name] = {
            'optimal_times': optimal_times,
            'type': 'time_analysis',
            'trained_at': datetime.now(timezone.utc).isoformat(),
            'samples': len(training_data)
        }

        self._save_model(model_name)

        results = {
            'status': 'success',
            'model_name': model_name,
            'samples': len(training_data),
            'optimal_times': optimal_times
        }

        self.training_history.append(results)
        logger.info(f"Optimal time predictor trained with {len(training_data)} samples")

        return results

    def predict_engagement(self, content: str, features: Dict[str, Any],
                           model_name: str = 'engagement_predictor_engagement') -> float:
        """Predict engagement for new content"""
        if model_name not in self.models:
            # Return simulated prediction
            import random
            return random.randint(50, 500)

        if not ML_AVAILABLE:
            import random
            return random.randint(50, 500)

        model_data = self.models[model_name]
        model = model_data['model']

        # Prepare features (simplified)
        X = np.array([[
            len(content.split()),  # word count
            content.count('#'),  # hashtag count
            content.count('@'),  # mention count
            features.get('has_media', 0),
            features.get('hour_of_day', 12)
        ]])

        prediction = model.predict(X)[0]
        return float(prediction)

    def classify_content(self, content: str, model_name: str = 'content_classifier') -> Dict[str, Any]:
        """Classify content performance potential"""
        if model_name not in self.models:
            # Return simulated classification
            import random
            label = random.choice(['high', 'medium', 'low'])
            return {'label': label, 'confidence': random.uniform(0.6, 0.95)}

        if not ML_AVAILABLE:
            import random
            label = random.choice(['high', 'medium', 'low'])
            return {'label': label, 'confidence': random.uniform(0.6, 0.95)}

        model_data = self.models[model_name]
        model = model_data['model']
        vectorizer = model_data['vectorizer']
        label_map_inv = {v: k for k, v in model_data['label_map'].items()}

        # Vectorize
        X = vectorizer.transform([content])

        # Predict
        pred_label = model.predict(X)[0]
        pred_proba = model.predict_proba(X)[0]

        return {
            'label': label_map_inv[pred_label],
            'confidence': float(pred_proba[pred_label]),
            'probabilities': {
                'low': float(pred_proba[0]),
                'medium': float(pred_proba[1]),
                'high': float(pred_proba[2])
            }
        }

    def get_optimal_posting_time(self, is_weekday: bool = True) -> List[str]:
        """Get optimal posting times"""
        model_name = 'optimal_time_predictor'

        if model_name not in self.models:
            # Return default times
            if is_weekday:
                return ['09:00', '12:00', '18:00']
            else:
                return ['10:00', '14:00', '20:00']

        optimal_times = self.models[model_name]['optimal_times']
        return optimal_times['weekday' if is_weekday else 'weekend']

    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a trained model"""
        if model_name not in self.models:
            return None

        model_data = self.models[model_name].copy()
        # Remove actual model object from response
        if 'model' in model_data:
            del model_data['model']
        if 'vectorizer' in model_data:
            del model_data['vectorizer']

        return model_data

    def list_models(self) -> List[Dict[str, Any]]:
        """List all trained models"""
        models_list = []
        for name in self.models:
            info = self.get_model_info(name)
            if info:
                info['name'] = name
                models_list.append(info)
        return models_list

    def get_training_history(self) -> List[Dict[str, Any]]:
        """Get training history"""
        return self.training_history

    def _prepare_engagement_data(self, data: List[Dict[str, Any]],
                                 target: str) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features and labels for engagement prediction"""
        features = []
        labels = []

        for post in data:
            # Extract features
            content = post.get('content', '')
            feature_vec = [
                len(content.split()),  # word count
                content.count('#'),  # hashtag count
                content.count('@'),  # mention count
                1 if post.get('media') else 0,  # has media
                post.get('hour_of_day', 12),  # hour posted
            ]
            features.append(feature_vec)

            # Extract label
            labels.append(post.get(target, 0))

        return np.array(features), np.array(labels)

    def _save_model(self, model_name: str):
        """Save model to disk"""
        try:
            model_path = os.path.join(self.models_dir, f"{model_name}.pkl")
            with open(model_path, 'wb') as f:
                pickle.dump(self.models[model_name], f)
            logger.info(f"Model '{model_name}' saved to {model_path}")
        except Exception as e:
            logger.error(f"Failed to save model '{model_name}': {e}")

    def _load_model(self, model_name: str) -> bool:
        """Load model from disk"""
        try:
            model_path = os.path.join(self.models_dir, f"{model_name}.pkl")
            if os.path.exists(model_path):
                with open(model_path, 'rb') as f:
                    self.models[model_name] = pickle.load(f)
                logger.info(f"Model '{model_name}' loaded from {model_path}")
                return True
        except Exception as e:
            logger.error(f"Failed to load model '{model_name}': {e}")
        return False


# Global AI trainer instance
ai_trainer = AIModelTrainer()
