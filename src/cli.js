const { compile } = require('./index');


function main(args) {
  switch (args[0]) {
    case 'compile':
      // inPath is required.
      if (!args[1]) {
        console.log('Must provide path to app.json file.');
        process.exit(1);
      }

      const inPath = args[1];
      // outPath will be generated if omitted.
      const outPath = args[2];

      const app = compile(inPath, outPath);
      app
        .save()
        .then((path) => console.log(`Done, ${path} written.`));
      break;

    default:
      console.log(`Invalid command ${args[0]}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}
