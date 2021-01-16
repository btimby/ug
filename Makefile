all: build

build: package

.PHONY: distclean
distclean:
	rm -rf dist/js/*.js

.PHONY: dist
dist: node_modules distclean vendor
	npm run dist

.PHONY: vendorclean
vendorclean:
	rm -rf dist/js/vendor/*

.PHONY: vendor
vendor: vendorclean
	mkdir -p dist/js/vendor
	npm run vendor

.PHONY: watch
watch: vendor
	npm run watch

todo/app.pem:
	openssl genrsa -out todo/app.pem

todo.app: todo/app.pem todo/app.json todo/index.html
	npm run todo

.PHONY: todo
todo: todo.app

.PHONY: serve-todo
serve-todo: dist todo
	npm run serve-todo

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

node_modules: package.json
	npm i
	touch node_modules

.PHONY: test
test: node_modules todo/app.pem
	# -k runs all targets (even if one errors) and reports overall pass / fail.
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

%.zip: manifest.json dist/css/* dist/html/* dist/icons/* dist/images/* dist/js/*.js
	zip ${*}.zip -r dist/css dist/html dist/icons dist/images dist/js/*.js manifest.json

# Extensions are all zip files.
.PHONY: package-%
package-%: installed-jq
	$(eval VERSION=$(shell jq -r '.version' package.json))
	$(MAKE) ${*}-ug-${VERSION}.zip

# Firefox needs special processing.
.PHONY: package-firefox
package-firefox: installed-jq
	$(eval VERSION=$(shell jq -r '.version' package.json))
	$(MAKE) firefox-ug-${VERSION}.zip
	mv firefox-ug-${VERSION}.zip firefox-ug-${VERSION}.xpi

.PHONY: package
package: dist package-firefox package-chrome package-opera package-edge

.PHONY: cleanpackage
cleanpackage:
	rm -f *-ug-*.zip *-ug-*.xpi
