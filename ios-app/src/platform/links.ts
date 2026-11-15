import { Linking, Share } from 'react-native';
import { emailUrl, externalUrl, phoneUrl } from './links-model';

export async function openExternal(url: string): Promise<void> { await Linking.openURL(externalUrl(url)); }
export async function openPhone(number: string): Promise<void> { await Linking.openURL(phoneUrl(number)); }
export async function openEmail(address: string): Promise<void> { await Linking.openURL(emailUrl(address)); }
export async function shareText(message: string, url?: string): Promise<void> {
  await Share.share({ message, ...(url ? { url: externalUrl(url) } : {}) });
}
