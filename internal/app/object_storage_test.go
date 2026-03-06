package app

import (
	"strings"
	"testing"

	"nook/internal/config"
)

func TestParseS3EndpointDefaultsToHTTPS(t *testing.T) {
	host, baseURL, secure, err := parseS3Endpoint("s3.example.com")
	if err != nil {
		t.Fatalf("parseS3Endpoint() error = %v", err)
	}
	if host != "s3.example.com" {
		t.Fatalf("host = %q, want %q", host, "s3.example.com")
	}
	if baseURL != "https://s3.example.com" {
		t.Fatalf("baseURL = %q, want %q", baseURL, "https://s3.example.com")
	}
	if !secure {
		t.Fatal("secure = false, want true")
	}
}

func TestParseS3EndpointRejectsPath(t *testing.T) {
	_, _, _, err := parseS3Endpoint("https://s3.example.com/custom/path")
	if err == nil {
		t.Fatal("expected error for endpoint with path")
	}
	if !strings.Contains(err.Error(), "must not contain a path") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestNewObjectStorageRejectsIncompleteConfig(t *testing.T) {
	_, err := newObjectStorage(config.Config{
		S3PublicBaseURL: "https://cdn.example.com",
	})
	if err == nil {
		t.Fatal("expected error for incomplete config")
	}
	if !strings.Contains(err.Error(), "s3 config is incomplete") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestObjectStoragePublicObjectURL(t *testing.T) {
	storage := &objectStorage{
		bucket:          "bucket-name",
		endpointBaseURL: "https://s3.example.com",
		publicBaseURL:   "https://cdn.example.com",
	}

	urlWithPublicBase := storage.publicObjectURL("article-images/a.png")
	if urlWithPublicBase != "https://cdn.example.com/article-images/a.png" {
		t.Fatalf("urlWithPublicBase = %q", urlWithPublicBase)
	}

	storage.publicBaseURL = ""
	urlWithEndpoint := storage.publicObjectURL("article-images/a.png")
	if urlWithEndpoint != "https://s3.example.com/bucket-name/article-images/a.png" {
		t.Fatalf("urlWithEndpoint = %q", urlWithEndpoint)
	}
}
