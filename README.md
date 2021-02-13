[![Build Status](https://travis-ci.com/btimby/ug.svg?branch=master)](https://travis-ci.com/btimby/ug)

# Web Underground

Web Underground is a browser extension and toolkit that allows anyone with a compatible web browser to host a website from their computer. The extension works in all major browsers: Edge, Firefox, Chrome, Opera, Safari.

In contrast to hosting a traditional website, which requires a web hosting service or dedicated server, a domain registrar, DNS service etc, Web Underground requires only a compatible web browser. Web Underground accomplishes it's task by leveraging elements the BitTorrent P2P network within a browser to distribute the content of a site. Users of a site must have the Web Underground extension installed. When the extension is present, a specially crafted link can be used (like any other hyperlink) to load a site from the Web Underground. Such a link resembles the following:

web+ug://31f60ef828ea87d8cf2acb10ae471cb27a0d519c

In Firefox, Opera and Edge, this extension registers a custom URI scheme handler `web+ug://` to load sites. This means links can be opened within the address bar. Other browsers (Chrome, Safari) don't (yet) support this. For these browsers, the link can instead by entered into the extension's popup menu.

The main driver for this project is to achieve the following goals:

 - Allow anyone anywhere to publish a website quickly and easily.
 - Remove the dependencies on other parties, such as web hosts, domain regsitrars and dns providers.
 - To decentralize the process of creating and hosting a website.

## Applications

Web Underground websites / web applications are very similar to conventional ones. Applications must be packaged (or bundled) before serving, this replaces the typical uploading or publishing of a conventional site. A Web Underground application is a .app file that contains a manifest, a key pair and the content of the application. Currently an application must consist of a single HTML page, which can easily be achieved with typical tools such as Browserify / WebPack.

```bash
# node src/cli.js compile /path/to/app.json
```

This project includes a simple sample TODO application. This application is an SPA using vue.js, it follows the lead of many sample applications, providing a simple `localStorage` based TODO manager. The Makefile contains a target that will bundle the TOOD application.

```bash
# make todo
```

The above will produce a `todo.app` file (which is a zip file) that is ready to be deployed. Once deployed, a link will be created that can be shared with other Web Undergrond users allowing them to view the site.

## Enhancements

There are a number of potential / planned enhancements.

### Multi-page (or asset) apps.

The ability to include files beyond the currently supported `bundle.html`. This will require a few changes.

 - An asset loader must be implemented. This will resemble `view.html` which currently fetches and renders the `bundle.html` contained within the torrent.
 - `view.html` or the compilation process must pre-process each included file to change URIs to reference a loader, example, style sheets, scripts images. These resouces must be inlined via base64 blobs.

### Development

To contriute to this project, you will need to know a few things.

 - To run tests, do `make test`.
 - To start continuous build / install extension in Firefox for testing do `make watch && make host`.

### Development tools.

Currently, applications should be built using the normal process, then tools such as webpack and browserify can be used to create a single `bundle.html` file to be deployed.

Some tools can be provided to allow developing Web Underground applications directly. For example, a tool such as (or incorporating) `web-ext` to perform live compilation and serving.

Additionally, multiple runtime / toolkits should be provided to handle common needs of applications.

 - Messaging, allow application developers to incorporate P2P messaging.
 - Simple client-server RPC utilizing the messaging layer.
 - Storage, a method for server to persist a data set and distribute it to application users (shared state).

### Server tools.

A number of node based tools can be provided to enhance the capabilities of Web Underground.

 - Application hosting server. This would be a node CLI application that could serve an application directly, without needed the user to manually deploy in a browser. Such a server could utilize a headless browser or dedicated node.js runtime environment. The use-case for such a tool would be to allow sophisticated users to more permanently serve an application, as it could be started on computer boot.
 - HTTP proxy / bridge. A dedicated node.js server that could serve an application over standard HTTP protocol. This would allow users without the Web Underground extension to access applications from a domain. This tool should fetch the application over P2P, allowing anyone to expose any application (even someone else's) over HTTP.

### Quality of Life apps.

A number of applications could be provided (and served permanently) that enhance the Web Underground.

 - A search service which allows people to register or auto-register their applications so that others can search / discover them.
 - An identity / trust system that allows users to interact publishers and create trust relationships with them via signing keys (much like SSH users can choose to trust a host key).

## TODO

There are a few items that are necessary to make Web Underground more usable / stable.

 - Deploy dedicated tracker. https://github.com/Novage/wt-tracker
 - Deploy STUN / ICE servers.
