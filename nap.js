nap = function environment(nap_window) {
  var nap = {
    environment: environment
  }, nap_window = nap_window || window, nap_document = nap_window.document;
  nap.web = newWeb;
  nap.web.fromConfig = webFromConfig;
  nap.negotiate = {
    selector: bySelector,
    ordered: byOrdered,
    method: byMethod,
    content: byContent
  };
  nap.handlers = {
    invoke: invoke,
    view: repliesView
  };
  var root = nap_document.documentElement, matchesSelector = root.matchesSelector || root.webkitMatchesSelector || root.mozMatchesSelector || root.msMatchesSelector || root.oMatchesSelector;
  function is(n, s) {
    return matchesSelector.call(n, s);
  }
  function isFn(inst) {
    return typeof inst === "function";
  }
  function isStr(inst) {
    return typeof inst === "string";
  }
  function noop() {}
  function webFromConfig(config) {
    var names = Object.keys(config), web = nap.web();
    names.forEach(function(name) {
      var resource = config[name], specs = resource.handlers;
      web.resource(name, resource.route, negotiation(specs));
    });
    web.config = config;
    return web;
  }
  function negotiation(specs) {
    var handlers = [];
    specs.forEach(function(spec) {
      handlers.push(module(spec.source));
    });
    specs.forEach(function(spec, i) {
      if (spec.responds == "app/view") {
        handlers[i] = nap.handlers.view(handlers[i]);
      }
    });
    specs.forEach(function(spec, i) {
      var bycontent = {};
      bycontent[spec.responds] = handlers[i];
      handlers[i] = nap.negotiate.content(bycontent);
    });
    var methods = {};
    specs.forEach(function(spec, i) {
      [].concat(spec.method).forEach(function(method) {
        methods[method] || (methods[method] = []);
        methods[method].push(handlers[i]);
      });
    });
    Object.keys(methods).forEach(function(method) {
      methods[method] = nap.negotiate.ordered.apply(this, methods[method]);
    });
    return nap.negotiate.method(methods);
  }
  function module(id) {
    return function(req, res) {
      var that = this, r = req.locals.require || require;
      r([ id ], function(mod) {
        nap.handlers.invoke(that, mod, req, res);
      });
    };
  }
  function byOrdered() {
    var fns = [].slice.apply(arguments, [ 0 ]);
    return function(req, res) {
      var scope = this;
      if (!fns.length) {
        res("No handers specified");
        return;
      }
      next([].concat(fns));
      function next(fns) {
        var fn = fns.shift();
        if (!fn) {
          res("All handlers failed");
          return;
        }
        invoke(scope, fn, req, function(err, data) {
          if (err) {
            next(fns);
          } else {
            res(err, data);
          }
        });
      }
    };
  }
  function byContent(pair) {
    return function(req, res) {
      var fn = pair[req.headers.accept];
      console.log(fn);
      fn && invoke(this, fn, req, res);
    };
  }
  function bySelector() {
    var options = [].slice.apply(arguments, [ 0 ]).reduce(function(curr, next) {
      if (isStr(next)) curr.push({
        selector: next
      }); else curr[curr.length - 1].fn = next;
      return curr;
    }, []);
    return function(req, res) {
      var node = this instanceof nap_window.HTMLElement ? this : req.web.view(), called = false;
      called = options.some(function(option) {
        if (is(node, option.selector)) {
          invoke(node, option.fn, req, res);
          return true;
        }
      });
      if (!called) {
        res("No matches found");
      }
    };
  }
  function byMethod(map) {
    var order = Object.keys(map).map(function(method) {
      return handleMethod(method, map[method]);
    });
    return function(req, res) {
      var fn = byOrdered.apply(null, order);
      invoke(this, fn, req, res);
    };
  }
  function handleMethod(method, fn) {
    return function(req, res) {
      if (req.method == method) {
        invoke(this, fn, req, res);
        return;
      }
      res("Method Not Supported");
    };
  }
  function repliesView(fn) {
    return function(req, res) {
      var node = this instanceof nap_window.HTMLElement ? this : req.locals.baseView;
      invoke(node, fn, req, res);
    };
  }
  function invoke(scope, fn, req, cb) {
    var sync = false, args = [ req ];
    if (fn.length > 1) {
      args.push(isFn(cb) ? cb : noop);
    } else {
      sync = true;
    }
    fn.apply(scope, args);
    if (sync && isFn(cb)) {
      cb();
    }
  }
  function newWeb() {
    var web = {}, resources = {}, routes = rhumb.create();
    web.resource = function(name, ptn, handler) {
      if (arguments.length == 1) return resources[name];
      if (arguments.length == 2) {
        handler = ptn;
        ptn = name;
      }
      resources[name] = {
        name: name,
        ptn: ptn,
        handler: handler
      };
      routes.add(ptn, function(params) {
        return {
          fn: handler,
          params: params
        };
      });
      return web;
    };
    web.req = function(path, cb) {
      var req = path;
      if (isStr(path)) {
        req = {
          uri: path,
          method: "get"
        };
      }
      req.web = web;
      req.method || (req.method = "get");
      req.method == "get" && delete req["body"];
      var match = routes.match(req.uri);
      if (!match) {
        cb(req.uri + " not found");
        return;
      }
      req.params = match.params;
      req.locals = req.locals || {};
      invoke(this, match.fn, req, cb);
      return web;
    };
    return web;
  }
  return nap;
}();

if (typeof define === "function" && define.amd) {
  define(function() {
    return nap;
  });
}

rhumb = function() {
  function findIn(parts, tree) {
    var params = {};
    var find = function(remaining, node) {
      var part = remaining.shift();
      if (!part) return node.leaf || false;
      if (node.fixed && part in node.fixed) {
        return find(remaining, node.fixed[part]);
      }
      if (node.partial) {
        var tests = node.partial.tests, found = tests.some(function(partial) {
          if (partial.ptn.test(part)) {
            var match = part.match(partial.ptn);
            partial.vars.forEach(function(d, i) {
              params[d] = match[i + 1];
            });
            node = partial;
            return true;
          }
        });
        if (found) {
          return find(remaining, node);
        }
      }
      if (node.var) {
        params[node.var.name] = part;
        return find(remaining, node.var);
      }
      return false;
    };
    var found = find(parts, tree, params);
    if (found) {
      return {
        fn: found,
        params: params
      };
    }
    return false;
  }
  function isArr(inst) {
    return inst instanceof Array;
  }
  function create() {
    var router = {}, tree = {};
    function updateTree(parts, node, fn) {
      var part = parts.shift(), more = !!parts.length, peek;
      if (isArr(part)) {
        node.leaf = fn;
        updateTree(part, node, fn);
        return;
      }
      if (!part) {
        return;
      }
      if (part.type == "fixed") {
        node["fixed"] || (node["fixed"] = {});
        peek = node.fixed[part.input] || (node.fixed[part.input] = {});
      } else if (part.type == "var") {
        if (node.var) {
          throw new Error("Ambiguity");
        }
        peek = node.var = {};
        peek.name = part.input;
      } else if (part.type = "partial") {
        if (node.partial) {
          if (node.partial.names[part.name]) {
            throw new Error("Ambiguity");
          }
        }
        node.partial || (node.partial = {
          names: {},
          tests: []
        });
        peek = {};
        peek.ptn = part.input;
        peek.vars = part.vars;
        node.partial.names[part.name] = peek;
        node.partial.tests.push(peek);
      }
      if (!more) {
        peek.leaf = fn;
      } else {
        updateTree(parts, peek, fn);
      }
    }
    router.add = function(ptn, callback) {
      updateTree(parse(ptn), tree, callback);
    };
    router.match = function(path) {
      var parts = path.split("/").filter(falsy), match = findIn(parts, tree);
      if (match) {
        return match.fn.apply(match.fn, [ match.params ]);
      }
    };
    return router;
  }
  function falsy(d) {
    return !!d;
  }
  function parse(ptn) {
    var variable = /^{(\w+)}$/, partial = /([\w'-]+)?{([\w-]+)}([\w'-]+)?/, bracks = /^[)]+/;
    if (ptn.trim() == "/") {
      return [ {
        type: "fixed",
        input: ""
      } ];
    }
    function parseVar(part) {
      var match = part.match(variable);
      return {
        type: "var",
        input: match[1]
      };
    }
    function parseFixed(part) {
      return {
        type: "fixed",
        input: part
      };
    }
    function parsePartial(part) {
      var match = part.match(partial), ptn = "", len = part.length, i = 0;
      while (i < len && match) {
        i += match[0].length;
        if (match[1]) {
          ptn += match[1];
        }
        ptn += "([\\w-]+)";
        if (match[3]) {
          ptn += match[3];
        }
        match = part.substr(i).match(partial);
      }
      var vars = [], name = part.replace(/{([\w-]+)}/g, function(p, d) {
        vars.push(d);
        return "{var}";
      });
      return {
        type: "partial",
        input: new RegExp(ptn),
        name: name,
        vars: vars
      };
    }
    function parsePtn(ptn) {
      return ptn.split("/").filter(falsy).map(function(d) {
        if (variable.test(d)) {
          return parseVar(d);
        }
        if (partial.test(d)) {
          return parsePartial(d);
        }
        return parseFixed(d);
      });
    }
    function parseOptional(ptn) {
      var out = "", list = [];
      var i = 0, len = ptn.length, curr, onePart = true;
      while (onePart && i < len) {
        curr = ptn[i];
        switch (curr) {
         case ")":
         case "(":
          onePart = false;
          break;

         default:
          out += curr;
          break;
        }
        i++;
      }
      if (!onePart) {
        var next = parseOptional(ptn.substr(i + 1));
        if (next.length) {
          list.push(next);
        }
      }
      return parsePtn(out).concat(list);
    }
    if (ptn.indexOf("(") == -1) {
      return parsePtn(ptn);
    }
    return parseOptional(ptn);
  }
  var rhumb = create();
  rhumb.create = create;
  rhumb._parse = parse;
  rhumb._findInTree = findIn;
  return rhumb;
}();