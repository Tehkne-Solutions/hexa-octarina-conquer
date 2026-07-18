from .duel_detection import DuelDetectionMixin
from .duel_resolution import DuelResolutionMixin


class DuelMixin(DuelDetectionMixin, DuelResolutionMixin):
    pass


__all__ = ["DuelMixin"]
