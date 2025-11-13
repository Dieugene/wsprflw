"""
Database models for transcription
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum

from app.db.database import Base


class TranscriptionStatus(str, enum.Enum):
    """Transcription job status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FormatType(str, enum.Enum):
    """Text formatting type"""

    SUMMARY = "summary"
    BULLETS = "bullets"
    STRUCTURED = "structured"
    EMAIL = "email"
    NOTES = "notes"
    CUSTOM = "custom"


class Transcription(Base):
    """Transcription model"""

    __tablename__ = "transcriptions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        nullable=True,  # Nullable for MVP without auth
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Audio metadata
    audio_filename = Column(String(255), nullable=True)
    audio_duration = Column(Float, nullable=True)  # in seconds
    audio_size_bytes = Column(Integer, nullable=True)
    audio_format = Column(String(10), nullable=True)  # mp3, wav, etc

    # Transcription settings
    language = Column(String(10), default="ru", nullable=False)
    model = Column(String(50), default="whisper-1", nullable=False)
    temperature = Column(Float, default=0.0, nullable=False)

    # Transcription job
    status = Column(
        SQLEnum(TranscriptionStatus),
        default=TranscriptionStatus.PENDING,
        nullable=False,
        index=True,
    )
    progress = Column(Integer, default=0, nullable=False)  # 0-100

    # Results
    transcription_text = Column(Text, nullable=True)
    formatted_text = Column(Text, nullable=True)
    format_type = Column(SQLEnum(FormatType), nullable=True)

    # Timestamps with segments (stored as JSON)
    segments = Column(JSON, nullable=True)

    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Additional metadata
    metadata = Column(JSON, nullable=True)

    def __repr__(self):
        return f"<Transcription(id={self.id}, status={self.status})>"

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "audio_filename": self.audio_filename,
            "audio_duration": self.audio_duration,
            "audio_size_bytes": self.audio_size_bytes,
            "audio_format": self.audio_format,
            "language": self.language,
            "model": self.model,
            "temperature": self.temperature,
            "status": self.status.value if self.status else None,
            "progress": self.progress,
            "transcription_text": self.transcription_text,
            "formatted_text": self.formatted_text,
            "format_type": self.format_type.value if self.format_type else None,
            "segments": self.segments,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "metadata": self.metadata,
        }
