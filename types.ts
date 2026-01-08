export interface SessionMetadata {
  sid: string;
  deviceName: string;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
  isOwner?: boolean;
  isApproved: boolean;
  lastSessionId: string; // Used for standard users (1-device limit)
  authorizedSessions?: SessionMetadata[]; // Used for Admin/Owner (Multi-device management)
  pendingSessionId?: string | null;
  pendingSessionMetadata?: SessionMetadata | null;
}

export interface OSINTTool {
  id: string;
  name: string;
  apiUrl: string;
  description: string;
  icon: string;
  useProxy?: boolean;
}

export interface LookupResult {
  toolId: string;
  timestamp: number;
  data: any;
  status: 'success' | 'error';
}

export const ADMIN_TELEGRAM = "flexer_admin_bot";
export const ROOT_OWNER_EMAIL = "owner@flexer.io"; // Change this to your desired owner email