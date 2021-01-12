const $ = require('cash-dom');
const debug = require('debug')('ug:view');


const RE_SCRIPT = /<script[^>]*>(.*?)<\/script>/gis;
const RE_BODY = /<html[^>]*>(.*?)<\/html>/is;

// TODO: identify all the necessary globals.
const PREAMBLE = 'var [document, window] = arguments; ';
const SANDBOX_ARGS = 'allow-forms allow-popups allow-modals allow-scripts allow-same-origin';


function parseQs(qs) {
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
  // Fetch the content.
  var scripts = [];
  var redact = [];

  F = F || Function;

  let tag;
  while ((tag = RE_SCRIPT.exec(body))) {
    // Ignore tags for remote scripts, we only need to handle inline.
    if (tag[0].indexOf('src') !== -1) {
        continue;
    }
    scripts.push(F(PREAMBLE + tag[1]));
    redact.push([RE_SCRIPT.lastIndex - tag[0].length, RE_SCRIPT.lastIndex]);
  }

  // Remove the script tags which correspond to functions we just
  // compiled. This is done in reverse order so that offsets are
  // preserved.
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
  const app = server.app;
  const frame = $('<iframe id="host">');

  if (sandbox) {
    frame.attr('sandbox', SANDBOX_ARGS);
  }
  frame.appendTo($('body'));

  const doc = frame[0].contentDocument, win = frame[0].contentWindow;
  let scripts;

  app.readFile(app.fields.index)
    .then((body) => {
      [body, scripts] = parseHtml(body, win.Function);
      // TODO: fix this.
      document.title = `Web Underground :: view :: ${app.fields.name}`;
      doc.write(body);
    
      // Execute scripts in context of iframe.
      frame.show();
      for (var i = 0; i < scripts.length; i++) {
        scripts[i](doc, win);
      }
      doc.close();
    })
    .catch(debug);
}

function viewApp() {
  const query = parseQs(window.location.search.substring(1));
  let url = query.url;

  if (url.startsWith('web+ug://')) {
    url = url.substring(9);
  }

  window.bus
    .fetch(url)
    .then((server) => {
      render(server, true);
    });
}

// Only run when loaded as extension.
if ('browser' in window) {
  viewApp();
}


module.exports = {
  parseHtml,
  parseQs,
};
