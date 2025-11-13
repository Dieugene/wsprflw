"""
History API endpoints
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.logging_config import logger
from app.db.database import get_db
from app.models.transcription import Transcription
from app.schemas.transcription import (
    HistoryItemResponse,
    HistoryListResponse,
    ErrorResponse,
)

router = APIRouter()


@router.get(
    "/history",
    response_model=HistoryListResponse,
    responses={500: {"model": ErrorResponse}},
    summary="Get transcription history",
    description="Get paginated list of transcription history",
)
async def get_history(
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (1-100)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get transcription history with pagination

    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 20, max: 100)
    """
    try:
        # Calculate offset
        offset = (page - 1) * page_size

        # Get total count
        count_query = select(func.count(Transcription.id))
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get transcriptions with pagination
        query = (
            select(Transcription)
            .order_by(desc(Transcription.created_at))
            .limit(page_size)
            .offset(offset)
        )
        result = await db.execute(query)
        transcriptions = result.scalars().all()

        # Convert to response model
        items = []
        for transcription in transcriptions:
            # Create preview of text (first 100 characters)
            transcription_preview = None
            if transcription.transcription_text:
                transcription_preview = (
                    transcription.transcription_text[:100] + "..."
                    if len(transcription.transcription_text) > 100
                    else transcription.transcription_text
                )

            formatted_preview = None
            if transcription.formatted_text:
                formatted_preview = (
                    transcription.formatted_text[:100] + "..."
                    if len(transcription.formatted_text) > 100
                    else transcription.formatted_text
                )

            items.append(
                HistoryItemResponse(
                    id=transcription.id,
                    audio_filename=transcription.audio_filename,
                    audio_duration=transcription.audio_duration,
                    status=transcription.status,
                    transcription_preview=transcription_preview,
                    formatted_preview=formatted_preview,
                    format_type=transcription.format_type,
                    created_at=transcription.created_at,
                    updated_at=transcription.updated_at,
                )
            )

        # Check if there are more pages
        has_more = (offset + page_size) < total

        return HistoryListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    except Exception as e:
        logger.error(f"Error getting history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
