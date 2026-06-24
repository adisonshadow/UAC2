import { AIChatDisplay } from '@euac/ai-base';
import { Outlet } from 'react-router-dom';

/** 路由 wrapper：当前路由树下不挂载 AI Chat（等价于 README 中的 AIChatDisplay mode="hidden"） */
export default function AIChatHidden() {
  return (
    <AIChatDisplay mode="hidden">
      <Outlet />
    </AIChatDisplay>
  );
}
