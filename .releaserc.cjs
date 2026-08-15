// semantic-release configuration for this personal fork.
//
// Publishes @ikani.samani/workrail to the public npm registry on every merge
// to main that includes a feat / fix / perf / revert commit. The registry,
// scope, and access level come from `publishConfig` in package.json so this
// file does not have to know about them.
//
// Repository URL is inferred from package.json. Do NOT hardcode it here --
// merging from upstream is easier when this file does not diverge.

const allowMajorRelease = process.env.WORKRAIL_ALLOW_MAJOR_RELEASE === "true";
const breakingReleaseType = allowMajorRelease ? "major" : "minor";

module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "revert", release: "patch" },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "chore", release: false },
          { type: "refactor", release: false },
          { type: "test", release: false },
          { type: "build", release: false },
          { type: "ci", release: false },
          { breaking: true, release: breakingReleaseType }
        ]
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "Features" },
            { type: "fix", section: "Bug Fixes" },
            { type: "perf", section: "Performance Improvements" },
            { type: "revert", section: "Reverts" },
            { type: "docs", section: "Documentation", hidden: true },
            { type: "style", section: "Styles", hidden: true },
            { type: "chore", section: "Miscellaneous Chores", hidden: true },
            { type: "refactor", section: "Code Refactoring", hidden: true },
            { type: "test", section: "Tests", hidden: true },
            { type: "build", section: "Build System", hidden: true },
            { type: "ci", section: "Continuous Integration", hidden: true }
          ]
        }
      }
    ],
    [
      "@semantic-release/exec",
      {
        // semantic-release/npm reads the version from package.json, so we
        // still need to write it before publishing.
        prepareCmd: "npm pkg set version=${nextRelease.version}"
      }
    ],
    [
      "@semantic-release/npm",
      {
        // tarballDir + npmPublish=true: the npm plugin reads publishConfig
        // from package.json, so the public registry and access=public are
        // honoured automatically.
        npmPublish: true
      }
    ],
    [
      "@semantic-release/github",
      {
        // Publish the GitHub Release, but do not touch issues or pull requests.
        //
        // The plugin's "success" step resolves every released commit back to an
        // associated PR so it can comment on it. Commits adopted from upstream
        // carry "(#1234)" references to PRs in EtienneBBeaulac/workrail, which
        // do not exist here, so that lookup 404s and fails the whole run --
        // after npm has already published. See
        // node_modules/@semantic-release/github/lib/success.js:122.
        //
        // Issues are also disabled on this fork, so every issue-writing path in
        // this plugin would fail regardless of the upstream PR references.
        successCommentCondition: false,
        failComment: false,
        failTitle: false,
        releasedLabels: false
      }
    ]
  ]
};
