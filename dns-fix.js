// Preload script: patch dns.lookup to use Google DNS (8.8.8.8) via dns.resolve4
// This bypasses the broken local DNS server
const dns = require('dns');
const origLookup = dns.lookup.bind(dns);
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

dns.lookup = function patchedLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = 0;
  }
  const family = typeof options === 'number' ? options : (options && options.family) || 0;
  const all = typeof options === 'object' && options && options.all;

  // localhost / 127.x / IPv4 literal - use original
  if (hostname === 'localhost' || /^127\./.test(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return origLookup(hostname, options, callback);
  }

  const resolveFn = (family === 6) ? resolver.resolve6.bind(resolver) : resolver.resolve4.bind(resolver);
  resolveFn(hostname, (err, addresses) => {
    if (err) return origLookup(hostname, options, callback);
    if (all) {
      callback(null, addresses.map(a => ({ address: a, family: family === 6 ? 6 : 4 })));
    } else {
      callback(null, addresses[0], family === 6 ? 6 : 4);
    }
  });
};
