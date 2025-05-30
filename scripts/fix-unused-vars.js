#!/usr/bin/env node

/**
 * Script to fix unused variable ESLint errors
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const fixes = [
  // src/services/cluster.ts
  {
    file: 'src/services/cluster.ts',
    changes: [
      {
        search: /import { ClusterControllerClient, protos } from '@google-cloud\/dataproc';/,
        replace: 'import { ClusterControllerClient } from \'@google-cloud/dataproc\';'
      },
      {
        search: /createDataprocClient,\s*\n\s*getGcloudAccessToken,/,
        replace: 'getGcloudAccessTokenWithConfig,'
      },
      {
        search: /import { getServerConfig } from '\.\.\/config\/server\.js';\s*\n/,
        replace: ''
      },
      {
        search: /import { ClusterInfo, ClusterListResponse } from '\.\.\/types\/response\.js';\s*\n/,
        replace: ''
      },
      {
        search: /client\?: ClusterControllerClient,\s*\n\s*impersonateServiceAccount\?: string/,
        replace: '_client?: ClusterControllerClient,\n  _impersonateServiceAccount?: string'
      },
      {
        search: /impersonateServiceAccount\?: string/g,
        replace: '_impersonateServiceAccount?: string'
      }
    ]
  },
  // src/services/default-params.ts
  {
    file: 'src/services/default-params.ts',
    changes: [
      {
        search: /import { EnvironmentParams } from '\.\.\/types\/default-params\.js';\s*\n/,
        replace: ''
      }
    ]
  },
  // src/services/gcs.ts
  {
    file: 'src/services/gcs.ts',
    changes: [
      {
        search: /GCSErrorType,\s*\n\s*GCSErrorTypes,/,
        replace: 'GCSErrorTypes,'
      },
      {
        search: /import { getGcloudAccessToken, getGcloudAccessTokenWithConfig } from '\.\.\/config\/credentials\.js';\s*\n/,
        replace: 'import { getGcloudAccessTokenWithConfig } from \'../config/credentials.js\';\n'
      }
    ]
  },
  // src/services/job-output-handler.ts
  {
    file: 'src/services/job-output-handler.ts',
    changes: [
      {
        search: /import { GCSError, GCSErrorType, GCSErrorTypes, OutputFormat } from '\.\.\/types\/gcs-types\.js';/,
        replace: 'import { GCSError, GCSErrorTypes, OutputFormat } from \'../types/gcs-types.js\';'
      }
    ]
  },
  // src/services/job.ts
  {
    file: 'src/services/job.ts',
    changes: [
      {
        search: /import { getGcloudAccessToken } from '\.\.\/config\/credentials\.js';\s*\n/,
        replace: ''
      },
      {
        search: /import { createJobClient } from '\.\.\/config\/credentials\.js';\s*\n/,
        replace: ''
      },
      {
        search: /import { CacheConfig } from '\.\.\/types\/cache-types\.js';\s*\n/,
        replace: ''
      },
      {
        search: /export function processHiveOutput\([^}]+\}/s,
        replace: '// Removed unused function processHiveOutput'
      }
    ]
  },
  // src/services/query.ts
  {
    file: 'src/services/query.ts',
    changes: [
      {
        search: /import { protos } from '@google-cloud\/dataproc';\s*\n/,
        replace: ''
      },
      {
        search: /import { getGcloudAccessToken } from '\.\.\/config\/credentials\.js';\s*\n/,
        replace: ''
      },
      {
        search: /import { createDataprocClient } from '\.\.\/config\/credentials\.js';\s*\n/,
        replace: ''
      },
      {
        search: /import { HiveQueryConfig } from '\.\.\/types\/query\.js';\s*\n/,
        replace: ''
      },
      {
        search: /const authConfig = /,
        replace: 'const _authConfig = '
      },
      {
        search: /const token = /,
        replace: 'const _token = '
      }
    ]
  }
];

console.log('🔧 Fixing unused variable ESLint errors...');

for (const fix of fixes) {
  const filePath = join(projectRoot, fix.file);
  
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    
    for (const change of fix.changes) {
      if (content.match(change.search)) {
        content = content.replace(change.search, change.replace);
        modified = true;
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content);
      console.log(`✅ Fixed ${fix.file}`);
    } else {
      console.log(`⚠️  No changes needed for ${fix.file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${fix.file}:`, error.message);
  }
}

console.log('🎉 Unused variable fixes completed!');