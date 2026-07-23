import { Button, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { useFixHeaderPageScroll } from '@/components/FixHeaderPage';
import './CollectionPipelineSectionNav.css';

export const COLLECTION_PIPELINE_SECTION_NAV = [
  { key: 'info', label: '信息' },
  { key: 'sample', label: '样本' },
  { key: 'scripts', label: '脚本' },
  { key: 'ingest', label: '接口' },
] as const;

export type CollectionPipelineSectionKey = (typeof COLLECTION_PIPELINE_SECTION_NAV)[number]['key'];

function scrollToSection(
  key: CollectionPipelineSectionKey,
  scrollCtx: ReturnType<typeof useFixHeaderPageScroll>,
) {
  const el = document.getElementById(`collection-pipeline-section-${key}`);
  if (!el) return;
  scrollCtx.scrollToElement(el, 12);
}

const CollectionPipelineSectionNav: React.FC = () => {
  const scrollCtx = useFixHeaderPageScroll();
  const [activeSection, setActiveSection] = useState<CollectionPipelineSectionKey>('info');

  const handleNavClick = useCallback((key: CollectionPipelineSectionKey) => {
    setActiveSection(key);
    scrollToSection(key, scrollCtx);
  }, [scrollCtx]);

  return (
    <Space.Compact className="collection-pipeline-section-nav">
      {COLLECTION_PIPELINE_SECTION_NAV.map((item) => (
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

export default CollectionPipelineSectionNav;
