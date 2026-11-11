import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

const files = new Set([
  'index.html', 'style.css', 'main.js', 'sim.js', 'city.js', 'world.js', 'turf-wars.js',
  'vendor/three.module.js', 'vendor/three.core.js', 'vendor/THREE-LICENSE.txt', 'garage/phaser.min.js',
]);
const types = {
  html:'text/html; charset=utf-8', css:'text/css; charset=utf-8',
  js:'text/javascript; charset=utf-8', txt:'text/plain; charset=utf-8',
  md:'text/plain; charset=utf-8', png:'image/png', webp:'image/webp',
  woff2:'font/woff2', mp3:'audio/mpeg',
};
const garageFile = /^garage\/(?:(?:assets|sfx)\/)?[a-zA-Z0-9_-]+\.(?:html|css|js|md|png|webp|woff2|mp3)$/;
const port = Number(process.env.PORT || 8080);
const host = process.env.LOST_CITY_HOST || '127.0.0.1';
const server=createServer(async(req,res)=>{
  if(req.method!=='GET' && req.method!=='HEAD') {
    res.writeHead(405,{Allow:'GET, HEAD'}).end();
    return;
  }
  const url=new URL(req.url,'http://localhost');
  const file=url.pathname==='/'?'index.html':url.pathname==='/garage/'?'garage/index.html':url.pathname.slice(1);
  if(!files.has(file) && !garageFile.test(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const content=await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)],'Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:content);
  } catch (error) {
    if (error.code === 'ENOENT') res.writeHead(404).end('Not found');
    else res.writeHead(500).end('Could not read game file');
  }
});
server.listen(port,host,()=>console.log(`Lost City is running at http://${host}:${server.address().port}`));
