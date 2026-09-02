import { Button, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useFixHeaderPageScroll } from '@/components/FixHeaderPage';
import '../components/ApiServiceSectionNav.css';

export const HOOK_SECTION_NAV = [
  { key: 'info', label: '基础' },
  { key: 'trigger', label: '触发' },
  { key: 'action', label: '动作' },
  { key: 'policy', label: '失败策略' },
  { key: 'test', label: '测试' },
] as const;

export type HookSectionKey = (typeof HOOK_SECTION_NAV)[number]['key'];

function scrollToSection(key: HookSectionKey, scrollCtx: ReturnType<typeof useFixHeaderPageScroll>) {
  const el = document.getElementById(`hook-section-${key}`);
  if (!el) return;
  scrollCtx.scrollToElement(el, 12);
}

const HookSectionNav: React.FC = () => {
  const scrollCtx = useFixHeaderPageScroll();
  const [activeSection, setActiveSection] = useState<HookSectionKey>('info');

  const handleNavClick = useCallback((key: HookSectionKey) => {
    setActiveSection(key);
    scrollToSection(key, scrollCtx);
  }, [scrollCtx]);

  return (
    <Space.Compact className="api-service-section-nav">
      {HOOK_SECTION_NAV.map((item) => (
        <Button
          key={item.key}
          type={activeSection === item.key ? 'primary' : 'default'}
          onClick={() => handleNavClick(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </Space.Compact>
  );
};

export default HookSectionNav;
