import React from 'react';

const BlankLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div style={{ padding: 24 }}>{children}</div>;
};

export default BlankLayout;