# NiyamCheck

> **AI-assisted Legal Metrology compliance inspection system for packaged-product declarations**

[![Status: Milestone 7 Complete](https://img.shields.io/badge/Status-Milestone%207%20Complete-green.svg)](#current-milestone-status)
[![SIH: 2026 Prototype](https://img.shields.io/badge/SIH%202026-Prototype%20Demo%20Ready-blue.svg)](#current-milestone-status)
[![Backend: Python 3.10+](https://img.shields.io/badge/Backend-Python%203.10%2B%20%7C%20FastAPI-blue.svg)](#technology-stack)
[![Frontend: React 18 + Vite](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%205-purple.svg)](#technology-stack)
[![Tests: Passing](https://img.shields.io/badge/Tests-139%20Backend%20%7C%2023%20Frontend%20Passing-brightgreen.svg)](#testing)

NiyamCheck is a prototype inspection platform designed to assist in verifying mandatory packaging declarations under Indian Legal Metrology regulations. The system analyzes visible declarations from submitted package images, evaluates configured Legal Metrology rules deterministically, maps findings directly to bounding-box image evidence, retrieves source-linked legal material from an authoritative statutory knowledge base, and generates structured inspection reports in JSON and PDF formats.

> [!NOTE]
> **Prototype Notice:** NiyamCheck is an AI-assisted compliance inspection prototype developed for the Smart India Hackathon 2026 (Problem Statement: SIH26034, Team: CodeHexa). It is **not** an official government system, **not** an official certification authority, and **not** a substitute for official legal or enforcement determinations.

---

## 📌 Problem Overview

Under the Legal Metrology (Packaged Commodities) Rules, 2011, pre-packaged goods sold in India are required to carry specific mandatory declarations on their packaging surfaces. In real-world packaging, these declarations are often:
* Distributed across multiple panels (front, back, sides, top, bottom)
* Printed in small, dense, or styled typography
* Subject to varied packaging geometries, lighting conditions, and partial views

Inspecting packages manually across multiple faces can be tedious and prone to human oversight. NiyamCheck assists this process by extracting visible declarations from one or more photographs of a package, aggregating declarations across panels, running deterministic compliance checks against codified rules, indexing visual evidence, and grounding each evaluation in relevant statutory provisions.

---

## 🏗️ Architecture & Pipeline

NiyamCheck processes package images through a linear, deterministic pipeline:

```text
Package Images
      │
      ▼
Image Validation / Quality Assessment
      │
      ▼
OCR + Field Extraction
      │
      ▼
Multi-Image Aggregation
      │
      ▼
Deterministic Compliance Rule Engine
      │
      ├──────────────► Evidence Mapping
      │
      ▼
Legal Knowledge Retrieval
      │
      ▼
Inspection Results
      │
      ├──────────────► Inspection History
      │
      └──────────────► JSON / PDF Inspection Report
```

---

## 🔍 Implemented Capabilities

### 1. Image Analysis & Ingestion
* **Image Quality Assessment (IQA):** Evaluates uploaded image suitability using Laplacian variance for blur detection, brightness/contrast profiling for glare and dark exposure, and format/resolution validation.
* **OCR Text & Region Detection:** Extracts detected text lines along with normalized bounding box coordinates `[ymin, xmin, ymax, xmax]` scaled between `0.0` and `1.0`.
* **Structured / Open-World Field Extraction:** Regex- and heuristic-based extraction for 8 canonical Legal Metrology declaration fields without assuming a closed product catalog:
  - Product Name / Identity
  - Net Quantity & Measurement Units
  - Maximum Retail Price (MRP)
  - Manufacturer / Packer / Importer Name
  - Postal Address & 6-Digit PIN Code
  - Date of Manufacture / Packing / Import
  - Consumer Care Helpline & Contact Info
  - Country of Origin
* **Multi-Panel Image Inspection:** Supports uploading photos from multiple panels (`FRONT`, `BACK`, `LEFT`, `RIGHT`, `TOP`, `BOTTOM`, `UNKNOWN`) to evaluate a complete package.
* **Image Validation:** Rejects empty byte streams, verifies file formats (JPEG, PNG, WebP), and enforces payload size quotas.
* **Client-Side Image Resizing:** Automatically downscales high-resolution camera uploads to a maximum 1920px canvas width on the client before network transmission.

### 2. Deterministic Compliance Rule Engine
* **Pure Python Declarative Evaluation:** Rule evaluation is completely deterministic, transparent, and auditable, with zero LLM hallucinations in compliance verdicts.
* **Standardized Status Vocabulary:** Every rule evaluation and overall inspection outputs one of the following conservative statuses:
  - `COMPLIANT`: All mandatory elements verified with high confidence.
  - `NON_COMPLIANT`: Confirmed absence or violation of a mandatory requirement on fully verified panels.
  - `PARTIALLY_VERIFIABLE`: Some mandatory fields detected and compliant, but one or more declarations remain unobserved or uncertain.
  - `UNCLEAR`: Potential text detected, but OCR confidence or visibility is insufficient for legal certainty.
  - `NOT_VERIFIABLE`: Required packaging face unphotographed, obscured, or illegible.
* **Incomplete Evidence Handling:** If a declaration is not observed on an uploaded image, the engine conservatively marks it `NOT_VERIFIABLE` rather than falsely asserting a legal violation.

### 3. Visual Evidence Mapping
* **Normalized Bounding Box Mapping:** Every extracted value and rule evaluation links directly to its detected text line and bounding box coordinates on the source packaging image.
* **Multi-Panel Provenance:** Each piece of evidence records its source `image_id`, packaging `panel`, OCR text, and confidence score.
* **Interactive Frontend Overlays:** The web interface renders interactive bounding-box overlays over uploaded packaging images with SVG/canvas highlighting.

### 4. Authoritative Legal Knowledge Base & Retrieval
* **Local Authoritative Corpus:** Codified statutory documents stored locally in structured JSON format (`data/legal/sources/`):
  - *The Legal Metrology Act, 2009 (Act No. 1 of 2010)*
  - *The Legal Metrology (Packaged Commodities) Rules, 2011 (G.S.R. 427(E))*
  - *The Legal Metrology (Packaged Commodities) Amendment Rules, 2021 (G.S.R. 779(E))*
  - *The Legal Metrology (Packaged Commodities) Amendment Rules, 2022 (G.S.R. 226(E))*
* **Hierarchical Statutory Chunks:** Granular chunks indexed by Act/Rule, section, rule number, and sub-rule.
* **Deterministic Lexical / BM25-Style Retrieval:** Scores and ranks statutory provisions against rule requirements and keywords.
* **Citation Traceability:** Direct links to official publications on `consumeraffairs.nic.in` for every statutory citation.
* **Deterministic Grounded Explanations:** Explanations synthesized strictly from the codified rule findings and retrieved statutory text without generative hallucinations.

### 5. Inspection Sessions & Reporting
* **Multi-Image Session Aggregation:** Resolves declarations across panels, selecting verified values and highest-confidence OCR candidates.
* **Inspection History & Session Storage:** In-memory session store allowing inspection retrieval, listing, and review by unique inspection ID (`insp-<uuid>`).
* **JSON Inspection Report:** Complete machine-readable audit report containing session summary, extracted fields, rule findings, evidence index, and legal citations.
* **PDF Inspection Report:** Multi-page PDF report generated natively via Pillow with executive summary, findings table, legal basis, and embedded evidence image crops.
* **SHA-256 Integrity Hash:** The generated report includes a SHA-256 integrity hash that can be used to detect subsequent modification of the report data.

### 6. PWA & Mobile Inspection Capabilities
* **Responsive Interface:** Adaptive layout with full desktop data tables and mobile-friendly stacked cards with >= 44px touch targets.
* **Mobile Camera Capture:** Native device camera trigger via HTML5 file input (`capture="environment"`) with fallback to gallery upload.
* **PWA Web Manifest:** Installable to mobile and desktop home screens with theme metadata and application icons.
* **Service Worker App Shell Caching:** Precaches static assets (HTML, CSS, JS, icons) with stale-while-revalidate caching.
* **Strict API Pass-Through:** Zero offline caching of `/api/` network requests — inspection data and analysis always route to the live backend.
* **IndexedDB Draft Storage:** Local offline drafting allowing inspectors to stage multi-panel photos and metadata before submitting.
* **Duplicate Submission Protection:** UI submission lock preventing accidental re-submission while an inspection is in flight.

> [!IMPORTANT]
> **Offline Boundary:** Offline support is strictly limited to local draft preparation and static application shell caching. OCR text extraction, compliance rule evaluation, legal knowledge retrieval, and report generation require an active connection to the FastAPI backend.

---

## ⚖️ Legal Scope

NiyamCheck evaluates visible declarations against specifically configured provisions of Indian Legal Metrology law. The current implementation covers:

### Statutory Instruments Covered
1. **The Legal Metrology Act, 2009 (Act No. 1 of 2010):** Section 18 (prohibiting manufacture, packing, sale, or distribution of non-conforming pre-packaged commodities).
2. **The Legal Metrology (Packaged Commodities) Rules, 2011 (G.S.R. 427(E)):**
   - **Rule 6(1):** Mandatory declarations on pre-packaged commodities.
   - **Rule 9:** Prescribed units of weight, measure, or number.
3. **The Legal Metrology (Packaged Commodities) Amendment Rules, 2021 (G.S.R. 779(E)):** Unit sale price (USP) and country of origin requirements.
4. **The Legal Metrology (Packaged Commodities) Amendment Rules, 2022 (G.S.R. 226(E)):** Provisions for electronic products and declaration flexibilities.

### Codified Rule Catalog (`backend/compliance/rules.py`)

| Rule ID | Rule Name | Category | Description | Severity |
|---|---|---|---|---|
| `LM-PN-001` | Product Identification | Product Identity | Common or generic name of the pre-packaged commodity printed on the package. | Mandatory |
| `LM-NQ-001` | Net Quantity Declaration | Quantity | Net quantity in standard metric units of weight, measure, or number. | Mandatory |
| `LM-MRP-001` | Maximum Retail Price (MRP) | Pricing | Maximum Retail Price inclusive of all taxes declared in INR. | Mandatory |
| `LM-MFG-001` | Manufacturer / Responsible Entity | Manufacturer | Name of the manufacturer, packer, or importer responsible for the package. | Mandatory |
| `LM-ADDR-001` | Address of Manufacturer / Packer | Address | Postal address and valid 6-digit PIN code of the responsible entity. | Mandatory |
| `LM-DATE-001` | Date Information (Mfg / Packing) | Dates | Month and year of manufacture, packing, or import. | Mandatory |
| `LM-CARE-001` | Consumer Care Details | Consumer Care | Helpline phone number, email address, or redressal details. | Mandatory |
| `LM-COO-001` | Country of Origin | Origin | Explicit declaration of country of origin for packaged goods. | Conditional |

> [!WARNING]
> **Scope Limitation:** The system is strictly codified for the 8 rules listed above. It does not evaluate other sub-rules, exemptions, Schedule II commodity weight variations, or non-Legal Metrology regulations such as FSSAI (food safety), BIS (standards), drugs, or cosmetics.

---

## 💻 Technology Stack

The project relies exclusively on the following verified dependencies:

### Backend
* **Runtime:** Python 3.10+
* **Web Framework:** FastAPI `>=0.110.0`
* **ASGI Server:** Uvicorn (standard) `>=0.28.0`
* **Data Validation:** Pydantic v2 `>=2.6.0` & Pydantic-Settings `>=2.2.0`
* **Image Processing:** Pillow (PIL) `>=10.0.0` & NumPy `>=1.24.0`
* **Multipart Handling:** python-multipart `>=0.0.9`
* **HTTP Client:** HTTPX `>=0.27.0`
* **Date Parsing:** python-dateutil `>=2.9.0`
* **OCR Interface:** Standardized abstraction layer supporting local heuristics, Tesseract, or RapidOCR adapters.
* **PDF Engine:** Pure Python multi-page PDF generation via Pillow (`PIL.Image`, `PIL.ImageDraw`, `PIL.ImageFont`) with zero external C-dependencies (no ReportLab, no WeasyPrint).

### Frontend
* **Runtime / Bundler:** Node.js (v18+) & Vite 5 (`vite` `^5.3.4`)
* **Framework:** React 18 (`react` `^18.3.1`, `react-dom` `^18.3.1`)
* **Styling:** Vanilla CSS (`src/index.css`) with CSS custom properties and responsive media queries (no Tailwind CSS).
* **Icons:** Lucide React (`lucide-react` `^1.16.0`)
* **Storage:** Browser IndexedDB via native promise wrappers for offline draft caching.

### Automated Testing
* **Backend:** Python standard library `unittest` framework (`.venv/bin/python -m unittest discover tests`).
* **Frontend:** Node.js native test runner (`node --test test/**/*.test.js`).

---

## 📁 Repository Structure

```text
NiyamCheck/
├── README.md                            # Project overview, architecture, and documentation
├── LICENSE                              # MIT License
├── backend/
│   ├── api/
│   │   └── v1/
│   │       ├── analyze.py               # Single image analysis endpoint
│   │       ├── inspections.py           # Multi-image inspection sessions & reporting endpoints
│   │       └── legal.py                 # Legal knowledge search and source listing endpoints
│   ├── cli/
│   │   └── analyze_image.py             # Standalone CLI tool for single/multi-panel inspections
│   ├── compliance/
│   │   ├── engine.py                    # Deterministic compliance rule engine
│   │   ├── models.py                    # RuleDefinition, RuleEvaluation, ComplianceResult
│   │   ├── rules.py                     # Catalog of 8 codified Legal Metrology rules
│   │   └── validators.py                # Individual field validator routines
│   ├── config.py                        # Application settings and environment configuration
│   ├── evidence/
│   │   ├── mapper.py                    # Bounding-box and token evidence mapper
│   │   └── models.py                    # BoundingBox, NormalizedCoordinate, EvidenceItem
│   ├── extraction/
│   │   ├── base.py                      # Base extractor interface
│   │   ├── open_world.py                # Open-world field extraction implementation
│   │   └── parsers.py                   # Regex patterns for MRP, dates, quantities, PIN codes
│   ├── image_quality/
│   │   └── assessor.py                  # Image Quality Assessment (blur, glare, resolution)
│   ├── inspections/
│   │   ├── aggregator.py                # Cross-panel declaration and finding aggregator
│   │   ├── models.py                    # InspectionSession, InspectionImage, PanelType
│   │   └── store.py                     # In-memory inspection session and image binary cache
│   ├── legal_knowledge/
│   │   ├── chunks.py                    # Statutory chunk registry
│   │   ├── citations.py                 # Official citation formatter and validator
│   │   ├── documents.py                 # Legal document metadata registry
│   │   ├── explainer.py                 # Grounded legal explanation generator
│   │   ├── models.py                    # LegalDocument, LegalChunk, LegalBasis
│   │   ├── retriever.py                 # Keyword / lexical BM25-style retriever
│   │   └── service.py                   # Legal knowledge facade service
│   ├── main.py                          # FastAPI application factory and router mounting
│   ├── ocr/
│   │   ├── base.py                      # OCR engine abstraction interface
│   │   └── engine.py                    # OCR pipeline coordinator
│   ├── reporting/
│   │   ├── hasher.py                    # SHA-256 integrity hash calculator
│   │   ├── models.py                    # InspectionReport, RuleFinding, ReportSummary
│   │   ├── pdf_generator.py             # Native Pillow-based multi-page PDF report generator
│   │   └── report_service.py            # Report compilation and export service
│   ├── requirements.txt                 # Backend Python dependencies
│   ├── schemas/
│   │   └── analysis.py                  # Pydantic schemas for IQA, OCR, and field extraction
│   └── services/
│       └── analysis_service.py          # Unified image analysis orchestration service
├── data/
│   └── legal/
│       └── sources/                     # Authoritative Legal Metrology Acts and Rules (JSON)
│           ├── legal_metrology_act_2009.json
│           ├── packaged_commodities_rules_2011.json
│           ├── pcr_amendment_rules_2021.json
│           └── pcr_amendment_rules_2022.json
├── frontend/
│   ├── index.html                       # HTML5 entrypoint with PWA meta tags
│   ├── package.json                     # Frontend dependencies and npm scripts
│   ├── public/
│   │   ├── favicon.svg                  # Application favicon
│   │   ├── manifest.webmanifest         # PWA installation manifest
│   │   └── sw.js                        # Service Worker with static caching and API bypass
│   ├── src/
│   │   ├── App.jsx                      # Main application shell and tab router
│   │   ├── api/                         # Backend API client (`client.js`, `inspections.js`, `legal.js`)
│   │   ├── components/                  # UI components (Header, Footer, BoundingBoxViewer, etc.)
│   │   ├── index.css                    # Vanilla design system (dark/light tokens, responsive styles)
│   │   ├── pages/                       # Route views (Dashboard, CreateInspection, Results, History, etc.)
│   │   └── storage/                     # IndexedDB offline draft storage (`draftStore.js`)
│   ├── test/
│   │   ├── frontend.test.js             # Frontend unit and integration tests
│   │   ├── milestone6.test.js           # PWA, hardening, and image validation tests
│   │   └── milestone7.test.js           # Clamping, status badge, and edge case tests
│   └── vite.config.js                   # Vite configuration
└── tests/                               # Backend test suite (29 test modules)
```

---

## 🔌 API Endpoints

All REST API routes are prefixed under `/api/v1` (with the exception of root and documentation endpoints):

| Method | Endpoint | Summary & Purpose |
|---|---|---|
| `GET` | `/` | Root service metadata and endpoints index. |
| `GET` | `/docs` | Interactive Swagger / OpenAPI documentation. |
| `GET` | `/api/v1/health` | Global API service health check. |
| `POST` | `/api/v1/analyze/image` | Analyze a single packaging image (IQA -> OCR -> Field Extraction). |
| `GET` | `/api/v1/analyze/health` | Analysis service health check. |
| `POST` | `/api/v1/inspections` | Create multi-panel packaging inspection session (multipart upload). |
| `GET` | `/api/v1/inspections` | List all stored inspection sessions. |
| `GET` | `/api/v1/inspections/{id}` | Retrieve complete aggregated inspection session details. |
| `GET` | `/api/v1/inspections/{id}/report` | Generate and download inspection report in PDF format. |
| `GET` | `/api/v1/inspections/{id}/report.json` | Retrieve structured JSON inspection report with audit hash. |
| `GET` | `/api/v1/inspections/{id}/images/{img_id}` | Retrieve stored packaging panel image binary. |
| `GET` | `/api/v1/legal/sources` | List loaded authoritative statutory source documents. |
| `GET` | `/api/v1/legal/search` | Lexically search statutory provisions (`q`, `top_k`). |
| `GET` | `/api/v1/legal/status` | Retrieve legal knowledge base indexing status and statistics. |

---

## 🚀 Quickstart & Setup

### Prerequisites
* Python 3.10 or higher
* Node.js v18 or higher (with npm)

### 1. Start the FastAPI Backend

```bash
# From repository root
.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
* **API Base URL:** `http://localhost:8000`
* **Interactive Documentation (Swagger):** `http://localhost:8000/docs`
* **System Health Check:** `http://localhost:8000/api/v1/health`

### 2. Start the React Frontend

```bash
# From frontend directory
cd frontend
npm install
npm run dev
```
* **Web Application:** `http://localhost:5173`

---

## 🧪 Automated Testing

### Backend Test Suite
The backend test suite verifies image quality assessment, OCR abstraction, open-world field extraction, compliance rule evaluations, cross-panel session aggregation, legal retrieval, PDF/JSON report generation, failure modes, and end-to-end integration:

```bash
.venv/bin/python -m unittest discover tests
```
* **Result:** **139 tests passed, 0 failed** in ~0.66s.

### Frontend Test Suite
The frontend test suite validates dashboard calculation, API error formatting, coordinate clamping, conservative status handling, PWA service worker contracts, image validation, and IndexedDB draft persistence:

```bash
cd frontend
npm test
```
* **Result:** **23 tests passed, 0 failed** in ~54ms.

### Frontend Production Build
To verify the production asset bundle and compilation:

```bash
cd frontend
npm run build
```
* **Result:** **Build passing** (Vite production build completed cleanly).

*(Note: Test results reflect automated checks on the implemented code and do not imply that the prototype is completely free of defects or operational edge cases).*

---

## 🚦 Current Milestone Status

```text
Milestone 1 — Image Analysis & Field Extraction       ✓ Complete
Milestone 2 — Deterministic Compliance Engine        ✓ Complete
Milestone 3 — Evidence, Inspection & Reporting       ✓ Complete
Milestone 4 — Legal Knowledge Base & RAG              ✓ Complete
Milestone 5 — React Frontend                          ✓ Complete
Milestone 6 — PWA & Real-World Hardening              ✓ Complete
Milestone 7 — End-to-End Validation                   ✓ Complete
```

**Current status: SIH 2026 prototype ready for demonstration.**

---

## 🔮 Future Enhancements

The following capabilities are identified as potential directions for future research and development:
* **Expanded Regulatory Coverage:** Codifying additional rules under the Legal Metrology Rules (such as Schedule II commodity-specific weight tolerances) and adjacent frameworks.
* **Broader Multilingual & Indic Script OCR:** Integrating language-specific models for mandatory declarations printed in regional Indian languages.
* **E-Commerce vs. Physical Package Cross-Check:** Comparing physical package declarations against e-commerce product listings (Amazon, Blinkit, etc.).
* **Persistent Production Database:** Migrating session storage from in-memory cache to PostgreSQL with database migrations.
* **Deployment Infrastructure:** Containerization (Docker), CI/CD build automation, and cloud hosting configurations.
* **Extended Field-Inspection Workflows:** Geotagging and digital signature integration for enforcement field kits.

---

## ⚠️ Known Operational Limitations

1. **Observable Declarations Only:** The system evaluates visible declarations printed on submitted packaging surfaces. It does not verify internal contents, chemical purity, or net weight accuracy on physical scales.
2. **OCR Quality Dependency:** Text extraction accuracy is constrained by image focus, lighting, glare, packaging fold angles, and font typography.
3. **Unphotographed Package Faces:** Declarations not present in submitted images are conservatively marked `NOT_VERIFIABLE` rather than asserted as confirmed violations.
4. **Physical Font Proportionality:** Ratio of font height to Principal Display Panel (PDP) surface area cannot be definitively verified without physical measurements or calibrated optics.
5. **Physical Composition Excluded:** The system does not inspect manufacturing ingredients or physical product properties.
6. **Configured Rule Scope:** Verification is restricted to the 8 codified Legal Metrology rules; rules outside this set are not evaluated.
7. **Knowledge Base Scope:** Statutory retrieval depends on the 4 authoritative source documents currently ingested in the local knowledge base.
8. **Connectivity Requirement:** OCR, compliance evaluation, statutory retrieval, and report generation require an active connection to the backend server.
9. **Offline Boundary:** Offline PWA functionality is limited to static application shell caching and local IndexedDB draft staging.
10. **Reports Are Not Government Certificates:** Generated PDF outputs are structured inspection reports designed for audit assistance, not official government certificates.
11. **Statutory Status:** System results are automated informational assessments and do not substitute for official legal or judicial determinations.

---

## 🛡️ Reliability & Security Measures

The implemented codebase incorporates the following engineering safeguards:
* **Upload Size Quota:** Enforced 25 MB payload limit (`MAX_UPLOAD_SIZE_BYTES`) across all file upload endpoints.
* **Input Validation & Sanitization:** Verification of image byte streams and MIME types, rejecting empty or corrupted files with clear HTTP status codes (`HTTP 400` / `HTTP 422`).
* **Stream-Size Verification:** Guardrails against oversized multipart streams to protect server memory.
* **Sanitized Error Messaging:** Standardized JSON error responses preventing stack trace leakage to client applications.
* **Restricted Development CORS:** Origin access limited to designated development environments (`http://localhost:5173`, `http://localhost:3000`).
* **UUID Session Keys:** Session and image identifiers generated with non-sequential UUIDs (`insp-<uuid>`).
* **Conservative Incomplete Evidence Handling:** Prevents false-positive non-compliance findings by utilizing `NOT_VERIFIABLE` and `UNCLEAR` statuses.
* **Report Integrity Hash:** The generated report includes a SHA-256 integrity hash that can be used to detect subsequent modification of the report data.

---

## 👥 Team CodeHexa

Developed for **Smart India Hackathon 2026**  
**Problem Statement:** SIH26034 — AI Product Compliance Checker  
