import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Legal Metrology Officer Frontend & Inspection Workflow Tests', () => {
  // Test 1: Auth / RBAC Context Contract
  test('AuthContext exports AuthProvider, useAuth, and defines canonical roles', async () => {
    const authPath = path.join(frontendRoot, 'src', 'context', 'AuthContext.jsx');
    const content = fs.readFileSync(authPath, 'utf8');

    assert.ok(content.includes('export function AuthProvider'), 'Must export AuthProvider');
    assert.ok(content.includes('export function useAuth'), 'Must export useAuth');
    assert.ok(content.includes('OFFICER: \'OFFICER\''), 'Must define OFFICER role');
    assert.ok(content.includes('CONSUMER: \'CONSUMER\''), 'Must define CONSUMER role');
    assert.ok(content.includes('VENDOR: \'VENDOR\''), 'Must define VENDOR role');
    assert.ok(content.includes('LM-OFF-MH-4001'), 'Must include official inspector badge identifier');
  });

  // Test 2: HTTP Client PATCH support
  test('api client exports patch method for officer review updates', async () => {
    const clientPath = path.join(frontendRoot, 'src', 'api', 'client.js');
    const content = fs.readFileSync(clientPath, 'utf8');

    assert.ok(content.includes('patch:'), 'api object must include patch method');
    assert.ok(content.includes("method: 'PATCH'"), 'patch helper must send HTTP PATCH method');
  });

  // Test 3: Inspection API Service Contract for Officer Review
  test('inspections.js exports updateOfficerReview targeting PATCH /api/v1/inspections/:id/review', async () => {
    const apiPath = path.join(frontendRoot, 'src', 'api', 'inspections.js');
    const content = fs.readFileSync(apiPath, 'utf8');

    assert.ok(content.includes('export async function updateOfficerReview'), 'Must export updateOfficerReview');
    assert.ok(content.includes('/review'), 'Must target review endpoint');
    assert.ok(content.includes('officer_name'), 'Must map officer_name');
    assert.ok(content.includes('officer_notes'), 'Must map officer_notes');
    assert.ok(content.includes('finding_reviews'), 'Must map finding_reviews');
    assert.ok(content.includes('is_finalized'), 'Must map is_finalized');
  });

  // Test 4: Officer Dashboard Component Structure
  test('OfficerDashboard renders executive metrics, status tabs, and registry table', () => {
    const dashPath = path.join(frontendRoot, 'src', 'pages', 'OfficerDashboard.jsx');
    const content = fs.readFileSync(dashPath, 'utf8');

    assert.ok(content.includes('Legal Metrology Officer Dashboard'), 'Must include Officer Dashboard title');
    assert.ok(content.includes('Total Package Audits'), 'Must show Total Package Audits metric');
    assert.ok(content.includes('Verified Compliant'), 'Must show Compliant metric');
    assert.ok(content.includes('Statutory Violations'), 'Must show Statutory Violations metric');
    assert.ok(content.includes('Officer Finalized'), 'Must show Finalized metric');
    assert.ok(content.includes('downloadReportPdf'), 'Must integrate direct PDF report downloads');
  });

  // Test 5: Officer Review Panel Component
  test('OfficerReviewPanel provides per-finding reviews, case notes, and finalization sign-off', () => {
    const panelPath = path.join(frontendRoot, 'src', 'components', 'OfficerReviewPanel.jsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('Officer Review & Statutory Finalization'), 'Must include title');
    assert.ok(content.includes('updateOfficerReview'), 'Must invoke updateOfficerReview API');
    assert.ok(content.includes('CONFIRM_AI_VERDICT'), 'Must support accepting AI verdict');
    assert.ok(content.includes('ACCEPT_AS_COMPLIANT'), 'Must support officer compliance override');
    assert.ok(content.includes('CONFIRM_VIOLATION'), 'Must support confirming statutory violation');
    assert.ok(content.includes('Finalize & Sign Inspection'), 'Must include Finalize & Sign button');
    assert.ok(content.includes('downloadReportPdf'), 'Must include PDF download button');
  });

  // Test 6: Officer History Registry Component
  test('OfficerHistory renders searchable case registry with multi-criteria filters', () => {
    const histPath = path.join(frontendRoot, 'src', 'pages', 'OfficerHistory.jsx');
    const content = fs.readFileSync(histPath, 'utf8');

    assert.ok(content.includes('Official Packaging Audit Registry'), 'Must include registry title');
    assert.ok(content.includes('listInspections'), 'Must load inspections from backend API');
    assert.ok(content.includes('downloadReportPdf'), 'Must support PDF download from history');
    assert.ok(content.includes('Search by ID, commodity'), 'Must include search box');
  });

  // Test 7: InspectionResults Integration
  test('InspectionResults renders Officer Review tab and mounts OfficerReviewPanel', () => {
    const resPath = path.join(frontendRoot, 'src', 'pages', 'InspectionResults.jsx');
    const content = fs.readFileSync(resPath, 'utf8');

    assert.ok(content.includes('OfficerReviewPanel'), 'Must import and mount OfficerReviewPanel');
    assert.ok(content.includes('Officer Workbench'), 'Must include Officer Workbench tab');
    assert.ok(content.includes('activeTab === \'officer\''), 'Must handle officer tab selection');
  });

  // Test 8: Navbar RBAC Role Switcher
  test('Navbar renders RBAC role selector for switching between Officer, Consumer, and Vendor', () => {
    const navPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
    const content = fs.readFileSync(navPath, 'utf8');

    assert.ok(content.includes('useAuth'), 'Must import useAuth hook');
    assert.ok(content.includes('role-select'), 'Must declare role-select class');
    assert.ok(content.includes('OFFICER'), 'Must support switching to OFFICER');
    assert.ok(content.includes('CONSUMER'), 'Must support switching to CONSUMER');
    assert.ok(content.includes('VENDOR'), 'Must support switching to VENDOR');
  });

  // Test 9: App.jsx Role-Aware Layout
  test('App.jsx mounts AuthProvider and conditionally renders OfficerDashboard vs Consumer Dashboard', () => {
    const appPath = path.join(frontendRoot, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('AuthProvider'), 'Must wrap application in AuthProvider');
    assert.ok(content.includes('OfficerDashboard'), 'Must import OfficerDashboard');
    assert.ok(content.includes('OfficerHistory'), 'Must import OfficerHistory');
    assert.ok(content.includes('isOfficer ?'), 'Must conditionally render based on isOfficer role');
  });

  // Test 10: CreateInspection Officer Premise & Sampling Reference
  test('CreateInspection provides inspected establishment & sampling memo controls for Officers', () => {
    const createPath = path.join(frontendRoot, 'src', 'pages', 'CreateInspection.jsx');
    const content = fs.readFileSync(createPath, 'utf8');

    assert.ok(content.includes('useAuth'), 'Must import useAuth hook');
    assert.ok(content.includes('establishmentName'), 'Must track establishmentName state');
    assert.ok(content.includes('samplingLocation'), 'Must track samplingLocation state');
    assert.ok(content.includes('batchSampleId'), 'Must track batchSampleId state');
    assert.ok(content.includes('Inspected Establishment & Sampling Context'), 'Must render premise context banner');
    assert.ok(content.includes('createInspection({'), 'Must pass officer & premise fields to createInspection');
  });

  // Test 11: OfficerReviewPanel Quick Bulk Review & Statutory Notice Draft
  test('OfficerReviewPanel provides bulk review action and Section 18 statutory notice draft generator', () => {
    const panelPath = path.join(frontendRoot, 'src', 'components', 'OfficerReviewPanel.jsx');
    const content = fs.readFileSync(panelPath, 'utf8');

    assert.ok(content.includes('Mark Unreviewed as Confirm AI'), 'Must support bulk confirm AI action');
    assert.ok(content.includes('Draft Statutory Notice'), 'Must support statutory notice generation');
    assert.ok(content.includes('NOTICE OF CONTRAVENTION UNDER SECTION 18'), 'Must generate formal Section 18 notice draft');
    assert.ok(content.includes('establishmentName'), 'Must support premise context in review panel');
  });

  // Test 12: Officer Dashboard and History Premise Visibility & Search
  test('Officer Dashboard and History display inspected premises and support premise-based searching', () => {
    const dashPath = path.join(frontendRoot, 'src', 'pages', 'OfficerDashboard.jsx');
    const dashContent = fs.readFileSync(dashPath, 'utf8');
    assert.ok(dashContent.includes('insp.establishment_name'), 'Dashboard must render establishment name in table');
    assert.ok(dashContent.includes('establishment.includes(q)'), 'Dashboard search must include establishment name');

    const histPath = path.join(frontendRoot, 'src', 'pages', 'OfficerHistory.jsx');
    const histContent = fs.readFileSync(histPath, 'utf8');
    assert.ok(histContent.includes('item.establishment_name'), 'History must render establishment name in table');
    assert.ok(histContent.includes('matchPremise'), 'History search must include establishment matching');
  });
});

