/**
 * API base URL — empty in dev (Vite proxy handles it),
 * set to the Render backend URL in production via VITE_API_URL.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
