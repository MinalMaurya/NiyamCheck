# NiyamCheck: System Architecture Specification

**Project:** NiyamCheck  
**Team:** CodeHexa  
**SIH Problem Statement:** SIH26034 (Legal Metrology Compliance Verification)

---

## 1. System Overview & Ingestion Flow

NiyamCheck provides an end-to-end, auditable verification pipeline that converts raw images of packaged goods into legally grounded compliance reports.

```
+------------------+     +------------------+     +-------------------+
|  Product Image   | --> |  Image Quality   | --> | Vision & OCR      |
|  Upload (1..N)   |     |  Assessment (IQA)|     | Pipeline          |
+------------------+     +------------------+     +-------------------+
                                                            |
                                                            v
+------------------+     +------------------+     +-------------------+
| Inspection Report| <-- | Compliance Rule  | <-- | Structured        |
| & Audit Trail    |     | Engine           |     | Declaration Parser|
+------------------+     +------------------+     +-------------------+
```

---

## 2. Core Architectural Components

### 2.1 Image Ingestion & Quality Assessment (IQA)
- **Role:** Ensure packaging photos have sufficient sharpness, contrast, and resolution before OCR.
- **Metrics Evaluated:**
  - **Blur / Defocus:** Laplacian variance thresholding.
  - **Glare / Specular Reflection:** Brightness saturation mask over key text regions (critical for plastic pouches/foils).
  - **Resolution / DPI:** Checks if physical text height meets minimum pixel resolution for OCR readability.
- **Outcome:** If quality fails, user is prompted immediately to re-capture rather than receiving a false `MISSING` declaration verdict.

### 2.2 Vision & Multi-Engine OCR Abstraction
- **Role:** Localize text bounding boxes and recognize alphanumeric characters, Hindi/regional scripts, and symbols (₹, g, kg, ml, etc.).
- **Design Pattern:** Interface-based provider pattern (`OCREngine` abstract base class):
  ```python
  class OCREngine(ABC):
      @abstractmethod
      def extract_text_boxes(self, image: np.ndarray) -> List[TextBox]:
          pass
  ```
- **Supported Engines:**
  - Fast offline engine (PaddleOCR / Tesseract) for on-device/local deployment.
  - Pluggable Vision-Language Model / Cloud OCR for challenging textures.

### 2.3 Canonical Declaration Extraction Layer
- **Role:** Map unstructured OCR bounding boxes into structured Legal Metrology declaration entities.
- **Canonical Schema Entities:**
  1. `generic_name`: Common or generic commodity name.
  2. `net_quantity`: Magnitude and standard SI unit (`value`, `unit`, `unit_type`).
  3. `mrp`: Maximum Retail Price inclusive of all taxes (`amount`, `currency`, `raw_string`).
  4. `unit_sale_price`: Price per unit weight/measure (where mandatory under 2021 amendments).
  5. `dates`: Manufacture, packing, import, and expiry dates (`month`, `year`, `type`).
  6. `manufacturer_details`: Name and complete address with PIN code.
  7. `packer_details`: Name and address where different from manufacturer.
  8. `importer_details`: For imported goods.
  9. `country_of_origin`: Country name for imported or dual-market items.
  10. `consumer_care`: Helpline phone, email, and designated contact person.

### 2.4 Deterministic Regulatory Compliance Engine
- **Role:** Validate extracted declarations against the Legal Metrology (Packaged Commodities) Rules, 2011.
- **Principles:**
  - **Zero Black-Box Logic:** Legal rules are defined declaratively in versioned specifications (`data/legal_rules/`).
  - **Rule Versioning:** Evaluates against the ruleset active on the package's manufacturing/packing date (respecting statutory grace periods).
  - **Evidence Traceability:** Every rule evaluation produces a `RuleResult` with citation, condition tested, actual value, and image bounding box reference.

---

## 3. Declaration State Model

Under legal scrutiny, an automated system must **never falsely accuse a manufacturer of omitting a declaration** if the label is simply torn, blurry, or captured at an oblique angle.

For every mandatory declaration $D_i$, the system assigns one of five mutually exclusive states:

| State | Definition | Enforcement Implication |
|---|---|---|
| `PRESENT` | Clearly identified, localized, and compliant with format. | Counted towards compliance check. |
| `MISSING` | Full package surfaces imaged with high IQA score, but declaration is absent. | Flagged as statutory violation. |
| `UNCLEAR` | Text cluster detected in candidate region, but OCR confidence below threshold or text partially unreadable. | Routed to human officer for manual verification. |
| `NOT_APPLICABLE` | Specific declaration not mandated for this category or package dimension (e.g. packages under 10g/10ml exemptions). | Excluded from violation count. |
| `NOT_VERIFIABLE` | Relevant package panel not provided in uploaded images (e.g. only front view uploaded). | Officer prompted to upload missing panel. |

---

## 4. Final Verdict Resolution Matrix

| Condition | Overall Verdict | Action |
|---|---|---|
| All applicable declarations `PRESENT` and rule-compliant | **`COMPLIANT`** | Auto-generate compliance clearance. |
| At least one applicable declaration conclusively `MISSING` or non-compliant | **`NON-COMPLIANT`** | Generate Notice/Report with visual evidence. |
| One or more declarations `UNCLEAR` or `NOT_VERIFIABLE`, with zero confirmed violations | **`NEEDS_MANUAL_REVIEW`** | Direct to Inspector Workbench with side-by-side crop magnifier. |
