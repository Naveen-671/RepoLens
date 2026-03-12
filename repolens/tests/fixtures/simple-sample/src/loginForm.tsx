import { loginUser } from './authController';

export async function submitLogin(userId: string): Promise<string> {
  const user = await loginUser(userId);
  return user.token;
}