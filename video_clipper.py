"""
Video Clipping Service – "Gemini Clipper" Pipeline
====================================================
Four-step pipeline:
  1. Ingestion   – yt-dlp downloads the full video (anti-bot options).
  2. Transcription – Faster-Whisper runs locally to produce a timestamped
                    transcript (.json with start/end/text per segment).
  3. Analysis    – Gemini 1.5 Flash reads the transcript and returns
                    the N most viral moments with precise timestamps.
  4. Extraction  – ffmpeg clips each moment (stream-copy by default for
                    lossless speed; re-encode optional for frame accuracy).

Storage discipline: the source video is deleted immediately after the clips
are extracted so temporary disk usage is bounded.
"""

import os
import logging
import json
import re
import random
import shutil
import subprocess
import tempfile
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Optional dependency guards
# ──────────────────────────────────────────────────────────────

try:
    import google.generativeai as genai
    GEMINI_ENABLED = True
except ImportError:
    GEMINI_ENABLED = False
    logger.warning("google-generativeai not installed. AI clip analysis disabled.")

try:
    import yt_dlp
    YT_DLP_ENABLED = True
except ImportError:
    YT_DLP_ENABLED = False
    logger.warning("yt-dlp not installed. Video download disabled.")

try:
    from faster_whisper import WhisperModel
    WHISPER_ENABLED = True
except ImportError:
    WHISPER_ENABLED = False
    logger.warning(
        "faster-whisper not installed. Local transcription disabled. "
        "Install with: pip install faster-whisper"
    )


class VideoClipperService:
    """
    Gemini Clipper – full pipeline for identifying and extracting viral clips.
    """

    # Minimum video length before clip analysis makes sense
    MIN_VIDEO_DURATION = 60  # seconds

    # Gemini model – 2.0-flash has a 1M-token context window, ideal for long transcripts
    GEMINI_MODEL = "gemini-2.0-flash"

    # Whisper model size: "base" is fast / low-RAM; switch to "medium" for higher accuracy
    WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")

    def __init__(self):
        self.gemini_enabled = GEMINI_ENABLED
        self.whisper_enabled = WHISPER_ENABLED
        self.ytdlp_enabled = YT_DLP_ENABLED

        # Initialise Gemini
        if GEMINI_ENABLED:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel(self.GEMINI_MODEL)
                logger.info("✓ Gemini %s video clipper initialised", self.GEMINI_MODEL)
            else:
                self.gemini_enabled = False
                logger.warning("GEMINI_API_KEY / GOOGLE_API_KEY not set. AI analysis disabled.")
        else:
            self.model = None

        # Initialise Whisper (lazy – only loads the model on first transcription call)
        self._whisper_model = None

    def is_enabled(self) -> bool:
        """Return True if at minimum yt-dlp is available (transcription/AI are optional)."""
        return self.ytdlp_enabled

    def _load_whisper(self):
        """Lazy-load the Faster-Whisper model to avoid startup delay."""
        if self._whisper_model is None and WHISPER_ENABLED:
            logger.info("Loading Faster-Whisper model '%s'…", self.WHISPER_MODEL_SIZE)
            # Use CPU unless CUDA is explicitly available
            device = "cuda" if os.getenv("WHISPER_DEVICE", "cpu") == "cuda" else "cpu"
            self._whisper_model = WhisperModel(
                self.WHISPER_MODEL_SIZE,
                device=device,
                compute_type="int8",  # memory-efficient on CPU
            )
            logger.info("✓ Faster-Whisper loaded (%s / %s)", self.WHISPER_MODEL_SIZE, device)
        return self._whisper_model

    # ──────────────────────────────────────────────────────────────
    # Step 1 – Ingestion
    # ──────────────────────────────────────────────────────────────

    def _build_ytdlp_opts(self, output_template: str) -> Dict:
        """
        Build yt-dlp options with anti-bot measures.

        Priority format: best mp4 video + m4a audio merged; fallback to best mp4;
        final fallback to best available.  This matches the recommended invocation
        from the architecture guide.
        """
        opts: Dict[str, Any] = {
            # Best quality merged mp4
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": output_template,
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 60,
            "retries": 5,
            # Mimic a real Chrome browser to reduce bot detection
            "http_headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
            # Use Android + web player clients (more permissive than web-only)
            "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
            "nocheckcertificate": False,
            # Post-processing: ensure ffmpeg merges streams
            "postprocessors": [
                {"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}
            ],
        }

        # If a cookies file is specified in the environment, use it for YouTube sessions
        cookies_file = os.getenv("YTDLP_COOKIES_FILE")
        if cookies_file and os.path.exists(cookies_file):
            opts["cookiefile"] = cookies_file
            logger.debug("Using cookies file: %s", cookies_file)

        return opts

    def _download_video(self, video_url: str, temp_dir: str) -> Dict[str, Any]:
        """
        Step 1: Download the full video to *temp_dir*.

        Returns a dict with keys: success, file_path, info (yt-dlp metadata).
        """
        if not YT_DLP_ENABLED:
            return {"success": False, "error": "yt-dlp not installed."}

        output_template = os.path.join(temp_dir, "source_video.%(ext)s")
        opts = self._build_ytdlp_opts(output_template)

        logger.info("Downloading video: %s", video_url)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                downloaded_path = ydl.prepare_filename(info)

                # yt-dlp sometimes changes the extension after merging
                if not os.path.exists(downloaded_path):
                    for ext in ("mp4", "mkv", "webm"):
                        candidate = os.path.join(temp_dir, f"source_video.{ext}")
                        if os.path.exists(candidate):
                            downloaded_path = candidate
                            break

                if not os.path.exists(downloaded_path):
                    return {
                        "success": False,
                        "error": "Download succeeded but output file not found.",
                    }

                logger.info("Downloaded: %s (%d bytes)", downloaded_path, os.path.getsize(downloaded_path))
                return {"success": True, "file_path": downloaded_path, "info": info}

        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            logger.error("yt-dlp error: %s", msg)
            if "bot" in msg.lower() or "429" in msg or "403" in msg:
                return {
                    "success": False,
                    "error": (
                        "Bot detection or rate-limit triggered. "
                        "Try again in a few minutes. "
                        "Set YTDLP_COOKIES_FILE env var to a browser cookies export for better results."
                    ),
                }
            if "unavailable" in msg.lower() or "private" in msg.lower():
                return {"success": False, "error": "Video is unavailable or private."}
            return {"success": False, "error": f"Download failed: {msg}"}
        except Exception as exc:
            logger.error("Unexpected download error: %s", exc, exc_info=True)
            return {"success": False, "error": f"Download error: {exc}"}

    def get_video_info(self, video_url: str) -> Dict[str, Any]:
        """
        Extract video metadata without downloading the full file.
        """
        if not YT_DLP_ENABLED:
            return {"success": False, "error": "yt-dlp not installed."}
        if not video_url or not video_url.strip():
            return {"success": False, "error": "video_url is required."}
        if not (video_url.startswith("http://") or video_url.startswith("https://")):
            return {"success": False, "error": "Invalid URL (must start with http:// or https://)."}

        opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "socket_timeout": 30,
            "retries": 3,
            "http_headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            },
            "extractor_args": {"youtube": {"player_client": ["android", "web"]}},
        }
        cookies_file = os.getenv("YTDLP_COOKIES_FILE")
        if cookies_file and os.path.exists(cookies_file):
            opts["cookiefile"] = cookies_file

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                if not info:
                    return {"success": False, "error": "Failed to extract video information."}
                return {
                    "success": True,
                    "title": info.get("title", "Unknown"),
                    "duration": info.get("duration", 0),
                    "description": info.get("description", ""),
                    "thumbnail": info.get("thumbnail", ""),
                    "uploader": info.get("uploader", "Unknown"),
                    "view_count": info.get("view_count", 0),
                    "like_count": info.get("like_count", 0),
                    "upload_date": info.get("upload_date", ""),
                    "url": video_url,
                }
        except yt_dlp.utils.DownloadError as exc:
            msg = str(exc)
            if "unavailable" in msg.lower() or "private" in msg.lower():
                return {"success": False, "error": "Video is unavailable or private."}
            if "Unsupported URL" in msg:
                return {"success": False, "error": "Unsupported video platform."}
            return {"success": False, "error": f"Failed to access video: {msg}"}
        except Exception as exc:
            logger.error("get_video_info error: %s", exc)
            return {"success": False, "error": str(exc)}

    # ──────────────────────────────────────────────────────────────
    # Step 2 – Transcription
    # ──────────────────────────────────────────────────────────────

    def _extract_audio(self, video_path: str, audio_path: str) -> Dict[str, Any]:
        """
        Extract audio track from the downloaded video using ffmpeg.

        ffmpeg -i source_video.mp4 -q:a 0 -map a source_audio.mp3
        """
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-q:a", "0",
            "-map", "a",
            "-y",
            audio_path,
        ]
        logger.info("Extracting audio: %s", audio_path)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error("ffmpeg audio extraction error: %s", result.stderr[-500:])
            return {"success": False, "error": f"Audio extraction failed: {result.stderr[-200:]}"}
        return {"success": True, "audio_path": audio_path}

    def _transcribe_with_whisper(self, audio_path: str) -> Dict[str, Any]:
        """
        Step 2: Transcribe audio using Faster-Whisper (runs fully locally).

        Returns a list of segment dicts with 'start', 'end', 'text'.
        """
        if not WHISPER_ENABLED:
            return {
                "success": False,
                "error": (
                    "faster-whisper not installed. "
                    "Install with: pip install faster-whisper"
                ),
            }

        try:
            model = self._load_whisper()
            logger.info("Transcribing audio with Whisper (%s)…", self.WHISPER_MODEL_SIZE)
            segments_iter, _ = model.transcribe(
                audio_path,
                beam_size=5,
                language="en",
                vad_filter=True,  # skip silent sections
            )
            segments = [
                {"start": round(seg.start, 2), "end": round(seg.end, 2), "text": seg.text.strip()}
                for seg in segments_iter
                if seg.text.strip()
            ]
            logger.info("Transcribed %d segments", len(segments))
            return {"success": True, "segments": segments}
        except Exception as exc:
            logger.error("Whisper transcription error: %s", exc, exc_info=True)
            return {"success": False, "error": f"Transcription failed: {exc}"}

    # ──────────────────────────────────────────────────────────────
    # Step 3 – Analysis via Gemini
    # ──────────────────────────────────────────────────────────────

    def _build_transcript_prompt(
        self, segments: List[Dict], video_info: Dict, num_clips: int
    ) -> str:
        """
        Build the Gemini prompt from the Whisper transcript.

        The prompt embeds the full timestamped transcript so Gemini can reason
        over exact spoken content rather than metadata guesses.
        """
        transcript_json = json.dumps(segments, ensure_ascii=False)
        duration = video_info.get("duration", 0)

        return (
            f"Review the following timestamped transcript from a YouTube video titled "
            f'"{video_info.get("title", "Unknown")}" '
            f"(total duration: {duration}s, uploader: {video_info.get('uploader', 'Unknown')}).\n\n"
            f"Identify the {num_clips} most viral moments. "
            f"A viral moment must have:\n"
            f"  • A strong 'hook' – grabs attention in the first 3 seconds\n"
            f"  • A complete thought – begins and ends coherently\n"
            f"  • High emotional resonance – funny, surprising, inspiring, or controversial\n"
            f"  • Ideal duration 15–90 seconds for short-form platforms\n\n"
            f"Timestamped transcript (JSON array of {{start, end, text}} in seconds):\n"
            f"{transcript_json}\n\n"
            f"Return ONLY a JSON array of objects – no other text – with these keys:\n"
            f"  start              (number, seconds)\n"
            f"  end                (number, seconds)\n"
            f"  reason_for_virality (string)\n"
            f"  title              (string – catchy clip title)\n"
            f"  hook               (string – first-line hook)\n"
            f"  platforms          (array of strings: tiktok / instagram / youtube_shorts)\n"
            f"  engagement_score   (integer 0-100)\n\n"
            f"Example output:\n"
            f'[{{"start":45,"end":75,"reason_for_virality":"Shocking reveal with strong '
            f'emotional payoff","title":"You won\'t believe this","hook":"I never expected '
            f'this...","platforms":["tiktok","instagram","youtube_shorts"],"engagement_score":88}}]'
        )

    def _build_metadata_fallback_prompt(self, video_info: Dict, num_clips: int) -> str:
        """
        Fallback prompt used when no transcript is available.
        Uses video metadata only (title, description).
        """
        duration_min = video_info.get("duration", 0) // 60
        duration_sec = video_info.get("duration", 0) % 60
        return (
            f"Analyze this video and identify the {num_clips} best moments for viral social media clips.\n\n"
            f"Video Title: {video_info.get('title', 'Unknown')}\n"
            f"Duration: {duration_min}m {duration_sec}s\n"
            f"Description: {str(video_info.get('description', ''))[:500]}\n"
            f"Uploader: {video_info.get('uploader', 'Unknown')}\n"
            f"Views: {video_info.get('view_count', 0):,}\n\n"
            f"Return ONLY a JSON array (no other text) with objects containing:\n"
            f"  start, end, reason_for_virality, title, hook, platforms, engagement_score"
        )

    def _call_gemini(self, prompt: str) -> Dict[str, Any]:
        """Send prompt to Gemini and return parsed JSON clip list."""
        if not self.gemini_enabled or self.model is None:
            return {"success": False, "error": "Gemini AI not enabled."}
        try:
            response = self.model.generate_content(prompt)
            raw = response.text
            logger.debug("Gemini raw response (first 500 chars): %s", raw[:500])

            # Try to extract a JSON array from the response
            json_match = re.search(r"\[.*\]", raw, re.DOTALL)
            if json_match:
                clips = json.loads(json_match.group())
                return {"success": True, "clips": clips}

            # Fallback: try the whole response as JSON
            clips = json.loads(raw)
            if isinstance(clips, list):
                return {"success": True, "clips": clips}

            return {"success": False, "error": "Gemini response did not contain a valid JSON array."}
        except Exception as exc:
            logger.error("Gemini API error: %s", exc)
            return {"success": False, "error": f"AI analysis failed: {exc}"}

    def _enrich_clips(self, clips: List[Dict], video_info: Dict) -> List[Dict]:
        """Add formatted timestamps and video metadata to each clip dict."""
        for clip in clips:
            start = int(clip.get("start", clip.get("start_time", 0)))
            end = int(clip.get("end", clip.get("end_time", start + 30)))
            clip["start_time"] = start
            clip["end_time"] = end
            clip["duration"] = end - start
            clip["start_timestamp"] = self._format_timestamp(start)
            clip["end_timestamp"] = self._format_timestamp(end)
            clip["video_title"] = video_info.get("title", "")
            clip["video_url"] = video_info.get("url", "")
            clip["thumbnail"] = video_info.get("thumbnail", "")
        return clips

    def analyze_video(self, video_url: str, num_clips: int = 3) -> Dict[str, Any]:
        """
        Full Gemini Clipper analysis pipeline:
          1. Fetch video metadata.
          2. Download the video.
          3. Extract audio + transcribe with Whisper (if available).
          4. Send transcript (or metadata fallback) to Gemini 1.5 Flash.
          5. Return clip suggestions with timestamps.

        The source video is deleted after transcription to save storage.
        """
        if not self.ytdlp_enabled:
            return {"success": False, "error": "yt-dlp not installed."}
        if not self.gemini_enabled:
            return {
                "success": False,
                "error": (
                    "Gemini AI not enabled. "
                    "Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable."
                ),
            }

        if not video_url or not video_url.strip():
            return {"success": False, "error": "video_url is required."}

        temp_dir = None
        try:
            # ── 1. Metadata ────────────────────────────────────────────
            video_info = self.get_video_info(video_url)
            if not video_info.get("success"):
                return video_info

            duration = video_info.get("duration", 0)
            if duration < self.MIN_VIDEO_DURATION:
                return {
                    "success": False,
                    "error": (
                        f"Video is too short ({duration}s). "
                        f"Minimum is {self.MIN_VIDEO_DURATION}s."
                    ),
                }

            # ── 2. Download (for transcription) ────────────────────────
            temp_dir = tempfile.mkdtemp(prefix="gemini_clipper_")
            transcript_segments: Optional[List[Dict]] = None

            if WHISPER_ENABLED:
                dl_result = self._download_video(video_url, temp_dir)
                if dl_result.get("success"):
                    video_path = dl_result["file_path"]

                    # ── 3. Extract audio ───────────────────────────────
                    audio_path = os.path.join(temp_dir, "source_audio.mp3")
                    audio_result = self._extract_audio(video_path, audio_path)

                    # Delete the large source video immediately – we only need audio
                    try:
                        os.remove(video_path)
                        logger.info("Deleted source video after audio extraction: %s", video_path)
                    except OSError as exc:
                        logger.warning("Could not delete source video: %s", exc)

                    if audio_result.get("success"):
                        # ── Transcribe ─────────────────────────────────
                        transcription = self._transcribe_with_whisper(audio_path)
                        if transcription.get("success"):
                            transcript_segments = transcription["segments"]

                        # Delete audio after transcription
                        try:
                            os.remove(audio_path)
                        except OSError:
                            pass
                else:
                    logger.warning(
                        "Download failed for transcription (%s); falling back to metadata analysis.",
                        dl_result.get("error"),
                    )
            else:
                logger.info("Whisper not available; using metadata-only analysis.")

            # ── 4. Gemini analysis ─────────────────────────────────────
            if transcript_segments:
                prompt = self._build_transcript_prompt(transcript_segments, video_info, num_clips)
                logger.info("Sending transcript (%d segments) to Gemini…", len(transcript_segments))
            else:
                prompt = self._build_metadata_fallback_prompt(video_info, num_clips)
                logger.info("Sending metadata fallback prompt to Gemini…")

            gemini_result = self._call_gemini(prompt)
            if not gemini_result.get("success"):
                return gemini_result

            clips = self._enrich_clips(gemini_result["clips"], video_info)
            if not clips:
                return {
                    "success": False,
                    "error": "No viral moments identified. Try a different video.",
                }

            logger.info("Identified %d viral clip suggestions", len(clips))
            return {
                "success": True,
                "video_info": {
                    "title": video_info["title"],
                    "duration": video_info["duration"],
                    "url": video_url,
                    "thumbnail": video_info.get("thumbnail", ""),
                },
                "transcript_available": transcript_segments is not None,
                "suggested_clips": clips,
                "num_clips": len(clips),
            }

        except Exception as exc:
            logger.error("analyze_video unexpected error: %s", exc, exc_info=True)
            return {"success": False, "error": f"Unexpected error: {exc}"}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except OSError as exc:
                    logger.warning("Could not remove temp dir %s: %s", temp_dir, exc)

    # ──────────────────────────────────────────────────────────────
    # Step 4 – Extraction
    # ──────────────────────────────────────────────────────────────

    def _clip_with_ffmpeg(
        self,
        source_path: str,
        start: int,
        end: int,
        output_path: str,
        reencode: bool = False,
    ) -> Dict[str, Any]:
        """
        Cut a segment from *source_path* using ffmpeg.

        ``reencode=False`` (default): stream-copy mode – near-instant and lossless.
            ffmpeg -ss <start> -to <end> -i <src> -c copy <out>

        ``reencode=True``: re-encode with libx264 for frame-accurate cuts suitable
            for social media upload.
            ffmpeg -i <src> -ss <start> -to <end> -c:v libx264 -crf 18 -c:a aac <out>
        """
        if reencode:
            # Input BEFORE -ss for frame-accurate seeking (slower)
            cmd = [
                "ffmpeg",
                "-i", source_path,
                "-ss", str(start),
                "-to", str(end),
                "-c:v", "libx264",
                "-crf", "18",
                "-preset", "fast",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                "-y",
                output_path,
            ]
            mode = "re-encoded"
        else:
            # -ss BEFORE -i for fast keyframe seeking (stream copy)
            cmd = [
                "ffmpeg",
                "-ss", str(start),
                "-to", str(end),
                "-i", source_path,
                "-c", "copy",
                "-movflags", "+faststart",
                "-y",
                output_path,
            ]
            mode = "stream-copy"

        logger.info("ffmpeg %s: %ss → %ss → %s", mode, start, end, output_path)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error("ffmpeg error: %s", result.stderr[-500:])
            return {"success": False, "error": f"ffmpeg clip failed: {result.stderr[-200:]}"}
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            return {"success": False, "error": "ffmpeg produced no output file."}
        return {"success": True}

    def download_and_clip_video(
        self,
        video_url: str,
        start_time: int,
        end_time: int,
        output_path: Optional[str] = None,
        reencode: bool = False,
    ) -> Dict[str, Any]:
        """
        Download the full video then extract one clip, deleting the source immediately.

        Args:
            video_url:   YouTube / supported platform URL.
            start_time:  Clip start in seconds.
            end_time:    Clip end in seconds.
            output_path: Where to save the clip (temp dir if omitted).
            reencode:    True → libx264 re-encode (frame-accurate, slower).
                         False (default) → stream-copy (lossless, near-instant).

        Returns a dict with success status and clip information.
        """
        if not YT_DLP_ENABLED:
            return {"success": False, "error": "yt-dlp not installed."}

        temp_dir = None
        try:
            temp_dir = tempfile.mkdtemp(prefix="gemini_clipper_")

            # ── Download ──────────────────────────────────────────────
            dl_result = self._download_video(video_url, temp_dir)
            if not dl_result.get("success"):
                return dl_result

            source_path = dl_result["file_path"]
            info = dl_result["info"]

            # Clamp end_time to video duration
            video_duration = info.get("duration", 0)
            if video_duration and end_time > video_duration:
                end_time = int(video_duration)

            # ── Determine output path ─────────────────────────────────
            if not output_path:
                safe_title = re.sub(r"[^\w\s-]", "", info.get("title", "video"))[:50]
                safe_title = re.sub(r"[-\s]+", "_", safe_title).strip("_")
                ts = int(datetime.now(timezone.utc).timestamp())
                clip_filename = f"clip_{safe_title}_{start_time}_{end_time}_{ts}.mp4"
                output_path = os.path.join(temp_dir, clip_filename)

            # ── Clip ─────────────────────────────────────────────────
            clip_result = self._clip_with_ffmpeg(
                source_path, start_time, end_time, output_path, reencode=reencode
            )

            # Delete source video immediately to free storage
            _safe_remove(source_path, "source video")

            if not clip_result.get("success"):
                return clip_result

            clip_size = os.path.getsize(output_path)
            logger.info(
                "Clip created: %s (%.1f MB)", output_path, clip_size / (1024 * 1024)
            )
            return {
                "success": True,
                "clip_path": output_path,
                "clip_size_mb": round(clip_size / (1024 * 1024), 2),
                "start_time": start_time,
                "end_time": end_time,
                "duration": end_time - start_time,
                "video_title": info.get("title", "Unknown"),
                "temp_dir": temp_dir,
                "reencode": reencode,
                "message": "Clip created. Original video deleted to save storage.",
            }

        except FileNotFoundError:
            return {
                "success": False,
                "error": "ffmpeg is not installed or not found on PATH. Install with: apt-get install ffmpeg",
            }
        except Exception as exc:
            logger.error("download_and_clip_video error: %s", exc, exc_info=True)
            return {"success": False, "error": f"Unexpected error: {exc}"}
        finally:
            # Clean up temp dir only when the clip was NOT written inside it.
            # If the caller supplied a non-empty external output_path we check
            # whether its parent directory resolves to temp_dir; if so, we
            # leave the directory intact so the caller can read the clip.
            if temp_dir and os.path.exists(temp_dir):
                try:
                    temp_dir_abs = os.path.abspath(temp_dir)
                    clip_dir_abs: Optional[str] = None
                    if output_path and output_path.strip():
                        clip_dir_abs = os.path.abspath(os.path.dirname(output_path))
                    # Preserve temp_dir when the clip lives inside it
                    if clip_dir_abs == temp_dir_abs:
                        return  # caller owns temp_dir; leave it alone
                    shutil.rmtree(temp_dir_abs, ignore_errors=True)
                except Exception as cleanup_exc:
                    logger.warning("Failed to cleanup temp_dir %s: %s", temp_dir, cleanup_exc)

    def analyze_and_create_clips(
        self,
        video_url: str,
        num_clips: int = 3,
        output_dir: Optional[str] = None,
        reencode: bool = False,
    ) -> Dict[str, Any]:
        """
        Full end-to-end pipeline: download → transcribe → Gemini analysis → clip extraction.

        Source video is deleted immediately after all clips are extracted.
        Clips are saved to *output_dir* (a new temp dir if not provided).

        Args:
            video_url:  URL of the video to process.
            num_clips:  How many viral clips to create.
            output_dir: Directory where finished clips are saved.
            reencode:   True for frame-accurate re-encode; False (default) for
                        lossless stream-copy.

        Returns a dict with 'clips' – list of created clip file paths and metadata.
        """
        if not YT_DLP_ENABLED:
            return {"success": False, "error": "yt-dlp not installed."}
        if not self.gemini_enabled:
            return {"success": False, "error": "Gemini AI not enabled (check API key)."}

        work_dir = None
        source_path = None
        try:
            work_dir = tempfile.mkdtemp(prefix="gemini_full_pipeline_")
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            else:
                output_dir = work_dir

            # ── Step 1: Download ──────────────────────────────────────
            logger.info("[Pipeline] Step 1: Downloading video…")
            dl_result = self._download_video(video_url, work_dir)
            if not dl_result.get("success"):
                return dl_result

            source_path = dl_result["file_path"]
            info = dl_result["info"]
            video_info = {
                "title": info.get("title", "Unknown"),
                "duration": info.get("duration", 0),
                "url": video_url,
                "thumbnail": info.get("thumbnail", ""),
                "uploader": info.get("uploader", "Unknown"),
                "description": info.get("description", ""),
            }

            # Rate-limit: brief jitter before heavy processing
            _jitter_sleep(1, 3)

            # ── Step 2: Transcribe ────────────────────────────────────
            transcript_segments = None
            if WHISPER_ENABLED:
                logger.info("[Pipeline] Step 2: Extracting audio + transcribing…")
                audio_path = os.path.join(work_dir, "source_audio.mp3")
                audio_result = self._extract_audio(source_path, audio_path)
                if audio_result.get("success"):
                    transcription = self._transcribe_with_whisper(audio_path)
                    if transcription.get("success"):
                        transcript_segments = transcription["segments"]
                    _safe_remove(audio_path, "audio")
                else:
                    logger.warning("[Pipeline] Audio extraction failed; using metadata fallback.")
            else:
                logger.info("[Pipeline] Whisper not available; skipping transcription.")

            # ── Step 3: Gemini analysis ───────────────────────────────
            logger.info("[Pipeline] Step 3: Gemini analysis…")
            if transcript_segments:
                prompt = self._build_transcript_prompt(transcript_segments, video_info, num_clips)
            else:
                prompt = self._build_metadata_fallback_prompt(video_info, num_clips)

            gemini_result = self._call_gemini(prompt)
            if not gemini_result.get("success"):
                return gemini_result

            clips = self._enrich_clips(gemini_result["clips"], video_info)
            if not clips:
                return {"success": False, "error": "No viral moments identified."}

            # ── Step 4: Extract clips ─────────────────────────────────
            logger.info("[Pipeline] Step 4: Extracting %d clips with ffmpeg…", len(clips))
            created_clips = []
            safe_title = re.sub(r"[^\w\s-]", "", video_info["title"])[:40]
            safe_title = re.sub(r"[-\s]+", "_", safe_title).strip("_")
            ts = int(datetime.now(timezone.utc).timestamp())

            for idx, clip in enumerate(clips, 1):
                # Validate and clamp timestamps before calling ffmpeg
                try:
                    raw_start = float(clip.get("start_time", 0.0))
                    raw_end = float(clip.get("end_time", 0.0))
                except (TypeError, ValueError):
                    logger.warning(
                        "  Clip %d/%d has non-numeric timestamps (start=%r, end=%r); skipping.",
                        idx, len(clips), clip.get("start_time"), clip.get("end_time"),
                    )
                    continue

                vid_duration = video_info.get("duration")
                if isinstance(vid_duration, (int, float)) and vid_duration > 0:
                    clip_start = max(0.0, min(raw_start, vid_duration))
                    clip_end = max(0.0, min(raw_end, vid_duration))
                else:
                    clip_start = max(0.0, raw_start)
                    clip_end = max(0.0, raw_end)

                if clip_start >= clip_end:
                    logger.warning(
                        "  Clip %d/%d has invalid range after clamping (start=%.2f, end=%.2f); skipping.",
                        idx, len(clips), clip_start, clip_end,
                    )
                    continue

                clip_path = os.path.join(
                    output_dir, f"clip_{idx}_{safe_title}_{ts}.mp4"
                )
                result = self._clip_with_ffmpeg(
                    source_path,
                    clip_start,
                    clip_end,
                    clip_path,
                    reencode=reencode,
                )
                if result.get("success"):
                    clip["clip_path"] = clip_path
                    clip["clip_size_mb"] = round(
                        os.path.getsize(clip_path) / (1024 * 1024), 2
                    )
                    created_clips.append(clip)
                    logger.info("  Clip %d/%d created: %s", idx, len(clips), clip_path)
                else:
                    logger.warning("  Clip %d/%d failed: %s", idx, len(clips), result.get("error"))

            # ── Delete source immediately after all clips ──────────────
            _safe_remove(source_path, "source video")
            source_path = None
            logger.info("[Pipeline] Source video deleted. Pipeline complete.")

            return {
                "success": True,
                "video_info": video_info,
                "transcript_available": transcript_segments is not None,
                "num_clips_requested": num_clips,
                "num_clips_created": len(created_clips),
                "clips": created_clips,
            }

        except Exception as exc:
            logger.error("analyze_and_create_clips error: %s", exc, exc_info=True)
            return {"success": False, "error": f"Pipeline error: {exc}"}
        finally:
            # Delete source video in error paths
            if source_path and os.path.exists(source_path):
                _safe_remove(source_path, "source video (error cleanup)")
            # Clean up working directory (clips in output_dir are untouched)
            if work_dir and os.path.exists(work_dir) and work_dir != output_dir:
                try:
                    shutil.rmtree(work_dir)
                except OSError as exc:
                    logger.warning("Could not remove work dir %s: %s", work_dir, exc)

    # ──────────────────────────────────────────────────────────────
    # Legacy / metadata-only helpers (kept for backward compatibility)
    # ──────────────────────────────────────────────────────────────

    def generate_clip_metadata(self, clip: Dict[str, Any], platform: str = "instagram") -> Dict[str, Any]:
        """Generate optimized social media metadata for a clip via Gemini."""
        if not self.gemini_enabled:
            return {"success": False, "error": "Gemini AI not enabled."}
        try:
            prompt = (
                f"Generate optimized social media metadata for this video clip.\n\n"
                f"Title: {clip.get('title', 'Untitled')}\n"
                f"Hook: {clip.get('hook', '')}\n"
                f"Duration: {clip.get('duration', 30)} seconds\n"
                f"Viral Reason: {clip.get('reason_for_virality', clip.get('viral_reason', ''))}\n"
                f"Platform: {platform}\n\n"
                f"Return ONLY a JSON object with: caption, hashtags (array), "
                f"thumbnail_text, best_time, cta, tips (array)."
            )
            response = self.model.generate_content(prompt)
            json_match = re.search(r"\{.*\}", response.text, re.DOTALL)
            if json_match:
                metadata = json.loads(json_match.group())
                metadata["success"] = True
                metadata["platform"] = platform
                return metadata
            return {"success": False, "error": "Failed to parse metadata response."}
        except Exception as exc:
            logger.error("generate_clip_metadata error: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_clip_download_info(self, video_url: str, start_time: int, end_time: int) -> Dict[str, Any]:
        """Return ffmpeg commands for manual clip extraction (no download performed)."""
        try:
            duration = end_time - start_time
            start_ts = self._format_timestamp(start_time)
            end_ts = self._format_timestamp(end_time)
            return {
                "success": True,
                "video_url": video_url,
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration,
                "start_timestamp": start_ts,
                "end_timestamp": end_ts,
                "ffmpeg_stream_copy": (
                    f'ffmpeg -ss {start_ts} -to {end_ts} -i "{video_url}" -c copy clip.mp4'
                ),
                "ffmpeg_reencode": (
                    f'ffmpeg -i "{video_url}" -ss {start_ts} -to {end_ts} '
                    f"-c:v libx264 -crf 18 -c:a aac clip.mp4"
                ),
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    # ──────────────────────────────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _format_timestamp(seconds: int) -> str:
        """Convert integer seconds to HH:MM:SS or MM:SS."""
        seconds = int(seconds)
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        if h:
            return f"{h:02d}:{m:02d}:{s:02d}"
        return f"{m:02d}:{s:02d}"


# ──────────────────────────────────────────────────────────────
# Module-level helpers
# ──────────────────────────────────────────────────────────────

def _jitter_sleep(min_sec: float = 1.0, max_sec: float = 3.0) -> None:
    """Sleep for a random duration to avoid burst behaviour."""
    import time
    delay = min_sec + random.random() * (max_sec - min_sec)
    logger.debug("Rate-limit jitter: sleeping %.1fs", delay)
    time.sleep(delay)


def _safe_remove(path: str, label: str = "file") -> None:
    """Delete a file, logging any errors rather than raising."""
    try:
        if os.path.exists(path):
            os.remove(path)
            logger.info("Deleted %s: %s", label, path)
    except OSError as exc:
        logger.warning("Could not delete %s (%s): %s", label, path, exc)


# Singleton used by app.py routes
video_clipper = VideoClipperService()
