import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, MapPin, Music, PlayCircle, Plus, LayoutGrid, Type, RefreshCw, FileText, Copy, ArrowLeft, ArrowRight, Download, UploadCloud, Trash2 } from 'lucide-react';
import { api, videoApi } from '../api';
import type { VideoJobStatus } from '../api';

interface Slide {
    id: string;
    image_path: string;
    image_url: string; // Used for frontend preview
    narration: string;
}

interface VideoSettings {
    resolution: string;
    fps: number;
    quality: string;
    video_title: string;
    transition: string;
    transition_duration: number;
    default_slide_duration: number;
    audio_codec: string;
    audio_bitrate: string;
    bgm_source: 'none' | 'file' | 'link' | 'ai';
    bgm_path_or_prompt: string;
    bgm_volume: number;
    bgm_start_time: number;
    bgm_fade: boolean;
    burn_subtitles: boolean;
    captions: {
        font: string;
        size: number;
        color: string;
        outline_color: string;
        bg_color: string;
        bg_opacity: number;
        position: number;
    }
}

export default function VideoGeneratorPage() {
    // Load state from localStorage on init
    const [slides, setSlides] = useState<Slide[]>(() => {
        const saved = localStorage.getItem('videoGenerator_slides');
        return saved ? JSON.parse(saved) : [];
    });

    const [settings, setSettings] = useState<VideoSettings>(() => {
        const saved = localStorage.getItem('videoGenerator_settings');
        return saved ? JSON.parse(saved) : {
            resolution: '1920x1080',
            fps: 30,
            quality: 'Standard',
            video_title: '',
            transition: 'None',
            transition_duration: 1.0,
            default_slide_duration: 3.0,
            audio_codec: 'aac',
            audio_bitrate: '192k',
            bgm_source: 'none',
            bgm_path_or_prompt: '',
            bgm_volume: 0.5,
            bgm_start_time: 0.0,
            bgm_fade: true,
            burn_subtitles: true,
            captions: {
                font: 'Arial',
                size: 24,
                color: '&H00FFFFFF',
                outline_color: '&H00000000',
                bg_color: '000000', // Black
                bg_opacity: 50, // 50%
                position: 2
            }
        };
    });

    const [bulkScript, setBulkScript] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<VideoJobStatus | null>(null);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
    const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const slidesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        slidesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [slides.length]);

    // Auto-save to localStorage
    useEffect(() => {
        localStorage.setItem('videoGenerator_slides', JSON.stringify(slides));
        setLastSaved(new Date());
    }, [slides]);

    useEffect(() => {
        localStorage.setItem('videoGenerator_settings', JSON.stringify(settings));
    }, [settings]);

    const handleExportProject = () => {
        const projectData = { slides, settings };
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'masta_blasta_project.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (parsed.slides && parsed.settings) {
                    setSlides(parsed.slides);
                    setSettings(parsed.settings);
                    setGlobalError(null);
                } else {
                    setGlobalError("Invalid project file format.");
                }
            } catch (err) {
                setGlobalError("Failed to parse project file.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleGenerateMusic = async () => {
        if (!settings.bgm_path_or_prompt) {
            setGlobalError("Please enter an AI prompt first.");
            return;
        }
        setIsGeneratingMusic(true);
        setGlobalError(null);
        try {
            const res = await videoApi.generateMusic(settings.bgm_path_or_prompt);
            setGeneratedMusicUrl(res.url);
        } catch (error: any) {
            setGlobalError(error.response?.data?.error || "Failed to generate AI music.");
        } finally {
            setIsGeneratingMusic(false);
        }
    };

    const handleClearProgress = () => {
        if (window.confirm("Are you sure you want to clear all slides and text? This cannot be undone.")) {
            setSlides([]);
            setBulkScript('');
            localStorage.removeItem('videoGenerator_slides');
        }
    };

    // Drag and drop logic for reordering
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleSort = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            let _slides = [...slides];
            const draggedItemContent = _slides.splice(dragItem.current, 1)[0];
            _slides.splice(dragOverItem.current, 0, draggedItemContent);
            dragItem.current = null;
            dragOverItem.current = null;
            setSlides(_slides);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);

            const newSlides: Slide[] = [...slides];

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    // Upload to our generic media route to get a stablized path
                    const response = await api.post('/media/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    if (response.data && !response.data.error) {
                        newSlides.push({
                            id: Math.random().toString(36).substr(2, 9),
                            image_path: response.data.file_path, // Backend format
                            image_url: URL.createObjectURL(file), // Local preview
                            narration: ''
                        });
                    }
                } catch (err) {
                    console.error("Upload failed", err);
                    alert(`Failed to upload ${file.name}`);
                }
            }

            setSlides(newSlides);
        }
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Re-use handleImageUpload logic by mocking the event structure
            const fakeEvent = {
                target: { files: e.dataTransfer.files }
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            await handleImageUpload(fakeEvent);
        }
    };

    const handleSlideImageDrop = async (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation(); // prevent main zone drop
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const formData = new FormData();
            formData.append('file', file);
            try {
                const response = await api.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data && !response.data.error) {
                    const newSlides = [...slides];
                    newSlides[targetIndex] = {
                        ...newSlides[targetIndex],
                        image_path: response.data.file_path,
                        image_url: URL.createObjectURL(file)
                    };
                    setSlides(newSlides);
                }
            } catch (err) {
                console.error("Slide image replace failed", err);
                setGlobalError(`Failed to replace image: ${file.name}`);
            }
        }
    };

    const handleAddImageUrl = () => {
        if (newImageUrl.trim()) {
            setSlides([
                ...slides,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    image_path: newImageUrl.trim(), // Assuming backend can download or ffmpeg can process URLs directly
                    image_url: newImageUrl.trim(),
                    narration: ''
                }
            ]);
            setNewImageUrl('');
        }
    };

    const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await api.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data && !response.data.error) {
                    setSettings({ ...settings, bgm_source: 'file', bgm_path_or_prompt: response.data.file_path });
                }
            } catch (err) {
                console.error(err);
                alert("Failed to upload BGM");
            }
        }
    }

    const removeSlide = (index: number) => {
        const newSlides = [...slides];
        newSlides.splice(index, 1);
        setSlides(newSlides);
    };

    const duplicateSlide = (index: number) => {
        const slideToCopy = slides[index];
        const newSlides = [...slides];
        newSlides.splice(index + 1, 0, {
            ...slideToCopy,
            id: Math.random().toString(36).substr(2, 9)
        });
        setSlides(newSlides);
    };

    const moveSlide = (index: number, direction: 'left' | 'right') => {
        if (direction === 'left' && index > 0) {
            const newSlides = [...slides];
            const temp = newSlides[index];
            newSlides[index] = newSlides[index - 1];
            newSlides[index - 1] = temp;
            setSlides(newSlides);
        } else if (direction === 'right' && index < slides.length - 1) {
            const newSlides = [...slides];
            const temp = newSlides[index];
            newSlides[index] = newSlides[index + 1];
            newSlides[index + 1] = temp;
            setSlides(newSlides);
        }
    };

    const updateNarration = (index: number, value: string) => {
        const newSlides = [...slides];
        newSlides[index].narration = value;
        setSlides(newSlides);
    };

    const handleApplyScript = () => {
        // Basic parser for "[1] Some text \n [2] Some other text" or "1. Some text"
        // We split by lines or regex taking the number
        const regex = /(?:\[|\b)(\d+)(?:\]|\.|\:)?\s*(.*?)(?=(?:\[|\b)\d+(?:\]|\.|\:)?\s*|$)/gs;
        let match;
        const extracted: { [key: number]: string } = {};

        while ((match = regex.exec(bulkScript)) !== null) {
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            const slideNum = parseInt(match[1], 10);
            const narrationText = match[2].trim();
            extracted[slideNum] = narrationText;
        }

        if (Object.keys(extracted).length === 0) {
            setGlobalError("Could not parse script. Please make sure you prefix each section with a number like [1] or 1.");
            return;
        }

        const newSlides = [...slides];
        Object.entries(extracted).forEach(([numStr, text]) => {
            const idx = parseInt(numStr, 10) - 1;
            if (idx >= 0) {
                if (idx < newSlides.length) {
                    newSlides[idx].narration = text;
                } else {
                    // Create empty slides up to this point
                    while (newSlides.length <= idx) {
                        newSlides.push({
                            id: Math.random().toString(36).substr(2, 9),
                            image_path: '', // Needs an image later
                            image_url: '',
                            narration: ''
                        });
                    }
                    newSlides[idx].narration = text;
                }
            }
        });
        setSlides(newSlides);
        setBulkScript(''); // Clear after applying
    };

    const handleGenerate = async () => {
        setGlobalError(null);
        if (slides.length === 0) {
            setGlobalError("Please add at least one slide.");
            return;
        }

        setIsGenerating(true);
        try {
            const response = await videoApi.generate({
                settings,
                slides: slides.map(s => ({
                    image_path: s.image_path,
                    narration: s.narration
                }))
            });

            if (response.job_id) {
                setJobId(response.job_id);
            } else {
                setGlobalError("Generation failed to start");
                setIsGenerating(false);
            }
        } catch (err: any) {
            console.error(err);
            setGlobalError(err.response?.data?.error || "Failed to start generation");
            setIsGenerating(false);
        }
    };

    const calculateEstimatedDuration = () => {
        let seconds = 0;
        slides.forEach(s => {
            if (s.narration.trim()) {
                const words = s.narration.trim().split(/\s+/).length;
                seconds += (words / 2.5); // avg 150 words per minute
            } else {
                seconds += settings.default_slide_duration;
            }
        });
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    // Poll for job status
    useEffect(() => {
        let interval: any;
        if (jobId && jobStatus?.status !== 'completed' && jobStatus?.status !== 'failed') {
            interval = setInterval(async () => {
                try {
                    const res = await videoApi.getStatus(jobId);
                    setJobStatus(res);

                    if (res.status === 'completed' || res.status === 'failed') {
                        clearInterval(interval);
                        setIsGenerating(false);
                    }
                } catch (err) {
                    console.error("Error polling status", err);
                }
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [jobId, jobStatus?.status]);

    return (
        <div className="space-y-6">
            <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2>Long Form Video Generator</h2>
                    <p>Create automated videos with Gemini-TTS narration, AI Music, and FFmpeg transitions</p>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                    {lastSaved && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium animate-pulse mr-2">
                            Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                    <div className="flex gap-2">
                        <button className="btn btn-secondary text-sm flex items-center gap-1 py-1" onClick={handleExportProject}>
                            <Download size={14} /> Export Project
                        </button>
                        <input type="file" id="import_project" accept=".json" className="hidden" onChange={handleImportProject} />
                        <label htmlFor="import_project" className="btn btn-secondary text-sm flex items-center gap-1 py-1 cursor-pointer">
                            <UploadCloud size={14} /> Import Project
                        </label>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">

                    {globalError && (
                        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded text-sm text-red-700 dark:text-red-300 relative">
                            <button onClick={() => setGlobalError(null)} className="absolute top-2 right-2 hover:bg-red-100 dark:hover:bg-red-900/50 p-1 rounded">
                                <X size={16} />
                            </button>
                            <strong>Error:</strong> {globalError}
                        </div>
                    )}

                    {/* Images Grid */}
                    <div className="card p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><LayoutGrid size={20} /> Slide sequence</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    className="btn btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                                    onClick={() => setIsCompactMode(!isCompactMode)}
                                    title={isCompactMode ? "Switch to Grid View" : "Switch to Compact List View"}
                                >
                                    <LayoutGrid size={14} /> {isCompactMode ? 'Grid View' : 'Compact View'}
                                </button>
                                <input
                                    type="text"
                                    className="input-field py-1 px-3 text-sm w-48"
                                    placeholder="Paste image URL..."
                                    value={newImageUrl}
                                    onChange={e => setNewImageUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddImageUrl()}
                                />
                                <button className="btn btn-primary text-sm py-1 px-2" onClick={handleAddImageUrl}>Add URL</button>

                                <input
                                    type="file"
                                    id="image_upload"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                                <label
                                    htmlFor="image_upload"
                                    className="btn btn-secondary cursor-pointer"
                                >
                                    <Upload size={16} /> Upload Images
                                </label>

                                {slides.length > 0 && (
                                    <button
                                        className="btn btn-secondary text-sm py-1 px-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={handleClearProgress}
                                    >
                                        Clear Progress
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Drag and drop zone wrapping the grid */}
                        <div
                            className={`min-h-[200px] border-2 border-dashed rounded-lg p-4 transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-700'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            {slides.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-8 pointer-events-none">
                                    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-8 max-w-md text-center border border-gray-100 dark:border-gray-700">
                                        <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4">
                                            <PlayCircle size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Create Your First Video</h3>
                                        <p className="text-sm text-gray-500 mb-6">Drag and drop images anywhere in this zone to instantly build your timeline.</p>

                                        <div className="space-y-4 text-left">
                                            <div className="flex items-start gap-3">
                                                <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5"><Upload size={16} /></div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">1. Add Visuals</h4>
                                                    <p className="text-xs text-gray-500">Upload images or paste URLs to create slide cards.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5"><Type size={16} /></div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">2. Write the Script</h4>
                                                    <p className="text-xs text-gray-500">Type or paste your text narration. AI will speak it aloud.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded text-green-600 dark:text-green-400 mt-0.5"><LayoutGrid size={16} /></div>
                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">3. Build Timeline</h4>
                                                    <p className="text-xs text-gray-500">Add blank slides for text-only moments via the layout grids.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={isCompactMode ? "flex flex-col gap-2" : "grid grid-cols-2 md:grid-cols-4 gap-4"}>
                                    {slides.map((slide, index) => (
                                        <div
                                            key={slide.id}
                                            className={`relative group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 transition-all ${isCompactMode ? 'flex flex-row items-stretch h-24' : 'flex flex-col cursor-move'}`}
                                            draggable={!isCompactMode}
                                            onDragStart={(e) => { if (!isCompactMode) dragItem.current = index; }}
                                            onDragEnter={(e) => { if (!isCompactMode) dragOverItem.current = index; }}
                                            onDragEnd={isCompactMode ? undefined : handleSort}
                                            onDragOver={(e) => e.preventDefault()}
                                            // Handle drag & drop image replacement onto specific slide
                                            onDrop={(e) => handleSlideImageDrop(e, index)}
                                        >
                                            <div className={`${isCompactMode ? 'w-32 flex-shrink-0' : 'w-full h-32'} relative`}>
                                                <div className="absolute top-1 left-1 bg-black/70 border border-white/20 text-white font-mono text-xs font-bold px-2 py-1 rounded shadow-lg z-10">
                                                    #{index + 1}
                                                </div>
                                                <img
                                                    src={slide.image_url}
                                                    alt={`Slide ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <div className={`relative p-2 flex-grow flex flex-col ${isCompactMode ? 'justify-center border-l border-gray-200 dark:border-gray-700' : ''}`}>
                                                <textarea
                                                    placeholder={`Narration for slide #${index + 1}...`}
                                                    className={`w-full text-xs p-2 resize-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 ${isCompactMode ? 'h-full' : 'h-16'}`}
                                                    value={slide.narration}
                                                    onChange={(e) => updateNarration(index, e.target.value)}
                                                />
                                                <div className={`text-[10px] text-right mt-1 ${slide.narration.length > 300 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                    {slide.narration.length > 300 && <span className="mr-2 hidden md:inline">Warning: Long narration may clip.</span>}
                                                    {slide.narration.length} chars
                                                </div>
                                            </div>

                                            {/* Top Right Action Buttons (Stack in Compact Mode) */}
                                            <div className={`absolute ${isCompactMode ? 'right-2 top-2 bottom-2 flex flex-col justify-between' : 'top-1 right-1'} opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1`}>
                                                <button
                                                    onClick={() => duplicateSlide(index)}
                                                    className="bg-indigo-500/80 hover:bg-indigo-600 shadow text-white p-1.5 rounded-full"
                                                    title="Duplicate slide"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                                <button
                                                    onClick={() => removeSlide(index)}
                                                    className="bg-red-500/80 hover:bg-red-600 shadow text-white p-1.5 rounded-full"
                                                    title="Remove slide"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            {/* Bottom Left Move Arrows (Only in Expanded Mode for now) */}
                                            {!isCompactMode && index > 0 && (
                                                <button
                                                    onClick={() => moveSlide(index, 'left')}
                                                    className="absolute bottom-20 left-1 bg-black/60 shadow hover:bg-black/90 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    title="Move left"
                                                >
                                                    <ArrowLeft size={14} />
                                                </button>
                                            )}
                                            {!isCompactMode && index < slides.length - 1 && (
                                                <button
                                                    onClick={() => moveSlide(index, 'right')}
                                                    className="absolute bottom-20 left-8 bg-black/60 shadow hover:bg-black/90 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    title="Move right"
                                                >
                                                    <ArrowRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {/* Add Blank Slide Card */}
                                    <button
                                        className={`group border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${isCompactMode ? 'h-24' : 'h-full min-h-[160px]'}`}
                                        onClick={() => {
                                            setSlides([...slides, {
                                                id: Math.random().toString(36).substr(2, 9),
                                                image_path: 'blank', // Special flag for backend
                                                image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // 1x1 transparent px
                                                narration: ''
                                            }])
                                        }}
                                    >
                                        <Plus size={isCompactMode ? 24 : 32} className="mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="font-medium text-sm">Add Blank Slide</span>
                                    </button>

                                    <div ref={slidesEndRef} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bulk Script Parser */}
                    <div className="card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><FileText size={20} /> Bulk Script Parser</h3>
                            {bulkScript.trim() && (
                                <button className="text-gray-400 hover:text-red-500 transition-colors" onClick={() => setBulkScript('')} title="Clear Script">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                            Paste your script here. Preface each slide's narration with its number.
                            <br />Example: <code>[1] This is the first slide. [2] And the second.</code>
                        </p>
                        <textarea
                            className="input-field min-h-[120px] font-mono text-sm"
                            placeholder="[1] Welcome to the video!&#10;[2] Here is the next point..."
                            value={bulkScript}
                            onChange={(e) => setBulkScript(e.target.value)}
                        />
                        <div className="flex justify-end mt-3">
                            <button
                                className="btn btn-secondary"
                                onClick={handleApplyScript}
                                disabled={!bulkScript.trim() || slides.length === 0}
                            >
                                Apply to Slides
                            </button>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                            Or use an external <strong>Google Sheet</strong> with 2 columns: Image Number and Narration, and export it as CSV to paste above.
                        </div>
                    </div>

                    {/* Result Area */}
                    {jobStatus && (
                        <div className="card p-6 border-l-4 border-indigo-500">
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                Generation Status: <span className="capitalize">{jobStatus.status}</span>
                            </h3>
                            {jobStatus.status === 'processing' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-500">
                                        <RefreshCw size={16} className="animate-spin" /> Generating video...
                                    </div>
                                    {jobStatus.progress !== undefined && (
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${jobStatus.progress}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {jobStatus.status === 'failed' && (
                                <p className="text-red-500">Error: {jobStatus.error}</p>
                            )}
                            {jobStatus.status === 'completed' && jobStatus.video_url && (
                                <div className="mt-4">
                                    <video controls className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 bg-black">
                                        <source src={jobStatus.video_url} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                    <div className="flex gap-2 flex-wrap">
                                        <a href={jobStatus.video_url} download className="btn btn-primary mt-4 inline-flex">
                                            Download Video
                                        </a>
                                        {jobStatus.srt_url && (
                                            <a href={jobStatus.srt_url} download className="btn btn-secondary mt-4 inline-flex">
                                                Download Subtitles (.srt)
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar Settings Panel */}
                <div className="space-y-6 lg:sticky lg:top-6 self-start">
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-700">FFmpeg Settings</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Resolution</label>
                                <select
                                    className="input-select bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                    value={settings.resolution}
                                    onChange={e => setSettings({ ...settings, resolution: e.target.value })}
                                >
                                    <option value="1920x1080">1080p Horizontal (1920x1080)</option>
                                    <option value="1080x1920">1080p Vertical (1080x1920)</option>
                                    <option value="1280x720">720p Horizontal (1280x720)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Framerate</label>
                                <select
                                    className="input-select bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                    value={settings.fps}
                                    onChange={e => setSettings({ ...settings, fps: Number(e.target.value) })}
                                >
                                    <option value={24}>24 fps</option>
                                    <option value={30}>30 fps</option>
                                    <option value={60}>60 fps</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Export Quality Preset</label>
                                <select
                                    className="input-select bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                    value={settings.quality}
                                    onChange={e => setSettings({ ...settings, quality: e.target.value })}
                                >
                                    <option value="Draft">Draft (Fast compilation, lower quality)</option>
                                    <option value="Standard">Standard (Balanced default)</option>
                                    <option value="High">High Quality (Slowest, best visual quality)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Intro Title Card (Optional)</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Large text over Slide 1..."
                                    value={settings.video_title}
                                    onChange={e => setSettings({ ...settings, video_title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Transition Effect</label>
                                <select
                                    className="input-select bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                    value={settings.transition}
                                    onChange={e => setSettings({ ...settings, transition: e.target.value })}
                                >
                                    <option value="None">None (Cut)</option>
                                    <option value="fade">Fade</option>
                                    <option value="wipeleft">Wipe Left</option>
                                    <option value="pixelize">Pixelize</option>
                                    <option value="dissolve">Dissolve</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Default Slide Duration ({settings.default_slide_duration}s)</label>
                                <input
                                    type="range"
                                    min="1.0"
                                    max="10.0"
                                    step="0.5"
                                    className="w-full"
                                    value={settings.default_slide_duration}
                                    onChange={e => setSettings({ ...settings, default_slide_duration: Number(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Applies only to slides without narration.</p>
                            </div>

                            {settings.transition !== 'None' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Transition Duration ({settings.transition_duration}s)</label>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="3.0"
                                        step="0.1"
                                        className="w-full"
                                        value={settings.transition_duration}
                                        onChange={e => setSettings({ ...settings, transition_duration: Number(e.target.value) })}
                                    />
                                </div>
                            )}

                            <div className="pt-4 border-t dark:border-gray-700">
                                <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input
                                        type="checkbox"
                                        checked={settings.burn_subtitles}
                                        onChange={e => setSettings({ ...settings, burn_subtitles: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium">Burn Subtitles into Video</span>
                                </label>

                                {settings.burn_subtitles && (
                                    <div className="pl-6 space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Subtitle Style</h4>
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="block text-xs mb-1">Background Alpha ({settings.captions.bg_opacity}%)</label>
                                                <input
                                                    type="range" min="0" max="100" step="5"
                                                    className="w-full h-1"
                                                    value={settings.captions.bg_opacity}
                                                    onChange={e => setSettings({ ...settings, captions: { ...settings.captions, bg_opacity: Number(e.target.value) } })}
                                                />
                                            </div>
                                            <div className="w-1/3">
                                                <label className="block text-xs mb-1">Color (Hex)</label>
                                                <input
                                                    type="text"
                                                    className="input-field py-1 px-2 text-xs font-mono"
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    value={settings.captions.bg_color}
                                                    onChange={e => setSettings({ ...settings, captions: { ...settings.captions, bg_color: e.target.value } })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-700 flex items-center gap-2"><Music size={18} /> Background Music</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Audio Source</label>
                                <select
                                    className="input-select bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                                    value={settings.bgm_source}
                                    onChange={e => setSettings({ ...settings, bgm_source: e.target.value as any })}
                                >
                                    <option value="none">No Background Music</option>
                                    <option value="file">Upload Audio File</option>
                                    <option value="ai">AI Generated (MusicGen)</option>
                                </select>
                            </div>

                            {settings.bgm_source === 'file' && (
                                <div>
                                    <input
                                        type="file"
                                        accept="audio/*"
                                        onChange={handleBgmUpload}
                                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                    />
                                    {settings.bgm_path_or_prompt && <p className="text-xs text-green-500 mt-1">Audio loaded.</p>}
                                </div>
                            )}

                            {settings.bgm_source === 'ai' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">AI Prompt</label>
                                    <textarea
                                        className="input-field min-h-[80px]"
                                        placeholder="e.g. upbeat electronic synthwave track with a strong bassline..."
                                        value={settings.bgm_path_or_prompt}
                                        onChange={e => setSettings({ ...settings, bgm_path_or_prompt: e.target.value })}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Uses a free HF inference endpoint. May take up to 20s to load on first request.</p>
                                    <div className="flex gap-2 mt-3 items-center flex-wrap">
                                        <button
                                            type="button"
                                            className="btn btn-secondary text-sm py-1 px-3 flex items-center gap-1"
                                            onClick={handleGenerateMusic}
                                            disabled={isGeneratingMusic || !settings.bgm_path_or_prompt}
                                        >
                                            {isGeneratingMusic ? <RefreshCw className="animate-spin" size={14} /> : <Music size={14} />}
                                            Generate & Preview
                                        </button>
                                        {generatedMusicUrl && (
                                            <audio controls src={generatedMusicUrl} className="h-8 max-w-[200px]" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {settings.bgm_source !== 'none' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Volume ({(settings.bgm_volume * 100).toFixed(0)}%)</label>
                                        <input
                                            type="range"
                                            min="0.0"
                                            max="1.0"
                                            step="0.05"
                                            className="w-full"
                                            value={settings.bgm_volume}
                                            onChange={e => setSettings({ ...settings, bgm_volume: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Start Offset ({settings.bgm_start_time}s)</label>
                                        <input
                                            type="range"
                                            min="0.0"
                                            max="10.0"
                                            step="0.5"
                                            className="w-full"
                                            value={settings.bgm_start_time}
                                            onChange={e => setSettings({ ...settings, bgm_start_time: Number(e.target.value) })}
                                        />
                                        <div className="h-8 w-full bg-indigo-100 dark:bg-indigo-900/30 rounded mt-1 flex relative overflow-hidden">
                                            {/* Mock waveform visualizer */}
                                            <div className="absolute top-0 bottom-0 left-0 bg-indigo-300 dark:bg-indigo-600 opacity-50 transition-all" style={{ width: `${(settings.bgm_start_time / 10.0) * 100}%` }}></div>
                                            {Array.from({ length: 40 }).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-white/20 dark:border-black/20" style={{ height: `${20 + Math.random() * 80}%`, marginTop: 'auto' }}></div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settings.bgm_fade}
                                                onChange={e => setSettings({ ...settings, bgm_fade: e.target.checked })}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Fade In/Out (2 seconds)</span>
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 p-4 rounded-lg flex justify-between items-center font-medium">
                        <span>Total Slides: {slides.length}</span>
                        <span>Est. Duration: ~{calculateEstimatedDuration()}</span>
                    </div>

                    <button
                        className="btn btn-primary w-full py-3 text-base flex justify-center items-center gap-2"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <PlayCircle size={20} />}
                        {isGenerating ? 'Generating Video...' : 'Generate Long Form Video'}
                    </button>
                </div>
            </div >
        </div >
    );
}
