package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
)

const (
	maxImageUploadBytes  = 10 << 20
	maxMultipartOverhead = 256 << 10
	uploadPutTimeout     = 20 * time.Second
)

var allowedImageMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

type mediaUploadResponse struct {
	OK    bool   `json:"ok"`
	URL   string `json:"url,omitempty"`
	Key   string `json:"key,omitempty"`
	Error string `json:"error,omitempty"`
}

func writeMediaUploadResponse(w http.ResponseWriter, status int, payload mediaUploadResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func (a *Application) handleMediaUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	if !user.CanEdit() {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if a.objectStorage == nil || a.objectStorage.client == nil {
		writeMediaUploadResponse(w, http.StatusServiceUnavailable, mediaUploadResponse{
			OK:    false,
			Error: "image upload is not configured",
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxImageUploadBytes+maxMultipartOverhead)
	if err := r.ParseMultipartForm(maxImageUploadBytes + maxMultipartOverhead); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeMediaUploadResponse(w, http.StatusRequestEntityTooLarge, mediaUploadResponse{
				OK:    false,
				Error: "file is too large (max 10 MB)",
			})
			return
		}
		writeMediaUploadResponse(w, http.StatusBadRequest, mediaUploadResponse{
			OK:    false,
			Error: "invalid multipart form",
		})
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeMediaUploadResponse(w, http.StatusBadRequest, mediaUploadResponse{
			OK:    false,
			Error: "file field is required",
		})
		return
	}
	defer file.Close()

	if header != nil && header.Size > maxImageUploadBytes {
		writeMediaUploadResponse(w, http.StatusRequestEntityTooLarge, mediaUploadResponse{
			OK:    false,
			Error: "file is too large (max 10 MB)",
		})
		return
	}

	payload, err := io.ReadAll(io.LimitReader(file, maxImageUploadBytes+1))
	if err != nil {
		writeMediaUploadResponse(w, http.StatusBadRequest, mediaUploadResponse{
			OK:    false,
			Error: "failed to read file",
		})
		return
	}
	if len(payload) == 0 {
		writeMediaUploadResponse(w, http.StatusBadRequest, mediaUploadResponse{
			OK:    false,
			Error: "file is empty",
		})
		return
	}
	if len(payload) > maxImageUploadBytes {
		writeMediaUploadResponse(w, http.StatusRequestEntityTooLarge, mediaUploadResponse{
			OK:    false,
			Error: "file is too large (max 10 MB)",
		})
		return
	}

	sniffLen := len(payload)
	if sniffLen > 512 {
		sniffLen = 512
	}
	contentType := http.DetectContentType(payload[:sniffLen])
	ext, allowed := allowedImageMIMEs[contentType]
	if !allowed {
		writeMediaUploadResponse(w, http.StatusUnsupportedMediaType, mediaUploadResponse{
			OK:    false,
			Error: "only JPG, PNG, GIF and WEBP are allowed",
		})
		return
	}

	objectToken, err := generateSessionToken()
	if err != nil {
		a.logger.Printf("generate image object token: %v", err)
		writeMediaUploadResponse(w, http.StatusInternalServerError, mediaUploadResponse{
			OK:    false,
			Error: "failed to prepare upload",
		})
		return
	}

	objectKey := fmt.Sprintf(
		"article-images/%s/%s%s",
		time.Now().UTC().Format("2006/01/02"),
		strings.TrimSpace(objectToken),
		ext,
	)

	ctx, cancel := context.WithTimeout(r.Context(), uploadPutTimeout)
	defer cancel()

	_, err = a.objectStorage.client.PutObject(
		ctx,
		a.objectStorage.bucket,
		objectKey,
		bytes.NewReader(payload),
		int64(len(payload)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		a.logger.Printf("upload image to s3: %v", err)
		writeMediaUploadResponse(w, http.StatusBadGateway, mediaUploadResponse{
			OK:    false,
			Error: "failed to upload image",
		})
		return
	}

	writeMediaUploadResponse(w, http.StatusOK, mediaUploadResponse{
		OK:  true,
		URL: a.objectStorage.publicObjectURL(objectKey),
		Key: objectKey,
	})
}
