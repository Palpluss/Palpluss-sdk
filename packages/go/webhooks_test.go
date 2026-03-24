package palpluss_test

import (
	"strings"
	"testing"

	palpluss "github.com/palpluss/palpluss-go"
)

func validWebhookPayload(eventType string) []byte {
	return []byte(`{
		"event": "transaction.updated",
		"event_type": "` + eventType + `",
		"transaction": {
			"id": "txn_webhook_001",
			"status": "SUCCESS",
			"amount": 500,
			"phone_number": "254712345678",
			"type": "STK",
			"currency": "KES",
			"provider": "mpesa",
			"tenant_id": "ten_001",
			"created_at": "2024-01-01T00:00:00Z",
			"updated_at": "2024-01-01T00:00:00Z"
		}
	}`)
}

func TestParseWebhookPayload_Valid(t *testing.T) {
	p, err := palpluss.ParseWebhookPayload(validWebhookPayload("transaction.success"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Event != "transaction.updated" {
		t.Errorf("event: got %s", p.Event)
	}
	if p.EventType != "transaction.success" {
		t.Errorf("event_type: got %s", p.EventType)
	}
	if p.Transaction.ID != "txn_webhook_001" {
		t.Errorf("transaction.id: got %s", p.Transaction.ID)
	}
	if p.Transaction.Status != "SUCCESS" {
		t.Errorf("transaction.status: got %s", p.Transaction.Status)
	}
}

func TestParseWebhookPayload_AllEventTypes(t *testing.T) {
	eventTypes := []string{
		"transaction.success",
		"transaction.failed",
		"transaction.cancelled",
		"transaction.expired",
		"transaction.updated",
	}
	for _, et := range eventTypes {
		t.Run(et, func(t *testing.T) {
			p, err := palpluss.ParseWebhookPayload(validWebhookPayload(et))
			if err != nil {
				t.Fatalf("unexpected error for %s: %v", et, err)
			}
			if p.EventType != et {
				t.Errorf("event_type: got %s, want %s", p.EventType, et)
			}
		})
	}
}

func TestParseWebhookPayload_InvalidJSON(t *testing.T) {
	_, err := palpluss.ParseWebhookPayload([]byte("not-valid-json{"))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
	if !strings.Contains(err.Error(), "invalid JSON") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_NotObject(t *testing.T) {
	_, err := palpluss.ParseWebhookPayload([]byte(`["array"]`))
	if err == nil {
		t.Fatal("expected error for non-object payload")
	}
}

func TestParseWebhookPayload_UnexpectedEvent(t *testing.T) {
	raw := []byte(`{
		"event": "payment.created",
		"event_type": "transaction.success",
		"transaction": {"id": "txn_001", "status": "SUCCESS"}
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for unexpected event")
	}
	if !strings.Contains(err.Error(), "unexpected event") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_MissingEventType(t *testing.T) {
	raw := []byte(`{
		"event": "transaction.updated",
		"transaction": {"id": "txn_001", "status": "SUCCESS"}
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for missing event_type")
	}
	if !strings.Contains(err.Error(), "missing event_type") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_UnknownEventType(t *testing.T) {
	raw := []byte(`{
		"event": "transaction.updated",
		"event_type": "transaction.refunded",
		"transaction": {"id": "txn_001", "status": "REVERSED"}
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for unknown event_type")
	}
	if !strings.Contains(err.Error(), "unknown event_type") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_MissingTransaction(t *testing.T) {
	raw := []byte(`{
		"event": "transaction.updated",
		"event_type": "transaction.success"
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for missing transaction")
	}
	if !strings.Contains(err.Error(), "missing transaction") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_MissingTransactionID(t *testing.T) {
	raw := []byte(`{
		"event": "transaction.updated",
		"event_type": "transaction.success",
		"transaction": {"status": "SUCCESS"}
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for missing transaction id")
	}
	if !strings.Contains(err.Error(), "missing id") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseWebhookPayload_MissingTransactionStatus(t *testing.T) {
	raw := []byte(`{
		"event": "transaction.updated",
		"event_type": "transaction.success",
		"transaction": {"id": "txn_001"}
	}`)
	_, err := palpluss.ParseWebhookPayload(raw)
	if err == nil {
		t.Fatal("expected error for missing transaction status")
	}
	if !strings.Contains(err.Error(), "missing status") {
		t.Errorf("unexpected error: %v", err)
	}
}
