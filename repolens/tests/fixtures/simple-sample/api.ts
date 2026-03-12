import { fetchUser } from './service';

export async function getUserProfile(userId: string): Promise<{ id: string; name: string }> {
  return fetchUser(userId);
}