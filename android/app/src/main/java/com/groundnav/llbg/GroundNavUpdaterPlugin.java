package com.groundnav.llbg;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.android.apksig.ApkVerifier;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "GroundNavUpdater")
public final class GroundNavUpdaterPlugin extends Plugin {

    private static final String TAG = "GroundNavUpdater";
    private static final String LATEST_RELEASE_PATH = "/releases/latest";
    private static final String MANIFEST_ASSET_NAME = "release-manifest.json";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final int MAX_REDIRECTS = 5;
    private static final int MAX_JSON_BYTES = 1_000_000;
    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;

    private final AtomicBoolean downloadRunning = new AtomicBoolean(false);
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("versionName", BuildConfig.VERSION_NAME);
            result.put("versionCode", BuildConfig.VERSION_CODE);
            call.resolve(result);
        } catch (Exception error) {
            reject(call, error);
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        execute(() -> {
            try {
                notifyState("checking", "Checking the latest signed GroundNav release");
                UpdateInfo update = loadLatestUpdate();
                String installedSigner = getInstalledSignerDigest();
                boolean compatible = update.signerSha256.equals(BuildConfig.UPDATE_SIGNER_SHA256) && update.signerSha256.equals(installedSigner);

                JSObject result = update.toJsObject();
                result.put("currentVersionName", BuildConfig.VERSION_NAME);
                result.put("currentVersionCode", BuildConfig.VERSION_CODE);
                result.put("available", update.versionCode > BuildConfig.VERSION_CODE);
                result.put("installCompatible", compatible);
                if (!compatible) {
                    result.put("compatibilityMessage", "This installation uses a different signing key. Uninstall the old debug build once, then install the public release.");
                }
                notifyState("checked", update.versionCode > BuildConfig.VERSION_CODE ? "Update available" : "GroundNav is current");
                call.resolve(result);
            } catch (Exception error) {
                notifyState("error", safeMessage(error));
                reject(call, error);
            }
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        if (!downloadRunning.compareAndSet(false, true)) {
            call.reject("An Android update is already downloading", "UPDATE_IN_PROGRESS");
            return;
        }

        cancelRequested.set(false);
        execute(() -> {
            File downloadedApk = null;
            try {
                notifyState("checking", "Confirming the latest signed release");
                UpdateInfo update = loadLatestUpdate();
                if (update.versionCode <= BuildConfig.VERSION_CODE) {
                    JSObject result = new JSObject();
                    result.put("status", "current");
                    result.put("versionName", BuildConfig.VERSION_NAME);
                    call.resolve(result);
                    return;
                }

                String installedSigner = getInstalledSignerDigest();
                if (!update.signerSha256.equals(BuildConfig.UPDATE_SIGNER_SHA256) || !update.signerSha256.equals(installedSigner)) {
                    throw new SecurityException("The installed app and GitHub release use different signing keys. Uninstall the old debug build once, then install the public release.");
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    openUnknownSourcesSettings(call);
                    return;
                }

                notifyState("downloading", "Downloading GroundNav " + update.versionName);
                downloadedApk = downloadApk(update);
                notifyState("verifying", "Verifying checksum, package, version and signing certificate");
                verifyDownloadedApk(downloadedApk, update, installedSigner);

                File verifiedApk = downloadedApk;
                getActivity().runOnUiThread(() -> {
                    try {
                        launchInstaller(verifiedApk);
                        notifyState("installer-opened", "Android installer opened");
                        JSObject result = new JSObject();
                        result.put("status", "installer_opened");
                        result.put("versionName", update.versionName);
                        call.resolve(result);
                    } catch (Exception error) {
                        notifyState("error", safeMessage(error));
                        reject(call, error);
                    } finally {
                        downloadRunning.set(false);
                    }
                });
                return;
            } catch (Exception error) {
                if (downloadedApk != null && downloadedApk.exists()) downloadedApk.delete();
                notifyState("error", safeMessage(error));
                reject(call, error);
            } finally {
                if (downloadRunning.get()) downloadRunning.set(false);
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelRequested.set(true);
        JSObject result = new JSObject();
        result.put("cancelled", downloadRunning.get());
        call.resolve(result);
    }

    private UpdateInfo loadLatestUpdate() throws Exception {
        JSONObject release = new JSONObject(readText(BuildConfig.UPDATE_REPOSITORY_API + LATEST_RELEASE_PATH, "application/vnd.github+json"));
        String tag = release.getString("tag_name");
        String releaseUrl = release.getString("html_url");
        JSONArray assets = release.getJSONArray("assets");
        JSONObject manifestAsset = findAsset(assets, MANIFEST_ASSET_NAME);
        if (manifestAsset == null) throw new IOException("Latest GroundNav release has no release manifest");

        JSONObject manifest = new JSONObject(readText(manifestAsset.getString("browser_download_url"), "application/json"));
        String applicationId = manifest.getString("applicationId");
        String manifestTag = manifest.getString("tag");
        String versionName = manifest.getString("versionName");
        long versionCode = manifest.getLong("versionCode");
        String apkName = manifest.getString("apk");
        String sha256 = normalizeDigest(manifest.getString("sha256"));
        String signerSha256 = normalizeDigest(manifest.getString("signingCertificateSha256"));

        if (!BuildConfig.APPLICATION_ID.equals(applicationId)) throw new SecurityException("Release package ID does not match GroundNav");
        if (!tag.equals(manifestTag)) throw new SecurityException("Release tag does not match its manifest");
        if (versionCode <= 0 || versionCode >= 2_100_000_000L) throw new SecurityException("Release version code is invalid");
        if (versionName.trim().isEmpty()) throw new SecurityException("Release version name is missing");
        if (!apkName.matches("GroundNav-v[0-9]+\\.[0-9]+\\.[0-9]+\\.apk")) throw new SecurityException("Release APK name is invalid");
        if (sha256.length() != 64 || signerSha256.length() != 64) throw new SecurityException("Release security metadata is invalid");
        if (!signerSha256.equals(BuildConfig.UPDATE_SIGNER_SHA256)) throw new SecurityException("Release manifest uses an untrusted signing certificate");

        JSONObject apkAsset = findAsset(assets, apkName);
        if (apkAsset == null) throw new IOException("Latest GroundNav release has no matching APK");
        long assetSize = apkAsset.getLong("size");
        if (assetSize <= 0 || assetSize > MAX_APK_BYTES) throw new SecurityException("Release APK size is outside the allowed range");

        String assetDigest = apkAsset.optString("digest", "");
        if (!assetDigest.trim().isEmpty()) {
            if (!assetDigest.toLowerCase(Locale.US).startsWith("sha256:")) throw new SecurityException("GitHub release uses an unsupported asset digest");
            if (!normalizeDigest(assetDigest.substring("sha256:".length())).equals(sha256)) {
                throw new SecurityException("GitHub asset digest does not match the release manifest");
            }
        }

        validateTrustedUrl(new URL(releaseUrl));
        URL apkUrl = new URL(apkAsset.getString("browser_download_url"));
        validateTrustedUrl(apkUrl);
        return new UpdateInfo(tag, versionName, versionCode, apkName, apkUrl.toString(), assetSize, sha256, signerSha256, releaseUrl);
    }

    private File downloadApk(UpdateInfo update) throws Exception {
        File updateDirectory = new File(getContext().getCacheDir(), "updates");
        if (!updateDirectory.exists() && !updateDirectory.mkdirs()) throw new IOException("Could not create the secure update directory");

        File partial = new File(updateDirectory, "GroundNav-update.apk.part");
        File completed = new File(updateDirectory, "GroundNav-update.apk");
        partial.delete();
        completed.delete();

        HttpURLConnection connection = openGet(update.apkUrl, "application/octet-stream");
        try {
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_BYTES) throw new SecurityException("Downloaded APK is too large");
            if (contentLength > 0 && contentLength != update.assetSize) throw new SecurityException("Downloaded APK size differs from GitHub release metadata");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0;
            byte[] buffer = new byte[64 * 1024];
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (cancelRequested.get()) throw new IOException("Update download cancelled");
                    received += count;
                    if (received > MAX_APK_BYTES || received > update.assetSize) throw new SecurityException("Downloaded APK exceeds the expected size");
                    output.write(buffer, 0, count);
                    digest.update(buffer, 0, count);
                    notifyDownloadProgress(received, update.assetSize);
                }
                output.getFD().sync();
            }

            if (received != update.assetSize) throw new SecurityException("Downloaded APK is incomplete");
            String actualSha256 = toHex(digest.digest());
            if (!actualSha256.equals(update.sha256)) throw new SecurityException("Downloaded APK checksum does not match the GitHub release");
            if (!partial.renameTo(completed)) throw new IOException("Could not finalize the downloaded update");
            return completed;
        } catch (Exception error) {
            partial.delete();
            completed.delete();
            throw error;
        } finally {
            connection.disconnect();
        }
    }

    private void verifyDownloadedApk(File apk, UpdateInfo update, String installedSigner) throws Exception {
        ApkVerifier.Result verification = new ApkVerifier.Builder(apk).build().verify();
        if (!verification.isVerified() || verification.containsErrors()) throw new SecurityException("Android signature verification failed");
        List<X509Certificate> certificates = verification.getSignerCertificates();
        if (certificates.size() != 1) throw new SecurityException("GroundNav updates must have exactly one signer");
        String apkSigner = certificateDigest(certificates.get(0));
        if (!apkSigner.equals(BuildConfig.UPDATE_SIGNER_SHA256) || !apkSigner.equals(update.signerSha256) || !apkSigner.equals(installedSigner)) {
            throw new SecurityException("Downloaded APK is not signed by the installed GroundNav certificate");
        }

        PackageManager packageManager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null) throw new SecurityException("Downloaded file is not a valid Android package");
        if (!BuildConfig.APPLICATION_ID.equals(archive.packageName)) throw new SecurityException("Downloaded APK has the wrong package ID");
        long archiveVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode;
        if (archiveVersionCode != update.versionCode || archiveVersionCode <= BuildConfig.VERSION_CODE) {
            throw new SecurityException("Downloaded APK version is not a valid upgrade");
        }
        if (archive.versionName == null || !archive.versionName.equals(update.versionName)) throw new SecurityException("Downloaded APK version name is invalid");
        if (!getPackageSignerDigest(archive).equals(apkSigner)) throw new SecurityException("Android package metadata reports a different signer");

        try (FileInputStream input = new FileInputStream(apk)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            if (!toHex(digest.digest()).equals(update.sha256)) throw new SecurityException("Verified APK checksum changed unexpectedly");
        }
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), BuildConfig.APPLICATION_ID + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, APK_MIME_TYPE);
        intent.setClipData(ClipData.newRawUri("GroundNav update", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(intent);
    }

    private void openUnknownSourcesSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + BuildConfig.APPLICATION_ID));
                getActivity().startActivity(settings);
                JSObject result = new JSObject();
                result.put("status", "permission_required");
                result.put("message", "Allow GroundNav to install unknown apps, return here, then tap the update button again.");
                call.resolve(result);
            } catch (Exception error) {
                reject(call, error);
            } finally {
                downloadRunning.set(false);
            }
        });
    }

    private String getInstalledSignerDigest() throws Exception {
        PackageManager packageManager = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo installed = packageManager.getPackageInfo(BuildConfig.APPLICATION_ID, flags);
        return getPackageSignerDigest(installed);
    }

    private String getPackageSignerDigest(PackageInfo packageInfo) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (packageInfo.signingInfo == null) throw new SecurityException("Android package has no signing information");
            signatures = packageInfo.signingInfo.getApkContentsSigners();
        } else {
            signatures = packageInfo.signatures;
        }
        if (signatures == null || signatures.length != 1) throw new SecurityException("GroundNav must have exactly one installed signer");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return toHex(digest.digest(signatures[0].toByteArray()));
    }

    private String certificateDigest(X509Certificate certificate) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return toHex(digest.digest(certificate.getEncoded()));
    }

    private JSONObject findAsset(JSONArray assets, String name) throws Exception {
        for (int index = 0; index < assets.length(); index += 1) {
            JSONObject asset = assets.getJSONObject(index);
            if (name.equals(asset.optString("name"))) return asset;
        }
        return null;
    }

    private String readText(String url, String accept) throws Exception {
        HttpURLConnection connection = openGet(url, accept);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_JSON_BYTES) throw new SecurityException("GitHub release metadata is too large");
                output.write(buffer, 0, count);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } finally {
            connection.disconnect();
        }
    }

    private HttpURLConnection openGet(String rawUrl, String accept) throws Exception {
        URL current = new URL(rawUrl);
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
            validateTrustedUrl(current);
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", accept);
            connection.setRequestProperty("User-Agent", "GroundNav-Android-Updater");
            connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_PERM || status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_SEE_OTHER || status == 307 || status == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.trim().isEmpty()) throw new IOException("GitHub returned an empty redirect");
                current = new URL(current, location);
                continue;
            }
            if (status != HttpURLConnection.HTTP_OK) {
                connection.disconnect();
                throw new IOException("GitHub update service returned HTTP " + status);
            }
            return connection;
        }
        throw new SecurityException("GitHub update download exceeded the redirect limit");
    }

    private void validateTrustedUrl(URL url) throws SecurityException {
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new SecurityException("GroundNav updates require HTTPS");
        if (url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)) throw new SecurityException("GroundNav update URL is invalid");
        String host = url.getHost().toLowerCase(Locale.US);
        boolean trusted = host.equals("api.github.com") || host.equals("github.com") || host.equals("release-assets.githubusercontent.com") || host.endsWith(".githubusercontent.com");
        if (!trusted) throw new SecurityException("GroundNav update redirected to an untrusted host");
    }

    private String normalizeDigest(String value) {
        return value.replace(":", "").replaceAll("\\s+", "").toUpperCase(Locale.US);
    }

    private String toHex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(Locale.US, "%02X", item));
        return result.toString();
    }

    private void notifyDownloadProgress(long received, long total) {
        JSObject event = new JSObject();
        event.put("receivedBytes", received);
        event.put("totalBytes", total);
        event.put("percent", total > 0 ? Math.min(100, Math.round((received * 100f) / total)) : 0);
        notifyListeners("downloadProgress", event);
    }

    private void notifyState(String state, String message) {
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("message", message);
        notifyListeners("updateState", event);
    }

    private void reject(PluginCall call, Exception error) {
        Logger.error(TAG, safeMessage(error), error);
        call.reject(safeMessage(error), "UPDATE_FAILED", error);
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? "Android update failed" : message;
    }

    private static final class UpdateInfo {
        final String tag;
        final String versionName;
        final long versionCode;
        final String apkName;
        final String apkUrl;
        final long assetSize;
        final String sha256;
        final String signerSha256;
        final String releaseUrl;

        UpdateInfo(String tag, String versionName, long versionCode, String apkName, String apkUrl, long assetSize, String sha256, String signerSha256, String releaseUrl) {
            this.tag = tag;
            this.versionName = versionName;
            this.versionCode = versionCode;
            this.apkName = apkName;
            this.apkUrl = apkUrl;
            this.assetSize = assetSize;
            this.sha256 = sha256;
            this.signerSha256 = signerSha256;
            this.releaseUrl = releaseUrl;
        }

        JSObject toJsObject() {
            JSObject result = new JSObject();
            result.put("tag", tag);
            result.put("latestVersionName", versionName);
            result.put("latestVersionCode", versionCode);
            result.put("apkName", apkName);
            result.put("sizeBytes", assetSize);
            result.put("releaseUrl", releaseUrl);
            return result;
        }
    }
}
