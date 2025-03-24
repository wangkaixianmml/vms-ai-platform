from fastapi import APIRouter, HTTPException, Depends, Body, Query, Request
from typing import Dict, Any, Optional, List
from app.services.dify_service import dify_service
from app.models.vulnerability import Vulnerability
from pydantic import BaseModel, Field
import logging
from app.models.dify import DifyRequestModel
import json
from fastapi.responses import StreamingResponse
import asyncio
import traceback

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter()

class VulnerabilityAdviceRequest(BaseModel):
    """用于请求漏洞建议的数据模型"""
    name: str = Field(..., description="漏洞名称")
    cve_id: Optional[str] = Field(None, description="CVE编号")
    risk_level: str = Field(..., description="风险等级")
    description: Optional[str] = Field(None, description="漏洞描述")
    affected_assets: list = Field(default_factory=list, description="受影响的资产列表")
    status: Optional[str] = None
    discovery_date: Optional[str] = None
    remediation_steps: Optional[str] = None

@router.post("/get-vulnerability-advice", response_model=Dict[str, Any])
async def get_vulnerability_advice(
    request: VulnerabilityAdviceRequest
):
    """获取基于特定漏洞数据的AI建议"""
    try:
        logger.info(f"收到漏洞分析请求: {request.name}, CVE: {request.cve_id}")
        
        # 转换为字典形式，以便易于处理
        vulnerability_data = request.dict()
        logger.info(f"处理漏洞数据: {vulnerability_data}")
        
        # 调用Dify服务获取漏洞分析
        response = await dify_service.get_vulnerability_advice(vulnerability_data)
        
        # 确保响应中包含必要的字段
        conversation_id = response.get("conversation_id", None)
        user_id = response.get("user", {}).get("id", None) if response.get("user") else None
        
        # 处理可能的不同响应格式
        answer = None
        if "answer" in response:
            answer = response["answer"]
        elif "data" in response and "answer" in response["data"]:
            answer = response["data"]["answer"]
        
        # 构建统一的响应格式
        result = {
            "success": True,
            "data": {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "answer": answer or "无法获取分析结果",
                "message_id": response.get("id")
            }
        }
        
        logger.info(f"漏洞分析请求成功处理，对话ID: {conversation_id}")
        return result
        
    except Exception as e:
        logger.error(f"处理漏洞分析请求失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"获取漏洞分析失败: {str(e)}"
        )

@router.post("/chat")
async def chat_with_ai(request: DifyRequestModel = Body(...)):
    try:
        message = request.message
        conversation_id = request.conversation_id
        user_id = request.user_id
        inputs = request.inputs or {}
        vulnerability_data = request.vulnerability_data
        is_stream = request.stream if hasattr(request, 'stream') else False

        # 记录请求信息
        logger.info(f"接收聊天请求 - 消息: '{message[:50]}...', 会话ID: {conversation_id}, 用户ID: {user_id}, 是否流式: {is_stream}")
        
        # 如果请求是流式，重定向到流式API端点
        if is_stream:
            # 对于流式请求，我们需要返回一个普通响应，因为前端将使用SSE来获取流式响应
            logger.info("请求包含流式标志，但当前端点不支持流式响应，将使用非流式模式处理")
        
        # 检查是否包含漏洞数据
        if vulnerability_data:
            logger.info(f"请求包含漏洞数据，将使用漏洞分析模式")
            response = await dify_service.get_vulnerability_advice(vulnerability_data)
            return {
                "success": True,
                "conversation_id": response.get("conversation_id"),
                "user_id": response.get("user_id"),
                "answer": response.get("answer", "")
            }
        
        # 根据是否有会话ID决定发送首条消息还是继续对话
        if not conversation_id:
            logger.info("没有会话ID，创建新的对话")
            response = await dify_service.send_first_message(message, user_id)
            conversation_id = response.get("conversation_id")
            user_id = response.get("user_id")
            
            logger.info(f"已创建新对话 - ID: {conversation_id}, 用户ID: {user_id}")
            return {
                "success": True,
                "conversation_id": conversation_id,
                "user_id": user_id,
                "answer": response.get("response", "")
            }
        else:
            logger.info(f"继续现有对话 - ID: {conversation_id}")
            response = await dify_service.send_message(conversation_id, message, user_id, inputs)
            
            # 检查是否自动创建了新会话
            is_new_conversation = response.get("is_new_conversation", False)
            if is_new_conversation:
                logger.info(f"会话已过期，已自动创建新会话 - 新ID: {response.get('conversation_id')}")
                
            return {
                "success": True,
                "conversation_id": response.get("conversation_id", conversation_id),
                "user_id": response.get("user_id", user_id),
                "answer": response.get("answer", ""),
                "is_new_conversation": is_new_conversation
            }
            
    except Exception as e:
        error_message = f"与AI聊天时出错: {str(e)}"
        logger.error(error_message)
        return {
            "success": False,
            "error": error_message
        }

@router.post("/chat/stream")
async def stream_chat_with_ai(request: Request):
    """流式聊天接口"""
    logger.info("收到流式聊天请求")
    logger.debug(f"请求URL: {request.url}")
    logger.debug(f"请求方法: {request.method}")
    logger.debug(f"请求头: {request.headers}")
    
    try:
        # 解析请求体
        raw_body = await request.body()
        logger.debug(f"原始请求体: {raw_body}")
        body = await request.json()
        logger.info(f"解析的请求体: {body}")
        
        # 提取信息
        message = body.get("message", "")
        conversation_id = body.get("conversation_id")
        user_id = body.get("user_id")
        inputs = body.get("inputs", {})
        vulnerability_data = body.get("vulnerability_data")
        
        logger.info(f"流式聊天 - 消息: '{message[:30]}...', 会话ID: {conversation_id}, 用户ID: {user_id}")
        logger.info(f"是否包含漏洞数据: {vulnerability_data is not None}")
        
        # 创建一个异步生成器来产生SSE事件
        async def event_generator():
            try:
                # 确保在函数内部可以访问外部的conversation_id和user_id变量
                nonlocal conversation_id, user_id
                
                # 初始化标记，用于跟踪漏洞数据是否已处理
                vulnerability_processed = False
                
                # 首先发送一个符合Dify API规范的初始消息事件
                start_event = "data: " + json.dumps({
                    "event": "message",
                    "answer": "正在准备连接AI服务...  \n  \n",  # 使用markdown格式的换行
                    "conversation_id": conversation_id,
                    "user_id": user_id
                }) + "\n\n"
                logger.info("发送初始message事件")
                yield start_event
                
                # 添加短暂延迟，确保前端收到第一个消息
                await asyncio.sleep(0.3)
                
                # 发送第二个message事件，告知用户我们正在处理
                second_message = "data: " + json.dumps({
                    "event": "message",
                    "answer": "正在处理您的请求...  \n  \n",  # 使用markdown格式的换行
                    "conversation_id": conversation_id,
                    "user_id": user_id
                }) + "\n\n"
                logger.info(f"发送第二个message事件")
                yield second_message
                
                # 处理漏洞数据特殊情况
                if vulnerability_data and not vulnerability_processed:
                    logger.info(f"检测到漏洞数据，将处理漏洞分析...")
                    vulnerability_processed = True
                    
                    try:
                        # 构建漏洞分析提示
                        prompt = f"请分析以下漏洞信息并给出建议：\n\n{json.dumps(vulnerability_data, ensure_ascii=False, indent=2)}"
                        logger.info(f"准备发送漏洞分析请求，提示长度: {len(prompt)}")
                        
                        # 初始化计数器
                        chunk_count = 0
                        
                        # 发送初始分析消息
                        start_analysis_msg = "data: " + json.dumps({
                            "event": "message",
                            "answer": "正在分析漏洞数据...  \n  \n",  # 使用markdown格式的换行
                            "conversation_id": conversation_id,
                            "user_id": user_id
                        }) + "\n\n"
                        yield start_analysis_msg
                        
                        # 延迟很短的时间确保前端收到初始消息
                        await asyncio.sleep(0.3)
                        
                        # 直接使用stream_chat方法发送请求并获取响应
                        try:
                            async for chunk in dify_service.stream_chat(conversation_id, prompt, user_id):
                                # 将字典转换为SSE格式数据
                                if isinstance(chunk, dict):
                                    # 转换为SSE数据格式
                                    chunk_event = "data: " + json.dumps(chunk) + "\n\n"
                                    yield chunk_event
                                else:
                                    # 如果已经是SSE格式的字符串，直接传递
                                    yield chunk
                                chunk_count += 1  # 增加接收到的数据块计数
                        except Exception as inner_e:
                            logger.error(f"漏洞分析请求出错: {str(inner_e)}")
                            logger.error(traceback.format_exc())
                            # 发送错误消息
                            error_event = "data: " + json.dumps({
                                "event": "error",
                                "error": f"漏洞分析请求失败: {str(inner_e)}"
                            }) + "\n\n"
                            yield error_event
                    
                    except Exception as e:
                        # 发送错误信息
                        error_message = f"漏洞分析处理出错: {str(e)}"
                        logger.error(error_message)
                        logger.error(traceback.format_exc())
                        error_event = "data: " + json.dumps({
                            "event": "error",
                            "error": error_message
                        }) + "\n\n"
                        yield error_event
                    
                    # 设置一个标志，以防止普通消息处理逻辑重复运行
                    vulnerability_processed = True
                
                # 跟踪完整回答内容和状态
                full_answer = ""
                chunk_count = 0
                
                # 如果已经处理了漏洞数据，则跳过普通消息处理
                normal_message_processing = True
                if vulnerability_data and vulnerability_processed:
                    logger.info("漏洞数据已处理，跳过普通消息处理")
                    normal_message_processing = False
                
                # 只有当需要处理普通消息时才执行以下代码
                if normal_message_processing:
                    # 构建适合流式处理的分析请求
                    analysis_prompt = ""
                    if vulnerability_data:
                        analysis_prompt = f"请详细分析以下漏洞信息：\n名称：{vulnerability_data.get('name', '未知漏洞')}\nCVE编号：{vulnerability_data.get('cve_id', '无CVE编号')}\n风险等级：{vulnerability_data.get('risk_level', '未知风险')}"
                        
                        if vulnerability_data.get("description"):
                            analysis_prompt += f"\n描述：{vulnerability_data.get('description')}"
                        
                        # 记录我们构建的提示词
                        logger.info(f"为漏洞分析构建提示词: {analysis_prompt[:100]}...")
                    
                    # 决定使用的消息内容
                    stream_message = analysis_prompt if vulnerability_data else message
                    
                    # 使用dify_service.stream_chat实现真正的流式响应
                    logger.info(f"开始流式响应 - 消息类型: {'漏洞分析' if vulnerability_data else '普通消息'}")
                    async for chunk in dify_service.stream_chat(conversation_id, stream_message, user_id, inputs):
                        # 检查chunk是否为字典类型（stream_chat方法的直接返回）
                        if isinstance(chunk, dict):
                            # 处理事件类型，可能来自type字段或event字段
                            chunk_type = chunk.get("type") or chunk.get("event")
                            logger.info(f"收到流事件: 类型={chunk_type}")
                            
                            # 处理元数据
                            if chunk_type == "metadata":
                                logger.info(f"收到元数据: {chunk}")
                                # 如果是新会话，更新会话ID
                                if chunk.get("is_new_conversation"):
                                    conversation_id = chunk.get("conversation_id")
                                    user_id = chunk.get("user_id")
                                    # 发送会话更新通知
                                    notification_event = "data: " + json.dumps({
                                        "event": "notification",
                                        "message": "会话已更新",
                                        "conversation_id": conversation_id,
                                        "user_id": user_id,
                                        "is_new_conversation": True
                                    }) + "\n\n"
                                    logger.info("发送notification事件")
                                    yield notification_event
                        
                        # 处理内容块 (chunk或message类型)
                        elif chunk_type in ["chunk", "message"]:
                            chunk_count += 1
                            # 试图从不同字段获取内容
                            content = chunk.get("content", "") or chunk.get("answer", "")
                            
                            # 添加到累积的回答（仅用于最终完整回复）
                            full_answer += content
                            
                            # 发送调试日志
                            logger.info(f"准备发送message事件 #{chunk_count}: 内容长度={len(content)}, 内容前30个字符: {content[:30]}")
                            
                            # 构造符合Dify API的message事件
                            chunk_event = "data: " + json.dumps({
                                "event": "message",
                                "answer": content,  # 只发送增量内容
                                "conversation_id": chunk.get("conversation_id") or conversation_id,
                                "user_id": chunk.get("user_id") or user_id,
                                "message_id": chunk.get("message_id")
                            }) + "\n\n"
                            
                            # 发送事件
                            logger.info(f"发送message事件 #{chunk_count}")
                            yield chunk_event
                            logger.info(f"已发送message事件 #{chunk_count}")
                        
                        # 处理结束标记
                        elif chunk_type in ["end", "message_end", "done"]:
                            logger.info("收到结束标记")
                            # 如果收到了会话ID，更新它
                            if chunk.get("conversation_id"):
                                conversation_id = chunk.get("conversation_id")
                            if chunk.get("user_id"):
                                user_id = chunk.get("user_id")
                            
                            # 发送最终消息，使用message_end事件类型
                            message_event = "data: " + json.dumps({
                                "event": "message_end",
                                "answer": full_answer,
                                "conversation_id": conversation_id,
                                "user_id": user_id,
                                "message_id": chunk.get("message_id")
                            }) + "\n\n"
                            logger.info("发送message_end事件（完整消息）")
                            yield message_event
                        
                        # 处理错误
                        elif chunk_type == "error":
                            error_message = chunk.get("error", "未知错误")
                            logger.error(f"流式聊天错误: {error_message}")
                            error_event = "data: " + json.dumps({
                                "event": "error",
                                "error": error_message
                            }) + "\n\n"
                            logger.info("发送error事件")
                            yield error_event
                        # 如果已经是SSE格式的字符串，直接传递
                        else:
                            # 直接传递已经是SSE格式的数据
                            yield chunk
                
                # 如果没有收到任何chunk事件，发送虚拟数据以测试连接
                if chunk_count == 0:
                    logger.warning("未收到任何chunk事件，发送测试数据")
                    test_message = "data: " + json.dumps({
                        "event": "message",
                        "answer": "服务器正在处理您的请求...  \n  \n",  # 使用markdown格式的换行：行尾两个空格+换行
                        "conversation_id": conversation_id,
                        "user_id": user_id
                    }) + "\n\n"
                    yield test_message
                    
                    # 短暂延迟
                    await asyncio.sleep(1.0)
                    
                    # 发送结束消息
                    logger.info("发送备用message_end事件")
                    end_message = "data: " + json.dumps({
                        "event": "message_end",
                        "answer": "很抱歉，服务器未能生成有效响应。  \n  \n请尝试刷新页面或重新提问。",  # 使用markdown格式的换行
                        "conversation_id": conversation_id,
                        "user_id": user_id
                    }) + "\n\n"
                    yield end_message
            
            except Exception as e:
                # 发送错误信息
                error_message = f"流式聊天出错: {str(e)}"
                logger.error(error_message)
                logger.error(traceback.format_exc())
                error_event = "data: " + json.dumps({
                    "event": "error",
                    "error": error_message
                }) + "\n\n"
                yield error_event
        
        # 返回流式响应
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'text/event-stream',
                'Access-Control-Allow-Origin': '*',
            }
        )
        
    except Exception as e:
        error_message = f"处理流式聊天请求时出错: {str(e)}"
        logger.error(error_message)
        return {
            "success": False,
            "error": error_message
        }

@router.get("/conversations")
async def get_conversations():
    """获取所有会话列表"""
    try:
        conversations = await dify_service.get_conversations()
        return {"success": True, "conversations": conversations}
    except Exception as e:
        error_message = f"获取会话列表失败: {str(e)}"
        logger.error(error_message)
        return {"success": False, "error": error_message}

@router.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """获取特定会话详情"""
    try:
        conversation = await dify_service.get_conversation(conversation_id)
        return {"success": True, "conversation": conversation}
    except Exception as e:
        error_message = f"获取会话详情失败: {str(e)}"
        logger.error(error_message)
        return {"success": False, "error": error_message}

@router.get("/conversation/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str):
    """获取特定会话的所有消息"""
    try:
        messages = await dify_service.get_conversation_messages(conversation_id)
        return {"success": True, "messages": messages}
    except Exception as e:
        error_message = f"获取会话消息失败: {str(e)}"
        logger.error(error_message)
        return {"success": False, "error": error_message}