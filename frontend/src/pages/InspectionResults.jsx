import React, { useEffect, useState } from 'react';
import {
  FileText,
  Download,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  BookOpen,
  Layers,
  Search,
  Eye,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Hash,
  Package,
  Calendar,
  DollarSign,
  Tag,
  Building,
  MapPin,
  PhoneCall,
  Globe,
  Info,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Scale,
  ShieldAlert,
  Plus,
  Trash2,
  Upload,
  Bookmark,
} from 'lucide-react';
import {
  getInspection,
  downloadReportPdf,
  downloadReportJsonFile,
  getInspectionImageUrl,
  addInspectionImages,
  deleteInspectionImage,
} from '../api/inspections';
import { draftStore } from '../storage/draftStore';
import { StatusBadge } from '../components/StatusBadge';
import { ImageViewer } from '../components/ImageViewer';
import { LegalBasisCard } from '../components/LegalBasisCard';
import { InspectionCoverageCard } from '../components/InspectionCoverageCard';

// Plain-language explanations of codified Legal Metrology requirements
const RULE_PLAIN_LANGUAGE = {
  'LM-PN-001': {
    meaning: 'The common or generic commodity name must be declared on the principal display panel so consumers know what they are buying.',
    why_flagged_fallback: 'The generic product identity was not detected on the submitted packaging angle(s).',
    action_pass: 'The product name is clearly visible on the package.',
    action_review: 'Check the front panel or main packaging face to locate the generic commodity name.',
    action_issue: 'Verify that the generic commodity name is prominently printed.',
  },
  'LM-NQ-001': {
    meaning: 'The net quantity must be stated in standard metric units (e.g., grams, kilograms, milliliters, liters) or count, without unauthorized abbreviations.',
    why_flagged_fallback: 'Net quantity declaration was not observed in standard metric units on the submitted panel(s).',
    action_pass: 'Net quantity is declared in standard metric units.',
    action_review: 'Net quantity is typically printed on the principal display panel or lower right corner of the front face.',
    action_issue: 'Ensure net weight or volume includes standard metric units (g, kg, ml, l) rather than bare numbers or invalid units.',
  },
  'LM-MRP-001': {
    meaning: 'The Maximum Retail Price (MRP) inclusive of all taxes must be declared in Indian Rupees, protecting consumers from arbitrary overcharging.',
    why_flagged_fallback: 'No clear MRP declaration preceded by "MRP" or "₹/Rs." with tax-inclusive wording was detected on submitted panel(s).',
    action_pass: 'Maximum Retail Price is declared with statutory tax-inclusive designation.',
    action_review: 'MRP is frequently printed near the barcode, batch code, or sealing crimp. Check other packaging surfaces.',
    action_issue: 'Verify that the price is printed in Indian Rupees (₹ or Rs.) and explicitly states inclusive of all taxes.',
  },
  'LM-MFG-001': {
    meaning: 'The name of the manufacturer, packer, or importer responsible for the pre-packaged product must be printed for corporate accountability.',
    why_flagged_fallback: 'Manufacturer, packer, or importer corporate entity was not verified on submitted packaging panels.',
    action_pass: 'Responsible manufacturer or packer is clearly declared.',
    action_review: 'Check the back, side, or bottom panel of the package for manufacturer or packer details.',
    action_issue: 'Verify that the manufacturer or packer corporate name is clearly printed.',
  },
  'LM-ADDR-001': {
    meaning: 'The complete physical or postal address including city, state, and/or postal code must be stated for official correspondence.',
    why_flagged_fallback: 'A complete postal address with locality, city, and state/PIN was not observed on the submitted panels.',
    action_pass: 'Manufacturer postal address is verified.',
    action_review: 'Inspect physical package for complete manufacturing premises address and postal code.',
    action_issue: 'Verify whether a complete postal address is printed on the physical packaging.',
  },
  'LM-DATE-001': {
    meaning: 'The month and year of manufacture, packaging, or import must be printed so consumers can determine product freshness.',
    why_flagged_fallback: 'Manufacturing, packaging, or import date was not detected on submitted packaging views.',
    action_pass: 'Manufacturing or packing date is declared.',
    action_review: 'Date codes are often dot-matrix stamped near the crimp, seal, or bottom panel. Check other panels.',
    action_issue: 'Ensure month and year of manufacture or packaging are legible.',
  },
  'LM-CARE-001': {
    meaning: 'A helpline telephone number, email address, or contact office must be provided for consumer grievance redressal.',
    why_flagged_fallback: 'Consumer grievance contact channels (phone, email, or redressal cell) were not observed on submitted panel(s).',
    action_pass: 'Consumer care contact details are verified.',
    action_review: 'Check the back or side panel for customer care phone number, email, or postal grievance address.',
    action_issue: 'Ensure at least one contact channel (phone, email, or address) is clearly printed.',
  },
  'LM-COO-001': {
    meaning: 'The country where the commodity was manufactured or assembled must be declared on the package.',
    why_flagged_fallback: 'Explicit country of origin declaration was not observed on submitted packaging views.',
    action_pass: 'Country of origin is verified.',
    action_review: 'Look for "Made in [Country]", "Product of [Country]", or country declaration printed on the pack.',
    action_issue: 'Verify that country of origin is printed on the physical packaging.',
  },
};

const STANDARD_PANELS = [
  { id: 'FRONT', label: 'Front' },
  { id: 'BACK', label: 'Back' },
  { id: 'LEFT', label: 'Left Side' },
  { id: 'RIGHT', label: 'Right Side' },
  { id: 'TOP', label: 'Top' },
  { id: 'BOTTOM', label: 'Bottom' },
];

export function InspectionResults({ inspectionId, onBack, onOpenInspection }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('consumer'); // 'consumer' | 'images' | 'fields' | 'legal'
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [findingFilter, setFindingFilter] = useState('ALL'); // 'ALL' | 'PASS' | 'REVIEW' | 'POTENTIAL_ISSUE' | 'NOT_VERIFIABLE'
  
  // Modal state
  const [activeEvidenceModal, setActiveEvidenceModal] = useState(null);
  const [activeLegalModal, setActiveLegalModal] = useState(null);

  // Multi-image panel management state
  const [showAddPanelModal, setShowAddPanelModal] = useState(false);
  const [newPanelType, setNewPanelType] = useState('FRONT');
  const [newPanelFiles, setNewPanelFiles] = useState([]);
  const [submittingPanel, setSubmittingPanel] = useState(false);
  const [panelActionError, setPanelActionError] = useState(null);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);

  // Evidence saving and inspection storage state
  const [inspectionSaved, setInspectionSaved] = useState(false);
  const [savedEvidenceMap, setSavedEvidenceMap] = useState({});

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!inspectionId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getInspection(inspectionId);
        if (isMounted) {
          setSession(data);
          if (data.evidence && data.evidence.length > 0) {
            setSelectedEvidence(data.evidence[0]);
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load inspection details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [inspectionId]);

  // Handle ESC key for modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveEvidenceModal(null);
        setActiveLegalModal(null);
        setShowAddPanelModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddPanelSubmit = async (e) => {
    e.preventDefault();
    if (!newPanelFiles || newPanelFiles.length === 0) {
      setPanelActionError('Please select at least one image file.');
      return;
    }
    setSubmittingPanel(true);
    setPanelActionError(null);
    try {
      const updated = await addInspectionImages({
        inspectionId: session.inspection_id,
        files: newPanelFiles,
        panels: [newPanelType],
      });
      setSession(updated);
      setShowAddPanelModal(false);
      setNewPanelFiles([]);
    } catch (err) {
      setPanelActionError(err.message || 'Failed to add packaging panel.');
    } finally {
      setSubmittingPanel(false);
    }
  };

  const handleRemovePanel = async (image) => {
    if ((session?.images || []).length <= 1) {
      alert('Cannot remove panel: An inspection must retain at least one packaging image.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to remove the ${image.panel || 'packaging'} panel? Any declarations and evidence derived strictly from this image will be removed.`
      )
    ) {
      return;
    }
    setPanelActionError(null);
    try {
      const updated = await deleteInspectionImage(session.inspection_id, image.image_id);
      setSession(updated);
      if (selectedEvidence && selectedEvidence.image_id === image.image_id) {
        setSelectedEvidence(null);
      }
      if (activeEvidenceModal && activeEvidenceModal.image?.image_id === image.image_id) {
        setActiveEvidenceModal(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to remove packaging panel.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <RefreshCw size={36} className="spinning" style={{ margin: '0 auto 1rem', color: '#3B82F6' }} />
        <p>Loading inspection session {inspectionId}...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem' }}>
        <AlertTriangle size={48} style={{ margin: '0 auto 1rem', color: '#EF4444' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Unable to Load Inspection
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {error || `Inspection ID "${inspectionId}" was not found in the local repository.`}
        </p>
        <button type="button" className="btn btn-primary touch-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  const comp = session.compliance || {};
  const rawEvaluations = comp.evaluations || [];
  const rawFindings = session.findings || [];
  const fields = session.combined_fields || {};
  const images = session.images || [];
  const allEvidence = session.evidence || [];

  // Helper to find evidence object for a rule or field
  const findEvidenceForItem = (item) => {
    if (!item) return null;
    if (item.evidence && typeof item.evidence === 'object' && item.evidence.text) {
      return item.evidence;
    }
    const ruleId = item.rule_id || item.ruleId;
    const fieldKey = item.field || item.field_name || item.id || item.key;

    // Check allEvidence by rule
    if (ruleId) {
      const byRule = allEvidence.find((ev) => ev.rule_id === ruleId);
      if (byRule) return byRule;
    }

    // Check allEvidence by field
    if (fieldKey) {
      const byField = allEvidence.find((ev) => ev.field === fieldKey);
      if (byField) return byField;
    }

    // Check images evidence arrays
    for (const img of images) {
      if (img.evidence && Array.isArray(img.evidence)) {
        const match = img.evidence.find(
          (ev) => (ruleId && ev.rule_id === ruleId) || (fieldKey && ev.field === fieldKey)
        );
        if (match) {
          return {
            ...match,
            image_id: img.image_id,
            panel: img.panel || match.panel || 'UNKNOWN',
          };
        }
      }
    }

    // Check if the finding or item has direct evidence properties (from aggregator or field)
    const detectedVal =
      item.detected_value ||
      item.evidence_text ||
      (typeof item.evidence === 'string' ? item.evidence : null) ||
      item.fieldData?.value ||
      item.value;

    const sourcePanel = item.package_panel || item.fieldData?.source_panel || item.panel;
    const sourceImageId = item.source_image_id || item.image_id;

    if (detectedVal || sourcePanel || sourceImageId) {
      const resolvedImg = sourceImageId
        ? images.find((i) => i.image_id === sourceImageId)
        : sourcePanel
        ? images.find((i) => (i.panel || '').toUpperCase() === (sourcePanel || '').toUpperCase())
        : images[0];

      return {
        rule_id: ruleId || item.rule_id,
        field: fieldKey,
        text: detectedVal || (sourcePanel ? `Declaration on ${sourcePanel} panel` : 'Detected declaration'),
        detected_value: detectedVal || null,
        image_id: resolvedImg?.image_id || sourceImageId || images[0]?.image_id,
        panel: sourcePanel || resolvedImg?.panel || images[0]?.panel || 'UNKNOWN',
        confidence: item.confidence || item.fieldData?.confidence || 0.85,
        bounding_box: item.bounding_box || null,
      };
    }

    return null;
  };

  // Harmonize findings with evaluations
  const unifiedFindings = (rawFindings.length > 0 ? rawFindings : rawEvaluations).map((f) => {
    const matchingEval = rawEvaluations.find((e) => e.rule_id === f.rule_id) || {};
    const rawStatus = (f.status || matchingEval.status || 'NOT_VERIFIABLE').toUpperCase();
    const normalizedStatus =
      rawStatus === 'COMPLIANT' || rawStatus === 'PASS'
        ? 'PASS'
        : rawStatus === 'FAIL' || rawStatus === 'POTENTIAL_ISSUE' || rawStatus === 'NON_COMPLIANT'
        ? 'POTENTIAL_ISSUE'
        : rawStatus === 'UNCLEAR' || rawStatus === 'NEEDS_REVIEW' || rawStatus === 'REVIEW'
        ? 'REVIEW'
        : 'NOT_VERIFIABLE';

    const evidenceObj = findEvidenceForItem({ ...matchingEval, ...f });
    const fieldKey = f.field || matchingEval.field;
    const matchingField = fieldKey ? fields[fieldKey] : null;
    const conflictsList = f.conflicts || matchingField?.conflicts || [];
    const additionalSources = f.additional_sources || matchingField?.additional_sources || [];

    return {
      rule_id: f.rule_id || matchingEval.rule_id,
      name: f.name || matchingEval.name || 'Statutory Requirement',
      category: f.category || matchingEval.category || 'General',
      requirement: f.requirement || matchingEval.requirement || 'Mandatory packaged commodity declaration',
      status: normalizedStatus,
      detected_value: f.detected_value || matchingEval.detected_value || null,
      explanation: f.explanation || matchingEval.reason || 'Evaluation completed.',
      package_panel: f.package_panel || matchingEval.package_panel || (evidenceObj ? evidenceObj.panel : null),
      confidence: f.confidence || matchingEval.confidence || (evidenceObj ? evidenceObj.confidence : 0),
      why_flagged: f.why_flagged || matchingEval.why_flagged || null,
      what_can_i_do: f.what_can_i_do || matchingEval.what_can_i_do || null,
      legal_basis: matchingEval.legal_basis || f.legal_basis || [],
      evidence: evidenceObj || f.evidence || matchingEval.evidence,
      field: fieldKey,
      conflicts: conflictsList,
      additional_sources: additionalSources,
    };
  });

  // Dynamic summary counts
  const totalChecked = unifiedFindings.length;
  const passCount = unifiedFindings.filter((i) => i.status === 'PASS').length;
  const reviewCount = unifiedFindings.filter((i) => i.status === 'REVIEW').length;
  const issueCount = unifiedFindings.filter((i) => i.status === 'POTENTIAL_ISSUE').length;
  const unverifiedCount = unifiedFindings.filter((i) => i.status === 'NOT_VERIFIABLE').length;

  // Filtered findings for consumer view
  const filteredFindings = unifiedFindings.filter((f) => {
    if (findingFilter === 'ALL') return true;
    return f.status === findingFilter;
  });

  // Overall verdict presentation logic
  const getOverallVerdict = () => {
    const s = (session.status || '').toUpperCase();
    if (s === 'COMPLIANT' || (passCount > 0 && reviewCount === 0 && issueCount === 0 && unverifiedCount === 0)) {
      return {
        title: 'Appears Compliant',
        description: 'All verified statutory declarations are clearly present and satisfy codified Legal Metrology requirements.',
        badgeStatus: 'COMPLIANT',
        bannerClass: 'border-pass',
        bg: 'var(--status-pass-bg)',
        border: 'var(--status-pass-border)',
        Icon: CheckCircle2,
      };
    }
    if (s === 'PARTIALLY_VERIFIABLE') {
      return {
        title: 'Partially Verifiable',
        description:
          images.length === 1
            ? `Single packaging panel (${images[0]?.panel || 'Back'}) submitted. Verified declarations appear compliant, but unobserved requirements require additional panel views for full statutory confirmation.`
            : 'Declarations detected on submitted views appear compliant, but one or more mandatory declarations could not be fully confirmed from the provided angles.',
        badgeStatus: 'PARTIALLY_VERIFIABLE',
        bannerClass: 'border-partial',
        bg: 'var(--status-partial-bg)',
        border: 'var(--status-partial-border)',
        Icon: AlertTriangle,
      };
    }
    if (s === 'NON_COMPLIANT' || issueCount > 0) {
      return {
        title: 'Potential Compliance Issues',
        description: 'Potential discrepancies with codified Packaged Commodities Rules were identified on the submitted packaging views. Review individual findings below.',
        badgeStatus: 'POTENTIAL_ISSUE',
        bannerClass: 'border-fail',
        bg: 'var(--status-fail-bg)',
        border: 'var(--status-fail-border)',
        Icon: XCircle,
      };
    }
    if (reviewCount > 0) {
      return {
        title: 'Needs Review',
        description: 'Certain packaging declarations require manual inspection or clearer photography to confirm statutory compliance.',
        badgeStatus: 'NEEDS_REVIEW',
        bannerClass: 'border-partial',
        bg: 'var(--status-partial-bg)',
        border: 'var(--status-partial-border)',
        Icon: AlertTriangle,
      };
    }
    return {
      title: 'Could Not Be Fully Verified',
      description: 'Insufficient readable declaration text could be verified from the submitted packaging photographs.',
      badgeStatus: 'NOT_VERIFIABLE',
      bannerClass: 'border-neutral',
      bg: 'var(--status-neutral-bg)',
      border: 'var(--status-neutral-border)',
      Icon: HelpCircle,
    };
  };

  const verdict = getOverallVerdict();

  // Detected Information items for "What NiyamCheck Found"
  const detectedItems = [
    {
      id: 'product_name',
      label: 'Product / Generic Name',
      icon: Package,
      fieldData: fields.product_name,
      ruleId: 'LM-PN-001',
    },
    {
      id: 'net_quantity',
      label: 'Net Quantity',
      icon: Tag,
      fieldData: fields.net_quantity,
      ruleId: 'LM-NQ-001',
    },
    {
      id: 'mrp',
      label: 'Maximum Retail Price (MRP)',
      icon: DollarSign,
      fieldData: fields.mrp,
      ruleId: 'LM-MRP-001',
    },
    {
      id: 'date_information',
      label: 'Date (MFD / Expiry)',
      icon: Calendar,
      fieldData: fields.date_information,
      ruleId: 'LM-DATE-001',
    },
    {
      id: 'manufacturer',
      label: 'Manufacturer / Packer',
      icon: Building,
      fieldData: fields.manufacturer?.value ? fields.manufacturer : (fields.packer?.value ? fields.packer : fields.importer),
      ruleId: 'LM-MFG-001',
    },
    {
      id: 'address',
      label: 'Manufacturer Address',
      icon: MapPin,
      fieldData: fields.address,
      ruleId: 'LM-ADDR-001',
    },
    {
      id: 'consumer_care',
      label: 'Consumer Care / Helpline',
      icon: PhoneCall,
      fieldData: fields.consumer_care,
      ruleId: 'LM-CARE-001',
    },
    {
      id: 'country_of_origin',
      label: 'Country of Origin',
      icon: Globe,
      fieldData: fields.country_of_origin,
      ruleId: 'LM-COO-001',
    },
  ];

  // Evidence Modal trigger
  const handleOpenEvidenceModal = (item) => {
    let ev = findEvidenceForItem(item);
    if (!ev) {
      if (images && images.length > 0) {
        ev = {
          rule_id: item.rule_id || item.ruleId || 'LM-EVIDENCE',
          field: item.field || item.id || 'declaration',
          text: item.detected_value || item.name || 'Packaging Inspection',
          image_id: images[0].image_id,
          panel: images[0].panel || 'UNKNOWN',
          confidence: 0.8,
          bounding_box: null,
        };
      } else {
        setSelectedEvidence(null);
        setActiveTab('images');
        return;
      }
    }

    const ruleId = item.rule_id || item.ruleId || ev.rule_id;
    const fieldKey = item.field || item.field_name || item.id || ev.field;
    const sources = [];

    // 1. Primary candidate
    sources.push({
      ...ev,
      label: `Primary (${ev.panel || 'Detected'})`,
    });

    // 2. Conflict candidates
    if (item.conflicts && Array.isArray(item.conflicts)) {
      item.conflicts.forEach((c) => {
        if (c.image_id !== ev.image_id || c.value !== ev.text) {
          const matchingImg = images.find(
            (i) => i.image_id === c.image_id || (i.panel && c.panel && i.panel.toUpperCase() === c.panel.toUpperCase())
          );
          sources.push({
            rule_id: ruleId,
            field: fieldKey,
            text: c.value,
            image_id: c.image_id,
            panel: c.panel,
            confidence: c.confidence || 0.85,
            bounding_box:
              matchingImg?.evidence?.find((e) => e.text?.includes(c.value) || e.field === fieldKey)
                ?.bounding_box || null,
            label: `Conflict (${c.panel})`,
          });
        }
      });
    }

    // 3. Additional sources / duplicates
    if (item.additional_sources && Array.isArray(item.additional_sources)) {
      item.additional_sources.forEach((s) => {
        if (s.image_id !== ev.image_id) {
          const matchingImg = images.find(
            (i) => i.image_id === s.image_id || (i.panel && s.panel && i.panel.toUpperCase() === s.panel.toUpperCase())
          );
          sources.push({
            rule_id: ruleId,
            field: fieldKey,
            text: s.value,
            image_id: s.image_id,
            panel: s.panel,
            confidence: s.confidence || 0.85,
            bounding_box:
              matchingImg?.evidence?.find((e) => e.field === fieldKey)?.bounding_box || null,
            label: `Also detected (${s.panel})`,
          });
        }
      });
    }

    // 4. Other evidence matches across allEvidence
    allEvidence.forEach((otherEv) => {
      if (
        (otherEv.rule_id === ruleId || otherEv.field === fieldKey) &&
        otherEv.image_id !== ev.image_id &&
        !sources.some((s) => s.image_id === otherEv.image_id && s.text === otherEv.text)
      ) {
        sources.push({
          ...otherEv,
          label: `Also detected (${otherEv.panel || 'Panel'})`,
        });
      }
    });

    const matchingImg =
      images.find(
        (img) =>
          img.image_id === ev.image_id ||
          (ev.panel && (img.panel || '').toUpperCase() === (ev.panel || '').toUpperCase())
      ) || images[0];

    setActiveEvidenceIndex(0);
    setActiveEvidenceModal({
      evidence: ev,
      image: matchingImg,
      item,
      sources,
    });
  };

  // Legal Modal trigger
  const handleOpenLegalModal = (item) => {
    setActiveLegalModal(item);
  };

  // Switch to full image viewer with evidence selected
  const handleInspectInViewer = (ev) => {
    setSelectedEvidence(ev);
    setActiveEvidenceModal(null);
    setActiveTab('images');
  };

  // Save full inspection session locally
  const handleSaveInspection = async () => {
    if (!session) return;
    try {
      await draftStore.saveInspectionSession(session);
      setInspectionSaved(true);
      setTimeout(() => setInspectionSaved(false), 3500);
    } catch (err) {
      console.warn('Failed to save inspection:', err);
    }
  };

  // Save specific finding evidence locally
  const handleSaveFindingEvidence = async (finding) => {
    if (!session || !finding) return;
    try {
      await draftStore.saveEvidence({
        inspectionId: session.inspection_id,
        ruleId: finding.rule_id,
        requirement: finding.requirement || finding.name,
        detectedValue: finding.detected_value,
        evidenceText: finding.evidence_text || (typeof finding.evidence === 'string' ? finding.evidence : finding.detected_value),
        packagePanel: finding.package_panel,
        imageId: finding.source_image_id || finding.image_id,
        imageUrl: finding.source_image_id
          ? getInspectionImageUrl(session.inspection_id, finding.source_image_id)
          : null,
        boundingBox: finding.bounding_box,
      });
      setSavedEvidenceMap((prev) => ({ ...prev, [finding.rule_id]: true }));
      setTimeout(() => {
        setSavedEvidenceMap((prev) => ({ ...prev, [finding.rule_id]: false }));
      }, 3000);
    } catch (err) {
      console.warn('Failed to save finding evidence:', err);
    }
  };

  return (
    <div>
      {/* Top Header & Navigation Actions */}
      <div className="page-header">
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm touch-btn"
            onClick={onBack}
            style={{ marginBottom: '0.75rem' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Inspections</span>
          </button>

          {/* Product Identification Banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontFamily: 'var(--font-mono)' }}>
              {session.inspection_id}
            </h1>
            <StatusBadge status={verdict.badgeStatus} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
            {fields.product_name?.value ? (
              <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary-500)' }}>
                {fields.product_name.value}
              </span>
            ) : (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Product name not detected on submitted packaging panels
              </span>
            )}
            <span style={{ color: 'var(--border-bright)' }}>&bull;</span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--status-pass-text)',
                backgroundColor: 'var(--status-pass-bg)',
                padding: '0.2rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--status-pass-border)',
              }}
            >
              Category: {session.product_category || 'Packaged Commodity'}
            </span>
          </div>

          <p className="page-description">
            Evaluated against codified Legal Metrology (Packaged Commodities) Rules, 2011. Tested across {images.length} packaging panel{images.length === 1 ? '' : 's'}.
          </p>
        </div>

        {/* Report Download & Inspection Storage Actions */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={handleSaveInspection}
            title="Save this inspection session locally"
          >
            {inspectionSaved ? <Check size={16} style={{ color: 'var(--status-pass)' }} /> : <Bookmark size={16} />}
            <span>{inspectionSaved ? 'Inspection Saved' : 'Save Inspection'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary touch-btn"
            onClick={() => downloadReportJsonFile(session.inspection_id)}
            title="Export Structured JSON Report"
          >
            <FileText size={16} />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            className="btn btn-primary touch-btn"
            onClick={() => downloadReportPdf(session.inspection_id)}
            title="Download Consumer PDF Report"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Prominent Consumer Overall Status Banner */}
      <div
        className="card"
        style={{
          marginBottom: '1.75rem',
          backgroundColor: verdict.bg,
          borderLeft: `5px solid ${verdict.border}`,
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', maxWidth: '850px' }}>
            <verdict.Icon size={32} style={{ color: verdict.border, flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {verdict.title}
                </h2>
                <span
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-surface)',
                    color: verdict.border,
                    border: `1px solid ${verdict.border}`,
                  }}
                >
                  {session.status || 'COMPLIANCE CHECK COMPLETE'}
                </span>
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '0.35rem', lineHeight: '1.5' }}>
                {verdict.description}
              </p>
              {session.summary && session.summary !== verdict.description && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  {session.summary}
                </p>
              )}
            </div>
          </div>

          {/* Quick Action to switch views */}
          <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm touch-btn"
              onClick={() => setActiveTab('images')}
            >
              <Eye size={14} />
              <span>Inspect Packaging Panels</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Count / Metrics Bar */}
      <div className="summary-metrics-bar">
        <div className="summary-metric-card total">
          <span className="summary-metric-label">Total Checked</span>
          <span className="summary-metric-num">{totalChecked}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Codified Rules</span>
        </div>
        <div className="summary-metric-card pass">
          <span className="summary-metric-label" style={{ color: 'var(--status-pass-text)' }}>✓ Verified</span>
          <span className="summary-metric-num" style={{ color: 'var(--status-pass-text)' }}>{passCount}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Statutory Pass</span>
        </div>
        <div className="summary-metric-card review">
          <span className="summary-metric-label" style={{ color: 'var(--status-partial-text)' }}>⚠ Review Required</span>
          <span className="summary-metric-num" style={{ color: 'var(--status-partial-text)' }}>{reviewCount}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requires Verification</span>
        </div>
        <div className="summary-metric-card issue">
          <span className="summary-metric-label" style={{ color: 'var(--status-fail-text)' }}>❌ Potential Issue</span>
          <span className="summary-metric-num" style={{ color: 'var(--status-fail-text)' }}>{issueCount}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rule Discrepancies</span>
        </div>
        <div className="summary-metric-card unverified">
          <span className="summary-metric-label">○ Unable to Verify</span>
          <span className="summary-metric-num" style={{ color: 'var(--text-muted)' }}>{unverifiedCount}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Insufficient Evidence</span>
        </div>
      </div>

      {/* Package Inspection Coverage */}
      <InspectionCoverageCard
        coverage={session.coverage}
        images={images}
        interactive={true}
        onAddPanel={(panelId) => {
          setNewPanelType(panelId);
          setShowAddPanelModal(true);
        }}
      />

      {/* Primary Navigation Tabs */}
      <div className="tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'consumer' ? 'active' : ''}`}
          onClick={() => setActiveTab('consumer')}
        >
          Consumer Findings & Declarations
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Visual Evidence & Image Viewer ({images.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'fields' ? 'active' : ''}`}
          onClick={() => setActiveTab('fields')}
        >
          Raw Declarations Table
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'legal' ? 'active' : ''}`}
          onClick={() => setActiveTab('legal')}
        >
          Authoritative Legal Provisions
        </button>
      </div>

      {/* TAB 1: Consumer Findings & Declarations (Primary Redesigned View) */}
      {activeTab === 'consumer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Section: "What NiyamCheck Found" (Detected Information Grid) */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={20} style={{ color: 'var(--primary-500)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  What NiyamCheck Found
                </h2>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Extracted from submitted packaging photographs
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Quick summary of statutory declarations extracted directly from the visible text on your product.
            </p>

            <div className="detected-grid">
              {detectedItems.map((item) => {
                const isPresent = Boolean(item.fieldData?.value);
                const val = item.fieldData?.value;
                const conf = Math.round((item.fieldData?.confidence || 0) * 100);
                const evMatch = allEvidence.find((ev) => ev.field === item.id || ev.rule_id === item.ruleId);
                const panel = item.fieldData?.source_panel || (evMatch ? evMatch.panel : null);

                return (
                  <div key={item.id} className="detected-card">
                    <div>
                      <div className="detected-card-header">
                        <div className="detected-card-title">
                          <item.icon size={16} style={{ color: isPresent ? 'var(--primary-500)' : 'var(--text-muted)' }} />
                          <span>{item.label}</span>
                        </div>
                        <StatusBadge
                          status={isPresent ? 'PRESENT' : 'NOT_VERIFIABLE'}
                          size="sm"
                          showIcon={false}
                        />
                      </div>

                      <div className={`detected-card-value ${isPresent ? 'present' : 'missing'}`} style={{ marginTop: '0.65rem' }}>
                        {isPresent ? val : 'Not verified from submitted images'}
                      </div>
                    </div>

                    <div className="detected-card-footer">
                      {isPresent ? (
                        <>
                          <span>
                            Panel: <strong style={{ color: '#FBBF24' }}>{panel || 'Detected'}</strong>
                          </span>
                          <span style={{ color: conf > 75 ? '#34D399' : '#FBBF24' }}>
                            {conf}% confidence
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Check other packaging sides
                        </span>
                      )}
                      {evMatch && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm touch-btn"
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', minHeight: '36px' }}
                          onClick={() => handleOpenEvidenceModal({ ...evMatch, field: item.id })}
                          title="Inspect detected visual region"
                        >
                          <Eye size={12} />
                          <span>Evidence</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Inspection Coverage & 6-Panel Breakdown */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: images.length === 1 ? 'var(--status-partial-bg)' : 'var(--bg-surface-elevated)',
              borderLeft: `4px solid ${images.length === 1 ? 'var(--status-partial)' : 'var(--status-info)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', maxWidth: '820px' }}>
                <Info size={22} style={{ color: images.length === 1 ? 'var(--status-partial)' : 'var(--status-info)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {images.length === 1
                      ? 'Inspection Coverage Warning: Single Packaging Panel Submitted'
                      : `Multi-Panel Inspection Coverage: ${images.length} Packaging Panels Analyzed`}
                  </h3>
                  {images.length === 1 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.5' }}>
                      Only 1 package panel was submitted (<strong>{images[0].panel || 'Back'}</strong>). In commercial retail packaging, mandatory statutory declarations (such as MRP, Net Quantity, or Product Name) are often distributed across different packaging surfaces. Declarations not observed on this panel are flagged for <strong>review</strong> rather than assumed to be absent from the physical product. Add more panels for a more complete inspection.
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.5' }}>
                      Declarations and visual evidence were aggregated across all {images.length} submitted packaging surfaces.
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm touch-btn"
                onClick={() => {
                  const firstUnsubmitted = STANDARD_PANELS.find((p) => !images.some((i) => (i.panel || '').toUpperCase() === p.id));
                  setNewPanelType(firstUnsubmitted ? firstUnsubmitted.id : 'OTHER');
                  setNewPanelFiles([]);
                  setPanelActionError(null);
                  setShowAddPanelModal(true);
                }}
                style={{ flexShrink: 0 }}
              >
                <Plus size={15} />
                <span>Add More Panels</span>
              </button>
            </div>

            {/* Standard 6-Panel Status Grid */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
                Standard Packaging Panels Status:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                {STANDARD_PANELS.map((p) => {
                  const matchedImages = images.filter((i) => (i.panel || '').toUpperCase() === p.id);
                  const isAnalyzed = matchedImages.length > 0;
                  const totalWords = matchedImages.reduce((sum, img) => sum + (img.ocr?.word_count || 0), 0);

                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: isAnalyzed ? 'var(--status-pass-bg)' : 'var(--bg-surface)',
                        border: `1px solid ${isAnalyzed ? 'var(--status-pass-border)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        {isAnalyzed ? (
                          <CheckCircle2 size={16} style={{ color: 'var(--status-pass)', flexShrink: 0 }} />
                        ) : (
                          <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0 }} />
                        )}
                        <div>
                          <strong style={{ color: isAnalyzed ? 'var(--status-pass-text)' : 'var(--text-muted)' }}>
                            {p.label}
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: isAnalyzed ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {isAnalyzed ? `Analyzed (${totalWords} words)` : 'Not submitted'}
                          </div>
                        </div>
                      </div>

                      {isAnalyzed && images.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm touch-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: 'var(--status-fail-text)' }}
                          onClick={() => handleRemovePanel(matchedImages[0])}
                          title={`Remove ${p.label} panel from inspection`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section: What can I do? */}
          <div
            className="card"
            style={{
              padding: '1.75rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderLeft: '5px solid var(--status-partial)',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <HelpCircle size={24} style={{ color: 'var(--status-partial)' }} />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  What can I do?
                </h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: '12px', backgroundColor: 'var(--status-partial-bg)', color: 'var(--status-partial-text)', border: '1px solid var(--status-partial-border)' }}>
                Consumer Next Steps
              </span>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              If you want to check this packaging finding further, follow these practical steps:
            </p>

            {/* 5-Step Practical Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', fontWeight: 700, flexShrink: 0 }}>1</span>
                <span><strong>Verify the finding on the complete product packaging:</strong> Inspect the physical carton, pouch, or container on all surfaces (Front, Back, Sides, Top, Bottom) to verify whether the mandatory declaration is printed on another panel.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', fontWeight: 700, flexShrink: 0 }}>2</span>
                <span><strong>Keep your purchase invoice or bill:</strong> Retain the original cash memo, store receipt, tax invoice, or online billing record showing the retail price paid and date of purchase.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', fontWeight: 700, flexShrink: 0 }}>3</span>
                <span><strong>Save photographs of the product and packaging:</strong> Preserve clear, high-resolution photographs of all packaging panels, batch codes, manufacturing dates, and price stamps.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', fontWeight: 700, flexShrink: 0 }}>4</span>
                <span><strong>Contact the company for clarification if appropriate:</strong> Reach out to the manufacturer or consumer care helpline listed on the product packaging for clarification if appropriate.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', fontWeight: 700, flexShrink: 0 }}>5</span>
                <span><strong>Check official grievance procedures:</strong> If the issue remains unresolved, you may consult the relevant official consumer/government grievance procedure (National Consumer Helpline Toll-Free <strong>1915</strong> or <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--status-info-text)', textDecoration: 'underline' }}>consumerhelpline.gov.in</a>).</span>
              </div>
            </div>

            {/* Contextual Finding-Specific Next Steps */}
            {unifiedFindings.filter((f) => f.status !== 'PASS').length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--status-partial-text)', marginBottom: '0.75rem' }}>
                  Finding-Specific Recommendations:
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {unifiedFindings
                    .filter((f) => f.status !== 'PASS')
                    .map((f, fIdx) => (
                      <div
                        key={fIdx}
                        style={{
                          padding: '0.85rem',
                          backgroundColor: 'var(--bg-surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{f.name}</strong>
                          <StatusBadge status={f.status} size="sm" />
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: 0 }}>
                          {f.what_can_i_do || 'Check remaining packaging panels or capture a clearer photograph.'}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <em>NiyamCheck does not automatically submit a complaint or determine that a company has violated the law. NiyamCheck does not provide definitive legal advice. You may consult the relevant official grievance mechanism if the issue remains unresolved.</em>
            </div>
          </div>

          {/* Section: Individual Finding Cards with Filter Pills */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Detailed Requirement Findings ({unifiedFindings.length})
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Requirement-by-requirement analysis with plain-language explanations and evidence tracing.
                </p>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>Filter:</span>
                {[
                  { key: 'ALL', label: `All (${totalChecked})` },
                  { key: 'PASS', label: `Verified (${passCount})` },
                  { key: 'REVIEW', label: `Review Required (${reviewCount})` },
                  { key: 'POTENTIAL_ISSUE', label: `Potential Issue (${issueCount})` },
                  { key: 'NOT_VERIFIABLE', label: `Unable to Verify / Insufficient Evidence (${unverifiedCount})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm touch-btn ${findingFilter === key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFindingFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Finding Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredFindings.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                  <p>No requirement findings match the "{findingFilter}" filter.</p>
                </div>
              ) : (
                filteredFindings.map((finding, idx) => {
                  const plainLang = RULE_PLAIN_LANGUAGE[finding.rule_id] || {};
                  const confidencePct = Math.round((finding.confidence || 0) * 100);
                  const evMatch = findEvidenceForItem(finding);
                  const hasEvidence = Boolean(
                    evMatch ||
                    finding.evidence ||
                    finding.detected_value ||
                    finding.evidence_text ||
                    (images && images.length > 0 && finding.package_panel)
                  );
                  const cardStatusClass =
                    finding.status === 'PASS'
                      ? 'status-pass'
                      : finding.status === 'POTENTIAL_ISSUE'
                      ? 'status-issue'
                      : finding.status === 'REVIEW'
                      ? 'status-review'
                      : 'status-unverified';

                  return (
                    <div key={finding.rule_id || idx} className={`finding-card ${cardStatusClass}`}>
                      {/* Header */}
                      <div className="finding-card-header">
                        <div>
                          <div className="finding-card-meta">
                            <span className="finding-rule-pill">{finding.rule_id}</span>
                            <span className="finding-cat-pill">{finding.category}</span>
                            {finding.package_panel && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--status-partial-text)', backgroundColor: 'var(--status-partial-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--status-partial-border)' }}>
                                Panel: {finding.package_panel}
                              </span>
                            )}
                            {finding.completeness_status && (
                              <span title="Statutory sub-element completeness" style={{ fontSize: '0.7rem', fontWeight: 600, color: finding.completeness_status === 'COMPLETE' ? 'var(--status-pass-text)' : (finding.completeness_status === 'PARTIAL' ? 'var(--status-partial-text)' : 'var(--status-fail-text)'), backgroundColor: 'var(--bg-surface-elevated)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                Completeness: {finding.completeness_status}
                              </span>
                            )}
                            {finding.readability_status && (
                              <span title="Visual clarity & contrast assessment" style={{ fontSize: '0.7rem', fontWeight: 600, color: finding.readability_status === 'CLEAR' ? 'var(--status-pass-text)' : 'var(--status-partial-text)', backgroundColor: 'var(--bg-surface-elevated)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                Readability: {finding.readability_status}
                              </span>
                            )}
                            {finding.placement_status && (
                              <span title="Spatial layout placement" style={{ fontSize: '0.7rem', fontWeight: 600, color: finding.placement_status === 'COMPLIANT_PDP' ? 'var(--status-info-text)' : 'var(--text-secondary)', backgroundColor: 'var(--bg-surface-elevated)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                Placement: {finding.placement_status === 'COMPLIANT_PDP' ? 'PDP' : finding.placement_status}
                              </span>
                            )}
                          </div>
                          <h3 className="finding-card-title">{finding.name}</h3>
                        </div>
                        <StatusBadge status={finding.status} />
                      </div>

                      {/* Standard 4-Pillar Grid */}
                      <div className="finding-sections-grid">
                        {/* Pillar 1: Rule / Legal Basis */}
                        <div className="finding-section requirement">
                          <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                            Rule / Legal Basis:
                          </strong>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {finding.legal_basis || plainLang.meaning || finding.requirement}
                          </span>
                        </div>

                        {/* Pillar 2: What We Found */}
                        <div className="finding-section evidence-box">
                          <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                            What We Found:
                          </strong>
                          {finding.detected_value || (finding.evidence && (typeof finding.evidence === 'object' ? finding.evidence.text : finding.evidence)) ? (
                            <div>
                              <span style={{ color: 'var(--status-info-text)', fontWeight: 600 }}>
                                "{finding.detected_value || (typeof finding.evidence === 'object' ? finding.evidence.text : finding.evidence)}"
                              </span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                Confidence: <strong style={{ color: confidencePct > 75 ? 'var(--status-pass-text)' : 'var(--status-partial-text)' }}>{confidencePct}%</strong>
                                {finding.package_panel ? ` • Panel: ${finding.package_panel}` : ''}
                              </div>
                              {finding.conflicts && finding.conflicts.length > 0 && (
                                <div style={{ marginTop: '0.5rem', padding: '0.45rem 0.65rem', backgroundColor: 'var(--status-partial-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--status-partial-border)' }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-partial-text)', marginBottom: '0.25rem' }}>
                                    ⚠ Conflicting Values Across Panels:
                                  </div>
                                  {finding.conflicts.map((c, cIdx) => (
                                    <div key={cIdx} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      • <strong>{c.panel}:</strong> <code style={{ color: 'var(--status-info-text)' }}>{c.value}</code>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {finding.additional_sources && finding.additional_sources.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--status-pass-text)', marginTop: '0.35rem' }}>
                                  ✓ Also verified on: {finding.additional_sources.map((s) => s.panel).join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Could not be verified from the submitted images.
                            </span>
                          )}
                        </div>

                        {/* Pillar 3: Evidence & Analysis */}
                        <div
                          className={`finding-section why-box ${
                            finding.status === 'POTENTIAL_ISSUE'
                              ? 'issue'
                              : finding.status === 'NOT_VERIFIABLE'
                              ? 'unverified'
                              : ''
                          }`}
                        >
                          <strong
                            style={{
                              display: 'block',
                              fontSize: '0.75rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Evidence & Analysis:
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            {finding.status === 'POTENTIAL_ISSUE'
                              ? 'Why Flagged as Potential Issue:'
                              : finding.status === 'NOT_VERIFIABLE'
                              ? 'Verification Status & Evidence Gap:'
                              : 'Why It Needs Review:'}
                          </div>
                          <span>
                            {finding.status === 'PASS'
                              ? (finding.explanation || `Mandatory declaration verified on package (${finding.package_panel || 'submitted'} panel).`)
                              : (finding.why_flagged || finding.explanation || plainLang.why_flagged_fallback)}
                          </span>
                          {finding.status === 'NOT_VERIFIABLE' && (
                            <div style={{ marginTop: '0.65rem' }}>
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary"
                                onClick={() => setShowAddPanelModal(true)}
                              >
                                <Plus size={12} />
                                <span>Add Missing Panel Images</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Pillar 4: Recommended Next Action */}
                        <div className="finding-section action-box">
                          <strong style={{ color: 'var(--status-pass-text)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                            Recommended Next Action:
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Suggested Action:
                          </div>
                          <span>
                            {finding.what_can_i_do || (
                              finding.status === 'PASS'
                                ? plainLang.action_pass
                                : finding.status === 'POTENTIAL_ISSUE'
                                ? plainLang.action_issue
                                : plainLang.action_review
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions: Save Evidence, View Evidence & View Official Source */}
                      <div className="finding-card-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm touch-btn"
                          onClick={() => handleSaveFindingEvidence(finding)}
                          title="Save this finding's visual and text evidence locally"
                        >
                          {savedEvidenceMap[finding.rule_id] ? (
                            <Check size={14} style={{ color: '#34D399' }} />
                          ) : (
                            <Bookmark size={14} />
                          )}
                          <span>{savedEvidenceMap[finding.rule_id] ? 'Evidence Saved' : 'Save Evidence'}</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm touch-btn"
                          onClick={() => handleOpenLegalModal(finding)}
                          title="View official statutory authority and legal source citation"
                        >
                          <BookOpen size={14} style={{ color: '#60A5FA' }} />
                          <span>View Official Source</span>
                        </button>

                        {hasEvidence ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm touch-btn"
                            onClick={() => handleOpenEvidenceModal(finding)}
                            title="View Visual Evidence"
                            aria-label="View Visual Evidence"
                          >
                            <Eye size={14} />
                            <span>View Evidence</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Could not be verified from submitted images
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section: Next Steps / Consumer Action Guidance */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Scale size={22} style={{ color: 'var(--primary-500)' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Next Steps & Consumer Guidance
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Practical recommendations for consumers, brand owners, and compliance auditors based on this screening result.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--status-info-text)', marginBottom: '0.4rem' }}>
                  1. Inspecting the Physical Package
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  If declarations were marked <strong>Needs Review</strong> or <strong>Unverified</strong>, examine unsubmitted sides of the physical carton or pouch (especially Front and Top panels). You can create a new inspection with all sides captured for complete multi-angle verification.
                </p>
              </div>

              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--status-partial-text)', marginBottom: '0.4rem' }}>
                  2. Consumer Rights & Grievances
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Under the Legal Metrology Act, 2009, retail packages must display complete declarations. If a commercial product genuinely lacks mandatory information or is sold above MRP, consumers can file an inquiry via the <strong>National Consumer Helpline (Toll-Free 1915)</strong> or online at{' '}
                  <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--status-info-text)', textDecoration: 'underline' }}>
                    consumerhelpline.gov.in
                  </a>.
                </p>
              </div>

              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--status-pass-text)', marginBottom: '0.4rem' }}>
                  3. For Brand Owners & Packers
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Audit packaging artwork against Rule 6(1) of the Legal Metrology (Packaged Commodities) Rules, 2011 to ensure mandatory declarations (font sizes, metric units, customer care, and MRP) meet statutory specifications prior to market distribution.
                </p>
              </div>
            </div>
          </div>

          {/* Section: AI-Assisted Informational Disclaimer */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              borderLeft: '4px solid var(--status-info)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              <ShieldAlert size={16} style={{ color: 'var(--status-info)' }} />
              <span>AI-Assisted Informational Screening Disclaimer</span>
            </div>
            <p>
              This is an AI-assisted informational analysis based on the submitted evidence and referenced sources. It is not a final legal determination. NiyamCheck does not determine that a company has legally violated a requirement solely from this inspection. Findings do not constitute an official government certificate, legal adjudication, statutory finding, or regulatory enforcement action. For official regulatory inspection or legal compliance determinations, refer to the Department of Consumer Affairs, Government of India, or an authorized Legal Metrology officer.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: Visual Evidence & Image Viewer */}
      {activeTab === 'images' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Packaging Image & Evidence Viewer
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Interactive pan/zoom viewer displaying normalized OCR bounding boxes <code style={{ color: '#93C5FD' }}>[ymin, xmin, ymax, xmax]</code> overlaid onto original packaging panels.
            </p>
          </div>

          <ImageViewer
            images={images}
            inspectionId={session.inspection_id}
            selectedEvidence={selectedEvidence}
            onSelectEvidence={(ev) => setSelectedEvidence(ev)}
          />

          {/* Evidence Details Card */}
          {selectedEvidence && (
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#93C5FD' }}>
                Active Visual Evidence Region
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Rule ID: </span>
                  <strong>{selectedEvidence.rule_id || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Field: </span>
                  <span>{selectedEvidence.field}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Panel: </span>
                  <span>{selectedEvidence.panel || 'UNKNOWN'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Detected OCR Text: </span>
                  <strong style={{ color: '#FCD34D' }}>"{selectedEvidence.text}"</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Confidence: </span>
                  <span>{Math.round((selectedEvidence.confidence || 0) * 100)}%</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Normalized Coordinates: </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#93C5FD' }}>
                    {selectedEvidence.bounding_box
                      ? Array.isArray(selectedEvidence.bounding_box)
                        ? `[${selectedEvidence.bounding_box.map((n) => Number(n).toFixed(3)).join(', ')}]`
                        : `[${Number(selectedEvidence.bounding_box.ymin).toFixed(3)}, ${Number(selectedEvidence.bounding_box.xmin).toFixed(3)}, ${Number(selectedEvidence.bounding_box.ymax).toFixed(3)}, ${Number(selectedEvidence.bounding_box.xmax).toFixed(3)}]`
                      : 'Visual coordinates unavailable'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Raw Declarations Table */}
      {activeTab === 'fields' && (
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Canonical Product Package Declarations
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Extracted structured declarations mapped from multi-angle OCR scans and verified against canonical Legal Metrology data models.
          </p>

          {/* Desktop Table View */}
          <div className="table-container desktop-only-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Extraction Status</th>
                  <th>Canonical Value</th>
                  <th>Confidence</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'product_name', label: 'Product / Generic Name', ruleId: 'LM-PN-001' },
                  { key: 'net_quantity', label: 'Net Quantity', ruleId: 'LM-NQ-001' },
                  { key: 'mrp', label: 'Maximum Retail Price (MRP)', ruleId: 'LM-MRP-001' },
                  { key: 'manufacturer', label: 'Manufacturer', ruleId: 'LM-MFG-001' },
                  { key: 'address', label: 'Manufacturer Address', ruleId: 'LM-ADDR-001' },
                  { key: 'date_information', label: 'Date (MFD / Expiry)', ruleId: 'LM-DATE-001' },
                  { key: 'consumer_care', label: 'Consumer Care / Helpline', ruleId: 'LM-CARE-001' },
                  { key: 'country_of_origin', label: 'Country of Origin', ruleId: 'LM-COO-001' },
                  { key: 'packer', label: 'Packer (if distinct)', ruleId: 'LM-PCK-001' },
                  { key: 'importer', label: 'Importer (if imported)', ruleId: 'LM-IMP-001' },
                ].map(({ key, label, ruleId }) => {
                  const fieldItem = fields[key] || { status: 'NOT_VERIFIABLE', value: null, confidence: 0 };
                  const val = fieldItem.value;
                  const conf = Math.round((fieldItem.confidence || 0) * 100);
                  const fieldEv = findEvidenceForItem({ ...fieldItem, field: key, rule_id: ruleId, detected_value: val });

                  return (
                    <tr key={key}>
                      <td>
                        <strong>{label}</strong>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {key}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={fieldItem.status} size="sm" />
                      </td>
                      <td>
                        {val ? (
                          <span style={{ color: 'var(--status-info-text)', fontWeight: 500 }}>{val}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not detected</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {conf}%
                        </span>
                      </td>
                      <td>
                        {val || fieldEv ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs touch-btn"
                            onClick={() => handleOpenEvidenceModal({ ...fieldItem, field: key, rule_id: ruleId, detected_value: val, name: label })}
                            title="View packaging evidence"
                          >
                            <Eye size={12} />
                            <span>View Evidence</span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="mobile-only-cards">
            {[
              { key: 'product_name', label: 'Product / Generic Name', ruleId: 'LM-PN-001' },
              { key: 'net_quantity', label: 'Net Quantity', ruleId: 'LM-NQ-001' },
              { key: 'mrp', label: 'Maximum Retail Price (MRP)', ruleId: 'LM-MRP-001' },
              { key: 'manufacturer', label: 'Manufacturer', ruleId: 'LM-MFG-001' },
              { key: 'address', label: 'Manufacturer Address', ruleId: 'LM-ADDR-001' },
              { key: 'date_information', label: 'Date (MFD / Expiry)', ruleId: 'LM-DATE-001' },
              { key: 'consumer_care', label: 'Consumer Care / Helpline', ruleId: 'LM-CARE-001' },
              { key: 'country_of_origin', label: 'Country of Origin', ruleId: 'LM-COO-001' },
              { key: 'packer', label: 'Packer (if distinct)', ruleId: 'LM-PCK-001' },
              { key: 'importer', label: 'Importer (if imported)', ruleId: 'LM-IMP-001' },
            ].map(({ key, label, ruleId }) => {
              const fieldItem = fields[key] || { status: 'NOT_VERIFIABLE', value: null, confidence: 0 };
              const val = fieldItem.value;
              const conf = Math.round((fieldItem.confidence || 0) * 100);
              const fieldEv = findEvidenceForItem({ ...fieldItem, field: key, rule_id: ruleId, detected_value: val });

              return (
                <div
                  key={key}
                  style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</strong>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{key}</div>
                    </div>
                    <StatusBadge status={fieldItem.status} size="sm" />
                  </div>

                  <div style={{ padding: '0.5rem 0.65rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Declared Value:</div>
                    <div style={{ fontSize: '0.85rem', color: val ? 'var(--status-info-text)' : 'var(--text-muted)', fontWeight: val ? 600 : 400, marginTop: '0.15rem' }}>
                      {val || 'Not detected on submitted panels'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      OCR Confidence: <strong style={{ color: conf > 75 ? 'var(--status-pass-text)' : 'var(--status-partial-text)' }}>{conf}%</strong>
                    </div>
                    {(val || fieldEv) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs touch-btn"
                        onClick={() => handleOpenEvidenceModal({ ...fieldItem, field: key, rule_id: ruleId, detected_value: val, name: label })}
                      >
                        <Eye size={12} />
                        <span>View Evidence</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Authoritative Legal Basis */}
      {activeTab === 'legal' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <BookOpen size={20} style={{ color: '#3B82F6' }} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
              Retrieved Statutory Provisions & Gazette Citations
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            All statutory citations are deterministically retrieved from the official Legal Metrology knowledge base and linked directly to official Gazette publications on <code style={{ color: '#93C5FD' }}>consumeraffairs.nic.in</code>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {unifiedFindings.map((finding, idx) => (
              <div
                key={finding.rule_id || idx}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#93C5FD', marginRight: '0.5rem' }}>
                      {finding.rule_id}
                    </span>
                    {finding.name}
                  </div>
                  <StatusBadge status={finding.status} size="sm" />
                </div>
                <LegalBasisCard legalBasis={finding.legal_basis} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Visual Evidence Modal */}
      {activeEvidenceModal && (
        <div className="modal-backdrop" onClick={() => setActiveEvidenceModal(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '900px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">
                <Eye size={18} style={{ color: 'var(--primary-600)' }} />
                <span>Evidence & Bounding Box</span>
              </div>
              <button
                type="button"
                className="modal-close-btn touch-btn"
                onClick={() => setActiveEvidenceModal(null)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Multi-Source Switcher if multiple evidence sources exist across panels */}
              {activeEvidenceModal.sources && activeEvidenceModal.sources.length > 1 && (
                <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--status-info-text)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Available Evidence Sources Across Panels ({activeEvidenceModal.sources.length}):
                  </div>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {activeEvidenceModal.sources.map((src, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        className={`btn btn-sm touch-btn ${activeEvidenceIndex === sIdx ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', minHeight: '32px' }}
                        onClick={() => {
                          setActiveEvidenceIndex(sIdx);
                          const targetImg = images.find(
                            (img) => img.image_id === src.image_id || (src.panel && (img.panel || '').toUpperCase() === (src.panel || '').toUpperCase())
                          ) || images[0];
                          setActiveEvidenceModal((prev) => ({
                            ...prev,
                            evidence: src,
                            image: targetImg,
                          }));
                        }}
                      >
                        <span>{src.label || `Source ${sIdx + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reusable Audit-Grade Packaging Evidence Viewer */}
              <ImageViewer
                images={images}
                inspectionId={session.inspection_id}
                selectedEvidence={activeEvidenceModal.evidence}
                onSelectEvidence={(ev) => {
                  setActiveEvidenceModal((prev) => ({
                    ...prev,
                    evidence: ev,
                  }));
                }}
                showInspector={true}
                compact={true}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm touch-btn"
                onClick={() => {
                  const ev = activeEvidenceModal.evidence;
                  setActiveEvidenceModal(null);
                  handleInspectInViewer(ev);
                }}
              >
                <Layers size={14} />
                <span>Open in Full Interactive Viewer</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm touch-btn"
                onClick={() => setActiveEvidenceModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Legal Source Modal */}
      {activeLegalModal && (
        <div className="modal-backdrop" onClick={() => setActiveLegalModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <BookOpen size={18} style={{ color: '#60A5FA' }} />
                <span>Statutory Authority & Official Gazette</span>
              </div>
              <button
                type="button"
                className="modal-close-btn touch-btn"
                onClick={() => setActiveLegalModal(null)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="finding-rule-pill">{activeLegalModal.rule_id}</span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {activeLegalModal.name}
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {activeLegalModal.requirement}
                </p>
              </div>

              {/* Legal Basis Cards */}
              <LegalBasisCard
                legalBasis={
                  activeLegalModal.legal_basis && activeLegalModal.legal_basis.length > 0
                    ? activeLegalModal.legal_basis
                    : activeLegalModal.legal_source_url
                    ? [
                        {
                          chunk_id: activeLegalModal.rule_id,
                          rule_number: activeLegalModal.rule_id,
                          section: activeLegalModal.legal_source || 'Rule 6, Legal Metrology (Packaged Commodities) Rules, 2011',
                          source: activeLegalModal.legal_source || 'Legal Metrology (Packaged Commodities) Rules, 2011',
                          official_url: activeLegalModal.legal_source_url,
                          excerpt: activeLegalModal.legal_basis_excerpt || activeLegalModal.requirement,
                          citation: {
                            source_title: activeLegalModal.legal_source || 'Legal Metrology (Packaged Commodities) Rules, 2011',
                            authority: activeLegalModal.legal_authority || 'Department of Consumer Affairs, Government of India',
                            rule_number: activeLegalModal.rule_id,
                            section: activeLegalModal.legal_source || '',
                            official_url: activeLegalModal.legal_source_url,
                            version: 'PCR 2011',
                            publication_date: '2011-03-07',
                          },
                        },
                      ]
                    : []
                }
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm touch-btn"
                onClick={() => setActiveLegalModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Packaging Panels */}
      {showAddPanelModal && (
        <div className="modal-backdrop" onClick={() => !submittingPanel && setShowAddPanelModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Plus size={18} style={{ color: '#60A5FA' }} />
                <span>Add Packaging Panel ({session.inspection_id})</span>
              </div>
              <button
                type="button"
                className="modal-close-btn touch-btn"
                onClick={() => setShowAddPanelModal(false)}
                disabled={submittingPanel}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPanelSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Submit additional package panels (Front, Back, Sides, Top, Bottom) for this product. Declarations will be dynamically combined with existing panels under the same inspection session.
                </p>

                {panelActionError && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--status-fail-bg)', border: '1px solid var(--status-fail-border)', borderRadius: 'var(--radius-sm)', color: 'var(--status-fail-text)', fontSize: '0.85rem' }}>
                    {panelActionError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    Select Packaging Panel Angle
                  </label>
                  <select
                    className="select-input"
                    value={newPanelType}
                    onChange={(e) => setNewPanelType(e.target.value)}
                    disabled={submittingPanel}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' }}
                  >
                    {STANDARD_PANELS.map((p) => {
                      const isAlreadyAnalyzed = images.some((i) => (i.panel || '').toUpperCase() === p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.label} {isAlreadyAnalyzed ? '(Already analyzed - adds additional view)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    Select Image File
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setNewPanelFiles(Array.from(e.target.files));
                      }
                    }}
                    disabled={submittingPanel}
                    style={{ width: '100%', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm touch-btn"
                  onClick={() => setShowAddPanelModal(false)}
                  disabled={submittingPanel}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm touch-btn"
                  disabled={submittingPanel || newPanelFiles.length === 0}
                >
                  {submittingPanel ? (
                    <>
                      <RefreshCw size={14} className="spinning" />
                      <span>Analyzing Panel...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Upload & Analyze Panel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
