"""
OpenAI service for transcription and formatting
"""

from typing import Optional, Dict, Any
import openai
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging_config import logger

# Configure OpenAI
openai.api_key = settings.OPENAI_API_KEY
if settings.OPENAI_ORG_ID:
    openai.organization = settings.OPENAI_ORG_ID


class OpenAIService:
    """Service for interacting with OpenAI API"""

    @staticmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
    )
    async def transcribe_audio(
        audio_file: bytes,
        filename: str,
        language: str = "ru",
        model: str = "whisper-1",
        temperature: float = 0.0,
        response_format: str = "verbose_json",
    ) -> Dict[str, Any]:
        """
        Transcribe audio file using OpenAI Whisper API

        Args:
            audio_file: Audio file bytes
            filename: Original filename
            language: Language code (e.g., 'ru', 'en')
            model: Whisper model name
            temperature: Sampling temperature (0-1)
            response_format: Response format (json, verbose_json, text, srt, vtt)

        Returns:
            Dictionary with transcription result

        Raises:
            openai.OpenAIError: If API request fails
        """
        try:
            logger.info(f"Transcribing audio file: {filename}")

            # Create file-like object from bytes
            from io import BytesIO

            audio_buffer = BytesIO(audio_file)
            audio_buffer.name = filename

            # Call Whisper API
            response = await openai.Audio.atranscribe(
                model=model,
                file=audio_buffer,
                language=language,
                temperature=temperature,
                response_format=response_format,
            )

            logger.info(f"Transcription completed for: {filename}")

            # Parse response based on format
            if response_format == "verbose_json":
                return {
                    "text": response.get("text", ""),
                    "language": response.get("language", language),
                    "duration": response.get("duration", 0),
                    "segments": response.get("segments", []),
                }
            else:
                return {
                    "text": response if isinstance(response, str) else response.get("text", ""),
                    "language": language,
                }

        except openai.OpenAIError as e:
            logger.error(f"OpenAI API error during transcription: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during transcription: {e}")
            raise

    @staticmethod
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
    )
    async def format_text(
        text: str,
        format_type: str,
        custom_prompt: Optional[str] = None,
        model: str = None,
        temperature: float = None,
        max_tokens: int = None,
    ) -> str:
        """
        Format text using OpenAI GPT API

        Args:
            text: Text to format
            format_type: Type of formatting (summary, bullets, structured, etc.)
            custom_prompt: Custom formatting prompt
            model: GPT model name (defaults to settings.GPT_MODEL)
            temperature: Sampling temperature (defaults to settings.GPT_TEMPERATURE)
            max_tokens: Maximum tokens in response (defaults to settings.GPT_MAX_TOKENS)

        Returns:
            Formatted text

        Raises:
            openai.OpenAIError: If API request fails
        """
        try:
            # Use defaults from settings if not provided
            model = model or settings.GPT_MODEL
            temperature = temperature if temperature is not None else settings.GPT_TEMPERATURE
            max_tokens = max_tokens or settings.GPT_MAX_TOKENS

            # Prepare system prompt based on format type
            system_prompts = {
                "summary": "Ты профессиональный редактор. Создай краткое резюме следующего текста, сохраняя ключевые моменты и важную информацию.",
                "bullets": "Ты профессиональный редактор. Преобразуй следующий текст в структурированный список пунктов, выделяя основные идеи.",
                "structured": "Ты профессиональный редактор. Структурируй следующий текст с заголовками, разделами и подразделами для лучшей читаемости.",
                "email": "Ты профессиональный редактор. Преобразуй следующий текст в формальное деловое письмо с приветствием, основной частью и заключением.",
                "notes": "Ты профессиональный редактор. Преобразуй следующий текст в структурированные заметки с основными пунктами и важными деталями.",
                "custom": custom_prompt
                or "Ты профессиональный редактор. Отформатируй следующий текст.",
            }

            system_prompt = system_prompts.get(
                format_type, system_prompts["custom"]
            )

            logger.info(f"Formatting text with type: {format_type}")

            # Call GPT API
            response = await openai.ChatCompletion.acreate(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )

            formatted_text = response.choices[0].message.content.strip()
            logger.info(f"Text formatting completed with type: {format_type}")

            return formatted_text

        except openai.OpenAIError as e:
            logger.error(f"OpenAI API error during formatting: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during formatting: {e}")
            raise


# Create service instance
openai_service = OpenAIService()
