import { AIChatDisplay } from '@eadaf/ai-base';
import AnimatedOutlet from '@/components/AnimatedOutlet';

/** 路由 wrapper：当前路由树下不挂载 AI Chat（等价于 README 中的 AIChatDisplay mode="hidden"） */
export default function AIChatHidden() {
  return (
    <AIChatDisplay mode="hidden">
      <AnimatedOutlet />
    </AIChatDisplay>
  );
}
