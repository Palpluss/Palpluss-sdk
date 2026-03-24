from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from ..http.transport import AsyncHttpTransport, HttpTransport


class ChannelsModule:
    def __init__(self, transport: HttpTransport) -> None:
        self._transport = transport

    def create(
        self,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"],
        shortcode: str,
        name: str,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> Any:
        body: dict[str, Any] = {"type": type, "shortcode": shortcode, "name": name}
        if account_number is not None:
            body["accountNumber"] = account_number
        if is_default is not None:
            body["isDefault"] = is_default
        return self._transport.request("POST", "/payment-wallet/channels", body=body)

    def update(
        self,
        channel_id: str,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"] | None = None,
        shortcode: str | None = None,
        name: str | None = None,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> Any:
        body: dict[str, Any] = {}
        if type is not None:
            body["type"] = type
        if shortcode is not None:
            body["shortcode"] = shortcode
        if name is not None:
            body["name"] = name
        if account_number is not None:
            body["accountNumber"] = account_number
        if is_default is not None:
            body["isDefault"] = is_default
        return self._transport.request(
            "PATCH", f"/payment-wallet/channels/{channel_id}", body=body
        )

    def delete(self, channel_id: str) -> None:
        self._transport.request("DELETE", f"/payment-wallet/channels/{channel_id}")


class AsyncChannelsModule:
    def __init__(self, transport: AsyncHttpTransport) -> None:
        self._transport = transport

    async def create(
        self,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"],
        shortcode: str,
        name: str,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> Any:
        body: dict[str, Any] = {"type": type, "shortcode": shortcode, "name": name}
        if account_number is not None:
            body["accountNumber"] = account_number
        if is_default is not None:
            body["isDefault"] = is_default
        return await self._transport.request("POST", "/payment-wallet/channels", body=body)

    async def update(
        self,
        channel_id: str,
        *,
        type: Literal["PAYBILL", "TILL", "SHORTCODE"] | None = None,
        shortcode: str | None = None,
        name: str | None = None,
        account_number: str | None = None,
        is_default: bool | None = None,
    ) -> Any:
        body: dict[str, Any] = {}
        if type is not None:
            body["type"] = type
        if shortcode is not None:
            body["shortcode"] = shortcode
        if name is not None:
            body["name"] = name
        if account_number is not None:
            body["accountNumber"] = account_number
        if is_default is not None:
            body["isDefault"] = is_default
        return await self._transport.request(
            "PATCH", f"/payment-wallet/channels/{channel_id}", body=body
        )

    async def delete(self, channel_id: str) -> None:
        await self._transport.request("DELETE", f"/payment-wallet/channels/{channel_id}")
