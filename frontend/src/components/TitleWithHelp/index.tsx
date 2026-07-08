import { QuestionCircleFilled } from '@ant-design/icons';
import { Popover } from 'antd';
import type { PopoverProps } from 'antd';
import React from 'react';

export interface TitleWithHelpProps {
  title: React.ReactNode;
  help: React.ReactNode;
  placement?: PopoverProps['placement'];
}

const TitleWithHelp: React.FC<TitleWithHelpProps> = ({
  title,
  help,
  placement = 'rightTop',
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    {title}
    <Popover content={help} trigger="hover" placement={placement}>
      <QuestionCircleFilled
        style={{ color: 'rgba(0,0,0,0.35)', cursor: 'pointer', fontSize: 14 }}
        onClick={(e) => e.stopPropagation()}
      />
    </Popover>
  </span>
);

export default TitleWithHelp;
