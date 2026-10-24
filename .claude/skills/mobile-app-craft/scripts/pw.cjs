// 找到 Playwright（專案、scratchpad 或全域安裝皆可）並用預裝的 Chromium 啟動
function req(){for(const p of [process.cwd(),'/opt/node22/lib/node_modules',require('child_process').execSync('npm root -g').toString().trim()]){try{return require(require.resolve('playwright',{paths:[p]}))}catch(e){}}throw new Error('找不到 playwright')}
const pw=req();
module.exports={pw,launch:()=>pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--headless=new'],headless:false})};
