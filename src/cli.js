const os = require('os');
const { compile } = require('./index');


function main(args) {
  switch (args[0]) {
    case 'compile':
      if (!args[1]) {
        console.log('Must provide path to app.json file.');
        process.exit(1);
      }
      compile(args[1])
        .then((path) => console.log(`Done, ${path} written.`));
      break;

    default:
      console.log(`Invalid command ${args[0]}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}
