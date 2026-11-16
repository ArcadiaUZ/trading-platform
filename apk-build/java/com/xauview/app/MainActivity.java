package com.xauview.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String PREFS = "xauview";
    private static final String KEY_URL = "server_url";
    private static final String DEFAULT_URL = "http://10.149.101.17:8765/";
    private WebView web;
    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Window w = getWindow();
        w.setStatusBarColor(Color.BLACK);
        w.setNavigationBarColor(Color.BLACK);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        web.addJavascriptInterface(new Bridge(), "And");

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { public void run() { r.grant(r.getResources()); } });
            }
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) { return true; }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req != null && req.isForMainFrame()) toast("Server topilmadi - manzilni tekshiring");
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            try { requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7); } catch (Throwable t) {}
        }

        String url = prefs.getString(KEY_URL, "");
        if (url.length() == 0) askServer(false);
        else load(url);
    }

    private void load(String url) {
        if (url == null || url.trim().length() == 0 || url.trim().equalsIgnoreCase("offline")) {
            web.loadUrl("file:///android_asset/index.html");
            return;
        }
        String u = url.trim();
        if (!u.startsWith("http")) u = "http://" + u;
        if (!u.endsWith("/")) u = u + "/";
        web.loadUrl(u);
    }

    private void askServer(final boolean cancelable) {
        final EditText et = new EditText(this);
        et.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        et.setSingleLine(true);
        String cur = prefs.getString(KEY_URL, DEFAULT_URL);
        et.setText(cur);
        et.setSelection(et.getText().length());
        AlertDialog.Builder ab = new AlertDialog.Builder(this);
        ab.setTitle("Server manzili");
        ab.setMessage("Telefon va kompyuter bir Wi-Fi da bolsin. Masalan: http://10.149.101.17:8765 . Oflayn rejim uchun: offline");
        ab.setView(et);
        ab.setPositiveButton("Ulanish", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface d, int i) {
                String v = et.getText().toString().trim();
                prefs.edit().putString(KEY_URL, v).apply();
                load(v);
            }
        });
        if (cancelable) ab.setNegativeButton("Bekor", null);
        else ab.setNegativeButton("Oflayn", new DialogInterface.OnClickListener() {
            public void onClick(DialogInterface d, int i) {
                prefs.edit().putString(KEY_URL, "offline").apply();
                load("offline");
            }
        });
        ab.show();
    }

    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_SHORT).show(); }

    public class Bridge {
        @JavascriptInterface
        public String getServer() { return prefs.getString(KEY_URL, ""); }
        @JavascriptInterface
        public void setServer(final String u) {
            runOnUiThread(new Runnable() { public void run() {
                prefs.edit().putString(KEY_URL, u).apply();
                load(u);
            } });
        }
        @JavascriptInterface
        public void chooseServer() { runOnUiThread(new Runnable() { public void run() { askServer(true); } }); }
        @JavascriptInterface
        public String platform() { return "android-apk"; }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }
}
