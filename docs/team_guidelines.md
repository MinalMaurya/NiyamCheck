# Team CodeHexa — 6-Member Work Division & Guidelines

**Project:** NiyamCheck  
**SIH 2026 Problem Statement:** SIH26034

To maximize development velocity during the hackathon and avoid merge conflicts, the codebase is partitioned into distinct modular domains:

---

## 👥 Member Role Allocations

| Role | Focus Area | Primary Directories | Key Responsibilities |
|---|---|---|---|
| **Member 1 (Lead & Architect)** | System Architecture, Data Models & Pipeline Integration | `backend/app/main.py`, `backend/app/schemas/`, `tests/` | Oversee pipeline end-to-end integration, API contracts, Pydantic schemas, and orchestration between modules. |
| **Member 2 (CV / Image Processing)** | Image Ingestion & Quality Assessment (IQA) | `backend/app/cv/iqa/`, `notebooks/` | Blur detection (Laplacian variance), glare detection, auto-cropping, image enhancement, and resolution checks. |
| **Member 3 (OCR & Vision Engineer)** | OCR Pipeline & Bounding Box Extraction | `backend/app/cv/ocr/`, `models/` | Multi-engine OCR integration (PaddleOCR/Tesseract), text grouping, angle/rotation compensation, bounding box coordinate normalization. |
| **Member 4 (NLP & Information Extractor)** | Canonical Declaration Parser | `backend/app/extractors/`, `data/annotations/` | Regex & layout-aware heuristics to extract MRP, Net Qty, Dates, Manufacturer names, PIN codes, consumer care info from raw OCR text. |
| **Member 5 (Rules Engine & Legal Metrology)** | Deterministic Compliance Engine & Report Generator | `backend/app/rules_engine/`, `data/legal_rules/`, `backend/app/reports/` | Codify Legal Metrology Rules, 2011 into versioned declarative rule checks; implement PDF inspection report generator (ReportLab/WeasyPrint). |
| **Member 6 (Frontend & UX Engineer)** | Inspector Web Workbench & Evidence Viewer | `frontend/` | Build responsive UI (React + Vite + Tailwind), multi-image uploader, interactive canvas/SVG bounding box overlay, inspection verdict dashboard. |

---

## 🌿 Git Workflow Rules

1. **Main Branch Protection:** `main` is always stable and deployable.
2. **Feature Branch Convention:**
   - `feat/iqa-blur-detection`
   - `feat/ocr-paddle-wrapper`
   - `feat/extractor-mrp-date`
   - `feat/rules-engine-rule6`
   - `feat/frontend-inspector-canvas`
3. **No Large Binaries in Git:**
   - Model weights (`*.pt`, `*.onnx`, etc.) and high-res raw image datasets MUST NOT be committed to git.
   - Use Google Drive / Git LFS / cloud bucket for sharing raw model weights or heavy datasets.
4. **Testing before PR:**
   - Ensure all pytest tests pass locally before opening a pull request:
     ```bash
     pytest tests/
     ```
