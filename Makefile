# Single entry point for everything (PLAN.md Stage 0).
# Targets for later stages fail loudly until their stage builds them.

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose
WAIT_TIMEOUT ?= 300

.PHONY: help env up down lint secrets test contract-check contract-dictionary gate-1 \
        generate compile-maps transform metabase-bootstrap golden conformance web snapshot demo \
        gate-0 gates

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-20s %s\n", $$1, $$2}'

env: ## Fail if .env is missing
	@test -f .env || { echo "Missing .env. Run: cp .env.example .env"; exit 1; }

# ── Stack ────────────────────────────────────────────────────────────────
up: env ## Start Postgres (data + Metabase app DB) and Metabase; wait until healthy
	$(COMPOSE) up -d --wait --wait-timeout $(WAIT_TIMEOUT)

down: ## Stop the stack (keeps volumes)
	$(COMPOSE) down

# ── Quality ──────────────────────────────────────────────────────────────
lint: ## Run all pre-commit hooks on every file
	uv run pre-commit run --all-files

secrets: ## Scan the full git history for secrets
	uv run pre-commit run gitleaks --all-files
	docker run --rm -v "$(CURDIR):/repo" zricethezav/gitleaks:v8.30.1 git /repo --no-banner

test: ## Unit tests (pytest)
	uv run pytest -q

# ── Schema contract (Stage 1) ────────────────────────────────────────────
BASE_REF ?= origin/main

contract-check: ## Validate contract, dictionary freshness, changelog, version bump vs BASE_REF
	uv run python scripts/contract_check.py check --base-ref $(BASE_REF)

contract-dictionary: ## Regenerate contract/data_dictionary.md from the contract
	uv run python scripts/contract_check.py render

# ── Pipeline (built in later stages) ─────────────────────────────────────
generate: ## Synthetic data generator (Stage 3)
	@echo "Not built yet: Stage 3." && exit 1
compile-maps: ## CRM YAML maps -> dbt staging SQL (Stage 2)
	@echo "Not built yet: Stage 2." && exit 1
transform: ## dbt build (Stage 4)
	@echo "Not built yet: Stage 4." && exit 1
metabase-bootstrap: ## Rebuild Metabase content from the repo (Stage 6)
	@echo "Not built yet: Stage 6." && exit 1
golden: ## Golden-number check (Stage 5)
	@echo "Not built yet: Stage 5." && exit 1
conformance: ## Aggregate-only conformance checks (Stage 8)
	@echo "Not built yet: Stage 8." && exit 1
web: ## React front end dev server (Stage 7)
	@echo "Not built yet: Stage 7." && exit 1
snapshot: ## Export static snapshot JSON (Stage 7)
	@echo "Not built yet: Stage 7." && exit 1
demo: up generate compile-maps transform metabase-bootstrap golden snapshot ## Everything end to end

# ── Gates (PLAN.md Section 4A); cumulative ───────────────────────────────
gate-0: up lint secrets ## G0: containers healthy, pre-commit passes, gitleaks clean
	@echo "Gate 0 passed."

gate-1: gate-0 contract-check test ## G1: contract valid, versioned, dictionary current (+ G0)
	@echo "Gate 1 passed."

gates: gate-1 ## Run every gate built so far
