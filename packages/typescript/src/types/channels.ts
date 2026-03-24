import type { ChannelType } from './common.js';

export interface PaymentWalletChannel {
  id: string;
  tenantId: string;
  category: 'PAYMENT_WALLET';
  type: ChannelType;
  shortcode: string;
  name: string;
  accountNumber: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateChannelRequest {
  type: 'PAYBILL' | 'TILL' | 'SHORTCODE';
  shortcode: string;
  name: string;
  accountNumber?: string;
  isDefault?: boolean;
}

export interface UpdateChannelRequest {
  type?: 'PAYBILL' | 'TILL' | 'SHORTCODE';
  shortcode?: string;
  name?: string;
  accountNumber?: string;
  isDefault?: boolean;
}
