/**
 * NiyamCheck Consumer Module Utilities
 * Maps raw backend/inspection statuses to the 4 standardized consumer categories:
 * - Verified: All mandatory declarations are present and compliant
 * - Requires Review: Some declarations need closer inspection, missing panels, or partial evidence
 * - Potential Issue: Apparent discrepancies or missing required statutory elements
 * - Not Verifiable: Packaging angle not photographed or text illegible
 */

export const CONSUMER_STATUS_CATEGORIES = {
  VERIFIED: 'Verified',
  REQUIRES_REVIEW: 'Requires Review',
  POTENTIAL_ISSUE: 'Potential Issue',
  NOT_VERIFIABLE: 'Not Verifiable',
};

export function getConsumerStatus(rawStatus) {
  const norm = (rawStatus || '').toUpperCase().trim();

  switch (norm) {
    case 'COMPLIANT':
    case 'PASS':
    case 'VERIFIED':
    case 'PRESENT':
      return {
        category: CONSUMER_STATUS_CATEGORIES.VERIFIED,
        badgeClass: 'consumer-badge-verified',
        color: '#10B981',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        text: '#065F46',
        description: 'All checked mandatory declarations are clearly visible and match standards.',
      };

    case 'PARTIALLY_VERIFIABLE':
    case 'NEEDS_REVIEW':
    case 'REVIEW':
    case 'UNCLEAR':
    case 'REQUIRES_REVIEW':
      return {
        category: CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW,
        badgeClass: 'consumer-badge-review',
        color: '#F59E0B',
        bg: '#FFFBEB',
        border: '#FDE68A',
        text: '#92400E',
        description: 'Some details could not be fully checked from the uploaded photo(s). Adding more sides of the package is recommended.',
      };

    case 'NON_COMPLIANT':
    case 'POTENTIAL_ISSUE':
    case 'POTENTIAL_ISSUES':
    case 'FAIL':
    case 'MISSING':
      return {
        category: CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE,
        badgeClass: 'consumer-badge-issue',
        color: '#F43F5E',
        bg: '#FFF1F2',
        border: '#FECDD3',
        text: '#9F1239',
        description: 'A possible declaration discrepancy was detected based on the visible image evidence.',
      };

    case 'NOT_VERIFIABLE':
    case 'UNABLE_TO_VERIFY':
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return {
        category: CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE,
        badgeClass: 'consumer-badge-unverifiable',
        color: '#64748B',
        bg: '#F8FAFC',
        border: '#E2E8F0',
        text: '#334155',
        description: 'Key packaging faces or text were not clearly readable in the provided image(s).',
      };
  }
}

/**
 * Standard declaration field definitions for consumer presentation
 */
export const CONSUMER_DECLARATION_DEFINITIONS = [
  {
    id: 'product_name',
    label: 'Product Identity / Common Name',
    category: 'Identity',
    hint: 'Usually displayed on the front panel (Principal Display Panel).',
  },
  {
    id: 'net_quantity',
    label: 'Net Weight / Quantity',
    category: 'Quantity',
    hint: 'Must be in standard metric units (e.g., g, kg, ml, l) on the front or lower panel.',
  },
  {
    id: 'mrp',
    label: 'Maximum Retail Price (MRP)',
    category: 'Pricing',
    hint: 'Must be in Indian Rupees (₹ or Rs.) and explicitly state "Inclusive of all taxes".',
  },
  {
    id: 'date_information',
    label: 'Manufacture / Packaging Date',
    category: 'Freshness',
    hint: 'Month and year of manufacture or packaging, often near the batch stamp.',
  },
  {
    id: 'manufacturer',
    label: 'Manufacturer / Packer Name',
    category: 'Accountability',
    hint: 'Corporate identity responsible for making or packing the product.',
  },
  {
    id: 'address',
    label: 'Manufacturer Postal Address',
    category: 'Accountability',
    hint: 'Complete physical address with city, state, and 6-digit PIN code.',
  },
  {
    id: 'consumer_care',
    label: 'Customer Care Details',
    category: 'Customer Support',
    hint: 'Toll-free helpline phone number, email address, or grievance cell.',
  },
  {
    id: 'country_of_origin',
    label: 'Country of Origin',
    category: 'Trade & Origin',
    hint: 'Country where the item was made or packed (e.g., "Made in India").',
  },
];

/**
 * Parses an InspectionSession into consumer-friendly product information,
 * clearly dividing detected declarations from unverified ones without inventing data.
 */
export function parseConsumerProductInfo(session) {
  if (!session) return null;

  const combined = session.combined_fields || {};

  const productName = combined.product_name?.value || session.product_name || 'Unidentified Commodity';
  const brandOrMfg =
    combined.manufacturer?.value ||
    combined.packer?.value ||
    combined.importer?.value ||
    'Not detected on pack';
  const productCategory = session.product_category || 'Packaged Commodity';

  const detectedDeclarations = [];
  const unverifiedDeclarations = [];

  CONSUMER_DECLARATION_DEFINITIONS.forEach((def) => {
    const fieldData = combined[def.id];
    const val = fieldData?.value;
    const status = (fieldData?.status || '').toUpperCase();
    const sourcePanel = fieldData?.source_panel || null;

    const isPresent = Boolean(val && val.trim() && status !== 'MISSING' && status !== 'NOT_VERIFIABLE');

    if (isPresent) {
      detectedDeclarations.push({
        ...def,
        value: val,
        rawText: fieldData?.raw_text || val,
        sourcePanel,
        confidence: fieldData?.confidence || 1.0,
      });
    } else {
      unverifiedDeclarations.push({
        ...def,
        value: null,
        reason:
          status === 'MISSING'
            ? 'Declared value was not detected on the submitted packaging photo(s).'
            : 'Could not be verified from submitted photo(s). Adding more angles may help.',
        sourcePanel: null,
      });
    }
  });

  return {
    inspectionId: session.inspection_id,
    createdAt: session.created_at,
    productName,
    brandOrMfg,
    productCategory,
    status: session.status,
    consumerStatus: getConsumerStatus(session.status),
    images: session.images || [],
    detectedDeclarations,
    unverifiedDeclarations,
    totalDeclarationsChecked: CONSUMER_DECLARATION_DEFINITIONS.length,
    detectedCount: detectedDeclarations.length,
    unverifiedCount: unverifiedDeclarations.length,
  };
}

/**
 * Plain-language consumer descriptions and "Why Does This Matter?" context
 * for the 8 canonical Legal Metrology packaging declarations
 */
export const CONSUMER_RULE_DETAILS = {
  'LM-PN-001': {
    simpleName: 'Product Identity / Common Name',
    whyItMatters: 'Identifies what you are buying. Clear generic commodity names prevent misleading promotional branding.',
    passExplanation: 'The common product identity was clearly detected on the packaging.',
    reviewExplanation: 'The product identity was not detected on the submitted photo(s). Check the front panel.',
    issueExplanation: 'The generic commodity name appears missing or obscured.',
  },
  'LM-NQ-001': {
    simpleName: 'Net Quantity (Weight / Volume)',
    whyItMatters: 'Ensures fair quantity for your money. Mandatory metric units (g, kg, ml) let you compare unit prices accurately across brands.',
    passExplanation: 'Net quantity is declared in standard metric units.',
    reviewExplanation: 'Net weight was not detected on submitted photo(s). Usually printed on the front or lower panel.',
    issueExplanation: 'Net quantity declaration lacks standard metric units or appears irregular.',
  },
  'LM-MRP-001': {
    simpleName: 'Maximum Retail Price (MRP)',
    whyItMatters: 'Protects against arbitrary overcharging. Under Indian law, no retailer can charge above the printed MRP inclusive of all taxes.',
    passExplanation: 'Maximum Retail Price is declared with statutory tax-inclusive designation.',
    reviewExplanation: 'MRP was not observed on the submitted photo(s). Often printed near the barcode or sealing crimp.',
    issueExplanation: 'MRP declaration is missing currency designation or tax-inclusive statement.',
  },
  'LM-DATE-001': {
    simpleName: 'Manufacture / Packaging Date',
    whyItMatters: 'Guarantees freshness transparency so you can judge shelf life, verify "best before" periods, and avoid stale goods.',
    passExplanation: 'Manufacturing or packaging date is clearly declared.',
    reviewExplanation: 'Date code was not detected on submitted photo(s). Frequently stamped on the bottom or near the seal.',
    issueExplanation: 'Date of manufacture or packaging appears illegible or missing.',
  },
  'LM-MFG-001': {
    simpleName: 'Manufacturer / Packer Identity',
    whyItMatters: 'Fixes corporate accountability. Consumers have a legal right to know which company produced or packed the item.',
    passExplanation: 'Responsible manufacturer or packer is verified.',
    reviewExplanation: 'Manufacturer corporate name was not confirmed on submitted photo(s). Check the back panel.',
    issueExplanation: 'Manufacturer corporate name appears absent or incomplete.',
  },
  'LM-ADDR-001': {
    simpleName: 'Manufacturer Postal Address',
    whyItMatters: 'Enables official communication. Provides a complete physical address with city and postal PIN code for legal inquiries.',
    passExplanation: 'Complete manufacturer postal address is confirmed.',
    reviewExplanation: 'Full physical address was not observed on submitted photo(s).',
    issueExplanation: 'Postal address appears incomplete or lacks a valid PIN code.',
  },
  'LM-CARE-001': {
    simpleName: 'Customer Care Details',
    whyItMatters: 'Guarantees a grievance channel. Requires a toll-free helpline, email, or redressal cell for product complaints or refund requests.',
    passExplanation: 'Customer care telephone or email contact is verified.',
    reviewExplanation: 'Helpline contact details were not detected on submitted photo(s).',
    issueExplanation: 'Customer care grievance channel appears missing.',
  },
  'LM-COO-001': {
    simpleName: 'Country of Origin',
    whyItMatters: 'Ensures origin transparency so you know where the commodity was produced or assembled, supporting informed trade choices.',
    passExplanation: 'Country of origin is clearly declared on the packaging.',
    reviewExplanation: 'Country of origin was not confirmed on submitted photo(s).',
    issueExplanation: 'Country of origin statement appears absent.',
  },
};

/**
 * Parses inspection session into the 4 evidence-driven consumer result categories,
 * separating "What is OK?" from "What needs attention?" with "Why does this matter?" context.
 */
export function parseConsumerCheckResult(session) {
  if (!session) {
    return { isIncomplete: true };
  }

  const rawFindings = session.findings || session.compliance?.evaluations || [];
  const consumerStatus = getConsumerStatus(session.status);

  // Derive human-friendly verdict titles
  let verdictTitle = 'Packaging Declarations Verified';
  let verdictDescription = 'All checked mandatory declarations are clearly present and match Legal Metrology packaging standards.';

  if (consumerStatus.category === CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW) {
    verdictTitle = 'Requires Closer Review';
    verdictDescription = 'Some declarations could not be fully confirmed from the uploaded photo(s). Adding photos of other packaging faces is recommended.';
  } else if (consumerStatus.category === CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE) {
    verdictTitle = 'Potential Packaging Issue Flagged';
    verdictDescription = 'One or more mandatory declarations on this package appear incomplete or do not match standard requirements.';
  } else if (consumerStatus.category === CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE) {
    verdictTitle = 'Package Check Not Verifiable';
    verdictDescription = 'The submitted packaging photos were too unclear or key package angles were not photographed to verify mandatory declarations.';
  }

  const okFindings = [];
  const attentionFindings = [];

  rawFindings.forEach((finding) => {
    const ruleId = finding.rule_id || finding.id;
    const ruleDetail = CONSUMER_RULE_DETAILS[ruleId] || {
      simpleName: finding.name || ruleId,
      whyItMatters: 'Mandatory declaration required under Indian packaging regulations.',
      passExplanation: finding.reason || 'Verified on the packaging.',
      reviewExplanation: finding.reason || 'Could not be verified from submitted photo(s).',
      issueExplanation: finding.reason || 'Apparent discrepancy flagged.',
    };

    const normStatus = (finding.status || '').toUpperCase();
    const isPass = normStatus === 'PASS' || normStatus === 'COMPLIANT';

    // Map evidence
    const evidenceText = finding.evidence?.text || null;
    const evidencePanel = finding.evidence?.source_panel || finding.evidence?.panel || null;
    const confidencePct = finding.confidence ? Math.round(finding.confidence * 100) : null;

    if (isPass) {
      okFindings.push({
        ruleId,
        name: finding.name || ruleDetail.simpleName,
        simpleName: ruleDetail.simpleName,
        status: 'Verified',
        reason: finding.reason || ruleDetail.passExplanation,
        whyItMatters: ruleDetail.whyItMatters,
        evidenceText,
        evidencePanel,
        confidencePct,
      });
    } else {
      const isIssue = normStatus === 'FAIL' || normStatus === 'NON_COMPLIANT' || normStatus === 'POTENTIAL_ISSUE';
      const category = isIssue ? 'Potential Issue' : 'Requires Review';
      const reason = isIssue ? (finding.reason || ruleDetail.issueExplanation) : (finding.reason || ruleDetail.reviewExplanation);

      let consumerAdvice = 'Check other panels of the package (back, sides, or bottom) to locate this declaration.';
      if (isIssue) {
        consumerAdvice = 'Verify whether this declaration is clearly printed on the physical package. Retailers cannot alter or omit mandatory labels.';
      }

      attentionFindings.push({
        ruleId,
        name: finding.name || ruleDetail.simpleName,
        simpleName: ruleDetail.simpleName,
        category,
        isIssue,
        reason,
        whyItMatters: ruleDetail.whyItMatters,
        consumerAdvice,
        evidenceText,
        evidencePanel,
        confidencePct,
      });
    }
  });

  return {
    isIncomplete: rawFindings.length === 0,
    inspectionId: session.inspection_id,
    productName: session.combined_fields?.product_name?.value || session.product_name || 'Packaged Commodity',
    category: session.product_category || 'Packaged Commodity',
    status: session.status,
    consumerStatus,
    verdictTitle,
    verdictDescription,
    okFindings,
    attentionFindings,
    totalFindings: rawFindings.length,
    okCount: okFindings.length,
    attentionCount: attentionFindings.length,
    images: session.images || [],
  };
}
