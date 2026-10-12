/**
 * Prevent regressions where Android accidentally uses an abbreviated UI.
 * This checks both the shared source routes and the actual Vite build output.
 */
import fs from 'node:fs';
import path from 'node:path';

const edition = process.env.BUILD_EDITION;
if (!['staff', 'customer'].includes(edition)) {
  throw new Error('BUILD_EDITION must be staff or customer.');
}

function containsAll(name, source, fragments) {
  const missing = fragments.filter((part) => !source.includes(part));
  if (missing.length) {
    throw new Error(`${name} is missing features: ${missing.join(', ')}`);
  }
  console.log(`✓ ${name}: ${fragments.length} required feature markers present`);
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
const staff = fs.readFileSync('src/components/StaffPortal.tsx', 'utf8');
const customer = fs.readFileSync('src/components/CustomerPortal.tsx', 'utf8');
const login = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');

if (app.includes('MobileEditionShell')) {
  throw new Error('Full-feature APKs must never load the reduced MobileEditionShell.');
}
containsAll('Shared site navigation', app, [
  '<StaffPortal />',
  '<CustomerPortal />',
  '<BookingPortal />',
  '<PromotionsCarousel />',
  '<DeliverablesViewer />',
  "APP_EDITION",
]);
containsAll('Staff terminal', staff, [
  '<AdminDashboard />',
  '<StaffBookingsTab />',
  '<StaffManagementTab />',
  '<PromotionsManagerTab />',
  '<CustomerDatabaseTab',
  '<FinancialReportingTab />',
  '<GoogleBusinessTab />',
  '<QRCodeScannerModal',
  '<BikeScraperTab',
  '<DerailleurHangerIdentifier />',
  "staffTab === 'scanner'",
  "staffTab === 'draws'",
  "staffTab === 'logs'",
]);
containsAll('Customer portal', customer, [
  '<StampCard ',
  '<WeeklyPrizeWheel',
  '<BikeIdentificationEngine',
  '<BookingPortal',
  "activeTab === 'garage'",
  "activeTab === 'bookings'",
  "activeTab === 'stamps'",
]);
containsAll('Separate mobile sign-ins', login, [
  "APP_EDITION === 'staff' ? 'staff' : 'signin'",
  'handleCustomerSignIn',
  'handleStaffSignIn',
  'handleRegister',
]);

const jsDir = path.join('dist', 'assets');
const assets = fs.readdirSync(jsDir).filter((file) => file.endsWith('.js'));
if (assets.length === 0) throw new Error('Vite did not create a JS bundle.');
const bundle = assets.map((file) => fs.readFileSync(path.join(jsDir, file), 'utf8')).join('\n');
containsAll(`${edition} Android bundled features`, bundle, [
  'Workshop Terminal',
  'Staff Management',
  'Barcode & Loyalty Station',
  'Hanger Identifier',
  'Financial Reports',
  'My Garage',
  'Weekly Prize Wheel',
  'Workshop Service Booking',
]);
const source = process.env.VITE_SOURCE_SHA || '';
if (!source || !bundle.includes(source)) {
  throw new Error('APK JS bundle does not contain the source commit provenance.');
}
console.log(`✓ ${edition} APK contains full application features from ${source}`);
