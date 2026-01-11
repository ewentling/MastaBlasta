"""
Media upload and management utilities
"""
import os
import uuid
import mimetypes
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from werkzeug.utils import secure_filename
from PIL import Image
import logging

logger = logging.getLogger(__name__)

# Configuration
MEDIA_DIR = Path('/home/runner/work/MastaBlasta/MastaBlasta/media')
THUMBNAIL_DIR = MEDIA_DIR / 'thumbnails'
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB
THUMBNAIL_SIZE = (300, 300)

# Ensure directories exist
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)


def is_allowed_file(filename: str, file_type: str = 'image') -> bool:
    """Check if file extension is allowed"""
    ext = Path(filename).suffix.lower()
    
    if file_type == 'image':
        return ext in ALLOWED_IMAGE_EXTENSIONS
    elif file_type == 'video':
        return ext in ALLOWED_VIDEO_EXTENSIONS
    else:
        return ext in (ALLOWED_IMAGE_EXTENSIONS | ALLOWED_VIDEO_EXTENSIONS)


def get_file_size(file_obj) -> int:
    """Get file size in bytes"""
    file_obj.seek(0, os.SEEK_END)
    size = file_obj.tell()
    file_obj.seek(0)
    return size


def validate_file_size(file_obj, max_size: int) -> Tuple[bool, Optional[str]]:
    """Validate file size"""
    size = get_file_size(file_obj)
    
    if size > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, f"File size exceeds maximum allowed size of {max_mb:.0f} MB"
    
    return True, None


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename while preserving extension"""
    ext = Path(original_filename).suffix
    return f"{uuid.uuid4().hex}{ext}"


def save_uploaded_file(file_obj, user_id: str, original_filename: str) -> Dict[str, Any]:
    """Save uploaded file and return metadata"""
    try:
        # Create user directory
        user_dir = MEDIA_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        
        # Secure the filename
        secure_name = secure_filename(original_filename)
        unique_filename = generate_unique_filename(secure_name)
        file_path = user_dir / unique_filename
        
        # Determine file type
        mime_type, _ = mimetypes.guess_type(original_filename)
        is_image = mime_type and mime_type.startswith('image/')
        is_video = mime_type and mime_type.startswith('video/')
        
        # Validate file type
        if is_image and not is_allowed_file(original_filename, 'image'):
            return {'error': 'Invalid image file type'}
        elif is_video and not is_allowed_file(original_filename, 'video'):
            return {'error': 'Invalid video file type'}
        
        # Validate file size
        max_size = MAX_IMAGE_SIZE if is_image else MAX_VIDEO_SIZE
        valid, error = validate_file_size(file_obj, max_size)
        if not valid:
            return {'error': error}
        
        # Save file
        file_obj.save(str(file_path))
        file_size = file_path.stat().st_size
        
        # Get dimensions for images
        width, height = None, None
        thumbnail_path = None
        
        if is_image:
            try:
                with Image.open(file_path) as img:
                    width, height = img.size
                    
                    # Generate thumbnail
                    thumbnail_filename = f"thumb_{unique_filename}"
                    user_thumbnail_dir = THUMBNAIL_DIR / user_id
                    user_thumbnail_dir.mkdir(parents=True, exist_ok=True)
                    thumbnail_path = user_thumbnail_dir / thumbnail_filename
                    
                    # Create thumbnail
                    img.thumbnail(THUMBNAIL_SIZE)
                    img.save(thumbnail_path)
            except Exception as e:
                logger.warning(f"Failed to process image: {e}")
        
        return {
            'filename': unique_filename,
            'original_filename': secure_name,
            'file_path': str(file_path.relative_to(MEDIA_DIR)),
            'thumbnail_path': str(thumbnail_path.relative_to(MEDIA_DIR)) if thumbnail_path else None,
            'mime_type': mime_type or 'application/octet-stream',
            'file_size': file_size,
            'width': width,
            'height': height,
            'is_image': is_image,
            'is_video': is_video
        }
    
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        return {'error': str(e)}


def delete_file(file_path: str, thumbnail_path: str = None) -> bool:
    """Delete a file and its thumbnail"""
    try:
        full_path = MEDIA_DIR / file_path
        if full_path.exists():
            full_path.unlink()
        
        if thumbnail_path:
            full_thumbnail_path = MEDIA_DIR / thumbnail_path
            if full_thumbnail_path.exists():
                full_thumbnail_path.unlink()
        
        return True
    except Exception as e:
        logger.error(f"File deletion failed: {e}")
        return False


def get_file_path(file_path: str) -> Optional[Path]:
    """Get absolute file path"""
    full_path = MEDIA_DIR / file_path
    if full_path.exists():
        return full_path
    return None


def optimize_image_for_platform(image_path: Path, platform: str, output_path: Path) -> bool:
    """Optimize image for specific platform requirements"""
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if needed
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGB')
            
            # Platform-specific dimensions
            dimensions = {
                'instagram': (1080, 1080),  # 1:1
                'facebook': (1200, 630),     # ~1.91:1
                'twitter': (1200, 675),      # 16:9
                'linkedin': (1200, 627),     # ~1.91:1
                'pinterest': (1000, 1500),   # 2:3
                'tiktok': (1080, 1920),      # 9:16
                'youtube': (1280, 720)       # 16:9
            }
            
            target_size = dimensions.get(platform, (1200, 1200))
            
            # Resize maintaining aspect ratio
            img.thumbnail(target_size, Image.Resampling.LANCZOS)
            
            # Save optimized image
            img.save(output_path, quality=85, optimize=True)
            return True
    
    except Exception as e:
        logger.error(f"Image optimization failed: {e}")
        return False


def get_video_duration(video_path: Path) -> Optional[float]:
    """Get video duration in seconds (requires ffmpeg)"""
    try:
        import subprocess
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1', str(video_path)],
            capture_output=True,
            text=True
        )
        return float(result.stdout.strip())
    except Exception as e:
        logger.warning(f"Could not get video duration: {e}")
        return None
