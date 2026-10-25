// Shapes returned by the Pushbullet API (v2 + the undocumented bits the
// official web app relies on). Only the fields Pushpilot reads are typed.

export interface User {
  iden: string;
  email: string;
  email_normalized: string;
  name?: string;
  image_url?: string;
  max_upload_size?: number;
  pro?: boolean;
}

export type DeviceIcon = 'desktop' | 'browser' | 'website' | 'laptop' | 'tablet' | 'phone' | 'watch' | 'system';

export interface Device {
  iden: string;
  active: boolean;
  created: number;
  modified: number;
  nickname?: string;
  manufacturer?: string;
  model?: string;
  type?: string;
  kind?: string;
  icon?: DeviceIcon;
  pushable?: boolean;
  has_sms?: boolean;
  has_mms?: boolean;
  app_version?: number;
}

export interface Chat {
  iden: string;
  active: boolean;
  muted?: boolean;
  with: {
    email: string;
    email_normalized: string;
    name?: string;
    image_url?: string;
    type?: 'user' | 'email';
  };
}

export interface Subscription {
  iden: string;
  active: boolean;
  muted?: boolean;
  channel: {
    iden: string;
    tag: string;
    name: string;
    description?: string;
    image_url?: string;
  };
}

export type PushType = 'note' | 'link' | 'file';

export interface Push {
  iden: string;
  active: boolean;
  created: number;
  modified: number;
  type: PushType;
  dismissed: boolean;
  direction: 'self' | 'outgoing' | 'incoming';
  guid?: string;
  title?: string;
  body?: string;
  url?: string;
  file_name?: string;
  file_type?: string;
  file_url?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  sender_iden?: string;
  sender_email_normalized?: string;
  sender_name?: string;
  receiver_iden?: string;
  receiver_email_normalized?: string;
  target_device_iden?: string;
  source_device_iden?: string;
  channel_iden?: string;
}

export interface MirrorAction {
  label: string;
  trigger_key: string;
}

// An Android notification mirrored over the stream, as Pushpilot stores it.
export interface Mirror {
  id: string;
  receivedAt: number;
  created: number;
  title?: string;
  body?: string;
  icon?: string;
  application_name?: string;
  package_name: string;
  notification_id: string;
  notification_tag?: string | null;
  source_device_iden?: string;
  source_user_iden: string;
  dismissible?: boolean;
  conversation_iden?: string;
  actions?: MirrorAction[];
  code?: string;
  dismissed?: boolean;
}

export interface SmsRecipient {
  name?: string;
  address: string;
  number?: string;
  thumbnail?: string;
  image_url?: string;
}

export interface SmsThread {
  id: string;
  recipients: SmsRecipient[];
  latest?: SmsMessage;
}

export interface SmsMessage {
  id: string;
  type?: 'sms' | 'mms';
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  body?: string;
  status?: string;
  guid?: string;
  recipient_index?: number;
  image_urls?: string[];
  pending?: boolean;
}

export interface SmsNotice {
  thread_id: string;
  title: string;
  body: string;
  timestamp: number;
  image_url?: string;
}

// Anything that can receive a push.
export type Target = { kind: 'all' } | { kind: 'device'; iden: string } | { kind: 'person'; email: string };

export type ConnectionState = 'signed-out' | 'connecting' | 'live' | 'offline';
