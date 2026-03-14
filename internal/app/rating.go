package app

const (
	defaultUserRating     = 1000
	articleCreateRatingXP = 5
	articleLikeRatingXP   = 10
)

type userRank struct {
	class string
	label string
	min   int
}

var userRanks = []userRank{
	{class: "novice", label: "Новичок", min: 0},
	{class: "apprentice", label: "Практик", min: 1200},
	{class: "expert", label: "Эксперт", min: 1600},
	{class: "master", label: "Мастер", min: 2200},
}

func normalizeRating(value int) int {
	if value < 0 {
		return 0
	}
	return value
}

func rankByRating(rating int) userRank {
	value := normalizeRating(rating)
	result := userRanks[0]

	for _, rank := range userRanks {
		if value >= rank.min {
			result = rank
			continue
		}
		break
	}

	return result
}

func rankIndexByRating(rating int) int {
	value := normalizeRating(rating)
	index := 0

	for i, rank := range userRanks {
		if value >= rank.min {
			index = i
			continue
		}
		break
	}

	return index
}

func (u *User) EffectiveRating() int {
	if u == nil {
		return 0
	}
	return normalizeRating(u.Rating)
}

func (u *User) RankLabel() string {
	if u == nil {
		return userRanks[0].label
	}
	return rankByRating(u.EffectiveRating()).label
}

func (u *User) RankClass() string {
	if u == nil {
		return userRanks[0].class
	}
	return rankByRating(u.EffectiveRating()).class
}

func (u *User) HasNextRank() bool {
	if len(userRanks) == 0 {
		return false
	}
	return rankIndexByRating(u.EffectiveRating()) < len(userRanks)-1
}

func (u *User) NextRankLabel() string {
	if !u.HasNextRank() {
		return ""
	}
	index := rankIndexByRating(u.EffectiveRating())
	return userRanks[index+1].label
}

func (u *User) NextRankMinRating() int {
	if !u.HasNextRank() {
		return u.EffectiveRating()
	}
	index := rankIndexByRating(u.EffectiveRating())
	return userRanks[index+1].min
}

func (u *User) RatingToNextRank() int {
	if !u.HasNextRank() {
		return 0
	}
	remaining := u.NextRankMinRating() - u.EffectiveRating()
	if remaining < 0 {
		return 0
	}
	return remaining
}

func (u *User) RankProgressPercent() int {
	if len(userRanks) == 0 {
		return 0
	}
	if !u.HasNextRank() {
		return 100
	}

	rating := u.EffectiveRating()
	index := rankIndexByRating(rating)
	currentMin := userRanks[index].min
	nextMin := userRanks[index+1].min
	span := nextMin - currentMin
	if span <= 0 {
		return 100
	}

	if rating < currentMin {
		rating = currentMin
	}
	if rating > nextMin {
		rating = nextMin
	}

	progress := (rating - currentMin) * 100 / span
	if progress < 0 {
		return 0
	}
	if progress > 100 {
		return 100
	}
	return progress
}
