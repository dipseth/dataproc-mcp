# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- semantic-release-changelog -->

## [4.5.0](https://github.com/dipseth/dataproc-mcp/compare/v4.4.0...v4.5.0) (2025-06-17)


### 🚀 Features

* **jobs:** Add cancel_dataproc_job tool with comprehensive job cancellation support ([#34](https://github.com/dipseth/dataproc-mcp/issues/34)) ([fe9257a](https://github.com/dipseth/dataproc-mcp/commit/fe9257aeb31878c36d2f8909e46806de9d9e327f))


### 📚 Documentation

* update documentation for v4.4.0 ([0a09a80](https://github.com/dipseth/dataproc-mcp/commit/0a09a80a18b58d6d78c1b5a4b4305715af40dc9b))

## [4.4.0](https://github.com/dipseth/dataproc-mcp/compare/v4.3.0...v4.4.0) (2025-06-17)


### 🚀 Features

* enhance prompts and job submission with ESLint fixes ([#33](https://github.com/dipseth/dataproc-mcp/issues/33)) ([252e39b](https://github.com/dipseth/dataproc-mcp/commit/252e39b4043ca97fac6e005e88520f3664b1d1a9))


### 📚 Documentation

* update documentation for v4.3.0 ([d9a56b2](https://github.com/dipseth/dataproc-mcp/commit/d9a56b26028cc2d84cd0e9760c896f247c9261e8))

## [4.3.0](https://github.com/dipseth/dataproc-mcp/compare/v4.2.2...v4.3.0) (2025-06-11)


### 🚀 Features

* implement centralized configuration path resolution ([#30](https://github.com/dipseth/dataproc-mcp/issues/30)) ([567c5d1](https://github.com/dipseth/dataproc-mcp/commit/567c5d1b954f0b57f7947132f8ebd4ee5f40e4fb))


### 📚 Documentation

* update documentation for v4.2.2 ([60163c7](https://github.com/dipseth/dataproc-mcp/commit/60163c7ee84c4a46c975020602290ff24dcbcd1d))

## [4.2.2](https://github.com/dipseth/dataproc-mcp/compare/v4.2.1...v4.2.2) (2025-06-10)


### 🐛 Bug Fixes

* resolve DATAPROC_CONFIG_PATH environment variable handling ([19f039d](https://github.com/dipseth/dataproc-mcp/commit/19f039df3632dc564d43bb45ae1821d341cefebd))
* resolve DATAPROC_CONFIG_PATH environment variable handling ([#29](https://github.com/dipseth/dataproc-mcp/issues/29)) ([b71d67a](https://github.com/dipseth/dataproc-mcp/commit/b71d67aa07e248715d7d2cb19095d50a7eea832d))


### 📚 Documentation

* update documentation for v4.2.1 ([b328461](https://github.com/dipseth/dataproc-mcp/commit/b328461fabe3c3ceab54ea7f08dd1088211eeb64))

## [4.2.1](https://github.com/dipseth/dataproc-mcp/compare/v4.2.0...v4.2.1) (2025-06-10)


### 🐛 Bug Fixes

* **response-filter:** resolve token optimization and status display issues ([dd5aa6a](https://github.com/dipseth/dataproc-mcp/commit/dd5aa6aa6b34a9ba1e72420d7acfc7ad3eb087c3))


### 📚 Documentation

* Add comprehensive sensitive file management and Git history cleanup guide ([12f4442](https://github.com/dipseth/dataproc-mcp/commit/12f4442312d75b8a7ab72f213876c9112a9c027f))
* update documentation for v4.2.0 ([82a0c25](https://github.com/dipseth/dataproc-mcp/commit/82a0c257e18b475c8056f512a4de9da4f3caed1c))

## 1.0.0 (2025-06-09)


### ⚠ BREAKING CHANGES

* Enhanced release detection may trigger releases for previously undetected conventional commits
* None (fully backward compatible)
* Complete production readiness implementation

Major features:
- Comprehensive CI/CD pipeline with GitHub Actions workflows
- Advanced security middleware and credential management
- Intelligent default parameter injection system
- Enhanced error handling and validation schemas
- Production-ready testing suite with unit, integration, and e2e tests
- Automated release management with semantic versioning
- Complete documentation and community support infrastructure

Technical improvements:
- Resolved all 26 critical ESLint errors for code quality compliance
- Fixed TypeScript compatibility issues with Node.js experimental features
- Implemented proper import/export resolution across all modules
- Added comprehensive security scanning and vulnerability management
- Enhanced MCP protocol implementation with robust error handling

This release establishes the foundation for a production-ready MCP server
with enterprise-grade reliability, security, and maintainability.

### 🚀 Features

* 🧠 Knowledge Base Semantic Search - Complete Implementation & Documentation ([ecdeaa1](https://github.com/dipseth/dataproc-mcp/commit/ecdeaa1dc73afe785b7dcfd980667e0cc55e3541))
* add comprehensive dataproc tools testing and fix critical get_zeppelin_url bug ([658efb5](https://github.com/dipseth/dataproc-mcp/commit/658efb51f7e625a3db1bef0c134059b785205428))
* add production-ready web hosting and enhanced async query tracking ([#12](https://github.com/dipseth/dataproc-mcp/issues/12)) ([618e8fd](https://github.com/dipseth/dataproc-mcp/commit/618e8fdb3e0853c58a8613b6a345d50e09ffb0b7)), closes [#11](https://github.com/dipseth/dataproc-mcp/issues/11)
* Add profile management and cluster operations to server request handlers ([ef3feae](https://github.com/dipseth/dataproc-mcp/commit/ef3feae242bf4f97488149cb6b8e3c1e34910a68))
* Clean logging, robust GCS output handler, and working TypeScript integration test setup. All debug/info logs now go to stderr and are controlled by LOG_LEVEL. Test runner and imports fixed for ts-node/esm. Marking project milestone. ([8975170](https://github.com/dipseth/dataproc-mcp/commit/897517076dcc4d805b06b3bc348484b6514b7f40))
* **docs:** enable Mermaid diagram rendering in Jekyll documentation ([#24](https://github.com/dipseth/dataproc-mcp/issues/24)) ([95464d1](https://github.com/dipseth/dataproc-mcp/commit/95464d125079759d0fb868b65c18dd972e803cff))
* enhance CI/CD pipeline with automatic PR merge publishing ([eba93bd](https://github.com/dipseth/dataproc-mcp/commit/eba93bd74843bf66f605150e084fddb6313bbc40))
* Enhance OutputParser to support Hive table output parsing ([0c85a7a](https://github.com/dipseth/dataproc-mcp/commit/0c85a7a7d2e826ceb460a79d3226b51f6bd7d47f))
* fix list_profiles bug and optimize response format ([#22](https://github.com/dipseth/dataproc-mcp/issues/22)) ([68137d4](https://github.com/dipseth/dataproc-mcp/commit/68137d43dfc05caffb9a8451e72e90856494cecc))
* Implement Default Parameter Manager for environment-specific parameter handling ([e2cf6e7](https://github.com/dipseth/dataproc-mcp/commit/e2cf6e7c112a75764d7d75a950fea3b67cf6342d))
* production-ready dataproc mcp server with comprehensive ci/cd pipeline ([ae4fa7e](https://github.com/dipseth/dataproc-mcp/commit/ae4fa7ed16283479e4cd9799ad07c3100f1da3bb))
* **tests:** Refactor MCP resource and prompt tests to use service classes and Zod schemas ([27a52c9](https://github.com/dipseth/dataproc-mcp/commit/27a52c9972b512d8d2f5e99a840f6e07a721f9dc))
* remove outdated cluster profiles and add new setup scripts ([7e35040](https://github.com/dipseth/dataproc-mcp/commit/7e35040355a258f14f3fbb1ad35cb97e073a2ada))
* update MCP Client references to Roo and enhance documentation for better integration ([5d5d266](https://github.com/dipseth/dataproc-mcp/commit/5d5d266e082e20160a7903d5b068dc930598a69d))


### 🐛 Bug Fixes

* change package scope to [@dipseth](https://github.com/dipseth) for NPM publishing ([c6cb45d](https://github.com/dipseth/dataproc-mcp/commit/c6cb45d59e94626449dfd587907a43842ad58826))
* **docs:** comprehensive GitHub Pages Jekyll documentation fixes ([8ee4919](https://github.com/dipseth/dataproc-mcp/commit/8ee49197aab9c6ca7b320d3c23ee8a67caa6b426))
* correct package name in post-release validation ([a5bb30b](https://github.com/dipseth/dataproc-mcp/commit/a5bb30bdb7c2f6781d71f254c3bf9277e999ebd3))
* enable Jekyll processing for GitHub Pages ([5b2975b](https://github.com/dipseth/dataproc-mcp/commit/5b2975bff0973de31a7867ad7b4e37e983407bee))
* **docs:** fix GitHub Pages links and CI/CD workflow ([f18774e](https://github.com/dipseth/dataproc-mcp/commit/f18774eaab283d70ec555e0ccd41759874fcacb4))
* reduce semantic-release GitHub assets to prevent conflicts ([cf9561b](https://github.com/dipseth/dataproc-mcp/commit/cf9561bee433255ea350c87b7b8e417ba4b1ad03))
* remove duplicate config/server.json entry from .gitignore ([bb088c6](https://github.com/dipseth/dataproc-mcp/commit/bb088c63b4d9a44c851ba345fc751a12b7383d60))
* remove invalid 'Document' from TypeDoc kindSortOrder ([3ca02e5](https://github.com/dipseth/dataproc-mcp/commit/3ca02e5ac844d5b95e82a5e3726309017f356da9))
* **knowledge:** resolve collection mismatch between storage and retrieval ([5d9472f](https://github.com/dipseth/dataproc-mcp/commit/5d9472fecee815d13952ca14f891f5e0b1989815))
* resolve ES module build script issue and enhance CI/CD mode ([700d1b9](https://github.com/dipseth/dataproc-mcp/commit/700d1b996aefa43700df30fb3e22adcc3c82545f))
* resolve GitHub Actions label permissions and enhance TypeScript safety ([a1077a5](https://github.com/dipseth/dataproc-mcp/commit/a1077a56b62a018332cfd6e6b200f094973e6e7a))
* resolve metastore configuration issue and update README ([502d088](https://github.com/dipseth/dataproc-mcp/commit/502d088657686a34b8dc5cce1f3f631bbdb3f1eb)), closes [#17](https://github.com/dipseth/dataproc-mcp/issues/17) [#17](https://github.com/dipseth/dataproc-mcp/issues/17)
* resolve semantic-release template error in successComment ([5426e48](https://github.com/dipseth/dataproc-mcp/commit/5426e489cf4f321de1878b25da6a32ff72272c9d))
* smart configuration path resolution for response-filter.json ([9356244](https://github.com/dipseth/dataproc-mcp/commit/93562441fabe5bc534c2af79a62a107d6112d7a3))
* update GitHub Pages workflow and package references ([df356d2](https://github.com/dipseth/dataproc-mcp/commit/df356d288271ea554bd322404e8f93ce12eea535))
* Update impersonateServiceAccount in server configuration for correct service account usage ([3b9ab78](https://github.com/dipseth/dataproc-mcp/commit/3b9ab7813cf61441aa0a3876f9c6504b8c4b1cdf))
* update server.json authentication details and add to .gitignore ([bd8e596](https://github.com/dipseth/dataproc-mcp/commit/bd8e596e968b4a80fcad8b650f91a343507ef5e2))


### 📚 Documentation

* add GitHub Pages setup guide ([f6769dd](https://github.com/dipseth/dataproc-mcp/commit/f6769ddd1995d8d9bbe1f749bca60091e2347cfa))
* Enhance README and guides with default parameter management details and user experience improvements ([5da9077](https://github.com/dipseth/dataproc-mcp/commit/5da9077c874adbc53f0bb6aa5372c5b78c6e176f))
* fix GitHub Pages links and add comprehensive configuration section ([6f4ff9e](https://github.com/dipseth/dataproc-mcp/commit/6f4ff9eaa48145e21355412d9c19ba1c0cf33eda))
* fix Jekyll permalinks for API_REFERENCE and index pages ([9a16ba6](https://github.com/dipseth/dataproc-mcp/commit/9a16ba617e46025ace7f30e59218de798af79529))
* trigger documentation workflow to test Jekyll fix ([36bb2f4](https://github.com/dipseth/dataproc-mcp/commit/36bb2f48ac71b7ad73ca7d12ce7990df2147030c))
* update documentation for v3.1.1 ([9c51b65](https://github.com/dipseth/dataproc-mcp/commit/9c51b65fc62157225bf9749b3d2dc8b467c6bea3))
* update documentation for v3.1.2 ([d63c6bf](https://github.com/dipseth/dataproc-mcp/commit/d63c6bf5e96141d6ed23c6e7985826d6f5888bbd))
* update documentation for v3.1.3 ([3c9b295](https://github.com/dipseth/dataproc-mcp/commit/3c9b295327083c430d7d47215955f36860fb3e4a))
* update documentation for v4.0.0 ([16fbcef](https://github.com/dipseth/dataproc-mcp/commit/16fbcef10152d404bfe520771d66c7332dc33a4e))
* update documentation for v4.1.0 ([19032dd](https://github.com/dipseth/dataproc-mcp/commit/19032dd6ff16a66952ac76b7bfef0e4e07ca7c0e))
* update documentation for v4.2.0 ([82a0c25](https://github.com/dipseth/dataproc-mcp/commit/82a0c257e18b475c8056f512a4de9da4f3caed1c))
* update MCP configuration examples to use NPM package ([da1f165](https://github.com/dipseth/dataproc-mcp/commit/da1f165fa4a65e7584a3b62aef8a5aca7508c3ee))
* update npm version badge to use shields.io for better cache management ([d3b69da](https://github.com/dipseth/dataproc-mcp/commit/d3b69daab69c05204caedb3f6407e262a3a448e0))


### ♻️ Code Refactoring

* improve CI workflow readability and efficiency ([baff59b](https://github.com/dipseth/dataproc-mcp/commit/baff59bc1598c3b095b5ec87ac1aa5a5ce97eef3))

## [4.2.0](https://github.com/dipseth/dataproc-mcp/compare/v4.1.0...v4.2.0) (2025-06-08)


### 🚀 Features

* add comprehensive dataproc tools testing and fix critical get_zeppelin_url bug ([8aaa5d8](https://github.com/dipseth/dataproc-mcp/commit/8aaa5d80a3506fb951fd3ae3aa00510454eb82c6))


### 🐛 Bug Fixes

* **knowledge:** resolve collection mismatch between storage and retrieval ([77d8c56](https://github.com/dipseth/dataproc-mcp/commit/77d8c568df4fca7e7badbd012925387cfa58df68))


### 📚 Documentation

* update documentation for v4.1.0 ([d94e33e](https://github.com/dipseth/dataproc-mcp/commit/d94e33e80a041e08cd200bd0ac9e988080a3252c))

## [4.1.0](https://github.com/dipseth/dataproc-mcp/compare/v4.0.0...v4.1.0) (2025-06-07)


### 🚀 Features

* **docs:** enable Mermaid diagram rendering in Jekyll documentation ([#24](https://github.com/dipseth/dataproc-mcp/issues/24)) ([67f9cdc](https://github.com/dipseth/dataproc-mcp/commit/67f9cdcbb0cece22ebb8b1a2dd3328d62a5db2e1))


### 📚 Documentation

* update documentation for v4.0.0 ([19f77c7](https://github.com/dipseth/dataproc-mcp/commit/19f77c723041222a79b5e146516eba41273df218))

## [4.0.0](https://github.com/dipseth/dataproc-mcp/compare/v3.1.3...v4.0.0) (2025-06-07)


### 📚 Documentation

* fix Jekyll permalinks for API_REFERENCE and index pages ([132d542](https://github.com/dipseth/dataproc-mcp/commit/132d5420f72ccf93a0bfafd8d6679573abc92c2d))
* trigger documentation workflow to test Jekyll fix ([e5b0bd8](https://github.com/dipseth/dataproc-mcp/commit/e5b0bd8b2f725c32d4793e46bd096d4d0e53ab07))
* update documentation for v3.1.3 ([caad163](https://github.com/dipseth/dataproc-mcp/commit/caad1633603404cfc996d6ac23df437cb0886561))

## [3.1.3](https://github.com/dipseth/dataproc-mcp/compare/v3.1.2...v3.1.3) (2025-06-05)


### 🐛 Bug Fixes

* enable Jekyll processing for GitHub Pages ([9598e37](https://github.com/dipseth/dataproc-mcp/commit/9598e3719b8d8858b1c93815ea88def6c73aabb8))


### 📚 Documentation

* update documentation for v3.1.2 ([ff9b7b7](https://github.com/dipseth/dataproc-mcp/commit/ff9b7b766eb381d208895edc022bb337b9918427))

## [3.1.2](https://github.com/dipseth/dataproc-mcp/compare/v3.1.1...v3.1.2) (2025-06-05)


### 🐛 Bug Fixes

* **docs:** comprehensive GitHub Pages Jekyll documentation fixes ([8998499](https://github.com/dipseth/dataproc-mcp/commit/899849971fc7d74a272fbfb05e3e23360ef84c56))


### 📚 Documentation

* update documentation for v3.1.1 ([c001503](https://github.com/dipseth/dataproc-mcp/commit/c001503c0cb0496431b6c9dabf3d3d3bcf1d6f5d))

## [3.1.1](https://github.com/dipseth/dataproc-mcp/compare/v3.1.0...v3.1.1) (2025-06-05)


### 🐛 Bug Fixes

* **docs:** fix GitHub Pages links and CI/CD workflow ([985a856](https://github.com/dipseth/dataproc-mcp/commit/985a856827c118e0632c5a49c988d959bbbd31c8))

## [3.1.0](https://github.com/dipseth/dataproc-mcp/compare/v3.0.0...v3.1.0) (2025-06-05)


### 🚀 Features

* fix list_profiles bug and optimize response format ([#22](https://github.com/dipseth/dataproc-mcp/issues/22)) ([8f329e6](https://github.com/dipseth/dataproc-mcp/commit/8f329e62a45329903a95abd596daa85eb67c6c61))

## [3.0.0](https://github.com/dipseth/dataproc-mcp/compare/v2.1.1...v3.0.0) (2025-06-04)


### ⚠ BREAKING CHANGES

* Enhanced release detection may trigger releases for previously undetected conventional commits

### 🚀 Features

* enhance CI/CD pipeline with automatic PR merge publishing ([59ffe57](https://github.com/dipseth/dataproc-mcp/commit/59ffe57af5bc0d1a7900bef55147007b0642f65b))


### 📚 Documentation

* update npm version badge to use shields.io for better cache management ([a95db42](https://github.com/dipseth/dataproc-mcp/commit/a95db42624390c647a508c8fd9939924b5f50c13))

## [2.1.1](https://github.com/dipseth/dataproc-mcp/compare/v2.1.0...v2.1.1) (2025-06-03)


### 🐛 Bug Fixes

* smart configuration path resolution for response-filter.json ([4eda469](https://github.com/dipseth/dataproc-mcp/commit/4eda469bb8ec691baa070549adb9c79cfaa21061))

## [2.1.0](https://github.com/dipseth/dataproc-mcp/compare/v2.0.3...v2.1.0) (2025-06-03)


### 🚀 Features

* 🧠 Knowledge Base Semantic Search - Complete Implementation & Documentation ([808f97d](https://github.com/dipseth/dataproc-mcp/commit/808f97d352ad266d4cf85f3dec0f30ff54a7e946))

## [2.0.3](https://github.com/dipseth/dataproc-mcp/compare/v2.0.2...v2.0.3) (2025-06-02)


### 🐛 Bug Fixes

* resolve metastore configuration issue and update README ([0f0d060](https://github.com/dipseth/dataproc-mcp/commit/0f0d0603a810e4d1d567f6e7ee71b4056b4b2865)), closes [#17](https://github.com/dipseth/dataproc-mcp/issues/17) [#17](https://github.com/dipseth/dataproc-mcp/issues/17)


### 📚 Documentation

* fix GitHub Pages links and add comprehensive configuration section ([12e8f2c](https://github.com/dipseth/dataproc-mcp/commit/12e8f2c96ff9db9fb78083dc2a296919dc46436c))

## [2.0.2](https://github.com/dipseth/dataproc-mcp/compare/v2.0.1...v2.0.2) (2025-05-31)


### 🐛 Bug Fixes

* resolve semantic-release template error in successComment ([757b95d](https://github.com/dipseth/dataproc-mcp/commit/757b95dca5af18d9f3a9b04b2014c4bb4ec42239))

## [2.0.1](https://github.com/dipseth/dataproc-mcp/compare/v2.0.0...v2.0.1) (2025-05-31)


### 🐛 Bug Fixes

* resolve GitHub Actions label permissions and enhance TypeScript safety ([c8ab9df](https://github.com/dipseth/dataproc-mcp/commit/c8ab9df82070e74d593845926ac2cddaa5249fc1))

## [2.0.0](https://github.com/dipseth/dataproc-mcp/compare/v1.1.6...v2.0.0) (2025-05-31)


### ⚠ BREAKING CHANGES

* None (fully backward compatible)

### 🚀 Features

* add production-ready web hosting and enhanced async query tracking ([#12](https://github.com/dipseth/dataproc-mcp/issues/12)) ([21c3437](https://github.com/dipseth/dataproc-mcp/commit/21c3437127fcc0d3b891b51677a5c38717c47a69)), closes [#11](https://github.com/dipseth/dataproc-mcp/issues/11)

## [1.1.6](https://github.com/dipseth/dataproc-mcp/compare/v1.1.5...v1.1.6) (2025-05-30)


### 🐛 Bug Fixes

* remove duplicate config/server.json entry from .gitignore ([bbc25a2](https://github.com/dipseth/dataproc-mcp/commit/bbc25a2e03bd00f2a2b142255d0b7c9bb2a79947))

## [1.1.5](https://github.com/dipseth/dataproc-mcp/compare/v1.1.4...v1.1.5) (2025-05-30)


### 🐛 Bug Fixes

* update server.json authentication details and add to .gitignore ([5afa561](https://github.com/dipseth/dataproc-mcp/commit/5afa56135c2fff0ca223712bcea8d9e02d25a6fb))


### 📚 Documentation

* update MCP configuration examples to use NPM package ([4d22183](https://github.com/dipseth/dataproc-mcp/commit/4d22183bb89f2add4f9b8cfb905a34a268861f6e))

## [1.1.4](https://github.com/dipseth/dataproc-mcp/compare/v1.1.3...v1.1.4) (2025-05-30)


### 🐛 Bug Fixes

* correct package name in post-release validation ([a201af0](https://github.com/dipseth/dataproc-mcp/commit/a201af0272e72c89882ecb0556ee7953ba95b138))

## [1.1.3](https://github.com/dipseth/dataproc-mcp/compare/v1.1.2...v1.1.3) (2025-05-30)


### 🐛 Bug Fixes

* reduce semantic-release GitHub assets to prevent conflicts ([f16f124](https://github.com/dipseth/dataproc-mcp/commit/f16f124baad3ae31d9c16aeefa8b2ab56822315a))

## [1.1.2](https://github.com/dipseth/dataproc-mcp/compare/v1.1.1...v1.1.2) (2025-05-30)


### 🐛 Bug Fixes

* remove invalid 'Document' from TypeDoc kindSortOrder ([38ef045](https://github.com/dipseth/dataproc-mcp/commit/38ef04558361426c1b56c592070334681042c74b))


### ♻️ Code Refactoring

* improve CI workflow readability and efficiency ([0bfb268](https://github.com/dipseth/dataproc-mcp/commit/0bfb2680b1c96286008fc42e8564b1938c850902))

## [1.1.1](https://github.com/dipseth/dataproc-mcp/compare/v1.1.0...v1.1.1) (2025-05-30)


### 🐛 Bug Fixes

* update GitHub Pages workflow and package references ([a5e25c1](https://github.com/dipseth/dataproc-mcp/commit/a5e25c1829be83d8f50cbc89410a5313c836da6d))


### 📚 Documentation

* add GitHub Pages setup guide ([a84ab4e](https://github.com/dipseth/dataproc-mcp/commit/a84ab4ec935ebd80bc01c118b3492f03887d3018))

## [1.1.0](https://github.com/dipseth/dataproc-mcp/compare/v1.0.2...v1.1.0) (2025-05-30)


### 🚀 Features

* update MCP Client references to Roo and enhance documentation for better integration ([44f5e8e](https://github.com/dipseth/dataproc-mcp/commit/44f5e8ea0cfb537a1884c5b9d23cb4089bc29294))

## [1.0.2](https://github.com/dipseth/dataproc-mcp/compare/v1.0.1...v1.0.2) (2025-05-30)


### 🐛 Bug Fixes

* change package scope to [@dipseth](https://github.com/dipseth) for NPM publishing ([55bfe2d](https://github.com/dipseth/dataproc-mcp/commit/55bfe2deb7852bb04b3d9caf03f9ff8a6932c9f2))

## [1.0.1](https://github.com/dipseth/dataproc-mcp/compare/v1.0.0...v1.0.1) (2025-05-30)


### 🐛 Bug Fixes

* resolve ES module build script issue and enhance CI/CD mode ([387fe7c](https://github.com/dipseth/dataproc-mcp/commit/387fe7cc874c593077231eb91fc89199e3e4c3de))

## 1.0.0 (2025-05-30)


### ⚠ BREAKING CHANGES

* Complete production readiness implementation

Major features:
- Comprehensive CI/CD pipeline with GitHub Actions workflows
- Advanced security middleware and credential management
- Intelligent default parameter injection system
- Enhanced error handling and validation schemas
- Production-ready testing suite with unit, integration, and e2e tests
- Automated release management with semantic versioning
- Complete documentation and community support infrastructure

Technical improvements:
- Resolved all 26 critical ESLint errors for code quality compliance
- Fixed TypeScript compatibility issues with Node.js experimental features
- Implemented proper import/export resolution across all modules
- Added comprehensive security scanning and vulnerability management
- Enhanced MCP protocol implementation with robust error handling

This release establishes the foundation for a production-ready MCP server
with enterprise-grade reliability, security, and maintainability.

### 🚀 Features

* Add profile management and cluster operations to server request handlers ([ac071da](https://github.com/dipseth/dataproc-mcp/commit/ac071dab9dfefac8992ebaf9a89733d5d4d5085f))
* Clean logging, robust GCS output handler, and working TypeScript integration test setup. All debug/info logs now go to stderr and are controlled by LOG_LEVEL. Test runner and imports fixed for ts-node/esm. Marking project milestone. ([00c4c89](https://github.com/dipseth/dataproc-mcp/commit/00c4c892583e41451a24bb035e89b6e7062d0756))
* Enhance OutputParser to support Hive table output parsing ([4a1fa0e](https://github.com/dipseth/dataproc-mcp/commit/4a1fa0ecc5c6ce6247a1066d2763b6e8eb86e8c9))
* Implement Default Parameter Manager for environment-specific parameter handling ([c44e818](https://github.com/dipseth/dataproc-mcp/commit/c44e8182f867512bbafc5331938007cabde97587))
* production-ready dataproc mcp server with comprehensive ci/cd pipeline ([66efdb0](https://github.com/dipseth/dataproc-mcp/commit/66efdb018288648806fd85d09b6d21f2cf5e7ad2))
* **tests:** Refactor MCP resource and prompt tests to use service classes and Zod schemas ([5ba4c78](https://github.com/dipseth/dataproc-mcp/commit/5ba4c7872050f9ad47f2d0440799704f432434e9))
* remove outdated cluster profiles and add new setup scripts ([b46e542](https://github.com/dipseth/dataproc-mcp/commit/b46e542163bb8db273b13d195ddc781b9c4beee8))


### 🐛 Bug Fixes

* Update impersonateServiceAccount in server configuration for correct service account usage ([2be7a68](https://github.com/dipseth/dataproc-mcp/commit/2be7a68867ff278bf7619984a2e0f0e033a5b7c9))


### 📚 Documentation

* Enhance README and guides with default parameter management details and user experience improvements ([38146c5](https://github.com/dipseth/dataproc-mcp/commit/38146c58a03cff36f47e2103be68bdf2dc78cd6a))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-29

### Added
- **Production-ready npm package configuration**
  - Removed private flag for public distribution
  - Added comprehensive package metadata and keywords
  - Enhanced npm scripts for development and production use
  - Added engines requirement for Node.js >=18.0.0

- **Automated setup and installation**
  - Interactive setup script (`npm run setup`)
  - Post-install script for automatic directory creation
  - Configuration validation script (`npm run validate`)
  - Server management scripts (`npm run stop`, `npm run restart`)
  - Template configuration files for easy setup

- **Enhanced development tooling**
  - ESLint and Prettier configuration
  - Test coverage reporting with nyc
  - Security audit scripts
  - Automated formatting and linting

- **Security hardening (Phase 2)**
  - Comprehensive input validation with Zod schemas
  - Rate limiting and abuse prevention
  - Credential management and validation
  - Audit logging for security events
  - Threat detection for injection attacks
  - Secure defaults and security headers
  - GCP resource constraint validation

- **Documentation enhancement (Phase 3)**
  - Enhanced Quick Start Guide with 5-minute setup
  - Common use cases and practical examples
  - Comprehensive troubleshooting guide
  - Multi-environment configuration examples
  - Complete API reference with 485 lines of documentation
  - Interactive HTML documentation generator
  - Auto-generated API docs from Zod schemas

- **CI/CD Setup (Phase 4)**
  - Comprehensive GitHub Actions workflows for automated testing and deployment
  - Multi-Node.js version testing matrix (18, 20, 22)
  - Automated semantic versioning and release management
  - Dependency management with automated updates and security scanning
  - Documentation pipeline with GitHub Pages deployment
  - Jest testing framework with TypeScript support
  - Code coverage reporting with 90% threshold requirements
  - ESLint and Prettier integration for code quality
  - Security scanning and vulnerability management
  - Automated NPM publishing on releases
  - Custom CI/CD Ops mode for workflow management
  - Comprehensive CI/CD documentation and troubleshooting guide

- **Testing & Validation (Phase 5)**
  - Enhanced integration tests for authentication methods
  - End-to-end workflow testing with mock MCP server
  - Performance benchmarking with configurable thresholds
  - Chaos testing for resilience and error handling validation
  - Multi-environment validation across dev/staging/production
  - Comprehensive testing infrastructure with custom test runners
  - Performance monitoring with memory usage tracking
  - Cross-platform compatibility testing
  - Authentication method validation across all supported types
  - Service account impersonation testing
  - Credential expiration and rotation monitoring tests

- **Release Preparation (Phase 6)**
  - Semantic versioning configuration with conventional commits
  - Automated release workflow with semantic-release
  - Comprehensive release preparation script with validation
  - Distribution setup with proper asset packaging
  - Release notes generation with git log integration
  - Package validation and optimization
  - Multi-branch release strategy (main, develop, release/*)
  - NPM publishing automation with GitHub releases

- **Community Readiness (Phase 7)**
  - Comprehensive contributing guidelines (385 lines)
  - GitHub issue templates for bug reports and feature requests
  - Pull request template with detailed checklists
  - Code of conduct and community standards
  - Development workflow documentation
  - Contribution recognition system
  - Open source preparation with MIT license
  - Community support and response time commitments

- **Template configurations**
  - `templates/default-params.json.template` - Default parameter configuration
  - `templates/server.json.template` - Server configuration with authentication
  - `templates/mcp-settings.json.template` - MCP client settings template

- **Comprehensive documentation**
  - Security Guide (`docs/SECURITY_GUIDE.md`) - 267 lines
  - Configuration Examples (`docs/CONFIGURATION_EXAMPLES.md`) - 434 lines
  - API Reference (`docs/API_REFERENCE.md`) - 485 lines
  - Interactive documentation (`docs/api-interactive.html`)
  - Auto-generated docs (`docs/API_AUTO_GENERATED.md`)
  - Enhanced Quick Start Guide (`QUICK_START.md`)
  - Production readiness plan documentation

- **Open source preparation**
  - MIT License
  - Comprehensive CHANGELOG.md
  - Repository configuration for `dipseth/dataproc-mcp`

### Changed
- **Package name**: Changed from `dataproc-server` to `@dataproc/mcp-server`
- **Version**: Bumped to 1.0.0 for production release
- **Files included**: Expanded to include templates, scripts, and documentation

### Enhanced
- **Smart default parameter management** (existing feature)
  - Intelligent parameter injection for common parameters
  - Multi-environment support
  - Backward compatibility with explicit parameters

- **Comprehensive toolset** (existing feature)
  - 16 tools covering cluster management and job execution
  - MCP resource exposure for configuration access
  - Environment-independent authentication

### Security
- **Enhanced input validation** preparation
- **Credential sanitization** framework
- **Security audit integration**

## [0.3.0] - 2025-05-29

### Added
- Default parameter management system
- Resource exposure via MCP protocol
- Service account impersonation support

### Enhanced
- Authentication strategy with fallback mechanisms
- Performance improvements (53-58% faster operations)
- Comprehensive testing infrastructure

## [0.1.0] - Initial Release

### Added
- Basic MCP server for Google Cloud Dataproc
- Cluster creation and management tools
- Hive query execution
- Profile-based cluster configuration
- Basic authentication support

---

## Upcoming Features

### [1.1.0] - Planned
- Enhanced security features
- Rate limiting implementation
- Advanced monitoring and logging
- Performance optimizations

### [1.2.0] - Planned
- CI/CD pipeline integration
- Automated testing enhancements
- Community contribution guidelines
- Documentation website

### [2.0.0] - Future
- Breaking changes for improved API design
- Advanced cluster management features
- Multi-cloud support exploration
- Enterprise features
