use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

const SILENCE_THRESHOLD: f32 = 0.01; // RMS < 0.01 ≈ -40dB
const WINDOW_MS: i64 = 50;           // janela de análise: 50ms
const MIN_SILENCE_WINDOWS: usize = 30; // 30 × 50ms = 1500ms mínimo

/// Analyzes leading and trailing silence in an audio file.
///
/// Returns `(content_start_ms, content_end_ms)`:
/// - `content_start_ms`: Some(ms) if there is at least 1500ms of silence at the start
/// - `content_end_ms`:   Some(ms) where content effectively ends (trailing silence of ≥1500ms)
/// - Returns `(None, None)` on any decode error or if silence thresholds are not met
pub fn analyze_silence(file_path: &str) -> (Option<i64>, Option<i64>) {
    match try_analyze(file_path) {
        Some(result) => result,
        None => (None, None),
    }
}

fn try_analyze(file_path: &str) -> Option<(Option<i64>, Option<i64>)> {
    use std::fs::File;

    let file = File::open(file_path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
    {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .ok()?;

    let mut format = probed.format;
    let track = format.default_track()?;
    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate? as i64;
    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .ok()?;

    let samples_per_window = (sample_rate * WINDOW_MS / 1000) as usize;
    let samples_per_window_interleaved = samples_per_window * channels;

    // Decode all packets and collect interleaved f32 samples
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(_) => break,
        };
        if packet.track_id() != track_id {
            continue;
        }
        let audio_buf = match decoder.decode(&packet) {
            Ok(buf) => buf,
            Err(_) => continue,
        };

        let spec = *audio_buf.spec();
        let capacity = audio_buf.capacity() as u64;
        let mut sample_buf = SampleBuffer::<f32>::new(capacity, spec);
        sample_buf.copy_interleaved_ref(audio_buf);
        all_samples.extend_from_slice(sample_buf.samples());
    }

    if all_samples.is_empty() {
        return Some((None, None));
    }

    let total_windows = all_samples.len() / samples_per_window_interleaved;
    if total_windows == 0 {
        return Some((None, None));
    }

    // Build a per-window silence flag (true = silent)
    let mut silent: Vec<bool> = Vec::with_capacity(total_windows);
    for w in 0..total_windows {
        let start = w * samples_per_window_interleaved;
        let end = (start + samples_per_window_interleaved).min(all_samples.len());
        let chunk = &all_samples[start..end];

        let sum_sq: f32 = chunk.iter().map(|&s| s * s).sum();
        let rms = (sum_sq / chunk.len() as f32).sqrt();
        silent.push(rms < SILENCE_THRESHOLD);
    }

    // Leading silence: how many consecutive silent windows from the start.
    // Always return Some(...) so callers can distinguish "analyzed" (Some) from "not analyzed" (None).
    let leading = silent.iter().take_while(|&&s| s).count();
    let content_start = if leading >= MIN_SILENCE_WINDOWS {
        Some(leading as i64 * WINDOW_MS)
    } else {
        Some(0) // analyzed, no significant leading silence
    };

    // Trailing silence: how many consecutive silent windows from the end
    let trailing = silent.iter().rev().take_while(|&&s| s).count();
    let content_end = if trailing >= MIN_SILENCE_WINDOWS {
        let end_window = total_windows - trailing;
        Some(end_window as i64 * WINDOW_MS)
    } else {
        None
    };

    Some((content_start, content_end))
}
