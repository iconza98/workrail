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
      "@semantic-release/npm",
      {
        // Sole writer of the release version. Its prepare step runs
        // `npm version <next>` unconditionally, before publish, so nothing
        // else needs to write the field -- an @semantic-release/exec
        // prepareCmd doing `npm pkg set version=...` used to sit here and was
        // pure duplication. docs/development.md already documented that this
        // fork uses @semantic-release/npm *instead of* exec; the exec entry
        // was upstream residue that contradicted it.
        //
        // scripts/ci-policy-check.js enforces both halves of this: that no
        // exec prepareCmd writes a version again, and that this plugin stays
        // present. Do not remove it without removing those checks first.
        //
        // npmPublish=true: the plugin reads publishConfig from package.json,
        // so the public registry and access=public are honoured automatically.
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
