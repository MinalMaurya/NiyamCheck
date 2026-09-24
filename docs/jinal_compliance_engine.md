# Jinal — Compliance Engine + Legal Intelligence Backend

## Objective

Jinal owns the decision-making layer of NiyamCheck. Minal is responsible for information collection and extraction, while Jinal determines how gathered package information should be evaluated against the applicable Legal Metrology requirements.

The core pipeline is:

Extracted Information -> Applicable Rule -> Validation -> Finding -> Legal Explanation

## Scope

### 1. Compliance Engine

Jinal must evaluate declarations against mandatory packaged-commodity requirements, including:

- mandatory declaration checks
- rule-wise validation
- field validation
- missing declaration detection
- invalid or incomplete declaration detection
- conditional requirements
- warning conditions
- potential issue detection
- not-verifiable conditions
- multi-image compliance aggregation
- contradiction and conflict detection

The engine should produce conservative, explainable results instead of over-claiming compliance from incomplete evidence.

### 2. Legal Rules and Rule Mapping

Jinal manages the legal knowledge layer for:

- Legal Metrology rules
- Packaged Commodities Rules
- amendments and rule references
- applicability conditions
- legal source metadata

Each extracted field must be mapped to an applicable rule and validated according to the relevant statutory requirement.

### 3. Legal Search and Retrieval

The backend must support:

- legal source search
- rule search
- amendment search
- rule retrieval
- legal source references
- relevant rule selection

This layer allows the system to justify each finding with official legal basis.

### 4. Evidence Mapping

Each finding must be supported by evidence, such as:

- image ID
- panel information
- OCR text snippet
- bounding-box coordinates
- source confidence
- related rule or legal reference

This is essential for making the system auditable and demonstrably better than simple OCR.

## Expected Output

The final deliverable is:

A reliable compliance and legal engine that converts extracted package information into rule-wise, explainable and evidence-linked compliance findings.

## Implementation Mapping in This Repository

The project already contains the main implementation in the following areas:

- backend/compliance/models.py
- backend/compliance/rules.py
- backend/compliance/validators.py
- backend/compliance/rule_engine.py
- backend/legal_knowledge/service.py
- backend/legal_knowledge/retriever.py
- backend/evidence/mapper.py
- backend/api/v1/legal.py
- backend/services/analysis_service.py

## Validation Expectations

The system should ensure:

- every mandatory field is checked
- incomplete or missing declarations are treated conservatively
- multiple panels are aggregated correctly
- explanations are grounded in legal and evidence context
- overall compliance status is never overstated

## Example Behavior

Given extracted data such as:

- MRP = ₹50
- Net Quantity = 500 g
- Manufacturer = ABC Pvt Ltd
- Consumer Care = Present

The engine should evaluate each item individually and produce a final output such as:

- MRP -> Verified
- Net Quantity -> Verified
- Manufacturer -> Verified
- Consumer Care -> Verified
- Country of Origin -> Requires Review

This demonstrates a rule-based compliance engine rather than a simple OCR-only text extraction workflow.
