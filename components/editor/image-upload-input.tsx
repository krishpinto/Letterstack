"use client";

import { useRef, useState } from "react";
import { Loader2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUploadThing } from "@/lib/upload/client";

// Emails stay light: anything wider than this gets scaled down before upload.
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.85;

/**
 * Shrink oversized raster images on the client so a raw Photoshop export
 * doesn't ship 8MB into a newsletter. GIFs and SVGs pass through untouched
 * (canvas would flatten animation / rasterize vectors).
 */
async function resizeForEmail(file: File): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= MAX_WIDTH) {
      bitmap.close();
      return file;
    }

    const scale = MAX_WIDTH / bitmap.width;
    const canvas = document.createElement("canvas");
    canvas.width = MAX_WIDTH;
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // PNGs keep transparency; everything else re-encodes as JPEG.
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, outType === "image/jpeg" ? JPEG_QUALITY : undefined),
    );
    if (!blob) return file;

    const ext = outType === "image/png" ? "png" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.${ext}`, { type: outType });
  } catch {
    return file;
  }
}

type ImageUploadInputProps = {
  id?: string;
  value: string;
  placeholder?: string;
  onChange: (url: string) => void;
};

/**
 * URL input with an upload button: pick a file (or paste a URL as before),
 * the file goes to UploadThing's CDN, and the public URL lands in the field.
 */
export function ImageUploadInput({
  id,
  value,
  placeholder,
  onChange,
}: ImageUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("emailImage", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl;
      if (url) onChange(url);
    },
    onUploadError: (e) => {
      setError(e.message || "Upload failed. Try again.");
    },
  });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    const prepared = await resizeForEmail(file);
    await startUpload([prepared]);
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex gap-1.5">
        <Input
          id={id}
          value={value}
          placeholder={placeholder ?? "https://... or upload"}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload image"
        >
          {isUploading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
