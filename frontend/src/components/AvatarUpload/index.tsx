import React from 'react';
import StorageImageUpload from '@/components/StorageImageUpload';

const AVATAR_MAX_EDGE = 168;

interface AvatarUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  disabled?: boolean;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ value, onChange, disabled }) => {
  if (disabled) {
    return null;
  }
  return (
    <StorageImageUpload
      value={value}
      onChange={onChange}
      maxEdge={AVATAR_MAX_EDGE}
      uploadLabel="上传"
    />
  );
};

export default AvatarUpload;
