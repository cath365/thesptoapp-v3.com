const fs = require('fs');
const data = fs.readFileSync('c:/Users/emman/OneDrive/Documents/thesptoapp-v2-main/build_output.txt', 'utf8')
  .replace(/^\uFEFF/, '').trim();
JSON.parse(data).forEach(b => {
  console.log(`Build ${b.appBuildVersion} | ${b.status} | ${b.id.substring(0,8)} | ${(b.gitCommitHash||'').substring(0,7)}`);
});
