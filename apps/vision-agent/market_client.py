from typing import Any

import requests

from schemas import ResolutionSignal, StarterSignal


class MarketClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def post_starter(self, signal: StarterSignal) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/starter/events",
            json=signal.model_dump(),
            timeout=3,
        )
        response.raise_for_status()
        return response.json()

    def post_resolution(self, signal: ResolutionSignal) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/closer/resolutions",
            json=signal.model_dump(),
            timeout=3,
        )
        response.raise_for_status()
        return response.json()

