
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

.PHONY: set-version
set-version:
	jq '.version="${VERSION}"' package.json | sponge package.json
	jq '.version="${VERSION}"' manifest.json | sponge manifest.json
	git tag ${VERSION}
	git commit package.json manifest.json -m 'Version bump'

guard-%:
	if [ -z '${${*}}' ]; then echo 'ERROR: variable $* not set' && exit 1; fi

installed-%:
	if [ -z $(shell which ${*}) ]; then echo 'ERROR: ${*} is not installed.' && exit 1; fi

.PHONY: version
version: guard-VERSION installed-jq installed-sponge
	$(MAKE) set-version VERSION=${VERSION}

%.zip: manifest.json $(shell find dist -type f)
	zip ${*}.zip -r dist manifest.json

.PHONY: package-%
package-%: installed-jq
	$(eval VERSION=$(shell jq -r '.version' package.json))
	$(MAKE) ${*}-ug-${VERSION}.zip

.PHONY: package
package: package-firefox package-chrome package-opera package-edge

.PHONY: cleanpackage
cleanpackage:
	rm -f *-ug-*.zip
