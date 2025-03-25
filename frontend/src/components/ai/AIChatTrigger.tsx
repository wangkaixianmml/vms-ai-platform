import React, { useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAIChat } from '../../context/AIChatContext';
import aiService from '../../services/aiService';

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
  type?: 'analysis' | 'remediation' | 'general';
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
  type = 'general',
}) => {
  const { openChat, clearMessages, addMessage, sendMessage } = useAIChat();
  const [loading, setLoading] = useState(false);

  // 根据type和按钮文本获取初始消息和适当的数据
  const getInitialMessageAndData = async () => {
    if (!data) {
      return { initialMsg: initialMessage || "您好，我是AI助手，有什么可以帮您?", processedData: null };
    }

    // 检查是否是漏洞数据
    const isVulnerabilityData = data && (
      data.name !== undefined && 
      (data.risk_level !== undefined || data.severity !== undefined) || 
      data.cve_id !== undefined
    );

    if (!isVulnerabilityData) {
      return { initialMsg: initialMessage || "请分析以下数据", processedData: data };
    }

    // 处理漏洞数据
    console.log('处理漏洞数据:', data);
    
    try {
      setLoading(true);
      
      // 根据type使用不同的API
      if (type === 'analysis') {
        const response = await aiService.analyzeVulnerability(data);
        if (response.success && response.result) {
          return { initialMsg: '以下是漏洞分析结果:', processedData: response.result };
        }
      } else if (type === 'remediation' || buttonText.includes('修复建议')) {
        const response = await aiService.getVulnerabilityRemediation(data);
        if (response.success && response.result) {
          console.log('获取到修复建议数据:', response);
          return { initialMsg: '以下是漏洞修复建议:', processedData: response.result };
        }
        
        // 如果API调用失败或返回空结果，返回漏洞数据本身，使后续步骤调用sendMessage
        console.log('API调用未返回修复建议结果，将使用原始数据');
        return { 
          initialMsg: `正在为漏洞"${data.name}"生成修复建议...`, 
          processedData: data 
        };
      }
      
      // 如果没有使用特定API或API调用失败，使用通用消息
      return { 
        initialMsg: buttonText.includes('修复建议') 
          ? `请为漏洞"${data.name}"提供详细的修复建议和步骤` 
          : `请分析漏洞"${data.name}"的风险和影响`, 
        processedData: data 
      };
    } catch (error) {
      console.error('获取AI响应失败:', error);
      message.error('获取AI分析失败，将使用普通会话');
      
      // 出错时根据type返回适当的消息
      if (type === 'remediation' || buttonText.includes('修复建议')) {
        return { 
          initialMsg: `请为漏洞"${data.name}"提供详细的修复建议和步骤`, 
          processedData: data 
        };
      }
      
      return { 
        initialMsg: `请分析漏洞"${data.name}"的详细信息`, 
        processedData: data 
      };
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    console.log('AI助手按钮被点击, 类型:', type);
    
    if (forceNewConversation) {
      console.log('强制创建新会话');
      clearMessages();
    }
    
    // 点击按钮时设置loading状态
    setLoading(true);
    
    try {
      // 打开聊天窗口
      openChat();
      
      // 对于修复建议类型，使用更直接的方法
      if (type === 'remediation' || buttonText.includes('修复建议')) {
        console.log('直接发送修复建议请求，不尝试预处理数据');
        // 添加用户提问消息（重要修改：立即添加用户消息，不使用setTimeout）
        const prompt = `请为该漏洞提供详细修复建议: ${data.name || 'Unknown'} (${data.cve_id || 'No CVE'})`;
        addMessage(prompt, true);
        // 添加初始消息
        addMessage(`正在为漏洞"${data.name || 'Unknown'}"生成修复建议...`, false);
        // 直接发送消息到后端
        await sendMessage(prompt, data);
        // 发送完请求后关闭loading状态
        setLoading(false);
        return;
      } 
      
      // 对于分析类型或其他类型，立即显示初始提示
      if (type === 'analysis') {
        console.log('发送漏洞数据以获取深入分析');
        
        // 重要修改：立即添加用户提问消息
        const prompt = `请详细分析漏洞"${data.name}"的风险级别、影响范围和潜在危害`;
        addMessage(prompt, true);
        
        // 添加初始提示消息
        addMessage(`正在分析漏洞"${data.name}"，请稍候...`, false);
        
        // 发送消息到后端
        await sendMessage(prompt, data);
        
        // 发送完请求后关闭loading状态
        setLoading(false);
        return;
      }
      
      // 对于一般情况，获取初始消息和数据
      const { initialMsg, processedData } = await getInitialMessageAndData();
      console.log('准备发送初始消息:', initialMsg);
      
      // 添加消息到聊天
      addMessage(initialMsg, false);
      
      // 如果有处理后的文本数据，直接显示
      if (typeof processedData === 'string') {
        console.log('处理后的数据是文本，直接显示:', processedData.substring(0, 50) + '...');
        addMessage(processedData, false);
      } else if (processedData) {
        // 如果是对象数据，发送到后端处理
        const prompt = `请分析以下数据`;
        addMessage(prompt, true);
        await sendMessage(prompt, processedData);
      }
    } catch (error) {
      console.error('在处理AI助手请求时出错:', error);
      addMessage(`处理请求时出错: ${error instanceof Error ? error.message : String(error)}`, false);
    } finally {
      // 确保总是关闭loading状态
      setLoading(false);
    }
  };

  return (
    <Tooltip title={tooltipText}>
      <Button
        type={buttonType}
        icon={icon}
        onClick={handleClick}
        size={size}
        loading={loading}
      >
        {buttonText}
      </Button>
    </Tooltip>
  );
};

export default AIChatTrigger; 