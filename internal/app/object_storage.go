package app

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"nook/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type objectStorage struct {
	client          *minio.Client
	bucket          string
	endpointBaseURL string
	publicBaseURL   string
}

func newObjectStorage(cfg config.Config) (*objectStorage, error) {
	endpoint := strings.TrimSpace(cfg.S3Endpoint)
	bucket := strings.TrimSpace(cfg.S3Bucket)
	accessKey := strings.TrimSpace(cfg.S3AccessKey)
	secretKey := strings.TrimSpace(cfg.S3SecretKey)
	publicBaseURL := strings.TrimSpace(cfg.S3PublicBaseURL)

	allEmpty := endpoint == "" && bucket == "" && accessKey == "" && secretKey == "" && publicBaseURL == ""
	if allEmpty {
		return nil, nil
	}

	if endpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		return nil, errors.New("s3 config is incomplete: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY")
	}

	host, endpointBaseURL, secure, err := parseS3Endpoint(endpoint)
	if err != nil {
		return nil, err
	}

	client, err := minio.New(host, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
	})
	if err != nil {
		return nil, fmt.Errorf("init s3 client: %w", err)
	}

	return &objectStorage{
		client:          client,
		bucket:          bucket,
		endpointBaseURL: endpointBaseURL,
		publicBaseURL:   strings.TrimRight(publicBaseURL, "/"),
	}, nil
}

func parseS3Endpoint(raw string) (host string, baseURL string, secure bool, err error) {
	endpoint := strings.TrimSpace(raw)
	if endpoint == "" {
		return "", "", false, errors.New("s3 endpoint is empty")
	}

	if !strings.Contains(endpoint, "://") {
		endpoint = "https://" + endpoint
	}

	parsed, parseErr := url.Parse(endpoint)
	if parseErr != nil {
		return "", "", false, fmt.Errorf("parse s3 endpoint: %w", parseErr)
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", "", false, errors.New("s3 endpoint host is empty")
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return "", "", false, errors.New("s3 endpoint must not contain a path")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", "", false, errors.New("s3 endpoint must not contain query or fragment")
	}

	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "https" && scheme != "http" {
		return "", "", false, errors.New("s3 endpoint must use http or https scheme")
	}

	return parsed.Host, scheme + "://" + parsed.Host, scheme == "https", nil
}

func (s *objectStorage) publicObjectURL(objectKey string) string {
	if s == nil {
		return ""
	}

	key := strings.TrimLeft(strings.TrimSpace(objectKey), "/")
	if key == "" {
		return ""
	}

	if s.publicBaseURL != "" {
		return s.publicBaseURL + "/" + key
	}

	return strings.TrimRight(s.endpointBaseURL, "/") + "/" + s.bucket + "/" + key
}
