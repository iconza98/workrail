#!/usr/bin/env node
/**
 * CI policy guardrails.
 *
 * This prevents accidental weakening of the CI contract that the GitHub ruleset relies on:
 * - "CI Success" must remain the stable required check name
 * - It must depend on the full required job set
 * - CI must run on push to main so release workflow_run triggers reliably
 *
 * It also guards the release version-write contract in .releaserc.cjs:
 * - exactly one plugin writes the release version, and it is @semantic-release/npm
 * - no @semantic-release/exec prepareCmd writes a version alongside it
 *
 * That second group exists because the failure it catches has already happened
 * once, silently. docs/development.md states this fork uses
 * @semantic-release/npm instead of exec, yet an exec prepareCmd writing the
 * version survived in .releaserc.cjs across an unknown number of upstream
 * syncs without anyone noticing. Prose did not hold the line, so this does.
 */
const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadYaml(filePath) {
  // js-yaml is already in the dependency tree (used elsewhere). Prefer it over a brittle parser.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('js-yaml');
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function loadReleaseConfig(filePath) {
  // Structural load, not a text scan: requiring the module yields the parsed
  // plugins array, so the checks below survive reformatting, requoting, and
  // comment edits. Their blind spot is a version write relocated into some
  // other plugin's hook, which no check here enumerates.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(filePath);
}

// Returns the options object for `pluginName`, or undefined when the plugin is
// absent. Handles both config shapes: a bare "name" string and a
// ["name", {...}] pair.
function pluginOptions(plugins, pluginName) {
  const entry = (plugins || []).find((p) =>
    Array.isArray(p) ? p[0] === pluginName : p === pluginName
  );
  if (!entry) return undefined;
  return Array.isArray(entry) ? entry[1] || {} : {};
}

function asStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function main() {
  const ciPath = path.resolve('.github/workflows/ci.yml');
  if (!fs.existsSync(ciPath)) fail(`missing CI workflow: ${ciPath}`);

  const ci = loadYaml(ciPath);

  // 1) Ensure CI triggers on push to main (required for release workflow_run)
  const on = ci.on;
  if (!on || !on.push || !Array.isArray(on.push.branches) || !on.push.branches.includes('main')) {
    fail('CI policy violation: ci.yml must trigger on push to main (on.push.branches includes "main")');
  }

  // 2) Ensure default permissions are read-only
  const permissions = ci.permissions;
  if (!permissions || permissions.contents !== 'read') {
    fail('CI policy violation: ci.yml must set permissions.contents: read');
  }

  // 3) Ensure CI Success job exists and stays stable
  const jobs = ci.jobs || {};
  const ciSuccess = jobs['ci-success'];
  if (!ciSuccess) fail('CI policy violation: missing jobs.ci-success');
  if (ciSuccess.name !== 'CI Success') {
    fail(`CI policy violation: jobs.ci-success.name must be exactly "CI Success" (got: ${String(ciSuccess.name)})`);
  }

  // 4) Ensure CI Success depends on the full required set
  const requiredNeeds = [
    'lockfile',
    'build-artifact',
    'semantic-release-dry-run',
    'typecheck',
    'validate-workflows',
    'build-and-test',
    'contract-tests',
    'e2e-tests',
  ];
  const actualNeeds = asStringArray(ciSuccess.needs);
  const missingNeeds = requiredNeeds.filter((n) => !actualNeeds.includes(n));
  if (missingNeeds.length) {
    fail(`CI policy violation: CI Success is missing needs: ${missingNeeds.join(', ')}`);
  }

  // 5) Ensure these jobs exist (so needs aren't dangling)
  const missingJobs = requiredNeeds.filter((n) => !jobs[n]);
  if (missingJobs.length) {
    fail(`CI policy violation: missing required jobs: ${missingJobs.join(', ')}`);
  }

  // 6) Ensure semantic-release-dry-run depends on lockfile + build-artifact
  const sr = jobs['semantic-release-dry-run'];
  const srNeeds = asStringArray(sr.needs);
  for (const dep of ['lockfile', 'build-artifact']) {
    if (!srNeeds.includes(dep)) {
      fail(`CI policy violation: semantic-release-dry-run must need ${dep}`);
    }
  }

  // 7) Release version-write contract (.releaserc.cjs)
  const rcPath = path.resolve('.releaserc.cjs');
  if (!fs.existsSync(rcPath)) {
    fail(`release policy violation: missing release config: ${rcPath}`);
  }
  const releaseConfig = loadReleaseConfig(rcPath);
  const plugins = releaseConfig.plugins;
  if (!Array.isArray(plugins)) {
    fail('release policy violation: .releaserc.cjs must export a `plugins` array');
  }

  // 7a) @semantic-release/npm must stay present. Its prepare step is the sole
  // writer of the release version; removing it would leave nothing writing the
  // field, and whatever placeholder package.json carries would be published.
  if (!pluginOptions(plugins, '@semantic-release/npm')) {
    fail(
      'release policy violation: @semantic-release/npm must be in .releaserc.cjs plugins -- ' +
        'it is the sole writer of the release version'
    );
  }

  // 7b) No exec prepareCmd may write the version alongside it. Two writers of
  // one field is the duplication that docs/development.md already ruled out.
  //
  // The /version/ match is deliberately loose. A prepareCmd that merely
  // mentions "version" without writing one would trip this, which is the
  // accepted cost: a false positive fails loudly with the offending command in
  // the message and is corrected in minutes, whereas a false negative restores
  // the silent duplication this check exists to prevent. Widen the pattern
  // before narrowing it.
  const execOptions = pluginOptions(plugins, '@semantic-release/exec');
  if (execOptions && typeof execOptions.prepareCmd === 'string' && /version/.test(execOptions.prepareCmd)) {
    fail(
      'release policy violation: @semantic-release/exec prepareCmd writes a version ' +
        `(${execOptions.prepareCmd}) -- @semantic-release/npm already does this. ` +
        'See docs/development.md: this fork uses @semantic-release/npm instead of exec.'
    );
  }

  console.log('CI policy check passed');
}

main();