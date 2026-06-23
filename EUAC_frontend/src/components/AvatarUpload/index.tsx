import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image, message } from 'antd';
import type { GetProp, UploadFile, UploadProps } from 'antd';
import ImgCrop from 'antd-img-crop';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { postUploadsImage } from '@/services/UAC/api/uploads';
import { getImageUrlIfValid } from '@/utils/image';

interface AvatarUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  disabled?: boolean;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({ value, onChange, disabled }) => {
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 监听 value 的变化，更新 fileList
  useEffect(() => {
    const imageUrl = getImageUrlIfValid(value);
    if (imageUrl) {
      setFileList([
        {
          uid: '-1',
          name: 'avatar',
          status: 'done',
          url: imageUrl,
        },
      ]);
    } else {
      setFileList([]);
    }
  }, [value]);

  const imageRef = useRef<HTMLDivElement>(null);

  const handleChange: UploadProps['onChange'] = ({ fileList: newFileList, file }) => {
    // 只保留最新上传的文件
    const latestFile = newFileList[newFileList.length - 1];
    setFileList(latestFile ? [latestFile] : []);
    
    if (file.status === 'done') {
      if (file.response?.code === 200) {
        message.success('上传成功');
        // 从响应中获取图片 ID
        const imageId = file.response.data?.id;
        if (imageId) {
          onChange?.(imageId);
        }
      } else {
        message.error(file.response?.message || '上传失败');
      }
    } else if (file.status === 'error') {
      message.error('上传失败');
    }
  };

  const onPreview = async () => {
    if (imageRef.current) {
      const firstImage = imageRef.current.querySelector('img');
      if (firstImage) {
        firstImage.click();
      }
    }
  };

  const uploadButton = (
    <div>
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>上传</div>
    </div>
  );

  return (
    <div>
      {!disabled && (
        <ImgCrop rotationSlider>
          <Upload
            name="image"
            listType="picture-card"
            fileList={fileList}
            onChange={handleChange}
            onPreview={onPreview}
            maxCount={1}
            customRequest={async ({ file, onSuccess, onError }) => {
              try {
                setLoading(true);
                const response = await postUploadsImage({
                  compress: true,
                  format: 'webp',
                  quality: 90,
                  width: 168,
                  height: 168,
                }, file as File);
                onSuccess?.(response);
              } catch (error: any) {
                onError?.(error);
                message.error(error.message || '上传失败');
              } finally {
                setLoading(false);
              }
            }}
            beforeUpload={(file) => {
              const isImage = file.type.startsWith('image/');
              if (!isImage) {
                message.error('只能上传图片文件！');
              }
              const isLt2M = file.size / 1024 / 1024 < 2;
              if (!isLt2M) {
                message.error('图片大小不能超过 2MB！');
              }
              return isImage && isLt2M;
            }}
          >
            {fileList.length >= 1 ? null : uploadButton}
          </Upload>
        </ImgCrop>
      )}
      {getImageUrlIfValid(value) && (
        <div ref={imageRef} style={{ display: 'none' }}>
          <Image
            src={getImageUrlIfValid(value)}
            alt="avatar"
            preview
          />
        </div>
      )}
    </div>
  );
};

export default AvatarUpload; 