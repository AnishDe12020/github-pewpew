const { createOAuthDeviceAuth } = require('@octokit/auth-oauth-device');
const { promisify } = require('util');
const childProcess = require('child_process');
const style = require('ansi-colors');
const ora = require('ora');
const clipboard = require('clipboardy');

const exec = promisify(childProcess.exec);

const CLIENT_ID = 'ed7c193c5b64ee06192a';
const CLIENT_TYPE = 'oauth-app';
const SCOPE = 'delete_repo';
const API_URL = 'https://api.github.com';
const API_PAGINATION = 100;

async function auth() {
  console.log(style.dim(`Sign in to GitHub:`));
  const spinner = ora();

  const auth = createOAuthDeviceAuth({
    clientType: CLIENT_TYPE,
    clientId: CLIENT_ID,
    scopes: [SCOPE],
    async onVerification(verification) {
      console.log(
        `${style.bold(`Open:`)} ${style.cyan(
          style.underline(verification.verification_uri)
        )}`
      );
      console.log(
        `${style.bold('Code:')} ${verification.user_code} ${style.dim(
          'Copied to clipboard!'
        )}`
      );
      clipboard.writeSync(verification.user_code);

      spinner.start();
    },
  });

  const { token } = await auth({ type: 'oauth' });
  setConfig(token);

  spinner.stop();
  console.log();

  return token;
}

async function getRepositories() {
  const spinner = ora('Fetching repositories…');
  spinner.start();

  const curl = `curl ${getAuthHeader()} ${API_URL}/user/repos?per_page=${API_PAGINATION}`;
  const { stdout } = await exec(curl);

  const repos = JSON.parse(stdout);
  const count = repos.length;
  spinner.succeed(`${count} ${count > 1 ? 'repositories' : 'repository'} found.`);

  return repos;
}

async function deleteRepository(repo) {
  const spinner = ora(`${style.dim(`${repo}`)}`);
  spinner.start();

  const curl = `curl ${getAuthHeader()} -X DELETE ${API_URL}/repos/${repo} | grep HTTP/2`;
  const { stdout } = await exec(curl);
  const status = stdout.split(' ')[1];

  if (status === '204') {
    spinner.stopAndPersist({
      symbol: ``,
      text: `${style.strikethrough.dim(repo)}`,
    });
    return true;
  } else {
    spinner.fail(`${style.dim(`${repo} [ERROR]`)}`);
    return false;
  }
}

function getAuthHeader() {
  return `-H "Authorization: token ${process.env.GITHUB_TOKEN}"`;
}

function setConfig(token) {
  if (!token) return false;

  process.env.GITHUB_TOKEN = token;
  return true;
}

module.exports = {
  auth,
  getRepositories,
  deleteRepository,
  setConfig,
};
