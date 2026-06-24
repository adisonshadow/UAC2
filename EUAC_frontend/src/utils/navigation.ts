import type { NavigateFunction } from 'react-router-dom';

let navigateRef: NavigateFunction | null = null;

export function setNavigate(navigate: NavigateFunction) {
  navigateRef = navigate;
}

export const history = {
  push(to: string) {
    navigateRef?.(to);
  },
  replace(to: string) {
    navigateRef?.(to, { replace: true });
  },
  back() {
    window.history.back();
  },
};
