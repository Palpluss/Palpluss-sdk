package palpluss

import (
	"encoding/json"
	"fmt"
)

var validEventTypes = map[string]bool{
	"transaction.success":   true,
	"transaction.failed":    true,
	"transaction.cancelled": true,
	"transaction.expired":   true,
	"transaction.updated":   true,
}

// ParseWebhookPayload parses and validates a raw webhook request body.
//
// It returns a typed WebhookPayload or a descriptive error if the payload is
// missing required fields or contains unexpected values.
func ParseWebhookPayload(raw []byte) (*WebhookPayload, error) {
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("palpluss/webhooks: invalid JSON: %w", err)
	}

	event, _ := parsed["event"].(string)
	if event != "transaction.updated" {
		return nil, fmt.Errorf("palpluss/webhooks: unexpected event %q", event)
	}

	eventType, ok := parsed["event_type"].(string)
	if !ok || eventType == "" {
		return nil, fmt.Errorf("palpluss/webhooks: missing event_type")
	}
	if !validEventTypes[eventType] {
		return nil, fmt.Errorf("palpluss/webhooks: unknown event_type %q", eventType)
	}

	txnRaw, ok := parsed["transaction"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("palpluss/webhooks: missing transaction object")
	}

	if _, ok := txnRaw["id"].(string); !ok {
		return nil, fmt.Errorf("palpluss/webhooks: transaction missing id")
	}
	if _, ok := txnRaw["status"].(string); !ok {
		return nil, fmt.Errorf("palpluss/webhooks: transaction missing status")
	}

	// Re-decode into the typed struct.
	var payload WebhookPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("palpluss/webhooks: decode payload: %w", err)
	}
	return &payload, nil
}
