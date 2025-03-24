import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Descriptions, Button, Tabs, Table, Tag, Space, message, Skeleton, Empty, Typography, Spin, Modal, Form, Input, Select } from 'antd';
import { RollbackOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getAssetById, deleteAsset, updateAsset } from '../../services/assetService';
import { Asset, AssetComponent, AssetPort, AssetUpdate } from '../../types/asset';
import vulnerabilityService from '../../services/vulnerabilityService';

const { TabPane } = Tabs;
const { Title } = Typography;
const { Option } = Select;

interface VulnerabilityItem {
  id: number;
  name: string;
  risk_level: string;
  status: string;
  discovery_date: string;
}

const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityItem[]>([]);
  const [vulnerabilitiesLoading, setVulnerabilitiesLoading] = useState<boolean>(false);
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  // 资产类型选项
  const assetTypes = ['服务器', 'Web应用', '数据库', '网络设备', '其他'];
  
  // 网络类型选项
  const networkTypes = ['内网', '外网', 'DMZ', '未知'];
  
  // 重要性等级选项
  const importanceLevels = ['高', '中', '低'];

  useEffect(() => {
    const loadAssetDetail = async () => {
      if (id) {
        setLoading(true);
        try {
          const data = await getAssetById(parseInt(id));
          if (data) {
            setAsset(data);
            // 加载资产后，立即加载关联漏洞
            loadAssetVulnerabilities(parseInt(id));
          } else {
            message.error('无法找到该资产');
            navigate('/assets');
          }
        } catch (error) {
          console.error('获取资产详情失败', error);
          message.error('获取资产详情失败');
        } finally {
          setLoading(false);
        }
      }
    };

    loadAssetDetail();
  }, [id, navigate]);

  // 加载资产关联的漏洞
  const loadAssetVulnerabilities = async (assetId: number) => {
    setVulnerabilitiesLoading(true);
    try {
      console.log(`开始加载资产ID: ${assetId} 的关联漏洞`);
      
      // 通过资产ID查询关联的漏洞
      // 修改参数名称为affected_asset_id，与后端API保持一致
      const response = await vulnerabilityService.getVulnerabilities({ affected_asset_id: assetId });
      
      console.log(`获取资产ID: ${assetId} 的关联漏洞响应:`, response);
      
      if (Array.isArray(response)) {
        // 转换为所需格式
        const vulnerabilityItems: VulnerabilityItem[] = response.map(vuln => ({
          id: vuln.id,
          name: vuln.name,
          risk_level: vuln.risk_level,
          status: vuln.status,
          discovery_date: vuln.discovery_date
        }));
        
        console.log(`共找到 ${vulnerabilityItems.length} 个关联漏洞`);
        console.log(`资产漏洞统计: `, asset?.vulnerabilities_summary);
        
        setVulnerabilities(vulnerabilityItems);
      } else {
        console.error('获取漏洞数据格式不正确', response);
        setVulnerabilities([]);
      }
    } catch (error) {
      console.error(`获取资产 ID: ${assetId} 关联的漏洞失败`, error);
      message.error('加载关联漏洞失败');
      setVulnerabilities([]);
    } finally {
      setVulnerabilitiesLoading(false);
    }
  };

  // 处理删除资产
  const handleDelete = async () => {
    if (!asset) return;
    
    try {
      const success = await deleteAsset(asset.id);
      if (success) {
        message.success('资产删除成功');
        navigate('/assets');
      } else {
        message.error('资产删除失败');
      }
    } catch (error) {
      message.error('删除操作发生错误');
      console.error(error);
    }
  };

  // 组件表格列
  const componentColumns = [
    {
      title: '组件名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version'
    }
  ];

  // 端口表格列
  const portColumns = [
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port'
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol'
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'open' ? 'green' : 'red'}>{status}</Tag>
      )
    },
    {
      title: '关联组件',
      dataIndex: 'component',
      key: 'component'
    }
  ];

  // 漏洞表格列
  const vulnerabilityColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60
    },
    {
      title: '漏洞名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: VulnerabilityItem) => (
        <Link to={`/vulnerabilities/${record.id}`}>{text}</Link>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: string) => {
        const color = level === '高' ? 'red' : level === '中' ? 'orange' : 'green';
        return <Tag color={color}>{level}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = 
          status === '待修复' ? 'red' : 
          status === '修复中' ? 'orange' : 
          status === '已修复' ? 'green' : 
          status === '已验证' ? 'blue' : 'default';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: '发现时间',
      dataIndex: 'discovery_date',
      key: 'discovery_date',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    }
  ];

  // 打开编辑模态框
  const showEditModal = () => {
    if (!asset) return;
    
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
    
    setEditModalVisible(true);
  };

  // 处理资产编辑提交
  const handleEditSubmit = async () => {
    if (!asset || !id) return;
    
    try {
      const values = await form.validateFields();
      setEditLoading(true);
      
      const assetId = parseInt(id);
      const updatedAsset = await updateAsset(assetId, values as AssetUpdate);
      
      if (updatedAsset) {
        message.success('资产更新成功');
        setAsset(updatedAsset); // 更新当前显示的资产数据
        setEditModalVisible(false);
      } else {
        message.error('资产更新失败');
      }
    } catch (error) {
      console.error('更新资产失败', error);
      message.error('表单验证失败或更新过程出错');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Skeleton active />
      </Card>
    );
  }

  if (!asset) {
    return (
      <Card>
        <Empty description="未找到资产信息" />
      </Card>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<RollbackOutlined />} onClick={() => navigate('/assets')}>
          返回列表
        </Button>
        <Button icon={<EditOutlined />} onClick={showEditModal}>
          编辑资产
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
          删除资产
        </Button>
      </Space>

      <Card>
        <Title level={4}>{asset.name}</Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="资产ID">{asset.id}</Descriptions.Item>
          <Descriptions.Item label="资产地址">{asset.address}</Descriptions.Item>
          <Descriptions.Item label="资产类型">{asset.type}</Descriptions.Item>
          <Descriptions.Item label="负责人">{asset.responsible_person || '未指定'}</Descriptions.Item>
          <Descriptions.Item label="所属部门">{asset.department || '未指定'}</Descriptions.Item>
          <Descriptions.Item label="资产组">{asset.asset_group || '未分组'}</Descriptions.Item>
          <Descriptions.Item label="网络类型">{asset.network_type || '未知'}</Descriptions.Item>
          <Descriptions.Item label="重要性等级">
            <Tag color={
              asset.importance_level === '高' ? 'red' : 
              asset.importance_level === '中' ? 'orange' : 'green'
            }>
              {asset.importance_level || '未定义'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="资产来源">{asset.source || '未知'}</Descriptions.Item>
          <Descriptions.Item label="暴露面">{asset.exposure || '未知'}</Descriptions.Item>
          <Descriptions.Item label="所属业务系统">{asset.business_system || '未指定'}</Descriptions.Item>
          <Descriptions.Item label="漏洞统计">
            <Space>
              {asset.vulnerabilities_summary['高'] > 0 && <Tag color="red">高: {asset.vulnerabilities_summary['高']}</Tag>}
              {asset.vulnerabilities_summary['中'] > 0 && <Tag color="orange">中: {asset.vulnerabilities_summary['中']}</Tag>}
              {asset.vulnerabilities_summary['低'] > 0 && <Tag color="green">低: {asset.vulnerabilities_summary['低']}</Tag>}
              {!(asset.vulnerabilities_summary['高'] > 0 || asset.vulnerabilities_summary['中'] > 0 || asset.vulnerabilities_summary['低'] > 0) && <Tag color="default">无</Tag>}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="发现时间" span={2}>
            {new Date(asset.discovery_date).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="最后更新时间" span={2}>
            {asset.update_date ? new Date(asset.update_date).toLocaleString() : '无更新记录'}
          </Descriptions.Item>
          <Descriptions.Item label="业务影响" span={2}>
            {asset.business_impact || '未定义'}
          </Descriptions.Item>
        </Descriptions>

        <Tabs defaultActiveKey="components" style={{ marginTop: 20 }}>
          <TabPane tab="组件信息" key="components">
            <Table 
              dataSource={asset.components} 
              columns={componentColumns} 
              rowKey={(record, index) => `component-${index}`}
              pagination={false}
              locale={{ emptyText: '暂无组件信息' }}
            />
          </TabPane>
          <TabPane tab="端口信息" key="ports">
            <Table 
              dataSource={asset.ports} 
              columns={portColumns} 
              rowKey={(record, index) => `port-${index}`}
              pagination={false}
              locale={{ emptyText: '暂无端口信息' }}
            />
          </TabPane>
          <TabPane tab="关联漏洞" key="vulnerabilities">
            {vulnerabilitiesLoading ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <Spin tip="加载漏洞数据..." />
              </div>
            ) : vulnerabilities.length > 0 ? (
              <Table 
                dataSource={vulnerabilities} 
                columns={vulnerabilityColumns} 
                rowKey="id"
                pagination={{ pageSize: 5 }}
              />
            ) : (
              <Empty description="暂无关联漏洞" />
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* 编辑资产模态框 */}
      <Modal
        title="编辑资产"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalVisible(false)}
        confirmLoading={editLoading}
        width={720}
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

export default AssetDetail; 