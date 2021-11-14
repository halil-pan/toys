const MiniProxy = require('./index');

const PROXY_PORT = 9393;

const myProxy = new MiniProxy({
  port: PROXY_PORT,
  onBeforeRequest: (requestoptions) => {
    console.log(requestoptions.host, requestoptions.path);
  },
});

myProxy.start();

console.log(`proxy start at ${PROXY_PORT}`);
