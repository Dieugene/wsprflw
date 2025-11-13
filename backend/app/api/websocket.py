"""
WebSocket endpoints for real-time updates
"""

from typing import Dict, Set
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logging_config import logger

router = APIRouter()


class ConnectionManager:
    """Manager for WebSocket connections"""

    def __init__(self):
        # Map of job_id -> set of websockets
        self.active_connections: Dict[UUID, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, job_id: UUID):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = set()
        self.active_connections[job_id].add(websocket)
        logger.info(f"WebSocket connected for job {job_id}")

    def disconnect(self, websocket: WebSocket, job_id: UUID):
        """Remove a WebSocket connection"""
        if job_id in self.active_connections:
            self.active_connections[job_id].discard(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]
        logger.info(f"WebSocket disconnected for job {job_id}")

    async def send_message(self, job_id: UUID, message: dict):
        """Send a message to all connections for a specific job"""
        if job_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to WebSocket: {e}")
                    disconnected.add(connection)

            # Clean up disconnected connections
            for connection in disconnected:
                self.disconnect(connection, job_id)

    async def broadcast(self, message: dict):
        """Broadcast a message to all active connections"""
        for job_id in list(self.active_connections.keys()):
            await self.send_message(job_id, message)


# Create global connection manager
manager = ConnectionManager()


@router.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: UUID):
    """
    WebSocket endpoint for real-time transcription updates

    - **job_id**: UUID of the transcription job to monitor
    """
    await manager.connect(websocket, job_id)
    try:
        while True:
            # Keep connection alive and wait for messages
            data = await websocket.receive_text()
            # Echo received messages (can be used for heartbeat)
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, job_id)
        logger.info(f"Client disconnected from job {job_id}")
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {e}", exc_info=True)
        manager.disconnect(websocket, job_id)


# Helper function to send progress updates (to be called from transcription tasks)
async def send_progress_update(job_id: UUID, progress: int, status: str, message: str = None):
    """
    Send progress update to all connected clients for a job
    """
    await manager.send_message(
        job_id,
        {
            "type": "transcription_progress",
            "job_id": str(job_id),
            "progress": progress,
            "status": status,
            "message": message,
        },
    )


async def send_transcription_completed(job_id: UUID, transcription_text: str, duration: float):
    """
    Send completion notification to all connected clients for a job
    """
    await manager.send_message(
        job_id,
        {
            "type": "transcription_completed",
            "job_id": str(job_id),
            "transcription_text": transcription_text,
            "duration": duration,
        },
    )


async def send_transcription_failed(job_id: UUID, error: str):
    """
    Send failure notification to all connected clients for a job
    """
    await manager.send_message(
        job_id,
        {
            "type": "transcription_failed",
            "job_id": str(job_id),
            "error": error,
        },
    )
