export async function authService(userId: string): Promise<{ token: string }> {
  return {
    token: `token-${userId}`,
  };
}