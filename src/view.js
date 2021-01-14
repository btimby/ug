const $ = require('cash-dom');
const debug = require('debug')('ug:view');
const runtime = require('./runtime');


const RE_SCRIPT = /<script[^>]*>(.*?)<\/script>/gis;
const RE_BODY = /<html[^>]*>(.*?)<\/html>/is;
const RE_URL = /(\S+:\/\/\S+?)\//;

// Attempt to set up a safe environment.
const PREAMBLE = `
var [document, window, ug] = arguments;
window.top = window.parent = {};
`;
const RUNTIME = `/dist/js/runtime.js`;
const SANDBOX_ARGS = 'allow-forms allow-popups allow-modals allow-scripts';


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

function execute(html, scripts, sandbox) {
  debug('Creating host iframe.');
  const frame = $('<iframe id="host">');
  frame.appendTo($('body'));
  const doc = frame[0].contentDocument, win = frame[0].contentWindow, F = win.Function;

  debug('Writing HTML.');
  doc.write(html);

  // Sandbox AFTER making our modifications, we can be more restrictive.
  if (sandbox) {
    debug('Sandboxing iframe: %s', SANDBOX_ARGS);
    frame.attr('sandbox', SANDBOX_ARGS);
  }

  // Execute scripts in context of iframe.
  frame.show();
  debug('Executing %i scripts.', scripts.length);
  for (var i = 0; i < scripts.length; i++) {
    F(PREAMBLE + scripts[i])(doc, win, runtime);
  }
  doc.close();
}

function render(server) {
  /* Render HTML and execute scripts. */
  debug('Rendering application.');

  let scripts;
  const app = server.app;
  document.title = `Web Underground :: view :: ${app.fields.name}`;

  debug('Reading index %s', app.fields.index);
  app.readFile(app.fields.index)
    .then((body) => {
      [body, scripts] = parseHtml(body);
      execute(body, scripts, false);
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
  execute,
};
