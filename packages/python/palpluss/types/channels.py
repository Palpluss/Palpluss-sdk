from __future__ import annotations

from typing_extensions import TypedDict

from .common import ChannelType


class PaymentWalletChannel(TypedDict):
    id: str
    tenantId: str
    category: str
    type: ChannelType
    shortcode: str
    name: str
    accountNumber: str | None
    isDefault: bool
    createdAt: str
