"""
Text formatting API endpoints
"""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.logging_config import logger
from app.db.database import get_db
from app.models.transcription import Transcription, TranscriptionStatus
from app.schemas.transcription import (
    FormattingCreate,
    FormattingResultResponse,
    ErrorResponse,
)
from app.services.openai_service import openai_service

router = APIRouter()


@router.post(
    "/format",
    response_model=FormattingResultResponse,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Format transcribed text",
    description="Format transcribed text using GPT API with various formatting options",
)
async def format_text(
    request: FormattingCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Format transcribed text

    - **transcription_id**: UUID of the transcription to format
    - **format_type**: Type of formatting (summary, bullets, structured, email, notes, custom)
    - **custom_prompt**: Optional custom prompt for 'custom' format type
    """
    try:
        # Get transcription
        result = await db.execute(
            select(Transcription).where(Transcription.id == request.transcription_id)
        )
        transcription = result.scalar_one_or_none()

        if not transcription:
            raise HTTPException(
                status_code=404,
                detail=f"Transcription {request.transcription_id} not found",
            )

        if transcription.status != TranscriptionStatus.COMPLETED:
            raise HTTPException(
                status_code=400,
                detail=f"Transcription is not completed yet. Current status: {transcription.status}",
            )

        if not transcription.transcription_text:
            raise HTTPException(
                status_code=400,
                detail="Transcription text is empty",
            )

        logger.info(
            f"Formatting text for transcription {request.transcription_id} with format type: {request.format_type}"
        )

        # Format text using OpenAI GPT
        formatted_text = await openai_service.format_text(
            text=transcription.transcription_text,
            format_type=request.format_type.value,
            custom_prompt=request.custom_prompt,
        )

        # Update transcription with formatted text
        transcription.formatted_text = formatted_text
        transcription.format_type = request.format_type

        await db.commit()
        await db.refresh(transcription)

        logger.info(
            f"Text formatted successfully for transcription {request.transcription_id}"
        )

        return FormattingResultResponse(
            id=transcription.id,
            transcription_id=transcription.id,
            format_type=transcription.format_type,
            formatted_text=transcription.formatted_text,
            created_at=transcription.updated_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error formatting text for transcription {request.transcription_id}: {e}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
