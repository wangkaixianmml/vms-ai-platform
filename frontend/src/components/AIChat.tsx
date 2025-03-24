import React, { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../context/AIChatContext';
import {
  Box,
  Input,
  Button,
  Flex,
  Text,
  Spinner,
  HStack,
  CloseButton
} from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  loading?: boolean;
}

const AIChat: React.FC = () => {
  const { showChat, messages, sendMessage, closeChat, conversationId, clearMessages, isLoading: contextLoading } = useAIChat();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 定义样式变量
  const bgColor = '#ffffff';
  const headerBgColor = '#4299e1';
  const userBubbleColor = '#3182ce';
  const aiBubbleColor = '#f8f9fa';
  const borderColor = '#e2e8f0';
  const userTextColor = '#ffffff';
  const aiTextColor = '#1a202c';
  
  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 消息变化时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // 切换展开/收起状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!input.trim() || contextLoading) return;
    
    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      console.error('消息发送失败:', error);
    }
  };

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!showChat) return null;

  return (
    <Box
      position="fixed"
      bottom="20px"
      right="20px"
      width={isExpanded ? "80%" : "350px"}
      height={isExpanded ? "80%" : "500px"}
      bg={bgColor}
      borderRadius="md"
      boxShadow="lg"
      display="flex"
      flexDirection="column"
      borderWidth="1px"
      borderColor={borderColor}
      zIndex="1000"
      transition="all 0.3s ease"
    >
      {/* 聊天头部 */}
      <Flex
        p={3}
        borderBottomWidth="1px"
        borderColor={borderColor}
        justifyContent="space-between"
        alignItems="center"
        bg={headerBgColor}
        color="white"
        borderTopRadius="md"
      >
        <Text fontWeight="bold">
          AI 助手 {conversationId ? `- 会话 #${conversationId.substring(0, 8)}` : ''}
        </Text>
        <HStack>
          <Button
            onClick={clearMessages}
            mr={1}
            color="white"
            size="sm"
            variant="ghost"
            _hover={{ bg: "blue.600" }}
            aria-label="Clear chat"
          >
            🗑️
          </Button>
          <Button
            onClick={toggleExpand}
            mr={1}
            color="white"
            size="sm"
            variant="ghost"
            _hover={{ bg: "blue.600" }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? '⬇️' : '⬆️'}
          </Button>
          <CloseButton 
            size="sm" 
            onClick={closeChat} 
            color="white"
            _hover={{ bg: "blue.600" }}
          />
        </HStack>
      </Flex>

      {/* 聊天消息区域 */}
      <Box
        flex="1"
        overflowY="auto"
        p={3}
        bg="#f8fafc"
      >
        {messages.length === 0 ? (
          <Flex 
            justifyContent="center" 
            alignItems="center" 
            height="100%" 
            flexDirection="column"
          >
            <Text color="gray.500">有任何问题，请随时提问！</Text>
            {conversationId && (
              <Text color="gray.400" fontSize="sm" mt={2}>
                当前使用已存在的会话，历史上下文将被保留
              </Text>
            )}
          </Flex>
        ) : (
          messages.map((message: Message) => (
            <Box
              key={message.id}
              alignSelf={message.isUser ? "flex-end" : "flex-start"}
              bg={message.isUser ? userBubbleColor : aiBubbleColor}
              color={message.isUser ? userTextColor : aiTextColor}
              borderRadius="lg"
              p={3}
              mb={3}
              maxWidth="80%"
              marginLeft={message.isUser ? "auto" : "0"}
              marginRight={message.isUser ? "0" : "auto"}
              boxShadow="sm"
              width="fit-content"
              position="relative"
            >
              {message.loading && (
                <Box position="absolute" top="-10px" right="-10px">
                  <Spinner size="sm" color={message.isUser ? "white" : "blue.500"} />
                </Box>
              )}
              {message.isUser ? (
                <Text>{message.content}</Text>
              ) : (
                <Box className="markdown-content">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </Box>
              )}
            </Box>
          ))
        )}
        
        {contextLoading && !messages.some(m => m.loading) && (
          <Flex justifyContent="center" my={4}>
            <Spinner size="sm" />
            <Text ml={2} fontSize="sm" color="gray.500">
              AI正在思考中...
            </Text>
          </Flex>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* 输入区域 */}
      <Flex p={3} borderTopWidth="1px" borderColor={borderColor}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入您的问题..."
          mr={2}
          disabled={contextLoading}
          flex="1"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!input.trim() || contextLoading}
          colorScheme="blue"
        >
          {contextLoading ? <Spinner size="sm" /> : '发送'}
        </Button>
      </Flex>
    </Box>
  );
};

export default AIChat; 