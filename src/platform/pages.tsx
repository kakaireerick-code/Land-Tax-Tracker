import React, { useState, useRef, useMemo } from 'react';
import {
  Upload, Download, Plus, AlertTriangle, Edit, EyeOff,
} from 'lucide-react';
import { formatDate, formatCurrency, calculatePenalty, downloadTextFile, parseCSV, assignEnforcementStage } from '../lib/helpers';
import type {
  AppUser, UserRole, PlatformSettings, RoleChangeLog, AutoEscalationRule,
} from '../types/platform';
import { isKnownDistrict } from '../data/districts';
import { FlatDistrictSelect } from '../components/DistrictSelect';
import { ROLE_LABELS } from '../types/platform';
import type { Property } from '../property';
import { UgandaCoatOfArms } from '../components/UgandaCoatOfArms';

export const DEFAULT_SETTINGS: PlatformSettings = {
  authorityName: '',
  districtName: '',
  revenueOfficeContact: '',
  bankAccountDetails: '',
  officialStampText: '',
};

export const DEFAULT_USERS: AppUser[] = [
  { id: 1, username: 'superadmin', fullName: 'Platform Super Administrator', password: 'admin', role: 'superAdmin', district: 'Kampala', email: 'superadmin@ultt.go.ug', phone: '+256 700 000001', status: 'active', lastLogin: null },
  { id: 2, username: 'admin', fullName: 'System Administrator', password: 'admin', role: 'admin', district: 'Kampala', email: 'admin@ultt.go.ug', phone: '+256 700 000002', status: 'active', lastLogin: null },
  { id: 3, username: 'officer', fullName: 'District Officer Kampala', password: 'admin', role: 'district_officer', district: 'Kampala', email: 'officer@ultt.go.ug', phone: '+256 700 000003', status: 'active', lastLogin: null },
  { id: 4, username: 'legal', fullName: 'Legal Officer', password: 'admin', role: 'legal', district: 'Kampala', email: 'legal@ultt.go.ug', phone: '+256 700 000004', status: 'active', lastLogin: null },
  { id: 5, username: 'viewer', fullName: 'Read Only Viewer', password: 'admin', role: 'viewer', district: 'Kampala', email: 'viewer@ultt.go.ug', phone: '+256 700 000005', status: 'active', lastLogin: null },
];

export const DEFAULT_ESCALATION_RULES: AutoEscalationRule[] = [
  { id: 1, label: 'Rule 1: 30 Days Overdue', description: '30 days overdue → send Stage 1 reminder', enabled: true, district: '' },
  { id: 2, label: 'Rule 2: 60 Days Overdue', description: '60 days overdue → generate Demand Notice, advance Stage 2', enabled: true, district: '' },
  { id: 3, label: 'Rule 3: 90 Days Overdue', description: '90 days no payment → advance Stage 3, send Stage 3 template', enabled: true, district: '' },
  { id: 4, label: 'Rule 4: 180 Days Overdue', description: '180 days no payment → advance Stage 4, open legal case', enabled: true, district: '' },
  { id: 5, label: 'Rule 5: Criminal Referral', description: 'Stage 4 + rental income declared → Criminal Referral Tracker', enabled: true, district: '' },
];

export const TOUR_STORAGE_KEY = (role: UserRole) => `ultt_tour_${role}`;

export function getTourSteps(role: UserRole): { title: string; description: string; icon: string }[] {
  const tours: Record<UserRole, { title: string; description: string; icon: string }[]> = {
    superAdmin: [
      { title: 'Your Platform Overview', description: 'You have full control. Dashboard shows all districts. You are the only user who can manage roles and users. Go to User Management to add officers and set their roles.', icon: '🏛️' },
      { title: 'Role Management', description: 'Only you can change user roles. Go to User Management. Add users, assign roles, deactivate inactive accounts. Role changes are logged with date and your name.', icon: '👤' },
      { title: 'Meeting Room', description: 'Use Meeting Room to chat with all Admins in real time. Share documents, post announcements, book meetings. Generate Zoom or Google Meet links from Book Meeting tab.', icon: '💬' },
      { title: 'Platform Settings', description: 'Go to Settings to configure your authority name, district, bank details, and official stamp text for all notices. Demo Mode settings are also managed here.', icon: '⚙️' },
      { title: 'You Are Ready', description: 'Start with Dashboard. Configure Settings. Add your officers. Use Meeting Room for team coordination. The AI Assistant is available for any platform question.', icon: '✅' },
    ],
    admin: [
      { title: 'Your Command Center', description: 'Dashboard shows delinquency stats and charts. Check red summary cards every morning. Total Interest Accrued shows penalty revenue at stake.', icon: '📊' },
      { title: 'Properties and Penalties', description: 'Properties page: color-coded enforcement rows. Green=paid, Yellow=1-30 days, Orange=31-90, Red=90+, Dark red=legal. Click any row to open the full property detail panel.', icon: '🏠' },
      { title: 'Enforcement Pipeline', description: 'Kanban board with 5 stages. Orange borders = urgent. Click Advance Stage to move stalled cases forward. Check this page every morning as your daily priority.', icon: '🔄' },
      { title: 'Meeting Room', description: 'Chat with other Admins in real time. Share enforcement documents without leaving the platform. Book meetings and generate video call links.', icon: '💬' },
      { title: 'Share and Announce', description: 'Draft public announcements and share to WhatsApp or email. Use the AI Assistant to generate professional announcements. Speak to the AI using the microphone button.', icon: '📢' },
      { title: 'AI Assistant', description: 'Your 24/7 guidance system. Type or speak any question. Keywords: penalty, demand notice, rent intercept, clearance, criminal, escalate, report, block, announce.', icon: '🤖' },
      { title: 'You Are Ready', description: 'Daily routine: Dashboard > Pipeline > Demand Notices. Use Meeting Room for team coordination. AI Assistant for any question. Help page for reference.', icon: '✅' },
    ],
    district_officer: [
      { title: 'Your District View', description: 'You see your district data only. Dashboard shows your district enforcement situation. Your role was set by the Super Administrator.', icon: '📍' },
      { title: 'Daily Workflow', description: 'Morning: check Pipeline for orange-bordered cards. Advance stalled cases. Issue pending demand notices. Send reminders to Stage 1 properties.', icon: '📋' },
      { title: 'Issuing Notices', description: 'Demand Notices page: one-click formal legal notices. Always click Mark as Issued after serving a notice. The system logs every action for compliance records.', icon: '📄' },
      { title: 'Handling Payments', description: 'When owner pays: open property, click Mark as Paid. Go to Tax Clearance, confirm CLEAR status. Issue Tax Clearance Certificate for the owner.', icon: '💰' },
      { title: 'You Are Ready', description: 'Order: Dashboard > Pipeline > Demand Notices > Notifications. Contact your Admin if you need role changes or help.', icon: '✅' },
    ],
    legal: [
      { title: 'Your Focused Access', description: 'You see Enforcement Pipeline and Legal Cases only. Your role is to manage Stage 4 court cases.', icon: '⚖️' },
      { title: 'Legal Case Manager', description: 'Open any case. Review penalty history and notices served. Update status after hearings. Generate Court Summary PDF. When closed: advance pipeline card to Stage 5.', icon: '📁' },
      { title: 'You Are Ready', description: 'Check Legal Case Manager every morning. Keep case statuses updated after every hearing. Notify the District Officer when cases resolve.', icon: '✅' },
    ],
    viewer: [
      { title: 'Read-Only Access', description: 'You can see all pages and all data. All action buttons are disabled for your role. Contact your Admin or District Officer to take actions.', icon: '👁️' },
      { title: 'Best Pages For You', description: 'Dashboard: overview. Analytics: performance charts. Report Generator: preview official reports. Uganda Map: visual delinquency by region.', icon: '📊' },
    ],
  };
  return tours[role] || tours.viewer;
}

const TEMPLATE_CSV = `Plot_Number,Owner_Name,Owner_Phone,Owner_Email,District,Sub_County,Parish,Village,Property_Type,Land_Title_Number,GPS_Latitude,GPS_Longitude,Annual_Tax_Due_UGX,Amount_Owed_UGX,Tax_Due_Date,Last_Payment_Date,Tenant_Name,Tenant_Phone,Rental_Income_Declared,Status
KLA-NEW-001,James Okello,+256 700 111222,james.okello@email.com,Kampala,Central Division,Kampala Central,Kibuli,Commercial,LT-2024-100,0.3100,32.5800,3500000,3500000,2024-06-01,,Grace Namuli,+256 700 333444,6000000,delinquent
WKS-NEW-002,Rebecca Nalubega,+256 700 555666,rebecca.n@email.com,Wakiso,Nansana,Nansana West,Nabweru,Residential,LT-2024-101,0.3700,32.5400,850000,850000,2024-08-15,,,,0,delinquent`;

const APP_FIELDS = [
  { key: 'plotNumber', label: 'Plot_Number', required: true },
  { key: 'ownerName', label: 'Owner_Name', required: true },
  { key: 'ownerPhone', label: 'Owner_Phone', required: false },
  { key: 'ownerEmail', label: 'Owner_Email', required: false },
  { key: 'district', label: 'District', required: true },
  { key: 'subCounty', label: 'Sub_County', required: false },
  { key: 'parish', label: 'Parish', required: false },
  { key: 'village', label: 'Village', required: false },
  { key: 'propertyType', label: 'Property_Type', required: false },
  { key: 'landTitleNumber', label: 'Land_Title_Number', required: false },
  { key: 'lat', label: 'GPS_Latitude', required: false },
  { key: 'lng', label: 'GPS_Longitude', required: false },
  { key: 'annualTaxDue', label: 'Annual_Tax_Due_UGX', required: true },
  { key: 'principalOwed', label: 'Amount_Owed_UGX', required: false },
  { key: 'taxDueDate', label: 'Tax_Due_Date', required: true },
  { key: 'lastPaymentDate', label: 'Last_Payment_Date', required: false },
  { key: 'tenantName', label: 'Tenant_Name', required: false },
  { key: 'tenantPhone', label: 'Tenant_Phone', required: false },
  { key: 'rentalIncomeDeclared', label: 'Rental_Income_Declared', required: false },
  { key: 'status', label: 'Status', required: false },
];

export function DemoModeBanner() {
  return (
    <div className="bg-yellow-400 text-yellow-900 px-4 py-2 text-sm font-medium text-center border-b border-yellow-500">
      DEMO MODE ACTIVE — All data shown is fictional and for training purposes only. This does not represent any real property, owner, or financial information. Switch off Demo Mode to access live official records.
    </div>
  );
}

export function LoginPage({ onLogin, users }: { onLogin: (u: { username: string; district: string; role: UserRole }) => void; users: AppUser[] }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [district, setDistrict] = useState('Kampala');
  const [role, setRole] = useState<UserRole>('admin');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    setError('');
    const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    onLogin({ username: username.trim(), district: existing?.district || district, role: existing?.role || role });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="h-2 flex">
          <div className="flex-1 bg-black" /><div className="flex-1 bg-[#FCDD09]" /><div className="flex-1 bg-[#C8102E]" />
        </div>
        <div className="p-8">
          <UgandaCoatOfArms size={120} className="block mx-auto mb-4" />
          <h1 className="text-xl font-bold text-center text-[#1a1a1a] dark:text-white">Uganda Land Tax Tracker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-6">Digitizing Land Tax Enforcement Across Uganda</p>
          {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full ultt-input px-4 py-3" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full ultt-input px-4 py-3" />
            <FlatDistrictSelect value={district} onChange={setDistrict} className="w-full ultt-select px-4 py-3" />
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full ultt-select px-4 py-3">
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button type="submit" className="w-full bg-[#C8102E] text-white py-3 rounded-lg font-semibold hover:bg-red-700">Login</button>
          </form>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">Enter any username and password to login</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center pb-4">Uganda Land Tax Tracker — Official Platform</p>
      </div>
    </div>
  );
}

export function TourModal({ steps, stepIndex, onNext, onPrev, onSkip, onComplete }: {
  steps: { title: string; description: string; icon: string }[];
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full overflow-hidden text-gray-900 dark:text-gray-100">
        <div className="h-2 flex"><div className="flex-1 bg-black" /><div className="flex-1 bg-[#FCDD09]" /><div className="flex-1 bg-[#C8102E]" /></div>
        <div className="p-6">
          <UgandaCoatOfArms size={72} className="mx-auto mb-3" />
          <h2 className="text-lg font-bold text-center mb-4 text-gray-900 dark:text-white">Welcome to Uganda Land Tax Tracker</h2>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-[#C8102E] h-2 rounded-full transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Step {stepIndex + 1} of {steps.length}</p>
          <div className="text-4xl mb-3">{step.icon}</div>
          <h3 className="text-[#C8102E] font-bold text-lg mb-2">{step.title}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{step.description}</p>
          <div className="flex justify-between gap-2">
            <button onClick={onSkip} className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">Skip Tour</button>
            <div className="flex gap-2">
              {stepIndex > 0 && <button onClick={onPrev} className="px-4 py-2 border border-[#C8102E] text-[#C8102E] rounded-lg text-sm">Previous</button>}
              <button onClick={isLast ? onComplete : onNext} className="px-4 py-2 bg-[#C8102E] text-white rounded-lg text-sm">{isLast ? 'Get Started' : 'Next'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function exportPropertiesCSV(properties: Property[], type: 'all' | 'delinquent' | 'enforcement') {
  let filtered = properties;
  if (type === 'delinquent') filtered = properties.filter((p) => p.status === 'delinquent' || p.status === 'partial');
  if (type === 'enforcement') filtered = properties.filter((p) => p.enforcementStage !== 'resolved');
  const headers = ['Plot_Number', 'Owner_Name', 'District', 'Annual_Tax_Due_UGX', 'Days_Overdue', 'Interest_Accrued_UGX', 'Total_Owed_UGX', 'Daily_Interest_UGX', 'Enforcement_Stage', 'Clearance_Status'];
  const rows = filtered.map((p) => {
    const pen = calculatePenalty(p.annualTaxDue, p.taxDueDate);
    return [p.plotNumber, p.ownerName, p.district, p.annualTaxDue, pen.daysOverdue, pen.interest, pen.totalOwed, pen.dailyInterest, p.enforcementStage, p.status === 'paid' ? 'CLEAR' : 'BLOCKED'].join(',');
  });
  downloadTextFile(`${type}_properties_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`, [headers.join(','), ...rows].join('\n'));
}

export function DataImportPage({ onImport, showToast }: { onImport: (props: Property[]) => void; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'import'>('upload');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const requiredMapped = APP_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|xlsx)$/i)) {
      showToast('Only .csv and .xlsx files are accepted', 'error');
      return;
    }
    if (file.name.endsWith('.xlsx')) {
      showToast('XLSX detected — please save as CSV using the template format', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { showToast('File appears empty', 'error'); return; }
      setFileHeaders(parsed[0]);
      setFileRows(parsed.slice(1));
      setMapping({});
      setStep('map');
    };
    reader.readAsText(file);
  };

  const previewRows = useMemo(() => {
    return fileRows.slice(0, 10).map((row, ri) => {
      const obj: Record<string, string> = {};
      const warnings: string[] = [];
      const errors: string[] = [];
      APP_FIELDS.forEach((f) => {
        const colIdx = fileHeaders.indexOf(mapping[f.key] || '');
        obj[f.key] = colIdx >= 0 ? row[colIdx] || '' : '';
      });
      if (!obj.plotNumber) errors.push('Missing plot number');
      if (!obj.ownerName) errors.push('Missing owner name');
      if (!obj.district) errors.push('Missing district');
      else if (!isKnownDistrict(obj.district)) warnings.push(`District "${obj.district}" not in official list`);
      if (obj.annualTaxDue && isNaN(Number(obj.annualTaxDue))) errors.push('Invalid tax amount');
      if (obj.taxDueDate && isNaN(new Date(obj.taxDueDate).getTime())) warnings.push('Invalid date format');
      return { row: obj, warnings, errors, index: ri };
    });
  }, [fileRows, fileHeaders, mapping]);

  const runImport = async () => {
    setStep('import');
    const imported: Property[] = [];
    let skipped = 0;
    let totalInterest = 0;
    for (let i = 0; i < fileRows.length; i++) {
      setProgress(Math.round(((i + 1) / fileRows.length) * 100));
      await new Promise((r) => setTimeout(r, 30));
      const row = fileRows[i];
      const get = (key: string) => { const idx = fileHeaders.indexOf(mapping[key] || ''); return idx >= 0 ? row[idx]?.trim() : ''; };
      const plot = get('plotNumber');
      const owner = get('ownerName');
      const district = get('district');
      const taxDue = get('taxDueDate');
      const annual = Number(get('annualTaxDue')) || 0;
      if (!plot || !owner || !district || !taxDue || !annual) { skipped++; continue; }
      const pen = calculatePenalty(annual, taxDue);
      totalInterest += pen.interest;
      const stage = assignEnforcementStage(pen.daysOverdue, get('status') || 'delinquent');
      imported.push({
        id: Date.now() + i,
        plotNumber: plot, ownerName: owner, ownerPhone: get('ownerPhone') || '',
        ownerEmail: get('ownerEmail'), district, subCounty: get('subCounty') || '',
        parish: get('parish'), village: get('village'), propertyType: get('propertyType') || 'Residential',
        landTitleNumber: get('landTitleNumber') || '', lat: Number(get('lat')) || 0, lng: Number(get('lng')) || 0,
        annualTaxDue: annual, principalOwed: Number(get('principalOwed')) || annual,
        taxDueDate: taxDue, lastPaymentDate: get('lastPaymentDate') || null,
        tenantName: get('tenantName') || null, tenantPhone: get('tenantPhone') || null,
        rentalIncomeDeclared: Number(get('rentalIncomeDeclared')) || 0,
        status: (get('status') as Property['status']) || 'delinquent',
        enforcementStage: stage, notes: '', imported: true,
      });
    }
    onImport(imported);
    showToast(`Imported ${imported.length} records. Skipped ${skipped}. Total interest: ${formatCurrency(totalInterest)}`);
    setStep('upload');
    setProgress(0);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Import</h1>
      {step === 'upload' && (
        <div>
          <button onClick={() => downloadTextFile('ultt_import_template.csv', TEMPLATE_CSV)} className="mb-4 flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg">
            <Download size={18} /> Download Template CSV
          </button>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer ${dragOver ? 'border-[#C8102E] bg-red-50' : 'border-gray-300'}`}
          >
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="font-medium">Drag and drop .csv or .xlsx files here</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      )}
      {step === 'map' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h3 className="ultt-section-title">Column Mapping</h3>
          {APP_FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-2 gap-4 items-center">
              <span className="text-sm">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</span>
              <select value={mapping[f.key] || ''} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="">— Select column —</option>
                {fileHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          <button disabled={!requiredMapped} onClick={() => setStep('preview')} className="bg-[#C8102E] text-white px-6 py-2 rounded-lg disabled:opacity-50">Continue</button>
        </div>
      )}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#C8102E] text-white"><tr><th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Plot</th><th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Owner</th><th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">District</th><th className="px-3 py-2 text-left text-xs font-medium text-white uppercase">Status</th></tr></thead>
              <tbody>{previewRows.map((pr) => (
                <tr key={pr.index} className={pr.errors.length ? 'bg-red-50' : pr.warnings.length ? 'bg-yellow-50' : ''}>
                  <td className="px-3 py-2">{pr.row.plotNumber}</td><td className="px-3 py-2">{pr.row.ownerName}</td>
                  <td className="px-3 py-2">{pr.row.district}</td>
                  <td className="px-3 py-2">{pr.errors.length ? pr.errors.join(', ') : pr.warnings.length ? pr.warnings.join(', ') : 'OK'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <button onClick={runImport} className="bg-[#C8102E] text-white px-6 py-2 rounded-lg">Import {fileRows.length} Records</button>
        </div>
      )}
      {step === 'import' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-[#C8102E] h-4 rounded-full" style={{ width: `${progress}%` }} /></div>
          <p className="text-sm mt-2">{progress}%</p>
        </div>
      )}
    </div>
  );
}

export function UserManagementPage({ users, setUsers, roleChangeLog, setRoleChangeLog, currentUser, showToast }: {
  users: AppUser[]; setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  roleChangeLog: RoleChangeLog[]; setRoleChangeLog: React.Dispatch<React.SetStateAction<RoleChangeLog[]>>;
  currentUser: AppUser; showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState({ fullName: '', username: '', password: '', confirmPassword: '', role: 'viewer' as UserRole, district: 'Kampala', email: '', phone: '' });

  if (currentUser.role !== 'superAdmin') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
        <p className="text-lg font-medium">Access Denied. Role management is restricted to the Platform Super Administrator only.</p>
      </div>
    );
  }

  const saveUser = () => {
    if (!form.fullName || !form.username || !form.password) { showToast('Fill required fields', 'error'); return; }
    if (form.password !== form.confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    if (editUser) {
      if (editUser.role !== form.role) {
        setRoleChangeLog((prev) => [...prev, { id: Date.now(), changedBy: currentUser.fullName, targetUser: form.username, previousRole: editUser.role, newRole: form.role, timestamp: formatDate(new Date(), 'MMM d, yyyy HH:mm') }]);
      }
      setUsers((prev) => prev.map((u) => u.id === editUser.id ? { ...u, fullName: form.fullName, username: form.username, password: form.password, role: form.role, district: form.district, email: form.email, phone: form.phone } : u));
      showToast('User updated');
    } else {
      setUsers((prev) => [...prev, { id: Date.now(), fullName: form.fullName, username: form.username, password: form.password, role: form.role, district: form.district, email: form.email, phone: form.phone, status: 'active', lastLogin: null }]);
      showToast('User added');
    }
    setShowForm(false); setEditUser(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button onClick={() => { setShowForm(true); setEditUser(null); }} className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-lg"><Plus size={18} /> Add User</button>
      </div>
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 grid md:grid-cols-2 gap-4">
          {(['fullName', 'username', 'password', 'confirmPassword', 'email', 'phone'] as const).map((f) => (
            <input key={f} type={f.includes('password') ? 'password' : 'text'} placeholder={f} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="border rounded px-3 py-2" />
          ))}
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="border rounded px-3 py-2">{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <FlatDistrictSelect value={form.district} onChange={(d) => setForm({ ...form, district: d })} className="border rounded px-3 py-2" />
          <button onClick={saveUser} className="md:col-span-2 bg-[#C8102E] text-white py-2 rounded-lg">Save</button>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#C8102E] text-white"><tr>{['Username', 'Full Name', 'Role', 'District', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{users.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">{u.username}</td><td className="px-4 py-3">{u.fullName}</td>
              <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td><td className="px-4 py-3">{u.district}</td>
              <td className="px-4 py-3">{u.status}</td>
              <td className="px-4 py-3 flex gap-2">
                <button onClick={() => { setEditUser(u); setForm({ fullName: u.fullName, username: u.username, password: u.password, confirmPassword: u.password, role: u.role, district: u.district, email: u.email, phone: u.phone }); setShowForm(true); }}><Edit size={16} /></button>
                <button onClick={() => { setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x)); showToast('Status updated'); }}><EyeOff size={16} /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {roleChangeLog.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-2">Role Change Log</h3>
          {roleChangeLog.slice(-5).reverse().map((l) => (
            <p key={l.id} className="text-sm text-gray-600 dark:text-gray-400">{l.timestamp}: {l.changedBy} changed {l.targetUser} from {ROLE_LABELS[l.previousRole]} to {ROLE_LABELS[l.newRole]}</p>
          ))}
        </div>
      )}
    </div>
  );
}
