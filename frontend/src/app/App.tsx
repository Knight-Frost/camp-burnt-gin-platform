import { RouterProvider } from 'react-router-dom';
import { router } from '@/core/routing';
import { useAuthInit } from '@/features/auth/hooks';

export function App() {
  // Initialize authentication state on app startup
  useAuthInit();

  return <RouterProvider router={router} />;
}
