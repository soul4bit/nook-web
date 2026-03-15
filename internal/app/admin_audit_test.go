package app

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestParsePositivePage(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want int
	}{
		{name: "empty", raw: "", want: 1},
		{name: "invalid", raw: "abc", want: 1},
		{name: "zero", raw: "0", want: 1},
		{name: "negative", raw: "-3", want: 1},
		{name: "valid", raw: "2", want: 2},
		{name: "trimmed", raw: " 7 ", want: 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parsePositivePage(tt.raw); got != tt.want {
				t.Fatalf("parsePositivePage(%q) = %d, want %d", tt.raw, got, tt.want)
			}
		})
	}
}

func TestListAdminAuditEntriesPaginationHasNext(t *testing.T) {
	app, mock := newSQLMockApplication(t)

	const (
		limit  = 7
		offset = 0
	)

	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{
		"id",
		"action",
		"admin_name",
		"target_email",
		"details",
		"created_at",
		"target_user_id",
		"admin_user_id",
	})
	for i := 1; i <= limit+1; i++ {
		rows.AddRow(
			i,
			adminAuditActionChangeUserRole,
			"admin",
			"",
			"details",
			now,
			nil,
			nil,
		)
	}

	mock.ExpectQuery(`(?s)from admin_audit_log l`).
		WithArgs(limit+1, offset).
		WillReturnRows(rows)

	entries, hasNext, err := app.listAdminAuditEntries(limit, offset)
	if err != nil {
		t.Fatalf("listAdminAuditEntries() error = %v", err)
	}
	if !hasNext {
		t.Fatalf("hasNext = %t, want %t", hasNext, true)
	}
	if len(entries) != limit {
		t.Fatalf("len(entries) = %d, want %d", len(entries), limit)
	}
	if entries[0].ActionLabel == "" {
		t.Fatal("ActionLabel must be filled")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
