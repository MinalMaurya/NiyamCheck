import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { getConsumerStatus, CONSUMER_STATUS_CATEGORIES } from '../utils/consumerUtils.js';

export { getConsumerStatus, CONSUMER_STATUS_CATEGORIES };

export function ConsumerStatusBadge({ status, size = 'normal', showIcon = true, showDescription = false }) {
  const info = getConsumerStatus(status);

  let Icon = HelpCircle;
  if (info.category === CONSUMER_STATUS_CATEGORIES.VERIFIED) Icon = CheckCircle2;
  else if (info.category === CONSUMER_STATUS_CATEGORIES.REQUIRES_REVIEW) Icon = AlertTriangle;
  else if (info.category === CONSUMER_STATUS_CATEGORIES.POTENTIAL_ISSUE) Icon = AlertCircle;
  else if (info.category === CONSUMER_STATUS_CATEGORIES.NOT_VERIFIABLE) Icon = HelpCircle;

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`consumer-badge ${info.badgeClass} ${size === 'sm' ? 'consumer-badge-sm' : ''}`}
      title={info.description}
      role="status"
    >
      {showIcon && <Icon size={iconSize} aria-hidden="true" />}
      <span>{info.category}</span>
      {showDescription && <span className="consumer-badge-desc">{info.description}</span>}
    </span>
  );
}
