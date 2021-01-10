const RE_SCRIPT = /<script[^>]*>(.*?)<\/script>/gis;
const RE_BODY = /<html[^>]*>(.*?)<\/html>/is;

// TODO: identify all the necessary globals.
const PREAMBLE = 'var [document, window] = arguments; ';


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

function parseHtml(body) {
  // Fetch the content.
  var scripts = [];
  var redact = [];

  let tag;
  while ((tag = RE_SCRIPT.exec(body))) {
    // Ignore tags for remote scripts, we only need to handle inline.
    if (tag[0].indexOf('src') !== -1) {
        continue;
    }
    scripts.push(Function(PREAMBLE + tag[1]));
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

function render(obj, body) {
  const doc = window.document;
  let scripts;

  [body, scripts] = parseHtml(body);
  // TODO: fix this.
  doc.title = `Web Underground :: view :: ${obj.name}`;
  doc.write(body);

  // Execute scripts in context of document / window.
  for (var i = 0; i < scripts.length; i++) {
    scripts[i](doc, window);
  }
}

function viewApp() {
  const query = parseQs(window.location.search.substring(1));
  let url = query.url;

  if (url.startsWith('web+ug://')) {
    url = url.substring(9);
  }

  browser.runtime
    .getBackgroundPage()
    .then((bg) => {
      bg
        .fetchApp(url)
        .then(([obj, body]) => {
          render(obj, body);
        })
        .catch((e) => {
          console.log(e);
        });
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
