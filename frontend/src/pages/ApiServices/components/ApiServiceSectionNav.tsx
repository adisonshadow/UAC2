import { Button, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useFixHeaderPageScroll } from '@/components/FixHeaderPage';
import './ApiServiceSectionNav.css';

export const API_SERVICE_SECTION_NAV = [
  { key: 'info', label: '信息' },
  { key: 'request', label: '请求' },
  { key: 'process', label: '处理' },
  { key: 'response', label: '响应' },
] as const;

export type ApiServiceSectionKey = (typeof API_SERVICE_SECTION_NAV)[number]['key'];

function scrollToSection(key: ApiServiceSectionKey, scrollCtx: ReturnType<typeof useFixHeaderPageScroll>) {
  const el = document.getElementById(`api-service-section-${key}`);
  if (!el) return;
  scrollCtx.scrollToElement(el, 12);
}

const ApiServiceSectionNav: React.FC = () => {
  const scrollCtx = useFixHeaderPageScroll();
  const [activeSection, setActiveSection] = useState<ApiServiceSectionKey>('info');

  const handleNavClick = useCallback((key: ApiServiceSectionKey) => {
    setActiveSection(key);
    scrollToSection(key, scrollCtx);
  }, [scrollCtx]);

  return (
    <Space.Compact className="api-service-section-nav">
      {API_SERVICE_SECTION_NAV.map((item) => (
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

export default ApiServiceSectionNav;
