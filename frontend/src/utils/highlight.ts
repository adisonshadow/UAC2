import { useEffect, useRef } from 'react';

interface HighlightOptions {
  /** 高亮颜色 */
  highlightColor?: string;
  /** 动画持续时间（毫秒） */
  duration?: number;
  /** 闪烁次数 */
  times?: number;
  /** 动画结束后的回调 */
  onComplete?: () => void;
}

/**
 * 创建一个用于高亮动画的 hook
 * @param id 需要高亮的元素 ID
 * @param options 配置选项
 */
export const useHighlight = (id: string, options: HighlightOptions = {}) => {
  const {
    highlightColor = '#fffbe6',
    duration = 2000,
    times = 5,
    onComplete,
  } = options;

  const animationRef = useRef<number | undefined>(undefined);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 查找目标元素
    elementRef.current = document.getElementById(id);
    if (!elementRef.current) return;

    const element = elementRef.current;
    const originalBackground = element.style.backgroundColor;
    let currentTimes = 0;

    // 创建动画
    const animate = () => {
      if (currentTimes >= times * 2) {
        element.style.backgroundColor = originalBackground;
        onComplete?.();
        return;
      }

      element.style.backgroundColor = currentTimes % 2 === 0 ? highlightColor : originalBackground;
      currentTimes++;

      animationRef.current = window.setTimeout(animate, duration / (times * 2));
    };

    // 开始动画
    animate();

    // 清理函数
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      if (element) {
        element.style.backgroundColor = originalBackground;
      }
    };
  }, [id, highlightColor, duration, times, onComplete]);
};

/**
 * 为表格行添加高亮动画
 * @param rowId 行的唯一标识
 * @param options 配置选项
 */
export const highlightTableRow = (rowId: string, options: HighlightOptions = {}) => {
  const element = document.getElementById(rowId);
  if (!element) return;

  const {
    highlightColor = '#fffbe6',
    duration = 2000,
    times = 3,
    onComplete,
  } = options;

  const originalBackground = element.style.backgroundColor;
  let currentTimes = 0;

  const animate = () => {
    if (currentTimes >= times * 2) {
      element.style.backgroundColor = originalBackground;
      onComplete?.();
      return;
    }

    element.style.backgroundColor = currentTimes % 2 === 0 ? highlightColor : originalBackground;
    currentTimes++;

    setTimeout(animate, duration / (times * 2));
  };

  animate();
}; 