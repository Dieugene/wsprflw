"""
Logging configuration for the application
"""

import logging
import sys
from pythonjsonlogger import jsonlogger

from app.core.config import settings


def setup_logging() -> logging.Logger:
    """
    Setup logging configuration with JSON formatter for production
    """
    logger = logging.getLogger("whisperflow")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

    # Remove existing handlers
    logger.handlers.clear()

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))

    # Format based on environment
    if settings.is_production:
        # JSON format for production (easier to parse in log aggregators)
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    else:
        # Human-readable format for development
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


# Create logger instance
logger = setup_logging()
