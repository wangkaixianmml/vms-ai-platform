import httpx
from app.core.config import settings
from typing import Dict, Any, Optional, List, AsyncGenerator
import json
import uuid
import logging
from app.exceptions.dify_error import DifyAPIError
import time
import os
from httpx import Response
from functools import lru_cache
import traceback
import aiohttp
from aiohttp.client_exceptions import ClientResponseError
import asyncio

# 不要在这里设置基本日志配置，这会导致多重日志
# logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DifyService:
    """Dify API服务封装"""
    
    def __init__(self):
        """初始化Dify服务"""
        # 从settings中获取API基础URL和密钥
        self.base_url = settings.DIFY_API_URL
        self.api_key = settings.DIFY_API_KEY
        
        if not self.api_key:
            logger.warning("未配置Dify API密钥，API调用可能会失败")
        
        # 设置默认的会话
        self.default_user_id = str(uuid.uuid4())
        
        # 保存会话状态的字典
        self._session_cache = {}
        
        logger.info(f"Dify服务初始化完成 - 基础URL: {self.base_url}")
        logger.info(f"API密钥状态: {'已配置' if self.api_key else '未配置，请检查环境变量DIFY_API_KEY'}")
        
    def get_headers(self):
        """获取请求头"""
        if not self.api_key:
            logger.error("尝试发送请求，但API密钥未配置")
            
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
    def _cache_session(self, conversation_id: str, user_id: str):
        """缓存会话信息"""
        self._session_cache[conversation_id] = {
            "user_id": user_id,
            "timestamp": import_time_module().time()  # 记录缓存时间
        }
        logger.info(f"已缓存会话信息 - 会话ID: {conversation_id}, 用户ID: {user_id}")
        
    def _get_cached_user_id(self, conversation_id: str) -> Optional[str]:
        """从缓存中获取用户ID"""
        session_info = self._session_cache.get(conversation_id)
        if session_info:
            return session_info.get("user_id")
        return None
        
    async def get_conversations(self) -> List[Dict[str, Any]]:
        """获取所有对话列表"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/conversations",
                    headers=self.get_headers()
                )
                response.raise_for_status()
                data = response.json()
                return data.get("data", {}).get("conversations", [])
        except Exception as e:
            logger.error(f"获取对话列表失败: {str(e)}")
            raise

    async def get_conversation(self, conversation_id: str) -> Dict[str, Any]:
        """获取特定对话的详情"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/conversations/{conversation_id}",
                    headers=self.get_headers()
                )
                response.raise_for_status()
                return response.json().get("data", {})
        except Exception as e:
            logger.error(f"获取对话详情失败 - ID: {conversation_id}, 错误: {str(e)}")
            raise

    async def get_conversation_messages(self, conversation_id: str) -> List[Dict[str, Any]]:
        """获取特定对话的所有消息"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/messages",
                    params={"conversation_id": conversation_id},
                    headers=self.get_headers()
                )
                response.raise_for_status()
                return response.json().get("data", {}).get("messages", [])
        except Exception as e:
            logger.error(f"获取对话消息失败 - 会话ID: {conversation_id}, 错误: {str(e)}")
            raise

    async def send_first_message(self, message: str, user_id: Optional[str] = None, stream: bool = True) -> Dict[str, Any]:
        """发送首条消息，创建新对话"""
        try:
            # 如果未提供用户ID，则生成一个
            if not user_id:
                user_id = str(uuid.uuid4())
                logger.info(f"未提供用户ID，已生成新ID: {user_id}")
            
            payload = {
                "inputs": {},
                "query": message,
                "response_mode": "streaming" if stream else "blocking",
                "conversation_id": None,  # 首次对话，无对话ID
                "user": user_id
            }
            
            logger.info(f"发送首条消息 - 用户ID: {user_id}, 消息: '{message[:100]}...'")
            
            # 使用aiohttp进行异步HTTP请求
            async with aiohttp.ClientSession() as session:
                headers = self.get_headers()
                
                if stream:
                    logger.info("使用流式模式发送首条消息")
                    # 返回流式响应的聚合结果
                    return await self._handle_streaming_response(
                        session, 
                        f"{self.base_url}/chat-messages", 
                        payload, 
                        headers,
                        user_id
                    )
                else:
                    # 阻塞模式
                    async with session.post(
                        f"{self.base_url}/chat-messages",
                        json=payload,
                        headers=headers
                    ) as response:
                        # 检查响应状态
                        if response.status != 200:
                            error_text = await response.text()
                            logger.error(f"创建对话失败 - 状态码: {response.status}, 响应: {error_text}")
                            raise Exception(f"创建对话失败: {error_text}")
                        
                        data = await response.json()
                        conversation_id = data.get("conversation_id")
                        
                        # 缓存会话信息
                        if conversation_id:
                            self._cache_session(conversation_id, user_id)
                            
                        return {
                            "conversation_id": conversation_id,
                            "user_id": user_id,
                            "response": data.get("answer", ""),
                            "message_id": data.get("id")
                        }
                        
        except Exception as e:
            error_message = f"发送首条消息失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            raise Exception(error_message)

    async def send_message(self, conversation_id: str, message: str, user_id: Optional[str] = None, 
                         inputs: Optional[Dict[str, Any]] = None, stream: bool = True) -> Dict[str, Any]:
        """向现有对话发送消息"""
        try:
            # 检查是否有缓存的用户ID
            cached_user_id = self._get_cached_user_id(conversation_id)
            
            # 如果未提供用户ID，尝试使用缓存的用户ID
            if not user_id and cached_user_id:
                user_id = cached_user_id
                logger.info(f"使用缓存的用户ID: {user_id}")
            # 如果仍然没有用户ID，生成一个新的
            elif not user_id:
                user_id = str(uuid.uuid4())
                logger.info(f"未提供用户ID，已生成新ID: {user_id}")
                
            # 准备请求负载
            payload = {
                "inputs": inputs or {},
                "query": message,
                "response_mode": "streaming" if stream else "blocking",
                "conversation_id": conversation_id,
                "user": user_id
            }
            
            logger.info(f"发送消息 - 会话ID: {conversation_id}, 用户ID: {user_id}, 消息: '{message[:100]}...'")
            
            # 使用aiohttp进行异步HTTP请求
            async with aiohttp.ClientSession() as session:
                headers = self.get_headers()
                
                if stream:
                    logger.info("使用流式模式发送消息")
                    # 返回流式响应的聚合结果
                    return await self._handle_streaming_response(
                        session, 
                        f"{self.base_url}/chat-messages", 
                        payload, 
                        headers,
                        user_id
                    )
                else:
                    # 阻塞模式
                    try:
                        async with session.post(
                            f"{self.base_url}/chat-messages",
                            json=payload,
                            headers=headers
                        ) as response:
                            # 检查响应状态
                            if response.status != 200:
                                error_text = await response.text()
                                error_data = {}
                                try:
                                    error_data = json.loads(error_text)
                                except:
                                    pass
                                
                                # 检查是否是会话不存在错误
                                if (
                                    "code" in error_data and error_data["code"] == "conversation_not_found" or
                                    "Conversation Not Exists" in error_text
                                ):
                                    logger.warning(f"会话不存在或已过期，尝试创建新会话")
                                    
                                    # 创建新的对话
                                    new_conversation = await self.send_first_message(message, user_id)
                                    new_conversation_id = new_conversation.get("conversation_id")
                                    
                                    logger.info(f"已创建新会话 - 原ID: {conversation_id}, 新ID: {new_conversation_id}")
                                    
                                    # 添加标志表示这是自动创建的新会话
                                    return {
                                        "conversation_id": new_conversation_id,
                                        "user_id": user_id,
                                        "answer": new_conversation.get("response", ""),
                                        "id": new_conversation.get("message_id"),
                                        "is_new_conversation": True
                                    }
                                else:
                                    # 其他错误
                                    logger.error(f"发送消息失败 - 状态码: {response.status}, 响应: {error_text}")
                                    raise Exception(f"发送消息失败: {error_text}")
                            
                            # 处理成功响应
                            data = await response.json()
                            
                            # 缓存或更新会话信息
                            self._cache_session(conversation_id, user_id)
                            
                            return {
                                "conversation_id": conversation_id,
                                "user_id": user_id,
                                "answer": data.get("answer", ""),
                                "id": data.get("id"),
                                "is_new_conversation": False
                            }
                    except ClientResponseError as e:
                        # 处理aiohttp可能抛出的客户端响应错误
                        logger.error(f"发送消息客户端错误 - 状态码: {e.status}, 消息: {e.message}")
                        
                        # 如果是404错误，可能是会话不存在
                        if e.status == 404:
                            logger.warning("404错误，尝试创建新会话")
                            
                            # 创建新的对话
                            new_conversation = await self.send_first_message(message, user_id, stream=True)
                            new_conversation_id = new_conversation.get("conversation_id")
                            
                            logger.info(f"已创建新会话 - 原ID: {conversation_id}, 新ID: {new_conversation_id}")
                            
                            # 添加标志表示这是自动创建的新会话
                            return {
                                "conversation_id": new_conversation_id,
                                "user_id": user_id,
                                "answer": new_conversation.get("response", ""),
                                "id": new_conversation.get("message_id"),
                                "is_new_conversation": True
                            }
                        else:
                            # 其他HTTP错误
                            raise Exception(f"发送消息失败: HTTP错误 {e.status} - {e.message}")
                        
        except Exception as e:
            error_message = f"发送消息失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            raise Exception(error_message)

    async def _handle_streaming_response(
        self, 
        session: aiohttp.ClientSession, 
        url: str, 
        payload: Dict[str, Any], 
        headers: Dict[str, str],
        user_id: str
    ) -> Dict[str, Any]:
        """处理流式响应，聚合所有片段并返回完整结果"""
        try:
            # 实现真正的流式响应处理
            logger.info("处理流式响应")
            
            # 确保使用流式模式
            payload["response_mode"] = "streaming"
            
            # 用于存储结果的变量
            conversation_id = None
            answer_chunks = []
            message_id = None
            
            # 使用流式模式发送请求
            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=60
            ) as response:
                # 检查响应状态
                if response.status != 200:
                    error_text = await response.text()
                    logger.error(f"流式请求失败 - 状态码: {response.status}, 响应: {error_text}")
                    raise Exception(f"流式请求失败: {error_text}")
                
                # 处理流式响应
                async for line in response.content:
                    if line:
                        try:
                            # 解码数据行
                            line_text = line.decode('utf-8').strip()
                            # 跳过空行
                            if not line_text:
                                continue
                            
                            logger.debug(f"收到流式数据行: {line_text}")
                            
                            # 处理SSE格式
                            if line_text.startswith('data: '):
                                data_json = line_text[6:]  # 移除'data: '前缀
                                data = json.loads(data_json)
                                
                                # 提取关键信息
                                event_type = data.get('event')
                                if event_type == 'message':
                                    # 提取消息内容
                                    message_content = data.get('answer', '')
                                    answer_chunks.append(message_content)
                                    
                                    # 提取会话ID和消息ID（如果存在）
                                    if 'conversation_id' in data and not conversation_id:
                                        conversation_id = data['conversation_id']
                                    if 'id' in data and not message_id:
                                        message_id = data['id']
                        except Exception as e:
                            logger.error(f"处理流式数据行失败: {str(e)}")
                            logger.error(f"问题数据: {line}")
            
            # 合并所有文本片段
            full_answer = ''.join(answer_chunks)
            
            # 缓存会话信息
            if conversation_id:
                self._cache_session(conversation_id, user_id)
                
            return {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "answer": full_answer,
                "message_id": message_id,
                "is_new_conversation": False
            }
                
        except Exception as e:
            error_message = f"处理流式响应失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            raise Exception(error_message)
    
    async def stream_response(self, url: str, payload: Dict[str, Any], user_id: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """流式处理响应"""
        try:
            logger.debug(f"开始流式响应处理 - URL: {url}")
            logger.debug(f"请求负载: {payload}")
            
            # 首先发送一个符合Dify规范的message事件，而不是start事件
            logger.info("发送初始message事件，符合Dify规范")
            yield {
                "event": "message",
                "answer": "正在准备响应...\n",
                "conversation_id": payload.get("conversation_id"),
                "user_id": user_id
            }
            
            # 短暂延迟以确保前端能收到
            await asyncio.sleep(0.3)
            
            # 不再发送第二个初始内容块，简化提示
            
            # 保存会话和消息元数据
            conversation_id = payload.get("conversation_id")
            
            # 使用aiohttp进行请求
            async with aiohttp.ClientSession() as session:
                headers = self.get_headers()
                logger.debug(f"流式请求头: {headers}")
                
                response_start_time = time.time()
                logger.debug(f"开始流式请求的时间: {response_start_time}")
                
                async with session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=120  # 扩展超时时间以处理长对话
                ) as response:
                    # 检查响应状态
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"流式请求失败 - 状态码: {response.status}, 响应: {error_text}")
                        
                        # 如果API请求失败，发送模拟数据以便调试
                        logger.debug("API请求失败，发送模拟数据")
                        yield {
                            "type": "chunk",
                            "content": f"无法连接到AI服务 (错误: {response.status})。调试信息: {error_text[:100]}...",
                            "conversation_id": conversation_id,
                            "user_id": user_id
                        }
                        
                        # 短暂延迟
                        await asyncio.sleep(0.5)
                        
                        # 发送错误
                        yield {
                            "type": "error",
                            "error": f"流式请求失败: {error_text}"
                        }
                        return
                    
                    logger.debug(f"收到流式响应 - 状态码: {response.status}, 内容类型: {response.content_type}")
                    logger.debug(f"响应头: {response.headers}")
                    
                    # 初始化变量用于保存元数据
                    new_conversation_id = None
                    message_id = None
                    chunk_count = 0
                    total_content_size = 0
                    
                    # 遍历流式数据行
                    buffer = ""
                    line_count = 0
                    async for line in response.content:
                        if line:
                            line_count += 1
                            line_text = line.decode('utf-8')
                            buffer += line_text
                            total_content_size += len(line_text)
                            
                            # 每10行日志一次进度
                            if line_count % 10 == 0:
                                logger.debug(f"已接收 {line_count} 行数据，总大小: {total_content_size} 字节")
                            
                            # 如果是第一行，记录首个响应时间
                            if line_count == 1:
                                first_chunk_time = time.time()
                                logger.debug(f"收到第一个数据块，耗时: {first_chunk_time - response_start_time:.3f}秒")
                                logger.debug(f"首个数据块内容: {line_text[:100]}...")
                            
                            # 处理完整的SSE消息（以\n\n分隔）
                            if '\n\n' in buffer:
                                parts = buffer.split('\n\n')
                                buffer = parts[-1]  # 保留最后一个可能不完整的部分
                                
                                for part in parts[:-1]:  # 处理完整的消息
                                    if part.startswith('data: '):
                                        chunk_count += 1
                                        data_json = part[6:].strip()  # 移除'data: '前缀
                                        
                                        try:
                                            data = json.loads(data_json)
                                            logger.debug(f"解析的SSE数据 #{chunk_count}: {data}")
                                            
                                            # 处理不同类型的消息
                                            event_type = data.get('event')
                                            logger.debug(f"事件类型: {event_type}")
                                            
                                            # 提取元数据
                                            if 'conversation_id' in data and not new_conversation_id:
                                                new_conversation_id = data['conversation_id']
                                                logger.debug(f"从流中提取会话ID: {new_conversation_id}")
                                                # 如果是新会话，缓存会话信息
                                                if new_conversation_id != conversation_id:
                                                    self._cache_session(new_conversation_id, user_id)
                                                    yield {
                                                        "type": "metadata",
                                                        "conversation_id": new_conversation_id,
                                                        "user_id": user_id,
                                                        "is_new_conversation": True
                                                    }
                                            
                                            if 'id' in data and not message_id:
                                                message_id = data['id']
                                                logger.debug(f"从流中提取消息ID: {message_id}")
                                            
                                            # 消息内容
                                            if event_type == 'message':
                                                message_content = data.get('answer', '')
                                                logger.debug(f"收到消息内容块 #{chunk_count}: {message_content[:50]}...")
                                                # 注意：这里不要转换事件类型，直接传递原始的 message 类型
                                                yield {
                                                    "type": "message",
                                                    "content": message_content,
                                                    "answer": message_content,  # 同时传递 answer 字段，以确保前端能够处理
                                                    "conversation_id": new_conversation_id or conversation_id,
                                                    "message_id": message_id,
                                                    "user_id": user_id
                                                }
                                            # 结束标记
                                            elif event_type == 'done' or event_type == 'message_end':
                                                logger.debug("收到流式响应结束标记")
                                                yield {
                                                    "type": "end",
                                                    "conversation_id": new_conversation_id or conversation_id,
                                                    "message_id": message_id,
                                                    "user_id": user_id
                                                }
                                            # 错误处理
                                            elif event_type == 'error':
                                                error_message = data.get('error', '未知错误')
                                                logger.error(f"流式响应错误: {error_message}")
                                                yield {
                                                    "type": "error",
                                                    "error": error_message,
                                                    "conversation_id": new_conversation_id or conversation_id,
                                                    "user_id": user_id
                                                }
                                                
                                            # 为了调试，记录所有未处理的事件类型
                                            else:
                                                logger.warning(f"未处理的事件类型: {event_type}, 数据: {data}")
                                                # 尝试从事件中提取回答内容
                                                answer_content = None
                                                if 'answer' in data:
                                                    answer_content = data.get('answer')
                                                    logger.debug(f"从未知事件中提取到answer内容: {answer_content[:50] if answer_content else 'None'}")
                                                elif 'text' in data:
                                                    answer_content = data.get('text')
                                                    logger.debug(f"从未知事件中提取到text内容: {answer_content[:50] if answer_content else 'None'}")
                                                elif 'content' in data:
                                                    answer_content = data.get('content')
                                                    logger.debug(f"从未知事件中提取到content内容: {answer_content[:50] if answer_content else 'None'}")
                                                
                                                # 如果能提取到内容，也发送为chunk
                                                if answer_content:
                                                    yield {
                                                        "type": "chunk",
                                                        "content": answer_content,
                                                        "conversation_id": new_conversation_id or conversation_id,
                                                        "message_id": message_id,
                                                        "user_id": user_id
                                                    }
                                        except json.JSONDecodeError:
                                            logger.error(f"解析JSON失败: {data_json}")
                                            continue
                    
                    # 如果缓冲区中还有数据，处理它
                    if buffer.strip():
                        if buffer.startswith('data: '):
                            try:
                                data_json = buffer[6:].strip()
                                data = json.loads(data_json)
                                
                                # 处理最后一条消息
                                event_type = data.get('event')
                                if event_type == 'message':
                                    message_content = data.get('answer', '')
                                    logger.debug(f"处理缓冲区中的最后一条消息: {message_content[:50]}...")
                                    yield {
                                        "type": "chunk",
                                        "content": message_content,
                                        "conversation_id": new_conversation_id or conversation_id,
                                        "message_id": message_id,
                                        "user_id": user_id
                                    }
                            except Exception as e:
                                logger.error(f"处理缓冲区中的最后一条消息失败: {str(e)}")
                    
                    # 流处理统计
                    response_end_time = time.time()
                    total_time = response_end_time - response_start_time
                    logger.info(f"流式响应处理完成 - 总计 {chunk_count} 个数据块, 总大小: {total_content_size} 字节, 总耗时: {total_time:.3f}秒")
                    
                    # 如果只收到一个数据块，可能不是真正的流式响应
                    if chunk_count <= 1:
                        logger.warning("只收到一个数据块，可能不是真正的流式响应")
                    
                    # 如果没有收到任何数据块，生成测试数据
                    if chunk_count == 0:
                        logger.warning("未收到任何数据块，生成测试数据")
                        
                        # 发送多个测试数据块
                        test_data = [
                            "这是测试数据块1。我们正在测试流式响应功能。  \n  \n",  # 使用markdown格式的换行
                            "这是测试数据块2。前端应该能够实时显示这些内容。  \n  \n",  # 使用markdown格式的换行
                            "这是测试数据块3。每个块应该作为单独的更新显示。  \n  \n",  # 使用markdown格式的换行
                            "这是最后一个测试数据块。流式响应功能测试结束。"
                        ]
                        
                        for i, content in enumerate(test_data):
                            logger.debug(f"发送测试数据块 #{i+1}: {content}")
                            yield {
                                "type": "chunk",
                                "content": content,
                                "conversation_id": conversation_id,
                                "message_id": f"test_msg_{i}",
                                "user_id": user_id
                            }
                            
                            # 延迟以模拟真实的流式响应
                            await asyncio.sleep(1.0)
                    
                    # 确保发送结束标记
                    yield {
                        "type": "end",
                        "conversation_id": new_conversation_id or conversation_id,
                        "message_id": message_id or "test_msg_end",
                        "user_id": user_id
                    }
                    
        except Exception as e:
            error_message = f"流式响应处理失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            
            # 发送一个测试数据块，确保前端有内容显示
            yield {
                "type": "chunk",
                "content": f"处理请求时出错: {str(e)}。调试模式：这是一个测试块，确保前端不会卡住。",
                "conversation_id": payload.get("conversation_id"),
                "user_id": user_id
            }
            
            yield {
                "type": "error",
                "error": error_message
            }

    async def stream_chat(self, conversation_id: Optional[str], message: str, 
                          user_id: Optional[str] = None, 
                          inputs: Optional[Dict[str, Any]] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """流式聊天，返回异步生成器"""
        try:
            # 检查是否有缓存的用户ID
            cached_user_id = self._get_cached_user_id(conversation_id) if conversation_id else None
            
            # 如果未提供用户ID，尝试使用缓存的用户ID
            if not user_id and cached_user_id:
                user_id = cached_user_id
                logger.info(f"使用缓存的用户ID: {user_id}")
            # 如果仍然没有用户ID，生成一个新的
            elif not user_id:
                user_id = str(uuid.uuid4())
                logger.info(f"未提供用户ID，已生成新ID: {user_id}")
                
            # 准备请求负载
            payload = {
                "inputs": inputs or {},
                "query": message,
                "response_mode": "streaming",  # 始终使用流式模式
                "user": user_id
            }
            
            # 如果有会话ID，添加到负载中
            if conversation_id:
                payload["conversation_id"] = conversation_id
                logger.info(f"流式聊天 - 会话ID: {conversation_id}, 用户ID: {user_id}, 消息: '{message[:100]}...'")
            else:
                logger.info(f"流式聊天(新会话) - 用户ID: {user_id}, 消息: '{message[:100]}...'")
            
            # 构建API URL
            url = f"{self.base_url}/chat-messages"
            logger.info(f"准备进行流式请求 - URL: {url}")
            
            # 使用stream_response方法实现真正的流式响应
            async for chunk in self.stream_response(url, payload, user_id):
                # 确保所有事件都符合前端预期的格式
                # 直接传递事件，保持原始的event字段
                yield chunk
                
        except Exception as e:
            error_message = f"流式聊天失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            # 错误也使用Dify API格式
            yield {
                "event": "error",
                "error": error_message
            }

    async def get_vulnerability_advice(self, vulnerability_data: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]:
        """获取漏洞建议 - 返回流式响应"""
        try:
            logger.info(f"开始处理漏洞建议请求，数据类型: {type(vulnerability_data)}")
            logger.debug(f"漏洞数据内容: {vulnerability_data}")
            
            # 提取基本漏洞信息，添加默认值以处理缺少字段的情况
            vuln_name = vulnerability_data.get("name", "未知漏洞")
            vuln_id = vulnerability_data.get("cve_id", "无CVE")
            vuln_risk = vulnerability_data.get("risk_level", "未知")
            vuln_desc = vulnerability_data.get("description", "无描述")
            
            # 输出更详细的调试信息
            logger.debug(f"提取的漏洞信息: 名称={vuln_name}, CVE={vuln_id}, 风险等级={vuln_risk}")
            
            # 构建提示词
            prompt = f"""
            请分析以下安全漏洞并提供详细建议:
            
            漏洞名称: {vuln_name}
            CVE编号: {vuln_id}
            风险等级: {vuln_risk}
            漏洞描述: {vuln_desc}
            
            请提供以下信息:
            1. 此漏洞的详细技术分析
            2. 可能的攻击场景和影响
            3. 修复建议和最佳实践
            4. 如何验证修复是否成功
            """
            
            logger.info(f"生成漏洞建议 - 漏洞: {vuln_name}, CVE: {vuln_id}")
            logger.debug(f"生成的提示词: {prompt}")
            
            # 从漏洞数据中获取用户ID（如果有）
            user_id = vulnerability_data.get("user_id")
            conversation_id = vulnerability_data.get("conversation_id")
            logger.info(f"使用的用户ID: {user_id}, 会话ID: {conversation_id}")
            
            # 使用stream_chat方法进行真正的流式响应
            try:
                logger.info("使用stream_chat进行流式漏洞分析...")
                
                # 无论是否有会话ID，都使用stream_chat方法
                async for chunk in self.stream_chat(conversation_id, prompt, user_id):
                    # 直接返回来自stream_chat的事件，保持同样的格式
                    yield chunk
                    
            except Exception as inner_e:
                logger.error(f"流式漏洞分析失败: {str(inner_e)}")
                logger.error(traceback.format_exc())
                
                # 返回错误事件
                yield {
                    "event": "error",
                    "error": f"漏洞分析失败: {str(inner_e)}",
                    "conversation_id": conversation_id,
                    "user_id": user_id
                }
                
        except Exception as e:
            error_message = f"获取漏洞建议失败: {str(e)}"
            logger.error(error_message)
            logger.error(traceback.format_exc())
            
            # 返回错误事件
            yield {
                "event": "error",
                "error": error_message
            }

def import_time_module():
    """导入time模块的辅助函数"""
    import time
    return time

# 创建服务实例
dify_service = DifyService()