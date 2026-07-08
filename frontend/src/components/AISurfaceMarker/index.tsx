import type { CSSProperties, ReactNode } from 'react';

export interface AISurfaceMarkerProps {
  surfaceId: string;
  resourceId?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 为关键 UI 区域添加 AI 语义标记（辅助调试与未来扩展，非主数据源） */
export default function AISurfaceMarker({
  surfaceId,
  resourceId,
  children,
  className,
  style,
}: AISurfaceMarkerProps) {
  return (
    <div
      className={className}
      style={style}
      data-ai-surface={surfaceId}
      data-ai-resource-id={resourceId}
    >
      {children}
    </div>
  );
}
