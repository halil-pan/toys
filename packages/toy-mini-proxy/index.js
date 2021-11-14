const http = require('http');
const net = require('net');
const url = require('url');

let port;

function MiniProxy(options) {
  this.port = options.port || 9393;
  this.onServerError = options.onServerError || function () {};
  this.onBeforeRequest = options.onBeforeRequest || function () {};
  this.onBeforeResponse = options.onBeforeResponse || function () {};
  this.onRequestError = options.onRequestError || function () {};
}
MiniProxy.prototype.start = function () {
  var server = http.createServer();

  server.on('request', this.requestHandler);
  server.on('connect', this.connectHandler);

  server.on('error', this.onServerError);
  server.on('beforeRequest', this.onBeforeRequest);
  server.on('beforeResponse', this.onBeforeResponse);
  server.on('requestError', this.onRequestError);

  server.listen(this.port);
  port = this.port;
};

MiniProxy.prototype.requestHandler = function (req, res) {
  try {
    const requestOptions = {
      host: req.headers.host.split(':')[0],
      port: req.headers.host.split(':')[1] || 80,
      path: req.headers.path || url.parse(req.url).path,
      method: req.method,
      headers: req.headers,
    };

    if (requestOptions.host == '127.0.0.1' && requestOptions.port == port) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
      });
      res.write('ok');
      res.end();
      return;
    }

    this.emit('beforeRequest', requestOptions, req);
    requestRemote(requestOptions, req, res, this);
  } catch (e) {
    console.log('requestHandlerError' + e.message);
  }

  function requestRemote(requestOptions, req, res, proxy) {
    const remoteRequest = http.request(
      requestOptions,
      function (remoteResponse) {
        remoteResponse.headers['proxy-agent'] = 'Easy Proxy 1.0';

        proxy.emit('beforeResponse', remoteResponse, requestOptions);

        res.writeHead(remoteResponse.statusCode, '', remoteResponse.headers);
        remoteResponse.pipe(res);
      },
    );

    remoteRequest.on('error', function (e) {
      proxy.emit('requestError', e, req, res);

      res.writeHead(502, 'Proxy fetch failed');
    });

    req.pipe(remoteRequest);

    res.on('close', function () {
      remoteRequest.abort();
    });
  }
};

MiniProxy.prototype.connectHandler = function (req, socket, head) {
  try {
    const requestOptions = {
      host: req.url.split(':')[0],
      port: req.url.split(':')[1] || 443,
    };

    this.emit('beforeRequest', requestOptions, req);
    connectRemote(requestOptions, socket);

    function ontargeterror(e) {
      console.log(req.url + ' Tunnel error: ' + e);
      _synReply(socket, 502, 'Tunnel Error', {}, function () {
        try {
          socket.end();
        } catch (e) {
          console.log('end error' + e.message);
        }
      });
    }

    function connectRemote(requestOptions, socket) {
      var tunnel = net.createConnection(requestOptions, function () {
        _synReply(
          socket,
          200,
          'Connection established',
          {
            Connection: 'keep-alive',
            'Proxy-Agent': 'Easy Proxy 1.0',
          },
          function (error) {
            if (error) {
              console.log('syn error', error.message);
              tunnel.end();
              socket.end();
              return;
            }
            tunnel.pipe(socket);
            socket.pipe(tunnel);
          },
        );
      });
      socket.on('error', function (e) {
        console.log('socket error:', e);
      });
      tunnel.setNoDelay(true);

      tunnel.on('error', ontargeterror);
    }
  } catch (e) {
    console.log('connectHandler error: ' + e.message);
  }
};

function _synReply(socket, code, reason, headers, cb) {
  try {
    var statusLine = 'HTTP/1.1 ' + code + ' ' + reason + '\r\n';
    var headerLines = '';
    for (var key in headers) {
      headerLines += key + ': ' + headers[key] + '\r\n';
    }
    socket.write(statusLine + headerLines + '\r\n', 'UTF-8', cb);
  } catch (error) {
    cb(error);
  }
}

module.exports = MiniProxy;
