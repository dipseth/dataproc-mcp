import { GCSService } from '../../src/services/gcs.js';
import fs from 'fs/promises';
import path from 'path';
const gcsUri = 'gs://dataproc-staging-us-central1-570127783956-ajghf8gj/google-cloud-dataproc-metainfo/1d598423-61dc-47c7-8310-1137fe7da45b/jobs/65c60e00-7549-44e4-82d8-0fbab0a9ceba/';
const outputDir = './output/gcs-download-test';
async function main() {
    const gcs = new GCSService();
    console.log('Listing objects with prefix:', gcsUri);
    const uris = await gcs.listObjectsWithPrefix(gcsUri);
    console.log('Found objects:', uris);
    await fs.mkdir(outputDir, { recursive: true });
    for (const uri of uris) {
        const fileName = path.basename(uri);
        const localPath = path.join(outputDir, fileName);
        console.log(`Downloading ${uri} to ${localPath}`);
        const buffer = await gcs.downloadFile(uri, { validateHash: false });
        await fs.writeFile(localPath, buffer);
        console.log(`Saved ${localPath} (${buffer.length} bytes)`);
    }
    console.log('All files downloaded.');
}
main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
