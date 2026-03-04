package main

import (
	"log"
	"net/http"
	"os"

	"nook/internal/app"
	"nook/internal/config"
)

func main() {
	cfg := config.Load()
	logger := log.New(os.Stdout, "", log.Ldate|log.Ltime|log.Lshortfile)

	application, err := app.New(cfg, logger)
	if err != nil {
		logger.Fatalf("init app: %v", err)
	}
	defer func() {
		_ = application.Close()
	}()

	addr := ":" + cfg.Port
	logger.Printf("starting %q on %s", cfg.AppName, addr)

	if err := http.ListenAndServe(addr, application.Routes()); err != nil {
		logger.Fatalf("listen and serve: %v", err)
	}
}
