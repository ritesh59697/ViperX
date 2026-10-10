import asyncio
import os
import subprocess
import edge_tts
from PIL import Image, ImageDraw, ImageFont

VIDEO_INPUT_PATH = "/Users/ritesh/Downloads/export-1791609710828.mp4"
OUTPUT_CAPTIONED_VIDEO_PATH = "/Users/ritesh/Downloads/ViperX_XLayer_Demo_Captioned.mp4"
OUTPUT_CLEAN_VIDEO_PATH = "/Users/ritesh/Downloads/ViperX_XLayer_Demo_Clean.mp4"
OUTPUT_SYNCED_COPY_PATH = "/Users/ritesh/Downloads/ViperX_XLayer_Demo_Synced.mp4"

REPO_AUDIO_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_xlayer_voiceover.mp3"
REPO_NARRATION_PATH = "/Users/ritesh/Projects/viperx/demo/narration_xlayer.txt"
REPO_SRT_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_xlayer_subtitles.srt"
REPO_VTT_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_xlayer_subtitles.vtt"

TOTAL_DURATION_SEC = 52.833

# 8 micro-timed narration cues perfectly mapped to the visual actions in the 52.8s video
RAW_CUES = [
    {
        "id": "1A",
        "fixed_start": 1.00,
        "pause_after": 0.30,
        "card_text": "Welcome to ViperX — the verified execution layer\nfor autonomous AI trading agents on OKX X Layer.",
        "tts_text": "Welcome to ViperX — the verified execution layer for autonomous AI trading agents on OKX X Layer."
    },
    {
        "id": "1B",
        "fixed_start": None,
        "pause_after": 0.00,
        "card_text": "Trading models are ranked strictly\nfrom settled on-chain fills, eliminating fake screenshots.",
        "tts_text": "Trading models are ranked strictly from settled on-chain fills, eliminating fake screenshots."
    },
    {
        "id": "2A",
        "fixed_start": 15.20,
        "pause_after": 0.30,
        "card_text": "In the trading terminal on OKX X Layer,\nwe stream real-time Pyth oracle feeds.",
        "tts_text": "In the trading terminal on OKX X Layer, we stream real-time Pyth oracle feeds."
    },
    {
        "id": "2B",
        "fixed_start": None,
        "pause_after": 0.00,
        "card_text": "Every position generates an on-chain cryptographic proof receipt\nwith OKLink explorer verification.",
        "tts_text": "Every position generates an on-chain cryptographic proof receipt with OKLink explorer verification."
    },
    {
        "id": "3A",
        "fixed_start": 28.00,
        "pause_after": 0.30,
        "card_text": "We configure our trade with automated take profit and stop loss\nfor disciplined risk management.",
        "tts_text": "We configure our trade with automated take profit and stop loss for disciplined risk management."
    },
    {
        "id": "3B",
        "fixed_start": None,
        "pause_after": 0.00,
        "card_text": "We delegate execution to Pyth Arbitrage Alpha,\nkeeping capital non-custodial inside ViperVault.",
        "tts_text": "We delegate execution to Pyth Arbitrage Alpha, keeping capital non-custodial inside ViperVault."
    },
    {
        "id": "4A",
        "fixed_start": 40.60,
        "pause_after": 0.30,
        "card_text": "Clicking Delegate validates execution policies\nand triggers our Web3 wallet.",
        "tts_text": "Clicking Delegate validates execution policies and triggers our Web3 wallet."
    },
    {
        "id": "4B",
        "fixed_start": None,
        "pause_after": 0.00,
        "card_text": "With sub-cent OKB gas fees, our AI agent\nexecutes trustlessly on OKX X Layer.",
        "tts_text": "With sub-cent OKB gas fees, our AI agent executes trustlessly on OKX X Layer."
    }
]

def format_timestamp_srt(seconds):
    millis = int((seconds - int(seconds)) * 1000)
    hours = int(seconds) // 3600
    minutes = (int(seconds) % 3600) // 60
    secs = int(seconds) % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def format_timestamp_vtt(seconds):
    millis = int((seconds - int(seconds)) * 1000)
    hours = int(seconds) // 3600
    minutes = (int(seconds) % 3600) // 60
    secs = int(seconds) % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

def generate_caption_card(text, out_path):
    font_path = "/System/Library/Fonts/SFNS.ttf"
    font = ImageFont.truetype(font_path, 62)
    lines = text.split("\n")
    
    dummy = Image.new("RGBA", (1, 1))
    draw = ImageDraw.Draw(dummy)
    boxes = [draw.textbbox((0, 0), l, font=font) for l in lines]
    widths = [b[2] - b[0] for b in boxes]
    heights = [b[3] - b[1] for b in boxes]
    max_w = max(widths)
    line_sp = 16
    total_h = sum(heights) + (len(lines) - 1) * line_sp
    pad_x, pad_y = 64, 28
    bw = max_w + pad_x * 2
    bh = total_h + pad_y * 2
    
    card = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    # Glassmorphic rounded pill container with dark translucent backdrop and subtle border
    cd.rounded_rectangle(
        [(0, 0), (bw - 1, bh - 1)],
        radius=32,
        fill=(10, 14, 23, 238),
        outline=(255, 255, 255, 50),
        width=2
    )
    cy = pad_y
    for i, l in enumerate(lines):
        lx = (bw - widths[i]) // 2
        # Drop shadow for maximum legibility
        cd.text((lx + 2, cy + 3), l, font=font, fill=(0, 0, 0, 220))
        # High contrast crisp white typography
        cd.text((lx, cy), l, font=font, fill=(255, 255, 255, 255))
        cy += heights[i] + line_sp
        
    card.save(out_path)

async def main():
    temp_dir = "/tmp/viperx_xlayer_demo_pipeline"
    os.makedirs(temp_dir, exist_ok=True)
    
    print("=== Step 1: Synthesizing Audio Cues with Edge TTS ===")
    voice = "en-US-AndrewNeural"
    scheduled_cues = []
    prev_end = 0.0
    
    for cue in RAW_CUES:
        cue_file = os.path.join(temp_dir, f"cue_{cue['id']}.mp3")
        communicate = edge_tts.Communicate(cue["tts_text"], voice, rate="+6%")
        await communicate.save(cue_file)
        
        res = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", cue_file
        ], capture_output=True, text=True)
        dur = float(res.stdout.strip())
        
        if cue["fixed_start"] is not None:
            start = cue["fixed_start"]
        else:
            start = prev_end + cue.get("pause_before", 0.30)
            
        end = start + dur
        prev_end = end
        
        scheduled_cues.append({
            "id": cue["id"],
            "file": cue_file,
            "start": start,
            "end": end,
            "dur": dur,
            "card_text": cue["card_text"],
            "tts_text": cue["tts_text"]
        })
        print(f"Cue {cue['id']:2s}: {start:5.2f}s -> {end:5.2f}s (dur: {dur:4.2f}s) | {cue['tts_text']}")
        
    print("\n=== Step 2: Generating Subtitles (SRT & VTT) & Narration Doc ===")
    srt_lines = []
    vtt_lines = ["WEBVTT\n"]
    narration_entries = []
    
    for i, c in enumerate(scheduled_cues):
        clean_text = c["card_text"].replace("\n", " ")
        narration_entries.append(f"[{format_timestamp_srt(c['start'])} --> {format_timestamp_srt(c['end'])}]\n{clean_text}")
        
        srt_lines.append(f"{i+1}")
        srt_lines.append(f"{format_timestamp_srt(c['start'])} --> {format_timestamp_srt(c['end'])}")
        srt_lines.append(clean_text + "\n")
        
        vtt_lines.append(f"{i+1}")
        vtt_lines.append(f"{format_timestamp_vtt(c['start'])} --> {format_timestamp_vtt(c['end'])}")
        vtt_lines.append(clean_text + "\n")
        
    with open(REPO_SRT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    print(f"Saved: {REPO_SRT_PATH}")
    
    with open(REPO_VTT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_lines))
    print(f"Saved: {REPO_VTT_PATH}")
    
    with open(REPO_NARRATION_PATH, "w", encoding="utf-8") as f:
        f.write("# ViperX OKX X Layer Demo Narration (52.8s)\n\n" + "\n\n".join(narration_entries) + "\n")
    print(f"Saved: {REPO_NARRATION_PATH}")
    
    print("\n=== Step 3: Mixing Master Audio Track with FFmpeg ===")
    ffmpeg_inputs = [
        "-f", "lavfi",
        "-i", f"anullsrc=r=48000:cl=stereo:d={TOTAL_DURATION_SEC}"
    ]
    filter_parts = []
    mix_inputs = ["[0:a]"]
    
    for i, s in enumerate(scheduled_cues):
        ffmpeg_inputs.extend(["-i", s["file"]])
        input_idx = i + 1
        delay_ms = int(round(s["start"] * 1000))
        filter_parts.append(f"[{input_idx}:a]aresample=48000,adelay=delays={delay_ms}:all=1[a{input_idx}]")
        mix_inputs.append(f"[a{input_idx}]")
        
    num_inputs = len(mix_inputs)
    filter_parts.append(f"{''.join(mix_inputs)}amix=inputs={num_inputs}:duration=first:dropout_transition=0:normalize=0[voice_out]")
    filter_complex_str = ";".join(filter_parts)
    
    voice_track_wav = os.path.join(temp_dir, "master_voice.wav")
    mix_cmd = [
        "ffmpeg", "-y",
        *ffmpeg_inputs,
        "-filter_complex", filter_complex_str,
        "-map", "[voice_out]",
        "-c:a", "pcm_s16le",
        voice_track_wav
    ]
    subprocess.run(mix_cmd, check=True)
    print(f"Exported master voice WAV: {voice_track_wav}")
    
    # Save MP3 version in repo
    subprocess.run([
        "ffmpeg", "-y",
        "-i", voice_track_wav,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        REPO_AUDIO_PATH
    ], check=True)
    print(f"Exported repo MP3: {REPO_AUDIO_PATH}")
    
    print("\n=== Step 4: Rendering Glassmorphic Subtitle Cards ===")
    caption_images = []
    for i, c in enumerate(scheduled_cues):
        card_file = os.path.join(temp_dir, f"caption_{i:02d}.png")
        generate_caption_card(c["card_text"], card_file)
        caption_images.append((card_file, c["start"], c["end"]))
    print(f"Rendered {len(caption_images)} high-resolution caption cards.")
    
    print("\n=== Step 5: Building Clean Synced Video (AAC Audio + Embedded CC Track) ===")
    clean_cmd = [
        "ffmpeg", "-y",
        "-i", VIDEO_INPUT_PATH,
        "-i", voice_track_wav,
        "-i", REPO_SRT_PATH,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng",
        "-metadata:s:s:0", "handler_name=English",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-map", "2:s:0",
        "-t", str(TOTAL_DURATION_SEC),
        OUTPUT_CLEAN_VIDEO_PATH
    ]
    subprocess.run(clean_cmd, check=True)
    print(f"Clean Video saved: {OUTPUT_CLEAN_VIDEO_PATH}")
    
    print("\n=== Step 6: Burning in Subtitles with Apple Silicon Videotoolbox ===")
    overlay_inputs = ["-i", VIDEO_INPUT_PATH]
    overlay_filter_parts = []
    
    for i, (card_file, start, end) in enumerate(caption_images):
        overlay_inputs.extend(["-i", card_file])
        input_idx = i + 1
        prev_node = f"[v{i}]" if i > 0 else "[0:v]"
        out_node = f"[v{i+1}]" if i < len(caption_images) - 1 else "[vcaptioned]"
        # Center horizontally, place 50px above bottom edge
        overlay_filter_parts.append(
            f"{prev_node}[{input_idx}:v]overlay=x=(W-w)/2:y=H-h-50:enable='between(t,{start:.2f},{end:.2f})'{out_node}"
        )
        
    full_overlay_filter = ";".join(overlay_filter_parts)
    
    captioned_cmd = [
        "ffmpeg", "-y",
        *overlay_inputs,
        "-i", voice_track_wav,
        "-i", REPO_SRT_PATH,
        "-filter_complex", full_overlay_filter,
        "-map", "[vcaptioned]",
        "-map", f"{len(caption_images) + 1}:a:0",
        "-map", f"{len(caption_images) + 2}:s:0",
        "-c:v", "h264_videotoolbox",
        "-b:v", "28M",
        "-c:a", "aac",
        "-b:a", "192k",
        "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng",
        "-metadata:s:s:0", "handler_name=English",
        "-t", str(TOTAL_DURATION_SEC),
        OUTPUT_CAPTIONED_VIDEO_PATH
    ]
    
    subprocess.run(captioned_cmd, check=True)
    print(f"Captioned Video saved: {OUTPUT_CAPTIONED_VIDEO_PATH}")
    
    # Also copy to ViperX_XLayer_Demo_Synced.mp4 for convenience
    subprocess.run(["cp", OUTPUT_CAPTIONED_VIDEO_PATH, OUTPUT_SYNCED_COPY_PATH], check=True)
    print(f"Synced Copy saved: {OUTPUT_SYNCED_COPY_PATH}")
    
    print("\n==========================================================================")
    print("SUCCESSFULLY GENERATED ALL DEMO ASSETS!")
    print(f"1. Final Captioned Video: {OUTPUT_CAPTIONED_VIDEO_PATH}")
    print(f"2. Synced Video Copy:    {OUTPUT_SYNCED_COPY_PATH}")
    print(f"3. Clean Video (Soft CC):{OUTPUT_CLEAN_VIDEO_PATH}")
    print(f"4. Synced Audio MP3:     {REPO_AUDIO_PATH}")
    print(f"5. Subtitles (SRT):      {REPO_SRT_PATH}")
    print(f"==========================================================================")

if __name__ == "__main__":
    asyncio.run(main())
