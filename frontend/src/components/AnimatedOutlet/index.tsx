import classNames from 'classnames';
import { Outlet } from 'react-router-dom';
import './index.scss';

interface AnimatedOutletProps {
  className?: string;
}

/**
 * 路由出口。
 * 曾用 framer-motion AnimatePresence mode="wait" + useOutlet，父级（SecurityLayout）
 * 在鉴权时卸载树会导致退出动画无法结束，登录后点导航彻底卡死。改为直接 Outlet。
 */
export default function AnimatedOutlet({ className }: AnimatedOutletProps) {
  return (
    <div className={classNames('eadaf-page-transition', className)}>
      <Outlet />
    </div>
  );
}
