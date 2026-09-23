/**
 * Isolated Vendor Profile Context for Development & Demonstration.
 *
 * NOTE: Production authentication and RBAC are assigned to Rekha.
 * This context provides an isolated, easily-replaceable vendor profile
 * for Sufiya's Vendor/Company module without implementing auth.
 */

export const DEV_VENDOR_PROFILE = {
  vendor_id: 'VEND-001',
  company_name: 'Apex FMCG Brands India Pvt Ltd',
  email: 'compliance@apexfmcg.in',
  registration_no: 'CIN-U15400DL2021PTC384729',
  contact_person: 'Sufiya (Vendor Compliance Officer)',
  brand_portfolio: ['Apex Nature', 'Apex Dairy', 'Apex Care', 'Apex Pure'],
  status: 'ACTIVE',
  role: 'vendor',
  is_development_context: true,
  notice: 'Development Vendor Context — Rekha Auth/RBAC pending',
};

let activeContext = { ...DEV_VENDOR_PROFILE };

export function getVendorContext() {
  return activeContext;
}

export function updateVendorContext(newProfile) {
  activeContext = { ...activeContext, ...newProfile };
  return activeContext;
}

export function resetVendorContext() {
  activeContext = { ...DEV_VENDOR_PROFILE };
  return activeContext;
}
