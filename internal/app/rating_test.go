package app

import "testing"

func TestRankByRating(t *testing.T) {
	tests := []struct {
		name   string
		rating int
		class  string
		label  string
	}{
		{name: "negative", rating: -10, class: "novice", label: "Новичок"},
		{name: "novice", rating: 1000, class: "novice", label: "Новичок"},
		{name: "apprentice", rating: 1300, class: "apprentice", label: "Практик"},
		{name: "expert", rating: 1750, class: "expert", label: "Эксперт"},
		{name: "master", rating: 2600, class: "master", label: "Мастер"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rank := rankByRating(tt.rating)
			if rank.class != tt.class {
				t.Fatalf("class = %s, want %s", rank.class, tt.class)
			}
			if rank.label != tt.label {
				t.Fatalf("label = %s, want %s", rank.label, tt.label)
			}
		})
	}
}

func TestUserRatingHelpers(t *testing.T) {
	u := &User{Rating: 1610}

	if got := u.EffectiveRating(); got != 1610 {
		t.Fatalf("EffectiveRating = %d, want %d", got, 1610)
	}
	if got := u.RankClass(); got != "expert" {
		t.Fatalf("RankClass = %s, want %s", got, "expert")
	}
	if got := u.RankLabel(); got != "Эксперт" {
		t.Fatalf("RankLabel = %s, want %s", got, "Эксперт")
	}
}
