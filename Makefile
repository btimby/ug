
.PHONY: distclean
distclean:
	rm -rf dist/js/*.js

.PHONY: dist
dist: distclean vendor
	npm run dist

.PHONY: vendorclean
vendorclean:
	rm -rf dist/js/vendor/*

.PHONY: vendor
vendor: vendorclean
	npm run vendor

.PHONY: watch
watch: vendor
	npm run watch

todo/app.pem:
	openssl genrsa -out todo/app.pem

todo.app: todo/app.pem todo/app.json todo/index.html
	node src/cli.js compile todo/app.json

.PHONY: todo
todo: todo.app

.PHONY: test-browser
test-browser: dist
	npm run test-browser

.PHONY: test-node
test-node:
	npm run test-node

.PHONY: debug-node
debug-node:
	npm run debug-node

.PHONY: test-all
test-all: test-browser test-node

.PHONY: test
test:
	$(MAKE) -k test-all
