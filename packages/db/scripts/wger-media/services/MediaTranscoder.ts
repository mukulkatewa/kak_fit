import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TranscodeResult = {
  bytes: Buffer;
  mimeType: string;
  fileSize: number;
  transcoded: boolean;
};

function maxVideoBytes(): number {
  return Number(process.env.WGER_VIDEO_TRANSCODE_MAX_BYTES ?? "45000000");
}

function timeoutMs(): number {
  return Number(process.env.WGER_VIDEO_TRANSCODE_TIMEOUT_MS ?? "180000");
}

export async function maybeTranscodeVideo(bytes: Buffer, mimeType: string | null): Promise<TranscodeResult> {
  if (bytes.length <= maxVideoBytes()) {
    return { bytes, mimeType: mimeType ?? "video/quicktime", fileSize: bytes.length, transcoded: false };
  }

  const dir = await mkdtemp(join(tmpdir(), "kak-fit-wger-video-"));
  const input = join(dir, "input.mov");
  const output = join(dir, "output.mp4");

  try {
    await writeFile(input, bytes);
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-vf",
        "scale='min(720,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-movflags",
        "+faststart",
        "-an",
        output,
      ],
      { timeout: timeoutMs(), maxBuffer: 1024 * 1024 },
    );
    const transcoded = await readFile(output);
    if (transcoded.length === 0) throw new Error("Transcoded video was empty");
    if (transcoded.length >= bytes.length) {
      return { bytes, mimeType: mimeType ?? "video/quicktime", fileSize: bytes.length, transcoded: false };
    }
    return { bytes: transcoded, mimeType: "video/mp4", fileSize: transcoded.length, transcoded: true };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
