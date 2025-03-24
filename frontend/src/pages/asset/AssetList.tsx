import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Modal, message, Form, Input, Select, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../../services/assetService';
import { Asset, AssetCreate, AssetUpdate } from '../../types/asset';

const { Option } = Select;

const AssetList: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentAsset, setCurrentAsset] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 资产类型选项
  const assetTypes = ['服务器', 'Web应用', '数据库', '网络设备', '其他'];
  
  // 网络类型选项
  const networkTypes = ['内网', '外网', 'DMZ', '未知'];
  
  // 重要性等级选项
  const importanceLevels = ['高', '中', '低'];

  // 加载资产列表
  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await getAssets();
      setAssets(data);
    } catch (error) {
      message.error('加载资产列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  // 打开创建资产表单
  const showCreateModal = () => {
    setCurrentAsset(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑资产表单
  const showEditModal = (asset: Asset) => {
    setCurrentAsset(asset);
    form.setFieldsValue({
      name: asset.name,
      address: asset.address,
      type: asset.type,
      responsible_person: asset.responsible_person,
      department: asset.department,
      asset_group: asset.asset_group,
      source: asset.source,
      network_type: asset.network_type,
      importance_level: asset.importance_level,
      business_system: asset.business_system,
      business_impact: asset.business_impact,
      exposure: asset.exposure
    });
    setModalVisible(true);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentAsset) {
        // 更新资产
        const updated = await updateAsset(currentAsset.id, values as AssetUpdate);
        if (updated) {
          message.success('资产更新成功');
          setModalVisible(false);
          loadAssets();
        }
      } else {
        // 创建资产
        const created = await createAsset(values as AssetCreate);
        if (created) {
          message.success('资产创建成功');
          setModalVisible(false);
          loadAssets();
        }
      }
    } catch (error) {
      console.error('表单提交错误', error);
    }
  };

  // 处理删除资产
  const handleDelete = async (id: number) => {
    try {
      const success = await deleteAsset(id);
      if (success) {
        message.success('资产删除成功');
        loadAssets();
      } else {
        message.error('资产删除失败');
      }
    } catch (error) {
      message.error('删除操作发生错误');
      console.error(error);
    }
  };

  // 生成漏洞等级标签
  const renderVulnerabilityTags = (summary: Record<string, number>) => {
    return (
      <Space>
        {summary['高'] > 0 && <Tag color="red">高: {summary['高']}</Tag>}
        {summary['中'] > 0 && <Tag color="orange">中: {summary['中']}</Tag>}
        {summary['低'] > 0 && <Tag color="green">低: {summary['低']}</Tag>}
        {!(summary['高'] > 0 || summary['中'] > 0 || summary['低'] > 0) && <Tag color="default">无</Tag>}
      </Space>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60
    },
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Asset) => (
        <a onClick={() => navigate(`/assets/${record.id}`)}>{text}</a>
      )
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      key: 'department',
      width: 120
    },
    {
      title: '负责人',
      dataIndex: 'responsible_person',
      key: 'responsible_person',
      width: 100
    },
    {
      title: '网络类型',
      dataIndex: 'network_type',
      key: 'network_type',
      width: 100
    },
    {
      title: '重要性',
      dataIndex: 'importance_level',
      key: 'importance_level',
      width: 80,
      render: (level: string) => {
        const color = level === '高' ? 'red' : level === '中' ? 'orange' : 'green';
        return <Tag color={color}>{level || '未知'}</Tag>;
      }
    },
    {
      title: '漏洞统计',
      dataIndex: 'vulnerabilities_summary',
      key: 'vulnerabilities_summary',
      width: 160,
      render: (summary: Record<string, number>) => renderVulnerabilityTags(summary)
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Asset) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => showEditModal(record)}
          />
          <Popconfirm
            title="确定要删除这个资产吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="资产管理" 
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal}>
            添加资产
          </Button>
        }
      >
        <Table 
          dataSource={assets} 
          columns={columns} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 资产表单模态框 */}
      <Modal
        title={currentAsset ? '编辑资产' : '添加资产'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>

          <Form.Item
            name="address"
            label="资产地址"
            rules={[{ required: true, message: '请输入资产地址' }]}
          >
            <Input placeholder="请输入IP地址、域名或URL" />
          </Form.Item>

          <Form.Item
            name="type"
            label="资产类型"
            rules={[{ required: true, message: '请选择资产类型' }]}
          >
            <Select placeholder="请选择资产类型">
              {assetTypes.map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="responsible_person"
              label="负责人"
              style={{ flex: 1 }}
            >
              <Input placeholder="请输入负责人姓名" />
            </Form.Item>

            <Form.Item
              name="department"
              label="所属部门"
              style={{ flex: 1 }}
            >
              <Input placeholder="请输入所属部门" />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="asset_group"
              label="资产组"
              style={{ flex: 1 }}
            >
              <Input placeholder="请输入资产组" />
            </Form.Item>

            <Form.Item
              name="source"
              label="资产来源"
              style={{ flex: 1 }}
            >
              <Input placeholder="例如：扫描发现、手动添加" />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="network_type"
              label="网络类型"
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择网络类型">
                {networkTypes.map(type => (
                  <Option key={type} value={type}>{type}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="importance_level"
              label="重要性等级"
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择重要性等级">
                {importanceLevels.map(level => (
                  <Option key={level} value={level}>{level}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              name="business_system"
              label="所属业务系统"
              style={{ flex: 1 }}
            >
              <Input placeholder="请输入所属业务系统" />
            </Form.Item>

            <Form.Item
              name="exposure"
              label="暴露面"
              style={{ flex: 1 }}
            >
              <Input placeholder="例如：公网可访问、内网可访问" />
            </Form.Item>
          </div>

          <Form.Item
            name="business_impact"
            label="业务影响"
          >
            <Input.TextArea placeholder="请描述该资产对业务的影响" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetList; 