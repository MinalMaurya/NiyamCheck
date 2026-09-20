# Multimodal Compliance Framework for Packaged Commodities: Addressing the Automated Legal Metrology Research Gap

**Author:** Team CodeHexa  
**Project:** NiyamCheck  
**SIH Problem Statement:** SIH26034 (AI-Assisted Legal Metrology Compliance Inspection)  
**Status:** Architectural Specification & Research Framework  

---

## 1. Executive Summary & The Research Gap

Automated compliance verification of packaged commodities is traditionally approached as a linear Optical Character Recognition (OCR) pipeline: an image of a package is captured, OCR converts pixels to text strings, and regular expressions search for keywords (such as `"Net Wt:"` or `"MRP Rs."`).

### The Core Research Gap
**Automated compliance checking of packaged commodities cannot rely on OCR alone.**

In real-world retail environments, commercial packaging is designed for marketing appeal, aesthetic differentiation, and physical containment rather than machine readability. Consequently, real-world packaging presents four foundational challenges that defeat pure OCR pipelines:
1. **Complex Visual & Spatial Layouts:** Mandatory declarations are distributed non-linearly across multiple three-dimensional panels (front, back, sides, crimps, bottom). Declarations appear alongside prominent branding, decorative typography, multi-colored backgrounds, promotional claims, and regulatory logos (e.g., Green Veg Dot, BIS ISI mark, Recycling symbols).
2. **Small, Curved, or Distorted Text:** Mandatory declarations are frequently printed in compact point sizes (often $\le 1.5\text{ mm}$ or $6\text{ pt}$) on irregular, flexible, or reflective surfaces—such as metallic foils, cylindrical beverage cans, vacuum-sealed pouches with crinkles, and seam crimps. These introduce perspective distortion, non-planar text curvatures, and specular glare.
3. **Multiple Competing Declarations & Semantic Ambiguity:** Real packages display multiple competing numbers, dates, and commercial entities:
   - *Ambiguous Quantities:* Nutritional tables declare grams of protein, carbohydrates, and fat (e.g., `Protein: 5g`, `Total Fat: 12g`), which naive OCR frequently confuses with the package's declared statutory `Net Quantity: 50g`.
   - *Ambiguous Dates:* A single package often carries manufacturing dates (`MFD`), packaging dates (`PKD`), import dates, batch/lot codes, and expiry/best-before dates (`EXP`, `USE BY`).
   - *Ambiguous Entities:* Declarations feature distinct corporate entities with differing statutory responsibilities: brand owner/marketeer (`Marketed by`), manufacturing facility (`Manufactured at`), contract packaging plant (`Packed by`), and distributor or importer (`Imported by`).
4. **Statutory Placement & Layout Mandates:** Legal Metrology law does not merely require that certain words exist anywhere on the package; it specifies **where** and **how** they must appear:
   - *Principal Display Panel (PDP):* Common/generic product identity and Net Quantity must be prominently placed on the Principal Display Panel (Rule 6(1)(b), Rule 6(1)(c), Rule 7).
   - *Minimum Font Height:* Declarations must adhere to minimum character heights based on the package's net quantity and display surface area (Rule 7, Table).
   - *Grouping & Proximity:* Unit Sale Price (USP) must be situated alongside or in immediate proximity to the Maximum Retail Price (MRP) (Rule 6(11)).

### The Proposed Multimodal Paradigm
To bridge this gap, NiyamCheck formalizes a **Multimodal Legal Metrology Framework** that unites:
- **Visual & Layout Analysis:** Spatial panel mapping, Principal Display Panel (PDP) identification, localized crop contrast and sharpness evaluation, and relative font height ratio estimation.
- **Robust Multi-Scale OCR:** Localized token recognition and normalized bounding box mapping `[ymin, xmin, ymax, xmax]`.
- **Semantic Information Extraction & Disambiguation:** Contextual entity linking that resolves competing numbers/dates and parses statutory sub-element completeness.
- **Rule-Based Legal Reasoning:** Deterministic evaluation against codified Legal Metrology rules across **5 verification dimensions**.
- **Auditable Multimodal Evidence:** Generating transparent visual proof crops, layout coordinates, readability metrics, and statutory citations.

---

## 2. The 5-Pillar Declaration Verification Model

Under the multimodal framework, verifying a mandatory declaration $D_i$ requires evaluating five distinct orthogonal dimensions:

```
                      +-----------------------------+
                      |   Mandatory Declaration     |
                      |          Check              |
                      +-----------------------------+
                                     |
         +---------------------------+---------------------------+
         |              |            |            |              |
         v              v            v            v              v
   [ 1. Existence ] [ 2. Complete ] [ 3. Readable ] [ 4. Placed ] [ 5. Interpreted ]
   Is it present   Are statutory   Is text legible Is it on PDP  Is semantic role
   on the label?   sub-elements    under visual    and correctly disambiguated
                   satisfied?      conditions?     grouped?      accurately?
```

### Pillar 1: Existence
- **Objective:** Determine whether candidate textual evidence for declaration $D_i$ exists across any scanned packaging face.
- **States:** `PRESENT`, `MISSING`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`.
- **Statutory Guardrail:** If an unphotographed panel could plausibly contain the declaration, the status is conservatively set to `NOT_VERIFIABLE` rather than falsely asserting a non-compliant `MISSING` violation.

### Pillar 2: Completeness
- **Objective:** Verify that all mandatory sub-components prescribed by statute are present within the declaration.
- **Sub-Element Specifications:**
  - **Net Quantity (LM-NQ-001):** Requires both a numerical magnitude and a standard metric unit prescribed under the Second Schedule ($g, kg, ml, l, m, N$). Bare numbers (e.g. `200`) or non-standard abbreviations fail completeness.
  - **Maximum Retail Price (LM-MRP-001):** Requires currency identifier (₹ / Rs.), numerical price, and statutory tax qualification (`inclusive of all taxes` / `incl. of all taxes`).
  - **Address of Responsible Entity (LM-ADDR-001):** Requires commercial premises name, street/locality, city, state, and a valid 6-digit postal PIN code.
  - **Date Information (LM-DATE-001):** Requires valid month and year accompanied by statutory prefix (`MFD`, `MFG`, `PKD`, or `PACKED`).
  - **Consumer Care (LM-CARE-001):** Requires at least one actionable contact channel (telephone number, email address, or dedicated postal address) linked to a designated redressal official or cell.

### Pillar 3: Readability & Visual Clarity
- **Objective:** Quantify whether the printed declaration is visually legible to consumers and enforcement officers under real-world packaging conditions.
- **Evaluated Visual Metrics:**
  - **Local Contrast Ratio ($C$):** Evaluates foreground text luminance against the local packaging background. Low contrast ink (e.g. gray on silver foil) reduces readability.
  - **Local Sharpness / Blur ($\sigma^2_{Lap}$):** Variance of the Laplacian over the cropped declaration bounding box. Defocused, motion-blurred, or crinkled text is flagged for review.
  - **Relative Font Height Ratio ($R_{font}$):** Estimated height of characters relative to panel height, flagging illegibly diminutive text.
  - **Distortion / Specular Occlusion:** Detection of glare saturation over character strokes.

### Pillar 4: Appropriate Placement & Layout
- **Objective:** Ensure the declaration complies with spatial layout rules specified in the Legal Metrology (Packaged Commodities) Rules, 2011:
  - **Principal Display Panel (PDP) Mandate:** Under Rule 6(1)(b) & (c) and Rule 7, common commodity name and Net Quantity must appear on the Principal Display Panel (the face designed to be shown to consumers at retail).
  - **Proximity & Grouping:** Under Rule 6(11), Unit Sale Price (USP) must appear adjacent to or directly below the MRP. Manufacturer name and manufacturing facility address must be spatially linked.
  - **Non-Deceptive Placement:** Declarations must not be obscured by folds, tucks, sealing crimps, or background artwork.

### Pillar 5: Correct Semantic Interpretation & Disambiguation
- **Objective:** Eliminate confusion caused by competing packaging text through contextual disambiguation:
  - **Nutrient vs. Net Weight:** Disambiguating `"Protein 5g"` or `"Serving Size 30g"` from package `"Net Wt: 200g"`.
  - **Temporal Disambiguation:** Distinguishing Manufacturing Date (`MFD 06/2026`) from Expiry Date (`EXP 12/2026`) and Batch Code (`B.No. 402`).
  - **Commercial Role Disambiguation:** Classifying entity mentions into Brand Owner, Manufacturer, Co-Packer, or Importer based on qualifying prefixes (`Mfg by`, `Mktd by`, `Packed by`).

---

## 3. Mathematical Formulations

### 3.1 Local Contrast Metric
For a cropped declaration region $I_{crop}$ with grayscale pixel values in $[0, 255]$:
$$\text{RMS Contrast: } C_{rms} = \sqrt{\frac{1}{N} \sum_{i=1}^N (I_i - \bar{I})^2}$$
$$\text{Michelson Contrast: } C_{michelson} = \frac{I_{max} - I_{min}}{I_{max} + I_{min} + \epsilon}$$
A declaration crop is classified as having acceptable visual contrast if $C_{rms} \ge 20.0$ or $C_{michelson} \ge 0.35$.

### 3.2 Local Sharpness (Modified Laplacian Variance)
$$\sigma^2_{Lap} = \frac{1}{N} \sum_{x,y} \left( \nabla^2 I(x,y) - \overline{\nabla^2 I} \right)^2$$
Where $\nabla^2 I$ is computed via convolution with the discrete Laplacian kernel:
$$K = \begin{bmatrix} 0 & 1 & 0 \\ 1 & -4 & 1 \\ 0 & 1 & 0 \end{bmatrix}$$
Text crop sharpness is rated:
- **Sharp / High Clarity:** $\sigma^2_{Lap} \ge 80.0$
- **Marginal / Needs Review:** $25.0 \le \sigma^2_{Lap} < 80.0$
- **Blurred / Illegible:** $\sigma^2_{Lap} < 25.0$

### 3.3 Relative Font Height Ratio & Rule 7 Verification
For an image with height $H_{img}$ (pixels) and a text line bounding box $[ymin, xmin, ymax, xmax]$:
$$h_{rel} = ymax - ymin$$
$$h_{px} = h_{rel} \times H_{img}$$
Under Rule 7 of PCR 2011, packages with net weight $> 200\text{ g}$ up to $1\text{ kg}$ require minimum numeral height of $4.0\text{ mm}$ on normal packages. When physical DPI calibration is available, physical height is verified directly. In pixel-normalized inspection, $h_{rel}$ is evaluated against layout proportion thresholds ($h_{rel} \ge 0.015$ for standard packaging views).

### 3.4 Spatial Grouping Proximity
For two bounding boxes $B_1 = [y_1, x_1, y_2, x_2]$ and $B_2 = [y'_1, x'_1, y'_2, x'_2]$:
$$d_{vertical} = \max(0.0, y'_1 - y_2, y_1 - y'_2)$$
$$d_{horizontal} = \max(0.0, x'_1 - x_2, x_1 - x'_2)$$
$$D_{proximity}(B_1, B_2) = \sqrt{d_{vertical}^2 + d_{horizontal}^2}$$
Declarations are verified as spatially grouped if $D_{proximity}(B_1, B_2) \le 0.15$ (within $15\%$ of total packaging dimension).

---

## 4. Architectural System Diagram

```
+-------------------------------------------------------------------------+
|                    Multimodal Input Ingestion                           |
|  Multi-Panel Uploads (Front / Back / Left / Right / Top / Bottom)       |
+-------------------------------------------------------------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+---------------------------------+     +---------------------------------+
|   Visual & Layout Analysis      |     |  Multi-Scale Text Localization  |
| - Principal Display Panel (PDP) |     | - OCR Token & Line Coordinates  |
| - Local Contrast & Blur on Crop |     | - Normalized Boxes [y1,x1,y2,x2]|
| - Font Height Ratio (Rule 7/8)  |     | - Confidence Profiling          |
| - Spatial Proximity & Grouping  |     +---------------------------------+
+---------------------------------+                      |
         |                                               |
         +---------------------------+-------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|            Contextual Semantic Extraction & Disambiguation              |
| - Nutrient vs Net Weight Separation                                     |
| - Multi-Date Disambiguation (MFD / PKD / EXP / Batch)                   |
| - Commercial Entity Disambiguation (Mfg / Packer / Importer / Marketer) |
| - Sub-Element Completeness Parser (PIN, Tax Clause, SI Units)           |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Deterministic Legal Reasoning Engine                   |
|  Evaluates: Existence + Completeness + Readability + Placement          |
|  Codified Legal Metrology Rules (PCR 2011 Rules 6, 7, 8, 9, 18)         |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|             Auditable Multimodal Evidence Package & Report              |
| - Bounding Box Overlay + High-Res Crop                                  |
| - Readability & Layout Verification Metrics                             |
| - Authoritative Statutory Citations & Official NIC Links                |
| - Tamper-Evident SHA-256 Audit Digest                                   |
+-------------------------------------------------------------------------+
```

---

## 5. Summary of Compliance Impact

| Evaluation Dimension | OCR-Only Approach | NiyamCheck Multimodal Framework |
|---|---|---|
| **Text Presence** | Binary string match. | Bounding box localization with multi-panel provenance. |
| **Completeness** | Ignored (partial string passes). | Deterministically verifies all statutory sub-components. |
| **Readability** | Blind to blur or distortion. | Evaluates local Michelson/RMS contrast and Laplacian sharpness on crops. |
| **Placement** | No spatial awareness. | Verifies Principal Display Panel (PDP) and spatial proximity grouping. |
| **Interpretation** | Confuses nutrition tables with Net Qty. | Semantic disambiguation separates nutrient grams, batch codes, and entity roles. |
| **Enforcement Verdict** | Prone to false accusations. | Conservative status model (`PASS`, `POTENTIAL_ISSUE`, `REVIEW`, `NOT_VERIFIABLE`). |
| **Evidence** | Plain text string. | Visual crop + layout coordinates + readability metrics + statutory citations + SHA-256 hash. |

This multimodal framework transforms automated compliance checking from an error-prone text extraction exercise into an audit-grade, legally grounded packaging inspection system.
