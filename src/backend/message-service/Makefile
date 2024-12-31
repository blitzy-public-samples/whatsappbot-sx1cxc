# WhatsApp Web Enhancement - Message Service Makefile
# Version: 1.0.0
# Requires: Go 1.21+, Docker 24.0+, golangci-lint 1.54.0+

# Build configuration
BINARY_NAME := message-service
DOCKER_REGISTRY := whatsapp-web-enhancement
VERSION := 1.0.0
GO_FILES := ./...

# Build metadata
BUILD_DATE := $(shell date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT := $(shell git rev-parse --short HEAD)
GIT_TAG := $(shell git describe --tags --abbrev=0 2>/dev/null || echo "v$(VERSION)")

# Go build flags
GO_VERSION := 1.21
CGO_ENABLED := 0
GOARCH := amd64
GOOS := linux
GO_BUILD_FLAGS := -ldflags "-s -w \
	-X main.Version=$(VERSION) \
	-X main.BuildDate=$(BUILD_DATE) \
	-X main.GitCommit=$(GIT_COMMIT) \
	-X main.GitTag=$(GIT_TAG)"

# Docker build arguments
DOCKER_BUILD_ARGS := --build-arg GO_VERSION=$(GO_VERSION)-alpine \
	--build-arg BINARY_NAME=$(BINARY_NAME) \
	--build-arg BUILD_DATE=$(BUILD_DATE) \
	--build-arg VCS_REF=$(GIT_COMMIT)

# Test configuration
COVERAGE_DIR := coverage
COVERAGE_PROFILE := $(COVERAGE_DIR)/coverage.out
COVERAGE_HTML := $(COVERAGE_DIR)/coverage.html
MIN_COVERAGE := 80

.PHONY: all build test lint clean docker-build docker-push help

# Default target
all: lint test build

help: ## Display this help message
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the message service binary
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p bin
	@CGO_ENABLED=$(CGO_ENABLED) GOARCH=$(GOARCH) GOOS=$(GOOS) \
		go build $(GO_BUILD_FLAGS) \
		-o bin/$(BINARY_NAME) \
		./cmd/$(BINARY_NAME)
	@echo "Build complete: bin/$(BINARY_NAME)"

test: ## Run tests with coverage
	@echo "Running tests..."
	@mkdir -p $(COVERAGE_DIR)
	@go test -race -coverprofile=$(COVERAGE_PROFILE) $(GO_FILES)
	@go tool cover -html=$(COVERAGE_PROFILE) -o $(COVERAGE_HTML)
	@coverage=$$(go tool cover -func=$(COVERAGE_PROFILE) | grep total | awk '{print $$3}' | sed 's/%//'); \
	if [ $$(echo "$$coverage < $(MIN_COVERAGE)" | bc -l) -eq 1 ]; then \
		echo "Coverage $$coverage% is below minimum $(MIN_COVERAGE)%"; \
		exit 1; \
	fi
	@echo "Test coverage report: $(COVERAGE_HTML)"

lint: ## Run linters
	@echo "Running linters..."
	@golangci-lint run \
		--timeout=5m \
		--config=.golangci.yml \
		$(GO_FILES)

docker-build: build ## Build Docker image
	@echo "Building Docker image..."
	@docker build \
		$(DOCKER_BUILD_ARGS) \
		--tag $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION) \
		--tag $(DOCKER_REGISTRY)/$(BINARY_NAME):latest \
		--file build/Dockerfile .
	@echo "Docker image built: $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION)"

docker-push: docker-build ## Push Docker image to registry
	@echo "Pushing Docker image..."
	@docker push $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION)
	@docker push $(DOCKER_REGISTRY)/$(BINARY_NAME):latest
	@echo "Docker image pushed: $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION)"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf bin
	@rm -rf $(COVERAGE_DIR)
	@go clean -cache -testcache
	@docker rmi -f $(DOCKER_REGISTRY)/$(BINARY_NAME):$(VERSION) 2>/dev/null || true
	@docker rmi -f $(DOCKER_REGISTRY)/$(BINARY_NAME):latest 2>/dev/null || true
	@echo "Clean complete"

# CI targets
ci-verify: lint test ## Run CI verification steps
	@echo "CI verification complete"

ci-build: ci-verify docker-build ## Run CI build steps
	@echo "CI build complete"

ci-deploy: ci-build docker-push ## Run CI deployment steps
	@echo "CI deployment complete"