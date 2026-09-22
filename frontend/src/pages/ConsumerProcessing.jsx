import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
  Package,
  Clock,
} from 'lucide-react';
import { createInspection } from '../api/inspections';

export function ConsumerProcessing({ pendingData, onSuccess, onCancel, onRetry }) {
  const [step, setStep] = useState(1); // 1: Uploading, 2: Reading labels, 3: Verifying declarations
  const [error, setError] = useState(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const submissionExecutedRef = useRef(false);

  const executeSubmission = async () => {
    if (!pendingData || !pendingData.files || pendingData.files.length === 0) {
      setError('No product images were provided for analysis.');
      return;
    }

    setError(null);
    setIsTimedOut(false);
    setStep(1);

    // Simulated progress transitions for consumer feedback
    const t1 = setTimeout(() => setStep(2), 700);
    const t2 = setTimeout(() => setStep(3), 1600);

    // Timeout alert after 25 seconds
    const timeoutTimer = setTimeout(() => {
      setIsTimedOut(true);
    }, 25000);

    try {
      const session = await createInspection({
        files: pendingData.files,
        panels: pendingData.panels || [],
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timeoutTimer);

      if (session?.inspection_id) {
        setHasCompleted(true);
        // Small delay to allow user to see completed state before transition
        setTimeout(() => {
          if (onSuccess) onSuccess(session.inspection_id);
        }, 500);
      } else {
        throw new Error('Server returned an incomplete check session.');
      }
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(timeoutTimer);

      let msg = err.message || 'Unable to complete product check. Please check connection and try again.';
      if (err.status === 0 || msg.includes('Failed to fetch') || msg.includes('network')) {
        msg = 'Could not connect to NiyamCheck backend server. Please verify your connection or ensure the backend is running.';
      }
      setError(msg);
    }
  };

  useEffect(() => {
    if (!submissionExecutedRef.current) {
      submissionExecutedRef.current = true;
      executeSubmission();
    }
  }, []);

  const handleManualRetry = () => {
    submissionExecutedRef.current = true;
    executeSubmission();
  };

  const fileCount = pendingData?.files?.length || 1;

  // Error State View
  if (error) {
    return (
      <div className="consumer-processing-wrap">
        <div className="consumer-processing-card error-card">
          <div className="consumer-processing-icon-wrap error-icon">
            <AlertCircle size={36} style={{ color: '#F43F5E' }} />
          </div>

          <h2 className="consumer-processing-title" style={{ color: 'var(--text-primary)' }}>
            Product Check Interrupted
          </h2>
          <p className="consumer-processing-subtitle" style={{ color: 'var(--text-secondary)' }}>
            We encountered a problem while processing your packaging photos.
          </p>

          <div className="consumer-alert-notice error" style={{ width: '100%', marginBottom: '1.5rem', textAlign: 'left' }}>
            <AlertTriangle size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <span>{error}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary touch-btn"
              onClick={handleManualRetry}
            >
              <RotateCcw size={16} />
              <span>Try Again</span>
            </button>

            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary touch-btn"
                onClick={onCancel}
              >
                <ArrowLeft size={16} />
                <span>Return to Photos</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consumer-processing-wrap" role="status" aria-live="polite">
      <div className="consumer-processing-card">
        <div className="consumer-processing-icon-wrap">
          <RefreshCw size={36} className="spinning" style={{ color: '#10B981' }} />
        </div>

        <h2 className="consumer-processing-title">Checking Your Product...</h2>
        <p className="consumer-processing-subtitle">
          Reading mandatory packaging declarations under Indian Legal Metrology standards.
        </p>

        {/* 3-Step Progress Indicators */}
        <div className="consumer-processing-steps">
          <div className={`consumer-processing-step ${step >= 1 ? 'active' : ''}`}>
            <div className="consumer-step-dot" />
            <span>
              Uploading {fileCount} packaging photo{fileCount > 1 ? 's' : ''}...
            </span>
          </div>

          <div className={`consumer-processing-step ${step >= 2 ? 'active' : ''}`}>
            <div className="consumer-step-dot" />
            <span>
              Reading packaging text & detecting labels (MRP, Net Weight, Dates)...
            </span>
          </div>

          <div className={`consumer-processing-step ${step >= 3 ? 'active' : ''}`}>
            <div className="consumer-step-dot" />
            <span>
              Verifying declarations against mandatory requirements...
            </span>
          </div>
        </div>

        {/* Timeout Advisory if server takes > 25s */}
        {isTimedOut && (
          <div className="consumer-timeout-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Clock size={16} style={{ color: '#F59E0B' }} />
              <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                Taking longer than usual
              </strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
              High-resolution packaging images or server load may cause a brief delay. You can continue waiting or retry.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleManualRetry}
            >
              <RotateCcw size={12} />
              <span>Retry Check</span>
            </button>
          </div>
        )}

        <span className="consumer-processing-note">
          This usually takes just a few seconds. Please keep this window open.
        </span>

        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
            style={{ marginTop: '1.5rem' }}
          >
            <span>Cancel Check</span>
          </button>
        )}
      </div>
    </div>
  );
}
