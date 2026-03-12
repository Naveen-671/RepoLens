import { getUserProfile } from './api';

export async function renderProfile(userId: string): Promise<string> {
  const profile = await getUserProfile(userId);
  return `User: ${profile.name}`;
}