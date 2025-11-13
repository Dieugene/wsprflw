"""
Pydantic schemas for transcription API
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.models.transcription import TranscriptionStatus, FormatType


# Base schemas
class TranscriptionSegment(BaseModel):
    """Transcription segment with timestamp"""

    id: int
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Segment text")


# Request schemas
class TranscriptionCreate(BaseModel):
    """Schema for creating transcription job"""

    language: str = Field(default="ru", description="Language code (e.g., 'ru', 'en')")
    model: str = Field(default="whisper-1", description="Whisper model name")
    temperature: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Sampling temperature (0-1)"
    )
    response_format: str = Field(
        default="verbose_json",
        description="Response format (json, verbose_json, text, srt, vtt)",
    )


class FormattingCreate(BaseModel):
    """Schema for text formatting request"""

    transcription_id: UUID = Field(..., description="ID of transcription to format")
    format_type: FormatType = Field(..., description="Type of formatting to apply")
    custom_prompt: Optional[str] = Field(
        None, description="Custom formatting prompt (for 'custom' type)"
    )


# Response schemas
class TranscriptionJobResponse(BaseModel):
    """Response for transcription job creation"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: TranscriptionStatus
    progress: int
    created_at: datetime
    message: str = Field(default="Transcription job created successfully")


class TranscriptionStatusResponse(BaseModel):
    """Response for transcription status check"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: TranscriptionStatus
    progress: int
    created_at: datetime
    updated_at: datetime
    audio_duration: Optional[float] = None
    error_message: Optional[str] = None


class TranscriptionResultResponse(BaseModel):
    """Response for completed transcription"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: TranscriptionStatus
    transcription_text: str
    language: str
    audio_duration: Optional[float] = None
    segments: Optional[List[Dict[str, Any]]] = None
    formatted_text: Optional[str] = None
    format_type: Optional[FormatType] = None
    created_at: datetime
    completed_at: datetime


class FormattingResultResponse(BaseModel):
    """Response for text formatting"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transcription_id: UUID
    format_type: FormatType
    formatted_text: str
    created_at: datetime


class HistoryItemResponse(BaseModel):
    """Response for history item"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    audio_filename: Optional[str] = None
    audio_duration: Optional[float] = None
    status: TranscriptionStatus
    transcription_preview: Optional[str] = None
    formatted_preview: Optional[str] = None
    format_type: Optional[FormatType] = None
    created_at: datetime
    updated_at: datetime


class HistoryListResponse(BaseModel):
    """Response for history list"""

    items: List[HistoryItemResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


# WebSocket message schemas
class WsTranscriptionProgress(BaseModel):
    """WebSocket message for transcription progress"""

    type: str = "transcription_progress"
    job_id: UUID
    progress: int
    status: TranscriptionStatus
    message: Optional[str] = None


class WsTranscriptionCompleted(BaseModel):
    """WebSocket message for completed transcription"""

    type: str = "transcription_completed"
    job_id: UUID
    transcription_text: str
    duration: float


class WsTranscriptionFailed(BaseModel):
    """WebSocket message for failed transcription"""

    type: str = "transcription_failed"
    job_id: UUID
    error: str


# Error response schema
class ErrorResponse(BaseModel):
    """Standard error response"""

    detail: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Error code")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
