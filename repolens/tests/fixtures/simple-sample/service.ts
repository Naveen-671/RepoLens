export async function fetchUser(userId: string): Promise<{ id: string; name: string }> {
  return {
    id: userId,
    name: 'Sample User',
  };
}