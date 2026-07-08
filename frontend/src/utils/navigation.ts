import type { NavigateFunction } from 'react-router-dom';

let navigateRef: NavigateFunction | null = null;

export function setNavigate(navigate: NavigateFunction) {
  navigateRef = navigate;
}

export const history = {
  push(to: string, state?: unknown) {
    navigateRef?.(to, { state });
  },
  replace(to: string, state?: unknown) {
    navigateRef?.(to, { replace: true, state });
  },
  back() {
    window.history.back();
  },
};
