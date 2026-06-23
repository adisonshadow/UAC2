import { DefaultFooter } from '@ant-design/pro-components';
import Settings from '@/../config/defaultSettings';
import React from 'react';

const Footer: React.FC = () => {
  return (
    <DefaultFooter
      style={{
        background: 'none',
      }}
      copyright={`${new Date().getFullYear()} ${Settings.title} 版权所有`}
      links={[
        // {
        //   key: 'Ant Design Pro',
        //   title: 'Ant Design Pro',
        //   href: 'https://pro.ant.design',
        //   blankTarget: true,
        // },
      ]}
    />
  );
};

export default Footer;
