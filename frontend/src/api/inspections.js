import { api } from './client.js';

export async function checkSystemHealth() {
  return await api.get('/api/v1/health');
}

export async function createInspection({ files, panels = [], inspectionId = null }) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  panels.forEach((panel) => {
    formData.append('panels', panel);
  });

  if (inspectionId) {
    formData.append('inspection_id', inspectionId);
  }

  return await api.postForm('/api/v1/inspections', formData);
}

export async function listInspections() {
  return await api.get('/api/v1/inspections');
}

export async function getInspection(inspectionId) {
  return await api.get(`/api/v1/inspections/${encodeURIComponent(inspectionId)}`);
}

export async function getReportJson(inspectionId) {
  return await api.get(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/report.json`);
}

export async function downloadReportPdf(inspectionId) {
  const blob = await api.get(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/report`);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection_${inspectionId}.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadReportJsonFile(inspectionId) {
  const reportData = await getReportJson(inspectionId);
  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspection_${inspectionId}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function getInspectionImageUrl(inspectionId, imageId) {
  const base = api.getBaseUrl();
  return `${base}/api/v1/inspections/${encodeURIComponent(inspectionId)}/images/${encodeURIComponent(imageId)}`;
}

export async function addInspectionImages({ inspectionId, files, panels = [] }) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  panels.forEach((panel) => {
    formData.append('panels', panel);
  });
  return await api.postForm(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/images`, formData);
}

export async function deleteInspectionImage(inspectionId, imageId) {
  return await api.delete(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/images/${encodeURIComponent(imageId)}`);
}

export async function updateOfficerReview(inspectionId, {
  officerName,
  officerId,
  officerNotes,
  findingReviews,
  finalVerdict,
  isFinalized,
}) {
  return await api.patch(`/api/v1/inspections/${encodeURIComponent(inspectionId)}/review`, {
    officer_name: officerName,
    officer_id: officerId,
    officer_notes: officerNotes,
    finding_reviews: findingReviews,
    final_verdict: finalVerdict,
    is_finalized: isFinalized,
  });
}


