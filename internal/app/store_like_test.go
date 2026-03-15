package app

import (
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func newSQLMockApplication(t *testing.T) (*Application, sqlmock.Sqlmock) {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}

	t.Cleanup(func() {
		_ = db.Close()
	})

	return &Application{db: db}, mock
}

func TestSetArticleLikeLikeIncrementsAuthorRating(t *testing.T) {
	app, mock := newSQLMockApplication(t)

	const (
		articleID int64 = 42
		userID    int64 = 7
		authorID  int64 = 11
		wantCount       = 3
	)

	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)select\s+author_id\s+from articles\s+where id = \$1\s+limit 1`).
		WithArgs(articleID).
		WillReturnRows(sqlmock.NewRows([]string{"author_id"}).AddRow(authorID))
	mock.ExpectExec(`(?s)insert into article_likes`).
		WithArgs(articleID, userID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(`(?s)update users\s+set rating = rating \+ \$2\s+where id = \$1`).
		WithArgs(authorID, articleLikeRatingXP).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`(?s)select count\(\*\) from article_likes where article_id = \$1`).
		WithArgs(articleID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(wantCount))
	mock.ExpectCommit()

	count, liked, err := app.setArticleLike(articleID, userID, true)
	if err != nil {
		t.Fatalf("setArticleLike() error = %v", err)
	}
	if !liked {
		t.Fatalf("liked = %t, want %t", liked, true)
	}
	if count != wantCount {
		t.Fatalf("count = %d, want %d", count, wantCount)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestSetArticleLikeUnlikeDecrementsAuthorRating(t *testing.T) {
	app, mock := newSQLMockApplication(t)

	const (
		articleID int64 = 77
		userID    int64 = 9
		authorID  int64 = 15
		wantCount       = 1
	)

	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)select\s+author_id\s+from articles\s+where id = \$1\s+limit 1`).
		WithArgs(articleID).
		WillReturnRows(sqlmock.NewRows([]string{"author_id"}).AddRow(authorID))
	mock.ExpectExec(`(?s)delete from article_likes\s+where article_id = \$1 and user_id = \$2`).
		WithArgs(articleID, userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`(?s)update users\s+set rating = greatest\(0, rating - \$2\)\s+where id = \$1`).
		WithArgs(authorID, articleLikeRatingXP).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`(?s)select count\(\*\) from article_likes where article_id = \$1`).
		WithArgs(articleID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(wantCount))
	mock.ExpectCommit()

	count, liked, err := app.setArticleLike(articleID, userID, false)
	if err != nil {
		t.Fatalf("setArticleLike() error = %v", err)
	}
	if liked {
		t.Fatalf("liked = %t, want %t", liked, false)
	}
	if count != wantCount {
		t.Fatalf("count = %d, want %d", count, wantCount)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestSetArticleLikeRejectsSelfLike(t *testing.T) {
	app, mock := newSQLMockApplication(t)

	const (
		articleID int64 = 100
		userID    int64 = 55
	)

	mock.ExpectBegin()
	mock.ExpectQuery(`(?s)select\s+author_id\s+from articles\s+where id = \$1\s+limit 1`).
		WithArgs(articleID).
		WillReturnRows(sqlmock.NewRows([]string{"author_id"}).AddRow(userID))
	mock.ExpectRollback()

	count, liked, err := app.setArticleLike(articleID, userID, true)
	if !errors.Is(err, errArticleSelfLike) {
		t.Fatalf("error = %v, want %v", err, errArticleSelfLike)
	}
	if liked {
		t.Fatalf("liked = %t, want %t", liked, false)
	}
	if count != 0 {
		t.Fatalf("count = %d, want %d", count, 0)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
