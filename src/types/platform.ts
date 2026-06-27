export type UserRole = 'superAdmin' | 'admin' | 'district_officer' | 'legal' | 'viewer';

export interface AppUser {
  id: number;
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  district: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  lastLogin: string | null;
}

export interface RoleChangeLog {
  id: number;
  changedBy: string;
  targetUser: string;
  previousRole: UserRole;
  newRole: UserRole;
  timestamp: string;
}

export interface PlatformSettings {
  authorityName: string;
  districtName: string;
  revenueOfficeContact: string;
  bankAccountDetails: string;
  officialStampText: string;
}

export interface EscalationLogEntry {
  id: number;
  date: string;
  property: string;
  ruleTriggered: string;
  actionTaken: string;
  mode: 'Auto' | 'Manual';
}

export interface DemoUsageLog {
  id: number;
  user: string;
  role: UserRole;
  timestamp: string;
  action: 'enabled' | 'disabled' | 'reset';
}

export interface ChatMessage {
  id: number;
  sender: string;
  message: string;
  timestamp: string;
}

export interface SharedDocument {
  id: number;
  filename: string;
  uploadedBy: string;
  date: string;
  size: string;
  data: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  postedBy: string;
  date: string;
  priority: 'Normal' | 'Urgent' | 'Critical';
  pinned?: boolean;
}

export interface BookedMeeting {
  id: number;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  platform: 'Zoom Meeting' | 'Google Meet' | 'Microsoft Teams' | 'In-Person';
  locationNotes: string;
  link: string;
  bookedBy: string;
  cancelled?: boolean;
}

export interface ShareHistoryItem {
  id: number;
  title: string;
  messagePreview: string;
  channels: string[];
  date: string;
  sharedBy: string;
  audience: string;
}

export interface AutoEscalationRule {
  id: number;
  label: string;
  description: string;
  enabled: boolean;
  district: string;
}

export const DISTRICTS = ['Kampala', 'Wakiso', 'Mukono', 'Gulu', 'Mbarara', 'DEMO-Central', 'DEMO-North', 'Training-District'];

export const ROLE_LABELS: Record<UserRole, string> = {
  superAdmin: 'Super Admin',
  admin: 'Admin',
  district_officer: 'District Officer',
  legal: 'Legal Officer',
  viewer: 'Viewer',
};
