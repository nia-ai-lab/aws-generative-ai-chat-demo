const expectedNode = '22.18.0';
const expectedNpm = '10.8.2';

const actualNode = process.versions.node;
const npmUserAgent = process.env.npm_config_user_agent ?? '';
const actualNpm = /(?:^|\s)npm\/([^\s]+)/.exec(npmUserAgent)?.[1];

const errors = [];
if (actualNode !== expectedNode) {
  errors.push(`Node.js ${expectedNode} is required; current version is ${actualNode}. Run \`nvm install && nvm use\`.`);
}
if (actualNpm !== expectedNpm) {
  errors.push(`npm ${expectedNpm} is required; current version is ${actualNpm ?? 'unknown'}.`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(`Toolchain verified: Node.js ${actualNode}, npm ${actualNpm}`);
