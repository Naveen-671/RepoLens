import { authService } from './services/authService';

export async function loginUser(userId: string): Promise<{ token: string }> {
  return authService(userId);
}

export function logoutUser(): string {
  return 'logged-out';
}