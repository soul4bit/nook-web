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
