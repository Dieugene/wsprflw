"""
Transcription API endpoints
"""

from uuid import UUID
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.logging_config import logger
from app.db.database import get_db
from app.models.transcription import Transcription, TranscriptionStatus
from app.schemas.transcription import (
    TranscriptionCreate,
    TranscriptionJobResponse,
    TranscriptionStatusResponse,
    TranscriptionResultResponse,
    ErrorResponse,
)
from app.services.openai_service import openai_service
from app.core.config import settings

router = APIRouter()


async def process_transcription(
    transcription_id: UUID,
    audio_data: bytes,
    filename: str,
    language: str,
    model: str,
    temperature: float,
    response_format: str,
):
    """
    Background task to process transcription
    """
    from app.db.database import async_session_maker
    from app.api.websocket import send_progress_update, send_transcription_completed, send_transcription_failed

    async with async_session_maker() as session:
        try:
            # Update status to processing
            result = await session.execute(
                select(Transcription).where(Transcription.id == transcription_id)
            )
            transcription = result.scalar_one_or_none()

            if not transcription:
                logger.error(f"Transcription {transcription_id} not found")
                return

            transcription.status = TranscriptionStatus.PROCESSING
            transcription.progress = 10
            await session.commit()

            # Send WebSocket update
            await send_progress_update(
                transcription_id,
                10,
                TranscriptionStatus.PROCESSING.value,
                "Starting transcription...",
            )

            # Call OpenAI Whisper API
            logger.info(f"Starting transcription for job {transcription_id}")
            await send_progress_update(
                transcription_id,
                30,
                TranscriptionStatus.PROCESSING.value,
                "Transcribing audio...",
            )

            transcription_result = await openai_service.transcribe_audio(
                audio_file=audio_data,
                filename=filename,
                language=language,
                model=model,
                temperature=temperature,
                response_format=response_format,
            )

            # Update transcription with results
            transcription.transcription_text = transcription_result.get("text", "")
            transcription.audio_duration = transcription_result.get("duration")
            transcription.segments = transcription_result.get("segments")
            transcription.status = TranscriptionStatus.COMPLETED
            transcription.progress = 100

            await session.commit()
            logger.info(f"Transcription {transcription_id} completed successfully")

            # Send WebSocket completion notification
            await send_transcription_completed(
                transcription_id,
                transcription.transcription_text,
                transcription.audio_duration or 0.0,
            )

        except Exception as e:
            logger.error(
                f"Error processing transcription {transcription_id}: {e}", exc_info=True
            )
            # Update status to failed
            transcription.status = TranscriptionStatus.FAILED
            transcription.error_message = str(e)
            transcription.retry_count += 1
            await session.commit()

            # Send WebSocket failure notification
            await send_transcription_failed(transcription_id, str(e))


@router.post(
    "/transcribe",
    response_model=TranscriptionJobResponse,
    responses={
        400: {"model": ErrorResponse},
        413: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Upload audio file for transcription",
    description="Upload an audio file to be transcribed using OpenAI Whisper API",
)
async def create_transcription(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = "ru",
    model: str = "whisper-1",
    temperature: float = 0.0,
    response_format: str = "verbose_json",
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new transcription job

    - **file**: Audio file (mp3, mp4, mpeg, mpga, m4a, wav, webm)
    - **language**: Language code (default: ru)
    - **model**: Whisper model (default: whisper-1)
    - **temperature**: Sampling temperature 0-1 (default: 0.0)
    - **response_format**: Response format (default: verbose_json)
    """
    try:
        # Validate file size
        audio_data = await file.read()
        file_size = len(audio_data)

        if file_size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE} bytes)",
            )

        # Validate file format
        allowed_formats = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"]
        file_ext = file.filename.split(".")[-1].lower() if file.filename else ""

        if file_ext not in allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format: {file_ext}. Allowed formats: {', '.join(allowed_formats)}",
            )

        logger.info(
            f"Creating transcription job for file: {file.filename}, size: {file_size} bytes"
        )

        # Create transcription record
        transcription = Transcription(
            audio_filename=file.filename,
            audio_size_bytes=file_size,
            audio_format=file_ext,
            language=language,
            model=model,
            temperature=temperature,
            status=TranscriptionStatus.PENDING,
            progress=0,
        )

        db.add(transcription)
        await db.commit()
        await db.refresh(transcription)

        # Start background task for transcription
        background_tasks.add_task(
            process_transcription,
            transcription.id,
            audio_data,
            file.filename,
            language,
            model,
            temperature,
            response_format,
        )

        logger.info(f"Transcription job created with ID: {transcription.id}")

        return TranscriptionJobResponse(
            id=transcription.id,
            status=transcription.status,
            progress=transcription.progress,
            created_at=transcription.created_at,
            message="Transcription job created successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get(
    "/transcribe/{transcription_id}",
    response_model=TranscriptionResultResponse,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Get transcription status and result",
    description="Get the status and result of a transcription job",
)
async def get_transcription(
    transcription_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get transcription job status and result

    - **transcription_id**: UUID of the transcription job
    """
    try:
        result = await db.execute(
            select(Transcription).where(Transcription.id == transcription_id)
        )
        transcription = result.scalar_one_or_none()

        if not transcription:
            raise HTTPException(
                status_code=404, detail=f"Transcription {transcription_id} not found"
            )

        if transcription.status != TranscriptionStatus.COMPLETED:
            return TranscriptionStatusResponse(
                id=transcription.id,
                status=transcription.status,
                progress=transcription.progress,
                created_at=transcription.created_at,
                updated_at=transcription.updated_at,
                audio_duration=transcription.audio_duration,
                error_message=transcription.error_message,
            )

        return TranscriptionResultResponse(
            id=transcription.id,
            status=transcription.status,
            transcription_text=transcription.transcription_text,
            language=transcription.language,
            audio_duration=transcription.audio_duration,
            segments=transcription.segments,
            created_at=transcription.created_at,
            completed_at=transcription.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transcription {transcription_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
