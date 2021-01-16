const fs = require('fs');
const WebTorrent = require('webtorrent-hybrid');
const { compile } = require('./index');
const { Engine } = require('./engine');


function main(args) {
  switch (args[0]) {
    case 'compile':
      const inPath = args[1];

      if (!inPath) {
        console.log('Must provide path to app.json file.');
        process.exit(1);
      }

      // outPath will be generated if omitted.
      const outPath = args[2];

      const app = compile(inPath, outPath);
      app
        .save()
        .then((path) => console.log(`Done, ${path} written.`));
      break;

    case 'serve':
      const appPath = args[1]

      if (!appPath) {
        console.log('Must provide an application file.');
        process.exit(1);
      }

      const engine = new Engine({wt: new WebTorrent()});

      engine
        .serve(fs.readFileSync(appPath))
        .then((server) => {
          console.log(`Now serving ${server.app.fields.name}: web+ug://${server.id}`);
          server.on('log', log);
          server.on('stats', log);
        })
        .catch(console.log)
      break;

    default:
      console.log(`Invalid command ${args[0]}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}
