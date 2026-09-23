# NiyamCheck — Development Status Report

**Date:** September 2026  
**Project:** NiyamCheck — AI-Assisted Legal Metrology Compliance Inspection System  
**Problem Statement:** SIH26034 (Smart India Hackathon 2026)  
**Team:** CodeHexa  

---

## 1. Executive Summary

A comprehensive architectural inspection and test verification of the **NiyamCheck** repository was conducted across backend services, frontend web application, database/persistence models, API endpoints, OCR abstraction, and statutory legal knowledge base.

- **Frontend:** Fully functional (React 18 + Vite 5 + Vanilla CSS + PWA Service Worker + IndexedDB). **69 of 69 frontend tests passing across 7 suites**; production Vite build completes cleanly without errors.
- **Backend Core:** Complete end-to-end multimodal pipeline implemented across Milestones 1–7 + Officer Review & Finalization API.
- **Backend Tests:** **195 of 195 original tests passing + new targeted Officer Workflow API tests passing with 100% success**.

---

## 2. Existing Functionality

### 2.1 Backend Architecture & Pipeline
1. **Image Quality Assessment (IQA):**
   - Laplacian variance for blur/defocus detection.
   - Brightness and contrast profiling for specular glare and underexposure.
   - Resolution validation (minimum $300 \times 300\text{ px}$) and payload quota enforcement (25 MB max).
2. **Multi-Engine OCR Abstraction:**
   - Provider pattern (`BaseOCREngine`) supporting `RapidOCREngine` (ONNX runtime for cross-platform CPU/GPU execution), `AppleVisionEngine` (macOS Neural Engine), `TesseractEngine`, `PaddleEngine`, `MockOCREngine`, and conservative `EmptyOCREngine`.
   - Token-level bounding box localization and normalization `[ymin, xmin, ymax, xmax]`.
3. **Structured / Open-World Information Extraction:**
   - 8 canonical Legal Metrology declaration fields extracted via layout-aware heuristics and regex patterns:
     - Common or generic product name/identity.
     - Net quantity with numerical magnitude and standard metric units ($g, kg, ml, l, N$). Multi-pack support ($4 \times 50\text{ g}$).
     - Maximum Retail Price (MRP) with currency symbol and mandatory tax clause (`incl. of all taxes`).
     - Manufacturer, Packer, and Importer corporate names.
     - Postal address with valid 6-digit Indian PIN code.
     - Date of manufacture, packaging, or import ($MM/YYYY$).
     - Consumer care contact details (helpline telephone, email, redressal address).
     - Country of origin.
   - Disambiguation layers separating nutritional table gram weights from Net Quantity, distinguishing MFD from EXP/Batch dates, and classifying commercial roles.
4. **Visual & Packaging Layout Analysis (5-Pillar Model):**
   - Principal Display Panel (PDP) detection based on panel type and typography prominence.
   - Local declaration crop contrast calculation (RMS and Michelson contrast metrics).
   - Relative font height ratio calculation ($h_{rel}$) addressing statutory font size requirements under Rule 7 of PCR 2011.
   - Multi-dimensional assessments: Existence, Completeness, Readability, Appropriate Placement, and Correct Interpretation.
5. **Deterministic Legal Metrology Compliance Rule Engine:**
   - 8 codified statutory rules (`LM-PN-001` through `LM-COO-001`) reflecting provisions of the Legal Metrology Act, 2009 and Legal Metrology (Packaged Commodities) Rules, 2011 (with 2021 & 2022 amendments).
   - Category detection engine classifying commodities into Packaged Food, Beverages, Personal Care, Household & Cleaning, or Other Packaged Commodities.
   - Conservative, zero-hallucination compliance verdict logic: `COMPLIANT`, `NON_COMPLIANT`, `PARTIALLY_VERIFIABLE`, `UNCLEAR`, `NOT_VERIFIABLE`.
6. **Multi-Panel Inspection Aggregation & Session Management:**
   - Cross-panel aggregation across standard package panels (`FRONT`, `BACK`, `LEFT`, `RIGHT`, `TOP`, `BOTTOM`).
   - Conflict detection flagging contradictory declarations across panels (e.g. conflicting MRPs) as `REVIEW`.
   - Dynamic adding and deleting of packaging panels within existing inspection sessions.
7. **Officer Review & Finalization API (`PATCH /api/v1/inspections/{id}/review`):**
   - Allows Legal Metrology Inspectors to record official field observations, per-rule finding review determinations, final statutory determinations, and digital audit finalization with timestamp.
   - Session data persistence in SQLite/PostgreSQL store preserves officer notes, reviewer credentials, and determinations without DB schema migration breakage.
8. **Authoritative Legal Knowledge Base & RAG:**
   - Local codified corpus of 4 statutory instruments in structured JSON (`data/legal/sources/`).
   - Granular statutory chunks indexed by Act/Rule number and sub-rule.
   - Deterministic lexical BM25 retrieval grounding rule evaluations in authoritative citations.
9. **Inspection Reporting & Tamper-Evidence:**
   - Structured JSON report export with SHA-256 audit digest.
   - Native multi-page PDF generation via Pillow (`PIL.ImageDraw`, `PIL.ImageFont`) without heavy external C-libraries (ReportLab/WeasyPrint).
   - Embedded visual evidence crops with bounding boxes and layout metrics.
10. **Persistence Layer:**
    - SQLAlchemy models with SQLite default database (`niyamcheck.db`) and PostgreSQL compatibility.

### 2.2 Frontend Web Workbench & PWA
1. **Role-Based Access Control (RBAC):**
   - `AuthContext.jsx` with canonical roles (`OFFICER`, `CONSUMER`, `VENDOR`).
   - Persona Switcher in `Navbar.jsx` with active station indicators (`Inspector R. Sharma`, `LM-OFF-MH-4001`).
   - Dedicated Officer route views (`OfficerDashboard`, `OfficerHistory`, and Officer Workbench tab in `InspectionResults`) while preserving original Consumer/Vendor flows.
2. **Officer Dashboard (`OfficerDashboard.jsx`):**
   - 5-Pillar executive metrics grid: Total Audits, Verified Compliant, Statutory Violations, Review Required, Officer Finalized.
   - Officer Credential Card displaying inspector identity, jurisdiction badge, and active metrology division.
   - Status-filtered registry table (`ALL`, `REVIEW`, `NON_COMPLIANT`, `COMPLIANT`, `FINALIZED`) with quick links to workbench and PDF download.
3. **Officer Inspection Review Panel (`OfficerReviewPanel.jsx`):**
   - Per-rule statutory finding review matrix with options (`CONFIRM_AI_VERDICT`, `ACCEPT_AS_COMPLIANT`, `CONFIRM_VIOLATION`, `REQUIRES_FIELD_SAMPLE`, `DISMISS_EXEMPT`) and per-rule remarks.
   - Inspector field observations and case notes text area.
   - Final statutory determination selector (Approved Compliant, Statutory Notice under Sec 18 / Rule 6, Seizure under Sec 15, Metrology Lab Test, Dismissed).
   - "Finalize & Sign Inspection" button that locks the audit with officer badge and timestamp.
   - Direct download buttons for Official PDF and Audit JSON.
4. **Officer Case History & Registry (`OfficerHistory.jsx`):**
   - Enforcement archive with multi-field search (ID, commodity, brand, manufacturer, officer notes).
   - Status filters and Officer Decision filters (`ALL`, `FINALIZED`, `PENDING`, `NOTICE`).
5. **Interactive Inspection Workbench:**
   - Multi-image drag-and-drop / file input with packaging panel assignments.
   - Client-side image pre-validation (format checking, 25 MB size quota, empty file protection) and client-side canvas downscaling to $\le 1920\text{ px}$.
   - Interactive bounding-box viewer with CSS percentage coordinates and visual evidence highlight modals.
6. **Consumer Dashboard & History:**
   - Dynamic metrics aggregation (compliance rate, issues detected, inspections count).
   - History search and filtering by inspection ID, date, status, and commodity.
   - Dedicated "Why Automated Compliance Cannot Rely on OCR Alone" educational research gap section.
7. **PWA & Field Readiness:**
   - Service worker (`sw.js`) with cache-first static asset caching and strict API bypass for live `/api/` calls.
   - Web application manifest (`manifest.webmanifest`) with icons and theme colors.
   - IndexedDB local storage (`draftStore.js`) for staging drafts offline before network upload.
   - Submission lock preventing duplicate in-flight API requests.
   - Mobile touch target compliance ($\ge 44\text{ px}$).
   - Install App modal with QR code generator and strict HTTPS APK URL validation.

---

## 3. Current Errors & Issues

All primary blocking issues diagnosed in the repository have been resolved:
- **ISS-01 (Resolved):** OCR engine initialized with RapidOCR / ONNX fallback.
- **ISS-02 (Resolved):** Image serving and session persistence fully operational in SQLite/PostgreSQL store.
- **ISS-03 (Resolved):** Boundary padding handled for edge text detection.
- **ISS-04 & ISS-05 (Resolved):** Extraction patterns refined with negative lookahead constraints.
- **ISS-06 (Resolved):** Deprecations migrated to timezone-aware UTC datetime.

---

## 4. Current Milestone Status: Officer Workflow Complete
- [x] Identify authentication/RBAC implementation and ensure Officer access is supported.
- [x] Identify existing inspection APIs and frontend components and reuse existing code.
- [x] Complete Officer Dashboard with inspection statistics and audit registry.
- [x] Complete New Inspection workflow with multi-panel packaging upload.
- [x] Complete Inspection Results screen with multimodal findings, bounding boxes, and legal citations.
- [x] Add Officer observations/comments and per-finding review actions with backend persistence.
- [x] Implement inspection finalization and digital signing with official timestamp/badge.
- [x] Integrate report generation and download (JSON and PDF).
- [x] Implement Officer inspection history/case registry.
- [x] Protect Officer routes with RBAC while keeping Consumer and Vendor workflows completely intact.
- [x] Comprehensive test coverage: 69/69 frontend tests pass, targeted backend unittests pass, and Vite production build succeeds.

---

## 5. Test Suite Performance Diagnostic Note
- **Full Discovery Suite (`python -m unittest discover tests`):** Runs 195 tests across 34 test files sequentially. Because tests execute real CPU-based ONNX neural network inference (`RapidOCREngine` with DBNet detection and CRNN recognition) on synthesized image buffers, running all 195 tests sequentially takes **~112 seconds**.
- **Targeted Fast Tests:**
  - Officer Workflow API (`tests.test_officer_workflow_api`): 2 tests in **2.79s**.
  - Milestone 5 API (`tests.test_milestone5_api`): 3 tests in **2.25s**.
  - Pipeline Stages (`tests.test_inspection_pipeline_stages`): 18 tests in **26.8s**.
  - Compliance Engine (`tests.test_compliance_engine_requirements`): 17 tests in **0.096s**.
  - Extractors (`tests.test_extractors`): 7 tests in **0.002s**.
- **Recommendation:** Run targeted test files during active feature development rather than the entire 195-test suite on every minor change.
