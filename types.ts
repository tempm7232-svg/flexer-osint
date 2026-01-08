export interface UserProfile {
  uid: string;
  email: string;
  isAdmin: boolean;
  isOwner?: boolean;
  isApproved: boolean;
  lastSessionId: string;
  pendingSessionId?: string | null;
  pendingSessionMetadata?: {
    deviceName: string;
    timestamp: number;
  } | null;
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