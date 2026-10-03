package com.denx.animator;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "DenXFileSaver")
public class DenXFileSaverPlugin extends Plugin {
    private OutputStream stream;
    private Uri savedUri;
    private String sessionId;
    private String mimeType;

    @PluginMethod
    public void beginSave(PluginCall call) {
        if (stream != null) {
            call.reject("Another DenX export is already being saved.");
            return;
        }

        String fileName = call.getString("fileName", "DenX-Export");
        mimeType = call.getString("mimeType", "application/octet-stream");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveDestinationSelected");
    }

    @ActivityCallback
    private void saveDestinationSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Save cancelled.");
            return;
        }

        try {
            savedUri = result.getData().getData();
            if (savedUri == null) throw new IllegalStateException("No save destination was returned.");
            stream = getContext().getContentResolver().openOutputStream(savedUri, "w");
            if (stream == null) throw new IllegalStateException("Could not open the selected file.");
            sessionId = UUID.randomUUID().toString();
            JSObject data = new JSObject();
            data.put("sessionId", sessionId);
            call.resolve(data);
        } catch (Exception error) {
            closeQuietly();
            call.reject("Could not create the selected file.", error);
        }
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        String requestedSession = call.getString("sessionId", "");
        String chunk = call.getString("base64Chunk", "");
        if (stream == null || sessionId == null || !sessionId.equals(requestedSession)) {
            call.reject("The DenX save session is no longer active.");
            return;
        }

        try {
            stream.write(Base64.decode(chunk, Base64.DEFAULT));
            call.resolve();
        } catch (Exception error) {
            closeQuietly();
            call.reject("Could not write the export to storage.", error);
        }
    }

    @PluginMethod
    public void finishSave(PluginCall call) {
        String requestedSession = call.getString("sessionId", "");
        if (stream == null || sessionId == null || !sessionId.equals(requestedSession)) {
            call.reject("The DenX save session is no longer active.");
            return;
        }

        try {
            stream.flush();
            stream.close();
            stream = null;
            sessionId = null;
            JSObject data = new JSObject();
            data.put("uri", savedUri == null ? "" : savedUri.toString());
            call.resolve(data);
        } catch (Exception error) {
            closeQuietly();
            call.reject("Could not finish saving the export.", error);
        }
    }

    @PluginMethod
    public void shareLastFile(PluginCall call) {
        if (savedUri == null) {
            call.reject("No completed DenX export is available to share.");
            return;
        }

        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType(mimeType == null ? "application/octet-stream" : mimeType);
        share.putExtra(Intent.EXTRA_STREAM, savedUri);
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(Intent.createChooser(share, "Share DenX export"));
        call.resolve();
    }

    @PluginMethod
    public void cancelSave(PluginCall call) {
        closeQuietly();
        call.resolve();
    }

    private void closeQuietly() {
        try {
            if (stream != null) stream.close();
        } catch (Exception ignored) {}
        stream = null;
        sessionId = null;
    }
}
