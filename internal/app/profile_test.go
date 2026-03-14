package app

import (
	"database/sql"
	"testing"
	"time"
)

func TestPasswordChangeBlockedUntil(t *testing.T) {
	now := time.Date(2026, time.January, 15, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name        string
		lastChanged sql.NullTime
		wantBlocked bool
		wantNextAt  time.Time
	}{
		{
			name:        "never changed",
			lastChanged: sql.NullTime{Valid: false},
			wantBlocked: false,
		},
		{
			name: "changed recently",
			lastChanged: sql.NullTime{
				Time:  now.Add(-48 * time.Hour),
				Valid: true,
			},
			wantBlocked: true,
			wantNextAt:  now.Add(-48 * time.Hour).Add(profilePasswordChangeInterval),
		},
		{
			name: "change window elapsed",
			lastChanged: sql.NullTime{
				Time:  now.Add(-9 * 24 * time.Hour),
				Valid: true,
			},
			wantBlocked: false,
			wantNextAt:  now.Add(-9 * 24 * time.Hour).Add(profilePasswordChangeInterval),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nextAt, blocked := passwordChangeBlockedUntil(tt.lastChanged, now)
			if blocked != tt.wantBlocked {
				t.Fatalf("blocked = %v, want %v", blocked, tt.wantBlocked)
			}
			if !nextAt.Equal(tt.wantNextAt) {
				t.Fatalf("nextAt = %v, want %v", nextAt, tt.wantNextAt)
			}
		})
	}
}
