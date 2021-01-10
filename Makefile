
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

.PHONY: todo
todo: todo/app.pem
	npm run todo

.PHONY: test-browser
test-browser: dist
	npm run test-browser

.PHONY: test-node
test-node:
	npm run test-node

.PHONY: test-all
test-all: test-browser test-node

.PHONY: test
test:
	$(MAKE) -k test-all
