import os
import uuid
import logging
import subprocess
import math
import shutil
import concurrent.futures
from typing import Dict, Any, Tuple, List
from pathlib import Path
from pydub import AudioSegment
from ai_audio import generate_tts, generate_ai_music

logger = logging.getLogger(__name__)

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp format HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

class VideoGenerator:
    def __init__(self, media_dir: str):
        if not shutil.which("ffmpeg"):
            logger.error("FFmpeg is not installed or not in PATH!")
            raise RuntimeError("FFmpeg is required but could not be found.")
            
        self.media_dir = media_dir
        self.temp_dir = os.path.join(media_dir, "temp_video")
        os.makedirs(self.temp_dir, exist_ok=True)

    def generate_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        job_id = project.get("id", str(uuid.uuid4()))
        work_dir = os.path.join(self.temp_dir, job_id)
        os.makedirs(work_dir, exist_ok=True)
        
        try:
            settings = project.get("settings", {})
            slides = project.get("slides", [])
            
            if not slides:
                return {"error": "No slides provided."}
                
            for slide in slides:
                if not slide.get("image_path") or not slide["image_path"].strip():
                    return {"error": "All slides must have a valid image. Please assign Images to empty slides."}
            
            slide_durations, master_audio_path, srt_path = self._generate_audio(slides, settings, work_dir)
            raw_video_path = self._render_video(slides, slide_durations, master_audio_path, settings, work_dir)
            final_video_path = self._burn_subtitles(raw_video_path, srt_path, settings, job_id)
            
            # Export SRT if it has content
            final_srt_path = os.path.join(self.media_dir, f"video_{job_id}.srt")
            if os.path.exists(srt_path):
                shutil.copy(srt_path, final_srt_path)
            
            return {
                "success": True, 
                "video_path": final_video_path, 
                "srt_path": final_srt_path if os.path.exists(final_srt_path) else None,
                "job_id": job_id
            }

        except Exception as e:
            logger.error(f"Error generating video: {e}")
            return {"error": str(e)}
        finally:
            if os.path.exists(work_dir):
                shutil.rmtree(work_dir, ignore_errors=True)

    def _generate_audio(self, slides: List[Dict[str, Any]], settings: Dict[str, Any], work_dir: str) -> Tuple[List[float], str, str]:
        overall_audio = AudioSegment.silent(duration=0)
        srt_content = ""
        current_time = 0.0
        
        slide_durations = []
        default_slide_duration = float(settings.get("default_slide_duration", 3.0))
        
        # Helper for threaded TTS
        def _do_tts(i, text):
            path = os.path.join(work_dir, f"tts_{i}.mp3")
            success = generate_tts(text, path)
            if not success:
                raise RuntimeError(f"Failed to generate TTS for slide {i+1}")
            return path

        # Submit TTS jobs in parallel
        futures_map = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            for i, slide in enumerate(slides):
                narration = slide.get("narration", "").strip()
                if narration:
                    futures_map[i] = executor.submit(_do_tts, i, narration)
                    
        for i, slide in enumerate(slides):
            narration = slide.get("narration", "").strip()
            
            if narration:
                text_audio_path = futures_map[i].result()
                segment = AudioSegment.from_file(text_audio_path)
                segment += AudioSegment.silent(duration=500) 
            else:
                segment = AudioSegment.silent(duration=int(default_slide_duration * 1000))
                
            duration_sec = len(segment) / 1000.0
            slide_durations.append(duration_sec)
            
            overall_audio += segment
            
            if narration.strip():
                start_str = format_timestamp(current_time)
                end_str = format_timestamp(current_time + duration_sec - 0.5)
                srt_content += f"{i+1}\n{start_str} --> {end_str}\n{narration}\n\n"
                
            current_time += duration_sec
            
        srt_path = os.path.join(work_dir, "captions.srt")
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
            
        bgm_source = settings.get("bgm_source")
        bgm_data = settings.get("bgm_path_or_prompt")
        bgm_path = None
        
        if bgm_source == 'file' and bgm_data and os.path.exists(bgm_data):
            bgm_path = bgm_data
        elif bgm_source == 'ai' and bgm_data:
            bgm_path = os.path.join(work_dir, "ai_music.wav")
            success = generate_ai_music(bgm_data, bgm_path)
            if not success:
                logger.warning("AI music generation failed, continuing without BGM.")
                bgm_path = None
        
        if bgm_path and os.path.exists(bgm_path):
            bgm_segment = AudioSegment.from_file(bgm_path)
            bgm_volume = float(settings.get("bgm_volume", 0.5))
            if bgm_volume <= 0:
                bgm_db = -120.0
            else:
                bgm_db = 20 * math.log10(bgm_volume)
                
            bgm_segment = bgm_segment + bgm_db
            
            bgm_start_sec = float(settings.get("bgm_start_time", 0.0))
            bgm_start_ms = int(bgm_start_sec * 1000)
            
            if len(bgm_segment) < len(overall_audio):
                times = int(len(overall_audio)/len(bgm_segment)) + 1
                bgm_segment = bgm_segment * times
                
            final_audio = overall_audio.overlay(bgm_segment, position=bgm_start_ms)
        else:
            final_audio = overall_audio
            
        master_audio_path = os.path.join(work_dir, "master_audio.mp3")
        final_audio.export(master_audio_path, format="mp3", bitrate=settings.get("audio_bitrate", "192k"))
        
        return slide_durations, master_audio_path, srt_path

    def _render_video(self, slides: List[Dict[str, Any]], slide_durations: List[float], master_audio_path: str, settings: Dict[str, Any], work_dir: str) -> str:
        fps = float(settings.get("fps", 30))
        resolution = settings.get("resolution", "1920x1080")
        width, height = map(int, resolution.split("x"))
        transition_type = settings.get("transition", "None").lower()
        if transition_type == "none":
            transition_type = None
        trans_duration = float(settings.get("transition_duration", 1.0))
        
        ffmpeg_cmd = ["ffmpeg", "-y"]
        for slide in slides:
            ffmpeg_cmd.extend(["-loop", "1", "-t", "99999", "-i", slide.get("image_path")])
            
        filter_parts = []
        
        if not transition_type:
            for i in range(len(slides)):
                dur = slide_durations[i]
                zpan = f"zoompan=z='min(zoom+0.0015,1.5)':d={int(dur*fps)}:s={width}x{height}"
                filter_parts.append(f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,{zpan},trim=duration={dur},setpts=PTS-STARTPTS[v{i}];")
            
            concat_inputs = "".join([f"[v{i}]" for i in range(len(slides))])
            filter_parts.append(f"{concat_inputs}concat=n={len(slides)}:v=1:a=0[v_out]")
        else:
            current_offset = 0.0
            for i in range(len(slides)):
                dur = slide_durations[i]
                zpan = f"zoompan=z='min(zoom+0.0015,1.5)':d={int(dur*fps*2)}:s={width}x{height}"
                filter_parts.append(f"[{i}:v]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,{zpan}[s{i}];")
            
            if len(slides) == 1:
                filter_parts.append(f"[s0]trim=duration={slide_durations[0]},setpts=PTS-STARTPTS[v_out]")
            else:
                prev_out = "[s0]"
                for i in range(1, len(slides)):
                    out_label = f"[v_trans{i}]" if i < len(slides)-1 else "[v_out]"
                    
                    actual_trans = min(trans_duration, slide_durations[i-1] * 0.8)
                    offset = current_offset + slide_durations[i-1] - actual_trans
                    current_offset = offset
                    
                    ff_trans = transition_type
                    if ff_trans == 'pixelize': ff_trans = 'pixelize'
                    
                    filter_parts.append(f"{prev_out}[s{i}]xfade=transition={ff_trans}:duration={actual_trans:.2f}:offset={offset:.2f}{out_label};")
                    prev_out = out_label
                    
        # Apply title card to output stream if requested
        video_title = settings.get("video_title", "").strip()
        final_video_stream = "[v_out]"
        if video_title and len(slide_durations) > 0:
            first_dur = slide_durations[0]
            # Escape title for ffmpeg drawtext
            safe_title = video_title.replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")
            # Use Arial as generic font
            drawtext_filter = f"drawtext=text='{safe_title}':fontcolor=white:fontsize=h/10:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,{first_dur})':shadowcolor=black:shadowx=2:shadowy=2"
            filter_parts.append(f"[v_out]{drawtext_filter}[v_title_out];")
            final_video_stream = "[v_title_out]"
        
        filtergraph = "".join(filter_parts)
        ffmpeg_cmd.extend(["-filter_complex", filtergraph])
        ffmpeg_cmd.extend(["-map", final_video_stream])
        
        ffmpeg_cmd.extend(["-i", master_audio_path])
        ffmpeg_cmd.extend(["-map", f"{len(slides)}:a"])
        
        quality = settings.get("quality", "Standard")
        preset = "medium"
        crf = "23"
        if quality == "Draft":
            preset = "ultrafast"
            crf = "28"
        elif quality == "High":
            preset = "slow"
            crf = "18"
            
        ffmpeg_cmd.extend(["-c:v", "libx264", "-preset", preset, "-crf", crf, "-pix_fmt", "yuv420p", "-r", str(fps)])
        ffmpeg_cmd.extend(["-c:a", settings.get("audio_codec", "aac"), "-b:a", settings.get("audio_bitrate", "192k")])
        ffmpeg_cmd.extend(["-shortest"])
        
        raw_video_path = os.path.join(work_dir, "raw_video.mp4")
        ffmpeg_cmd.append(raw_video_path)
        
        logger.info("Executing FFmpeg (Video + Audio)...")
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg failed: {result.stderr}")
            raise RuntimeError("FFmpeg compilation failed.")
            
        return raw_video_path

    def _burn_subtitles(self, raw_video_path: str, srt_path: str, settings: Dict[str, Any], job_id: str) -> str:
        burn_subs = settings.get("burn_subtitles", True)
        final_video_path = os.path.join(self.media_dir, f"video_{job_id}.mp4")
        
        if not burn_subs:
            shutil.copy(raw_video_path, final_video_path)
            return final_video_path
            
        cap = settings.get("captions", {})
        font = cap.get("font", "Arial")
        size = cap.get("size", 24)
        color = cap.get("color", "&H00FFFFFF")
        outline = cap.get("outline_color", "&H00000000")
        pos = cap.get("position", 2)
        
        srt_path_escaped = srt_path.replace("\\", "\\\\").replace(":", "\\:")
        sub_filter = f"subtitles={srt_path_escaped}:force_style='FontName={font},FontSize={size},PrimaryColour={color},OutlineColour={outline},Alignment={pos},BorderStyle=3,BackColour=&H80000000'"
        
        ffmpeg_sub_cmd = [
            "ffmpeg", "-y", "-i", raw_video_path,
            "-vf", sub_filter,
            "-c:a", "copy",
            final_video_path
        ]
        
        logger.info("Executing FFmpeg (Subtitles)...")
        sub_result = subprocess.run(ffmpeg_sub_cmd, capture_output=True, text=True)
        if sub_result.returncode != 0:
            logger.error(f"FFmpeg subtitle failed: {sub_result.stderr}")
            raise RuntimeError("FFmpeg subtitle burn failed.")
            
        return final_video_path
