import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

describe('Navigation Redesign — Minimal Navbar & Collapsible Sidebar Tests', () => {
  const navbarPath = path.join(frontendRoot, 'src', 'components', 'Navbar.jsx');
  const sidebarPath = path.join(frontendRoot, 'src', 'components', 'Sidebar.jsx');
  const appPath = path.join(frontendRoot, 'src', 'App.jsx');
  const cssPath = path.join(frontendRoot, 'src', 'index.css');

  const navbarCode = fs.readFileSync(navbarPath, 'utf8');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const cssCode = fs.readFileSync(cssPath, 'utf8');

  // Test 1: Navbar Left Order — Hamburger toggle precedes brand logo/name
  test('Navbar renders hamburger button BEFORE NiyamCheck logo and project name', () => {
    const hamburgerIndex = navbarCode.indexOf('sidebar-toggle-btn');
    const brandIconIndex = navbarCode.indexOf('brand-icon');
    const brandNameIndex = navbarCode.indexOf('brand-name');

    assert.ok(hamburgerIndex > 0, 'Navbar must contain sidebar-toggle-btn');
    assert.ok(brandIconIndex > 0, 'Navbar must contain brand-icon');
    assert.ok(brandNameIndex > 0, 'Navbar must contain brand-name');
    assert.ok(
      hamburgerIndex < brandIconIndex,
      'Hamburger button must appear before brand icon'
    );
    assert.ok(
      brandIconIndex < brandNameIndex,
      'Brand icon must appear before brand name'
    );
  });

  // Test 2: Quick Inspection Action in Navbar
  test('Navbar includes quick action button with role-tailored labels', () => {
    assert.ok(navbarCode.includes('nav-quick-action-btn'), 'Must declare nav-quick-action-btn');
    assert.ok(navbarCode.includes('Check Product'), 'Must support Check Product label for Consumer');
    assert.ok(navbarCode.includes('New Inspection'), 'Must support New Inspection label for Officer');
    assert.ok(navbarCode.includes('quickAction'), 'Must determine role-based quick action');
  });

  // Test 3: Compact Profile Section and Dropdown in Navbar
  test('Navbar includes compact user profile section with dropdown controls', () => {
    assert.ok(navbarCode.includes('nav-profile-container'), 'Must have nav-profile-container');
    assert.ok(navbarCode.includes('nav-profile-trigger'), 'Must have nav-profile-trigger');
    assert.ok(navbarCode.includes('nav-profile-dropdown'), 'Must have nav-profile-dropdown');
    assert.ok(navbarCode.includes('role-select'), 'Must have role-select inside profile dropdown');
    assert.ok(navbarCode.includes('portal-mode-toggle'), 'Must have portal-mode-toggle in dropdown');
    assert.ok(navbarCode.includes('pwa-install-btn'), 'Must have pwa-install-btn in dropdown');
    assert.ok(navbarCode.includes('onOpenSystemInfo'), 'Must support opening diagnostics');
  });

  // Test 4: Sidebar Component Exists and Supports Roles
  test('Sidebar component provides categorized, role-based navigation items', () => {
    assert.ok(fs.existsSync(sidebarPath), 'Sidebar.jsx must exist');

    // Consumer routes
    assert.ok(sidebarCode.includes('consumer_dashboard'), 'Must support consumer_dashboard');
    assert.ok(sidebarCode.includes('consumer_check'), 'Must support consumer_check');
    assert.ok(sidebarCode.includes('consumer_history'), 'Must support consumer_history');
    assert.ok(sidebarCode.includes('consumer_help'), 'Must support consumer_help');

    // Officer / Admin routes
    assert.ok(sidebarCode.includes('dashboard'), 'Must support dashboard');
    assert.ok(sidebarCode.includes('new_inspection'), 'Must support new_inspection');
    assert.ok(sidebarCode.includes('history'), 'Must support history');
    assert.ok(sidebarCode.includes('legal_search'), 'Must support legal_search');
    assert.ok(sidebarCode.includes('legal_sources'), 'Must support legal_sources');
    assert.ok(sidebarCode.includes('settings'), 'Must support settings');
  });

  // Test 5: Sidebar Collapsible & Mobile Overlay Support
  test('Sidebar supports desktop collapsed state, tooltips, and mobile drawer', () => {
    assert.ok(sidebarCode.includes('isCollapsed'), 'Must handle isCollapsed prop');
    assert.ok(sidebarCode.includes('sidebar-tooltip'), 'Must render tooltips for collapsed mode');
    assert.ok(sidebarCode.includes('sidebar-backdrop'), 'Must render mobile backdrop');
    assert.ok(sidebarCode.includes('sidebar-mobile-header'), 'Must render mobile drawer header');
    assert.ok(sidebarCode.includes('sidebar-collapse-btn'), 'Must render desktop collapse button');
    assert.ok(sidebarCode.includes('active'), 'Must support active item highlighting');
  });

  // Test 6: App.jsx Layout Integration
  test('App.jsx integrates Sidebar into app-body and passes toggle handlers to Navbar', () => {
    assert.ok(appCode.includes("import { Sidebar } from './components/Sidebar';"), 'Must import Sidebar');
    assert.ok(appCode.includes('sidebarCollapsed'), 'Must manage sidebarCollapsed state');
    assert.ok(appCode.includes('sidebarOpenMobile'), 'Must manage sidebarOpenMobile state');
    assert.ok(appCode.includes('app-body'), 'Must wrap layout in app-body container');
    assert.ok(appCode.includes('app-content-wrapper'), 'Must wrap content in app-content-wrapper');
    assert.ok(appCode.includes('<Sidebar'), 'Must render <Sidebar component');
    assert.ok(appCode.includes('onToggleSidebar'), 'Must pass onToggleSidebar to Navbar');
  });

  // Test 7: CSS Architecture & Responsive Breakpoints
  test('index.css declares modern styles for sidebar, navbar, and responsive behavior', () => {
    assert.ok(cssCode.includes('.sidebar {'), 'Must declare .sidebar class');
    assert.ok(cssCode.includes('.sidebar.collapsed {'), 'Must declare .sidebar.collapsed class');
    assert.ok(cssCode.includes('.sidebar-backdrop {'), 'Must declare .sidebar-backdrop class');
    assert.ok(cssCode.includes('.sidebar-tooltip {'), 'Must declare .sidebar-tooltip class');
    assert.ok(cssCode.includes('.sidebar-toggle-btn {'), 'Must declare .sidebar-toggle-btn class');
    assert.ok(cssCode.includes('.nav-quick-action-btn {'), 'Must declare .nav-quick-action-btn class');
    assert.ok(cssCode.includes('.nav-profile-dropdown {'), 'Must declare .nav-profile-dropdown class');
    assert.ok(cssCode.includes('@media (max-width: 1023px)'), 'Must declare tablet/mobile drawer breakpoint');
    assert.ok(cssCode.includes('overflow-x: hidden'), 'Must prevent horizontal overflow');
  });

  // Test 8: Layout Dimensions CSS Variables & Fixed Shell Positioning
  test('index.css declares layout CSS variables and fixes Navbar and Sidebar', () => {
    assert.ok(cssCode.includes('--navbar-height:'), 'Must define --navbar-height CSS variable');
    assert.ok(cssCode.includes('--sidebar-width:'), 'Must define --sidebar-width CSS variable');
    assert.ok(cssCode.includes('--sidebar-collapsed-width:'), 'Must define --sidebar-collapsed-width CSS variable');

    // Navbar fixed
    assert.ok(cssCode.includes('position: fixed;'), 'Must use position: fixed');
    assert.ok(cssCode.includes('height: var(--navbar-height);'), 'Navbar must occupy fixed navbar height');

    // Sidebar fixed
    assert.ok(cssCode.includes('top: var(--navbar-height);'), 'Sidebar must position below navbar');
    assert.ok(cssCode.includes('height: calc(100vh - var(--navbar-height));'), 'Sidebar must fit viewport height minus navbar');
  });

  // Test 9: Independent Main Content Scrolling Container
  test('index.css isolates scrolling to app-content-wrapper with dynamic margin compensation', () => {
    assert.ok(cssCode.includes('.app-content-wrapper {'), 'Must declare .app-content-wrapper class');
    assert.ok(cssCode.includes('margin-top: var(--navbar-height);'), 'Content wrapper must offset fixed navbar');
    assert.ok(cssCode.includes('margin-left: var(--sidebar-width);'), 'Content wrapper must offset expanded sidebar');
    assert.ok(cssCode.includes('overflow-y: auto;'), 'Content wrapper must have independent vertical scroll');
    assert.ok(cssCode.includes('margin-left: var(--sidebar-collapsed-width);'), 'Content wrapper must adjust left margin when sidebar is collapsed');
    assert.ok(appCode.includes("sidebarCollapsed ? 'sidebar-collapsed' : ''"), 'App.jsx must attach sidebar-collapsed class dynamically');
  });
});
