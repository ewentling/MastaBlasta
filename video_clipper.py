"""
Video Clipping Service with Gemini AI Integration
Analyzes videos and extracts viral clips using Google's Gemini AI
"""
import os
import logging
import json
import re
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

try:
    import google.generativeai as genai
    GEMINI_ENABLED = True
except ImportError:
    GEMINI_ENABLED = False
    logger.warning("Google Generative AI not installed. Video clipping features will be disabled.")

try:
    import yt_dlp
    YT_DLP_ENABLED = True
except ImportError:
    YT_DLP_ENABLED = False
    logger.warning("yt-dlp not installed. Video download features will be limited.")


class VideoClipperService:
    """Service for analyzing videos and generating viral clips using Gemini AI"""

    def __init__(self):
        self.enabled = GEMINI_ENABLED and YT_DLP_ENABLED
        if GEMINI_ENABLED:
            api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-pro')
                logger.info("✓ Gemini AI video clipper initialized")
            else:
                self.enabled = False
                logger.warning("⚠ GEMINI_API_KEY or GOOGLE_API_KEY not set. Video clipping features disabled.")

    def is_enabled(self) -> bool:
        """Check if video clipper service is enabled"""
        return self.enabled

    def get_video_info(self, video_url: str) -> Dict[str, Any]:
        """
        Extract video information from URL

        Args:
            video_url: URL of the video (YouTube, Vimeo, etc.)

        Returns:
            Dictionary with video metadata
        """
        if not YT_DLP_ENABLED:
            return {
                'success': False,
                'error': 'yt-dlp not installed. Cannot extract video info.'
            }

        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)

                return {
                    'success': True,
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'description': info.get('description', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': info.get('view_count', 0),
                    'like_count': info.get('like_count', 0),
                    'upload_date': info.get('upload_date', ''),
                    'url': video_url,
                    'subtitles': self._extract_subtitles(info),
                }
        except Exception as e:
            logger.error(f"Error extracting video info: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _extract_subtitles(self, info: Dict) -> str:
        """Extract subtitles/captions from video info"""
        try:
            # Try to get automatic captions or subtitles
            subtitles = info.get('subtitles', {})
            auto_captions = info.get('automatic_captions', {})

            # Prefer English subtitles
            for lang in ['en', 'en-US', 'en-GB']:
                if lang in subtitles:
                    return f"Subtitles available in {lang}"
                if lang in auto_captions:
                    return f"Auto-captions available in {lang}"

            return "No subtitles available"
        except Exception as e:
            logger.error(f"Error extracting subtitles: {str(e)}")
            return "Error extracting subtitles"

    def analyze_video(self, video_url: str, num_clips: int = 3) -> Dict[str, Any]:
        """
        Analyze video content and identify viral clip opportunities

        Args:
            video_url: URL of the video to analyze
            num_clips: Number of clips to generate (default: 3)

        Returns:
            Dictionary with analysis results and clip suggestions
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'Video clipper service not enabled. Check API keys and dependencies.'
            }

        try:
            # Get video information
            video_info = self.get_video_info(video_url)
            if not video_info.get('success'):
                return video_info

            # Analyze video content with Gemini
            prompt = self._create_analysis_prompt(video_info, num_clips)

            response = self.model.generate_content(prompt)
            analysis = response.text

            # Parse the analysis results
            clips = self._parse_clip_suggestions(analysis, video_info)

            return {
                'success': True,
                'video_info': {
                    'title': video_info['title'],
                    'duration': video_info['duration'],
                    'url': video_url,
                    'thumbnail': video_info['thumbnail'],
                },
                'analysis': analysis,
                'suggested_clips': clips,
                'num_clips': len(clips),
            }

        except Exception as e:
            logger.error(f"Error analyzing video: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _create_analysis_prompt(self, video_info: Dict, num_clips: int) -> str:
        """Create prompt for Gemini to analyze video and suggest clips"""
        duration_minutes = video_info['duration'] // 60
        duration_seconds = video_info['duration'] % 60

        prompt = f"""Analyze this video and identify the {num_clips} best moments for viral social media clips:

Video Title: {video_info['title']}
Duration: {duration_minutes}m {duration_seconds}s
Description: {video_info['description'][:500]}
Uploader: {video_info['uploader']}
Views: {video_info.get('view_count', 0):,}

Your task:
1. Identify {num_clips} segments that have the highest viral potential
2. For each clip, provide:
   - Start time (in seconds)
   - End time (in seconds)
   - Clip duration (15-90 seconds recommended)
   - Why this moment is viral-worthy
   - Suggested title/hook
   - Target platforms (TikTok, Instagram Reels, YouTube Shorts)
   - Engagement score (0-100)

Focus on moments that:
- Have emotional impact (funny, surprising, inspiring, controversial)
- Contain quotable moments or soundbites
- Show transformations or before/after
- Have strong hooks in first 3 seconds
- Tell a complete mini-story
- Are platform-optimized (vertical friendly, under 90s)

Format your response as JSON with this structure:
{{
  "clips": [
    {{
      "start_time": 45,
      "end_time": 75,
      "duration": 30,
      "title": "Amazing transformation in 30 seconds",
      "hook": "You won't believe what happens next...",
      "viral_reason": "Strong emotional payoff with clear before/after",
      "platforms": ["tiktok", "instagram", "youtube_shorts"],
      "engagement_score": 85,
      "tags": ["transformation", "satisfying", "viral"]
    }}
  ]
}}

Provide ONLY the JSON response, no additional text."""

        return prompt

    def _parse_clip_suggestions(self, analysis: str, video_info: Dict) -> List[Dict[str, Any]]:
        """Parse Gemini's analysis into structured clip suggestions"""
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', analysis, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                clips = data.get('clips', [])

                # Add video metadata to each clip
                for clip in clips:
                    clip['video_title'] = video_info['title']
                    clip['video_url'] = video_info['url']
                    clip['thumbnail'] = video_info['thumbnail']

                    # Format timestamps
                    clip['start_timestamp'] = self._format_timestamp(clip['start_time'])
                    clip['end_timestamp'] = self._format_timestamp(clip['end_time'])

                return clips

            # Fallback: try to parse manually if JSON extraction fails
            return self._manual_parse_clips(analysis, video_info)

        except Exception as e:
            logger.error(f"Error parsing clip suggestions: {str(e)}")
            return []

    def _manual_parse_clips(self, analysis: str, video_info: Dict) -> List[Dict[str, Any]]:
        """Manually parse clip information if JSON parsing fails"""
        clips = []

        # Simple pattern matching for clip information
        lines = analysis.split('\n')
        current_clip = {}

        for line in lines:
            line = line.strip()

            # Look for time patterns
            time_match = re.search(r'(\d+):(\d+)\s*-\s*(\d+):(\d+)', line)
            if time_match:
                start_min, start_sec, end_min, end_sec = map(int, time_match.groups())
                current_clip['start_time'] = start_min * 60 + start_sec
                current_clip['end_time'] = end_min * 60 + end_sec
                current_clip['duration'] = current_clip['end_time'] - current_clip['start_time']

            # Look for engagement scores
            score_match = re.search(r'score[:\s]+(\d+)', line, re.IGNORECASE)
            if score_match:
                current_clip['engagement_score'] = int(score_match.group(1))

            # If we have enough info, add clip
            if 'start_time' in current_clip and 'end_time' in current_clip:
                if 'title' not in current_clip:
                    current_clip['title'] = f"Clip {len(clips) + 1}"
                if 'engagement_score' not in current_clip:
                    current_clip['engagement_score'] = 70

                current_clip['video_title'] = video_info['title']
                current_clip['video_url'] = video_info['url']
                current_clip['thumbnail'] = video_info['thumbnail']
                current_clip['platforms'] = ['tiktok', 'instagram', 'youtube_shorts']

                clips.append(current_clip)
                current_clip = {}

        return clips

    def _format_timestamp(self, seconds: int) -> str:
        """Format seconds to MM:SS or HH:MM:SS"""
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60

        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return f"{minutes:02d}:{secs:02d}"

    def generate_clip_metadata(self, clip: Dict[str, Any], platform: str = 'instagram') -> Dict[str, Any]:
        """
        Generate optimized metadata for a clip based on platform

        Args:
            clip: Clip data dictionary
            platform: Target platform (instagram, tiktok, youtube_shorts, etc.)

        Returns:
            Dictionary with optimized metadata
        """
        if not self.enabled:
            return {
                'success': False,
                'error': 'Video clipper service not enabled'
            }

        try:
            prompt = f"""Generate optimized social media metadata for this video clip:

Title: {clip.get('title', 'Untitled')}
Hook: {clip.get('hook', '')}
Duration: {clip.get('duration', 30)} seconds
Viral Reason: {clip.get('viral_reason', '')}
Platform: {platform}

Generate:
1. Optimized caption (150-200 characters) with emojis
2. 10-15 relevant hashtags (mix of trending and niche)
3. Thumbnail text overlay suggestion
4. Best posting time (based on platform and content type)
5. Call-to-action
6. Engagement tips

Format as JSON:
{{
  "caption": "...",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "thumbnail_text": "...",
  "best_time": "7-9 PM",
  "cta": "...",
  "tips": ["tip1", "tip2"]
}}

Provide ONLY the JSON response."""

            response = self.model.generate_content(prompt)
            result = response.text

            # Parse JSON response
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                metadata = json.loads(json_match.group())
                metadata['success'] = True
                metadata['platform'] = platform
                return metadata

            return {
                'success': False,
                'error': 'Failed to parse metadata response'
            }

        except Exception as e:
            logger.error(f"Error generating clip metadata: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def get_clip_download_info(self, video_url: str, start_time: int, end_time: int) -> Dict[str, Any]:
        """
        Get download instructions for a specific clip segment

        Args:
            video_url: Original video URL
            start_time: Clip start time in seconds
            end_time: Clip end time in seconds

        Returns:
            Dictionary with download information and ffmpeg command
        """
        try:
            duration = end_time - start_time

            # Generate ffmpeg command for clip extraction
            ffmpeg_command = f"""ffmpeg -ss {start_time} -i "{video_url}" -t {duration} \\
  -c:v libx264 -c:a aac -b:v 3000k -b:a 192k \\
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \\
  -movflags +faststart output_clip.mp4"""

            return {
                'success': True,
                'video_url': video_url,
                'start_time': start_time,
                'end_time': end_time,
                'duration': duration,
                'start_timestamp': self._format_timestamp(start_time),
                'end_timestamp': self._format_timestamp(end_time),
                'ffmpeg_command': ffmpeg_command,
                'instructions': [
                    '1. Install ffmpeg if not already installed',
                    '2. Run the ffmpeg command below',
                    '3. The clip will be saved as output_clip.mp4',
                    '4. Upload to your preferred platform'
                ]
            }
        except Exception as e:
            logger.error(f"Error generating download info: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Global instance
video_clipper = VideoClipperService()
