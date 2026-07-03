const express = require("express");
const { spawn, exec } = require("child_process");
const cors = require("cors");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());

let dynamicServers = [];

const MAX_SERVERS = 5;
const MIN_SERVERS = 1;

const SCALE_UP_THRESHOLD = 10;
const SCALE_DOWN_THRESHOLD = 3;

const CHECK_INTERVAL = 10000;

let requestCount = 0;

function updateNginxConfig() {

  let upstream = `upstream backend_servers {\n`;

  dynamicServers.forEach(server => {

    if(server.process){

      upstream +=
        `    server localhost:${server.port};\n`;
    }
  });

  upstream += `}\n`;

  const config = `
events {
    worker_connections 1024;
}

http {

    proxy_cache_path cache
        levels=1:2
        keys_zone=my_cache:10m
        max_size=1g
        inactive=60m
        use_temp_path=off;

    ${upstream}

    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;

    server {

        listen 80;

        location / {

            proxy_pass http://backend_servers;

            proxy_cache_key "$scheme$request_method$host$request_uri";

            proxy_cache my_cache;

            proxy_cache_valid 200 5s;

            proxy_cache_methods GET HEAD;

            proxy_ignore_headers Cache-Control Expires;

            add_header X-Cache-Status $upstream_cache_status always;

            add_header Access-Control-Allow-Origin * always;

            add_header Access-Control-Expose-Headers X-Cache-Status always;

            add_header Cache-Control "no-store" always;
        }
    }
}
`;

  const path =
    "C:/Users/Divesh/OneDrive/Desktop/reverse/nginx-1.31.0/conf/nginx.conf";

  fs.writeFileSync(path, config);

  exec(
    "nginx.exe -s reload",
    {
      cwd:
      "C:/Users/Divesh/OneDrive/Desktop/reverse/nginx-1.31.0"
    },
    (err) => {

      if(err){

       
        console.error(err.message);
      }

      else{

        
      }
    }
  );
}


function createServer() {

  if(dynamicServers.length >= MAX_SERVERS){
    return;
  }

  const port =
    3000 + dynamicServers.length;

  const name =
    "server" + (dynamicServers.length + 1);

  const server = {

    name,

    port,

    file:"server1.js",

    process:null
  };

  console.log("Starting", name);

  server.process = spawn(
    "node",
    [server.file],
    {
      env:{
        ...process.env,
        PORT:port
      },
      stdio:"inherit"
    }
  );

  dynamicServers.push(server);

  updateNginxConfig();
}

// AUTO REMOVE SERVER
function stopServerAuto() {

  const runningServers =
    dynamicServers.filter(
      s => s.process
    );

  if(runningServers.length <= MIN_SERVERS){
    return;
  }

  const removed =
    runningServers[runningServers.length - 1];

  console.log(
    "AUTO REMOVED:",
    removed.name
  );

  // stop process
  if(removed.process){

    removed.process.kill();
  }

  // remove from array
  dynamicServers =
    dynamicServers.filter(
      s => s.name !== removed.name
    );

  updateNginxConfig();
}

// START FIRST SERVER
createServer();

// AUTO SCALING
setInterval(() => {

  console.log("Requests:", requestCount);

  const runningCount =
    dynamicServers.filter(
      s => s.process
    ).length;

  // SCALE UP
  if(
    requestCount >= SCALE_UP_THRESHOLD &&
    runningCount < MAX_SERVERS
  ){

    console.log("Scaling UP");

    createServer();
  }

  // SCALE DOWN
  else if(
    requestCount <= SCALE_DOWN_THRESHOLD &&
    runningCount > MIN_SERVERS
  ){

    console.log("Scaling DOWN");

    stopServerAuto();
  }

  requestCount = 0;

}, CHECK_INTERVAL);

// TRACK REQUESTS
app.get("/track", (req,res) => {

  requestCount++;

  res.json({
    success:true
  });
});

// STATUS API
app.get("/status", (req,res) => {

  res.json({

    totalServers:
      dynamicServers.length,

    servers:
      dynamicServers.map(s => ({

        name:s.name,

        port:s.port,

        running:!!s.process
      }))
  });
});

// MANUAL REMOVE SERVER
app.post("/stop/:name", (req,res) => {

  const server =
    dynamicServers.find(
      s => s.name === req.params.name
    );

  if(!server){

    return res.status(404).json({
      error:"Server not found"
    });
  }

  console.log(
    "MANUAL REMOVE:",
    server.name
  );

  // stop process
  if(server.process){

    server.process.kill();
  }

  // remove from array
  dynamicServers =
    dynamicServers.filter(
      s => s.name !== server.name
    );

  updateNginxConfig();

  res.json({
    success:true
  });
});

// MANUAL ADD SERVER
app.post("/start/:name", (req,res) => {

  if(dynamicServers.length >= MAX_SERVERS){

    return res.json({
      error:"Max servers reached"
    });
  }

  createServer();

  res.json({
    success:true
  });
});

app.listen(4000, () => {

  console.log("Controller running on 4000");
});