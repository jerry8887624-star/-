// 用法：node icons.cjs <icons 資料夾>  — 把 icon.svg 轉成 180／192／512 的 PNG
const {launch}=require('./pw.cjs'),fs=require('fs'),path=require('path');
(async()=>{const dir=path.resolve(process.argv[2]);const svg=fs.readFileSync(path.join(dir,'icon.svg'),'utf8');const b=await launch();
for(const s of [180,192,512]){const p=await b.newPage({viewport:{width:s,height:s}});await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);await p.screenshot({path:path.join(dir,`icon-${s}.png`),omitBackground:true});await p.close()}
await b.close();console.log('icons ->',dir)})();
