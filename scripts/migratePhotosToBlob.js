require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

require("../models/Store");
require("../models/Review");
require("../models/User");

const Store = mongoose.model("Store");

const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");
const DEFAULT_MANIFEST_PATH = path.join(
  __dirname,
  "photo-migration-manifest.json",
);
const BLOB_FOLDER = "store-photos";
const FALLBACK_PHOTO = "store.png";

function parseArgs(argv) {
  const args = argv.slice(2);
  const mode = args.find((arg) => arg.startsWith("--") && !arg.includes("="));
  const manifestArg = args.find((arg) => arg.startsWith("--manifest="));

  return {
    mode,
    manifestPath: manifestArg
      ? path.resolve(manifestArg.split("=").slice(1).join("="))
      : DEFAULT_MANIFEST_PATH,
  };
}

function usage() {
  console.log(`
Usage:
  node scripts/migratePhotosToBlob.js --dry-run
  node scripts/migratePhotosToBlob.js --upload
  node scripts/migratePhotosToBlob.js --apply

Options:
  --manifest=path/to/manifest.json
`);
}

function isUrl(photo) {
  return /^https?:\/\//i.test(photo);
}

function contentTypeFor(filename) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function pathExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function connect() {
  if (!process.env.DATABASE) {
    throw new Error("DATABASE is missing from your environment.");
  }

  await mongoose.connect(process.env.DATABASE);
}

async function getMigrationCandidates() {
  const stores = await Store.find({ photo: { $exists: true, $nin: ["", null] } })
    .select("_id name slug photo photoPathname")
    .lean();

  const candidates = [];
  const skipped = [];

  for (const store of stores) {
    if (!store.photo || store.photo === FALLBACK_PHOTO) {
      skipped.push({ store, reason: "fallback-photo" });
      continue;
    }

    if (isUrl(store.photo)) {
      skipped.push({ store, reason: "already-url" });
      continue;
    }

    if (path.basename(store.photo) !== store.photo) {
      skipped.push({ store, reason: "unsafe-filename" });
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, store.photo);
    const exists = await pathExists(filePath);

    candidates.push({
      store,
      filePath,
      exists,
    });
  }

  return { candidates, skipped };
}

function summarizeCandidates(candidates, skipped) {
  const present = candidates.filter((candidate) => candidate.exists);
  const missing = candidates.filter((candidate) => !candidate.exists);

  console.log(`Stores with local photos to migrate: ${candidates.length}`);
  console.log(`Local files found: ${present.length}`);
  console.log(`Local files missing: ${missing.length}`);
  console.log(`Skipped records: ${skipped.length}`);

  if (missing.length) {
    console.log("\nMissing files:");
    missing.forEach(({ store }) => {
      console.log(`- ${store.name} (${store._id}): ${store.photo}`);
    });
  }

  if (present.length) {
    console.log("\nReady to upload:");
    present.forEach(({ store }) => {
      console.log(`- ${store.name} (${store._id}): ${store.photo}`);
    });
  }
}

async function readManifest(manifestPath) {
  if (!(await pathExists(manifestPath))) {
    return {
      version: 1,
      generatedAt: null,
      entries: [],
    };
  }

  const contents = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(contents);
}

async function writeManifest(manifestPath, manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function manifestKey(storeId, oldPhoto) {
  return `${storeId}:${oldPhoto}`;
}

async function dryRun() {
  const { candidates, skipped } = await getMigrationCandidates();
  summarizeCandidates(candidates, skipped);
}

async function upload(manifestPath) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing from your environment.");
  }

  const { put } = await import("@vercel/blob");
  const manifest = await readManifest(manifestPath);
  const uploaded = new Map(
    manifest.entries.map((entry) => [
      manifestKey(entry.storeId, entry.oldPhoto),
      entry,
    ]),
  );
  const { candidates, skipped } = await getMigrationCandidates();

  summarizeCandidates(candidates, skipped);

  for (const candidate of candidates) {
    const { store, filePath, exists } = candidate;
    const key = manifestKey(store._id.toString(), store.photo);

    if (!exists) continue;
    if (uploaded.has(key)) {
      console.log(`Already in manifest: ${store.name} (${store.photo})`);
      continue;
    }

    const buffer = await fs.readFile(filePath);
    const blob = await put(
      `${BLOB_FOLDER}/${store._id}-${store.photo}`,
      buffer,
      {
        access: "public",
        addRandomSuffix: false,
        contentType: contentTypeFor(store.photo),
      },
    );

    const entry = {
      storeId: store._id.toString(),
      name: store.name,
      slug: store.slug,
      oldPhoto: store.photo,
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: new Date().toISOString(),
    };

    manifest.entries.push(entry);
    uploaded.set(key, entry);
    await writeManifest(manifestPath, {
      ...manifest,
      generatedAt: new Date().toISOString(),
    });

    console.log(`Uploaded: ${store.name} -> ${blob.url}`);
  }

  await writeManifest(manifestPath, {
    ...manifest,
    generatedAt: new Date().toISOString(),
  });

  console.log(`\nManifest written to ${manifestPath}`);
}

async function apply(manifestPath) {
  const manifest = await readManifest(manifestPath);

  if (!manifest.entries.length) {
    throw new Error(`No entries found in ${manifestPath}. Run --upload first.`);
  }

  let updated = 0;
  let skipped = 0;

  for (const entry of manifest.entries) {
    const result = await Store.updateOne(
      {
        _id: entry.storeId,
        photo: entry.oldPhoto,
      },
      {
        $set: {
          photo: entry.url,
          photoPathname: entry.pathname,
        },
      },
    );

    if (result.modifiedCount) {
      updated += 1;
      console.log(`Updated: ${entry.name} (${entry.oldPhoto})`);
    } else {
      skipped += 1;
      console.log(`Skipped: ${entry.name} (${entry.oldPhoto})`);
    }
  }

  console.log(`\nMongoDB updates applied: ${updated}`);
  console.log(`Skipped because records no longer matched: ${skipped}`);
}

async function main() {
  const { mode, manifestPath } = parseArgs(process.argv);

  if (!["--dry-run", "--upload", "--apply"].includes(mode)) {
    usage();
    process.exitCode = 1;
    return;
  }

  await connect();

  if (mode === "--dry-run") await dryRun();
  if (mode === "--upload") await upload(manifestPath);
  if (mode === "--apply") await apply(manifestPath);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
