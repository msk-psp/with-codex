"use client";

import { useMemo, useState } from "react";
import { evaluateMetrics, type BorderIssue, type CardMetrics, type GradeResult } from "@/lib/grading";

type LoadedCard = {
  id: string;
  file: File;
  url: string;
  metrics: CardMetrics;
  result: GradeResult;
};

const MAX_SIZE = 15 * 1024 * 1024;

function avgCornerColor(data: Uint8ClampedArray, width: number, height: number) {
  const sampleSize = Math.max(20, Math.floor(Math.min(width, height) * 0.08));
  const points: Array<[number, number]> = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize]
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const [sx, sy] of points) {
    for (let y = sy; y < sy + sampleSize; y += 2) {
      for (let x = sx; x < sx + sampleSize; x += 2) {
        const idx = (y * width + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        count += 1;
      }
    }
  }

  return { r: r / count, g: g / count, b: b / count };
}

function luminance(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function detectCardBounds(data: Uint8ClampedArray, width: number, height: number) {
  const bg = avgCornerColor(data, width, height);
  const threshold = 28;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let pixels = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(data[idx] - bg.r);
      const dg = Math.abs(data[idx + 1] - bg.g);
      const db = Math.abs(data[idx + 2] - bg.b);
      if (dr + dg + db > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        pixels += 1;
      }
    }
  }

  if (pixels < 1500) {
    return { minX: 0, minY: 0, maxX: width, maxY: height, coverage: 0.2, aspect: width / height };
  }

  const cardW = Math.max(1, maxX - minX);
  const cardH = Math.max(1, maxY - minY);
  const coverage = (cardW * cardH) / (width * height);
  return { minX, minY, maxX, maxY, coverage, aspect: cardW / cardH };
}

function borderIssuesFromBounds(data: Uint8ClampedArray, width: number, bounds: ReturnType<typeof detectCardBounds>): BorderIssue[] {
  const sampleThickness = 6;
  const { minX, minY, maxX, maxY } = bounds;

  const ranges = {
    top: { x1: minX, y1: minY, x2: maxX, y2: minY + sampleThickness },
    right: { x1: maxX - sampleThickness, y1: minY, x2: maxX, y2: maxY },
    bottom: { x1: minX, y1: maxY - sampleThickness, x2: maxX, y2: maxY },
    left: { x1: minX, y1: minY, x2: minX + sampleThickness, y2: maxY }
  } as const;

  return (Object.keys(ranges) as Array<keyof typeof ranges>).flatMap((side) => {
    const zone = ranges[side];
    let bright = 0;
    let dark = 0;
    let total = 0;

    for (let y = zone.y1; y < zone.y2; y += 2) {
      for (let x = zone.x1; x < zone.x2; x += 2) {
        const idx = (y * width + x) * 4;
        const lum = luminance(data[idx], data[idx + 1], data[idx + 2]);
        if (lum > 0.8) bright += 1;
        if (lum < 0.12) dark += 1;
        total += 1;
      }
    }

    const brightRatio = bright / total;
    const darkRatio = dark / total;
    const issues: BorderIssue[] = [];

    if (brightRatio > 0.16) {
      issues.push({ side, severity: Number((brightRatio * 2.5).toFixed(2)), kind: "whitening" });
    }
    if (darkRatio > 0.14) {
      issues.push({ side, severity: Number((darkRatio * 2).toFixed(2)), kind: "dark-wear" });
    }

    return issues;
  });
}

async function getImageMetrics(file: File): Promise<CardMetrics> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(900, bitmap.width);
  canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      width: bitmap.width,
      height: bitmap.height,
      sizeBytes: file.size,
      brightness: 0.5,
      blurScore: 0.5,
      glareScore: 0.03,
      cardCoverage: 0.2,
      cardAspect: bitmap.width / bitmap.height,
      borderIssues: []
    };
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const bounds = detectCardBounds(pixels, canvas.width, canvas.height);
  const borderIssues = borderIssuesFromBounds(pixels, canvas.width, bounds);

  let brightnessTotal = 0;
  let brightPixels = 0;
  let edgeTotal = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const lum = luminance(pixels[i], pixels[i + 1], pixels[i + 2]);
    brightnessTotal += lum;
    if (lum > 0.92) brightPixels += 1;

    if (i > 4) {
      const prevLum = luminance(pixels[i - 4], pixels[i - 3], pixels[i - 2]);
      edgeTotal += Math.abs(lum - prevLum);
    }
  }

  const totalPixels = pixels.length / 4;
  const brightness = brightnessTotal / totalPixels;
  const glareScore = brightPixels / totalPixels;
  const blurScore = Math.max(0, 1 - (edgeTotal / totalPixels) * 3.2);

  return {
    width: bitmap.width,
    height: bitmap.height,
    sizeBytes: file.size,
    brightness,
    blurScore,
    glareScore,
    cardCoverage: bounds.coverage,
    cardAspect: bounds.aspect,
    borderIssues
  };
}

export default function HomePage() {
  const [cards, setCards] = useState<LoadedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const averageBand = useMemo(() => {
    if (cards.length === 0) return null;
    const map = { "10": 10, "9": 9, "8": 8, "7 or below": 7 } as const;
    const avg = cards.reduce((sum, card) => sum + map[card.result.overallBand], 0) / cards.length;
    return avg >= 9.5 ? "10" : avg >= 8.8 ? "9" : avg >= 7.8 ? "8" : "7 or below";
  }, [cards]);

  async function onFrontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const oversized = files.find((f) => f.size > MAX_SIZE);
      if (oversized) {
        setError(`File ${oversized.name} exceeds 15 MB limit.`);
        return;
      }

      const graded = await Promise.all(
        files.map(async (file) => {
          const metrics = await getImageMetrics(file);
          const result = evaluateMetrics(metrics, false);
          return {
            id: crypto.randomUUID().slice(0, 8),
            file,
            url: URL.createObjectURL(file),
            metrics,
            result
          } satisfies LoadedCard;
        })
      );

      setCards(graded);
    } catch {
      setError("Analysis failed. Try clearer photos with less glare.");
    } finally {
      setLoading(false);
    }
  }

  function copySummary() {
    if (cards.length === 0) return;
    const summary = cards
      .map((card) => `${card.file.name}: ${card.result.overallBand} (${card.result.confidence}) - ${card.result.recommendation}`)
      .join("\n");

    navigator.clipboard.writeText(summary).catch(() => {});
    alert("Batch summary copied to clipboard.");
  }

  return (
    <main>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1>PokéGrade MVP</h1>
        <p className="small" style={{ marginTop: "0.5rem" }}>
          Upload one or more Pokémon card photos to get non-official pre-grade estimates.
        </p>
      </div>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <h2>Upload test images</h2>
        <p className="small">You can upload the two sample photos you shared to compare grades side-by-side.</p>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onFrontUpload} />
        <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <button onClick={copySummary} disabled={cards.length === 0}>Copy grade summary</button>
          {averageBand && <span className="badge medium">Batch average band: {averageBand}</span>}
        </div>
        {error && <p style={{ color: "#b91c1c", fontWeight: 600 }}>{error}</p>}
      </section>

      {loading ? (
        <section className="card"><p>Analyzing images...</p></section>
      ) : (
        <div className="grid cards-grid">
          {cards.map((card) => (
            <article key={card.id} className="card">
              <h3>{card.file.name}</h3>
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
                <div className="preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.url} alt={card.file.name} />
                  {card.result.defects.map((d) => (
                    <div
                      key={`${d.label}-${d.x}-${d.y}`}
                      className="defect"
                      style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%` }}
                      title={d.label}
                    />
                  ))}
                </div>
                <div style={{ minWidth: 220 }}>
                  <p><strong>Overall band:</strong> {card.result.overallBand}</p>
                  <p>
                    <strong>Confidence:</strong>{" "}
                    <span className={`badge ${card.result.confidence.toLowerCase()}`}>{card.result.confidence}</span>
                  </p>
                  <p><strong>Recommendation:</strong> {card.result.recommendation}</p>
                  <div className="grid two" style={{ marginTop: "0.5rem" }}>
                    {Object.entries(card.result.subscores).map(([k, v]) => (
                      <div key={k} className="score-box">
                        <strong style={{ textTransform: "capitalize" }}>{k}</strong>
                        <div>{v}/10</div>
                      </div>
                    ))}
                  </div>
                  {card.result.qualityWarnings.length > 0 && (
                    <ul>
                      {card.result.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="small" style={{ marginTop: "1rem" }}>
        Disclaimer: This is a pre-grade estimate and not official third-party certification.
      </p>
    </main>
  );
}
