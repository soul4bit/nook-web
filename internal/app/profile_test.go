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

func TestFormatProfileWaitDuration(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		want     string
	}{
		{name: "less than minute", duration: 30 * time.Second, want: "меньше минуты"},
		{name: "minutes", duration: 11 * time.Minute, want: "11 мин"},
		{name: "hours and minutes", duration: 3*time.Hour + 5*time.Minute, want: "3 ч 5 мин"},
		{name: "days hours minutes", duration: 49*time.Hour + 2*time.Minute, want: "2 дн 1 ч 2 мин"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatProfileWaitDuration(tt.duration)
			if got != tt.want {
				t.Fatalf("formatProfileWaitDuration() = %q, want %q", got, tt.want)
			}
		})
	}
}
