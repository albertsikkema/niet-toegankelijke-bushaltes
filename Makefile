.PHONY: run config

# Serve the web app locally (generates docs/js/config.js from .env first)
run: config
	npx serve docs

# Generate docs/js/config.js from CARTO_API_KEY in .env
config:
	node pipeline/write-config.js
