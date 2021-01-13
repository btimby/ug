const $ = require('cash-dom');
const debug = require('debug')('ug:view');


const RE_SCRIPT = /<script[^>]*>(.*?)<\/script>/gis;
const RE_BODY = /<html[^>]*>(.*?)<\/html>/is;

// TODO: identify all the necessary globals.
const PREAMBLE = 'var [document, window] = arguments; ';
const SANDBOX_ARGS = 'allow-forms allow-popups allow-modals allow-scripts allow-same-origin';


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

  F = F || Function;
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
    scripts.push(F(PREAMBLE + tag[1]));
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

function render(server, sandbox) {
  /* Render HTML and execute scripts. */
  debug('Rendering HTML.');

  const app = server.app;
  const frame = $('<iframe id="host">');

  if (sandbox) {
    debug('Applying sandbox attributes: %s', SANDBOX_ARGS);
    frame.attr('sandbox', SANDBOX_ARGS);
  }
  frame.appendTo($('body'));

  const doc = frame[0].contentDocument, win = frame[0].contentWindow;
  let scripts;

  debug('Reading index %s', app.fields.index);
  app.readFile(app.fields.index)
    .then((body) => {
      [body, scripts] = parseHtml(body, win.Function);
      // TODO: fix this.
      document.title = `Web Underground :: view :: ${app.fields.name}`;
      doc.write(body);
    
      // Execute scripts in context of iframe.
      frame.show();
      debug('Executing %i scripts.', scripts.length);
      for (var i = 0; i < scripts.length; i++) {
        scripts[i](doc, win);
      }
      doc.close();
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
      render(server, true);
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
};
