import * as core from "@actions/core";
import * as google from "@googleapis/androidpublisher";
import * as fs from "fs";

import type { androidpublisher_v3 } from "@googleapis/androidpublisher";
import type { GoogleAuth } from "google-auth-library";

type Publisher = androidpublisher_v3.Androidpublisher;
type Apk = androidpublisher_v3.Schema$Apk;
type Bundle = androidpublisher_v3.Schema$Bundle;
type Track = androidpublisher_v3.Schema$Track;

async function createAuthClient(serviceAccountKeyPath: string): Promise<GoogleAuth> {
  return new google.auth.GoogleAuth({
    keyFile: serviceAccountKeyPath,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
}

async function publishApp(
  serviceAccountKeyPath: string,
  packageName: string,
  bundlePath: string,
  proguardMappingFilePath: string | undefined,
  inAppUpdatePriority: number,
): Promise<string> {
  const authClient = await createAuthClient(serviceAccountKeyPath);
  const publisher = google.androidpublisher({
    version: "v3",
    auth: authClient,
  });

  const editId = await createEdit(publisher, packageName);
  await validateSelectedTrack(publisher, editId, packageName);

  const versionCode = await uploadReleaseFiles(publisher, editId, packageName, bundlePath);

  if (proguardMappingFilePath) {
    await uploadProguardMappingFile(publisher, editId, packageName, versionCode, proguardMappingFilePath);
  }

  await updateTrack(publisher, editId, packageName, versionCode, inAppUpdatePriority);
  await commitEdit(publisher, editId, packageName);

  // Return the internal sharing URL
  return `https://play.google.com/apps/test/${packageName}/${versionCode}`;
}

async function createEdit(publisher: Publisher, packageName: string): Promise<string> {
  core.info(`Creating new Edit for "${packageName}"`);
  const result = await publisher.edits.insert({ packageName: packageName });
  if (result.status != 200) {
    throw Error(result.statusText);
  }
  if (!result.data.id) {
    throw Error("Something went wrong.");
  }
  core.info(`- Created new Edit for "${packageName}" - Expires at ${String(result.data.expiryTimeSeconds)}`);
  return result.data.id;
}

async function validateSelectedTrack(publisher: Publisher, editId: string, packageName: string, track: string = "internal"): Promise<void> {
  core.info(`Validating track "${track}"`);
  const res = await publisher.edits.tracks.list({
    editId: editId,
    packageName: packageName,
  });
  if (res.status != 200) {
    throw Error(res.statusText);
  }
  const allTracks = res.data.tracks;
  // Check whether we actually have any tracks
  if (!allTracks) {
    throw Error("No tracks found, unable to validate track.");
  }

  // Check whether the track is valid
  if (allTracks.find((value) => value.track == track) == undefined) {
    const allTrackNames = allTracks.map((track) => {
      return track.track;
    });
    throw Error(`Track "${track}" could not be found. Available tracks are: ${allTrackNames.toString()}`);
  }
  core.info(`- Track "${track} is valid"`);
}

async function uploadReleaseFiles(publisher: Publisher, editId: string, packageName: string, releaseFile: string): Promise<number> {
  core.info(`Uploading release file"`);
  if (releaseFile.endsWith(".apk")) {
    // Upload APK, or throw when something goes wrong
    const apk = await uploadApk(publisher, editId, packageName, releaseFile);
    if (!apk.versionCode) throw Error("Failed to upload APK.");
    core.info(`- Uploaded APK with version code "${apk.versionCode}"`);
    return apk.versionCode;
  } else if (releaseFile.endsWith(".aab")) {
    // Upload AAB, or throw when something goes wrong
    const bundle = await uploadBundle(publisher, editId, packageName, releaseFile);
    if (!bundle.versionCode) throw Error("Failed to upload bundle.");
    core.info(`- Uploaded bundle with version code ${bundle.versionCode}`);
    return bundle.versionCode;
  } else {
    // Throw if file extension is not right
    throw Error(`${releaseFile} is invalid.`);
  }
}

async function updateTrack(
  publisher: Publisher,
  editId: string,
  packageName: string,
  versionCode: number,
  inAppUpdatePriority: number = 0,
  track: string = "internal",
): Promise<Track> {
  core.info(`Updating track "${track}" in "${packageName}" with build "${versionCode}" at update priority ${inAppUpdatePriority}`);
  const res = await publisher.edits.tracks.update({
    packageName: packageName,
    editId: editId,
    track: track,
    requestBody: {
      track: track,
      releases: [
        {
          versionCodes: [versionCode.toString()],
          status: "completed",
          inAppUpdatePriority: inAppUpdatePriority,
        },
      ],
    },
  });
  core.info(`- Updated track "${track}"`);
  return res.data;
}

async function commitEdit(publisher: Publisher, editId: string, packageName: string): Promise<string> {
  core.info(`Committing the Edit`);
  const res = await publisher.edits.commit({
    editId: editId,
    packageName: packageName,
  });

  if (res.data.id) {
    core.info(`- Successfully committed edit "${res.data.id}"`);
    return res.data.id;
  } else {
    return Promise.reject(res.status);
  }
}

async function uploadBundle(publisher: Publisher, editId: string, packageName: string, bundleReleaseFile: string): Promise<Bundle> {
  if (!fs.existsSync(bundleReleaseFile)) {
    throw new Error(`App Bundle file "${bundleReleaseFile}" does not exist.`);
  }
  const stats = fs.statSync(bundleReleaseFile);
  core.info(`Uploading App Bundle @ "${bundleReleaseFile}" - ${stats.size} bytes`);
  const res = await publisher.edits.bundles.upload({
    packageName: packageName,
    editId: editId,
    media: {
      mimeType: "application/octet-stream",
      body: fs.createReadStream(bundleReleaseFile),
    },
  });
  return res.data;
}

async function uploadApk(publisher: Publisher, editId: string, packageName: string, apkReleaseFile: string): Promise<Apk> {
  if (!fs.existsSync(apkReleaseFile)) {
    throw new Error(`APK file "${apkReleaseFile}" does not exist.`);
  }
  const stats = fs.statSync(apkReleaseFile);
  core.info(`Uploading APK @ "${apkReleaseFile}" - ${stats.size} bytes`);
  const res = await publisher.edits.apks.upload({
    packageName: packageName,
    editId: editId,
    media: {
      mimeType: "application/vnd.android.package-archive",
      body: fs.createReadStream(apkReleaseFile),
    },
  });
  return res.data;
}

async function uploadProguardMappingFile(
  publisher: Publisher,
  editId: string,
  packageName: string,
  versionCode: number,
  mappingFile: string,
) {
  if (mappingFile != undefined && mappingFile.length > 0) {
    core.info(`Uploading Proguard mapping file @ "${mappingFile}"`);
    await publisher.edits.deobfuscationfiles.upload({
      packageName: packageName,
      editId: editId,
      apkVersionCode: versionCode,
      deobfuscationFileType: "proguard",
      media: {
        mimeType: "application/octet-stream",
        body: fs.createReadStream(mappingFile),
      },
    });
  }
}

export function parseInAppUpdatePriority(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 0;

  const priority = Number(raw.trim());

  if (!Number.isInteger(priority)) {
    throw new Error(`inAppUpdatePriority must be an integer between 0 and 5, got "${raw}"`);
  }
  if (priority < 0 || priority > 5) {
    throw new Error(`inAppUpdatePriority must be between 0 and 5, got ${priority}`);
  }
  return priority;
}

async function run(): Promise<void> {
  try {
    const serviceAccountKeyPath = core.getInput("serviceAccountKeyPath", { required: true });
    const packageName = core.getInput("packageName", { required: true });
    const bundlePath = core.getInput("bundlePath", { required: true });
    const proguardMappingFilePath = core.getInput("proguardMappingFilePath");
    const inAppUpdatePriority = parseInAppUpdatePriority(core.getInput("inAppUpdatePriority", { required: false }));

    const internalSharingUrl = await publishApp(
      serviceAccountKeyPath,
      packageName,
      bundlePath,
      proguardMappingFilePath,
      inAppUpdatePriority,
    );
    core.setOutput("internal-sharing-url", internalSharingUrl);
    core.info(`Internal sharing URL: ${internalSharingUrl}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      const serialized = typeof error === "object" ? JSON.stringify(error) : String(error);
      core.setFailed(`Non-Error thrown: ${serialized}`);
    }
  }
}

run();
