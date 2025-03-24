import React from 'react';
import { Button, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAIChat } from '../../context/AIChatContext';
import AIChat from './AIChat';

interface AIChatTriggerProps {
  buttonText?: string;
  tooltipText?: string;
  icon?: React.ReactNode;
  data?: any;
  buttonType?: 'link' | 'text' | 'default' | 'primary' | 'dashed';
  placement?: 'detail' | 'list' | 'header';
  size?: 'small' | 'middle' | 'large';
  forceNewConversation?: boolean;
  initialMessage?: string;
}

const AIChatTrigger: React.FC<AIChatTriggerProps> = ({
  buttonText = 'AI助手',
  tooltipText = '使用AI助手获取更多信息',
  icon = <RobotOutlined />,
  data,
  buttonType = 'primary',
  placement = 'detail',
  size = 'middle',
  forceNewConversation = false,
  initialMessage,
}) => {
  const { openChat, clearMessages, sendVulnerabilityData, addMessage, sendMessage } = useAIChat();

  const handleClick = () => {
    console.log('AI助手按钮被点击');
    console.log('APP_ENV:', process.env.NODE_ENV);
    console.log('API_BASE_URL:', process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api/v1' : '/api/v1');
    
    if (forceNewConversation) {
      console.log('强制创建新会话');
      clearMessages();
    }
    
    // 检查数据类型，确定最合适的处理方式
    // 首先检查是否明确是漏洞数据
    const isVulnerabilityData = data && (
      data.name !== undefined && 
      (data.risk_level !== undefined || data.severity !== undefined) || 
      data.cve_id !== undefined || 
      data.type === 'vulnerability'
    );
    
    console.log('点击AI助手按钮，数据详情:', { 
      hasInitialMessage: !!initialMessage,
      hasData: !!data,
      isVulnerabilityData,
      dataType: data ? typeof data : 'undefined',
      dataContent: data ? JSON.stringify(data).substring(0, 200) : 'none',
      dataKeys: data ? Object.keys(data) : []
    });
    
    // 打开聊天窗口（不传递任何参数，避免重复发消息）
    openChat();
    
    // 等待窗口完全打开后再处理消息发送
    setTimeout(() => {
      try {
        if (isVulnerabilityData) {
          console.log('检测到漏洞数据，准备发送漏洞数据进行分析:', data);
          
          // 确保数据格式正确
          const vulnerabilityData = {
            name: data.name || '未命名漏洞',
            cve_id: data.cve_id || null,
            risk_level: data.risk_level || data.severity || '未知',
            description: data.description || '',
            // 其他可能需要的字段
            status: data.status,
            discovery_date: data.discovery_date,
            affected_assets: data.affected_assets || []
          };
          
          console.log('处理后的漏洞数据:', vulnerabilityData);
          sendVulnerabilityData(vulnerabilityData);
        } else if (initialMessage && typeof initialMessage === 'string') {
          console.log('发送初始消息:', initialMessage);
          addMessage(initialMessage, true);
          sendMessage(initialMessage, data);
        } else if (data) {
          console.log('发送默认消息和数据');
          const defaultMessage = "请提供有关这些数据的分析";
          addMessage(defaultMessage, true);
          sendMessage(defaultMessage, data);
        } else {
          console.log('没有指定初始消息或数据，只打开聊天窗口');
        }
      } catch (error) {
        console.error('在处理聊天请求时出错:', error);
        addMessage(`处理请求时出错: ${error instanceof Error ? error.message : String(error)}`, false);
      }
    }, 500); // 增加延迟时间以确保窗口已打开
  };

  return (
    <>
      <Tooltip title={tooltipText}>
        <Button
          type={buttonType}
          icon={icon}
          onClick={handleClick}
          size={size}
          className={`ai-trigger-${placement}`}
        >
          {buttonText}
        </Button>
      </Tooltip>
      <AIChat />
    </>
  );
};

export default AIChatTrigger; 