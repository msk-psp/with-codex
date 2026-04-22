export type BorderIssue = {
  side: "top" | "right" | "bottom" | "left";
  severity: number;
  kind: "whitening" | "dark-wear";
};

export type CardMetrics = {
  width: number;
  height: number;
  sizeBytes: number;
  brightness: number;
  blurScore: number;
  glareScore: number;
  cardCoverage: number;
  cardAspect: number;
  cardBox: { x: number; y: number; w: number; h: number };
  borderIssues: BorderIssue[];
};

export type GradeResult = {
  subscores: {
    centering: number;
    corners: number;
    edges: number;
    surface: number;
  };
  overallBand: "10" | "9" | "8" | "7 or below";
  confidence: "High" | "Medium" | "Low";
  recommendation: "Likely worth professional grading" | "Borderline" | "Not recommended";
  qualityWarnings: string[];
  defects: Array<{ x: number; y: number; w: number; h: number; label: string }>;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Number(value.toFixed(1))));
}

function issuePenalty(issues: BorderIssue[]) {
  return issues.reduce((acc, issue) => acc + issue.severity * (issue.kind === "whitening" ? 1.1 : 0.9), 0);
}

export function evaluateMetrics(front: CardMetrics, hasBackImage: boolean): GradeResult {
  const qualityWarnings: string[] = [];

  if (front.width < 900 || front.height < 1200) {
    qualityWarnings.push("Image resolution is low; use a closer shot for more reliable grading.");
  }
  if (front.blurScore > 0.55) qualityWarnings.push("Image seems blurry.");
  if (front.glareScore > 0.03) qualityWarnings.push("Strong glare detected on card surface.");
  if (front.cardCoverage < 0.26) qualityWarnings.push("Card is too small in frame. Fill at least 60% of photo height.");
  if (front.cardAspect < 0.66 || front.cardAspect > 0.75) qualityWarnings.push("Card appears skewed or perspective-distorted.");
  if (!hasBackImage) qualityWarnings.push("Back image missing; confidence reduced for edges/surface.");

  const borderPenalty = issuePenalty(front.borderIssues);

  const centeringPenalty = Math.abs(0.714 - front.cardAspect) * 30 + (front.cardCoverage < 0.32 ? 0.8 : 0);
  const centering = clampScore(9.7 - centeringPenalty);
  const corners = clampScore(9.2 - front.blurScore * 4.5 - borderPenalty * 0.45);
  const edges = clampScore(9.1 - borderPenalty * 0.7 - (hasBackImage ? 0 : 0.5));
  const surface = clampScore(9.4 - front.glareScore * 45 - front.blurScore * 2.2);

  const weighted = centering * 0.3 + corners * 0.25 + edges * 0.2 + surface * 0.25;
  const overallBand: GradeResult["overallBand"] = weighted >= 9.5 ? "10" : weighted >= 8.8 ? "9" : weighted >= 7.8 ? "8" : "7 or below";

  const confidence: GradeResult["confidence"] = qualityWarnings.length <= 1 ? "High" : qualityWarnings.length <= 3 ? "Medium" : "Low";

  const recommendation: GradeResult["recommendation"] =
    (overallBand === "10" || overallBand === "9") && confidence !== "Low"
      ? "Likely worth professional grading"
      : overallBand === "8"
      ? "Borderline"
      : "Not recommended";

  const defects = front.borderIssues.slice(0, 4).map((issue, idx) => {
    const maps = {
      top: { x: 35, y: 6, w: 30, h: 10 },
      right: { x: 84, y: 24, w: 10, h: 42 },
      bottom: { x: 30, y: 84, w: 36, h: 10 },
      left: { x: 6, y: 24, w: 10, h: 42 }
    } as const;

    const zone = maps[issue.side];
    return {
      ...zone,
      x: zone.x + idx,
      y: zone.y + idx,
      label: `${issue.side} ${issue.kind}`
    };
  });

  return {
    subscores: { centering, corners, edges, surface },
    overallBand,
    confidence,
    recommendation,
    qualityWarnings,
    defects
  };
}
