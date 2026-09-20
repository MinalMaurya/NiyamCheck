# NiyamCheck: System Architecture Specification

**Project:** NiyamCheck  
**Team:** CodeHexa  
**SIH Problem Statement:** SIH26034 (Legal Metrology Compliance Verification)  
**Framework Paradigm:** Multimodal Legal Compliance Verification  

---

## 1. System Overview & The Research Gap

### 1.1 The Research Gap
Automated compliance checking of packaged commodities **cannot rely on OCR alone**. Real-world commercial packaging contains complex visual layouts, small or distorted text, multiple competing declarations (e.g. nutritional facts vs. net quantity, multiple dates, multiple corporate entities), and non-standard typography. 

Consequently, compliance checking requires a **Multimodal Legal Metrology Framework** that unites:
- **Visual & Layout Analysis:** Spatial panel mapping, Principal Display Panel (PDP) detection, local crop contrast and sharpness evaluation, and relative font height ratio estimation.
- **Robust OCR & Region Localization:** Bounding-box text recognition preserving spatial coordinates.
- **Contextual Semantic Extraction & Disambiguation:** Disambiguating competing numbers/dates and parsing statutory sub-element completeness.
- **Rule-Based Legal Reasoning:** Deterministic evaluation against codified Legal Metrology rules across **5 verification dimensions** (Existence, Completeness, Readability, Appropriate Placement, and Correct Interpretation).
- **Explainable Multimodal Audit Evidence:** Grounding verdicts directly in visual crop proof, bounding boxes, layout metrics, and statutory citations.

### 1.2 Ingestion & Multimodal Processing Flow

```
+------------------------------------------------------------------------+
|                     Product Image Ingestion                            |
|             Multi-Panel Uploads (Front / Back / Sides / Crimps)        |
+------------------------------------------------------------------------+
                                    |
        +---------------------------+---------------------------+
        |                                                       |
        v                                                       v
+-------------------------------+       +-------------------------------+
|   Visual & Layout Analysis    |       |   Multi-Engine OCR            |
| - Principal Display Panel     |       | - Token Bounding Boxes        |
| - Local Contrast & Sharpness  |       | - Multi-Scale Recognition     |
| - Font Height Ratio (Rule 7)  |       | - Confidence Scoring          |
| - Spatial Proximity & Grouping|       +-------------------------------+
+-------------------------------+                       |
        |                                               |
        +---------------------------+-------------------+
                                    |
                                    v
+------------------------------------------------------------------------+
|            Contextual Semantic Extraction & Disambiguation             |
| - Nutrient vs Net Quantity Disambiguation                              |
| - Multi-Date Disambiguation (MFD / PKD / EXP / Batch)                  |
| - Entity Role Classification (Brand / Mfg / Packer / Importer)         |
| - Sub-Element Completeness Verification (PIN, Tax Clause, SI Units)    |
+------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------+
|                 Deterministic Compliance Rule Engine                   |
|  Evaluates 5 Pillars: Existence + Completeness + Readability           |
|                       + Appropriate Placement + Correct Interpretation |
+------------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------------+
|                   Inspection Report & Audit Trail                      |
| - Visual Evidence Crops with Localized Readability & Layout Metrics    |
| - Authoritative Statutory Basis (PCR 2011 Rules 6, 7, 8, 9, 18)        |
| - SHA-256 Tamper-Evident Integrity Hash                                |
+------------------------------------------------------------------------+
```

---

## 2. Core Architectural Components

### 2.1 Image Ingestion & Quality Assessment (IQA)
- **Role:** Ensure uploaded packaging photos meet baseline optical criteria before processing.
- **Metrics Evaluated:**
  - **Blur / Defocus:** Global Laplacian variance thresholding.
  - **Glare / Specular Reflection:** Brightness saturation mask over key text regions (critical for plastic pouches/foils).
  - **Resolution / Dimensions:** Minimum dimension verification ($\ge 300\times 300\text{ px}$) to prevent OCR breakdown.
- **Outcome:** If overall image quality fails, the user is prompted to re-capture rather than receiving a false `MISSING` declaration verdict.

### 2.2 Visual & Packaging Layout Analyzer
- **Role:** Extract spatial, geometric, and visual characteristics of the package that OCR cannot capture.
- **Capabilities:**
  - **Principal Display Panel (PDP) Detection:** Determines whether an imaged panel represents the PDP based on panel orientation (`FRONT`), area coverage, prominent brand typography, and visual hierarchy.
  - **Local Crop Readability Assessor:** Crops each declaration bounding box to calculate local Michelson/RMS contrast, local text stroke sharpness, and distortion flags.
  - **Relative Font Height Ratio:** Computes character bounding height relative to panel height ($h_{rel} = \Delta y$) to assess statutory minimum font size compliance under Rule 7 of PCR 2011.
  - **Spatial Proximity & Grouping:** Evaluates spatial distance between paired declarations (e.g., verifying that Unit Sale Price is placed adjacent to MRP, or Manufacturer and Packer addresses are grouped).

### 2.3 Vision & Multi-Engine OCR Abstraction
- **Role:** Localize text bounding boxes and recognize alphanumeric characters, Hindi/regional scripts, and symbols (₹, g, kg, ml, etc.).
- **Design Pattern:** Interface-based provider pattern (`BaseOCREngine` abstract base class):
  ```python
  class BaseOCREngine(ABC):
      @abstractmethod
      def extract_text(self, image: Image.Image) -> OCRResult:
          pass
  ```
- **Supported Engines:**
  - RapidOCR / ONNX Runtime / PaddleOCR for fast local CPU/GPU execution.
  - Native Apple Vision framework on macOS.
  - Tesseract OCR for open-source environments.
  - High-fidelity Mock engine for hermetic test suites.

### 2.4 Contextual Semantic Extraction & Disambiguation Layer
- **Role:** Transform unstructured OCR tokens into legally validated declaration entities by resolving real-world packaging ambiguities:
  - **Nutritional Fact Separation:** Filters out protein, carbohydrate, and fat gram weights from the statutory Net Quantity declaration.
  - **Date Disambiguation:** Distinguishes between manufacturing dates, packaging dates, expiry dates, and batch/lot codes.
  - **Entity Classification:** Classifies corporate names into Brand Owner/Marketer, Manufacturer, Packer, or Importer.
  - **Sub-Element Completeness:** Audits the internal components of each declaration (e.g., verifying that an address contains street, city, and 6-digit PIN; verifying that an MRP includes currency and tax-inclusive clause).

### 2.5 Deterministic Regulatory Compliance Engine
- **Role:** Validate extracted declarations against the Legal Metrology (Packaged Commodities) Rules, 2011 across the **5 verification pillars**.
- **Principles:**
  - **Zero Black-Box Logic:** Legal rules are defined declaratively in versioned specifications.
  - **Evidence Traceability:** Every rule evaluation produces a `RuleEvaluation` record linking the condition tested, detected value, completeness assessment, readability score, layout placement, and statutory citation.

---

## 3. The 5-Pillar Declaration State Model

Under legal scrutiny, an automated compliance system must **never falsely accuse a manufacturer of omitting a declaration** if the label is merely unobserved, torn, or blurry.

For every mandatory declaration $D_i$, the system evaluates:
1. **Existence:** (`PRESENT`, `MISSING`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`)
2. **Completeness:** (`COMPLETE`, `PARTIAL`, `INCOMPLETE`)
3. **Readability:** (`CLEAR`, `DISTORTED`, `ILLEGIBLE`)
4. **Placement:** (`COMPLIANT_PDP`, `SECONDARY_PANEL`, `NON_COMPLIANT_PLACEMENT`, `NOT_APPLICABLE`)
5. **Interpretation:** (`VERIFIED`, `AMBIGUOUS`, `MISINTERPRETED`)

### Declaration State Definitions

| State | Definition | Enforcement Implication |
|---|---|---|
| `PASS` | Clearly identified, complete in all statutory sub-elements, readable, appropriately placed on PDP, and compliant with format. | Counted as compliant declaration. |
| `POTENTIAL_ISSUE` | Declaration identified but positively violates statutory formatting (e.g. Net Quantity without metric unit, MRP omitting tax-inclusive statement, diminutive font). | Flagged as statutory concern with specific remediation advice. |
| `REVIEW` | Text cluster detected in candidate region, but OCR confidence below threshold, text distorted, or declaration ambiguous. | Routed to inspector for manual review with side-by-side crop view. |
| `NOT_VERIFIABLE` | Relevant package panel not provided in uploaded images (e.g. only one panel submitted) or obscured. | Inspector prompted to upload missing package face. |
| `NOT_APPLICABLE` | Specific declaration not mandated for this category or package dimension (e.g. packages under 10g/10ml exemptions). | Excluded from violation count. |

---

## 4. Final Verdict Resolution Matrix

| Condition | Overall Verdict | Action |
|---|---|---|
| All applicable declarations `PASS` | **`COMPLIANT`** | Auto-generate compliance clearance report. |
| At least one applicable declaration conclusively `POTENTIAL_ISSUE` | **`NON-COMPLIANT` / `POTENTIAL_ISSUES`** | Generate Notice with visual crop evidence and legal citations. |
| One or more declarations `REVIEW` or `NOT_VERIFIABLE`, with zero confirmed violations | **`PARTIALLY_VERIFIABLE` / `NEEDS_REVIEW`** | Direct to Inspector Workbench with side-by-side crop magnifier and request for additional panels. |
| Zero readable declarations observed across submitted images | **`NOT_VERIFIABLE`** | Prompt user to upload clearer, complete package panels. |
