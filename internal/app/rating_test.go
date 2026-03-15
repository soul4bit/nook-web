package app

import "testing"

func TestRankByRating(t *testing.T) {
	tests := []struct {
		name   string
		rating int
		class  string
		label  string
	}{
		{name: "negative", rating: -10, class: userRanks[0].class, label: userRanks[0].label},
		{name: "novice", rating: 1000, class: userRanks[0].class, label: userRanks[0].label},
		{name: "apprentice", rating: 1300, class: userRanks[1].class, label: userRanks[1].label},
		{name: "expert", rating: 1750, class: userRanks[2].class, label: userRanks[2].label},
		{name: "master", rating: 2600, class: userRanks[3].class, label: userRanks[3].label},
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

func TestRankByRatingBoundaries(t *testing.T) {
	tests := []struct {
		name   string
		rating int
		want   userRank
	}{
		{name: "zero", rating: 0, want: userRanks[0]},
		{name: "before apprentice", rating: userRanks[1].min - 1, want: userRanks[0]},
		{name: "at apprentice", rating: userRanks[1].min, want: userRanks[1]},
		{name: "before expert", rating: userRanks[2].min - 1, want: userRanks[1]},
		{name: "at expert", rating: userRanks[2].min, want: userRanks[2]},
		{name: "before master", rating: userRanks[3].min - 1, want: userRanks[2]},
		{name: "at master", rating: userRanks[3].min, want: userRanks[3]},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := rankByRating(tt.rating)
			if got.class != tt.want.class {
				t.Fatalf("class = %s, want %s", got.class, tt.want.class)
			}
			if got.label != tt.want.label {
				t.Fatalf("label = %s, want %s", got.label, tt.want.label)
			}
		})
	}
}

func TestUserRatingHelpers(t *testing.T) {
	u := &User{Rating: 1610}

	if got := u.EffectiveRating(); got != 1610 {
		t.Fatalf("EffectiveRating = %d, want %d", got, 1610)
	}
	if got := u.RankClass(); got != userRanks[2].class {
		t.Fatalf("RankClass = %s, want %s", got, userRanks[2].class)
	}
	if got := u.RankLabel(); got != userRanks[2].label {
		t.Fatalf("RankLabel = %s, want %s", got, userRanks[2].label)
	}
	if got := u.HasNextRank(); !got {
		t.Fatalf("HasNextRank = %t, want %t", got, true)
	}
	if got := u.NextRankLabel(); got != userRanks[3].label {
		t.Fatalf("NextRankLabel = %s, want %s", got, userRanks[3].label)
	}
	if got := u.NextRankMinRating(); got != 2200 {
		t.Fatalf("NextRankMinRating = %d, want %d", got, 2200)
	}
	if got := u.RatingToNextRank(); got != 590 {
		t.Fatalf("RatingToNextRank = %d, want %d", got, 590)
	}
	if got := u.RankProgressPercent(); got != 1 {
		t.Fatalf("RankProgressPercent = %d, want %d", got, 1)
	}
}

func TestUserRatingHelpersAtMaxRank(t *testing.T) {
	u := &User{Rating: 2600}

	if got := u.HasNextRank(); got {
		t.Fatalf("HasNextRank = %t, want %t", got, false)
	}
	if got := u.NextRankLabel(); got != "" {
		t.Fatalf("NextRankLabel = %q, want empty", got)
	}
	if got := u.RatingToNextRank(); got != 0 {
		t.Fatalf("RatingToNextRank = %d, want %d", got, 0)
	}
	if got := u.RankProgressPercent(); got != 100 {
		t.Fatalf("RankProgressPercent = %d, want %d", got, 100)
	}
}

func TestUserRatingHelpersAtNoviceFloor(t *testing.T) {
	u := &User{Rating: 1000}

	if got := u.NextRankMinRating(); got != 1200 {
		t.Fatalf("NextRankMinRating = %d, want %d", got, 1200)
	}
	if got := u.RatingToNextRank(); got != 200 {
		t.Fatalf("RatingToNextRank = %d, want %d", got, 200)
	}
	if got := u.RankProgressPercent(); got != 83 {
		t.Fatalf("RankProgressPercent = %d, want %d", got, 83)
	}
}

func TestUserRatingHelpersNilUser(t *testing.T) {
	var u *User

	if got := u.EffectiveRating(); got != 0 {
		t.Fatalf("EffectiveRating = %d, want %d", got, 0)
	}
	if got := u.RankClass(); got != userRanks[0].class {
		t.Fatalf("RankClass = %s, want %s", got, userRanks[0].class)
	}
	if got := u.RankLabel(); got != userRanks[0].label {
		t.Fatalf("RankLabel = %s, want %s", got, userRanks[0].label)
	}
	if got := u.HasNextRank(); !got {
		t.Fatalf("HasNextRank = %t, want %t", got, true)
	}
	if got := u.NextRankLabel(); got != userRanks[1].label {
		t.Fatalf("NextRankLabel = %s, want %s", got, userRanks[1].label)
	}
	if got := u.NextRankMinRating(); got != userRanks[1].min {
		t.Fatalf("NextRankMinRating = %d, want %d", got, userRanks[1].min)
	}
	if got := u.RatingToNextRank(); got != userRanks[1].min {
		t.Fatalf("RatingToNextRank = %d, want %d", got, userRanks[1].min)
	}
	if got := u.RankProgressPercent(); got != 0 {
		t.Fatalf("RankProgressPercent = %d, want %d", got, 0)
	}
}
