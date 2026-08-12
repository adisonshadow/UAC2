import { Button, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useFixHeaderPageScroll } from '@/components/FixHeaderPage';
import '../components/ApiServiceSectionNav.css';

export const OUTBOUND_WEBHOOK_SECTION_NAV = [
  { key: 'info', label: '信息' },
  { key: 'request', label: '请求' },
  { key: 'process', label: '处理' },
  { key: 'response', label: '响应' },
] as const;

export type OutboundWebhookSectionKey = (typeof OUTBOUND_WEBHOOK_SECTION_NAV)[number]['key'];

function scrollToSection(key: OutboundWebhookSectionKey, scrollCtx: ReturnType<typeof useFixHeaderPageScroll>) {
  const el = document.getElementById(`outbound-webhook-section-${key}`);
  if (!el) return;
  scrollCtx.scrollToElement(el, 12);
}

const OutboundWebhookSectionNav: React.FC = () => {
  const scrollCtx = useFixHeaderPageScroll();
  const [activeSection, setActiveSection] = useState<OutboundWebhookSectionKey>('info');

  const handleNavClick = useCallback((key: OutboundWebhookSectionKey) => {
    setActiveSection(key);
    scrollToSection(key, scrollCtx);
  }, [scrollCtx]);

  return (
    <Space.Compact className="api-service-section-nav">
      {OUTBOUND_WEBHOOK_SECTION_NAV.map((item) => (
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

export default OutboundWebhookSectionNav;
