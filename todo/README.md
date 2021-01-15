# Web Underground sample TODO application.

This is a slightly complex web application used for testing UG. It consists of a single HTML file that references some images by URL and vue.js from a CDN.
It is a single-component page that uses `localStorage` to maintain a list of TODO items. The point of the application is to show how to package a simple, single file application for UG.

To serve the application for development run: `make serve` in this directory.

To build the packaged application run: `make todo` in the parent directory. This will produce todo.app which can be loaded into UG for serving.