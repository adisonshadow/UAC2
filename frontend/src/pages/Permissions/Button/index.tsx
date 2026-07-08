import React from 'react';
import PermissionTable from '../components/PermissionTable';
import { RESOURCE_TYPES } from '../constants';
import type { ResourceType } from '../types';

const ButtonPermissionPage: React.FC = () => {
  const resourceType: ResourceType = 'BUTTON';
  const { actions } = RESOURCE_TYPES[resourceType];

  return (
    <PermissionTable
      resourceType={resourceType}
      allowedActions={actions}
      title={RESOURCE_TYPES[resourceType].label}
    />
  );
};

export default ButtonPermissionPage; 