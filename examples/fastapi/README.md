# PalPluss — FastAPI Example

Integration pattern for when a Python FastAPI backend calls the PalPluss API directly (via HTTP) or through the future Python SDK.

> The official Python SDK is not yet available. Until it is, use `httpx` or `requests` directly against the PalPluss REST API documented in [`openapi/palpluss-v1.yaml`](../../openapi/palpluss-v1.yaml).

## Direct HTTP example (httpx)

```python
# palpluss_client.py
import base64
import httpx

class PalPlussClient:
    BASE_URL = "https://api.palpluss.com/v1"

    def __init__(self, api_key: str):
        token = base64.b64encode(f"{api_key}:".encode()).decode()
        self._headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }

    def stk_push(self, amount: int, phone: str, account_reference: str = "") -> dict:
        with httpx.Client() as client:
            r = client.post(
                f"{self.BASE_URL}/payments/stk",
                headers=self._headers,
                json={"amount": amount, "phone": phone, "accountReference": account_reference},
            )
            r.raise_for_status()
            return r.json()["data"]
```

```python
# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from .palpluss_client import PalPlussClient

app = FastAPI()
palpluss = PalPlussClient(api_key=os.environ["PALPLUSS_API_KEY"])


class StkRequest(BaseModel):
    phone: str
    amount: int
    reference: str


@app.post("/pay")
def pay(body: StkRequest):
    try:
        return palpluss.stk_push(body.amount, body.phone, body.reference)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.json())


@app.post("/webhook")
async def webhook(payload: dict):
    event_type = payload.get("event_type")
    if event_type == "transaction.success":
        print("Paid:", payload["transaction"]["mpesa_receipt"])
    return {"ok": True}
```

## When the Python SDK is ready

Replace the manual `PalPlussClient` with:

```python
from palpluss import PalPluss

palpluss = PalPluss(api_key=os.environ["PALPLUSS_API_KEY"])
result = palpluss.stk_push(amount=500, phone="254712345678")
```
