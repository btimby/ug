const $ = require('cash-dom');
const debug = require('debug')('ug:view');
const { Runtime } = require('./runtime');


const RE_SCRIPT = /<script[^>]*>(.*?)<\/script>/gis;
const RE_BODY = /<html[^>]*>(.*?)<\/html>/is;
const RE_URL = /(\S+:\/\/\S+?)\//;


function parseQs(qs) {
  /* Parse a query string. */
  debug('Parsing query string %s', qs);

  const args = qs.split('&');
  const obj = {};

  for (let i = 0; i < args.length; i++) {
    let arg = args[i].split('=');
    let val = true;
    if (arg.length > 1) {
      val = decodeURIComponent(arg[1]);
    }
    obj[decodeURIComponent(arg[0])] = val;
  }

  return obj;
}

function parseHtml(body, F) {
  /* Parse out HTML body and inline scripts. */
  debug('Parsing HTML body.');

  // Fetch the content.
  var scripts = [];
  var redact = [];

  let tag;
  while ((tag = RE_SCRIPT.exec(body))) {
    // Ignore tags for remote scripts, we only need to handle inline.
    if (tag[0].indexOf('src') !== -1) {
      debug('Script tag has src attribute, leaving.');
      continue;
    }
    scripts.push(tag[1]);
    redact.push([RE_SCRIPT.lastIndex - tag[0].length, RE_SCRIPT.lastIndex]);
  }

  // Remove the script tags which correspond to functions we just
  // compiled. This is done in reverse order so that offsets are
  // preserved.
  debug('Removing %i inline scripts', redact.length);
  for (let i = redact.length - 1; i >= 0; i--) {
    const [start, end] = redact[i];
    body = body.substring(0, start) + 
           body.substring(end);
  }

  // Return body tag contents (if present).
  m = body.match(RE_BODY);
  return [(m) ? m[1] : body, scripts];
}

function absURL(path) {
  const m = window.location.href.match(RE_URL);
  if (!m) {
    throw new Error('Could not parse URL');
  }

  if (!path.startsWith('/')) path = `/${path}`;

  return `${m[1]}${path}`;
}

function render(server) {
  /* Render HTML and execute scripts. */
  debug('Rendering application.');

  let scripts;
  const app = server.app;
  const runtime = new Runtime(server, true);
  document.title = `Web Underground :: view :: ${app.fields.name}`;

  debug('Reading index %s', app.fields.index);
  app.readFile(app.fields.index)
    .then((body) => {
      [body, scripts] = parseHtml(body);
      runtime.execute(scripts);
    })
    .catch(debug);
}

function viewApp() {
  /* Fetch and render application. */
  const query = parseQs(window.location.search.substring(1));
  let url = query.url;

  debug('Viewing application: %s', url);
  if (url.startsWith('web+ug://')) {
    debug('Stripping URL scheme.');
    url = url.substring(9);
  }

  window.bus
    .fetch(url)
    .then((server) => {
      render(server);
    });
}

// Only run when loaded as extension.
if (document && 'browser' in window) {
  $(document).ready(() => {
    viewApp();
  });
}


module.exports = {
  parseHtml,
  parseQs,
  absURL,
};
