import { Button, Card, Space, Switch, Table, Typography } from 'antd';
import { message } from '@/utils/antdAppApis';
import React, { useCallback, useEffect, useState } from 'react';
import {
  getSystemBackups,
  getSystemFeatures,
  postSystemBackupRun,
  putSystemFeatures,
} from '@/services/UAC/api/system';
import { useInitialState } from '@/providers/InitialStateProvider';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const MetadataSettingsTab: React.FC = () => {
  const { initialState, setInitialState } = useInitialState();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadataEnabled, setMetadataEnabled] = useState(
    initialState?.systemFeatures?.metadataEnabled ?? false,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSystemFeatures();
      if (isApiSuccess(res)) {
        const data = getApiData<API.SystemFeatures>(res);
        setMetadataEnabled(Boolean(data?.metadataEnabled));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (checked: boolean) => {
    setSaving(true);
    try {
      const res = await putSystemFeatures({ metadataEnabled: checked });
      if (isApiSuccess(res)) {
        const data = getApiData<API.SystemFeatures>(res);
        setMetadataEnabled(Boolean(data?.metadataEnabled));
        setInitialState((prev) =>
          prev
            ? {
                ...prev,
                systemFeatures: { ...prev.systemFeatures, metadataEnabled: Boolean(data?.metadataEnabled) },
              }
            : prev,
        );
        message.success('已保存');
      } else {
        message.error(res.message || '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card loading={loading}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Typography.Text strong>应用元数据</Typography.Text>
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              开启后，业务数据菜单将显示「数据标准」与「元数据」，并可在模型/指标/枚举中编辑元数据
            </div>
          </div>
          <Switch
            checked={metadataEnabled}
            loading={saving}
            onChange={(checked) => void handleSave(checked)}
          />
        </div>
      </Space>
    </Card>
  );
};

export const ApiServiceSettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [allowWriteOperations, setAllowWriteOperations] = useState(false);
  const [testAutoRollback, setTestAutoRollback] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSystemFeatures();
      if (isApiSuccess(res)) {
        const data = getApiData<API.SystemFeatures>(res);
        setAllowWriteOperations(Boolean(data?.apiServiceAllowWriteOperations));
        setTestAutoRollback(data?.apiServiceTestAutoRollback !== false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (
    key: 'apiServiceAllowWriteOperations' | 'apiServiceTestAutoRollback',
    checked: boolean,
  ) => {
    setSavingKey(key);
    try {
      const res = await putSystemFeatures({ [key]: checked });
      if (isApiSuccess(res)) {
        const data = getApiData<API.SystemFeatures>(res);
        setAllowWriteOperations(Boolean(data?.apiServiceAllowWriteOperations));
        setTestAutoRollback(data?.apiServiceTestAutoRollback !== false);
        message.success('已保存');
      } else {
        message.error(res.message || '保存失败');
      }
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card loading={loading}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Typography.Text strong>API 测试中允许写操作</Typography.Text>
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              仅作用于 API 服务测试页的「执行测试」，不影响已发布 API 的线上调用。
              <br />
              开启：测试页可对 create / update / delete 等写操作真实执行 SQL（含未绑定实体表的自定义 SQL 服务）。
              <br />
              关闭：上述写操作在测试页仅校验参数结构，不执行 SQL。
            </div>
          </div>
          <Switch
            checked={allowWriteOperations}
            loading={savingKey === 'apiServiceAllowWriteOperations'}
            onChange={(checked) => void handleSave('apiServiceAllowWriteOperations', checked)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Typography.Text strong>API 测试中写操作自动回滚</Typography.Text>
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
              仅当「API 测试中允许写操作」已开启时生效；同样只影响测试页，不影响已发布 API。
              <br />
              开启（默认）：测试页写操作在事务内执行，结束后自动回滚，测试数据不落库。
              <br />
              关闭：测试页写操作执行后会提交事务，测试数据会写入数据库，请谨慎使用。
            </div>
          </div>
          <Switch
            checked={testAutoRollback}
            disabled={!allowWriteOperations}
            loading={savingKey === 'apiServiceTestAutoRollback'}
            onChange={(checked) => void handleSave('apiServiceTestAutoRollback', checked)}
          />
        </div>
      </Space>
    </Card>
  );
};

export const BackupSettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [backupDir, setBackupDir] = useState('');
  const [items, setItems] = useState<API.SystemBackupItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSystemBackups();
      if (isApiSuccess(res)) {
        const data = getApiData<API.SystemBackupList>(res);
        setBackupDir(data?.backupDir || '');
        setItems(data?.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await postSystemBackupRun();
      if (isApiSuccess(res)) {
        message.success('备份已完成');
        await load();
      } else {
        message.error(res.message || '备份失败');
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card
      loading={loading}
      extra={
        <Button type="primary" loading={running} onClick={() => void handleRun()}>
          立即备份
        </Button>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        备份目录：{backupDir || '-'}
      </Typography.Paragraph>
      <Table
        rowKey="name"
        size="small"
        pagination={false}
        dataSource={items}
        columns={[
          { title: '文件名', dataIndex: 'name' },
          {
            title: '大小',
            dataIndex: 'size',
            width: 100,
            render: (v: number) => formatSize(v),
          },
          {
            title: '时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
          },
        ]}
      />
    </Card>
  );
};
