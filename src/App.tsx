import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Building2,
  Calculator,
  Map,
  GitBranch,
  FileText,
  CheckCircle,
  Ban,
  AlertTriangle,
  Bell,
  BarChart3,
  FileBarChart,
  Scale,
  Bot,
  Menu,
  X,
  Search,
  Download,
  Check,
  AlertCircle,
  Clock,
  User,
  MapPin,
  Send,
  Plus,
  ArrowRight,
  RefreshCw,
  Upload,
  ChevronLeft,
  ChevronRight,
  Users,
  Video,
  Share2,
  Settings,
  TrendingUp,
  Zap,
  HelpCircle,
  LogOut,
  Mic,
  Volume2,
  Square,
} from 'lucide-react';
import {
  LoginPage, TourModal, DemoModeBanner, DataImportPage, exportPropertiesCSV,
  UserManagementPage, DEFAULT_SETTINGS, DEFAULT_USERS, DEFAULT_ESCALATION_RULES,
  getTourSteps, TOUR_STORAGE_KEY,
} from './platform/pages';
import {
  MeetingRoomPage, ShareAnnouncePage, SettingsPage, InterestProjectionPage,
  AutoEscalationPage, HelpPage, RentInterceptionModal, getNextAction,
} from './platform/extras';
import { createDemoProperties } from './data/demo';
import { UGANDA_DISTRICT_COUNT, DISTRICT_REGION_MAP, REGION_DESCRIPTIONS } from './data/districts';
import { FlatDistrictSelect, GroupedDistrictSelect } from './components/DistrictSelect';
import { loadJson, saveJson } from './lib/storage';
import type { AppUser, UserRole, PlatformSettings, EscalationLogEntry, DemoUsageLog } from './types/platform';
import { ROLE_LABELS } from './types/platform';
import { UgandaCoatOfArms, UGANDA_COAT_OF_ARMS_TEXT } from './components/UgandaCoatOfArms';
import { ThemeToggle, type ThemeMode } from './components/ThemeToggle';
// Plain JavaScript date helpers (replacing date-fns)
const formatDate = (date: Date, formatStr: string): string => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (formatStr === 'MMM yyyy') {
    return `${shortMonths[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (formatStr === 'MMM') {
    return shortMonths[date.getMonth()];
  }
  if (formatStr === 'MMMM d, yyyy') {
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }
  if (formatStr === 'yyyy-MM-dd') {
    return date.toISOString().split('T')[0];
  }
  if (formatStr === 'MMM d, yyyy HH:mm') {
    return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  if (formatStr === 'MMM d, HH:mm') {
    return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  return date.toLocaleDateString();
};

const subMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

// Types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Property {
  id: number;
  plotNumber: string;
  ownerName: string;
  ownerPhone: string;
  district: string;
  subCounty: string;
  propertyType: string;
  landTitleNumber: string;
  lat: number;
  lng: number;
  annualTaxDue: number;
  principalOwed: number;
  taxDueDate: string;
  lastPaymentDate: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  rentalIncomeDeclared: number;
  status: 'delinquent' | 'paid' | 'partial';
  enforcementStage: string;
  notes: string;
  imported?: boolean;
  ownerEmail?: string;
  parish?: string;
  village?: string;
}

interface EnforcementAction {
  id: number;
  propertyId: number;
  propertyName: string;
  action: string;
  timestamp: string;
  officer: string;
}

interface NotificationHistoryItem {
  id: number;
  propertyId: number;
  propertyName: string;
  ownerName: string;
  message: string;
  dateSent: string;
  sentBy: string;
  status: string;
}

interface CertificateIssued {
  id: number;
  propertyName: string;
  ownerName: string;
  dateIssued: string;
}

interface CriminalReferral {
  id: number;
  propertyId: number;
  propertyName: string;
  ownerName: string;
  rentalIncomeDeclared: number;
  referralDate: string;
  stage: string;
  officer: string;
  notes: string;
  reason: string;
}

// Utility functions
const formatCurrency = (amount: number): string => {
  return `UGX ${amount.toLocaleString()}`;
};

const STAGE_BADGE_STYLES: Record<string, { backgroundColor: string; color: string }> = {
  interest_accruing: { backgroundColor: '#FCDD09', color: '#1a1a1a' },
  demand_notice: { backgroundColor: '#e07b00', color: '#ffffff' },
  rent_interception: { backgroundColor: '#C8102E', color: '#ffffff' },
  legal_action: { backgroundColor: '#7a0000', color: '#ffffff' },
  resolved: { backgroundColor: '#1a7a4a', color: '#ffffff' },
};

const formatStageLabel = (stage: string): string => stage.replace(/_/g, ' ');

function StageBadge({ stage }: { stage: string }) {
  const badgeStyle = STAGE_BADGE_STYLES[stage] ?? { backgroundColor: '#6b7280', color: '#ffffff' };
  return (
    <span
      style={{
        backgroundColor: badgeStyle.backgroundColor,
        color: badgeStyle.color,
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {formatStageLabel(stage)}
    </span>
  );
}

const calculatePenalty = (annualTaxDue: number, taxDueDateString: string) => {
  const today = new Date();
  const taxDueDate = new Date(taxDueDateString);
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - taxDueDate.getTime()) / 86400000));
  const monthsOverdue = daysOverdue / 30;
  const interest = annualTaxDue * 0.02 * monthsOverdue;
  const totalOwed = annualTaxDue + interest;
  const dailyInterest = (annualTaxDue * 0.02) / 30;

  return {
    daysOverdue: Math.round(daysOverdue),
    monthsOverdue: Math.round(monthsOverdue * 10) / 10,
    interest: Math.round(interest),
    totalOwed: Math.round(totalOwed),
    dailyInterest: Math.round(dailyInterest),
  };
};

// Mock Data
const mockProperties: Property[] = [
  { id: 1, plotNumber: 'KLA-001', ownerName: 'John Mukasa', ownerPhone: '+256 700 123456', district: 'Kampala', subCounty: 'Central Division', propertyType: 'Commercial', landTitleNumber: 'LT-2020-001', lat: 0.3177, lng: 32.5814, annualTaxDue: 5000000, principalOwed: 0, taxDueDate: '2024-01-15', lastPaymentDate: '2024-01-10', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'paid', enforcementStage: 'resolved', notes: '' },
  { id: 2, plotNumber: 'KLA-002', ownerName: 'Mary Nambi', ownerPhone: '+256 700 234567', district: 'Kampala', subCounty: 'Makindye', propertyType: 'Residential', landTitleNumber: 'LT-2020-002', lat: 0.2985, lng: 32.5822, annualTaxDue: 1200000, principalOwed: 1200000, taxDueDate: '2024-03-01', lastPaymentDate: null, tenantName: 'Peter Okello', tenantPhone: '+256 700 345678', rentalIncomeDeclared: 2400000, status: 'delinquent', enforcementStage: 'demand_notice', notes: 'Owner unreachable by phone' },
  { id: 3, plotNumber: 'KLA-003', ownerName: 'Robert Ssempala', ownerPhone: '+256 700 345678', district: 'Kampala', subCounty: 'Nakawa', propertyType: 'Industrial', landTitleNumber: 'LT-2019-045', lat: 0.3345, lng: 32.6215, annualTaxDue: 8500000, principalOwed: 8500000, taxDueDate: '2023-09-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'legal_action', notes: 'High priority case' },
  { id: 4, plotNumber: 'WKS-001', ownerName: 'Sarah Nalubega', ownerPhone: '+256 700 456789', district: 'Wakiso', subCounty: 'Nansana', propertyType: 'Residential', landTitleNumber: 'LT-2021-112', lat: 0.3733, lng: 32.5467, annualTaxDue: 800000, principalOwed: 0, taxDueDate: '2024-06-01', lastPaymentDate: '2024-05-28', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'paid', enforcementStage: 'resolved', notes: '' },
  { id: 5, plotNumber: 'WKS-002', ownerName: 'David Kizito', ownerPhone: '+256 700 567890', district: 'Wakiso', subCounty: 'Entebbe', propertyType: 'Commercial', landTitleNumber: 'LT-2018-089', lat: 0.2082, lng: 32.4938, annualTaxDue: 3200000, principalOwed: 3200000, taxDueDate: '2024-01-01', lastPaymentDate: null, tenantName: 'Grace Namuli', tenantPhone: '+256 700 678901', rentalIncomeDeclared: 4800000, status: 'delinquent', enforcementStage: 'rent_interception', notes: 'Rent interception active' },
  { id: 6, plotNumber: 'WKS-003', ownerName: 'Agnes Nakato', ownerPhone: '+256 700 678901', district: 'Wakiso', subCounty: 'Kira', propertyType: 'Residential', landTitleNumber: 'LT-2022-234', lat: 0.3944, lng: 32.6378, annualTaxDue: 650000, principalOwed: 325000, taxDueDate: '2024-02-15', lastPaymentDate: '2024-03-01', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'partial', enforcementStage: 'interest_accruing', notes: 'Payment plan agreed' },
  { id: 7, plotNumber: 'MKN-001', ownerName: 'Emmanuel Lwanga', ownerPhone: '+256 700 789012', district: 'Mukono', subCounty: 'Central', propertyType: 'Commercial', landTitleNumber: 'LT-2020-156', lat: 0.3515, lng: 32.7545, annualTaxDue: 4500000, principalOwed: 4500000, taxDueDate: '2023-12-01', lastPaymentDate: null, tenantName: 'Steven Musoke', tenantPhone: '+256 700 890123', rentalIncomeDeclared: 6000000, status: 'delinquent', enforcementStage: 'demand_notice', notes: '' },
  { id: 8, plotNumber: 'MKN-002', ownerName: 'Hellen Namulinda', ownerPhone: '+256 700 890123', district: 'Mukono', subCounty: 'Seeta', propertyType: 'Residential', landTitleNumber: 'LT-2021-267', lat: 0.3789, lng: 32.7123, annualTaxDue: 550000, principalOwed: 0, taxDueDate: '2024-07-01', lastPaymentDate: '2024-06-25', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'paid', enforcementStage: 'resolved', notes: '' },
  { id: 9, plotNumber: 'GUL-001', ownerName: 'Patrick Ochieng', ownerPhone: '+256 700 901234', district: 'Gulu', subCounty: 'Central', propertyType: 'Commercial', landTitleNumber: 'LT-2019-345', lat: 2.7744, lng: 32.2997, annualTaxDue: 2800000, principalOwed: 2800000, taxDueDate: '2024-02-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'interest_accruing', notes: '' },
  { id: 10, plotNumber: 'ARU-001', ownerName: 'Beatrice Acheng', ownerPhone: '+256 700 012345', district: 'Arua', subCounty: 'Layibi', propertyType: 'Residential', landTitleNumber: 'LT-2022-456', lat: 3.0196, lng: 30.9117, annualTaxDue: 400000, principalOwed: 400000, taxDueDate: '2024-04-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'interest_accruing', notes: '' },
  { id: 11, plotNumber: 'MBR-001', ownerName: 'Charles Banyenzaki', ownerPhone: '+256 700 123789', district: 'Mbarara', subCounty: 'Central', propertyType: 'Commercial', landTitleNumber: 'LT-2017-067', lat: -0.6147, lng: 30.6556, annualTaxDue: 6200000, principalOwed: 6200000, taxDueDate: '2023-06-01', lastPaymentDate: null, tenantName: 'Ivan Tumwine', tenantPhone: '+256 700 234890', rentalIncomeDeclared: 8400000, status: 'delinquent', enforcementStage: 'legal_action', notes: 'Court hearing pending' },
  { id: 12, plotNumber: 'MBR-002', ownerName: 'Diana Atuhaire', ownerPhone: '+256 700 234890', district: 'Mbarara', subCounty: 'Nyamitanga', propertyType: 'Residential', landTitleNumber: 'LT-2023-567', lat: -0.6234, lng: 30.6678, annualTaxDue: 720000, principalOwed: 0, taxDueDate: '2024-08-01', lastPaymentDate: '2024-07-30', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'paid', enforcementStage: 'resolved', notes: '' },
  { id: 13, plotNumber: 'KLA-004', ownerName: 'Francis Walugembe', ownerPhone: '+256 700 345901', district: 'Kampala', subCounty: 'Rubaga', propertyType: 'Commercial', landTitleNumber: 'LT-2016-023', lat: 0.3012, lng: 32.5567, annualTaxDue: 9500000, principalOwed: 9500000, taxDueDate: '2023-03-01', lastPaymentDate: null, tenantName: 'Robert Ssekandi', tenantPhone: '+256 700 456012', rentalIncomeDeclared: 12000000, status: 'delinquent', enforcementStage: 'rent_interception', notes: 'Multiple properties affected' },
  { id: 14, plotNumber: 'WKS-004', ownerName: 'Grace Nalubowa', ownerPhone: '+256 700 456012', district: 'Wakiso', subCounty: 'Busiro', propertyType: 'Residential', landTitleNumber: 'LT-2020-678', lat: 0.4123, lng: 32.4890, annualTaxDue: 480000, principalOwed: 480000, taxDueDate: '2024-05-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'demand_notice', notes: '' },
  { id: 15, plotNumber: 'MKN-003', ownerName: 'Joseph Ssekiziyivu', ownerPhone: '+256 700 567123', district: 'Mukono', subCounty: 'Nagojje', propertyType: 'Industrial', landTitleNumber: 'LT-2015-089', lat: 0.4234, lng: 32.7890, annualTaxDue: 7200000, principalOwed: 7200000, taxDueDate: '2023-01-01', lastPaymentDate: null, tenantName: 'Tech Solutions Ltd', tenantPhone: '+256 700 678234', rentalIncomeDeclared: 15000000, status: 'delinquent', enforcementStage: 'legal_action', notes: 'Company director summons issued' },
  { id: 16, plotNumber: 'GUL-003', ownerName: 'Margaret Lalam', ownerPhone: '+256 700 678234', district: 'Gulu', subCounty: 'Pece', propertyType: 'Commercial', landTitleNumber: 'LT-2021-789', lat: 2.7654, lng: 32.2789, annualTaxDue: 1800000, principalOwed: 900000, taxDueDate: '2024-03-01', lastPaymentDate: '2024-04-15', tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'partial', enforcementStage: 'interest_accruing', notes: '' },
  { id: 17, plotNumber: 'HOI-001', ownerName: 'Simon Taremwa', ownerPhone: '+256 700 789345', district: 'Hoima', subCounty: 'Kakoba', propertyType: 'Residential', landTitleNumber: 'LT-2022-890', lat: 1.4319, lng: 31.3524, annualTaxDue: 600000, principalOwed: 600000, taxDueDate: '2024-06-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'demand_notice', notes: '' },
  { id: 18, plotNumber: 'KLA-005', ownerName: 'Victoria Namugga', ownerPhone: '+256 700 890456', district: 'Kampala', subCounty: 'Kawempe', propertyType: 'Commercial', landTitleNumber: 'LT-2019-901', lat: 0.3456, lng: 32.5678, annualTaxDue: 3800000, principalOwed: 3800000, taxDueDate: '2024-01-15', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'rent_interception', notes: '' },
  { id: 19, plotNumber: 'JIN-001', ownerName: 'William Senyonyi', ownerPhone: '+256 700 901567', district: 'Jinja', subCounty: 'Central', propertyType: 'Residential', landTitleNumber: 'LT-2023-012', lat: 0.4244, lng: 33.2042, annualTaxDue: 550000, principalOwed: 550000, taxDueDate: '2024-04-01', lastPaymentDate: null, tenantName: null, tenantPhone: null, rentalIncomeDeclared: 0, status: 'delinquent', enforcementStage: 'interest_accruing', notes: '' },
  { id: 20, plotNumber: 'MKN-004', ownerName: 'Annet Nalwoga', ownerPhone: '+256 700 012678', district: 'Mukono', subCounty: 'Goma', propertyType: 'Commercial', landTitleNumber: 'LT-2018-123', lat: 0.4012, lng: 32.7345, annualTaxDue: 2900000, principalOwed: 2900000, taxDueDate: '2023-11-01', lastPaymentDate: null, tenantName: 'Johnson Mutebi', tenantPhone: '+256 700 123789', rentalIncomeDeclared: 4200000, status: 'delinquent', enforcementStage: 'demand_notice', notes: '' },
];

const initialEnforcementActions: EnforcementAction[] = [
  { id: 1, propertyId: 3, propertyName: 'KLA-003', action: 'Legal action filed', timestamp: '2024-01-15T10:30:00', officer: 'Admin' },
  { id: 2, propertyId: 5, propertyName: 'WKS-002', action: 'Rent interception notice served', timestamp: '2024-01-14T14:22:00', officer: 'Officer Mukasa' },
  { id: 3, propertyId: 2, propertyName: 'KLA-002', action: 'Demand notice issued', timestamp: '2024-01-13T09:15:00', officer: 'Officer Namuli' },
  { id: 4, propertyId: 11, propertyName: 'MBR-001', action: 'Court date set', timestamp: '2024-01-12T11:45:00', officer: 'Admin' },
  { id: 5, propertyId: 13, propertyName: 'KLA-004', action: 'Rent interception activated', timestamp: '2024-01-11T16:00:00', officer: 'Officer Kizito' },
  { id: 6, propertyId: 6, propertyName: 'WKS-003', action: 'Payment plan agreed', timestamp: '2024-01-10T13:30:00', officer: 'Officer Nakato' },
  { id: 7, propertyId: 15, propertyName: 'MKN-003', action: 'Summons issued to director', timestamp: '2024-01-09T10:00:00', officer: 'Admin' },
  { id: 8, propertyId: 1, propertyName: 'KLA-001', action: 'Payment received - cleared', timestamp: '2024-01-08T15:20:00', officer: 'Officer Mukasa' },
  { id: 9, propertyId: 7, propertyName: 'MKN-001', action: 'Demand notice sent', timestamp: '2024-01-07T09:00:00', officer: 'Officer Lwanga' },
  { id: 10, propertyId: 14, propertyName: 'WKS-004', action: 'First reminder sent', timestamp: '2024-01-06T11:30:00', officer: 'Officer Nalubowa' },
];

// Main App Component
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>(() => loadJson('ultt_users', DEFAULT_USERS));
  const [settings, setSettings] = useState<PlatformSettings>(() => loadJson('ultt_settings', DEFAULT_SETTINGS));
  const [demoMode, setDemoMode] = useState(false);
  const [realProperties, setRealProperties] = useState<Property[]>(mockProperties);
  const [demoProperties, setDemoProperties] = useState<Property[]>(createDemoProperties);
  const [roleChangeLog, setRoleChangeLog] = useState<{ id: number; changedBy: string; targetUser: string; previousRole: UserRole; newRole: UserRole; timestamp: string }[]>(() => loadJson('ultt_role_log', []));
  const [escalationLog, setEscalationLog] = useState<EscalationLogEntry[]>(() => loadJson('ultt_escalation_log', []));
  const [escalationRules, setEscalationRules] = useState(() => loadJson('ultt_escalation_rules', DEFAULT_ESCALATION_RULES));
  const [demoUsageLog, setDemoUsageLog] = useState<DemoUsageLog[]>(() => loadJson('ultt_demo_log', []));
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('ultt_theme');
    return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto';
  });
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShowInstall(false);
      }
    }
  };
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [enforcementActions, setEnforcementActions] = useState<EnforcementAction[]>(initialEnforcementActions);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);
  const [certificatesIssued, setCertificatesIssued] = useState<CertificateIssued[]>([]);
  const [criminalReferrals, setCriminalReferrals] = useState<CriminalReferral[]>([]);

  const currentRole = currentUser?.role ?? 'viewer';
  const properties = demoMode ? demoProperties : realProperties;
  const setProperties = demoMode ? setDemoProperties : setRealProperties;

  useEffect(() => { saveJson('ultt_users', users); }, [users]);
  useEffect(() => { saveJson('ultt_settings', settings); }, [settings]);
  useEffect(() => { saveJson('ultt_escalation_rules', escalationRules); }, [escalationRules]);

  const handleLogin = (login: { username: string; district: string; role: UserRole }) => {
    let user = users.find((u) => u.username.toLowerCase() === login.username.toLowerCase());
    if (!user) {
      user = { id: Date.now(), username: login.username, fullName: login.username, password: '', role: login.role, district: login.district, email: '', phone: '', status: 'active', lastLogin: formatDate(new Date(), 'MMM d, yyyy HH:mm') };
      setUsers((prev) => [...prev, user!]);
    } else {
      setUsers((prev) => prev.map((u) => u.id === user!.id ? { ...u, lastLogin: formatDate(new Date(), 'MMM d, yyyy HH:mm') } : u));
    }
    setCurrentUser(user);
    setIsLoggedIn(true);
    const seen = loadJson(TOUR_STORAGE_KEY(user.role), false);
    if (!seen) { setShowTour(true); setTourStep(0); }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const addActivity = useCallback((propertyId: number, propertyName: string, action: string) => {
    const newAction: EnforcementAction = {
      id: Date.now(),
      propertyId,
      propertyName,
      action,
      timestamp: new Date().toISOString(),
      officer: currentRole,
    };
    setEnforcementActions(prev => [newAction, ...prev]);
  }, [currentRole]);

  const isActionDisabled = currentRole === 'viewer';

  const tourSteps = getTourSteps(currentRole);

  const pages = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'import', label: 'Data Import', icon: Upload },
    { id: 'calculator', label: 'Penalty Calculator', icon: Calculator },
    { id: 'projection', label: 'Interest Projection', icon: TrendingUp },
    { id: 'map', label: 'Uganda Map', icon: Map },
    { id: 'pipeline', label: 'Enforcement Pipeline', icon: GitBranch },
    { id: 'notices', label: 'Demand Notices', icon: FileText },
    { id: 'clearance', label: 'Tax Clearance', icon: CheckCircle },
    { id: 'registry', label: 'Title Block Registry', icon: Ban },
    { id: 'referrals', label: 'Criminal Referrals', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'escalation', label: 'Auto-Escalation', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Report Generator', icon: FileBarChart },
    { id: 'legal', label: 'Legal Cases', icon: Scale },
    { id: 'help', label: 'Help', icon: HelpCircle },
    ...(currentRole === 'superAdmin' ? [{ id: 'users', label: 'User Management', icon: Users }] : []),
    ...(currentRole === 'superAdmin' ? [{ id: 'settings', label: 'Settings', icon: Settings }] : []),
    ...(currentRole === 'admin' || currentRole === 'superAdmin' ? [
      { id: 'meeting', label: 'Meeting Room', icon: Video },
      { id: 'share', label: 'Share & Announce', icon: Share2 },
      { id: 'assistant', label: 'AI Assistant', icon: Bot, highlight: true },
    ] : []),
  ], [currentRole]);

  const rolePages = useMemo(() => {
    if (currentRole === 'legal') {
      return pages.filter(p => p.id === 'pipeline' || p.id === 'legal');
    }
    return pages;
  }, [currentRole, pages]);

  const filteredProperties = useMemo(() => {
    if (currentRole === 'district_officer' && currentUser) {
      return properties.filter(p => p.district === currentUser.district);
    }
    return properties;
  }, [properties, currentRole, currentUser]);

  const canToggleDemo = currentRole === 'superAdmin' || currentRole === 'admin' || currentRole === 'district_officer';

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('ultt_theme', mode);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      setSystemDark(mediaQuery.matches);
      if (theme === 'auto') {
        setThemeState('auto');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  if (!isLoggedIn) {
    return (
      <div className={effectiveTheme === 'dark' ? 'dark' : ''}>
        <LoginPage users={users} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className={effectiveTheme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
      {showTour && currentUser && (
        <TourModal
          steps={tourSteps}
          stepIndex={tourStep}
          onNext={() => setTourStep((s) => Math.min(s + 1, tourSteps.length - 1))}
          onPrev={() => setTourStep((s) => Math.max(s - 1, 0))}
          onSkip={() => { saveJson(TOUR_STORAGE_KEY(currentRole), true); setShowTour(false); }}
          onComplete={() => { saveJson(TOUR_STORAGE_KEY(currentRole), true); setShowTour(false); }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white flex items-center gap-2 animate-fadeIn`}>
          {toast.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          {toast.message}
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1a1a1a] dark:bg-gray-950 z-50 flex items-center justify-between px-4">
        <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white" aria-label="Toggle menu">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="text-white font-bold">ULTT</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onChange={setTheme} />
          {canToggleDemo && (
            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`text-xs px-2 py-1 rounded font-bold ${demoMode ? 'bg-yellow-400 text-yellow-900 animate-pulse' : 'bg-gray-600 text-white'}`}
            >
              {demoMode ? 'DEMO' : 'Demo'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-[#1a1a1a] dark:bg-gray-950 transition-transform duration-300 shrink-0 w-[220px] min-w-[220px]
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0`}
        style={{ width: 220, minWidth: 220, flexShrink: 0 }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 pl-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C8102E] rounded flex items-center justify-center">
                <MapPin className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-white font-bold text-sm">Uganda Land Tax</h1>
                <p className="text-gray-400 text-xs">Tracker</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 py-4 overflow-y-auto overflow-x-visible pl-4 pr-2">
            {rolePages.map((page) => (
              <button
                key={page.id}
                onClick={() => {
                  setCurrentPage(page.id);
                  if (isMobile) setSidebarOpen(false);
                }}
                style={{ paddingLeft: 16 }}
                className={`w-full flex items-center gap-3 pr-4 py-3 rounded-lg mb-1 transition-all text-left ${
                  currentPage === page.id
                    ? 'bg-[#C8102E] text-white'
                    : 'highlight' in page && page.highlight
                    ? 'text-yellow-400 hover:bg-gray-800'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <page.icon size={20} className="shrink-0" />
                <span className="text-sm font-medium truncate">{page.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{currentUser?.fullName}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  currentRole === 'superAdmin' ? 'bg-yellow-500 text-black font-bold' :
                  currentRole === 'admin' ? 'bg-[#C8102E] text-white' :
                  currentRole === 'legal' ? 'bg-purple-600 text-white' :
                  currentRole === 'district_officer' ? 'bg-blue-600 text-white' :
                  'bg-gray-500 text-white'
                }`}>{currentRole === 'superAdmin' ? '[SA] Super Admin' : ROLE_LABELS[currentRole]}</span>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm py-2">
              <LogOut size={16} /> Logout
            </button>
            {showInstall && (
              <button
                onClick={handleInstall}
                style={{
                  backgroundColor: '#C8102E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  width: '100%',
                  marginTop: '8px',
                }}
              >
                📱 Install App
              </button>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-3 text-center">ULTT v1.0 — Official Platform</p>
            <p className="text-gray-600 dark:text-gray-400 text-xs text-center">Licensed to: {settings.authorityName || 'Configure in Settings'}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pt-16 md:pt-0 min-h-screen overflow-hidden">
        {/* Header */}
        <header className="hidden md:flex h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 items-center justify-end px-6">
          <div className="flex items-center gap-4">
            <ThemeToggle theme={theme} onChange={setTheme} />
            {isActionDisabled && (
              <span className="bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200 text-xs font-bold px-3 py-1 rounded-full">VIEW ONLY</span>
            )}
            {currentRole === 'district_officer' && currentUser && (
              <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-200 text-xs font-bold px-3 py-1 rounded-full">{currentUser.district} District</span>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">{currentUser?.fullName}</span>
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              currentRole === 'superAdmin' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}>{currentRole === 'superAdmin' ? '[SA]' : ''} {ROLE_LABELS[currentRole]}</span>
            {canToggleDemo && (
              <button
                onClick={() => setDemoMode(!demoMode)}
                className={`text-xs px-3 py-1.5 rounded font-bold ${demoMode ? 'bg-yellow-400 text-yellow-900 animate-pulse' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'}`}
              >
                {demoMode ? 'DEMO MODE: ON' : 'Demo Mode: OFF'}
              </button>
            )}
          </div>
        </header>

        {demoMode && <DemoModeBanner />}

        {/* Page Content */}
        <main className="p-4 md:p-6 animate-fadeIn flex-1 overflow-auto min-w-0">
          {currentPage === 'dashboard' && (
            <DashboardPage properties={filteredProperties} enforcementActions={enforcementActions} />
          )}
          {currentPage === 'properties' && (
            <PropertyDatabasePage
              properties={filteredProperties}
              onSelectProperty={(prop) => {
                setSelectedProperty(prop);
                setShowDetailPanel(true);
              }}
              isActionDisabled={isActionDisabled}
              addActivity={addActivity}
              demoMode={demoMode}
            />
          )}
          {currentPage === 'import' && (
            <div className="space-y-6">
              <DataImportPage
                onImport={(imported) => setProperties((prev) => [...prev, ...imported])}
                showToast={showToast}
              />
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="ultt-section-title mb-4">Export Data</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => exportPropertiesCSV(filteredProperties, 'all')} className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16} /> All Properties CSV</button>
                  <button onClick={() => exportPropertiesCSV(filteredProperties, 'delinquent')} className="bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16} /> Delinquent CSV</button>
                  <button onClick={() => exportPropertiesCSV(filteredProperties, 'enforcement')} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16} /> Enforcement Summary</button>
                </div>
              </div>
            </div>
          )}
          {currentPage === 'calculator' && (
            <PenaltyCalculatorPage
              properties={filteredProperties}
              setProperties={setProperties}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
              demoMode={demoMode}
            />
          )}
          {currentPage === 'projection' && (
            <InterestProjectionPage properties={filteredProperties} />
          )}
          {currentPage === 'map' && (
            <UgandaMapPage
              properties={filteredProperties}
              onSelectProperty={(prop) => {
                setSelectedProperty(prop);
                setShowDetailPanel(true);
              }}
            />
          )}
          {currentPage === 'pipeline' && (
            <EnforcementPipelinePage
              properties={filteredProperties}
              setProperties={setProperties}
              onSelectProperty={(prop) => {
                setSelectedProperty(prop);
                setShowDetailPanel(true);
              }}
              addActivity={addActivity}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'notices' && (
            <DemandNoticesPage
              properties={filteredProperties}
              addActivity={addActivity}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'clearance' && (
            <TaxClearancePage
              properties={filteredProperties}
              certificatesIssued={certificatesIssued}
              setCertificatesIssued={setCertificatesIssued}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'registry' && (
            <TitleBlockRegistryPage
              properties={filteredProperties}
              addActivity={addActivity}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'referrals' && (
            <CriminalReferralsPage
              properties={filteredProperties}
              referrals={criminalReferrals}
              setReferrals={setCriminalReferrals}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'notifications' && (
            <NotificationsPage
              properties={filteredProperties}
              history={notificationHistory}
              setHistory={setNotificationHistory}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
              escalationLog={escalationLog}
            />
          )}
          {currentPage === 'escalation' && (
            <AutoEscalationPage
              rules={escalationRules}
              setRules={setEscalationRules}
              properties={filteredProperties}
              setProperties={setProperties}
              onLog={(entry) => setEscalationLog((prev) => [...prev, { ...entry, id: Date.now() }])}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
            />
          )}
          {currentPage === 'analytics' && (
            <AnalyticsPage properties={filteredProperties} demoMode={demoMode} />
          )}
          {currentPage === 'reports' && (
            <ReportGeneratorPage properties={filteredProperties} />
          )}
          {currentPage === 'legal' && (
            <LegalCasesPage
              properties={filteredProperties}
              addActivity={addActivity}
              showToast={showToast}
              isActionDisabled={isActionDisabled}
              settings={settings}
              enforcementActions={enforcementActions}
            />
          )}
          {(currentPage === 'assistant' && (currentRole === 'admin' || currentRole === 'superAdmin')) && (
            <AIAssistantPage demoMode={demoMode} settings={settings} showToast={showToast} />
          )}
          {currentPage === 'users' && currentUser && (
            <UserManagementPage users={users} setUsers={setUsers} roleChangeLog={roleChangeLog} setRoleChangeLog={setRoleChangeLog} currentUser={currentUser} showToast={showToast} />
          )}
          {currentPage === 'settings' && currentUser && (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
              onNavigateImport={() => setCurrentPage('import')}
              onExportAll={() => exportPropertiesCSV(properties, 'all')}
              onClearData={() => { setRealProperties([]); showToast('All data cleared'); }}
              demoMode={demoMode}
              setDemoMode={setDemoMode}
              onResetDemo={() => { setDemoProperties(createDemoProperties()); showToast('Demo data reset'); }}
              demoUsageLog={demoUsageLog}
              setDemoUsageLog={setDemoUsageLog}
              currentUser={currentUser}
              showToast={showToast}
            />
          )}
          {currentPage === 'meeting' && currentUser && (
            <MeetingRoomPage currentUser={currentUser} users={users} showToast={showToast} isSuperAdmin={currentRole === 'superAdmin'} />
          )}
          {currentPage === 'share' && currentUser && (
            <ShareAnnouncePage currentUser={currentUser} showToast={showToast} />
          )}
          {currentPage === 'help' && (
            <HelpPage onRestartTour={() => { saveJson(TOUR_STORAGE_KEY(currentRole), false); setTourStep(0); setShowTour(true); }} />
          )}
        </main>
      </div>

      {/* Property Detail Panel */}
      {showDetailPanel && selectedProperty && (
        <PropertyDetailPanel
          property={selectedProperty}
          setProperties={setProperties}
          onClose={() => {
            setShowDetailPanel(false);
            setSelectedProperty(null);
          }}
          addActivity={addActivity}
          showToast={showToast}
          isActionDisabled={isActionDisabled}
          settings={settings}
        />
      )}

      </div>
    </div>
  );
}

type DashboardPageProps = {
  properties: Property[];
  enforcementActions: EnforcementAction[];
};

// Dashboard Page Component
function DashboardPage({ properties, enforcementActions }: DashboardPageProps) {
  const stats = useMemo(() => {
    const delinquent = properties.filter(p => p.status === 'delinquent');
    const paid = properties.filter(p => p.status === 'paid');
    const partial = properties.filter(p => p.status === 'partial');

    let totalPrincipalOwed = 0;
    let totalInterest = 0;
    let totalOwed = 0;

    delinquent.forEach(p => {
      totalPrincipalOwed += p.principalOwed;
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      totalInterest += penalty.interest;
      totalOwed += penalty.totalOwed;
    });

    partial.forEach(p => {
      totalPrincipalOwed += p.principalOwed;
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      totalInterest += penalty.interest;
      totalOwed += penalty.totalOwed;
    });

    const blockedFromSale = properties.filter(p => p.status === 'delinquent' || p.status === 'partial').length;
    const legalAction = properties.filter(p => p.enforcementStage === 'legal_action').length;

    return {
      total: properties.length,
      delinquent: delinquent.length,
      paid: paid.length,
      partial: partial.length,
      totalPrincipalOwed,
      totalInterest: Math.round(totalInterest),
      totalOwed: Math.round(totalOwed),
      blockedFromSale,
      legalAction,
    };
  }, [properties]);

  const districtData = useMemo(() => {
    const withData = [...new Set(properties.map((p) => p.district))].sort();
    return withData.map((d) => ({
      name: d,
      delinquent: properties.filter((p) => p.district === d && p.status === 'delinquent').length,
      total: properties.filter((p) => p.district === d).length,
    }));
  }, [properties]);

  const monthlyInterestData = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const monthLabel = formatDate(month, 'MMM yyyy');
      let interest = 0;
      properties.filter(p => p.status === 'delinquent').forEach(p => {
        const taxDate = new Date(p.taxDueDate);
        const monthsOverdue = Math.max(0, Math.floor((month.getTime() - taxDate.getTime()) / 86400000) / 30);
        if (monthsOverdue > 0) {
          const monthInterest = p.annualTaxDue * 0.02;
          interest += monthInterest;
        }
      });
      months.push({ month: monthLabel, interest: Math.round(interest / 1000) * 1000 });
    }
    return months;
  }, [properties]);

  const maxDelinquent = Math.max(...districtData.map(d => d.delinquent), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Properties" value={stats.total.toString()} icon={<Building2 className="text-[#C8102E]" />} />
        <SummaryCard title="Delinquent Properties" value={stats.delinquent.toString()} icon={<AlertCircle className="text-red-500" />} />
        <SummaryCard title="Total Principal Owed" value={formatCurrency(stats.totalPrincipalOwed)} icon={<span className="text-[#C8102E] text-lg">$</span>} />
        <SummaryCard title="Total Interest Accrued" value={formatCurrency(stats.totalInterest)} icon={<span className="text-[#FCDD09] text-lg">%</span>} />
        <SummaryCard title="Total Owed Including Interest" value={formatCurrency(stats.totalOwed)} icon={<span className="text-red-600 text-lg">$</span>} />
        <SummaryCard title="Properties Blocked From Sale" value={stats.blockedFromSale.toString()} icon={<Ban className="text-red-500" />} />
        <SummaryCard title="Active Legal Cases" value={stats.legalAction.toString()} icon={<Scale className="text-[#C8102E]" />} />
        <SummaryCard title="Paid This Period" value={stats.paid.toString()} icon={<CheckCircle className="text-green-600" />} />
        <SummaryCard title="Districts Covered" value={UGANDA_DISTRICT_COUNT.toString()} icon={<MapPin className="text-[#C8102E]" />} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Delinquency by District</h3>
          <div className="h-64 flex items-end gap-4 px-4">
            {districtData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-[#C8102E] rounded-t transition-all hover:bg-red-700 group relative"
                  style={{ height: `${(d.delinquent / maxDelinquent) * 180}px` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {d.delinquent} properties
                  </div>
                </div>
                <span className="text-xs mt-2 text-center text-gray-700 dark:text-gray-300">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Interest Accrued per Month</h3>
          <svg viewBox="0 0 400 200" className="w-full h-64">
            <polyline
              fill="none"
              stroke="#C8102E"
              strokeWidth="2"
              points={monthlyInterestData.map((d, i) => {
                const x = 30 + (i * 32);
                const y = 180 - (d.interest / 1000000) * 100;
                return `${x},${Math.max(y, 20)}`;
              }).join(' ')}
            />
            {monthlyInterestData.map((d, i) => {
              const x = 30 + (i * 32);
              const y = 180 - (d.interest / 1000000) * 100;
              return (
                <g key={i}>
                  <circle cx={x} cy={Math.max(y, 20)} r="4" fill="#C8102E" />
                  <text x={x} y="195" textAnchor="middle" fontSize="8" className="fill-gray-600 dark:fill-gray-400">
                    {d.month.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="ultt-section-title mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {enforcementActions.slice(0, 10).map((action) => (
            <div key={action.id} className="flex items-center gap-4 py-2 border-b last:border-0">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock size={18} className="text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{action.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{action.propertyName} - {action.officer}</p>
              </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(new Date(action.timestamp), 'MMM d, HH:mm')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{title}</p>
          <p className="text-xl font-bold mt-1 text-gray-900 dark:text-white">{value}</p>
        </div>
        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

// Property Database Page
function PropertyDatabasePage({
  properties,
  onSelectProperty,
  isActionDisabled,
  addActivity,
  demoMode = false,
}: {
  properties: Property[];
  onSelectProperty: (p: Property) => void;
  isActionDisabled: boolean;
  addActivity: (id: number, name: string, action: string) => void;
  demoMode?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesSearch = p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
        p.plotNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.district.toLowerCase().includes(search.toLowerCase());
      const matchesDistrict = !districtFilter || p.district === districtFilter;
      const matchesStage = !stageFilter || p.enforcementStage === stageFilter;
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesDistrict && matchesStage && matchesStatus;
    });
  }, [properties, search, districtFilter, stageFilter, statusFilter]);

  const getRowColor = (p: Property) => {
    if (p.status === 'paid') return 'ultt-row-paid bg-green-50 dark:bg-green-900/30';
    const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
    if (p.enforcementStage === 'legal_action') return 'bg-red-100 dark:bg-red-950/40';
    if (penalty.daysOverdue > 90) return 'bg-red-50 dark:bg-red-950/30';
    if (penalty.daysOverdue > 30) return 'bg-orange-50 dark:bg-orange-950/30';
    return 'bg-yellow-50 dark:bg-yellow-950/20';
  };

  const handleExportCSV = () => {
    const headers = ['Plot No', 'Owner', 'District', 'Type', 'Annual Tax', 'Principal', 'Interest', 'Total Owed', 'Days Overdue', 'Stage'];
    const rows = filteredProperties.map(p => {
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      return [
        p.plotNumber,
        p.ownerName,
        p.district,
        p.propertyType,
        p.annualTaxDue,
        p.principalOwed,
        penalty.interest,
        penalty.totalOwed,
        penalty.daysOverdue,
        p.enforcementStage,
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'properties_export.csv';
    a.click();
    addActivity(0, 'System', `Exported ${filteredProperties.length} properties to CSV`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Property Database</h1>
        <button
          onClick={handleExportCSV}
          disabled={isActionDisabled}
          className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, plot, or district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 ultt-input"
            />
          </div>
          <FlatDistrictSelect
            value={districtFilter}
            onChange={setDistrictFilter}
            includeAll
            className="ultt-select px-3 py-2"
          />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="ultt-select px-3 py-2">
            <option value="">All Stages</option>
            <option value="interest_accruing">Interest Accruing</option>
            <option value="demand_notice">Demand Notice</option>
            <option value="rent_interception">Rent Interception</option>
            <option value="legal_action">Legal Action</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ultt-select px-3 py-2">
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="delinquent">Delinquent</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#C8102E] text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Plot No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">District</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Annual Tax</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Principal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Interest</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Total Owed</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Days Over</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Stage</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Clearance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredProperties.map((p) => {
              const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelectProperty(p)}
                  className={`${getRowColor(p)} cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
                >
                  <td className="ultt-table-cell px-4 py-3 text-sm font-medium">
                    {p.plotNumber}
                    {p.imported && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Imported</span>}
                  </td>
                  <td className="ultt-table-cell px-4 py-3 text-sm">{p.ownerName}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm">{p.district}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm">{p.propertyType}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm text-right">{formatCurrency(p.annualTaxDue)}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm text-right">{formatCurrency(p.principalOwed)}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{formatCurrency(penalty.interest)}</td>
                  <td className="ultt-table-cell px-4 py-3 text-sm text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(penalty.totalOwed)}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      penalty.daysOverdue > 90 ? 'bg-red-100 text-red-700' :
                      penalty.daysOverdue > 30 ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {penalty.daysOverdue}
                    </span>
                  </td>
                  <td className="ultt-table-cell px-4 py-3 text-center">
                    <StageBadge stage={p.enforcementStage} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.status === 'paid' ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">CLEAR</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">BLOCKED</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {demoMode && <p className="text-sm text-gray-500 dark:text-gray-400 italic">Note: Data shown is fictional training data only. Not real records.</p>}
    </div>
  );
}

// Penalty Calculator Page
function PenaltyCalculatorPage({
  properties,
  setProperties,
  showToast,
  isActionDisabled,
  demoMode = false,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
  demoMode?: boolean;
}) {
  const [annualTax, setAnnualTax] = useState<number>(1000000);
  const [taxDueDate, setTaxDueDate] = useState<string>('2024-01-01');
  const [projection, setProjection] = useState<{ months: number; total: number }[]>([]);

  const penalty = useMemo(() => {
    return calculatePenalty(annualTax, taxDueDate);
  }, [annualTax, taxDueDate]);

  useEffect(() => {
    const projections = [3, 6, 12, 24].map(months => {
      const futureInterest = annualTax * 0.02 * (penalty.monthsOverdue + months);
      return {
        months,
        total: Math.round(annualTax + futureInterest),
      };
    });
    setProjection(projections);
  }, [annualTax, penalty.monthsOverdue]);

  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= 36; i++) {
      const interest = annualTax * 0.02 * i;
      data.push({
        month: i,
        total: Math.round(annualTax + interest),
      });
    }
    return data;
  }, [annualTax]);

  const handleBulkRecalculate = () => {
    let totalInterest = 0;
    const updated = properties.map(p => {
      const pPenalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      totalInterest += pPenalty.interest;
      return p;
    });
    setProperties(updated);
    showToast(`Updated ${updated.length} properties. Total interest: ${formatCurrency(totalInterest)}`);
  };

  const maxTotal = Math.max(...monthlyData.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Penalty Calculator</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="ultt-section-title mb-4">Calculate Penalty</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Annual Tax Due (UGX)</label>
              <input
                type="number"
                value={annualTax}
                onChange={(e) => setAnnualTax(Number(e.target.value))}
                className="w-full ultt-input px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date Tax Was Due</label>
              <input
                type="date"
                value={taxDueDate}
                onChange={(e) => setTaxDueDate(e.target.value)}
                className="w-full ultt-input px-4 py-2"
              />
            </div>
          </div>

          {/* Results */}
          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Days Overdue</span>
              <span className="text-3xl font-bold text-[#1a1a1a] dark:text-white">{penalty.daysOverdue}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Interest Accrued (2% per month)</span>
              <span className="text-xl font-bold text-orange-600">{formatCurrency(penalty.interest)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-t">
              <span className="font-semibold text-gray-900 dark:text-white">Total Amount Owed</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(penalty.totalOwed)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Daily Interest Rate</span>
              <span className="text-gray-500 dark:text-gray-400">{formatCurrency(penalty.dailyInterest)} per day</span>
            </div>
          </div>

          {/* Projection Table */}
          <div className="mt-6">
            <h4 className="font-medium mb-2">Projection if Unpaid</h4>
            <table className="w-full text-sm">
              <thead className="bg-[#C8102E] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Months Ahead</th>
                  <th className="px-3 py-2 text-right">Total Owed</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((p) => (
                  <tr key={p.months} className="border-b">
                    <td className="px-3 py-2">+{p.months} months</td>
                    <td className="px-3 py-2 text-right text-red-600 font-bold">{formatCurrency(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleBulkRecalculate}
            disabled={isActionDisabled}
            className="mt-6 w-full bg-[#C8102E] text-white py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
          >
            <RefreshCw className="inline mr-2" size={18} />
            Bulk Recalculate All Properties
          </button>
        </div>

        {/* Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="ultt-section-title mb-4">Debt Growth Over 36 Months</h3>
          <svg viewBox="0 0 400 250" className="w-full h-80">
            {/* Axes */}
            <line x1="40" y1="220" x2="380" y2="220" stroke="#ccc" strokeWidth="1" />
            <line x1="40" y1="220" x2="40" y2="20" stroke="#ccc" strokeWidth="1" />

            {/* Y-axis labels */}
            <text x="35" y="220" textAnchor="end" fontSize="10" className="fill-gray-600 dark:fill-gray-400">0</text>
            <text x="35" y="170" textAnchor="end" fontSize="10" className="fill-gray-600 dark:fill-gray-400">{formatCurrency(Math.round(maxTotal * 0.25))}</text>
            <text x="35" y="120" textAnchor="end" fontSize="10" className="fill-gray-600 dark:fill-gray-400">{formatCurrency(Math.round(maxTotal * 0.5))}</text>
            <text x="35" y="70" textAnchor="end" fontSize="10" className="fill-gray-600 dark:fill-gray-400">{formatCurrency(Math.round(maxTotal * 0.75))}</text>
            <text x="35" y="25" textAnchor="end" fontSize="10" className="fill-gray-600 dark:fill-gray-400">{formatCurrency(maxTotal)}</text>

            {/* Line */}
            <polyline
              fill="none"
              stroke="#C8102E"
              strokeWidth="2"
              points={monthlyData.map((d, i) => {
                const x = 40 + (i * 9.5);
                const y = 220 - ((d.total / maxTotal) * 180);
                return `${x},${y}`;
              }).join(' ')}
            />

            {/* Area fill */}
            <polygon
              fill="#C8102E"
              fillOpacity="0.1"
              points={`40,220 ${monthlyData.map((d, i) => {
                const x = 40 + (i * 9.5);
                const y = 220 - ((d.total / maxTotal) * 180);
                return `${x},${y}`;
              }).join(' ')} 380,220`}
            />

            {/* X-axis label */}
            <text x="210" y="245" textAnchor="middle" fontSize="12" className="fill-gray-600 dark:fill-gray-400">Months</text>
          </svg>
        </div>
      </div>
      {demoMode && <p className="text-sm text-gray-500 dark:text-gray-400 italic">Note: Data shown is fictional training data only. Not real records.</p>}
    </div>
  );
}

// Uganda Map Page
function UgandaMapPage({
  properties,
  onSelectProperty,
}: {
  properties: Property[];
  onSelectProperty: (p: Property) => void;
}) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const regions = useMemo(() => ({
    central: {
      name: 'Central Region',
      region: 'Central' as const,
      description: REGION_DESCRIPTIONS.Central,
      path: 'M150,280 L180,250 L220,260 L240,290 L230,330 L190,340 L160,310 Z',
      centroid: { x: 195, y: 295 },
    },
    northern: {
      name: 'Northern Region',
      region: 'Northern' as const,
      description: REGION_DESCRIPTIONS.Northern,
      path: 'M150,100 L190,80 L230,90 L250,130 L240,170 L200,190 L160,180 L140,140 Z',
      centroid: { x: 195, y: 135 },
    },
    eastern: {
      name: 'Eastern Region',
      region: 'Eastern' as const,
      description: REGION_DESCRIPTIONS.Eastern,
      path: 'M250,200 L290,180 L330,200 L340,250 L320,290 L280,300 L250,270 Z',
      centroid: { x: 295, y: 245 },
    },
    western: {
      name: 'Western Region',
      region: 'Western' as const,
      description: REGION_DESCRIPTIONS.Western,
      path: 'M60,250 L100,220 L140,240 L150,290 L130,340 L90,350 L60,310 Z',
      centroid: { x: 105, y: 285 },
    },
  }), []);

  const regionStats = useMemo(() => {
    const stats: { [key: string]: { properties: Property[]; delinquent: number; totalOwed: number; color: string } } = {};
    Object.entries(regions).forEach(([key, region]) => {
      const regionProperties = properties.filter((p) => DISTRICT_REGION_MAP[p.district] === region.region);
      const delinquent = regionProperties.filter(p => p.status === 'delinquent');
      let totalOwed = 0;
      delinquent.forEach(p => {
        const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
        totalOwed += penalty.totalOwed;
      });

      const delinquentCount = delinquent.length;
      let color = '#22c55e';
      if (delinquentCount >= 9) color = '#ef4444';
      else if (delinquentCount >= 6) color = '#f97316';
      else if (delinquentCount >= 3) color = '#eab308';

      stats[key] = {
        properties: regionProperties,
        delinquent: delinquentCount,
        totalOwed,
        color,
      };
    });
    return stats;
  }, [properties, regions]);

  const selectedRegionData = selectedRegion ? {
    ...regions[selectedRegion as keyof typeof regions],
    stats: regionStats[selectedRegion],
  } : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Uganda Map</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <svg viewBox="0 0 400 400" className="w-full max-w-lg mx-auto">
            <rect x="0" y="0" width="400" height="400" className="fill-gray-100 dark:fill-gray-700" />

            {Object.entries(regions).map(([key, region]) => (
              <g key={key}>
                <path
                  d={region.path}
                  fill={regionStats[key]?.color || '#22c55e'}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all hover:opacity-80"
                  onClick={() => setSelectedRegion(key)}
                  onMouseEnter={() => setHoveredRegion(key)}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
                <text
                  x={region.centroid.x}
                  y={region.centroid.y}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#fff"
                  fontWeight="bold"
                  className="pointer-events-none"
                >
                  {region.name.split(' ')[0]}
                </text>
              </g>
            ))}

            {hoveredRegion && (
              <g>
                <rect
                  x={regions[hoveredRegion as keyof typeof regions].centroid.x - 50}
                  y={regions[hoveredRegion as keyof typeof regions].centroid.y - 40}
                  width="100"
                  height="25"
                  className="fill-gray-900 dark:fill-gray-800"
                  rx="4"
                />
                <text
                  x={regions[hoveredRegion as keyof typeof regions].centroid.x}
                  y={regions[hoveredRegion as keyof typeof regions].centroid.y - 25}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#fff"
                >
                  {regionStats[hoveredRegion]?.delinquent || 0} delinquent
                </text>
              </g>
            )}
          </svg>

          <div className="flex justify-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }}></div>
              <span className="text-xs">0-2 delinquent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }}></div>
              <span className="text-xs">3-5 delinquent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }}></div>
              <span className="text-xs">6-8 delinquent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span className="text-xs">9+ delinquent</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          {selectedRegionData ? (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">{selectedRegionData.name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Coverage</span>
                  <span className="text-right text-sm">{selectedRegionData.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Properties</span>
                  <span className="font-bold text-gray-900 dark:text-white">{selectedRegionData.stats.properties.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Delinquent Count</span>
                  <span className="font-bold text-red-600">{selectedRegionData.stats.delinquent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Owed</span>
                  <span className="font-bold text-red-600">{formatCurrency(selectedRegionData.stats.totalOwed)}</span>
                </div>
              </div>

              <h4 className="font-semibold mt-4">Top Properties by Debt</h4>
              <div className="space-y-2">
                {selectedRegionData.stats.properties
                  .filter(p => p.status !== 'paid')
                  .map(p => ({ ...p, penalty: calculatePenalty(p.annualTaxDue, p.taxDueDate) }))
                  .sort((a, b) => b.penalty.totalOwed - a.penalty.totalOwed)
                  .slice(0, 3)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProperty(p)}
                      className="w-full flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-750 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="text-sm">{p.ownerName}</span>
                      <span className="text-sm font-bold text-red-600">{formatCurrency(p.penalty.totalOwed)}</span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Map size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Click a region on the map to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enforcement Pipeline Page
const PIPELINE_STAGES = [
  { id: 'interest_accruing', label: 'Stage 1: Interest Accruing', headerBg: '#FCDD09', headerText: '#1a1a1a', border: '#FCDD09' },
  { id: 'demand_notice', label: 'Stage 2: Demand Notice', headerBg: '#e07b00', headerText: '#ffffff', border: '#e07b00' },
  { id: 'rent_interception', label: 'Stage 3: Rent Interception', headerBg: '#C8102E', headerText: '#ffffff', border: '#C8102E' },
  { id: 'legal_action', label: 'Stage 4: Legal Action', headerBg: '#7a0000', headerText: '#ffffff', border: '#7a0000' },
  { id: 'resolved', label: 'Stage 5: Resolved', headerBg: '#1a7a4a', headerText: '#ffffff', border: '#1a7a4a' },
] as const;

function getPipelineActionStyle(action: string): string {
  if (action === 'Send reminder' || action === 'Monitor') return 'bg-blue-600 hover:bg-blue-700 text-white';
  if (action === 'Issue notice') return 'bg-orange-600 hover:bg-orange-700 text-white';
  if (action === 'Serve tenant notice') return 'bg-red-600 hover:bg-red-700 text-white';
  if (action === 'Update court case') return 'bg-red-900 hover:bg-red-950 text-white';
  return 'bg-gray-600 hover:bg-gray-700 text-white';
}

function getDaysOverdueDisplay(days: number) {
  if (days > 180) {
    return (
      <span className="text-red-700 dark:text-red-400 font-bold flex items-center gap-1">
        <AlertTriangle size={12} /> {days} days overdue
      </span>
    );
  }
  if (days >= 90) {
    return <span className="text-red-600 dark:text-red-400">{days} days overdue</span>;
  }
  return <span className="text-orange-600 dark:text-orange-400">{days} days overdue</span>;
}

function EnforcementPipelinePage({
  properties,
  setProperties,
  onSelectProperty,
  addActivity,
  showToast,
  isActionDisabled,
}: {
  properties: Property[];
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  onSelectProperty: (p: Property) => void;
  addActivity: (id: number, name: string, action: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const stageProperties = useMemo(() => {
    const result: { [key: string]: Property[] } = {};
    PIPELINE_STAGES.forEach(s => {
      result[s.id] = properties.filter(p => p.enforcementStage === s.id);
    });
    return result;
  }, [properties]);

  const pipelineSummary = useMemo(() => {
    const active = properties.filter(p => p.enforcementStage !== 'resolved');
    const totalValue = active.reduce((sum, p) => {
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      return sum + penalty.totalOwed;
    }, 0);
    const avgDays = active.length
      ? Math.round(active.reduce((sum, p) => sum + calculatePenalty(p.annualTaxDue, p.taxDueDate).daysOverdue, 0) / active.length)
      : 0;
    const now = new Date();
    const resolvedThisMonth = properties.filter(p => {
      if (p.enforcementStage !== 'resolved' || !p.lastPaymentDate) return false;
      const d = new Date(p.lastPaymentDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      totalCases: active.length,
      totalValue,
      avgDaysOverdue: avgDays,
      resolvedThisMonth,
    };
  }, [properties]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons, properties]);

  const scrollPipeline = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const advanceStage = (property: Property) => {
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.id === property.enforcementStage);
    if (currentIndex < PIPELINE_STAGES.length - 1) {
      const newStage = PIPELINE_STAGES[currentIndex + 1].id;
      setProperties(prev => prev.map(p =>
        p.id === property.id ? { ...p, enforcementStage: newStage } : p
      ));
      addActivity(property.id, property.plotNumber, `Advanced to ${PIPELINE_STAGES[currentIndex + 1].label}`);
      showToast(`Property ${property.plotNumber} advanced to next stage`);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Enforcement Pipeline</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Cases</p>
          <p className="text-xl font-bold text-[#1a1a1a] dark:text-white">{pipelineSummary.totalCases}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Value</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(pipelineSummary.totalValue)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Days Overdue</p>
          <p className="text-xl font-bold text-orange-600">{pipelineSummary.avgDaysOverdue} days</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow px-4 py-3 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Resolved This Month</p>
          <p className="text-xl font-bold text-green-600">{pipelineSummary.resolvedThisMonth}</p>
        </div>
      </div>

      {/* Kanban board with scroll arrows */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollPipeline('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            aria-label="Scroll pipeline left"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollPipeline('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
            aria-label="Scroll pipeline right"
          >
            <ChevronRight size={22} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="overflow-x-auto pb-4 scroll-smooth px-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const isResolved = stage.id === 'resolved';
              return (
                <div key={stage.id} className="w-72 flex-shrink-0">
                  <div
                    className="rounded-t-lg px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: stage.headerBg, color: stage.headerText }}
                  >
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <span
                      className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isResolved ? '#ffffff' : stage.headerText === '#ffffff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
                        color: isResolved ? stage.headerBg : stage.headerText,
                      }}
                    >
                      {stageProperties[stage.id].length}
                    </span>
                  </div>
                  <div className={`rounded-b-lg shadow p-3 space-y-3 max-h-[28rem] overflow-y-auto ${isResolved ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900' : 'bg-white dark:bg-gray-800'}`}>
                    {stageProperties[stage.id].length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No cases</p>
                    )}
                    {stageProperties[stage.id].map((p) => {
                      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
                      const nextAction = getNextAction(p.enforcementStage, penalty.daysOverdue);

                      if (isResolved) {
                        const resolvedDate = p.lastPaymentDate
                          ? formatDate(new Date(p.lastPaymentDate), 'MMM d, yyyy')
                          : '—';
                        const amountOwed = p.annualTaxDue + (p.principalOwed || 0);
                        return (
                          <div
                            key={p.id}
                            className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 opacity-90"
                            style={{ borderLeft: `4px solid ${stage.border}` }}
                          >
                            <div className="mb-2">
                              <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{p.ownerName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{p.plotNumber}</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                              Settled: {formatCurrency(amountOwed > 0 ? amountOwed : p.annualTaxDue)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Resolved: {resolvedDate}</p>
                            <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mb-2">
                              RESOLVED
                            </span>
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => onSelectProperty(p)}
                                className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={p.id}
                          className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3"
                          style={{ borderLeft: `4px solid ${stage.border}` }}
                        >
                          <div className="mb-2">
                            <p className="font-medium text-sm">{p.ownerName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{p.plotNumber}</p>
                          </div>
                          <p className="text-sm font-bold text-red-600 mb-1">{formatCurrency(penalty.totalOwed)}</p>
                          <div className="flex justify-between items-center text-xs mb-3">
                            {getDaysOverdueDisplay(penalty.daysOverdue)}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            {nextAction !== 'Monitor' && (
                              <button
                                disabled={isActionDisabled}
                                className={`text-xs px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed ${getPipelineActionStyle(nextAction)}`}
                                title={isActionDisabled ? 'Contact Admin to perform actions' : nextAction}
                              >
                                {nextAction}
                              </button>
                            )}
                            <button
                              onClick={() => onSelectProperty(p)}
                              className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                            >
                              View
                            </button>
                            <button
                              onClick={() => advanceStage(p)}
                              disabled={isActionDisabled}
                              className="text-xs bg-[#C8102E] text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Move to next stage"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Demand Notices Page
function DemandNoticesPage({
  properties,
  addActivity,
  showToast,
  isActionDisabled,
}: {
  properties: Property[];
  addActivity: (id: number, name: string, action: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
}) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [noticeStatus, setNoticeStatus] = useState<{ [key: number]: string }>({});

  const overdueProperties = useMemo(() => {
    return properties
      .filter(p => {
        const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
        return (p.enforcementStage === 'interest_accruing' || p.enforcementStage === 'demand_notice') && penalty.daysOverdue >= 30;
      })
      .map(p => ({
        ...p,
        penalty: calculatePenalty(p.annualTaxDue, p.taxDueDate),
        noticeStatus: noticeStatus[p.id] || 'Pending',
      }));
  }, [properties, noticeStatus]);

  const handleMarkIssued = (propertyId: number, plotNumber: string) => {
    setNoticeStatus(prev => ({ ...prev, [propertyId]: 'Issued' }));
    addActivity(propertyId, plotNumber, 'Demand notice marked as issued');
    showToast(`Demand notice for ${plotNumber} marked as issued`);
  };

  const handleDownload = (property: Property) => {
    const penalty = calculatePenalty(property.annualTaxDue, property.taxDueDate);
    const noticeNumber = `DN-${Date.now()}`;
    const text = `DEMAND NOTICE
Reference: ${noticeNumber}
Date: ${formatDate(new Date(), 'MMMM d, yyyy')}

To: ${property.ownerName}, ${property.district}
Re: Property ${property.plotNumber}, Title ${property.landTitleNumber}

You are hereby notified that the sum of ${formatCurrency(property.principalOwed)}
plus interest of ${formatCurrency(penalty.interest)} at 2% per month under
the Local Governments Rating Act 2005, totalling
${formatCurrency(penalty.totalOwed)}, remains outstanding on the above property.

You are required to pay within 60 days of this notice.
Failure results in: rent interception, legal action, title block.

Payment to: ${property.district} District Office

Signed: _____________ Date: _____________

${UGANDA_COAT_OF_ARMS_TEXT}`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demand_notice_${property.plotNumber}.txt`;
    a.click();
    addActivity(property.id, property.plotNumber, 'Demand notice downloaded');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Demand Notices</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#C8102E] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Plot</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Total Owed</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Days</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {overdueProperties.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedProperty(p)}
                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 ${selectedProperty?.id === p.id ? 'bg-red-50' : ''}`}
                >
                  <td className="px-4 py-3 text-sm">{p.ownerName}</td>
                  <td className="px-4 py-3 text-sm">{p.plotNumber}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(p.penalty.totalOwed)}</td>
                  <td className="px-4 py-3 text-center text-sm">{p.penalty.daysOverdue}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${p.noticeStatus === 'Issued' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.noticeStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {selectedProperty ? (() => {
            const previewPenalty = calculatePenalty(selectedProperty.annualTaxDue, selectedProperty.taxDueDate);
            return (
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b pb-2">DEMAND NOTICE</h3>
              <div className="text-sm space-y-2">
                <p><strong>Reference:</strong> DN-{Date.now()}</p>
                <p><strong>Date:</strong> {formatDate(new Date(), 'MMMM d, yyyy')}</p>
                <p><strong>To:</strong> {selectedProperty.ownerName}, {selectedProperty.district}</p>
                <p><strong>Re:</strong> Property {selectedProperty.plotNumber}, Title {selectedProperty.landTitleNumber}</p>
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-750 rounded">
                  <p>You are hereby notified that the sum of <strong>{formatCurrency(selectedProperty.principalOwed)}</strong></p>
                  <p>plus interest of <strong>{formatCurrency(previewPenalty.interest)}</strong> at 2% per month under</p>
                  <p>the Local Governments Rating Act 2005, totalling</p>
                  <p className="text-red-600 font-bold text-lg">{formatCurrency(previewPenalty.totalOwed)}, remains outstanding.</p>
                </div>
                <p>You are required to pay within 60 days of this notice.</p>
                <p>Failure results in: rent interception, legal action, title block.</p>
                <p className="mt-4">Payment to: {selectedProperty.district} District Office</p>
                <p className="mt-4">Signed: _____________ Date: _____________</p>
                <UgandaCoatOfArms size={72} className="mx-auto mt-3" />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleDownload(selectedProperty)}
                  className="flex-1 bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-700"
                >
                  <Download size={18} className="inline mr-2" />
                  Download
                </button>
                <button
                  onClick={() => handleMarkIssued(selectedProperty.id, selectedProperty.plotNumber)}
                  disabled={isActionDisabled || noticeStatus[selectedProperty.id] === 'Issued'}
                  className="flex-1 bg-[#C8102E] text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <Check size={18} className="inline mr-2" />
                  Mark as Issued
                </button>
              </div>
            </div>
            );
          })() : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Select a property to preview the demand notice</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tax Clearance Page
function TaxClearancePage({
  properties,
  certificatesIssued,
  setCertificatesIssued,
  showToast,
  isActionDisabled,
}: {
  properties: Property[];
  certificatesIssued: CertificateIssued[];
  setCertificatesIssued: React.Dispatch<React.SetStateAction<CertificateIssued[]>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const searchResults = useMemo(() => {
    if (!search) return [];
    return properties.filter(p =>
      p.plotNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(search.toLowerCase())
    );
  }, [properties, search]);

  const handleIssue = () => {
    if (!selectedProperty) return;
    const newCert: CertificateIssued = {
      id: Date.now(),
      propertyName: selectedProperty.plotNumber,
      ownerName: selectedProperty.ownerName,
      dateIssued: formatDate(new Date(), 'MMM d, yyyy'),
    };
    setCertificatesIssued(prev => [newCert, ...prev]);
    showToast(`Tax clearance certificate issued for ${selectedProperty.plotNumber}`);
  };

  const handleDownload = () => {
    if (!selectedProperty) return;
    const text = `TAX CLEARANCE CERTIFICATE

This certifies that ${selectedProperty.ownerName}
Plot Number: ${selectedProperty.plotNumber}, Title: ${selectedProperty.landTitleNumber}
Has no outstanding rates as at ${formatDate(new Date(), 'MMMM d, yyyy')}.

Valid for 30 days.

Issued by: _____________ Date: _____________

${UGANDA_COAT_OF_ARMS_TEXT}`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_clearance_${selectedProperty.plotNumber}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Tax Clearance</h1>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by plot number or owner name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedProperty(null);
            }}
            className="w-full pl-12 pr-4 py-3 ultt-input text-lg"
          />
        </div>

        {search && searchResults.length > 0 && !selectedProperty && (
          <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {searchResults.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProperty(p)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 border-b last:border-0"
              >
                <p className="font-medium">{p.plotNumber}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{p.ownerName} - {p.district}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result */}
      {selectedProperty && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="font-bold text-xl">{selectedProperty.plotNumber}</h3>
            {selectedProperty.status === 'paid' ? (
              <span className="bg-green-100 text-green-700 font-bold px-4 py-2 rounded-full">CLEAR</span>
            ) : (
              <span className="bg-red-100 text-red-700 font-bold px-4 py-2 rounded-full">BLOCKED</span>
            )}
          </div>

          {selectedProperty.status !== 'paid' ? (
            <div className="space-y-3">
              <p className="text-gray-600 dark:text-gray-400">This property has outstanding rates and cannot receive a clearance certificate.</p>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Principal Owed</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(selectedProperty.principalOwed)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Interest Accrued</p>
                  <p className="font-bold text-orange-600">{formatCurrency(calculatePenalty(selectedProperty.annualTaxDue, selectedProperty.taxDueDate).interest)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total to Pay</p>
                  <p className="font-bold text-red-600 text-xl">{formatCurrency(calculatePenalty(selectedProperty.annualTaxDue, selectedProperty.taxDueDate).totalOwed)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Daily Interest</p>
                  <p className="font-bold text-orange-600">{formatCurrency(calculatePenalty(selectedProperty.annualTaxDue, selectedProperty.taxDueDate).dailyInterest)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-750 p-6 rounded-lg">
                <h4 className="font-bold text-lg text-center mb-4">TAX CLEARANCE CERTIFICATE</h4>
                <div className="text-sm space-y-2">
                  <p className="text-center">This certifies that <strong>{selectedProperty.ownerName}</strong></p>
                  <p className="text-center">Plot Number: {selectedProperty.plotNumber}, Title: {selectedProperty.landTitleNumber}</p>
                  <p className="text-center">Has no outstanding rates as at {formatDate(new Date(), 'MMMM d, yyyy')}.</p>
                  <p className="text-center font-bold mt-4">Valid for 30 days.</p>
                  <p className="text-center mt-4">Issued by: _____________ Date: _____________</p>
                  <UgandaCoatOfArms size={72} className="mx-auto mt-3" />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gray-800 text-white py-3 rounded-lg hover:bg-gray-700"
                >
                  <Download size={18} className="inline mr-2" />
                  Download Certificate
                </button>
                <button
                  onClick={handleIssue}
                  disabled={isActionDisabled}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <Check size={18} className="inline mr-2" />
                  Issue Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issued Certificates Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="ultt-section-title mb-4">Certificates Issued This Session</h3>
        {certificatesIssued.length > 0 ? (
          <div className="space-y-2">
            {certificatesIssued.map((cert) => (
              <div key={cert.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{cert.propertyName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{cert.ownerName}</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">{cert.dateIssued}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No certificates issued yet</p>
        )}
      </div>
    </div>
  );
}

// Title Block Registry Page
function TitleBlockRegistryPage({
  properties,
  addActivity,
  showToast,
  isActionDisabled,
}: {
  properties: Property[];
  addActivity: (id: number, name: string, action: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
}) {
  const [blockStatus, setBlockStatus] = useState<{ [key: number]: string }>({});

  const blockedProperties = useMemo(() => {
    return properties
      .filter(p => p.status !== 'paid')
      .map(p => {
        const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
        return {
          ...p,
          penalty,
          blockNoticeStatus: blockStatus[p.id] || 'Pending',
        };
      });
  }, [properties, blockStatus]);

  const stats = useMemo(() => {
    let totalOwed = 0;
    blockedProperties.forEach(p => {
      totalOwed += p.penalty.totalOwed;
    });
    return {
      count: blockedProperties.length,
      totalOwed,
    };
  }, [blockedProperties]);

  const generateBlockNotice = (property: Property) => {
    addActivity(property.id, property.plotNumber, 'Block notice generated');
    showToast(`Block notice generated for ${property.plotNumber}`);
  };

  const markCleared = (propertyId: number, plotNumber: string) => {
    setBlockStatus(prev => ({ ...prev, [propertyId]: 'Cleared' }));
    addActivity(propertyId, plotNumber, 'Block mark cleared');
    showToast(`Block cleared for ${plotNumber}`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Title Transfer Block Registry</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Properties Blocked</p>
          <p className="text-2xl font-bold text-red-600">{stats.count}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount Blocking</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOwed)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending Notices</p>
          <p className="text-2xl font-bold">{blockedProperties.filter(p => p.blockNoticeStatus === 'Pending').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Cleared This Session</p>
          <p className="text-2xl font-bold text-green-600">{blockedProperties.filter(p => p.blockNoticeStatus === 'Cleared').length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#C8102E] text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Plot No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">District</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Principal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Interest</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Total Owed</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Daily Int.</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Days Blocked</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {blockedProperties.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 text-sm font-medium">{p.plotNumber}</td>
                <td className="px-4 py-3 text-sm">{p.ownerName}</td>
                <td className="px-4 py-3 text-sm">{p.district}</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.principalOwed)}</td>
                <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(p.penalty.interest)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(p.penalty.totalOwed)}</td>
                <td className="px-4 py-3 text-sm text-center">{formatCurrency(p.penalty.dailyInterest)}</td>
                <td className="px-4 py-3 text-sm text-center">{p.penalty.daysOverdue}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${
                    p.blockNoticeStatus === 'Cleared' ? 'bg-green-100 text-green-700' :
                    p.blockNoticeStatus === 'Noticed' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.blockNoticeStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => generateBlockNotice(p)}
                      disabled={isActionDisabled}
                      className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isActionDisabled ? 'Contact Admin' : 'Generate Notice'}
                    >
                      Notice
                    </button>
                    <button
                      onClick={() => markCleared(p.id, p.plotNumber)}
                      disabled={isActionDisabled || p.blockNoticeStatus === 'Cleared'}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={isActionDisabled ? 'Contact Admin' : 'Mark Cleared'}
                    >
                      Clear
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Criminal Referrals Page
function CriminalReferralsPage({
  properties,
  referrals,
  setReferrals,
  showToast,
  isActionDisabled,
}: {
  properties: Property[];
  referrals: CriminalReferral[];
  setReferrals: React.Dispatch<React.SetStateAction<CriminalReferral[]>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: 0,
    reason: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const property = properties.find(p => p.id === formData.propertyId);
    if (!property) return;

    const newReferral: CriminalReferral = {
      id: Date.now(),
      propertyId: formData.propertyId,
      propertyName: property.plotNumber,
      ownerName: property.ownerName,
      rentalIncomeDeclared: property.rentalIncomeDeclared,
      referralDate: formatDate(new Date(), 'yyyy-MM-dd'),
      stage: 'Flagged',
      officer: 'Admin',
      notes: formData.notes,
      reason: formData.reason,
    };
    setReferrals(prev => [newReferral, ...prev]);
    showToast(`Criminal referral created for ${property.plotNumber}`);
    setShowForm(false);
    setFormData({ propertyId: 0, reason: '', notes: '' });
  };

  const updateReferralStage = (id: number, newStage: string) => {
    setReferrals(prev => prev.map(r => r.id === id ? { ...r, stage: newStage } : r));
    showToast(`Referral stage updated`);
  };

  const propertiesWithRentalIncome = properties.filter(p => p.rentalIncomeDeclared > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Criminal Referral Tracker</h1>

      {/* Info Box */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex">
          <AlertTriangle className="text-yellow-600 mr-3" size={24} />
          <div>
            <h3 className="font-bold text-yellow-800">URA Jurisdiction</h3>
            <p className="text-sm text-yellow-700">
              Unpaid rental income tax falls under URA jurisdiction.
              <strong> Penalty: up to 6 months imprisonment or UGX 2,000,000 fine</strong>
              under Uganda Income Tax Act.
            </p>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="ultt-section-title mb-4">Add Criminal Referral</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Property</label>
              <select
                value={formData.propertyId}
                onChange={(e) => setFormData({ ...formData, propertyId: Number(e.target.value) })}
                className="w-full ultt-input px-4 py-2"
                required
              >
                <option value={0}>-- Select a property --</option>
                {propertiesWithRentalIncome.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plotNumber} - {p.ownerName} (Rent: {formatCurrency(p.rentalIncomeDeclared)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Reason</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full ultt-input px-4 py-2"
                placeholder="e.g., Failure to declare rental income"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full ultt-input px-4 py-2"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isActionDisabled}
                className="flex-1 bg-[#C8102E] text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Submit Referral
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          disabled={isActionDisabled}
          className="flex items-center gap-2 bg-[#C8102E] text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
          title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
        >
          <Plus size={18} />
          Add Referral
        </button>
      )}

      {/* Referrals Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#C8102E] text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Property</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Rental Income</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Referral Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Stage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Reason</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {referrals.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 text-sm font-medium">{r.propertyName}</td>
                <td className="px-4 py-3 text-sm">{r.ownerName}</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(r.rentalIncomeDeclared)}</td>
                <td className="px-4 py-3 text-sm">{r.referralDate}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded ${
                    r.stage === 'Resolved' ? 'bg-green-100 text-green-700' :
                    r.stage === 'Penalty Applied' ? 'bg-red-100 text-red-700' :
                    r.stage === 'Under Investigation' ? 'bg-orange-100 text-orange-700' :
                    r.stage === 'Referred to URA' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {r.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{r.reason}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={r.stage}
                    onChange={(e) => updateReferralStage(r.id, e.target.value)}
                    disabled={isActionDisabled}
                    className="text-xs ultt-select px-2 py-1 disabled:opacity-50"
                  >
                    <option value="Flagged">Flagged</option>
                    <option value="Referred to URA">Referred to URA</option>
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Penalty Applied">Penalty Applied</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {referrals.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No criminal referrals yet</p>
        )}
      </div>
    </div>
  );
}

// Notifications Page
function NotificationsPage({
  properties,
  history,
  setHistory,
  showToast,
  isActionDisabled,
  escalationLog = [],
}: {
  properties: Property[];
  history: NotificationHistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<NotificationHistoryItem[]>>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
  escalationLog?: EscalationLogEntry[];
}) {
  const [tab, setTab] = useState<'send' | 'bulk' | 'history' | 'escalation'>('send');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [bulkFilters, setBulkFilters] = useState({ stage: '', district: '' });
  const [bulkSelected, setBulkSelected] = useState<number[]>([]);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const stageMessages: { [key: string]: (p: Property) => string } = {
    interest_accruing: (p) => {
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      return `Dear ${p.ownerName}, your property ${p.plotNumber} in ${p.district} has outstanding tax of ${formatCurrency(p.principalOwed)}. Interest of 2% per month is accruing. Total now owed: ${formatCurrency(penalty.totalOwed)}. Pay now.`;
    },
    demand_notice: (p) => {
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      return `FORMAL DEMAND: Dear ${p.ownerName}, ${formatCurrency(penalty.totalOwed)} is due on property ${p.plotNumber} within 60 days. Non-payment will result in rent interception and legal action.`;
    },
    rent_interception: (p) => {
      const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
      return `FINAL WARNING: Property ${p.plotNumber} is under rent interception. Rental income redirected to ${p.district} Authority until ${formatCurrency(penalty.totalOwed)} is recovered. Contact officer immediately.`;
    },
  };

  useEffect(() => {
    if (selectedProperty) {
      const stage = selectedProperty.enforcementStage;
      if (stageMessages[stage]) {
        setMessage(stageMessages[stage](selectedProperty));
      }
    }
  }, [selectedPropertyId]);

  const bulkFilteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesStage = !bulkFilters.stage || p.enforcementStage === bulkFilters.stage;
      const matchesDistrict = !bulkFilters.district || p.district === bulkFilters.district;
      return matchesStage && matchesDistrict;
    });
  }, [properties, bulkFilters]);

  const handleSend = () => {
    if (!selectedProperty) return;
    const newItem: NotificationHistoryItem = {
      id: Date.now(),
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.plotNumber,
      ownerName: selectedProperty.ownerName,
      message: message.substring(0, 50) + '...',
      dateSent: formatDate(new Date(), 'MMM d, yyyy HH:mm'),
      sentBy: 'Admin',
      status: 'Sent',
    };
    setHistory(prev => [newItem, ...prev]);
    showToast(`Notification sent to ${selectedProperty.ownerName}`);
    setMessage('');
  };

  const handleBulkSend = () => {
    bulkSelected.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (prop) {
        const stage = prop.enforcementStage;
        const msg = stageMessages[stage] ? stageMessages[stage](prop) : '';
        const newItem: NotificationHistoryItem = {
          id: Date.now() + id,
          propertyId: prop.id,
          propertyName: prop.plotNumber,
          ownerName: prop.ownerName,
          message: msg.substring(0, 50) + '...',
          dateSent: formatDate(new Date(), 'MMM d, yyyy HH:mm'),
          sentBy: 'Admin',
          status: 'Sent',
        };
        setHistory(prev => [newItem, ...prev]);
      }
    });
    showToast(`${bulkSelected.length} messages sent. Total notified: ${formatCurrency(bulkTotalDebt)}`);
    setBulkSelected([]);
  };

  const bulkTotalDebt = useMemo(() => {
    return bulkSelected.reduce((sum, id) => {
      const prop = properties.find(p => p.id === id);
      if (prop) {
        const penalty = calculatePenalty(prop.annualTaxDue, prop.taxDueDate);
        return sum + penalty.totalOwed;
      }
      return sum;
    }, 0);
  }, [bulkSelected, properties]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Notification Centre</h1>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['send', 'bulk', 'history', 'escalation'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg ${tab === t ? 'bg-[#C8102E] text-white' : 'bg-gray-200'}`}
          >
            {t === 'send' ? 'Send Notification' : t === 'bulk' ? 'Bulk Send' : t === 'history' ? 'History' : 'Escalation Log'}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Property</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(Number(e.target.value))}
              className="w-full ultt-input px-4 py-2"
            >
              <option value={0}>-- Select a property --</option>
              {properties.filter(p => p.status !== 'paid').map(p => (
                <option key={p.id} value={p.id}>
                  {p.plotNumber} - {p.ownerName} ({p.district})
                </option>
              ))}
            </select>
          </div>
          {selectedProperty && (
            <div className="flex gap-2 flex-wrap">
              <StageBadge stage={selectedProperty.enforcementStage} />
              <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                {formatCurrency(calculatePenalty(selectedProperty.annualTaxDue, selectedProperty.taxDueDate).totalOwed)} owed
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full ultt-input px-4 py-2"
              rows={5}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isActionDisabled || !selectedProperty}
            className="w-full bg-[#C8102E] text-white py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Send size={18} className="inline mr-2" />
            Send Notification
          </button>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select
              value={bulkFilters.stage}
              onChange={(e) => setBulkFilters({ ...bulkFilters, stage: e.target.value })}
              className="ultt-select px-4 py-2"
            >
              <option value="">All Stages</option>
              <option value="interest_accruing">Interest Accruing</option>
              <option value="demand_notice">Demand Notice</option>
              <option value="rent_interception">Rent Interception</option>
            </select>
            <FlatDistrictSelect
              value={bulkFilters.district}
              onChange={(d) => setBulkFilters({ ...bulkFilters, district: d })}
              includeAll
              className="ultt-select px-4 py-2"
            />
          </div>

          <div className="flex items-center gap-4 mb-4">
            <input
              type="checkbox"
              checked={bulkSelected.length === bulkFilteredProperties.length && bulkFilteredProperties.length > 0}
              onChange={(e) => {
                if (e.target.checked) {
                  setBulkSelected(bulkFilteredProperties.map(p => p.id));
                } else {
                  setBulkSelected([]);
                }
              }}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium">Select All ({bulkFilteredProperties.length} properties)</span>
          </div>

          <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg">
            <p className="font-medium">{bulkSelected.length} properties selected</p>
            <p className="text-red-600 font-bold">Total debt: {formatCurrency(bulkTotalDebt)}</p>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {bulkFilteredProperties.map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-750 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={bulkSelected.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setBulkSelected(prev => [...prev, p.id]);
                    } else {
                      setBulkSelected(prev => prev.filter(id => id !== p.id));
                    }
                  }}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.plotNumber} - {p.ownerName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.district}</p>
                </div>
                <span className="text-sm text-red-600 font-bold">
                  {formatCurrency(calculatePenalty(p.annualTaxDue, p.taxDueDate).totalOwed)}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={handleBulkSend}
            disabled={isActionDisabled || bulkSelected.length === 0}
            className="w-full bg-[#C8102E] text-white py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Send size={18} className="inline mr-2" />
            Send {bulkSelected.length} Notifications
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#C8102E] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Message Preview</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Date Sent</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 text-sm">{h.propertyName}</td>
                  <td className="px-4 py-3 text-sm">{h.ownerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{h.message}</td>
                  <td className="px-4 py-3 text-sm">{h.dateSent}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">{h.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No notifications sent yet</p>
          )}
        </div>
      )}

      {tab === 'escalation' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#C8102E] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Rule Triggered</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Action Taken</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Auto/Manual</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {escalationLog.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3">{e.property}</td>
                  <td className="px-4 py-3">{e.ruleTriggered}</td>
                  <td className="px-4 py-3">{e.actionTaken}</td>
                  <td className="px-4 py-3 text-center"><span className="text-xs bg-gray-100 px-2 py-1 rounded">{e.mode}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {escalationLog.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-8">No escalation events logged yet</p>}
        </div>
      )}
    </div>
  );
}

// Analytics Page
function AnalyticsPage({ properties, demoMode = false }: { properties: Property[]; demoMode?: boolean }) {
  const districtData = useMemo(() => {
    const withData = [...new Set(properties.map((p) => p.district))].sort();
    return withData.map((d) => {
      const districtProps = properties.filter((p) => p.district === d);
      const collected = districtProps.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.annualTaxDue, 0);
      const target = districtProps.reduce((sum, p) => sum + p.annualTaxDue, 0);
      const rate = target > 0 ? Math.round((collected / target) * 100) : 0;
      return { name: d, collected, target, rate };
    });
  }, [properties]);

  const stageData = useMemo(() => {
    const stages = ['interest_accruing', 'demand_notice', 'rent_interception', 'legal_action', 'resolved'];
    const labels = ['Interest', 'Demand', 'Rent Inter.', 'Legal', 'Resolved'];
    return stages.map((s, i) => ({
      name: labels[i],
      count: properties.filter(p => p.enforcementStage === s).length,
    }));
  }, [properties]);

  const topOwing = useMemo(() => {
    return properties
      .filter(p => p.status !== 'paid')
      .map(p => ({
        ...p,
        penalty: calculatePenalty(p.annualTaxDue, p.taxDueDate),
      }))
      .sort((a, b) => b.penalty.totalOwed - a.penalty.totalOwed)
      .slice(0, 10);
  }, [properties]);

  const maxTarget = Math.max(...districtData.map(d => d.target), 1);
  const maxStageCount = Math.max(...stageData.map(d => d.count), 1);

  const monthlyRevenue = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const month = subMonths(new Date(), i);
      const monthLabel = formatDate(month, 'MMM');
      const revenue = Math.round(Math.random() * 5000000 + 2000000);
      months.push({ month: monthLabel, revenue });
    }
    return months;
  }, []);

  const maxRevenue = Math.max(...monthlyRevenue.map(d => d.revenue), 1);

  const interestStats = useMemo(() => {
    const delinquent = properties.filter((p) => p.status !== 'paid');
    const totalInterest = delinquent.reduce((s, p) => s + calculatePenalty(p.annualTaxDue, p.taxDueDate).interest, 0);
    const avgPerProperty = delinquent.length ? totalInterest / delinquent.length : 0;
    const fastest = [...delinquent].sort((a, b) => calculatePenalty(b.annualTaxDue, b.taxDueDate).dailyInterest - calculatePenalty(a.annualTaxDue, a.taxDueDate).dailyInterest)[0];
    const projected12 = totalInterest + delinquent.reduce((s, p) => s + p.annualTaxDue * 0.02 * 12, 0);
    return { totalInterest, avgPerProperty, fastest, projected12 };
  }, [properties]);

  const enforcementStats = useMemo(() => {
    const resolved = properties.filter((p) => p.enforcementStage === 'resolved');
    const withoutLegal = resolved.filter((p) => p.notes !== 'legal').length;
    const pctWithoutLegal = resolved.length ? Math.round((withoutLegal / resolved.length) * 100) : 0;
    const bestDistrict = districtData.sort((a, b) => b.rate - a.rate)[0];
    return { avgDays: 45, pctWithoutLegal, bestDistrict: bestDistrict?.name || 'N/A', bestRate: bestDistrict?.rate || 0 };
  }, [properties, districtData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Analytics</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-3">Interest Analytics</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500 dark:text-gray-400">Total Interest Generated</p><p className="font-bold text-red-600">{formatCurrency(interestStats.totalInterest)}</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Avg per Property</p><p className="font-bold">{formatCurrency(Math.round(interestStats.avgPerProperty))}</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Fastest Growing Case</p><p className="font-bold">{interestStats.fastest?.plotNumber || 'N/A'}</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Projected Next 12 Months</p><p className="font-bold text-orange-600">{formatCurrency(Math.round(interestStats.projected12))}</p></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-3">Enforcement Performance</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500 dark:text-gray-400">Avg Days Stage 1 to Resolution</p><p className="font-bold">{enforcementStats.avgDays} days</p></div>
            <div><p className="text-gray-500 dark:text-gray-400">Resolved Without Legal Action</p><p className="font-bold">{enforcementStats.pctWithoutLegal}%</p></div>
            <div className="col-span-2"><p className="text-gray-500 dark:text-gray-400">Highest Collection Rate District</p><p className="font-bold">{enforcementStats.bestDistrict} ({enforcementStats.bestRate}%)</p></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue vs Target */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Revenue Collected vs Target by District</h3>
          <div className="space-y-4">
            {districtData.map((d, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{d.name}</span>
                  <span>{formatCurrency(d.collected)} / {formatCurrency(d.target)}</span>
                </div>
                <div className="flex gap-1 h-6">
                  <div
                    className="bg-[#FCDD09] rounded-l"
                    style={{ width: `${(d.collected / maxTarget) * 100}%` }}
                    title={`Collected: ${formatCurrency(d.collected)}`}
                  />
                  <div
                    className="bg-gray-200 rounded-r"
                    style={{ width: `${((maxTarget - d.collected) / maxTarget) * 100}%` }}
                    title={`Target: ${formatCurrency(d.target)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interest Revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Interest Revenue per Month</h3>
          <svg viewBox="0 0 400 200" className="w-full h-64">
            <polyline
              fill="none"
              stroke="#C8102E"
              strokeWidth="2"
              points={monthlyRevenue.map((d, i) => {
                const x = 30 + (i * 30);
                const y = 180 - (d.revenue / maxRevenue) * 150;
                return `${x},${y}`;
              }).join(' ')}
            />
            {monthlyRevenue.map((d, i) => {
              const x = 30 + (i * 30);
              const y = 180 - (d.revenue / maxRevenue) * 150;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill="#C8102E" className="cursor-pointer">
                    <title>{formatCurrency(d.revenue)}</title>
                  </circle>
                  <text x={x} y="195" textAnchor="middle" fontSize="10" className="fill-gray-600 dark:fill-gray-400">{d.month}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stage Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Properties per Enforcement Stage</h3>
          <div className="h-64 flex items-end gap-4 px-4">
            {stageData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-[#C8102E] rounded-t group relative cursor-pointer"
                  style={{ height: `${(d.count / maxStageCount) * 180}px` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100">
                    {d.count}
                  </div>
                </div>
                <span className="text-xs mt-2">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Collection Rate Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="ultt-section-title mb-4">Collection Rate by District</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {districtData.map((d, i) => {
              const radius = 40;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (d.rate / 100) * circumference;
              return (
                <div key={i} className="text-center">
                  <svg width="100" height="100" className="transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke="#e5e7eb"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke="#C8102E"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <p className="text-lg font-bold -mt-16">{d.rate}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-12">{d.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Owing Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold p-4 border-b">Top 10 Highest Owing Properties</h3>
        <table className="w-full">
          <thead className="bg-[#C8102E] text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Plot No</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">District</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Principal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Interest</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Total Owed</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Days Over</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {topOwing.map((p, i) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3 text-sm font-bold text-[#C8102E]">{i + 1}</td>
                <td className="px-4 py-3 text-sm font-medium">{p.plotNumber}</td>
                <td className="px-4 py-3 text-sm">{p.ownerName}</td>
                <td className="px-4 py-3 text-sm">{p.district}</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.principalOwed)}</td>
                <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(p.penalty.interest)}</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(p.penalty.totalOwed)}</td>
                <td className="px-4 py-3 text-sm text-center">{p.penalty.daysOverdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {demoMode && <p className="text-sm text-gray-500 dark:text-gray-400 italic">Note: Data shown is fictional training data only. Not real records.</p>}
    </div>
  );
}

// Report Generator Page
function ReportGeneratorPage({ properties }: { properties: Property[] }) {
  const [district, setDistrict] = useState('');
  const [period, setPeriod] = useState('month');
  const [report, setReport] = useState<string | null>(null);

  const generateReport = () => {
    const filteredProps = district ? properties.filter(p => p.district === district) : properties;
    const delinquent = filteredProps.filter(p => p.status === 'delinquent');
    let totalPrincipal = 0;
    let totalInterest = 0;
    delinquent.forEach(p => {
      totalPrincipal += p.principalOwed;
      totalInterest += calculatePenalty(p.annualTaxDue, p.taxDueDate).interest;
    });

    const top5 = delinquent
      .map(p => ({ ...p, penalty: calculatePenalty(p.annualTaxDue, p.taxDueDate) }))
      .sort((a, b) => b.penalty.totalOwed - a.penalty.totalOwed)
      .slice(0, 5);

    const text = `UGANDA LAND TAX TRACKER - ENFORCEMENT REPORT
${district || 'All Districts'} | ${period.toUpperCase()} | Generated: ${formatDate(new Date(), 'MMMM d, yyyy')}

${UGANDA_COAT_OF_ARMS_TEXT}

SUMMARY
Total Properties: ${filteredProps.length} | Delinquent: ${delinquent.length} (${Math.round((delinquent.length / filteredProps.length) * 100) || 0}%)
Principal Owed: ${formatCurrency(totalPrincipal)} | Interest Accrued: ${formatCurrency(totalInterest)}
Total Owed: ${formatCurrency(totalPrincipal + totalInterest)} | Collected This Period: ${formatCurrency(Math.round(Math.random() * 5000000))}

ENFORCEMENT ACTIONS
Demand Notices: ${filteredProps.filter(p => p.enforcementStage === 'demand_notice').length}
Rent Interceptions: ${filteredProps.filter(p => p.enforcementStage === 'rent_interception').length}
Legal Actions: ${filteredProps.filter(p => p.enforcementStage === 'legal_action').length}
Criminal Referrals: 1 | Certificates: ${filteredProps.filter(p => p.status === 'paid').length}

TOP 5 DELINQUENT PROPERTIES
${top5.map((p, i) => `${i + 1}. ${p.plotNumber} - ${p.ownerName} - ${formatCurrency(p.penalty.totalOwed)}`).join('\n')}

Signed: _____________ Date: _____________`;

    setReport(text);
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enforcement_report_${district || 'all'}_${formatDate(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Report Generator</h1>
        <UgandaCoatOfArms size={64} />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">District</label>
            <GroupedDistrictSelect
              value={district}
              onChange={setDistrict}
              includeAll
              className="w-full ultt-input px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full ultt-input px-4 py-2"
            >
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={generateReport}
              className="w-full bg-[#C8102E] text-white py-2 rounded-lg hover:bg-red-700"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {report && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="ultt-section-title">Report Preview</h3>
            <button
              onClick={downloadReport}
              className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <Download size={18} />
              Download Report
            </button>
          </div>
          <UgandaCoatOfArms size={80} className="mx-auto mb-4" />
          <pre className="bg-gray-50 dark:bg-gray-750 p-6 rounded-lg whitespace-pre-wrap text-sm font-mono overflow-x-auto">
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}

// Legal Cases Page
function LegalCasesPage({
  properties,
  addActivity,
  showToast,
  isActionDisabled,
  settings,
  enforcementActions,
}: {
  properties: Property[];
  addActivity: (id: number, name: string, action: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
  settings: PlatformSettings;
  enforcementActions: EnforcementAction[];
}) {
  const [selectedCase, setSelectedCase] = useState<Property | null>(null);
  const [caseNotes, setCaseNotes] = useState<{ [key: number]: string }>({});
  const [caseStatus, setCaseStatus] = useState<{ [key: number]: string }>({});

  const legalCases = properties.filter(p => p.enforcementStage === 'legal_action');

  const handleUpdateStatus = (propertyId: number, plotNumber: string, newStatus: string) => {
    setCaseStatus(prev => ({ ...prev, [propertyId]: newStatus }));
    addActivity(propertyId, plotNumber, `Case status updated to ${newStatus}`);
    showToast(`Case status updated for ${plotNumber}`);
  };

  const handleSaveNotes = (propertyId: number, plotNumber: string) => {
    addActivity(propertyId, plotNumber, 'Case notes updated');
    showToast(`Notes saved for ${plotNumber}`);
  };

  const generateCourtSummary = (property: Property) => {
    const penalty = calculatePenalty(property.annualTaxDue, property.taxDueDate);
    const caseNo = `LC-${new Date().getFullYear()}-${property.id.toString().padStart(4, '0')}`;
    const activityLog = enforcementActions.filter((a) => a.propertyId === property.id).map((a) => `- ${formatDate(new Date(a.timestamp), 'yyyy-MM-dd')}: ${a.action}`).join('\n') || '- No activity logged';
    const authority = settings.authorityName || 'Configure authority details in Settings page first';
    return `COURT CASE SUMMARY | Ref: ${caseNo} | Date: ${formatDate(new Date(), 'MMMM d, yyyy')}
${UGANDA_COAT_OF_ARMS_TEXT}
${authority} | ${settings.districtName || property.district}
${settings.officialStampText || ''}

PLAINTIFF: ${settings.districtName || property.district} Local Government
DEFENDANT: ${property.ownerName}
PROPERTY: Plot ${property.plotNumber}, Title ${property.landTitleNumber}, ${property.district}

CLAIMED: Principal ${formatCurrency(property.principalOwed)} + Interest ${formatCurrency(penalty.interest)} = ${formatCurrency(penalty.totalOwed)}
Interest accrues ${formatCurrency(penalty.dailyInterest)}/day.

LEGAL BASIS: Local Governments Rating Act 2005. Limit: 6 years.

ENFORCEMENT HISTORY:
${activityLog}

NOTICES SERVED: Demand notice, Rent interception notice | Signed: _____ Date: _____`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">Legal Cases</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cases List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#C8102E] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Case No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase">Owner</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-white uppercase">Claim</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-white uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {legalCases.map((p) => {
                const penalty = calculatePenalty(p.annualTaxDue, p.taxDueDate);
                const caseNo = `LC-${new Date().getFullYear()}-${p.id.toString().padStart(4, '0')}`;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedCase(p)}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 ${selectedCase?.id === p.id ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-mono">{caseNo}</td>
                    <td className="px-4 py-3 text-sm">{p.plotNumber}</td>
                    <td className="px-4 py-3 text-sm">{p.ownerName}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatCurrency(penalty.totalOwed)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        {caseStatus[p.id] || 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {legalCases.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No legal cases</p>
          )}
        </div>

        {/* Case Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {selectedCase ? (
            <div className="space-y-4">
              <UgandaCoatOfArms size={72} className="mx-auto" />
              <h3 className="font-bold text-lg text-center">
                Case LC-{new Date().getFullYear()}-{selectedCase.id.toString().padStart(4, '0')}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Property</p>
                  <p className="font-medium">{selectedCase.plotNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Owner</p>
                  <p className="font-medium">{selectedCase.ownerName}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">District</p>
                  <p className="font-medium">{selectedCase.district}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Total Claimed</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(calculatePenalty(selectedCase.annualTaxDue, selectedCase.taxDueDate).totalOwed)}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg text-sm">
                <p className="font-semibold mb-2">Legal Authority</p>
                <p>Local Governments Rating Act 2005 - recovery of rates as civil debt.</p>
                <p>Limitation: 6 years.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Case Notes</label>
                <textarea
                  value={caseNotes[selectedCase.id] || ''}
                  onChange={(e) => setCaseNotes({ ...caseNotes, [selectedCase.id]: e.target.value })}
                  className="w-full ultt-input px-4 py-2"
                  rows={4}
                  disabled={isActionDisabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={caseStatus[selectedCase.id] || 'Pending'}
                  onChange={(e) => handleUpdateStatus(selectedCase.id, selectedCase.plotNumber, e.target.value)}
                  className="w-full ultt-input px-4 py-2"
                  disabled={isActionDisabled}
                >
                  <option value="Pending">Pending</option>
                  <option value="Hearing Scheduled">Hearing Scheduled</option>
                  <option value="Judgment Reserved">Judgment Reserved</option>
                  <option value="Judgment Given">Judgment Given</option>
                  <option value="Enforcement">Enforcement</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveNotes(selectedCase.id, selectedCase.plotNumber)}
                  disabled={isActionDisabled}
                  className="flex-1 bg-gray-200 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Save Notes
                </button>
                <button
                  onClick={() => {
                    const text = generateCourtSummary(selectedCase);
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `court_summary_${selectedCase.plotNumber}.txt`;
                    a.click();
                  }}
                  className="flex-1 bg-[#C8102E] text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Generate Court Summary
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <Scale size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Select a case to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AI Assistant Page
function AIAssistantPage({ demoMode = false, settings, showToast }: { demoMode?: boolean; settings: PlatformSettings; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [messages, setMessages] = useState<{ type: 'user' | 'ai'; text: string; announcement?: boolean }[]>([
    {
      type: 'ai',
      text: `Hello Admin! I am your Uganda Land Tax Tracker Assistant.
I can help you with penalties, notices, platform navigation,
enforcement stages, tax clearance, and more.
What would you like help with today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [awaitingAnnouncementDetails, setAwaitingAnnouncementDetails] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const prefix = demoMode ? '[DEMO MODE] Guidance applies to training data only. Switch off Demo Mode for live enforcement.\n\n' : '';

  const announcementKeywords = ['announce', 'announcement', 'public message', 'draft message', 'generate notice', 'write announcement'];

  const getResponse = (userInput: string): { text: string; announcement?: boolean } => {
    const lowerInput = userInput.toLowerCase();

    if (announcementKeywords.some((k) => lowerInput.includes(k)) && !awaitingAnnouncementDetails) {
      setAwaitingAnnouncementDetails(true);
      return { text: prefix + `I can help you draft a public announcement.\nPlease tell me:\n1. What is the announcement about?\n2. Who is the audience? (general public / property owners / tenants)\n3. Is there a deadline or urgency?\n\nTell me these details and I will draft the full announcement.` };
    }

    if (awaitingAnnouncementDetails) {
      setAwaitingAnnouncementDetails(false);
      const authority = settings.authorityName || 'District Revenue Authority';
      const body = `OFFICIAL ANNOUNCEMENT\n${authority} | ${formatDate(new Date(), 'MMMM d, yyyy')}\n\n${userInput.toUpperCase()}\n\nThe ${authority} wishes to inform all property owners and stakeholders of the following important notice regarding land tax compliance and enforcement activities.\n\nAll property owners are reminded of their obligation under the Local Governments Rating Act 2005 to pay property rates promptly. Failure to comply may result in interest charges, demand notices, rent interception, and legal action.\n\nFor further information contact:\n${settings.districtName || 'District'} Revenue Office\n${settings.revenueOfficeContact || 'Contact your district office'}`;
      return { text: prefix + body, announcement: true };
    }

    if (lowerInput.includes('penalty') || lowerInput.includes('interest') || lowerInput.includes('2%') || lowerInput.includes('calculate')) {
      return { text: prefix + `Uganda law sets interest at 2% per month on all overdue property rates under the Local Governments Rating Act 2005.

To calculate:
1. Go to Penalty Calculator page in the sidebar
2. Enter Annual Tax Due and Date Tax Was Due
3. The calculator shows days overdue, interest accrued, total owed, and a 36-month projection chart

Example: UGX 1,000,000 overdue 12 months = UGX 240,000 interest = UGX 1,240,000 total owed.

Click Bulk Recalculate to update all properties at once.` };
    }

    if (lowerInput.includes('demand notice') || lowerInput.includes('notice') || lowerInput.includes('serve') || lowerInput.includes('formal')) {
      return { text: prefix + `To issue a Demand Notice:
1. Go to Demand Notices page in the sidebar
2. Find the property in the list and click it
3. Review the auto-populated notice with owner details, principal, interest, total owed, and 60-day deadline
4. Click Download to save the notice as a file
5. Click Mark as Issued to log it in the system

The property advances to Stage 2 automatically.
The owner then has 60 days to pay before rent interception begins.` };
    }

    if (lowerInput.includes('rent') || lowerInput.includes('intercept') || lowerInput.includes('tenant') || lowerInput.includes('stage 3')) {
      return { text: prefix + `Rent Interception (Stage 3) redirects tenant rent payments directly to the district authority.

Legal basis: Local Governments Rating Act 2005.

Steps:
1. Open the property on the Property Database page
2. Click Generate Rent Interception Notice
3. This creates a formal legal notice for the tenant
4. Serve it to the tenant directly
5. From that date the tenant pays rent to the district, not the owner

Make sure the tenant name is in the property record first.` };
    }

    if (lowerInput.includes('clearance') || lowerInput.includes('certificate') || lowerInput.includes('blocked') || lowerInput.includes('sell') || lowerInput.includes('transfer') || lowerInput.includes('title')) {
      return { text: prefix + `No Uganda property can be sold without a Tax Clearance Certificate - this is your most powerful enforcement tool.

Steps:
1. Go to Tax Clearance page
2. Search by plot number or owner name
3. BLOCKED means arrears exist - show owner the exact amount to pay
4. Once paid, mark the property as paid on the Property Database
5. Return to Tax Clearance - status changes to CLEAR automatically
6. Click Issue Certificate to generate the clearance document

Owners who want to sell MUST pay first. This motivates payment even without formal legal action.` };
    }

    if (lowerInput.includes('criminal') || lowerInput.includes('prison') || lowerInput.includes('ura') || lowerInput.includes('fine') || lowerInput.includes('rental income')) {
      return { text: prefix + `Criminal penalties apply to unpaid RENTAL INCOME TAX.
This is managed by URA - separate from property rates.

Uganda Income Tax Act penalties:
- Up to 6 months imprisonment, OR
- UGX 2,000,000 fine (approximately $530 USD)

To refer a case:
1. Go to Criminal Referral Tracker
2. Click Add Referral, select the property, enter details
3. Submit - logs the referral for URA follow-up
4. Track status on the same page

Note: both property rates AND rental income tax can be outstanding on the same property at the same time.` };
    }

    if (lowerInput.includes('escalate') || lowerInput.includes('stage') || lowerInput.includes('advance') || lowerInput.includes('pipeline') || lowerInput.includes('next step')) {
      return { text: prefix + `The 5 enforcement stages are:

Stage 1 - Interest Accruing: 30+ days overdue. Send reminder.
Stage 2 - Demand Notice Served: formal notice, 60-day window.
Stage 3 - Rent Interception: redirect tenant rent to district.
Stage 4 - Legal Action: court proceedings for recovery.
Stage 5 - Resolved: paid and closed.

To advance a property: go to Enforcement Pipeline, find the property card, click Advance Stage.` };
    }

    if (lowerInput.includes('report') || lowerInput.includes('ministry') || lowerInput.includes('generate') || lowerInput.includes('print')) {
      return { text: prefix + `To generate a ministry-ready enforcement report:
1. Go to Report Generator page
2. Select the district and reporting period
3. Click Generate Report
4. Review the report - it includes delinquency stats, enforcement actions, interest revenue, top delinquents
5. Click Download to save it

Key tip: highlight the Interest Revenue figure in meetings. It shows officials exactly how much penalty income your enforcement activity is generating for the district.` };
    }

    if (lowerInput.includes('block') || lowerInput.includes('registry') || lowerInput.includes('prevent sale') || lowerInput.includes('title block')) {
      return { text: prefix + `The Title Transfer Block Registry lists all properties currently blocked from sale due to outstanding rates.

Any property with arrears cannot be sold or title transferred.

To manage:
1. Go to Title Block Registry
2. Generate a Block Notice per property if needed
3. When payment is received, click Mark as Cleared
4. Then go to Tax Clearance to issue the certificate

This is a passive enforcement tool - owners who want to sell or refinance their property MUST clear their rates first.` };
    }

    return { text: prefix + `I can help you with these topics - type any keyword to get started:

- penalty or interest - 2% monthly calculation guidance
- demand notice - step by step notice generation
- rent intercept - how to redirect tenant payments
- clearance or certificate - tax clearance guidance
- criminal or URA - rental income tax enforcement
- escalate or pipeline - enforcement stage guidance
- report or ministry - generating official reports
- block or registry - title transfer blocking` };
  };

  const startListening = () => {
    if (!speechSupported) { showToast('Voice input is not supported in this browser. Please use Google Chrome for voice features.', 'error'); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => { setInput(e.results[0][0].transcript); setListening(false); };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
      setListening(true);
      recognition.start();
    } catch { setListening(false); }
  };

  const speak = (text: string, idx: number) => {
    try {
      if (speakingIdx === idx) { window.speechSynthesis.cancel(); setSpeakingIdx(null); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      u.onend = () => setSpeakingIdx(null);
      setSpeakingIdx(idx);
      window.speechSynthesis.speak(u);
    } catch { /* silent */ }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev => [...prev, { type: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = getResponse(userText);
      setMessages(prev => [...prev, { type: 'ai', text: response.text, announcement: response.announcement }]);
      setIsTyping(false);
    }, 600);
  };

  const handleClear = () => {
    setMessages([
      {
        type: 'ai',
        text: `Hello Admin! I am your Uganda Land Tax Tracker Assistant.
I can help you with penalties, notices, platform navigation,
enforcement stages, tax clearance, and more.
What would you like help with today?`,
      },
    ]);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-white">AI Admin Assistant</h1>
        <button
          onClick={handleClear}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800"
        >
          <RefreshCw size={18} />
          Clear Chat
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg whitespace-pre-wrap ${
                  msg.type === 'user'
                    ? 'bg-[#C8102E] text-white rounded-br-none'
                    : 'bg-[#1a1a1a] text-white rounded-bl-none'
                }`}
              >
                {msg.type === 'ai' && (
                  <p className="text-xs text-gray-400 mb-1">ULTT Assistant</p>
                )}
                <p className="text-sm">{msg.text}</p>
                {msg.type === 'ai' && (
                  <button onClick={() => speak(msg.text, i)} className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    {speakingIdx === i ? <><Square size={12} /> Stop</> : <><Volume2 size={12} /> Speak</>}
                  </button>
                )}
                {msg.announcement && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => { navigator.clipboard.writeText(msg.text); showToast('Copied'); }} className="text-xs bg-gray-600 px-2 py-1 rounded">Copy</button>
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg.text)}`)} className="text-xs bg-green-600 px-2 py-1 rounded">WhatsApp</button>
                    <button onClick={() => { const b = new Blob([msg.text], { type: 'text/plain' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'announcement.txt'; a.click(); }} className="text-xs bg-red-600 px-2 py-1 rounded">PDF</button>
                    <button onClick={() => window.open(`mailto:?subject=Announcement&body=${encodeURIComponent(msg.text)}`)} className="text-xs bg-blue-600 px-2 py-1 rounded">Email</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-[#1a1a1a] text-white p-4 rounded-lg rounded-bl-none">
                <p className="text-sm">Typing...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          {!speechSupported && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Voice input is not supported in this browser. Please use Google Chrome for voice features.</p>}
          {listening && <p className="text-xs text-red-600 mb-2 animate-pulse">Listening...</p>}
          <div className="flex gap-3">
            {speechSupported && (
              <button onClick={startListening} className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${listening ? 'bg-red-700 animate-pulse' : 'bg-[#C8102E]'}`}>
                <Mic size={20} />
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your question..."
              className="flex-1 ultt-input px-4 py-3"
            />
            <button
              onClick={handleSend}
              className="bg-[#C8102E] text-white px-6 py-3 rounded-lg hover:bg-red-700"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Property Detail Panel
function PropertyDetailPanel({
  property,
  setProperties,
  onClose,
  addActivity,
  showToast,
  isActionDisabled,
  settings,
}: {
  property: Property;
  setProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  onClose: () => void;
  addActivity: (id: number, name: string, action: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isActionDisabled: boolean;
  settings: PlatformSettings;
}) {
  const [tab, setTab] = useState<'overview' | 'history' | 'timeline' | 'activity'>('overview');
  const [showRentModal, setShowRentModal] = useState(false);
  const penalty = calculatePenalty(property.annualTaxDue, property.taxDueDate);

  const taxHistory = useMemo(() => {
    const years = [2024, 2023, 2022];
    return years.map((year) => {
      const isDue = Math.random() > 0.3;
      return {
        year,
        taxDue: property.annualTaxDue,
        amountPaid: isDue ? property.annualTaxDue : Math.round(property.annualTaxDue * Math.random() * 0.7),
        status: isDue ? 'Paid' : 'Unpaid',
      };
    });
  }, [property]);

  const activityLog = useMemo(() => [
    { date: formatDate(subMonths(new Date(), 0), 'yyyy-MM-dd'), action: 'Status reviewed', officer: 'Admin', notes: 'Current status confirmed' },
    { date: formatDate(subMonths(new Date(), 1), 'yyyy-MM-dd'), action: 'Reminder sent', officer: 'Officer Mukasa', notes: 'SMS reminder sent' },
    { date: formatDate(subMonths(new Date(), 2), 'yyyy-MM-dd'), action: 'Site visit', officer: 'Officer Namuli', notes: 'Property inspected' },
    { date: formatDate(subMonths(new Date(), 4), 'yyyy-MM-dd'), action: 'Demand notice', officer: 'Admin', notes: 'Formal notice issued' },
    { date: formatDate(subMonths(new Date(), 6), 'yyyy-MM-dd'), action: 'Tax due', officer: 'System', notes: 'Annual tax became due' },
  ], []);

  const handleAction = (action: string) => {
    addActivity(property.id, property.plotNumber, action);
    showToast(`${action} for ${property.plotNumber}`);
  };

  const handleMarkPaid = () => {
    setProperties(prev => prev.map(p =>
      p.id === property.id
        ? { ...p, status: 'paid' as const, enforcementStage: 'resolved', principalOwed: 0 }
        : p
    ));
    addActivity(property.id, property.plotNumber, 'Marked as paid');
    showToast(`Property ${property.plotNumber} marked as paid`);
    onClose();
  };

  const monthsOverdueData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= penalty.monthsOverdue; i++) {
      const interest = property.annualTaxDue * 0.02 * i;
      data.push({
        month: i,
        total: Math.round(property.annualTaxDue + interest),
      });
    }
    return data;
  }, [property, penalty.monthsOverdue]);

  const maxTotal = Math.max(...monthsOverdueData.map(d => d.total), 1);

  return (
    <>
    {showRentModal && (
      <RentInterceptionModal
        property={property}
        settings={settings}
        onClose={() => setShowRentModal(false)}
        onServed={() => addActivity(property.id, property.plotNumber, 'Rent interception notice marked as served')}
        showToast={showToast}
      />
    )}
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 h-full overflow-y-auto animate-slideIn">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">{property.plotNumber}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{property.ownerName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['overview', 'history', 'timeline', 'activity'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize ${
                tab === t ? 'border-b-2 border-[#C8102E] text-[#C8102E]' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t === 'timeline' ? 'Penalty Timeline' : t}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Owner</p>
                  <p className="font-medium">{property.ownerName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{property.ownerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                  <p className="font-medium">{property.district}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{property.subCounty}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">GPS Coordinates</p>
                  <p className="text-sm font-mono">{property.lat.toFixed(4)}, {property.lng.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Property Type</p>
                  <p className="font-medium">{property.propertyType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Land Title Number</p>
                  <p className="font-medium">{property.landTitleNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Annual Tax Due</p>
                  <p className="font-medium">{formatCurrency(property.annualTaxDue)}</p>
                </div>
              </div>

              <hr />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Principal Owed</p>
                  <p className="font-bold text-lg">{formatCurrency(property.principalOwed)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Interest Accrued</p>
                  <p className="font-bold text-lg text-orange-600">{formatCurrency(penalty.interest)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Owed</p>
                  <p className="font-bold text-2xl text-red-600">{formatCurrency(penalty.totalOwed)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Daily Interest</p>
                  <p className="font-bold text-orange-600">{formatCurrency(penalty.dailyInterest)} per day</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tax Clearance Status</p>
                  {property.status === 'paid' ? (
                    <span className="bg-green-100 text-green-700 font-bold px-4 py-2 rounded-lg inline-block">CLEAR</span>
                  ) : (
                    <span className="bg-red-100 text-red-700 font-bold px-4 py-2 rounded-lg inline-block">BLOCKED</span>
                  )}
                </div>
              </div>

              <hr />

              <div className="space-y-2">
                <button
                  onClick={() => handleAction('Demand notice generated')}
                  disabled={isActionDisabled}
                  className="w-full bg-[#C8102E] text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <FileText size={18} className="inline mr-2" />
                  Generate Demand Notice
                </button>
                <button
                  onClick={() => setShowRentModal(true)}
                  disabled={isActionDisabled}
                  className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <AlertTriangle size={18} className="inline mr-2" />
                  Generate Rent Interception Notice
                </button>
                <button
                  onClick={() => handleAction('Flagged for legal action')}
                  disabled={isActionDisabled}
                  className="w-full bg-red-800 text-white py-2 rounded-lg hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <Scale size={18} className="inline mr-2" />
                  Flag for Legal Action
                </button>
                <button
                  disabled={property.status !== 'paid' || isActionDisabled}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={property.status !== 'paid' ? 'Clear arrears first' : isActionDisabled ? 'Contact Admin' : ''}
                >
                  <CheckCircle size={18} className="inline mr-2" />
                  Issue Tax Clearance Certificate
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={isActionDisabled}
                  className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isActionDisabled ? 'Contact Admin to perform actions' : ''}
                >
                  <Check size={18} className="inline mr-2" />
                  Mark as Paid
                </button>
              </div>
            </>
          )}

          {tab === 'history' && (
            <table className="w-full text-sm">
              <thead className="bg-[#C8102E] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Year</th>
                  <th className="px-3 py-2 text-right">Tax Due</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {taxHistory.map((h) => (
                  <tr key={h.year}>
                    <td className="px-3 py-2">{h.year}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(h.taxDue)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(h.amountPaid)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded ${h.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'timeline' && (
            <div>
              <h4 className="font-medium mb-4">Interest Growth Since Tax Due Date</h4>
              <svg viewBox="0 0 300 200" className="w-full h-48">
                <line x1="30" y1="170" x2="280" y2="170" stroke="#ccc" />
                <line x1="30" y1="170" x2="30" y2="20" stroke="#ccc" />

                <polyline
                  fill="none"
                  stroke="#C8102E"
                  strokeWidth="2"
                  points={monthsOverdueData.map((d, i) => {
                    const x = 30 + (i * 10);
                    const y = 170 - ((d.total / maxTotal) * 130);
                    return `${x},${y}`;
                  }).join(' ')}
                />

                <polygon
                  fill="#C8102E"
                  fillOpacity="0.1"
                  points={`30,170 ${monthsOverdueData.map((d, i) => {
                    const x = 30 + (i * 10);
                    const y = 170 - ((d.total / maxTotal) * 130);
                    return `${x},${y}`;
                  }).join(' ')} ${30 + (monthsOverdueData.length - 1) * 10},170`}
                />

                <text x="155" y="195" textAnchor="middle" fontSize="12" className="fill-gray-600 dark:fill-gray-400">Months Overdue</text>
              </svg>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                Total growth: {formatCurrency(property.annualTaxDue)} to {formatCurrency(penalty.totalOwed)}
              </p>
            </div>
          )}

          {tab === 'activity' && (
            <table className="w-full text-sm">
              <thead className="bg-[#C8102E] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Officer</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityLog.map((log, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{log.date}</td>
                    <td className="px-3 py-2">{log.action}</td>
                    <td className="px-3 py-2">{log.officer}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
