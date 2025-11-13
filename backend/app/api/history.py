"""
History API endpoints
"""

from typing import Optional
from uuid import UUID
import os
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_

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
    description="Get paginated list of transcription history with search and filter support",
)
async def get_history(
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page (1-100)"),
    search: Optional[str] = Query(None, description="Search in audio filename and transcription text"),
    status: Optional[str] = Query(None, description="Filter by status (pending, processing, completed, failed)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get transcription history with pagination, search, and filtering

    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 20, max: 100)
    - **search**: Search query for filename and transcription text
    - **status**: Filter by transcription status
    """
    try:
        # Calculate offset
        offset = (page - 1) * page_size

        # Build base query
        base_query = select(Transcription)

        # Apply search filter
        if search:
            search_filter = or_(
                Transcription.audio_filename.ilike(f"%{search}%"),
                Transcription.transcription_text.ilike(f"%{search}%")
            )
            base_query = base_query.where(search_filter)

        # Apply status filter
        if status:
            base_query = base_query.where(Transcription.status == status)

        # Get total count with filters
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Get transcriptions with pagination
        query = (
            base_query
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


@router.delete(
    "/history/{transcription_id}",
    status_code=204,
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
    summary="Delete transcription history item",
    description="Delete a transcription and all associated data",
)
async def delete_history_item(
    transcription_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a transcription history item

    - **transcription_id**: UUID of transcription to delete
    """
    try:
        # Find the transcription
        query = select(Transcription).where(Transcription.id == transcription_id)
        result = await db.execute(query)
        transcription = result.scalar_one_or_none()

        if not transcription:
            raise HTTPException(
                status_code=404,
                detail=f"Transcription with ID {transcription_id} not found"
            )

        # Delete audio file if it exists
        if transcription.audio_file_path and os.path.exists(transcription.audio_file_path):
            try:
                os.remove(transcription.audio_file_path)
                logger.info(f"Deleted audio file: {transcription.audio_file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete audio file {transcription.audio_file_path}: {e}")

        # Delete the transcription
        await db.delete(transcription)
        await db.commit()

        logger.info(f"Deleted transcription: {transcription_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
