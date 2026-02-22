from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


class CreateBetSignal(BaseModel):
    event_id: str
    signal_type: Literal["create_bet"] = "create_bet"
    sport: Literal["F1"] = "F1"
    trigger_type: Literal["YELLOW_FLAG_START", "PIT_STATE_CHANGE", "BATTLE_WINDOW_START", "SAFETY_CAR_START"]
    session_id: str
    timestamp_ms: int
    lap: Optional[int] = None
    driver: Optional[str] = None
    rival_driver: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    cooldown_key: str
    market_duration_ms: int = Field(ge=30_000, le=900_000)
    context: dict[str, Any] = Field(default_factory=dict)


class CloseBetSignal(BaseModel):
    event_id: str
    signal_type: Literal["close_bet"] = "close_bet"
    market_id: str
    timestamp_ms: int
    reason: str = "scanner_close_signal"
    context: dict[str, Any] = Field(default_factory=dict)


ScannerSignal = Union[CreateBetSignal, CloseBetSignal]
