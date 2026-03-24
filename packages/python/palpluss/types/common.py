from __future__ import annotations

from typing import Literal

TransactionStatus = Literal[
    "PENDING", "PROCESSING", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REVERSED"
]

TransactionType = Literal["STK", "B2C", "WALLET_TOPUP_SERVICE_TOKENS"]

ChannelType = Literal["PAYBILL", "TILL", "SHORTCODE"]
