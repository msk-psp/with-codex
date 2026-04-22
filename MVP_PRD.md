# Pokémon Card Auto-Grading MVP PRD

## 1) Product Goal
Build a simple web app that accepts user-uploaded Pokémon card images and returns a **pre-grade estimate** (not an official certification) based on visible condition signals inspired by established grading dimensions (corners, edges, surface, centering) and basic authenticity risk checks.

## 2) Problem Statement
Collectors want a quick way to know whether a card is worth submitting to a professional grader. Current options require manual inspection or shipping to a grading company.

## 3) Target User
### Primary user
- **Casual-to-serious Pokémon collectors** with small to medium collections.
- They want to decide: **submit now, keep raw, or sell raw**.

### Secondary user
- **Card flippers / small sellers** who need fast triage of many cards.

## 4) MVP Scope
### In scope (MVP)
1. **Single-card grading estimate** from uploaded images (front required, back optional but recommended).
2. **Condition subscores** (0–10) for:
   - Centering
   - Corners
   - Edges
   - Surface
3. **Overall predicted grade band**:
   - 10
   - 9
   - 8
   - 7 or below
4. **Confidence score** (Low / Medium / High) tied to image quality and model certainty.
5. **Defect highlights** overlay (e.g., whitening, corner wear, scratches) where detectable.
6. **Simple recommendation**:
   - "Likely worth professional grading"
   - "Borderline"
   - "Not recommended"
7. **Result summary page** with shareable link.

### Out of scope (for MVP)
- Official authentication/certification.
- Price prediction engine.
- Batch processing for large collections.
- Marketplace integrations.
- Full counterfeit determination (only "risk flags" if suspicious patterns are detected).

## 5) Reference Grading Principles (from CCC article)
This MVP mirrors common grading dimensions described by grading services:
- Third-party grading evaluates card condition and authenticity.
- Detailed scoring can be broken into multiple sub-criteria.
- A card's condition strongly impacts value and submission decisions.

For this MVP, we convert that into a practical machine-assisted pre-check, not an authoritative grade.

## 6) Core User Workflow
1. User lands on homepage and clicks **Start grading**.
2. User uploads card photos:
   - Front (required)
   - Back (optional in v1, strongly prompted)
3. System runs image checks:
   - Quality gate (focus, glare, crop completeness)
   - Defect detection + subscore prediction
4. System returns:
   - Overall grade band
   - Four subscore cards
   - Confidence level
   - Visual defect markers
   - Recommendation (grade / hold / skip)
5. User can save/export result and optionally re-upload better photos.

## 7) Functional Requirements
### FR-1 Image Input
- Accept JPG/PNG/WEBP.
- Max file size: 15 MB per image.
- Require at least one full card front image.

### FR-2 Image Quality Gate
- Detect blur, low light, heavy glare, severe tilt, incomplete frame.
- If failing thresholds, block scoring and ask for retake tips.

### FR-3 Subscore Inference
- Generate 0–10 estimates for centering/corners/edges/surface.
- Provide short explanation per subscore.

### FR-4 Overall Grade Band
- Derive grade band from weighted subscores.
- Show confidence badge and "why" summary.

### FR-5 Defect Visualization
- Overlay probable defect regions (bounding boxes or heatmap).

### FR-6 Recommendation Engine
- Rule-based recommendation from overall band + confidence:
  - 9–10 and confidence ≥ medium -> likely worth grading.
  - 8 or confidence low -> borderline.
  - ≤7 with clear defects -> not recommended.

### FR-7 Session Persistence
- Save analysis result for 30 days via shareable URL.

### FR-8 Basic Anti-Abuse
- Rate limit per IP/user.
- Virus/malware scan for uploads.

## 8) Non-Functional Requirements
- Median result time: < 8 seconds for one card.
- Uptime target: 99.0% for MVP.
- Mobile-first responsive UI.
- Accessibility baseline: WCAG AA for key flows.
- Privacy: delete raw uploads after processing window (e.g., 24h), keep derived metadata for session history.

## 9) Feasibility Criteria for MVP
MVP is feasible to launch if all criteria below are met:

### Model & Accuracy
1. Subscore MAE target <= 1.0 compared to internal human-labeled benchmark.
2. Grade-band top-1 accuracy >= 70% on holdout set.
3. Confidence calibration: low-confidence bucket has materially higher error than high-confidence bucket.

### Product & UX
4. >= 80% of test users can complete upload-to-result flow without assistance.
5. >= 70% of failed image-quality attempts succeed after one retake.
6. Median end-to-end latency < 8 seconds in staging-like load.

### Operational
7. Upload safety checks pass (malicious file rejection).
8. Error rate < 2% for analysis jobs.
9. Logging covers model version, request id, and failure reason.

### Business Validation
10. At least 30 pilot users complete >= 3 analyses each.
11. At least 40% of pilot users report recommendation as "useful" or better.

## 10) Data Strategy (MVP)
- Build labeled dataset of Pokémon card images with human-assigned subgrades.
- Include varied lighting, card eras, holo and non-holo finishes, and wear levels.
- Store annotation guidelines to keep rater consistency.
- Start with supervised model + rule layer; no real-time learning in MVP.

## 11) Key Risks & Mitigations
1. **Image quality variance** -> add strict quality gate + capture guide UI.
2. **Domain complexity (set/print variations)** -> start with condition-only grading and avoid card identity-dependent logic in v1.
3. **False trust in output** -> prominent disclaimer: "pre-grade estimate, not official certification."
4. **Counterfeit detection expectations** -> position as "risk flags" only.

## 12) Success Metrics (First 60 Days)
- Activation: % of signups completing first analysis.
- Repeat usage: users with >= 3 analyses.
- Recommendation usefulness score.
- Time to result.
- Model disagreement rate vs. internal reviewers.

## 13) Suggested MVP Milestones
### Milestone 1: Product Definition (Week 1)
- Finalize UX flow, score scale, and recommendation rules.

### Milestone 2: Data + Baseline Model (Weeks 2–4)
- Assemble initial dataset.
- Train baseline subscore models.

### Milestone 3: App Prototype (Weeks 4–6)
- Build upload, inference API, and results page.

### Milestone 4: Pilot (Weeks 7–8)
- Run closed beta with targeted collectors.
- Measure feasibility criteria.

### Milestone 5: MVP Launch Decision (Week 9)
- Go/no-go based on thresholds in Section 9.

## 14) Open Questions
1. Should back image be mandatory at launch for better edge/surface reliability?
2. Do we show numeric overall grade or only grade bands to avoid false precision?
3. Should we gate premium features (history/export) behind login in MVP or post-MVP?
4. What legal wording is required for non-official grading claims in each market?
