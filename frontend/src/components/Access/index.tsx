import type { ReactNode } from 'react';
import { useInitialState } from '@/providers/InitialStateProvider';

export function useAccess() {
  const { initialState } = useInitialState();
  const canSeeAdmin = !!(initialState && initialState.name !== 'dontHaveAccess');
  return { canSeeAdmin };
}

export function Access({
  accessible,
  children,
  fallback = null,
}: {
  accessible?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!accessible) return <>{fallback}</>;
  return <>{children}</>;
}
