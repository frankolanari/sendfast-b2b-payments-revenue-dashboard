# Single entry point for everything (PLAN.md Stage 0).
# Targets for later stages fail loudly until their stage builds them.

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose

# Local settings (.env) reach every recipe: the DB loader reads them. Synthetic values only.
-include .env
-include .env.metabase # the proxy's API key, written by metabase-bootstrap
export
WAIT_TIMEOUT ?= 300

.PHONY: help env up down lint secrets test contract-check contract-dictionary gate-1 \
        compiled-check compile-idempotent dbt-parse gate-2 \
        answer-keys answer-keys-check stories profile-charts generate-timed gate-3 \
        dev db-roles dbt-docs gate-4 gate-5 gate-6 metabase-reset metabase-rerun golden-3way card-registry card-registry-check \
        generate compile-maps transform metabase-bootstrap golden conformance web snapshot demo \
        gate-0 gates

help: ## List targets
	@grep -E '^[a-zA-Z0-9_-]+:.*## ' $(firstword $(MAKEFILE_LIST)) | awk 'BEGIN {FS = ":.*## "} {printf "  %-20s %s\n", $$1, $$2}'

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

# ── Synthetic data generator (Stage 3) ───────────────────────────────────
SCALE ?= 1.0
GEN := PYTHONPATH=generator/src uv run python -m sendfast_gen

answer-keys: ## Regenerate the committed answer keys (scale 1.0 and 0.1)
	$(GEN) answer-key --scale 1.0
	$(GEN) answer-key --scale 0.1

answer-keys-check: ## Fail if a committed answer key differs from a fresh computation
	$(GEN) check-answer-key --scale 1.0
	$(GEN) check-answer-key --scale 0.1

stories: ## Every planted story is detectable in the raw tables (full scale)
	$(GEN) stories --scale 1.0

profile-charts: ## Gate 3 sign-off charts -> docs/evidence/gate-3/
	$(GEN) charts --scale 1.0

generate-timed: env ## Full-scale generate + load must finish in under 5 minutes
	$(GEN) generate --scale 1.0 --max-seconds 300

# ── Transformations (Stage 4) ────────────────────────────────────────────
# psql runs inside the local data container; CI sets PSQL to a host psql client instead.
PSQL ?= docker compose exec -T postgres-data psql -U $(DATA_DB_ADMIN_USER) -d $(DATA_DB_NAME)

db-roles: env ## Create/refresh the transformer, bi_reader and conformance roles and grants
	@$(PSQL) -q -v ON_ERROR_STOP=1 -v transformer_password='$(TRANSFORMER_PASSWORD)' \
	  -v bi_reader_password='$(BI_READER_PASSWORD)' -v conformance_password='$(CONFORMANCE_PASSWORD)' \
	  -f - < deploy/sql/roles.sql

dbt-docs: ## Generate dbt docs (lineage graph) into dbt/target
	$(DBT) docs generate $(DBT_DIRS)

# ── CRM mapping layer (Stage 2) ──────────────────────────────────────────
CRM ?= hubspot
DBT := uv run dbt --no-use-colors
DBT_DIRS := --project-dir dbt --profiles-dir dbt

compiled-check: ## Fail if committed staging models differ from a fresh compile of CRM's map
	uv run python scripts/compile_mappings.py check --crm $(CRM)

compile-idempotent: ## Compile twice; the second run must change nothing
	uv run python scripts/compile_mappings.py compile --crm $(CRM)
	uv run python scripts/compile_mappings.py compile --crm $(CRM)
	uv run python scripts/compile_mappings.py check --crm $(CRM)

dbt-parse: ## dbt parses the project (Jinja, sources, refs, tests) without a database
	$(DBT) parse $(DBT_DIRS)

# ── Pipeline (built in later stages) ─────────────────────────────────────
generate: env ## Generate seeded synthetic data and load the raw schemas (SCALE=1.0 by default)
	$(GEN) generate --scale $(SCALE)
compile-maps: ## CRM YAML map -> dbt staging models (CRM=hubspot by default)
	uv run python scripts/compile_mappings.py compile --crm $(CRM)
transform: env compile-maps db-roles ## dbt build: staging -> intermediate -> marts, all tests (CRM=hubspot)
	$(DBT) build $(DBT_DIRS)
# ── Metabase layer (Stage 6) ─────────────────────────────────────────────
# The app DB holds only what the bootstrap rebuilds from the repo, so it is safe to wipe.
MB_APP_PSQL ?= $(COMPOSE) exec -T postgres-metabase psql -q -v ON_ERROR_STOP=1 -U $(MB_APP_DB_USER) -d postgres

metabase-reset: env ## Empty Metabase app DB, restart Metabase, wait until healthy (local stack only)
	$(COMPOSE) stop metabase
	$(MB_APP_PSQL) -c 'drop database if exists "$(MB_APP_DB_NAME)" with (force)' -c 'create database "$(MB_APP_DB_NAME)"'
	$(COMPOSE) up -d --wait --wait-timeout $(WAIT_TIMEOUT) metabase
	rm -f .env.metabase

metabase-bootstrap: env ## Rebuild Metabase from the repo: setup, DB, collections, cards, models, measures, dashboards
	uv run python scripts/metabase_bootstrap.py --max-seconds 180

card-registry: ## Regenerate web/src/api/cards.generated.ts from metabase/ (proxy allow-list, web types)
	uv run python scripts/export_card_registry.py

card-registry-check: ## Fail if the committed card registry differs from a fresh generation
	uv run python scripts/export_card_registry.py --check

metabase-rerun: env ## Bootstrap again: must change nothing (idempotent)
	uv run python scripts/metabase_bootstrap.py --max-seconds 180 --expect-no-changes
golden: env ## Golden numbers: answer key vs marts, as bi_reader (SCALE must match the loaded data)
	uv run python scripts/golden_check.py --scale $(SCALE)
golden-3way: env ## Three-way golden check: answer key vs marts vs Metabase cards (Stage 6)
	uv run python scripts/golden_check.py --scale $(SCALE) --metabase
conformance: ## Aggregate-only conformance checks (Stage 8)
	@echo "Not built yet: Stage 8." && exit 1
dev: env ## Live preview: proxy on :8787 + web on :5173, hot reload (needs make metabase-bootstrap)
	@test -n "$$MB_API_KEY" || { echo "No MB_API_KEY: run make metabase-bootstrap"; exit 1; }
	@echo "Open http://localhost:$${WEB_PORT:-5173}  (Ctrl-C stops both)"
	pnpm --parallel --filter @sendfast/proxy --filter @sendfast/web run dev

web: dev ## Alias for make dev
snapshot: ## Export static snapshot JSON (Stage 7)
	@echo "Not built yet: Stage 7." && exit 1
demo: up generate compile-maps transform metabase-bootstrap golden snapshot ## Everything end to end

# ── Gates (PLAN.md Section 4A); cumulative ───────────────────────────────
gate-0: up lint secrets ## G0: containers healthy, pre-commit passes, gitleaks clean
	@echo "Gate 0 passed."

gate-1: gate-0 contract-check test ## G1: contract valid, versioned, dictionary current (+ G0)
	@echo "Gate 1 passed."

gate-2: gate-1 compiled-check compile-idempotent dbt-parse ## G2: maps compile, up to date, idempotent (+ G0-1)
	@echo "Gate 2 passed."

gate-3: gate-2 answer-keys-check stories generate-timed ## G3: invariants, determinism, stories, <5 min (+ G0-2)
	@echo "Gate 3 passed."

gate-4: gate-3 transform ## G4: dbt build with zero test failures, identity match >= 95% (+ G0-3)
	@echo "Gate 4 passed."

gate-5: gate-4 golden ## G5: every metric in metrics.yml matches the answer key (+ G0-4)
	@echo "Gate 5 passed."

gate-6: gate-5 metabase-reset metabase-bootstrap metabase-rerun golden-3way ## G6: bootstrap from empty < 3 min, rerun changes nothing, three-way golden (+ G0-5)
	@echo "Gate 6 passed (automated part). Owner sign-off: cross-filtering screenshots in docs/evidence/gate-6/."

gates: gate-6 ## Run every gate built so far
