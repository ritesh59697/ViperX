import asyncio
import os
import subprocess
import edge_tts
from PIL import Image, ImageDraw, ImageFont

VIDEO_PATH = "/Users/ritesh/Downloads/viperxdemo for x-layer.mp4"
OUTPUT_CAPTIONED_VIDEO_PATH = "/Users/ritesh/Downloads/ViperX_OKX_Dev_Day_Demo_Synced.mp4"
OUTPUT_CLEAN_VIDEO_PATH = "/Users/ritesh/Downloads/ViperX_OKX_Dev_Day_Demo_Clean.mp4"

REPO_AUDIO_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_demo_voiceover_synced.mp3"
REPO_NARRATION_PATH = "/Users/ritesh/Projects/viperx/demo/narration.txt"
REPO_SRT_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_demo_subtitles.srt"
REPO_VTT_PATH = "/Users/ritesh/Projects/viperx/demo/viperx_demo_subtitles.vtt"

TOTAL_DURATION_SEC = 149.35

segments = [
    {
        "id": 1,
        "start": 0.8,
        "text": "Welcome to ViperX — the verified execution and proof layer for autonomous AI trading agents on OKX X Layer. ViperX indexes and ranks trading models strictly from closed, settled on-chain fills."
    },
    {
        "id": 2,
        "start": 15.5,
        "text": "Here in the trading terminal on OKX X Layer, we have real-time Pyth oracle feeds. Looking at ETH-PERP with live orderbooks, we can configure our trade and delegate to an autonomous strategy with automated TP/SL targets."
    },
    {
        "id": 3,
        "start": 34.0,
        "text": "Clicking Delegate & Buy signs the transaction in our Web3 wallet. Capital remains completely non-custodial inside ViperVault — the agent executes trades, while withdrawal authority stays with the owner."
    },
    {
        "id": 4,
        "start": 50.0,
        "text": "Our position confirms on OKX X Layer in seconds thanks to its rapid finality and sub-cent fees. Notice the live position overlay rendered on the chart, tracking real-time unrealized PnL, liquidation price, and margin health."
    },
    {
        "id": 5,
        "start": 72.0,
        "text": "We can close the position at market anytime. The trade settles atomically against ViperVault on-chain, recording the fill hash. Now, let's head over to the Leaderboard to see how performance is verified."
    },
    {
        "id": 6,
        "start": 87.5,
        "text": "On the ViperX Leaderboard, agents aren't ranked by screenshots. They must clear at least 50 verified on-chain fills. Rankings factor in Sharpe ratio, drawdown penalties, and anti-wash-trading heuristics."
    },
    {
        "id": 7,
        "start": 104.0,
        "text": "Through our public Agent Discovery manifest and Model Context Protocol endpoints, external AI agents in the OKX ecosystem can discover top strategies and execute perp orders programmatically."
    },
    {
        "id": 8,
        "start": 117.5,
        "text": "With a responsive dark and light interface, complete Pyth oracle integration, and deep liquidity seeded on OKX X Layer, ViperX provides the decentralized trust layer for autonomous quant finance. Built for OKX Dev Day 2026. Thank you for watching!"
    }
]

# Finely tuned sentence-level caption cues for natural reading speed
cues = [
    {
        "start": 0.85,
        "end": 8.43,
        "text": "Welcome to ViperX — the verified execution and proof layer\nfor autonomous AI trading agents on OKX X Layer."
    },
    {
        "start": 8.43,
        "end": 14.20,
        "text": "ViperX indexes and ranks trading models\nstrictly from closed, settled on-chain fills."
    },
    {
        "start": 15.55,
        "end": 21.11,
        "text": "Here in the trading terminal on OKX X Layer,\nwe have real-time Pyth oracle feeds."
    },
    {
        "start": 21.11,
        "end": 30.56,
        "text": "Looking at ETH-PERP with live orderbooks, we can configure our trade\nand delegate to an autonomous strategy with automated TP/SL targets."
    },
    {
        "start": 34.05,
        "end": 38.22,
        "text": "Clicking Delegate & Buy signs the transaction in our Web3 wallet."
    },
    {
        "start": 38.22,
        "end": 46.66,
        "text": "Capital remains completely non-custodial inside ViperVault —\nthe agent executes trades, while withdrawal authority stays with the owner."
    },
    {
        "start": 50.05,
        "end": 56.30,
        "text": "Our position confirms on OKX X Layer in seconds\nthanks to its rapid finality and sub-cent fees."
    },
    {
        "start": 56.30,
        "end": 64.60,
        "text": "Notice the live position overlay rendered on the chart,\ntracking real-time unrealized PnL, liquidation price, and margin health."
    },
    {
        "start": 72.05,
        "end": 74.38,
        "text": "We can close the position at market anytime."
    },
    {
        "start": 74.38,
        "end": 79.40,
        "text": "The trade settles atomically against ViperVault on-chain,\nrecording the fill hash."
    },
    {
        "start": 79.40,
        "end": 83.60,
        "text": "Now, let's head over to the Leaderboard\nto see how performance is verified."
    },
    {
        "start": 87.55,
        "end": 91.54,
        "text": "On the ViperX Leaderboard,\nagents aren't ranked by screenshots."
    },
    {
        "start": 91.54,
        "end": 94.75,
        "text": "They must clear at least 50 verified on-chain fills."
    },
    {
        "start": 94.75,
        "end": 100.30,
        "text": "Rankings factor in Sharpe ratio, drawdown penalties,\nand anti-wash-trading heuristics."
    },
    {
        "start": 104.05,
        "end": 109.80,
        "text": "Through our public Agent Discovery manifest\nand Model Context Protocol endpoints,"
    },
    {
        "start": 109.80,
        "end": 116.09,
        "text": "external AI agents in the OKX ecosystem can discover top\nstrategies and execute perp orders programmatically."
    },
    {
        "start": 117.55,
        "end": 124.50,
        "text": "With a responsive dark and light interface, complete Pyth oracle\nintegration, and deep liquidity seeded on OKX X Layer,"
    },
    {
        "start": 124.50,
        "end": 130.79,
        "text": "ViperX provides the decentralized trust layer\nfor autonomous quant finance."
    },
    {
        "start": 130.79,
        "end": 134.99,
        "text": "Built for OKX Dev Day 2026. Thank you for watching!"
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
    font = ImageFont.truetype(font_path, 48)
    lines = text.split("\n")
    
    dummy = Image.new("RGBA", (1, 1))
    draw = ImageDraw.Draw(dummy)
    boxes = [draw.textbbox((0, 0), l, font=font) for l in lines]
    widths = [b[2] - b[0] for b in boxes]
    heights = [b[3] - b[1] for b in boxes]
    max_w = max(widths)
    line_sp = 14
    total_h = sum(heights) + (len(lines) - 1) * line_sp
    pad_x, pad_y = 52, 24
    bw = max_w + pad_x * 2
    bh = total_h + pad_y * 2
    
    card = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    # Glassmorphic rounded pill container with dark translucent backdrop and subtle border
    cd.rounded_rectangle(
        [(0, 0), (bw - 1, bh - 1)],
        radius=26,
        fill=(10, 14, 23, 235),
        outline=(255, 255, 255, 45),
        width=2
    )
    cy = pad_y
    for i, l in enumerate(lines):
        lx = (bw - widths[i]) // 2
        # Text shadow for maximum legibility against any background
        cd.text((lx + 2, cy + 3), l, font=font, fill=(0, 0, 0, 220))
        # High contrast white text
        cd.text((lx, cy), l, font=font, fill=(255, 255, 255, 255))
        cy += heights[i] + line_sp
        
    card.save(out_path)

async def main():
    temp_dir = "/tmp/viperx_demo_pipeline"
    os.makedirs(temp_dir, exist_ok=True)
    
    print("=== Step 1: Synthesizing Voiceover Segments with Edge TTS ===")
    voice = "en-US-AndrewNeural"
    seg_audio_data = []
    
    for seg in segments:
        out_file = os.path.join(temp_dir, f"seg_{seg['id']}.mp3")
        communicate = edge_tts.Communicate(seg["text"], voice, rate="+4%")
        await communicate.save(out_file)
        
        res = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", out_file
        ], capture_output=True, text=True)
        dur = float(res.stdout.strip())
        seg_audio_data.append({
            "id": seg["id"],
            "file": out_file,
            "start": seg["start"],
            "dur": dur,
            "end": seg["start"] + dur,
            "text": seg["text"]
        })
        print(f"Generated Segment {seg['id']}: {seg['start']:.1f}s -> {seg['start']+dur:.1f}s")
        
    print("\n=== Step 2: Generating Subtitles (SRT & VTT) with Microsecond Precision ===")
    srt_lines = []
    vtt_lines = ["WEBVTT\n"]
    full_narration_paragraphs = []
    
    for i, c in enumerate(cues):
        clean_text = c["text"].replace("\n", " ")
        full_narration_paragraphs.append(f"[{format_timestamp_srt(c['start'])} - {format_timestamp_srt(c['end'])}]\n{clean_text}")
        
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
        f.write("\n\n".join(full_narration_paragraphs) + "\n")
    print(f"Saved: {REPO_NARRATION_PATH}")
    
    print("\n=== Step 3: Mixing Audio Track with FFmpeg ===")
    ffmpeg_inputs = [
        "-f", "lavfi",
        "-i", f"anullsrc=r=48000:cl=stereo:d={TOTAL_DURATION_SEC}"
    ]
    filter_parts = []
    mix_inputs = ["[0:a]"]
    
    for i, s in enumerate(seg_audio_data):
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
    
    mp3_cmd = [
        "ffmpeg", "-y",
        "-i", voice_track_wav,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        REPO_AUDIO_PATH
    ]
    subprocess.run(mp3_cmd, check=True)
    print(f"Exported repo synced MP3: {REPO_AUDIO_PATH}")
    
    print("\n=== Step 4: Rendering Stylized Glassmorphic Caption Cards ===")
    caption_images = []
    for i, c in enumerate(cues):
        card_file = os.path.join(temp_dir, f"caption_{i:02d}.png")
        generate_caption_card(c["text"], card_file)
        caption_images.append((card_file, c["start"], c["end"]))
    print(f"Rendered {len(caption_images)} caption overlay assets.")
    
    print("\n=== Step 5: Building Clean Video (with synced audio & embedded CC) ===")
    clean_cmd = [
        "ffmpeg", "-y",
        "-i", VIDEO_PATH,
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
    print(f"Clean video saved: {OUTPUT_CLEAN_VIDEO_PATH}")
    
    print("\n=== Step 6: Burning in Captions with Apple Silicon Hardware Acceleration ===")
    overlay_inputs = ["-i", VIDEO_PATH]
    overlay_filter_parts = []
    
    for i, (card_file, start, end) in enumerate(caption_images):
        overlay_inputs.extend(["-i", card_file])
        input_idx = i + 1
        prev_node = f"[v{i}]" if i > 0 else "[0:v]"
        out_node = f"[v{i+1}]" if i < len(caption_images) - 1 else "[vcaptioned]"
        overlay_filter_parts.append(
            f"{prev_node}[{input_idx}:v]overlay=x=(W-w)/2:y=H-h-100:enable='between(t,{start:.2f},{end:.2f})'{out_node}"
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
    
    print("Running hardware-accelerated caption burn-in encoding...")
    subprocess.run(captioned_cmd, check=True)
    
    print(f"\n=======================================================")
    print(f"SUCCESS!")
    print(f"1. Captioned Video (Burned-in + CC + Synced Audio):")
    print(f"   {OUTPUT_CAPTIONED_VIDEO_PATH}")
    print(f"2. Clean Video (Synced Audio + Embedded CC Track):")
    print(f"   {OUTPUT_CLEAN_VIDEO_PATH}")
    print(f"=======================================================\n")

if __name__ == "__main__":
    asyncio.run(main())
