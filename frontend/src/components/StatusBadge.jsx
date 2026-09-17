import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, MinusCircle } from 'lucide-react';

export function StatusBadge({ status, size = 'normal', showIcon = true }) {
  const norm = (status || '').toUpperCase().trim();

  let badgeClass = 'badge-neutral';
  let label = status || 'UNKNOWN';
  let Icon = HelpCircle;

  switch (norm) {
    case 'COMPLIANT':
    case 'PASS':
      badgeClass = 'badge-compliant';
      label = norm === 'PASS' ? 'PASS' : 'COMPLIANT';
      Icon = CheckCircle2;
      break;

    case 'NON_COMPLIANT':
    case 'FAIL':
    case 'POTENTIAL_ISSUE':
    case 'POTENTIAL_ISSUES':
      badgeClass = 'badge-non-compliant';
      label = norm === 'POTENTIAL_ISSUE' ? 'POTENTIAL ISSUE' : norm === 'FAIL' ? 'FAIL' : 'NON-COMPLIANT';
      Icon = XCircle;
      break;

    case 'PARTIALLY_VERIFIABLE':
    case 'NEEDS_REVIEW':
      badgeClass = 'badge-partially-verifiable';
      label = norm === 'NEEDS_REVIEW' ? 'NEEDS REVIEW' : 'PARTIALLY VERIFIABLE';
      Icon = AlertTriangle;
      break;

    case 'UNCLEAR':
    case 'REVIEW':
      badgeClass = 'badge-unclear';
      label = norm === 'REVIEW' ? 'REVIEW' : 'UNCLEAR';
      Icon = HelpCircle;
      break;


    case 'NOT_VERIFIABLE':
      badgeClass = 'badge-not-verifiable';
      label = 'NOT VERIFIABLE';
      Icon = MinusCircle;
      break;

    case 'NOT_APPLICABLE':
      badgeClass = 'badge-not-applicable';
      label = 'NOT APPLICABLE';
      Icon = MinusCircle;
      break;

    case 'PRESENT':
      badgeClass = 'badge-compliant';
      label = 'PRESENT';
      Icon = CheckCircle2;
      break;

    case 'MISSING':
      badgeClass = 'badge-non-compliant';
      label = 'MISSING';
      Icon = XCircle;
      break;

    default:
      badgeClass = 'badge-neutral';
      label = status || 'UNKNOWN';
      Icon = HelpCircle;
      break;
  }

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span className={`badge ${badgeClass} ${size === 'sm' ? 'badge-sm' : ''}`} role="status">
      {showIcon && <Icon size={iconSize} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
