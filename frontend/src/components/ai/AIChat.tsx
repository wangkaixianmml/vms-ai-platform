import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, Avatar, Spin, Tooltip } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useAIChat } from '../../context/AIChatContext';

// 新增打字机效果组件
const TypewriterEffect: React.FC<{ text: string, loading?: boolean }> = ({ text, loading = false }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const lastTextRef = useRef('');
  const currentIndexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bufferTextRef = useRef(''); // 用于存储正在处理但尚未显示的文本
  
  // 动态调整打字速度
  const getTypingSpeed = () => {
    const baseSpeed = 5; // 基础速度（毫秒/字符）
    // 文本越长速度越快，但有下限
    return Math.max(2, baseSpeed - Math.floor(text.length / 1000));
  };
  
  // 清理函数
  const clearTypingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  
  // 当组件卸载时清除定时器
  useEffect(() => {
    return clearTypingTimer;
  }, []);
  
  // 当text更新时处理打字效果
  useEffect(() => {
    // 如果文本为空或是特殊提示信息，直接显示，不使用打字效果
    if (!text || text === 'AI正在思考中...' || text === 'AI正在分析漏洞数据...' || 
        text === '正在等待AI响应...' || text === 'AI正在处理您的问题...') {
      setDisplayedText(text);
      setIsTyping(false);
      clearTypingTimer();
      return;
    }
    
    // 如果新文本与上次的文本相同，不做任何处理
    if (text === lastTextRef.current) return;
    
    console.log(`文本更新: 新文本长度=${text.length}, 显示文本长度=${displayedText.length}`);
    
    // 是否是增量更新
    const isIncremental = text.startsWith(lastTextRef.current) && lastTextRef.current.length > 0;
    
    // 如果不是增量更新并且长度差距很大，考虑直接显示文本
    if (!isIncremental && Math.abs(text.length - lastTextRef.current.length) > 200) {
      console.log('检测到全新文本且差异较大，直接显示');
      setDisplayedText(text);
      lastTextRef.current = text;
      currentIndexRef.current = text.length;
      return;
    }
    
    // 更新lastTextRef
    lastTextRef.current = text;
    
    // 清除任何现有的打字定时器
    clearTypingTimer();
    
    if (isIncremental) {
      // 增量更新时，从当前显示的文本长度开始打字
      console.log('检测到增量更新，从当前位置继续打字');
      currentIndexRef.current = displayedText.length;
      // 将新增内容添加到缓冲区
      bufferTextRef.current = text.substring(displayedText.length);
    } else {
      // 全新文本，重置计数器并重新开始
      console.log('检测到全新文本，重置打字状态');
      currentIndexRef.current = 0;
      // 将整个文本添加到缓冲区
      bufferTextRef.current = text;
    }
    
    // 开始打字效果
    setIsTyping(true);
    
    // 定义打字函数
    const typeNextChar = () => {
      // 如果当前索引已经超出文本长度，停止打字
      if (currentIndexRef.current >= text.length) {
        setIsTyping(false);
        clearTypingTimer();
        return;
      }
      
      // 计算本次应该打多少字符（根据缓冲区大小自动调整）
      const remainingChars = bufferTextRef.current.length;
      const charsToType = Math.min(
        remainingChars,
        // 缓冲区越大，一次打的字符越多，加快显示速度
        Math.max(1, Math.floor(remainingChars / 20))
      );
      
      // 更新显示文本
      const nextChars = bufferTextRef.current.substring(0, charsToType);
      bufferTextRef.current = bufferTextRef.current.substring(charsToType);
      
      setDisplayedText(prev => prev + nextChars);
      currentIndexRef.current += charsToType;
      
      // 调整打字速度并安排下一个字符
      const speed = getTypingSpeed();
      timerRef.current = setTimeout(typeNextChar, speed);
    };
    
    // 启动打字效果
    timerRef.current = setTimeout(typeNextChar, 10);
  }, [text, displayedText]);
  
  // 渲染显示文本或加载状态
  return (
    <div className="typewriter-text">
      {loading ? (
        <div>AI正在思考中...</div>
      ) : (
        <ReactMarkdown>{displayedText}</ReactMarkdown>
      )}
    </div>
  );
};

const AIChat: React.FC = () => {
  const { showChat, messages, sendMessage, closeChat, conversationId, clearMessages, isLoading: contextLoading } = useAIChat();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 当有漏洞数据时自动发送初始消息
  useEffect(() => {
    const hasInitialMessage = messages.some(msg => msg.id.startsWith('init-'));
    
    // 如果有初始消息但还没有AI回复，自动发送
    if (hasInitialMessage && messages.length === 1 && !isLoading) {
      const initialMessage = messages[0];
      console.log('自动发送初始消息:', initialMessage.content);
      handleSendInitialMessage(initialMessage.content, null);
    }
  }, [messages, isLoading, sendMessage]);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 消息变化时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // 处理初始消息发送
  const handleSendInitialMessage = async (content: string, data: any) => {
    if (isLoading) return;
    
    console.log('处理初始消息:', content);
    if (data) console.log('初始消息数据:', data);
    
    setIsLoading(true);
    try {
      await sendMessage(content, data);
    } catch (error) {
      console.error('初始消息发送失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setIsLoading(true);
    try {
      await sendMessage(inputValue);
      setInputValue('');
    } catch (error) {
      console.error('消息发送失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // 处理清空对话
  const handleClearConversation = () => {
    if (window.confirm('确定要清空当前对话并开始新会话吗？这将删除所有消息历史。')) {
      clearMessages();
    }
  };

  if (!showChat) return null;

  return (
    <div className="ai-chat-window">
      <div className="ai-chat-header">
        <div className="flex items-center">
          <RobotOutlined style={{ marginRight: 8 }} />
          <span>AI 助手{conversationId ? ` - 会话 #${conversationId.substring(0, 8)}` : ''}</span>
        </div>
        <div className="flex items-center">
          <Tooltip title="清空对话并开始新会话">
            <Button 
              type="text" 
              icon={<DeleteOutlined />} 
              onClick={handleClearConversation}
              style={{ color: 'white', marginRight: 8 }}
            />
          </Tooltip>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={closeChat}
            style={{ color: 'white' }}
          />
        </div>
      </div>
      
      <div className="ai-chat-body">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>有任何关于漏洞的问题，请随时提问！</p>
            {conversationId && (
              <p className="mt-2">当前使用已存在的会话，历史上下文将被保留</p>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`ai-message ${message.isUser ? 'ai-message-user' : 'ai-message-ai'}`}
            >
              <div className="ai-message-avatar" style={{ 
                backgroundColor: message.isUser ? '#1677ff' : '#f5f5f5',
                color: message.isUser ? 'white' : '#1677ff'
              }}>
                {message.isUser ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div className="ai-message-content">
                {message.isUser ? (
                  <div>{message.content}</div>
                ) : (
                  <div className="ai-message-markdown">
                    {/* 使用新的打字机效果组件替代原有的ReactMarkdown */}
                    <TypewriterEffect 
                      text={message.content} 
                      loading={message.loading}
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="text-center py-4">
            <Spin tip="AI正在分析中..." />
            <p className="text-gray-400 mt-2">请稍候，正在处理您的请求...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="ai-chat-footer">
        <div className="flex">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            disabled={isLoading}
            autoFocus
          />
          <Button 
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={isLoading}
            disabled={!inputValue.trim() || isLoading}
            style={{ marginLeft: 8 }}
          />
        </div>
      </div>
    </div>
  );
};

export default AIChat; 
