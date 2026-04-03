// Wrapper: run npm install with DNS fix pre-loaded in a child process
const { spawn } = require('child_process');
const path = require('path');
const dnsFix = path.resolve(__dirname, '..', 'dns-fix.js');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const cwd = __dirname;
const args = process.argv.slice(2);
if (args.length === 0) args.push('install');

console.log('CWD:', cwd);
console.log('npm CLI:', npmCli);
console.log('Spawning npm', args.join(' '), 'with DNS fix...');

const child = spawn(process.execPath, [
  '--require', dnsFix,
  npmCli, ...args
], { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } });

child.on('close', code => {
  console.log('npm', args.join(' '), 'exited with code:', code);
  process.exit(code);
});
