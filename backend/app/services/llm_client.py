"""
LLM 客户端封装
LLM Client Wrapper

提供 OpenAI API 兼容接口的同步/流式调用、自动重试、Token 计数、超时控制与日志记录。
"""

import time
import json
from typing import Optional, List, Dict, Any, Generator, Union
from dataclasses import dataclass, field

try:
    import tiktoken
except ImportError:
    tiktoken = None  # 可选依赖，缺失时降级为字符估算
import httpx
from loguru import logger

from app.core.config import settings


@dataclass
class LLMResponse:
    """LLM 调用响应封装"""
    content: str
    token_usage: Dict[str, int] = field(default_factory=lambda: {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    })
    elapsed_seconds: float = 0.0
    model: str = ""
    finish_reason: str = "stop"


class LLMClient:
    """
    OpenAI API 兼容的 LLM 客户端封装
    
    支持配置化 API_KEY / API_BASE / MODEL_NAME，自动重试、Token 计数、
    超时控制与结构化日志。当 API_KEY 为空时自动降级为回退模式。
    
    Usage:
        client = LLMClient()
        response = client.chat("你好")
        response = client.chat([{"role": "user", "content": "你好"}], 
                                system_prompt="你是一个助手")
        for chunk in client.chat_stream("你好"):
            print(chunk)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
        max_retries: Optional[int] = None,
        temperature: Optional[float] = None,
    ):
        """
        初始化 LLM 客户端
        
        Args:
            api_key: OpenAI API 密钥，默认为 settings.OPENAI_API_KEY
            api_base: API 基础地址，默认为 settings.OPENAI_API_BASE
            model: 模型名称，默认为 settings.OPENAI_MODEL
            timeout: 请求超时秒数，默认为 settings.LLM_TIMEOUT
            max_retries: 最大重试次数，默认为 settings.LLM_MAX_RETRIES
            temperature: 生成温度，默认为 settings.LLM_TEMPERATURE
        """
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.api_base = (api_base or settings.OPENAI_API_BASE).rstrip("/")
        self.model = model or settings.OPENAI_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT
        self.max_retries = max_retries or settings.LLM_MAX_RETRIES
        self.temperature = temperature or settings.LLM_TEMPERATURE
        
        # 检查 API Key 是否可用
        self._fallback_mode = not self.api_key
        if self._fallback_mode:
            logger.warning(
                "[LLMClient] OPENAI_API_KEY 未配置，LLMClient 将运行在回退模式（返回模拟数据）"
            )
        
        # 初始化 Tokenizer
        self._init_tokenizer()
        
        logger.info(
            f"[LLMClient] 初始化完成: model={self.model}, "
            f"api_base={self.api_base}, timeout={self.timeout}s, "
            f"max_retries={self.max_retries}, fallback={self._fallback_mode}"
        )

    def _init_tokenizer(self) -> None:
        """初始化 tiktoken tokenizer，失败时降级"""
        try:
            self._tokenizer = tiktoken.encoding_for_model(self.model)
        except KeyError:
            # 模型名不在 tiktoken 已知列表中，使用 cl100k_base
            try:
                self._tokenizer = tiktoken.get_encoding("cl100k_base")
            except Exception:
                logger.warning("[LLMClient] 无法加载 tiktoken tokenizer，Token 计数降级为字符数估算")
                self._tokenizer = None
        except Exception as e:
            logger.warning(f"[LLMClient] tiktoken 初始化失败: {e}")
            self._tokenizer = None

    def count_tokens(self, text: str) -> int:
        """
        计算文本的 Token 数量
        
        Args:
            text: 输入文本
            
        Returns:
            Token 数量（无法精确计算时返回字符数/4 的估算值）
        """
        if self._tokenizer:
            try:
                return len(self._tokenizer.encode(text))
            except Exception:
                pass
        # 降级估算
        return len(text) // 4 + 1

    def _build_messages(
        self,
        messages: Union[str, List[Dict[str, str]]],
        system_prompt: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """
        构建聊天消息列表
        
        Args:
            messages: 消息内容（字符串或消息列表）
            system_prompt: 可选的系统提示词
            
        Returns:
            格式化的消息列表
        """
        result: List[Dict[str, str]] = []
        
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        
        if isinstance(messages, str):
            result.append({"role": "user", "content": messages})
        elif isinstance(messages, list):
            # 如果消息列表第一条不是 system 消息且我们有 system_prompt，插入
            if system_prompt and not any(m.get("role") == "system" for m in messages):
                result = [{"role": "system", "content": system_prompt}]
                result.extend(messages)
            else:
                result = messages
        
        return result

    def chat(
        self,
        messages: Union[str, List[Dict[str, str]]],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> LLMResponse:
        """
        同步聊天调用
        
        Args:
            messages: 用户消息或消息列表
            system_prompt: 系统提示词
            temperature: 本次调用的温度参数（覆盖默认值）
            max_tokens: 最大生成 Token 数，默认 2000
            
        Returns:
            LLMResponse 包含生成的文本和 Token 使用情况
        """
        start_time = time.time()
        msgs = self._build_messages(messages, system_prompt)
        temperature = temperature if temperature is not None else self.temperature
        max_tokens = max_tokens or 2000
        
        # 记录输入
        logger.info(
            f"[LLMClient.chat] 请求: model={self.model}, "
            f"messages_count={len(msgs)}, temperature={temperature}, "
            f"max_tokens={max_tokens}"
        )
        
        # 回退模式
        if self._fallback_mode:
            return self._fallback_response(msgs, start_time, "chat")
        
        # 构建请求
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        last_error: Optional[Exception] = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        f"{self.api_base}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    data = response.json()
                
                elapsed = time.time() - start_time
                result_content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})
                
                # 记录成功日志
                logger.info(
                    f"[LLMClient.chat] 成功: model={self.model}, "
                    f"prompt_tokens={usage.get('prompt_tokens', 0)}, "
                    f"completion_tokens={usage.get('completion_tokens', 0)}, "
                    f"total_tokens={usage.get('total_tokens', 0)}, "
                    f"elapsed={elapsed:.2f}s, "
                    f"attempt={attempt}/{self.max_retries}"
                )
                
                return LLMResponse(
                    content=result_content,
                    token_usage={
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0),
                        "total_tokens": usage.get("total_tokens", 0),
                    },
                    elapsed_seconds=elapsed,
                    model=self.model,
                    finish_reason=data["choices"][0].get("finish_reason", "stop"),
                )
                
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(
                    f"[LLMClient.chat] 超时 (attempt {attempt}/{self.max_retries}): {e}"
                )
            except httpx.HTTPStatusError as e:
                last_error = e
                logger.warning(
                    f"[LLMClient.chat] HTTP错误 (attempt {attempt}/{self.max_retries}): "
                    f"status={e.response.status_code}, body={e.response.text[:200]}"
                )
                # 4xx 错误不重试（除了 429）
                if e.response.status_code < 500 and e.response.status_code != 429:
                    break
            except httpx.RequestError as e:
                last_error = e
                logger.warning(
                    f"[LLMClient.chat] 请求错误 (attempt {attempt}/{self.max_retries}): {e}"
                )
            except Exception as e:
                last_error = e
                logger.error(
                    f"[LLMClient.chat] 未知错误 (attempt {attempt}/{self.max_retries}): {e}"
                )
                break
            
            # 指数退避等待
            if attempt < self.max_retries:
                sleep_time = 2 ** attempt
                logger.info(f"[LLMClient.chat] 等待 {sleep_time}s 后重试...")
                time.sleep(sleep_time)
        
        # 所有重试失败，记录错误日志
        elapsed = time.time() - start_time
        logger.error(
            f"[LLMClient.chat] 所有重试失败: elapsed={elapsed:.2f}s, "
            f"error={last_error}"
        )
        
        # 降级到回退响应
        logger.warning("[LLMClient.chat] LLM 调用失败，降级到回退模式")
        return self._fallback_response(msgs, start_time, "chat")

    def chat_stream(
        self,
        messages: Union[str, List[Dict[str, str]]],
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> Generator[str, None, None]:
        """
        流式聊天调用
        
        Args:
            messages: 用户消息或消息列表
            system_prompt: 系统提示词
            temperature: 本次调用的温度参数
            max_tokens: 最大生成 Token 数
            
        Yields:
            流式输出的文本片段
        """
        msgs = self._build_messages(messages, system_prompt)
        temperature = temperature if temperature is not None else self.temperature
        max_tokens = max_tokens or 2000
        
        logger.info(
            f"[LLMClient.chat_stream] 请求: model={self.model}, "
            f"messages_count={len(msgs)}"
        )
        
        # 回退模式
        if self._fallback_mode:
            fallback = self._fallback_response(msgs, time.time(), "stream")
            yield fallback.content
            return
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": msgs,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream(
                    "POST",
                    f"{self.api_base}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                delta = chunk["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError, IndexError) as e:
                                logger.warning(f"[LLMClient.chat_stream] 解析数据块失败: {e}")
                                continue
        except Exception as e:
            logger.error(f"[LLMClient.chat_stream] 流式调用失败: {e}")
            # 降级到非流式调用
            logger.warning("[LLMClient.chat_stream] 降级到非流式调用")
            response = self.chat(msgs, temperature=temperature, max_tokens=max_tokens)
            yield response.content

    def _fallback_response(
        self,
        messages: List[Dict[str, str]],
        start_time: float,
        mode: str,
    ) -> LLMResponse:
        """
        回退模式响应（无 API Key 或 API 调用失败时使用）
        
        Args:
            messages: 消息列表
            start_time: 请求开始时间
            mode: 调用模式（"chat" 或 "stream"）
            
        Returns:
            模拟的 LLMResponse
        """
        elapsed = time.time() - start_time
        
        # 从最后一条用户消息提取内容
        user_content = ""
        for msg in reversed(messages):
            if msg["role"] == "user":
                user_content = msg["content"]
                break
        
        # 提取系统提示判断意图
        system_content = ""
        for msg in messages:
            if msg["role"] == "system":
                system_content = msg["content"]
                break
        
        if "SQL 解释" in system_content or "解释 SQL" in system_content:
            content = f"[LLM 回退模式] 无法连接到 LLM 服务进行 SQL 解释。请在 .env 文件中配置 OPENAI_API_KEY 后重试。"
        elif "审计机器人" in system_content or "审计专家" in system_content:
            content = f"[LLM 回退模式] 审计 Agent 当前运行在离线模式。请在 .env 文件中配置 OPENAI_API_KEY 后享受完整功能。您的问题是：{user_content}"
        else:
            content = f"[LLM 回退模式] 当前 LLM 服务未配置。请在 .env 文件中配置 OPENAI_API_KEY 后使用 AI 功能。"
        
        # 估算 Token 数
        prompt_tokens = sum(self.count_tokens(m.get("content", "")) for m in messages)
        
        return LLMResponse(
            content=content,
            token_usage={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": len(content) // 4 + 1,
                "total_tokens": prompt_tokens + len(content) // 4 + 1,
            },
            elapsed_seconds=elapsed,
            model=self.model,
            finish_reason="stop",
        )

    @property
    def is_fallback_mode(self) -> bool:
        """是否为回退模式"""
        return self._fallback_mode
