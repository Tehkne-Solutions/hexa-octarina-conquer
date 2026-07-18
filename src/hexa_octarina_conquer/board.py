from .board_geometry import BoardGeometryMixin, Cell, Edge, Point
from .province_rules import ProvinceRulesMixin


class BoardMixin(BoardGeometryMixin, ProvinceRulesMixin):
    pass


__all__ = ["BoardMixin", "Cell", "Edge", "Point"]
