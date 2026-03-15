package app

import "nook/internal/config"

const (
	defaultUserRatingFallback     = 1000
	articleCreateRatingXPFallback = 5
	articleLikeRatingXPFallback   = 10
	rankApprenticeMinFallback     = 1200
	rankExpertMinFallback         = 1600
	rankMasterMinFallback         = 2200
)

type userRank struct {
	class string
	label string
	min   int
}

var (
	defaultUserRating     = defaultUserRatingFallback
	articleCreateRatingXP = articleCreateRatingXPFallback
	articleLikeRatingXP   = articleLikeRatingXPFallback
	userRanks             = buildUserRanks(rankApprenticeMinFallback, rankExpertMinFallback, rankMasterMinFallback)
)

func applyRatingConfig(cfg config.Config) {
	defaultUserRating = nonNegativeOrFallback(cfg.DefaultUserRating, defaultUserRatingFallback)
	articleCreateRatingXP = nonNegativeOrFallback(cfg.ArticleCreateXP, articleCreateRatingXPFallback)
	articleLikeRatingXP = nonNegativeOrFallback(cfg.ArticleLikeXP, articleLikeRatingXPFallback)

	apprenticeMin := positiveOrFallback(cfg.RankApprenticeMin, rankApprenticeMinFallback)
	expertMin := positiveOrFallback(cfg.RankExpertMin, rankExpertMinFallback)
	masterMin := positiveOrFallback(cfg.RankMasterMin, rankMasterMinFallback)
	userRanks = buildUserRanks(apprenticeMin, expertMin, masterMin)
}

func nonNegativeOrFallback(value int, fallback int) int {
	if value < 0 {
		return fallback
	}
	return value
}

func positiveOrFallback(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func buildUserRanks(apprenticeMin int, expertMin int, masterMin int) []userRank {
	if apprenticeMin <= 0 {
		apprenticeMin = rankApprenticeMinFallback
	}

	if expertMin <= apprenticeMin {
		expertMin = rankExpertMinFallback
		if expertMin <= apprenticeMin {
			expertMin = apprenticeMin + 1
		}
	}

	if masterMin <= expertMin {
		masterMin = rankMasterMinFallback
		if masterMin <= expertMin {
			masterMin = expertMin + 1
		}
	}

	return []userRank{
		{class: "novice", label: "Разведчик инцидентов", min: 0},
		{class: "apprentice", label: "Навигатор дежурки", min: apprenticeMin},
		{class: "expert", label: "Инженер стабильности", min: expertMin},
		{class: "master", label: "Хранитель продакшена", min: masterMin},
	}
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
