import React from 'react';
import StorageImageUpload from '@/components/StorageImageUpload';
import { SYSTEM_STORAGE_BUCKET_CODE } from '@/constants/storage';
import { LOGO_MAX_EDGE } from '@/utils/prepareLogoUploadFile';

interface ApplicationLogoUploadProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const ApplicationLogoUpload: React.FC<ApplicationLogoUploadProps> = (props) => (
  <StorageImageUpload
    {...props}
    maxEdge={LOGO_MAX_EDGE}
    uploadLabel="上传 Logo"
    hint={`位图先裁剪再上传，长边超过 ${LOGO_MAX_EDGE}px 会自动压缩；PNG 保留透明通道；SVG 不裁剪。存储于「${SYSTEM_STORAGE_BUCKET_CODE}」`}
  />
);

export default ApplicationLogoUpload;
