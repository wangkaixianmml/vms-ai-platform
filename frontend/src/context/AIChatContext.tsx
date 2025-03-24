import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// API基础URL配置 - 开发环境指向本地后端，生产环境使用相对路径
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000/api/v1' 
  : '/api/v1';

// 消息类型定义
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  loading?: boolean; // 用于指示消息是否正在加载中
  isStreaming?: boolean; // 标记消息是否正在流式接收中
}

// 聊天上下文接口
interface AIChatContextType {
  messages: Message[];
  conversationId: string | null;
  userId: string | null;
  isLoading: boolean;
  showChat: boolean;
  addMessage: (content: string, isUser: boolean) => void;
  openChat: (initialMessage?: string, initialData?: any) => void;
  closeChat: () => void;
  clearMessages: () => void;
  sendMessage: (content: string, data?: any, isInitialMessage?: boolean) => Promise<void>;
  sendVulnerabilityData: (vulnerabilityData: any) => Promise<void>;
}

// 创建上下文
const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

// 持久化全局会话ID
let globalConversationId: string | null = null;
let globalUserId: string | null = null;

// 流式响应处理函数
const processStreamResponse = async (response: Response, tempMessageId: string, setMessages: React.Dispatch<React.SetStateAction<Message[]>>, setConversationId: React.Dispatch<React.SetStateAction<string | null>>, setUserId: React.Dispatch<React.SetStateAction<string | null>>) => {
  try {
    // 创建响应读取器
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }
    
    const decoder = new TextDecoder();
    let buffer = "";
    let responseText = "";
    let respConversationId = null;
    let respUserId = null;
    let isNewConversation = false;
    let hasReceivedChunk = false;
    let lastUpdateTime = Date.now();
    let hasReceivedEndEvent = false; // 标记是否收到了结束事件
    let connectionTimeout = false; // 标记是否出现连接超时
    let lastActivityTime = Date.now(); // 记录最后一次收到数据的时间
    
    console.log('开始处理流式响应...');
    
    // 立即标记消息为正在流式接收中，但内容保持不变
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessageId 
        ? { 
            ...msg, 
            isStreaming: true,
            loading: false, // 关键点：设置为false以启用打字机效果
            content: "正在等待AI响应..." // 设置初始等待消息
          } 
        : msg
    ));
    
    // 设置连接超时检查 - 减少超时时间和检查频率，更快发现问题
    const timeoutCheck = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime;
      console.log(`检查连接活跃度: 距上次活动${inactiveTime}ms`);
      
      // 5秒无活动时发送保活消息
      if (inactiveTime > 5000 && !hasReceivedEndEvent && !hasReceivedChunk) {
        console.warn('可能存在连接问题，但尚未达到超时，显示过渡内容');
        
        // 更新消息状态，显示过渡内容
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessageId 
            ? { 
                ...msg, 
                content: "正在等待AI响应，可能需要一段时间...",
                isStreaming: true,
                loading: false
              } 
            : msg
        ));
      }
      
      // 如果超过10秒没有活动，认为连接可能已断开
      if (inactiveTime > 10000 && !hasReceivedEndEvent) {
        console.warn('流式连接可能已断开，超过10秒无活动');
        connectionTimeout = true;
        
        // 超时时，尝试一个备用的内容
        const fallbackContent = "很抱歉，服务连接超时。您可以尝试刷新页面或稍后再试。同时，您也可以检查：\n\n" +
          "1. 网络连接是否稳定\n" +
          "2. 后端服务是否正常运行\n" +
          "3. 请求的数据量是否过大";
        
        // 更新消息状态，显示可能的连接问题
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessageId 
            ? { 
                ...msg, 
                content: responseText || fallbackContent,
                isStreaming: false,
                loading: false
              } 
            : msg
        ));
        
        // 清除超时检查
        clearInterval(timeoutCheck);
        
        // 直接返回，不等待进一步处理
        try {
          reader.cancel("连接超时");
        } catch (e) {
          console.error("取消读取器时出错:", e);
        }
      }
    }, 2000); // 每2秒检查一次
    
    try {
      let readAttempts = 0;
      const maxReadAttempts = 10; // 最大重试次数
      
      while (true) {
        try {
          const { done, value } = await reader.read();
          
          // 更新最后活动时间
          lastActivityTime = Date.now();
          
          if (done) {
            console.log('流式响应读取完成');
            break;
          }
          
          readAttempts = 0; // 重置重试计数
          
          // 解码二进制数据为文本
          const text = decoder.decode(value, { stream: true });
          if (text.length > 0) {
            console.log(`接收到数据块 (${value.length} 字节): ${text}`);
            // 增加这一行日志，记录原始数据
            console.log(`原始数据(hex): ${Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            buffer += text;
            
            // 处理完整的SSE事件
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // 保留最后一个可能不完整的部分
            
            // 标记是否在此批次中有更新
            let hasUpdateInThisBatch = false;
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.substring(6); // 移除 "data: " 前缀
                try {
                  console.log(`解析事件数据: ${data}`);
                  
                  // 先验证数据是否为有效的JSON
                  try {
                    JSON.parse(data);
                  } catch (jsonError) {
                    console.error('收到无效的JSON数据:', data);
                    // 继续处理下一个事件
                    continue;
                  }
                  
                  const eventData = JSON.parse(data);
                  console.log(`解析事件数据: 类型=${eventData.type}, 数据=`, eventData);
                  
                  // 处理不同类型的事件
                  if (eventData.type === "start") {
                    console.log('流式响应开始');
                    // 初始化开始时立即将loading设为false
                    setMessages(prev => prev.map(msg => 
                      msg.id === tempMessageId 
                        ? { 
                            ...msg, 
                            loading: false,
                            isStreaming: true,
                            content: "正在等待AI响应..." // 设置初始等待消息
                          } 
                        : msg
                    ));
                    
                    // 重要：接收到start事件后立即发送第一次更新，确保UI反馈
                    if (!hasReceivedChunk && responseText === "") {
                      setMessages(prev => prev.map(msg => 
                        msg.id === tempMessageId 
                          ? { 
                              ...msg, 
                              content: "AI正在处理您的问题...",
                              isStreaming: true,
                              loading: false
                            } 
                          : msg
                      ));
                    }
                  } 
                  else if (eventData.type === "chunk") {
                    // 兼容我们自己实现的chunk类型（用于测试和调试）
                    const content = eventData.content || "";
                    console.log(`收到chunk事件，内容: "${content}"`);
                    
                    if (!content) continue;
                    
                    // 更新累积的响应文本
                    if (!hasReceivedChunk) {
                      responseText = content;
                    } else {
                      responseText += content;
                    }
                    
                    // 提取元数据
                    respConversationId = eventData.conversation_id || respConversationId;
                    respUserId = eventData.user_id || respUserId;
                    
                    console.log(`收到chunk数据块: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    hasReceivedChunk = true;
                    hasUpdateInThisBatch = true;
                    
                    // 立即更新消息内容
                    const currentResponseText = responseText;
                    setMessages(prev => prev.map(msg => 
                      msg.id === tempMessageId 
                        ? { 
                            ...msg, 
                            content: currentResponseText,
                            isStreaming: true,
                            loading: false
                          } 
                        : msg
                    ));
                    
                    // 记录最后更新时间
                    lastUpdateTime = Date.now();
                  }
                  else if (eventData.type === "message" || eventData.event === "message") {
                    // 处理消息事件（这是来自Dify API的主要事件类型）
                    console.log('收到message事件:', eventData.event || eventData.type || '无事件类型');
                    
                    // 从message事件中提取内容
                    let content = "";
                    
                    // 尝试从不同的字段提取内容
                    if (eventData.answer) {
                      content = eventData.answer;
                      console.log(`从message.answer提取内容: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    } else if (eventData.content) {
                      content = eventData.content;
                      console.log(`从message.content提取内容: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    } else if (typeof eventData.message === 'string') {
                      content = eventData.message;
                      console.log(`从message.message(字符串)提取内容: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    } else if (typeof eventData.message === 'object' && eventData.message) {
                      const msgContent = eventData.message.content || eventData.message.text || eventData.message.answer || '';
                      if (msgContent) {
                        content = msgContent;
                        console.log(`从message.message对象提取内容: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                      }
                    }
                    
                    // 如果没有提取到内容，记录可用字段
                    if (!content) {
                      console.log('无法从message事件中提取内容，可用字段:', Object.keys(eventData).join(', '));
                      console.log('完整事件数据:', JSON.stringify(eventData));
                      
                      // 特殊处理：即使没有content，也要处理message_end事件的元数据
                      if (eventData.event === "message_end") {
                        console.log('收到message_end事件，处理元数据');
                        respConversationId = eventData.conversation_id || respConversationId;
                        respUserId = eventData.user_id || respUserId;
                        
                        // 标记消息为完成状态
                        if (hasReceivedChunk) {
                          setMessages(prev => prev.map(msg => 
                            msg.id === tempMessageId 
                              ? { 
                                  ...msg, 
                                  isStreaming: false,
                                  loading: false
                                } 
                              : msg
                          ));
                          hasReceivedEndEvent = true;
                        }
                      }
                      continue; // 继续处理下一个事件，而不是return整个函数
                    }
                    
                    // 对于所有message事件都执行累积内容的操作
                    // 无论是哪种类型的message事件，都累积显示内容
                    responseText += content;
                    
                    // 提取元数据
                    respConversationId = eventData.conversation_id || respConversationId;
                    respUserId = eventData.user_id || respUserId;
                    
                    console.log(`收到消息内容[累积]: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
                    hasReceivedChunk = true;
                    hasUpdateInThisBatch = true;
                    
                    // 立即更新消息内容（这是关键部分）
                    const currentResponseText = responseText;
                    
                    // 根据事件类型决定是否标记为完成
                    const isComplete = eventData.event === "message_end" || eventData.is_end === true;
                    if (isComplete) {
                      console.log('收到最终消息，标记为完成');
                      hasReceivedEndEvent = true;
                    }
                    
                    console.log(`更新消息: 内容长度=${currentResponseText.length}, 是否完成=${isComplete}`);
                    setMessages(prev => prev.map(msg => 
                      msg.id === tempMessageId 
                        ? { 
                            ...msg, 
                            content: currentResponseText,
                            isStreaming: !isComplete,
                            loading: false
                          } 
                        : msg
                    ));
                    
                    // 记录最后更新时间
                    lastUpdateTime = Date.now();
                  }
                } catch (e) {
                  console.error('解析事件数据错误:', e, '原始数据:', data);
                }
              }
            }
            
            // 如果收到了结束事件并处理完了当前批次，退出循环
            if (hasReceivedEndEvent && lines.length === 0) {
              console.log('已收到结束事件且处理完当前批次，终止流式处理');
              break;
            }
            
            // 如果超过100毫秒没有更新，且此批次中有内容，强制更新一次
            if (!hasUpdateInThisBatch && Date.now() - lastUpdateTime > 100 && responseText) {
              console.log('超过100ms无更新，强制刷新显示');
              const currentResponseText = responseText;
              setMessages(prev => prev.map(msg => 
                msg.id === tempMessageId 
                  ? { 
                      ...msg, 
                      content: currentResponseText,
                      isStreaming: true,
                      loading: false
                    } 
                  : msg
              ));
              lastUpdateTime = Date.now();
            }
          }
        } catch (readError: any) {
          readAttempts++;
          console.error(`读取流数据失败(尝试 ${readAttempts}/${maxReadAttempts}):`, readError);
          
          if (readAttempts >= maxReadAttempts) {
            throw new Error(`多次尝试读取流失败: ${readError.message}`);
          }
          
          // 短暂等待后重试
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      // 清除超时检查
      clearInterval(timeoutCheck);
    }
    
    // 流处理完成后确保更新最终状态
    console.log('流式处理完成，最终文本长度:', responseText.length);
    
    // 如果连接超时但有部分内容，保持这些内容
    if (connectionTimeout && responseText) {
      console.log('连接超时，使用已接收的内容作为最终结果');
    }
    
    // 更新消息为最终状态
    if (responseText) {
      const finalResponseText = responseText;
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId 
          ? { 
              ...msg, 
              content: finalResponseText,
              loading: false,
              isStreaming: false
            } 
          : msg
      ));
    } else if (connectionTimeout) {
      // 如果连接超时且没有内容，显示超时消息
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId 
          ? { 
              ...msg, 
              content: "请求处理超时，请刷新页面或重新发送消息",
              loading: false,
              isStreaming: false
            } 
          : msg
      ));
    } else if (!hasReceivedChunk) {
      // 如果没有收到任何chunk，显示错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessageId 
          ? { 
              ...msg, 
              content: "未收到任何响应数据，请检查网络连接或重试",
              loading: false,
              isStreaming: false
            } 
          : msg
      ));
    }
    
    // 返回会话信息
    return {
      responseText,
      conversationId: respConversationId,
      userId: respUserId,
      isNewConversation
    };
    
  } catch (error) {
    console.error('处理流式响应时出错:', error);
    // 更新错误消息
    setMessages(prev => prev.map(msg => 
      msg.id === tempMessageId 
        ? { 
            ...msg, 
            content: `处理响应时出错: ${error instanceof Error ? error.message : String(error)}`, 
            loading: false,
            isStreaming: false
          } 
        : msg
    ));
    throw error;
  }
};

// 上下文提供者组件
export const AIChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // 记录当前会话状态
  useEffect(() => {
    if (conversationId && userId) {
      console.log('会话状态更新:', { 
        conversationId: conversationId,
        userId: userId,
        globalConversationId: globalConversationId,
        globalUserId: globalUserId,
        messagesCount: messages.length 
      });
    }
  }, [conversationId, userId, messages.length]);

  // 关闭所有正在进行的流式响应
  const stopStreamingResponse = () => {
    if (eventSourceRef.current) {
      console.log('关闭流式响应连接');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // 清理副作用
  useEffect(() => {
    return () => {
      stopStreamingResponse();
    };
  }, []);

  // 添加消息到列表
  const addMessage = (content: string, isUser: boolean) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      content,
      isUser,
      timestamp: new Date()
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
  };

  // 打开聊天窗口
  const openChat = (initialMessage?: string, initialData?: any) => {
    console.log('打开聊天窗口');
    setShowChat(true);
    setMessages([]);

    // 如果有全局会话ID，优先使用它，否则重置会话ID
    if (globalConversationId && globalUserId) {
      console.log(`使用现有会话: ID=${globalConversationId.substring(0, 8)}...`);
      setConversationId(globalConversationId);
      setUserId(globalUserId);
    } else {
      console.log('没有现有会话，将在首次发送消息时创建新会话');
      setConversationId(null);
      setUserId(null);
    }

    // 如果有初始消息，自动发送
    if (initialMessage && typeof initialMessage === 'string') {
      const previewText = initialMessage.length > 30 
        ? `${initialMessage.substring(0, 30)}...` 
        : initialMessage;
      console.log(`有初始消息，自动发送: ${previewText}`);
      setTimeout(() => {
        addMessage(initialMessage, true);
        sendMessage(initialMessage, initialData, true);
      }, 100);
    } else if (initialMessage && typeof initialMessage !== 'string') {
      console.log('收到非字符串类型的初始消息:', typeof initialMessage);
      // 如果是对象类型，可能是漏洞数据或其他数据
      if (initialData) {
        console.log('使用提供的initialData');
        setTimeout(() => {
          sendMessage("请分析以下数据", initialData, true);
        }, 100);
      }
    }
  };

  // 关闭聊天窗口
  const closeChat = () => {
    console.log('关闭聊天窗口');
    stopStreamingResponse();
    
    // 保存当前会话ID到全局变量
    if (conversationId && userId) {
      globalConversationId = conversationId;
      globalUserId = userId;
      console.log(`保存会话到全局: ID=${conversationId.substring(0, 8)}...`);
    }
    
    setShowChat(false);
  };

  // 清除所有消息
  const clearMessages = () => {
    console.log('清除所有消息');
    stopStreamingResponse();
    setMessages([]);
  };

  // 发送消息
  const sendMessage = async (content: string, data?: any, isInitialMessage = false) => {
    try {
      console.log(`发送消息${isInitialMessage ? '(初始消息)' : ''}: ${content.substring(0, 30)}...`);
      console.log('当前会话状态:', { 
        conversationId: conversationId?.substring(0, 8) || 'null', 
        userId: userId?.substring(0, 8) || 'null',
        globalId: globalConversationId?.substring(0, 8) || 'null'
      });
      
      // 如果是用户消息，添加到聊天记录
      if (!isInitialMessage) {
        addMessage(content, true);
      }
      
      // 设置加载状态
      setIsLoading(true);
      
      // 先创建AI的占位回复，标记为loading
      const tempMessageId = `msg_loading_${Date.now()}`;
      setMessages(prev => [
        ...prev, 
        {
          id: tempMessageId,
          content: "AI正在思考中...",
          isUser: false,
          timestamp: new Date(),
          loading: true,
          isStreaming: false
        }
      ]);

      // 创建请求数据
      const payload: any = {
        message: content,
        conversation_id: conversationId || undefined,
        user_id: userId || undefined,
        stream: true, // 请求流式响应
      };
      
      // 如果有额外数据，添加到请求中
      if (data) {
        // 处理漏洞数据
        if (data.vulnerabilityData) {
          console.log('包含漏洞数据，添加到payload中:', data.vulnerabilityData);
          payload.vulnerability_data = data.vulnerabilityData;
          console.log('使用流式模式处理漏洞数据');
        }
        
        // 处理其他输入数据
        if (data.inputs) {
          console.log('包含输入数据，添加到payload中:', data.inputs);
          payload.inputs = data.inputs;
        }
      }
      
      console.log('发送数据:', payload);
      
      // 使用EventSource处理流式响应
      stopStreamingResponse(); // 先关闭之前的连接
      
      // 创建带完整URL的新EventSource
      const chatUrl = `${API_BASE_URL}/dify/chat/stream`;
      console.log(`连接到流式API: ${chatUrl}`);
      console.log(`API基础URL: ${API_BASE_URL}`);
      console.log(`环境: ${process.env.NODE_ENV}`);
      console.log(`完整请求URL: ${chatUrl}`);
      console.log(`请求方法: POST`);
      console.log(`请求头: Content-Type=application/json`);
      console.log(`请求体: ${JSON.stringify(payload)}`);
      
      // 使用fetch来发送POST请求获取流式响应
      try {
        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
        
        console.log('收到响应状态:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('响应错误内容:', errorText);
          throw new Error(`HTTP错误 ${response.status}: ${errorText}`);
        }
        
        // 使用流式处理函数处理响应
        const result = await processStreamResponse(
          response, 
          tempMessageId,
          setMessages,
          setConversationId,
          setUserId
        );
        
        // 处理会话信息
        if (result?.conversationId) {  // 使用可选链操作符
          // 更新或保持会话ID
          if (!conversationId || result.isNewConversation) {
            console.log(`设置新会话ID: ${result.conversationId}`);
            setConversationId(result.conversationId);
            globalConversationId = result.conversationId;
          }
          
          // 更新或保持用户ID
          if (result.userId && (!userId || result.isNewConversation)) {
            console.log(`设置新用户ID: ${result.userId}`);
            setUserId(result.userId);
            globalUserId = result.userId;
          }
        } else {
          console.warn('响应中没有conversation_id');
        }
      } catch (error) {
        console.error('请求流式响应失败:', error);
        // 更新错误消息
        setMessages(prev => {
          return prev.map(msg => 
            msg.id === tempMessageId
            ? {
                ...msg,
                content: `发送消息时出错: ${error instanceof Error ? error.message : String(error)}`,
                isUser: false,
                timestamp: new Date(),
                loading: false,
                isStreaming: false
              }
            : msg
          );
        });
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      // 移除加载中的消息，添加错误消息
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [
          ...filtered,
          {
            id: `msg_error_${Date.now()}`,
            content: `发送消息时出错: ${error instanceof Error ? error.message : String(error)}`,
            isUser: false,
            timestamp: new Date()
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 发送漏洞数据进行分析
  const sendVulnerabilityData = async (vulnerabilityData: any) => {
    try {
      console.log('开始处理漏洞数据分析请求:', JSON.stringify(vulnerabilityData));
      setIsLoading(true);
      
      // 确保vulnerabilityData是对象而不是null或undefined
      if (!vulnerabilityData || typeof vulnerabilityData !== 'object') {
        console.error('漏洞数据无效:', vulnerabilityData);
        addMessage(`无法分析漏洞数据: 数据无效或格式不正确`, false);
        setIsLoading(false);
        return;
      }
      
      // 如果有user_id，添加到漏洞数据中
      if (userId) {
        console.log(`添加userId到漏洞数据: ${userId}`);
        vulnerabilityData.user_id = userId;
      }
      
      // 添加用户消息显示
      const vulnerabilityName = vulnerabilityData.name || vulnerabilityData.cve_id || '未命名漏洞';
      const userMessage = `请分析这个漏洞: ${vulnerabilityName}`;
      
      console.log('添加用户消息到聊天:', userMessage);
      addMessage(userMessage, true);
      
      // 添加一个AI正在思考的消息
      const loadingMessageId = `loading_${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: loadingMessageId,
          content: 'AI正在分析漏洞数据...',
          isUser: false,
          timestamp: new Date(),
          loading: true,
          isStreaming: false
        }
      ]);
      
      console.log('向后端API发送漏洞数据请求');
      
      // 准备请求数据
      const payload = {
        message: userMessage,
        vulnerability_data: vulnerabilityData,
        conversation_id: conversationId,
        user_id: userId,
        stream: true // 启用流式响应
      };
      
      console.log('请求负载:', JSON.stringify(payload));
      
      // 关闭任何现有的流式连接
      stopStreamingResponse();
      
      try {
        // 使用与sendMessage方法相同的流式处理逻辑
        const chatUrl = `${API_BASE_URL}/dify/chat/stream`;
        console.log(`连接到流式API: ${chatUrl}, 环境: ${process.env.NODE_ENV}`);
        
        // 使用fetch发送POST请求获取流式响应
        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        console.log('收到响应状态:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('响应错误内容:', errorText);
          throw new Error(`HTTP错误 ${response.status}: ${errorText}`);
        }
        
        // 使用流式处理函数处理响应
        const result = await processStreamResponse(
          response, 
          loadingMessageId,
          setMessages,
          setConversationId,
          setUserId
        );
        
        // 处理会话信息
        if (result?.conversationId) {
          // 更新或保持会话ID
          if (!conversationId || result?.isNewConversation) {
            console.log(`设置新会话ID: ${result.conversationId}`);
            setConversationId(result.conversationId);
            globalConversationId = result.conversationId;
          }
          
          // 更新或保持用户ID
          if (result.userId && (!userId || result?.isNewConversation)) {
            console.log(`设置新用户ID: ${result.userId}`);
            setUserId(result.userId);
            globalUserId = result.userId;
          }
        } else {
          console.warn('响应中没有conversation_id');
        }
      } catch (error) {
        console.error('请求漏洞分析失败:', error);
        // 详细输出错误信息
        console.error('错误消息:', error instanceof Error ? error.message : String(error));
        console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
        
        // 更新错误消息
        setMessages(prev => {
          return prev.map(msg => 
            msg.id === loadingMessageId
            ? {
                ...msg,
                content: `分析漏洞数据失败: ${error instanceof Error ? error.message : String(error)}`,
                isUser: false,
                timestamp: new Date(),
                loading: false,
                isStreaming: false
              }
            : msg
          );
        });
      }
    } catch (error) {
      console.error('发送漏洞数据失败:', error);
      addMessage(`发送漏洞数据失败: ${error instanceof Error ? error.message : String(error)}`, false);
      setIsLoading(false);
    }
  };

  // 提供上下文值
  const contextValue: AIChatContextType = {
    messages,
    conversationId,
    userId,
    isLoading,
    showChat,
    addMessage,
    openChat,
    closeChat,
    clearMessages,
    sendMessage,
    sendVulnerabilityData
  };

  return (
    <AIChatContext.Provider value={contextValue}>
      {children}
    </AIChatContext.Provider>
  );
};

// 自定义钩子，用于访问上下文
export const useAIChat = (): AIChatContextType => {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
};

export default AIChatContext; 