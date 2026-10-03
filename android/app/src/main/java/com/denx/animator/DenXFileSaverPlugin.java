package com.denx.animator;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.SystemClock;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLExt;
import android.opengl.EGLSurface;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.provider.DocumentsContract;
import android.util.Base64;
import android.view.Surface;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "DenXFileSaver")
public class DenXFileSaverPlugin extends Plugin {
    private OutputStream stream;
    private Uri savedUri;
    private String sessionId;
    private String mimeType;
    private final ExecutorService encoderWorker = Executors.newSingleThreadExecutor();
    private final Object videoLock = new Object();
    private MediaCodec videoCodec;
    private MediaMuxer videoMuxer;
    private Surface videoSurface;
    private CodecInputSurface videoInput;
    private File videoTemp;
    private Uri videoUri;
    private String videoSession;
    private int videoTrack = -1;
    private boolean videoMuxerStarted;
    private boolean videoCancelled;
    private int videoFrameIndex;
    private int videoFps;
    private long videoStartedAt;

    @PluginMethod
    public void beginSave(PluginCall call) {
        if (stream != null) { call.reject("Another DenX export is already being saved."); return; }
        String fileName = call.getString("fileName", "DenX-Export");
        mimeType = call.getString("mimeType", "application/octet-stream");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType(mimeType); intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveDestinationSelected");
    }

    @ActivityCallback
    private void saveDestinationSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("Save cancelled."); return; }
        try {
            savedUri = result.getData().getData();
            if (savedUri == null) throw new IllegalStateException("No save destination was returned.");
            stream = getContext().getContentResolver().openOutputStream(savedUri, "w");
            if (stream == null) throw new IllegalStateException("Could not open the selected file.");
            sessionId = UUID.randomUUID().toString(); JSObject data = new JSObject(); data.put("sessionId", sessionId); call.resolve(data);
        } catch (Exception error) { closeQuietly(); call.reject("Could not create the selected file.", error); }
    }

    @PluginMethod
    public void appendChunk(PluginCall call) {
        if (stream == null || sessionId == null || !sessionId.equals(call.getString("sessionId", ""))) { call.reject("The DenX save session is no longer active."); return; }
        try { stream.write(Base64.decode(call.getString("base64Chunk", ""), Base64.DEFAULT)); call.resolve(); }
        catch (Exception error) { closeQuietly(); call.reject("Could not write the export to storage.", error); }
    }

    @PluginMethod
    public void finishSave(PluginCall call) {
        if (stream == null || sessionId == null || !sessionId.equals(call.getString("sessionId", ""))) { call.reject("The DenX save session is no longer active."); return; }
        try { stream.flush(); stream.close(); stream=null; sessionId=null; mimeType=call.getString("mimeType",mimeType); JSObject data=new JSObject();data.put("uri",savedUri==null?"":savedUri.toString());call.resolve(data); }
        catch(Exception error){closeQuietly();call.reject("Could not finish saving the export.",error);}
    }

    @PluginMethod
    public void beginVideo(PluginCall call) {
        synchronized(videoLock){if(videoCodec!=null||videoSession!=null){call.reject("Another DenX video export is active.");return;}}
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("video/mp4");intent.putExtra(Intent.EXTRA_TITLE,call.getString("fileName","DenX-Animation.mp4"));
        startActivityForResult(call,intent,"videoDestinationSelected");
    }

    @ActivityCallback
    private void videoDestinationSelected(PluginCall call, ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("Save cancelled.");return;}
        final Uri destination=result.getData().getData();
        final int width=even(call.getInt("width",1280)),height=even(call.getInt("height",720));
        final int fps=Math.max(1,Math.min(60,call.getInt("fps",24))),bitrate=Math.max(500_000,call.getInt("bitrate",7_000_000));
        encoderWorker.execute(()->{try{setupVideo(destination,width,height,fps,bitrate);JSObject out=new JSObject();out.put("sessionId",videoSession);out.put("native",true);call.resolve(out);}catch(Exception error){releaseVideo(true);call.reject("Could not start the Android MP4 encoder.",error);}});
    }

    private int even(int value){value=Math.max(2,value);return value%2==0?value:value+1;}
    private void setupVideo(Uri destination,int width,int height,int fps,int bitrate)throws Exception{
        synchronized(videoLock){
            videoCancelled=false;videoFrameIndex=0;videoTrack=-1;videoMuxerStarted=false;videoFps=fps;videoUri=destination;videoSession=UUID.randomUUID().toString();
            videoTemp=new File(getContext().getCacheDir(),"denx-"+videoSession+".mp4");
            MediaFormat format=MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC,width,height);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT,MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
            format.setInteger(MediaFormat.KEY_BIT_RATE,bitrate);format.setInteger(MediaFormat.KEY_FRAME_RATE,fps);format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,1);
            videoCodec=MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);videoCodec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);
            videoSurface=videoCodec.createInputSurface();videoInput=new CodecInputSurface(videoSurface);videoCodec.start();videoMuxer=new MediaMuxer(videoTemp.getAbsolutePath(),MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);videoStartedAt=SystemClock.elapsedRealtime();
        }
    }

    @PluginMethod
    public void appendVideoFrame(PluginCall call){
        final String requested=call.getString("sessionId","");final String encoded=call.getString("base64Frame","");
        encoderWorker.execute(()->{try{synchronized(videoLock){assertVideo(requested);if(videoCancelled)throw new IllegalStateException("Export cancelled.");byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length);if(bitmap==null)throw new IllegalStateException("Android could not decode an animation frame.");
                    videoInput.draw(bitmap,(long)videoFrameIndex*1_000_000_000L/Math.max(1,videoFps));bitmap.recycle();
                    videoFrameIndex++;drainVideo(false);JSObject out=new JSObject();out.put("frame",videoFrameIndex);call.resolve(out);}}
            catch(Exception error){call.reject("Android could not encode this frame.",error);}});
    }

    private void assertVideo(String requested){if(videoCodec==null||videoSession==null||!videoSession.equals(requested))throw new IllegalStateException("The DenX video session is no longer active.");}

    private void drainVideo(boolean end)throws Exception{
        if(end)videoCodec.signalEndOfInputStream();MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();int idle=0;
        while(true){int index=videoCodec.dequeueOutputBuffer(info,end?10_000:0);if(index==MediaCodec.INFO_TRY_AGAIN_LATER){if(!end||idle++>250)break;continue;}if(index==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){if(videoMuxerStarted)throw new IllegalStateException("Video format changed twice.");videoTrack=videoMuxer.addTrack(videoCodec.getOutputFormat());videoMuxer.start();videoMuxerStarted=true;continue;}if(index>=0){ByteBuffer data=videoCodec.getOutputBuffer(index);if(data!=null&&(info.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)==0&&info.size>0){if(!videoMuxerStarted)throw new IllegalStateException("MP4 muxer did not start.");data.position(info.offset);data.limit(info.offset+info.size);videoMuxer.writeSampleData(videoTrack,data,info);}videoCodec.releaseOutputBuffer(index,false);if((info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0)break;}}
    }

    @PluginMethod
    public void finishVideo(PluginCall call){final String requested=call.getString("sessionId","");encoderWorker.execute(()->{try{synchronized(videoLock){assertVideo(requested);drainVideo(true);releaseEncoderOnly();if(videoCancelled)throw new IllegalStateException("Export cancelled.");copyVideoToDestination();savedUri=videoUri;mimeType="video/mp4";long size=videoTemp==null?0:videoTemp.length();deleteTemp();videoSession=null;videoUri=null;JSObject out=new JSObject();out.put("uri",savedUri==null?"":savedUri.toString());out.put("bytes",size);call.resolve(out);}}catch(Exception error){releaseVideo(true);call.reject("Could not finish the Android MP4.",error);}});}
    private void copyVideoToDestination()throws Exception{try(FileInputStream input=new FileInputStream(videoTemp);OutputStream output=getContext().getContentResolver().openOutputStream(videoUri,"w")){if(output==null)throw new IllegalStateException("Could not open the selected video file.");byte[] buffer=new byte[256*1024];int read;while((read=input.read(buffer))>=0){if(videoCancelled)throw new IllegalStateException("Export cancelled.");output.write(buffer,0,read);}output.flush();}}

    @PluginMethod
    public void cancelVideo(PluginCall call){videoCancelled=true;encoderWorker.execute(()->{releaseVideo(true);call.resolve();});}
    private void releaseEncoderOnly(){try{if(videoInput!=null)videoInput.release();else if(videoSurface!=null)videoSurface.release();}catch(Exception ignored){}try{if(videoCodec!=null){videoCodec.stop();videoCodec.release();}}catch(Exception ignored){}try{if(videoMuxer!=null){if(videoMuxerStarted)videoMuxer.stop();videoMuxer.release();}}catch(Exception ignored){}videoCodec=null;videoInput=null;videoSurface=null;videoMuxer=null;videoMuxerStarted=false;videoTrack=-1;}
    private void releaseVideo(boolean removeDocument){synchronized(videoLock){releaseEncoderOnly();deleteTemp();if(removeDocument&&videoUri!=null){try{DocumentsContract.deleteDocument(getContext().getContentResolver(),videoUri);}catch(Exception ignored){}}videoSession=null;videoUri=null;}}
    private void deleteTemp(){try{if(videoTemp!=null&&videoTemp.exists())videoTemp.delete();}catch(Exception ignored){}videoTemp=null;}

    @PluginMethod
    public void shareLastFile(PluginCall call){if(savedUri==null){call.reject("No completed DenX export is available to share.");return;}Intent share=new Intent(Intent.ACTION_SEND);share.setType(mimeType==null?"application/octet-stream":mimeType);share.putExtra(Intent.EXTRA_STREAM,savedUri);share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(Intent.createChooser(share,"Share DenX export"));call.resolve();}
    @PluginMethod public void cancelSave(PluginCall call){closeQuietly();call.resolve();}
    private void closeQuietly(){try{if(stream!=null)stream.close();}catch(Exception ignored){}stream=null;sessionId=null;}
    @Override protected void handleOnDestroy(){closeQuietly();videoCancelled=true;releaseVideo(false);encoderWorker.shutdownNow();}

    private static final class CodecInputSurface {
        private static final float[] VERTICES={-1f,-1f,0f,1f,1f,-1f,1f,1f,-1f,1f,0f,0f,1f,1f,1f,0f};
        private final Surface surface; private EGLDisplay display=EGL14.EGL_NO_DISPLAY; private EGLContext context=EGL14.EGL_NO_CONTEXT; private EGLSurface eglSurface=EGL14.EGL_NO_SURFACE;
        private int program,texture,position,texCoord; private final FloatBuffer vertices;
        CodecInputSurface(Surface surface){this.surface=surface;vertices=ByteBuffer.allocateDirect(VERTICES.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();vertices.put(VERTICES).position(0);setup();}
        private void setup(){display=EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);int[] version=new int[2];if(!EGL14.eglInitialize(display,version,0,version,1))throw new RuntimeException("EGL initialize failed");int[] attrs={EGL14.EGL_RED_SIZE,8,EGL14.EGL_GREEN_SIZE,8,EGL14.EGL_BLUE_SIZE,8,EGL14.EGL_ALPHA_SIZE,8,EGL14.EGL_RENDERABLE_TYPE,4,EGL14.EGL_NONE};EGLConfig[] configs=new EGLConfig[1];int[] count=new int[1];EGL14.eglChooseConfig(display,attrs,0,configs,0,1,count,0);int[] ctxAttrs={EGL14.EGL_CONTEXT_CLIENT_VERSION,2,EGL14.EGL_NONE};context=EGL14.eglCreateContext(display,configs[0],EGL14.EGL_NO_CONTEXT,ctxAttrs,0);int[] surfaceAttrs={EGL14.EGL_NONE};eglSurface=EGL14.eglCreateWindowSurface(display,configs[0],surface,surfaceAttrs,0);EGL14.eglMakeCurrent(display,eglSurface,eglSurface,context);program=link("attribute vec4 aPosition;attribute vec2 aTexCoord;varying vec2 vTexCoord;void main(){gl_Position=aPosition;vTexCoord=aTexCoord;}","precision mediump float;uniform sampler2D uTexture;varying vec2 vTexCoord;void main(){gl_FragColor=texture2D(uTexture,vTexCoord);}");position=GLES20.glGetAttribLocation(program,"aPosition");texCoord=GLES20.glGetAttribLocation(program,"aTexCoord");int[] ids=new int[1];GLES20.glGenTextures(1,ids,0);texture=ids[0];GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);}
        private int shader(int type,String source){int id=GLES20.glCreateShader(type);GLES20.glShaderSource(id,source);GLES20.glCompileShader(id);int[] ok=new int[1];GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0)throw new RuntimeException("MP4 shader failed: "+GLES20.glGetShaderInfoLog(id));return id;}
        private int link(String vertex,String fragment){int p=GLES20.glCreateProgram();GLES20.glAttachShader(p,shader(GLES20.GL_VERTEX_SHADER,vertex));GLES20.glAttachShader(p,shader(GLES20.GL_FRAGMENT_SHADER,fragment));GLES20.glLinkProgram(p);return p;}
        void draw(Bitmap bitmap,long presentationNs){EGL14.eglMakeCurrent(display,eglSurface,eglSurface,context);GLES20.glViewport(0,0,bitmap.getWidth(),bitmap.getHeight());GLES20.glClearColor(0,0,0,1);GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);GLES20.glUseProgram(program);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bitmap,0);vertices.position(0);GLES20.glEnableVertexAttribArray(position);GLES20.glVertexAttribPointer(position,2,GLES20.GL_FLOAT,false,16,vertices);vertices.position(2);GLES20.glEnableVertexAttribArray(texCoord);GLES20.glVertexAttribPointer(texCoord,2,GLES20.GL_FLOAT,false,16,vertices);GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);EGLExt.eglPresentationTimeANDROID(display,eglSurface,presentationNs);if(!EGL14.eglSwapBuffers(display,eglSurface))throw new RuntimeException("Could not submit MP4 frame");}
        void release(){if(display!=EGL14.EGL_NO_DISPLAY){EGL14.eglMakeCurrent(display,EGL14.EGL_NO_SURFACE,EGL14.EGL_NO_SURFACE,EGL14.EGL_NO_CONTEXT);EGL14.eglDestroySurface(display,eglSurface);EGL14.eglDestroyContext(display,context);EGL14.eglReleaseThread();EGL14.eglTerminate(display);}surface.release();display=EGL14.EGL_NO_DISPLAY;context=EGL14.EGL_NO_CONTEXT;eglSurface=EGL14.EGL_NO_SURFACE;}
    }
}
