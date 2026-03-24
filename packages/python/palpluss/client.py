from __future__ import annotations

import os
from typing import Any, Literal

from .http.transport import DEFAULT_BASE_URL, AsyncHttpTransport, HttpTransport
from .modules.b2c import AsyncB2cModule, B2cModule
from .modules.channels import AsyncChannelsModule, ChannelsModule
from .modules.stk import AsyncStkModule, StkModule
from .modules.transactions import AsyncTransactionsModule, TransactionsModule
from .modules.wallets import AsyncWalletsModule, WalletsModule
from .types.b2c import B2cPayoutResponse
from .types.channels import PaymentWalletChannel
from .types.stk import StkInitiateResponse
from .types.transactions import Transaction, TransactionListResponse
from .types.wallets import ServiceTopupResponse, ServiceWalletBalance


class PalPluss:
    """Synchronous PalPluss API client.

    Args:
        api_key: Your PalPluss API key. Falls back to the ``PALPLUSS_API_KEY``
            environment variable.
        timeout: Request timeout in seconds. Default: 30.
        auto_retry_on_rate_limit: Automatically retry requests on HTTP 429.
            Default: True.
        max_retries: Maximum number of retry attempts. Default: 3.

    Example::

        from palpluss import PalPluss

        client = PalPluss(api_key="pk_live_...")
        result = client.stk_push(amount=500, phone="254712345678")
        print(result["transactionId"])
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout: float = 30.0,
        auto_retry_on_rate_limit: bool = True,
        max_retries: int = 3,
    ) -> None:
        resolved_key = api_key or os.environ.get("PALPLUSS_API_KEY")
        if not resolved_key:
            raise ValueError("PalPluss: api_key is required")

        base_url = os.environ.get("PALPLUSS_BASE_URL", DEFAULT_BASE_URL)

        transport = HttpTransport(
            api_key=resolved_key,
            base_url=base_url,
            timeout=timeout,
            auto_retry_on_rate_limit=auto_retry_on_rate_limit,
            max_retries=max_retries,
        )

        self._stk = StkModule(transport)
        self._b2c = B2cModule(transport)
        self._wallets = WalletsModule(transport)
        self._transactions = TransactionsModule(transport)
        self._channels = ChannelsModule(transport)
        self._transport = transport

    # ── STK Push ────────────────────────────────────────────────────────────

    def stk_push(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        channel_id: str | None = None,
        callback_url: str | None = None,
        credential_id: str | None = None,
    ) -> StkInitiateResponse:
        return self._stk.initiate(
            amount=amount,
            phone=phone,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            channel_id=channel_id,
            callback_url=callback_url,
            credential_id=credential_id,
        )

    # ── B2C Payout ──────────────────────────────────────────────────────────

    def b2c_payout(
        self,
        *,
        amount: float,
        phone: str,
        currency: str | None = None,
        reference: str | None = None,
        description: str | None = None,
        channel_id: str | None = None,
        credential_id: str | None = None,
        callback_url: str | None = None,
        idempotency_key: str | None = None,
    ) -> B2cPayoutResponse:
        return self._b2c.payout(
            amount=amount,
            phone=phone,
            currency=currency,
            reference=reference,
            description=description,
            channel_id=channel_id,
            credential_id=credential_id,
            callback_url=callback_url,
            idempotency_key=idempotency_key,
        )

    # ── Service Wallet ───────────────────────────────────────────────────────

    def get_service_balance(self) -> ServiceWalletBalance:
        return self._wallets.service_balance()

    def service_topup(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        idempotency_key: str | None = None,
    ) -> ServiceTopupResponse:
        return self._wallets.service_topup(
            amount=amount,
            phone=phone,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            idempotency_key=idempotency_key,
        )

    # ── Transactions ─────────────────────────────────────────────────────────

    def get_transaction(self, transaction_id: str) -> Transaction:
        return self._transactions.get(transaction_id)

    def list_transactions(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        status: str | None = None,
        type: Literal["STK", "B2C"] | None = None,
    ) -> TransactionListResponse:
        return self._transactions.list(
            limit=limit,
            cursor=cursor,
            status=status,
            type=type,
        )

    # ── Payment Wallet Channels ───────────────────────────────────────────────

    def create_channel(
        self,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"],
        shortcode: str,
        name: str,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> PaymentWalletChannel:
        return self._channels.create(
            type=type,
            shortcode=shortcode,
            name=name,
            account_number=account_number,
            is_default=is_default,
        )

    def update_channel(
        self,
        channel_id: str,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"] | None = None,
        shortcode: str | None = None,
        name: str | None = None,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> PaymentWalletChannel:
        return self._channels.update(
            channel_id,
            type=type,
            shortcode=shortcode,
            name=name,
            account_number=account_number,
            is_default=is_default,
        )

    def delete_channel(self, channel_id: str) -> None:
        self._channels.delete(channel_id)

    # ── Resource management ──────────────────────────────────────────────────

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> PalPluss:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


class AsyncPalPluss:
    """Asynchronous PalPluss API client.

    Args:
        api_key: Your PalPluss API key. Falls back to the ``PALPLUSS_API_KEY``
            environment variable.
        timeout: Request timeout in seconds. Default: 30.
        auto_retry_on_rate_limit: Automatically retry requests on HTTP 429.
            Default: True.
        max_retries: Maximum number of retry attempts. Default: 3.

    Example::

        from palpluss import AsyncPalPluss

        async with AsyncPalPluss(api_key="pk_live_...") as client:
            result = await client.stk_push(amount=500, phone="254712345678")
            print(result["transactionId"])
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        timeout: float = 30.0,
        auto_retry_on_rate_limit: bool = True,
        max_retries: int = 3,
    ) -> None:
        resolved_key = api_key or os.environ.get("PALPLUSS_API_KEY")
        if not resolved_key:
            raise ValueError("PalPluss: api_key is required")

        base_url = os.environ.get("PALPLUSS_BASE_URL", DEFAULT_BASE_URL)

        transport = AsyncHttpTransport(
            api_key=resolved_key,
            base_url=base_url,
            timeout=timeout,
            auto_retry_on_rate_limit=auto_retry_on_rate_limit,
            max_retries=max_retries,
        )

        self._stk = AsyncStkModule(transport)
        self._b2c = AsyncB2cModule(transport)
        self._wallets = AsyncWalletsModule(transport)
        self._transactions = AsyncTransactionsModule(transport)
        self._channels = AsyncChannelsModule(transport)
        self._transport = transport

    # ── STK Push ────────────────────────────────────────────────────────────

    async def stk_push(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        channel_id: str | None = None,
        callback_url: str | None = None,
        credential_id: str | None = None,
    ) -> StkInitiateResponse:
        return await self._stk.initiate(
            amount=amount,
            phone=phone,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            channel_id=channel_id,
            callback_url=callback_url,
            credential_id=credential_id,
        )

    # ── B2C Payout ──────────────────────────────────────────────────────────

    async def b2c_payout(
        self,
        *,
        amount: float,
        phone: str,
        currency: str | None = None,
        reference: str | None = None,
        description: str | None = None,
        channel_id: str | None = None,
        credential_id: str | None = None,
        callback_url: str | None = None,
        idempotency_key: str | None = None,
    ) -> B2cPayoutResponse:
        return await self._b2c.payout(
            amount=amount,
            phone=phone,
            currency=currency,
            reference=reference,
            description=description,
            channel_id=channel_id,
            credential_id=credential_id,
            callback_url=callback_url,
            idempotency_key=idempotency_key,
        )

    # ── Service Wallet ───────────────────────────────────────────────────────

    async def get_service_balance(self) -> ServiceWalletBalance:
        return await self._wallets.service_balance()

    async def service_topup(
        self,
        *,
        amount: float,
        phone: str,
        account_reference: str | None = None,
        transaction_desc: str | None = None,
        idempotency_key: str | None = None,
    ) -> ServiceTopupResponse:
        return await self._wallets.service_topup(
            amount=amount,
            phone=phone,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            idempotency_key=idempotency_key,
        )

    # ── Transactions ─────────────────────────────────────────────────────────

    async def get_transaction(self, transaction_id: str) -> Transaction:
        return await self._transactions.get(transaction_id)

    async def list_transactions(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        status: str | None = None,
        type: Literal["STK", "B2C"] | None = None,
    ) -> TransactionListResponse:
        return await self._transactions.list(
            limit=limit,
            cursor=cursor,
            status=status,
            type=type,
        )

    # ── Payment Wallet Channels ───────────────────────────────────────────────

    async def create_channel(
        self,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"],
        shortcode: str,
        name: str,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> PaymentWalletChannel:
        return await self._channels.create(
            type=type,
            shortcode=shortcode,
            name=name,
            account_number=account_number,
            is_default=is_default,
        )

    async def update_channel(
        self,
        channel_id: str,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"] | None = None,
        shortcode: str | None = None,
        name: str | None = None,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> PaymentWalletChannel:
        return await self._channels.update(
            channel_id,
            type=type,
            shortcode=shortcode,
            name=name,
            account_number=account_number,
            is_default=is_default,
        )

    async def delete_channel(self, channel_id: str) -> None:
        await self._channels.delete(channel_id)

    # ── Resource management ──────────────────────────────────────────────────

    async def close(self) -> None:
        await self._transport.close()

    async def __aenter__(self) -> AsyncPalPluss:
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.close()
